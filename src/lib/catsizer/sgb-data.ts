/**
 * SYNTHETIC GAS BENCH (SGB) DATA MODULE
 *
 * Accepts measured catalyst characterization data from a synthetic gas bench
 * (activation energy, TOF/TON, light-off temperatures, chemisorption) and
 * converts it into a DetailedCatalystProfile compatible with the simulation
 * engine (predictConversion, WLTP transient sim).
 *
 * This enables BOSAL engineers to evaluate supplier catalyst cores against
 * WLTP homologation targets without expensive vehicle testing.
 */

import {
  type DetailedCatalystProfile,
} from "./catalyst-profiles";

// ============================================================
// SGB DATA INTERFACE
// ============================================================

export interface SGBSpeciesData {
  name: "CO" | "HC" | "NOx";
  Ea_kJ_mol: number;
  TOF_s1: number;
  T_ref_C: number;
  T50_C: number;
  T90_C: number;
  maxConversion_pct: number;
  conditions?: string;
}

export interface SGBenchData {
  supplierName: string;
  sampleId: string;
  catalystType: "DOC" | "TWC" | "SCR" | "ASC";

  species: SGBSpeciesData[];

  dispersion_pct: number;
  metallicSA_m2_gPGM: number;
  avgParticleSize_nm: number;
  BET_m2_g: number;
  washcoatLoading_g_L: number;
  washcoatThickness_um: number;
  pgmLoading_g_ft3: number;
  pgm_ratio: { Pt: number; Pd: number; Rh: number };

  GHSV_bench: number;
  gasComposition: { O2_pct: number; H2O_pct: number; CO2_pct: number };

  notes?: string;
}

// ============================================================
// VALIDATION
// ============================================================

export interface SGBValidationError {
  field: string;
  message: string;
}

export function validateSGBData(data: Partial<SGBenchData>): SGBValidationError[] {
  const errors: SGBValidationError[] = [];

  if (!data.supplierName?.trim()) {
    errors.push({ field: "supplierName", message: "Supplier name is required" });
  }
  if (!data.sampleId?.trim()) {
    errors.push({ field: "sampleId", message: "Sample ID is required" });
  }
  if (!data.catalystType) {
    errors.push({ field: "catalystType", message: "Catalyst type is required" });
  }

  if (!data.species || data.species.length === 0) {
    errors.push({ field: "species", message: "At least one species measurement is required" });
  } else {
    for (const sp of data.species) {
      if (sp.Ea_kJ_mol <= 0 || sp.Ea_kJ_mol > 500) {
        errors.push({ field: `species.${sp.name}.Ea`, message: `${sp.name}: Ea must be 0-500 kJ/mol` });
      }
      if (sp.TOF_s1 < 0) {
        errors.push({ field: `species.${sp.name}.TOF`, message: `${sp.name}: TOF must be non-negative` });
      }
      if (sp.T50_C < 50 || sp.T50_C > 800) {
        errors.push({ field: `species.${sp.name}.T50`, message: `${sp.name}: T50 must be 50-800°C` });
      }
      if (sp.maxConversion_pct <= 0 || sp.maxConversion_pct > 100) {
        errors.push({ field: `species.${sp.name}.maxConv`, message: `${sp.name}: Max conversion must be 0-100%` });
      }
    }
  }

  if ((data.dispersion_pct ?? 0) <= 0 || (data.dispersion_pct ?? 0) > 100) {
    errors.push({ field: "dispersion_pct", message: "Dispersion must be 0-100%" });
  }
  if ((data.BET_m2_g ?? 0) <= 0) {
    errors.push({ field: "BET_m2_g", message: "BET surface area must be positive" });
  }
  if ((data.pgmLoading_g_ft3 ?? 0) < 0) {
    errors.push({ field: "pgmLoading_g_ft3", message: "PGM loading must be non-negative" });
  }
  if ((data.GHSV_bench ?? 0) <= 0) {
    errors.push({ field: "GHSV_bench", message: "Bench GHSV must be positive" });
  }
  if ((data.washcoatLoading_g_L ?? 0) <= 0) {
    errors.push({ field: "washcoatLoading_g_L", message: "Washcoat loading must be positive" });
  }
  if ((data.washcoatThickness_um ?? 0) <= 0) {
    errors.push({ field: "washcoatThickness_um", message: "Washcoat thickness must be positive" });
  }

  const ratio = data.pgm_ratio;
  if (ratio) {
    const sum = ratio.Pt + ratio.Pd + ratio.Rh;
    if (sum > 0 && Math.abs(sum - 100) > 1) {
      errors.push({ field: "pgm_ratio", message: `PGM ratio sums to ${sum}%, expected ~100%` });
    }
  }

  return errors;
}

// ============================================================
// PROFILE BUILDER
// ============================================================

/**
 * Convert SGB bench measurement data into a DetailedCatalystProfile
 * that can be used directly by predictConversion() and the WLTP
 * transient simulation engine.
 */
