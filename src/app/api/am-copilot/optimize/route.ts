import { NextRequest, NextResponse } from "next/server";

import {
  optimizeComposition,
  type OeReference,
  type AgingProtocolInput,
  type OptimizationConstraints,
  type EmissionEra,
} from "@/lib/catsizer/composition-optimizer";

import { ECS_COMPONENTS } from "@/lib/catsizer/oem-database";

/**
 * POST /api/am-copilot/optimize
 *
 * Runs the composition optimizer: finds minimum-PGM AM formulations
 * that pass against an OE reference after aging.
 *
 * Body:
 * - selectedIndex: number — index into ECS_COMPONENTS for OE reference
 * - era: EmissionEra — override emission era (optional, inferred from database)
 * - componentType: string — which component to optimize (default "CC-TWC")
 * - agingProtocol: Partial<AgingProtocolInput> — aging params (defaults to RAT-A)
 * - pgmPrices: { pd, rh, pt } — EUR/g prices for cost ranking
 * - constraints: Partial<OptimizationConstraints> — search constraints
 */
export async function POST(request: NextRequest) {
  let body: {
    selectedIndex: number;
    era?: EmissionEra;
    componentType?: string;
    agingProtocol?: Partial<AgingProtocolInput>;
    pgmPrices?: { pd: number; rh: number; pt: number };
    constraints?: Partial<OptimizationConstraints>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const idx = body.selectedIndex;
  if (typeof idx !== "number" || idx < 0 || idx >= ECS_COMPONENTS.length) {
    return NextResponse.json(
      { error: `selectedIndex must be 0–${ECS_COMPONENTS.length - 1}` },
      { status: 400 },
    );
  }

  const record = ECS_COMPONENTS[idx] as unknown as Record<string, unknown>;

  // Build OE reference from database record
  // Field names follow the OEM database schema
  const oeReference: OeReference = {
    engineCode: String(record.engine_code ?? record.engineCode ?? "Unknown"),
    oemGroup: String(record.manufacturer ?? record.oem_group ?? "Unknown"),
    era: body.era ?? inferEra(record),
    componentType: (body.componentType as OeReference["componentType"]) ?? "CC-TWC",
    oeFreshPdGPerL: toNum(record.cc_pd_g_L ?? record.pd_g_L, 1.5),
    oeFreshRhGPerL: toNum(record.cc_rh_g_L ?? record.rh_g_L, 0.2),
    oeFreshPtGPerL: toNum(record.cc_pt_g_L ?? record.pt_g_L, 0),
    oeFreshTotalPgmGPerL: 0, // calculated below
    oeFreshOscGPerL: toNum(record.cc_osc_g_L ?? record.osc_g_L, 80),
    oeCePercent: toNum(record.ce_pct ?? record.ce_percent, 45),
    oeWashcoatGPerL: toNum(record.cc_wc_total_g_L ?? record.washcoat_g_L, 220),
    substrateVolumeL: toNum(record.cc_volume_L ?? record.volume_L, 1.0),
    substrateDiameterMm: toNum(record.cc_diameter_mm ?? record.diameter_mm, 118.4),
    substrateLengthMm: toNum(record.cc_length_mm ?? record.length_mm, 100),
    substrateGsaM2PerL: toNum(record.cc_gsa_m2_L ?? record.gsa_m2_L, 2.8),
    oeBackpressureKPa: toNumOrUndefined(record.backpressure_kPa),
    exhaustFlowKgPerH: toNum(record.exhaust_flow_kg_h, 120),
    obdSensitivity: inferObdSensitivity(record),
  };
  oeReference.oeFreshTotalPgmGPerL =
    oeReference.oeFreshPdGPerL + oeReference.oeFreshRhGPerL + oeReference.oeFreshPtGPerL;

  // Aging protocol (default: RAT-A)
  const agingProtocol: AgingProtocolInput = {
    agingTempC: body.agingProtocol?.agingTempC ?? 1050,
    agingHours: body.agingProtocol?.agingHours ?? 12,
    protocolName: body.agingProtocol?.protocolName ?? "RAT-A (EU standard)",
    equivalentMileageKm: body.agingProtocol?.equivalentMileageKm ?? 160_000,
    fuelType: body.agingProtocol?.fuelType ?? "gasoline",
    oilConsumptionLPer1000km: body.agingProtocol?.oilConsumptionLPer1000km ?? 0.2,
  };

  // PGM prices (default: current approximate market)
  const prices = body.pgmPrices ?? { pd: 28, rh: 145, pt: 30 };

  const constraints: OptimizationConstraints = {
    pdPriceEurPerG: prices.pd,
    rhPriceEurPerG: prices.rh,
    ptPriceEurPerG: prices.pt,
    ...body.constraints,
  };

  try {
    const result = optimizeComposition(oeReference, agingProtocol, constraints);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Optimization failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function toNum(val: unknown, fallback: number): number {
  if (typeof val === "number" && !isNaN(val)) return val;
  if (typeof val === "string") {
    const n = parseFloat(val);
    if (!isNaN(n)) return n;
  }
  return fallback;
}

function toNumOrUndefined(val: unknown): number | undefined {
  if (typeof val === "number" && !isNaN(val)) return val;
  if (typeof val === "string") {
    const n = parseFloat(val);
    if (!isNaN(n)) return n;
  }
  return undefined;
}

function inferEra(record: Record<string, unknown>): EmissionEra {
  const std = String(record.emission_standard ?? record.standard ?? "").toLowerCase();
  if (std.includes("6e")) return "euro_6e";
  if (std.includes("6d-temp") || std.includes("6d_temp") || std.includes("6d-t")) return "euro_6d_temp";
  if (std.includes("6d")) return "euro_6d";
  return "euro_6b";
}

function inferObdSensitivity(
  record: Record<string, unknown>,
): "tight" | "moderate" | "tolerant" {
  const oem = String(record.manufacturer ?? record.oem_group ?? "").toLowerCase();
  // VAG MQB platforms are notoriously tight
  if (oem.includes("vw") || oem.includes("audi") || oem.includes("seat") || oem.includes("skoda") || oem.includes("volkswagen")) {
    return "tight";
  }
  // Toyota HEV and PSA are more tolerant
  if (oem.includes("toyota") || oem.includes("lexus") || oem.includes("psa") || oem.includes("stellantis") || oem.includes("peugeot") || oem.includes("citroen")) {
    return "tolerant";
  }
  return "moderate";
}
