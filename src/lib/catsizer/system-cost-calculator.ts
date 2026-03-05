/**
 * System Cost Calculator
 *
 * Calculates detailed integrator cost breakdown for a sized aftertreatment system.
 * Uses the cost-database for all material/labor prices.
 *
 * Assumptions reflect a European Tier-1 catalyst integrator (e.g. BOSAL, Eberspächer, Faurecia)
 * quoting for HD on-road / off-road / genset / marine applications.
 */

import type { CatalystSizingResult, CatalystType } from "./types";
import { loadCostDB, type CostDatabase } from "../pricing/cost-database";

export interface BrickCostDetail {
  type: CatalystType;
  position: number;
  substrate_eur: number;
  washcoat_eur: number;
  pgm_eur: number;
  mountingMat_eur: number;
  shell_eur: number;
  cones_eur: number;
  flanges_eur: number;
  welding_eur: number;
  heatshield_eur: number;
  subtotal_eur: number;

  shellWeight_kg: number;
  coneWeight_kg: number;
  matArea_m2: number;
  weldLength_m: number;
  shellMaterial: string;
}

export interface SystemCostBreakdown {
  bricks: BrickCostDetail[];
  ureaSystem_eur: number;
  pipingConnectors_eur: number;
  sensors_eur: number;

  materialTotal_eur: number;
  manufacturing_eur: number;
  qualityInspection_eur: number;
  packaging_eur: number;
  logistics_eur: number;
  overhead_eur: number;
  warrantyReserve_eur: number;

  costPrice_eur: number;
  profitMargin_eur: number;
  quotedPrice_eur: number;

  totalPGM_eur: number;
  totalSubstrate_eur: number;
  totalWashcoat_eur: number;
  totalCanning_eur: number;
  totalWelding_eur: number;
}

const TROY_OZ_G = 31.1035;
const SS_DENSITY_KG_M3 = 7800;

/**
 * Washcoat type determines the raw material cost rate.
 * DOC: γ-Al₂O₃/CeO₂-ZrO₂ mixed oxide → use CeZr pricing
 * DPF: light alumina washcoat for catalysed soot filter
 * SCR: Cu-exchanged chabazite zeolite
 * ASC: Pt/Al₂O₃ slip catalyst
 * TWC: CeO₂-ZrO₂ oxygen storage + alumina
 */
function getWashcoatType(catType: CatalystType): string {
  switch (catType) {
    case "DOC": return "cezr";
    case "DPF": return "alumina";
    case "SCR": return "zeolite_cu";
    case "ASC": return "alumina";
    case "TWC": return "cezr";
    default: return "alumina";
  }
}

/**
 * Shell material selection per OEM standard practice:
 * - SS 409 (1.4512): DOC, ASC — moderate temperature
 * - SS 441 (1.4509): DPF, SCR — higher corrosion / thermal cycling
 */
function getShellMaterial(catType: CatalystType): "ss409" | "ss441" | "ss304" {
  switch (catType) {
    case "DPF": return "ss441";
    case "SCR": return "ss441";
    default: return "ss409";
  }
}

/**
 * Industry-standard PGM ratio splits by catalyst type.
 * DOC: Pt-heavy or Pd-heavy depending on application. HD diesel typically 2:1 Pt:Pd, no Rh.
 * DPF (catalysed): Pt-only or Pt:Pd 4:1 for passive regen.
 * ASC: Pt/Al₂O₃ undercoat, no Pd, no Rh.
 * TWC: Pd-heavy with Rh for NOx. Typical 0:14:1 or 1:8:1 Pt:Pd:Rh.
 * SCR: Zero PGM (zeolite-based).
 */