export function buildProfileFromSGB(sgb: SGBenchData): DetailedCatalystProfile {
  const totalPGM = sgb.pgmLoading_g_ft3;
  const Pt = totalPGM * (sgb.pgm_ratio.Pt / 100);
  const Pd = totalPGM * (sgb.pgm_ratio.Pd / 100);
  const Rh = totalPGM * (sgb.pgm_ratio.Rh / 100);

  const pgm_wt_pct = totalPGM > 0
    ? (totalPGM * 28.3168 / 1000) / (sgb.washcoatLoading_g_L / 1000) * 100
    : 0;

  const poreVolume = 0.45;
  const avgPoreSize = sgb.BET_m2_g > 100 ? 12 : sgb.BET_m2_g > 50 ? 20 : 40;

  const support = inferSupport(sgb);
  const activePhase = inferActivePhase(sgb);
  const promoters = inferPromoters(sgb);

  const probeGas: "CO" | "H2" = sgb.catalystType === "SCR" ? "H2" : "CO";
  const uptake_umol_gCat = sgb.dispersion_pct > 0 && totalPGM > 0
    ? (sgb.dispersion_pct / 100) * (totalPGM * 28.3168 / 1000) * 1e6 / (metalMW(sgb) * 1000)
    : 0;
  const uptake_umol_gPGM = sgb.dispersion_pct > 0
    ? (sgb.dispersion_pct / 100) * 1e6 / metalMW(sgb)
    : 0;

  const reactions = sgb.species.map((sp) => ({
    name: speciesReactionName(sp.name, sgb.catalystType),
    species: sp.name,
    TOF_ref: sp.TOF_s1,
    T_ref_C: sp.T_ref_C || sp.T50_C + 50,
    Ea_kJ_mol: sp.Ea_kJ_mol,
    T50_lightOff_C: sp.T50_C,
    T90_C: sp.T90_C,
    maxConversion_percent: sp.maxConversion_pct,
    conditions: sp.conditions || `SGB: GHSV=${sgb.GHSV_bench}, ${sgb.gasComposition.O2_pct}% O₂, ${sgb.gasComposition.H2O_pct}% H₂O`,
  }));

  const maxOpTemp = sgb.catalystType === "TWC" ? 1050
    : sgb.catalystType === "SCR" ? 650
    : 700;

  return {
    id: `SGB-${sgb.sampleId}`,
    name: `${sgb.supplierName} ${sgb.sampleId} (SGB)`,
    catalystType: sgb.catalystType,
    supplier: sgb.supplierName,

    physical: {
      BET_m2_g: sgb.BET_m2_g,
      poreVolume_cm3_g: poreVolume,
      avgPoreSize_nm: avgPoreSize,
      bulkDensity_kg_L: 1.2,
    },

    composition: {
      support,
      activePhase,
      promoters,
      Pt_g_ft3: Pt,
      Pd_g_ft3: Pd,
      Rh_g_ft3: Rh,
      totalPGM_g_ft3: totalPGM,
      pgm_wt_percent: pgm_wt_pct,
      washcoatLoading_g_L: sgb.washcoatLoading_g_L,
      washcoatThickness_um: sgb.washcoatThickness_um,
      OSC_umol_g: sgb.catalystType === "TWC" ? 400 : undefined,
    },

    chemisorption: {
      probeGas,
      uptake_umol_gCat,
      uptake_umol_gPGM,
      dispersion_percent: sgb.dispersion_pct,
      metallicSA_m2_gPGM: sgb.metallicSA_m2_gPGM,
      avgParticleSize_nm: sgb.avgParticleSize_nm,
      measurementTemp_C: 35,
    },

    activity: { reactions },

    thermalStability: {
      maxOperatingTemp_C: maxOpTemp,
      sinteringOnsetTemp_C: maxOpTemp - 100,
      dispersionAfterAging_percent: sgb.dispersion_pct * 0.5,
      activityRetention_percent: 70,
      agingProtocol: "Estimated from SGB data",
    },

    poisonTolerance: {
      sulfurTolerance: sgb.catalystType === "SCR" ? "high" : "moderate",
      sulfurRegenTemp_C: 650,
      phosphorusTolerance: "moderate",
      maxSulfur_ppm: sgb.catalystType === "SCR" ? 50 : 10,
    },

    operatingWindow: {
      minTemp_C: Math.min(...sgb.species.map((s) => s.T50_C)) - 50,
      maxTemp_C: maxOpTemp,
      optimalTemp_C: [
        Math.min(...sgb.species.map((s) => s.T50_C)),
        maxOpTemp - 200,
      ],
    },

    costIndex: 1.0,
    notes: sgb.notes || `Built from SGB bench data. Supplier: ${sgb.supplierName}, Sample: ${sgb.sampleId}. Bench GHSV: ${sgb.GHSV_bench} h⁻¹.`,
  };
}

// ============================================================
// DEFAULT / EXAMPLE SGB DATA
// ============================================================

