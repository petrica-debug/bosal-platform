/**
 * Pure deterministic calculations for AM variant generation.
 * PGM/OSC derating, substrate sizing, washcoat spec, cost, and market sizing.
 */

import type { EcsComponentRecord } from "@/lib/catsizer/oem-database/types";
import {
  CANNING_COST_EUR,
  DEFAULT_AM_PENETRATION_PCT,
  DEFAULT_DERATING,
  DEFAULT_PGM_PRICES,
  DERATING_BY_STANDARD,
  SUBSTRATE_COST_EUR_PER_L,
  VARIANT_TIER_OFFSETS,
  WASHCOAT_COST_EUR_PER_GPL,
} from "@/lib/catsizer/oem-database/homologation-workflow";
import type {
  AmVariant,
  CostBreakdown,
  MarketEstimate,
  OBDRisk,
  PgmPrices,
  PgmSplit,
  SubstrateSpec,
  VariantTier,
  WashcoatLayerSpec,
} from "./wizard-types";

const G_PER_FT3_TO_G_PER_L = 0.0353147;

function num(v: string | number | null | undefined, fallback = 0): number {
  if (v === null || v === undefined) return fallback;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/* ------------------------------------------------------------------ */
/*  OEM baseline averaging                                            */
/* ------------------------------------------------------------------ */

export interface OemBaseline {
  ptGPerL: number;
  pdGPerL: number;
  rhGPerL: number;
  totalPgmGPerL: number;
  totalOscGPerL: number;
  diameterMm: number;
  lengthMm: number;
  volumeL: number;
  cpsi: number;
  wallMil: number;
  material: "ceramic" | "metallic";
  wcTotalGPerL: number;
  l1OscGPerL: number;
  l2OscGPerL: number;
  l1WcGPerL: number;
  l2WcGPerL: number;
  productionVolumeEu: number;
}

export function computeOemBaseline(rows: EcsComponentRecord[]): OemBaseline {
  if (rows.length === 0) {
    return {
      ptGPerL: 0, pdGPerL: 0, rhGPerL: 0, totalPgmGPerL: 0, totalOscGPerL: 0,
      diameterMm: 105.7, lengthMm: 127, volumeL: 1.11, cpsi: 600, wallMil: 3.5,
      material: "ceramic", wcTotalGPerL: 220, l1OscGPerL: 80, l2OscGPerL: 45,
      l1WcGPerL: 140, l2WcGPerL: 80, productionVolumeEu: 0,
    };
  }
  const avg = (fn: (r: EcsComponentRecord) => number) =>
    rows.reduce((s, r) => s + fn(r), 0) / rows.length;

  const material = rows.some((r) => String(r.substrate ?? "").toLowerCase().includes("metal"))
    ? "metallic" as const
    : "ceramic" as const;

  let vol = 0;
  for (const r of rows) {
    const raw = String(r.productionVolumeEu ?? "0").replace(/[^\d.]/g, "");
    vol += parseFloat(raw) || 0;
  }

  return {
    ptGPerL: avg((r) => num(r.ptGPerL)),
    pdGPerL: avg((r) => num(r.pdGPerL)),
    rhGPerL: avg((r) => num(r.rhGPerL)),
    totalPgmGPerL: avg((r) => num(r.totalPgmGPerL)),
    totalOscGPerL: avg((r) => num(r.totalOscGPerL)),
    diameterMm: avg((r) => num(r.diameterMm, 105.7)),
    lengthMm: avg((r) => num(r.lengthMm, 127)),
    volumeL: avg((r) => num(r.volumeL, 1.11)),
    cpsi: avg((r) => num(r.cpsi, 600)),
    wallMil: avg((r) => num(r.wallMil, 3.5)),
    material,
    wcTotalGPerL: avg((r) => num(r.wcTotalGPerL, 220)),
    l1OscGPerL: avg((r) => num(r.l1OscGPerL, 80)),
    l2OscGPerL: avg((r) => num(r.l2OscGPerL, 45)),
    l1WcGPerL: avg((r) => num(r.l1WcGPerL, 140)),
    l2WcGPerL: avg((r) => num(r.l2WcGPerL, 80)),
    productionVolumeEu: vol,
  };
}

/* ------------------------------------------------------------------ */
/*  PGM derating                                                      */
/* ------------------------------------------------------------------ */

function deratingRange(emStd: string) {
  for (const [key, val] of Object.entries(DERATING_BY_STANDARD)) {
    if (emStd.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return DEFAULT_DERATING;
}

function computePgm(
  baseline: OemBaseline,
  factor: number,
): PgmSplit {
  const pdGPerL = +(baseline.pdGPerL * factor).toFixed(3);
  const rhGPerL = +(baseline.rhGPerL * factor).toFixed(3);
  const ptGPerL = +(baseline.ptGPerL * factor).toFixed(3);
  const totalGPerL = +(pdGPerL + rhGPerL + ptGPerL).toFixed(3);
  const totalGPerFt3 = +(totalGPerL / G_PER_FT3_TO_G_PER_L).toFixed(1);
  const vol = baseline.volumeL || 1;
  return {
    pdGPerL, rhGPerL, ptGPerL, totalGPerL, totalGPerFt3,
    pdGPerBrick: +(pdGPerL * vol).toFixed(3),
    rhGPerBrick: +(rhGPerL * vol).toFixed(3),
    ptGPerBrick: +(ptGPerL * vol).toFixed(3),
    pdRhRatio: rhGPerL > 0 ? +((pdGPerL / rhGPerL).toFixed(1)) : 0,
  };
}

/* ------------------------------------------------------------------ */
/*  OBD risk                                                          */
/* ------------------------------------------------------------------ */

function assessObdRisk(oscRatio: number): { risk: OBDRisk; note: string } {
  if (oscRatio < 0.55) {
    return { risk: "HIGH", note: "OSC too low — risk of P0420 from excessive rear-O₂ oscillation amplitude." };
  }
  if (oscRatio > 0.80) {
    return { risk: "HIGH", note: "OSC too high — AM looks 'too new', OBD may flag abnormal storage." };
  }
  if (oscRatio < 0.62 || oscRatio > 0.75) {
    return { risk: "MEDIUM", note: "Near edge of safe window — bench OBD simulation recommended before vehicle test." };
  }
  return { risk: "LOW", note: "Within 0.62–0.75 sweet spot. Standard validation sufficient." };
}

/* ------------------------------------------------------------------ */
/*  Substrate sizing                                                  */
/* ------------------------------------------------------------------ */

function computeSubstrate(baseline: OemBaseline): SubstrateSpec {
  const standardDiameters = [93, 101.6, 105.7, 118.4, 127, 132, 143, 152.4, 170];
  const d = standardDiameters.reduce((best, sd) =>
    Math.abs(sd - baseline.diameterMm) < Math.abs(best - baseline.diameterMm) ? sd : best,
  );
  const targetVol = baseline.volumeL;
  const l = +((targetVol * 1e6) / (Math.PI * (d / 2) ** 2)).toFixed(0);
  const actualVol = +((Math.PI * (d / 2) ** 2 * l) / 1e6).toFixed(3);
  return {
    diameterMm: d,
    lengthMm: clamp(l, 50, 305),
    volumeL: actualVol,
    cpsi: baseline.cpsi,
    wallMil: baseline.wallMil,
    material: baseline.material,
  };
}

/* ------------------------------------------------------------------ */
/*  Generate 3 variants                                               */
/* ------------------------------------------------------------------ */

export function generateVariants(
  baseline: OemBaseline,
  emissionStandard: string,
): AmVariant[] {
  const range = deratingRange(emissionStandard);
  const tiers: VariantTier[] = ["performance", "balanced", "value"];
  const labels: Record<VariantTier, string> = {
    performance: "A — Performance",
    balanced: "B — Balanced",
    value: "C — Value",
  };

  const substrate = computeSubstrate(baseline);

  return tiers.map((tier) => {
    const offset = VARIANT_TIER_OFFSETS[tier];
    const pgmMid = (range.pgm[0] + range.pgm[1]) / 2 + offset;
    const oscMid = (range.osc[0] + range.osc[1]) / 2 + offset;
    const pgmFactor = clamp(pgmMid, 0.45, 0.85);
    const oscFactor = clamp(oscMid, 0.50, 0.85);

    const pgm = computePgm(baseline, pgmFactor);
    const oscTargetGPerL = +(baseline.totalOscGPerL * oscFactor).toFixed(1);
    const oscRatio = baseline.totalOscGPerL > 0
      ? +(oscTargetGPerL / baseline.totalOscGPerL).toFixed(3)
      : oscFactor;
    const { risk, note } = assessObdRisk(oscRatio);

    const pgmDeratingFactor: [number, number] = [
      +(pgmFactor - 0.05).toFixed(2),
      +(pgmFactor + 0.05).toFixed(2),
    ];
    const oscDeratingFactor: [number, number] = [
      +(oscFactor - 0.04).toFixed(2),
      +(oscFactor + 0.04).toFixed(2),
    ];

    return {
      tier,
      label: labels[tier],
      pgmDeratingFactor,
      oscDeratingFactor,
      pgm,
      oscTargetGPerL,
      oscRatio,
      substrate,
      obdRisk: risk,
      obdNote: note,
      aiCommentary: null,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Washcoat spec from variant                                        */
/* ------------------------------------------------------------------ */

export function computeWashcoatSpec(
  baseline: OemBaseline,
  oscFactor: number,
): { layer1: WashcoatLayerSpec; layer2: WashcoatLayerSpec; totalWashcoatGPerL: number } {
  const l1Osc = +(baseline.l1OscGPerL * oscFactor).toFixed(1);
  const l2Osc = +(baseline.l2OscGPerL * oscFactor).toFixed(1);
  const l1Total = baseline.l1WcGPerL > 0 ? baseline.l1WcGPerL : 140;
  const l2Total = baseline.l2WcGPerL > 0 ? baseline.l2WcGPerL : 80;
  const l1Alumina = +(l1Total * 0.45).toFixed(1);
  const l2Alumina = +(l2Total * 0.50).toFixed(1);

  const layer1: WashcoatLayerSpec = {
    aluminaGPerL: l1Alumina,
    oscGPerL: l1Osc,
    oscCePercent: 45,
    baoGPerL: 5,
    la2o3GPerL: 3,
    nd2o3GPerL: 2,
    totalGPerL: +(l1Alumina + l1Osc + 5 + 3 + 2).toFixed(1),
  };
  const layer2: WashcoatLayerSpec = {
    aluminaGPerL: l2Alumina,
    oscGPerL: l2Osc,
    oscCePercent: 40,
    baoGPerL: 0,
    la2o3GPerL: 2,
    nd2o3GPerL: 0,
    totalGPerL: +(l2Alumina + l2Osc + 2).toFixed(1),
  };

  return {
    layer1,
    layer2,
    totalWashcoatGPerL: +(layer1.totalGPerL + layer2.totalGPerL).toFixed(1),
  };
}

/* ------------------------------------------------------------------ */
/*  Cost calculation                                                  */
/* ------------------------------------------------------------------ */

export function computeCost(
  pgm: PgmSplit,
  substrate: SubstrateSpec,
  washcoatTotalGPerL: number,
  prices: PgmPrices = DEFAULT_PGM_PRICES,
): CostBreakdown {
  const pgmCostPerBrick = +(
    pgm.pdGPerBrick * prices.pdEurPerG +
    pgm.rhGPerBrick * prices.rhEurPerG +
    pgm.ptGPerBrick * prices.ptEurPerG
  ).toFixed(2);

  const substrateCost = +(
    substrate.volumeL * SUBSTRATE_COST_EUR_PER_L[substrate.material]
  ).toFixed(2);

  const washcoatCost = +(washcoatTotalGPerL * WASHCOAT_COST_EUR_PER_GPL * substrate.volumeL).toFixed(2);

  const totalBom = +(pgmCostPerBrick + substrateCost + washcoatCost + CANNING_COST_EUR).toFixed(2);

  const targetRetail = +(totalBom * 2.2).toFixed(2);

  return { pgmCostPerBrick, substrateCost, washcoatCost, canningCost: CANNING_COST_EUR, totalBom, targetRetail };
}

/* ------------------------------------------------------------------ */
/*  Market sizing                                                     */
/* ------------------------------------------------------------------ */

export function computeMarket(
  euAnnualVolume: number,
  targetRetail: number,
  penetrationPct: number = DEFAULT_AM_PENETRATION_PCT,
): MarketEstimate {
  const amAnnualUnits = Math.round(euAnnualVolume * (penetrationPct / 100));
  return {
    euAnnualVolume,
    amPenetrationPct: penetrationPct,
    amAnnualUnits,
    revenueEur: +(amAnnualUnits * targetRetail).toFixed(0),
  };
}