function getPGMSplit(catType: CatalystType, totalPGM_g_ft3: number): { Pt: number; Pd: number; Rh: number } {
  switch (catType) {
    case "DOC": return {
      Pt: totalPGM_g_ft3 * 0.65,
      Pd: totalPGM_g_ft3 * 0.35,
      Rh: 0,
    };
    case "DPF": return {
      Pt: totalPGM_g_ft3 * 0.80,
      Pd: totalPGM_g_ft3 * 0.20,
      Rh: 0,
    };
    case "ASC": return {
      Pt: totalPGM_g_ft3 * 1.0,
      Pd: 0,
      Rh: 0,
    };
    case "TWC": return {
      Pt: totalPGM_g_ft3 * 0.05,
      Pd: totalPGM_g_ft3 * 0.75,
      Rh: totalPGM_g_ft3 * 0.20,
    };
    case "SCR": return { Pt: 0, Pd: 0, Rh: 0 };
    default: return {
      Pt: totalPGM_g_ft3 * 0.5,
      Pd: totalPGM_g_ft3 * 0.3,
      Rh: totalPGM_g_ft3 * 0.2,
    };
  }
}

/**
 * Frustum (truncated cone) lateral surface area and mass.
 * Transition from inlet pipe to can diameter.
 * Inlet pipe diameter is typically 40-60% of can diameter for HD.
 */
function calcConeWeight(
  canOD_mm: number,
  shellThickness_mm: number,
  coneHeight_mm: number = 80,
): number {
  const pipeRatio = 0.45;
  const R_big = canOD_mm / 2 / 1000; // m
  const R_small = R_big * pipeRatio; // m
  const h = coneHeight_mm / 1000; // m
  const slant = Math.sqrt(h * h + (R_big - R_small) ** 2);
  const lateralArea_m2 = Math.PI * (R_big + R_small) * slant;
  return lateralArea_m2 * (shellThickness_mm / 1000) * SS_DENSITY_KG_M3;
}