export const EXAMPLE_SGB_DOC: SGBenchData = {
  supplierName: "Supplier A",
  sampleId: "DOC-2025-001",
  catalystType: "DOC",
  species: [
    { name: "CO", Ea_kJ_mol: 72, TOF_s1: 7.5, T_ref_C: 200, T50_C: 180, T90_C: 215, maxConversion_pct: 99, conditions: "0.1% CO, 10% O₂, 5% H₂O" },
    { name: "HC", Ea_kJ_mol: 92, TOF_s1: 2.2, T_ref_C: 250, T50_C: 225, T90_C: 270, maxConversion_pct: 97, conditions: "500 ppm C₃H₆, 10% O₂, 5% H₂O" },
    { name: "NOx", Ea_kJ_mol: 45, TOF_s1: 0.7, T_ref_C: 300, T50_C: 255, T90_C: 325, maxConversion_pct: 50, conditions: "200 ppm NO, 10% O₂" },
  ],
  dispersion_pct: 33,
  metallicSA_m2_gPGM: 80,
  avgParticleSize_nm: 3.5,
  BET_m2_g: 145,
  washcoatLoading_g_L: 125,
  washcoatThickness_um: 32,
  pgmLoading_g_ft3: 80,
  pgm_ratio: { Pt: 38, Pd: 62, Rh: 0 },
  GHSV_bench: 50000,
  gasComposition: { O2_pct: 10, H2O_pct: 5, CO2_pct: 12 },
  notes: "Standard Pt-Pd/Al₂O₃ DOC sample from Supplier A, tested on SGB at 50,000 h⁻¹",
};

export const EXAMPLE_SGB_TWC: SGBenchData = {
  supplierName: "Supplier B",
  sampleId: "TWC-2025-001",
  catalystType: "TWC",
  species: [
    { name: "CO", Ea_kJ_mol: 70, TOF_s1: 5.8, T_ref_C: 200, T50_C: 200, T90_C: 245, maxConversion_pct: 99.5, conditions: "1% CO, λ=1.0" },
    { name: "HC", Ea_kJ_mol: 88, TOF_s1: 2.8, T_ref_C: 250, T50_C: 235, T90_C: 285, maxConversion_pct: 98, conditions: "500 ppm C₃H₆, λ=1.0" },
    { name: "NOx", Ea_kJ_mol: 82, TOF_s1: 4.0, T_ref_C: 300, T50_C: 265, T90_C: 315, maxConversion_pct: 98, conditions: "1000 ppm NO, 1% CO, λ=1.0" },
  ],
  dispersion_pct: 30,
  metallicSA_m2_gPGM: 75,
  avgParticleSize_nm: 3.8,
  BET_m2_g: 115,
  washcoatLoading_g_L: 145,
  washcoatThickness_um: 35,
  pgmLoading_g_ft3: 90,
  pgm_ratio: { Pt: 0, Pd: 84, Rh: 16 },
  GHSV_bench: 60000,
  gasComposition: { O2_pct: 0.5, H2O_pct: 10, CO2_pct: 14 },
  notes: "Pd-Rh/CeZrO₂ TWC from Supplier B, tested at λ=1.0, GHSV 60,000 h⁻¹",
};

// ============================================================
// INTERNAL HELPERS
// ============================================================

function inferSupport(sgb: SGBenchData): string {
  if (sgb.catalystType === "TWC") return "CeO₂-ZrO₂ + γ-Al₂O₃";
  if (sgb.catalystType === "SCR") return "SSZ-13 (CHA zeolite)";
  return "γ-Al₂O₃";
}

function inferActivePhase(sgb: SGBenchData): string {
  const r = sgb.pgm_ratio;
  if (sgb.catalystType === "SCR") return "Cu²⁺ ion-exchanged";
  const parts: string[] = [];
  if (r.Pt > 10) parts.push("Pt");
  if (r.Pd > 10) parts.push("Pd");
  if (r.Rh > 10) parts.push("Rh");
  return parts.length > 0 ? parts.join("-") : "PGM";
}

function inferPromoters(sgb: SGBenchData): string[] {
  if (sgb.catalystType === "TWC") return ["BaO (trap)", "La₂O₃ (stabilizer)"];
  if (sgb.catalystType === "SCR") return [];
  return [];
}

function metalMW(sgb: SGBenchData): number {
  const r = sgb.pgm_ratio;
  const ptFrac = r.Pt / 100, pdFrac = r.Pd / 100, rhFrac = r.Rh / 100;
  return ptFrac * 195.08 + pdFrac * 106.42 + rhFrac * 102.91 || 106.42;
}

function speciesReactionName(species: string, catType: string): string {
  switch (species) {
    case "CO":
      return catType === "TWC" ? "CO oxidation (TWC)" : "CO oxidation";
    case "HC":
      return catType === "TWC" ? "HC oxidation (TWC)" : "HC oxidation (C₃H₆)";
    case "NOx":
      return catType === "TWC" ? "NOₓ reduction (Rh)"
        : catType === "SCR" ? "Standard SCR"
        : "NO → NO₂";
    default:
      return species;
  }
}