export function calculateSystemCost(
  catalysts: CatalystSizingResult[],
  hasSCR: boolean,
  db?: CostDatabase,
): SystemCostBreakdown {
  const costDB = db ?? loadCostDB();

  const bricks: BrickCostDetail[] = catalysts.map((cat, idx) => {
    const shellMat = getShellMaterial(cat.type);
    const wcType = getWashcoatType(cat.type);

    // ── Substrate ──
    const subCostPerL = cat.material === "silicon_carbide"
      ? costDB.substrate.sic_per_liter_eur
      : cat.material === "metallic"
        ? costDB.substrate.metallic_per_liter_eur
        : costDB.substrate.cordierite_per_liter_eur;
    const substrate_eur = cat.selectedVolume_L * subCostPerL;

    // ── Washcoat ──
    const wcMass_kg = (cat.washcoatLoading_g_L * cat.selectedVolume_L) / 1000;
    const wcCostPerKg = wcType.includes("zeolite_cu")
      ? costDB.coating.zeolite_cu_per_kg_eur
      : wcType.includes("zeolite_fe")
        ? costDB.coating.zeolite_fe_per_kg_eur
        : wcType.includes("cezr")
          ? costDB.coating.cezr_per_kg_eur
          : costDB.coating.alumina_per_kg_eur;
    // Coating labor scales with substrate count; HD bricks cost more to coat
    const coatingLabor = costDB.coating.coating_labor_per_brick_eur * cat.numberOfSubstrates;
    // Add binder cost (~10% of washcoat mass)
    const binderCost = (wcMass_kg * 0.10) * costDB.coating.binder_per_kg_eur;
    const washcoat_eur = wcMass_kg * wcCostPerKg + coatingLabor + binderCost;

    // ── PGM ──
    const pgmSplit = getPGMSplit(cat.type, cat.preciousMetalLoading_g_ft3);
    const vol_ft3 = cat.selectedVolume_L / 28.3168;
    const ptMass_g = pgmSplit.Pt * vol_ft3;
    const pdMass_g = pgmSplit.Pd * vol_ft3;
    const rhMass_g = pgmSplit.Rh * vol_ft3;
    const pgm_usd =
      (ptMass_g / TROY_OZ_G) * costDB.pgm.pt_per_troy_oz_usd +
      (pdMass_g / TROY_OZ_G) * costDB.pgm.pd_per_troy_oz_usd +
      (rhMass_g / TROY_OZ_G) * costDB.pgm.rh_per_troy_oz_usd;
    const pgm_eur = pgm_usd / costDB.pgm.eur_usd_rate;

    // ── Mounting mat (Interam or equivalent) ──
    // Mat wraps around each substrate brick individually
    const circumference_m = Math.PI * (cat.diameter_mm / 1000);
    const singleBrickLength_m = cat.length_mm / 1000;
    const matArea_m2 = circumference_m * singleBrickLength_m * cat.numberOfSubstrates;
    const mountingMat_eur = matArea_m2 * costDB.canning.mounting_mat_per_m2_eur;

    // ── Shell (cylindrical can body) ──
    const shellThickness_mm = 1.5;
    const shellOD_m = cat.canDiameter_mm / 1000;
    // Shell length covers all bricks in series + small gaps between bricks
    const shellBodyLength_m = (cat.length_mm * cat.numberOfSubstrates + (cat.numberOfSubstrates - 1) * 5) / 1000;
    const shellWeight_kg = Math.PI * shellOD_m * shellBodyLength_m * (shellThickness_mm / 1000) * SS_DENSITY_KG_M3;
    const shellCostPerKg = shellMat === "ss441"
      ? costDB.canning.shell_ss441_per_kg_eur
      : shellMat === "ss304"
        ? costDB.canning.shell_ss304_per_kg_eur
        : costDB.canning.shell_ss409_per_kg_eur;
    const shell_eur = shellWeight_kg * shellCostPerKg;

    // ── Cones (inlet + outlet frustum) ──
    // Cone height scales with diameter: ~60-100mm for HD
    const coneHeight_mm = Math.max(60, Math.min(120, cat.canDiameter_mm * 0.3));
    const singleConeWeight_kg = calcConeWeight(cat.canDiameter_mm, shellThickness_mm + 0.5, coneHeight_mm);
    const coneWeight_kg = 2 * singleConeWeight_kg; // inlet + outlet
    const cones_eur = coneWeight_kg * costDB.canning.cone_per_kg_eur;

    // ── Flanges ──
    // V-band at inlet and outlet of each canned unit
    const flanges_eur = 2 * costDB.canning.flange_vband_eur;

    // ── Welding ──
    // Circumferential welds: shell-to-cone (2), cone-to-flange (2), plus inter-brick seams
    const nCircumWelds = 4 + Math.max(0, cat.numberOfSubstrates - 1);
    const weldLength_m = circumference_m * nCircumWelds;
    const welding_eur = weldLength_m * costDB.welding.robot_per_meter_eur;

    // ── Heatshield (DOC/DPF run above 500°C during regen) ──
    const needsHeatshield = cat.type === "DOC" || cat.type === "DPF";
    const heatshieldWeight_kg = needsHeatshield
      ? Math.PI * shellOD_m * shellBodyLength_m * 0.0008 * SS_DENSITY_KG_M3 * 0.5 // 0.8mm perforated + air gap
      : 0;
    const heatshield_eur = heatshieldWeight_kg * costDB.canning.heatshield_per_kg_eur;

    const subtotal = substrate_eur + washcoat_eur + pgm_eur + mountingMat_eur
      + shell_eur + cones_eur + flanges_eur + welding_eur + heatshield_eur;

    return {
      type: cat.type,
      position: idx + 1,
      substrate_eur,
      washcoat_eur,
      pgm_eur,
      mountingMat_eur,
      shell_eur,
      cones_eur,
      flanges_eur,
      welding_eur,
      heatshield_eur,
      subtotal_eur: subtotal,
      shellWeight_kg,
      coneWeight_kg,
      matArea_m2,
      weldLength_m,
      shellMaterial: shellMat.toUpperCase().replace("SS", "SS "),
    };
  });

  // ── Urea / DEF dosing system ──
  // Typical HD SCR system: injector + pump + DCU + tank + 1 upstream NOx + 1 downstream NOx + 2 temp sensors + mixer + DEF line
  let ureaSystem_eur = 0;
  if (hasSCR) {
    ureaSystem_eur =
      costDB.urea.injector_eur +
      costDB.urea.pump_module_eur +
      costDB.urea.dcu_eur +
      costDB.urea.tank_20l_eur +
      costDB.urea.nox_sensor_eur * 2 +  // upstream + downstream
      costDB.urea.temp_sensor_eur * 2 +  // pre-SCR + post-SCR
      costDB.urea.def_line_per_meter_eur * 2.5 + // ~2.5m typical run
      costDB.urea.mixer_blade_eur;
  }

  // ── Interconnect piping & clamps ──
  const maxDia_m = Math.max(...catalysts.map((c) => c.canDiameter_mm), 100) / 1000;
  const nConnections = Math.max(0, catalysts.length - 1);
  const pipingLength_m = 0.3 * nConnections; // ~300mm between elements
  const pipingWeight_kg = Math.PI * maxDia_m * pipingLength_m * 0.0015 * SS_DENSITY_KG_M3;
  const clampCost = nConnections * costDB.canning.flange_vband_eur;
  const pipingConnectors_eur = pipingWeight_kg * costDB.canning.shell_ss409_per_kg_eur + clampCost;

  // ── Sensors (system-level, not included in urea system) ──
  // Exhaust temp sensors at system inlet + outlet; backpressure sensor for DPF
  const hasDPF = catalysts.some((c) => c.type === "DPF");
  const sensors_eur =
    costDB.urea.temp_sensor_eur * 2 + // system inlet + outlet
    (hasDPF ? costDB.urea.temp_sensor_eur * 1 + 25 : 0); // DPF differential pressure sensor ~€25

  // ── Totals ──
  const totalPGM_eur = bricks.reduce((s, b) => s + b.pgm_eur, 0);
  const totalSubstrate_eur = bricks.reduce((s, b) => s + b.substrate_eur, 0);
  const totalWashcoat_eur = bricks.reduce((s, b) => s + b.washcoat_eur, 0);
  const totalCanning_eur = bricks.reduce((s, b) => s + b.shell_eur + b.cones_eur + b.flanges_eur + b.mountingMat_eur + b.heatshield_eur, 0);
  const totalWelding_eur = bricks.reduce((s, b) => s + b.welding_eur, 0);

  const materialTotal = bricks.reduce((s, b) => s + b.subtotal_eur, 0)
    + ureaSystem_eur + pipingConnectors_eur + sensors_eur;

  const manufacturing = materialTotal * (costDB.manufacturing.manufacturing_pct / 100);
  const qualityInspection = materialTotal * (costDB.manufacturing.quality_inspection_pct / 100);
  const packaging = costDB.manufacturing.packaging_per_unit_eur;
  const logistics = materialTotal * (costDB.manufacturing.logistics_pct / 100);
  const overhead = materialTotal * (costDB.manufacturing.overhead_pct / 100);
  const warrantyReserve = materialTotal * (costDB.manufacturing.warranty_reserve_pct / 100);

  const costPrice = materialTotal + manufacturing + qualityInspection + packaging + logistics + overhead + warrantyReserve;
  const profitMargin = costPrice * (costDB.manufacturing.profit_margin_pct / 100);
  const quotedPrice = costPrice + profitMargin;

  return {
    bricks,
    ureaSystem_eur,
    pipingConnectors_eur,
    sensors_eur,
    materialTotal_eur: materialTotal,
    manufacturing_eur: manufacturing,
    qualityInspection_eur: qualityInspection,
    packaging_eur: packaging,
    logistics_eur: logistics,
    overhead_eur: overhead,
    warrantyReserve_eur: warrantyReserve,
    costPrice_eur: costPrice,
    profitMargin_eur: profitMargin,
    quotedPrice_eur: quotedPrice,
    totalPGM_eur,
    totalSubstrate_eur,
    totalWashcoat_eur,
    totalCanning_eur,
    totalWelding_eur,
  };
}
