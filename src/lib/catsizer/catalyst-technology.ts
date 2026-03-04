/**
 * CATALYST TECHNOLOGY RECOMMENDATION ENGINE
 *
 * Proposes PGM formulation, washcoat chemistry, and loading based on:
 * - Catalyst type (DOC, DPF, SCR, ASC, TWC)
 * - Application (HD on-road, off-highway, genset, marine, light-duty)
 * - Emission standard stringency
 * - Operating temperature window
 * - Fuel type (diesel, natural gas, biogas)
 * - Contaminant exposure (sulfur, phosphorus)
 *
 * Also provides conversion-vs-temperature sweep using real kinetics.
 */

import type { CatalystType, EmissionStandard, EngineInputs } from "./types";
import { UNITS } from "./units";
import { docReactionRates, scrReactionRates, twcReactionRates, ascReactionRates, plugFlowConversion, type DOCKineticParams, DOC_KINETICS_DEFAULT, type SCRKineticParams, SCR_KINETICS_CU_ZEOLITE } from "./kinetics";

// ============================================================
// PGM FORMULATION DATABASE
// ============================================================

export interface PGMFormulation {
  id: string;
  name: string;
  /** Catalyst types this formulation applies to */
  catalystTypes: CatalystType[];
  /** PGM composition */
  metals: {
    Pt_g_ft3: number;
    Pd_g_ft3: number;
    Rh_g_ft3: number;
  };
  totalPGM_g_ft3: number;
  /** Pt:Pd:Rh ratio string */
  ratio: string;
  /** Washcoat support */
  washcoatType: string;
  washcoatComposition: string;
  washcoatLoading_g_L: number;
  washcoatThickness_um: number;
  /** Performance characteristics */
  lightOff_CO_C: number;
  lightOff_HC_C: number;
  lightOff_NO_C: number;
  maxOperatingTemp_C: number;
  sulfurTolerance: "low" | "moderate" | "high";
  thermalDurability: "standard" | "enhanced" | "extreme";
  /** Application suitability */
  applications: string[];
  costIndex: number;
  description: string;
}

export const PGM_FORMULATIONS: PGMFormulation[] = [
  // ============================================================
  // DOC FORMULATIONS
  // ============================================================
  {
    id: "DOC-STD-PtPd",
    name: "Standard Pt-Pd DOC",
    catalystTypes: ["DOC"],
    metals: { Pt_g_ft3: 30, Pd_g_ft3: 50, Rh_g_ft3: 0 },
    totalPGM_g_ft3: 80,
    ratio: "3:5:0",
    washcoatType: "γ-Al₂O₃",
    washcoatComposition: "γ-Al₂O₃ with CeO₂-ZrO₂ promoter",
    washcoatLoading_g_L: 120,
    washcoatThickness_um: 30,
    lightOff_CO_C: 180,
    lightOff_HC_C: 210,
    lightOff_NO_C: 250,
    maxOperatingTemp_C: 750,
    sulfurTolerance: "moderate",
    thermalDurability: "standard",
    applications: ["heavy_duty_onroad", "heavy_duty_offroad", "genset"],
    costIndex: 1.0,
    description: "Standard Pt-Pd bimetallic on alumina. Good balance of CO/HC oxidation and NO₂ make for downstream SCR.",
  },
  {
    id: "DOC-HP-PtPd",
    name: "High-Performance Pt-Pd DOC",
    catalystTypes: ["DOC"],
    metals: { Pt_g_ft3: 50, Pd_g_ft3: 70, Rh_g_ft3: 0 },
    totalPGM_g_ft3: 120,
    ratio: "5:7:0",
    washcoatType: "γ-Al₂O₃ / CeZrO₂",
    washcoatComposition: "Dual-layer: γ-Al₂O₃ bottom + CeO₂-ZrO₂ top",
    washcoatLoading_g_L: 160,
    washcoatThickness_um: 40,
    lightOff_CO_C: 160,
    lightOff_HC_C: 190,
    lightOff_NO_C: 230,
    maxOperatingTemp_C: 800,
    sulfurTolerance: "moderate",
    thermalDurability: "enhanced",
    applications: ["heavy_duty_onroad"],
    costIndex: 1.5,
    description: "Higher PGM loading for stringent Euro VI-E / CARB Omnibus. Lower light-off, better NO₂/NOₓ ratio.",
  },
  {
    id: "DOC-ECO-Pd",
    name: "Economy Pd-Rich DOC",
    catalystTypes: ["DOC"],
    metals: { Pt_g_ft3: 10, Pd_g_ft3: 50, Rh_g_ft3: 0 },
    totalPGM_g_ft3: 60,
    ratio: "1:5:0",
    washcoatType: "γ-Al₂O₃",
    washcoatComposition: "γ-Al₂O₃ with La₂O₃ stabilizer",
    washcoatLoading_g_L: 100,
    washcoatThickness_um: 25,
    lightOff_CO_C: 200,
    lightOff_HC_C: 240,
    lightOff_NO_C: 280,
    maxOperatingTemp_C: 700,
    sulfurTolerance: "low",
    thermalDurability: "standard",
    applications: ["genset", "heavy_duty_offroad"],
    costIndex: 0.7,
    description: "Cost-optimized Pd-dominant formulation. Suitable for applications with higher exhaust temperatures.",
  },
  {
    id: "DOC-NG-Pd",
    name: "Natural Gas DOC (Methane Oxidation)",
    catalystTypes: ["DOC"],
    metals: { Pt_g_ft3: 5, Pd_g_ft3: 90, Rh_g_ft3: 0 },
    totalPGM_g_ft3: 95,
    ratio: "1:18:0",
    washcoatType: "γ-Al₂O₃ / PdO",
    washcoatComposition: "γ-Al₂O₃ with PdO active phase for CH₄ oxidation",
    washcoatLoading_g_L: 140,
    washcoatThickness_um: 35,
    lightOff_CO_C: 190,
    lightOff_HC_C: 350,
    lightOff_NO_C: 270,
    maxOperatingTemp_C: 700,
    sulfurTolerance: "low",
    thermalDurability: "standard",
    applications: ["genset"],
    costIndex: 1.2,
    description: "Pd-dominant for methane slip oxidation in lean-burn NG engines. High HC light-off due to CH₄ stability.",
  },

  // ============================================================
  // TWC FORMULATIONS
  // ============================================================
  {
    id: "TWC-STD",
    name: "Standard TWC (Stoichiometric)",
    catalystTypes: ["TWC"],
    metals: { Pt_g_ft3: 10, Pd_g_ft3: 80, Rh_g_ft3: 10 },
    totalPGM_g_ft3: 100,
    ratio: "1:8:1",
    washcoatType: "CeO₂-ZrO₂ / Al₂O₃",
    washcoatComposition: "CeO₂-ZrO₂ OSC layer + γ-Al₂O₃ support",
    washcoatLoading_g_L: 150,
    washcoatThickness_um: 35,
    lightOff_CO_C: 270,
    lightOff_HC_C: 290,
    lightOff_NO_C: 280,
    maxOperatingTemp_C: 1000,
    sulfurTolerance: "moderate",
    thermalDurability: "enhanced",
    applications: ["genset", "heavy_duty_onroad"],
    costIndex: 1.3,
    description: "Standard three-way catalyst for stoichiometric NG engines. CeO₂-ZrO₂ provides oxygen storage capacity.",
  },
  {
    id: "TWC-HP",
    name: "High-Performance TWC (Close-Coupled)",
    catalystTypes: ["TWC"],
    metals: { Pt_g_ft3: 15, Pd_g_ft3: 100, Rh_g_ft3: 20 },
    totalPGM_g_ft3: 135,
    ratio: "3:20:4",
    washcoatType: "CeO₂-ZrO₂ / BaO-Al₂O₃",
    washcoatComposition: "Tri-layer: BaO-Al₂O₃ NOₓ trap + CeO₂-ZrO₂ OSC + Rh/Al₂O₃ top",
    washcoatLoading_g_L: 200,
    washcoatThickness_um: 45,
    lightOff_CO_C: 240,
    lightOff_HC_C: 260,
    lightOff_NO_C: 250,
    maxOperatingTemp_C: 1050,
    sulfurTolerance: "moderate",
    thermalDurability: "extreme",
    applications: ["heavy_duty_onroad", "genset"],
    costIndex: 1.8,
    description: "High-loading TWC for close-coupled position. Excellent cold-start performance with NOₓ trap layer.",
  },

  // ============================================================
  // DPF FORMULATIONS
  // ============================================================
  {
    id: "DPF-CAT",
    name: "Catalyzed DPF (cDPF)",
    catalystTypes: ["DPF"],
    metals: { Pt_g_ft3: 8, Pd_g_ft3: 2, Rh_g_ft3: 0 },
    totalPGM_g_ft3: 10,
    ratio: "4:1:0",
    washcoatType: "γ-Al₂O₃ (light coat)",
    washcoatComposition: "Thin γ-Al₂O₃ washcoat on inlet channels for passive regen",
    washcoatLoading_g_L: 30,
    washcoatThickness_um: 10,
    lightOff_CO_C: 250,
    lightOff_HC_C: 280,
    lightOff_NO_C: 300,
    maxOperatingTemp_C: 1000,
    sulfurTolerance: "moderate",
    thermalDurability: "enhanced",
    applications: ["heavy_duty_onroad", "heavy_duty_offroad", "genset"],
    costIndex: 0.5,
    description: "Light Pt coating on DPF inlet channels. Promotes passive soot regeneration via NO₂.",
  },
  {
    id: "DPF-BARE",
    name: "Bare DPF (Active Regen Only)",
    catalystTypes: ["DPF"],
    metals: { Pt_g_ft3: 0, Pd_g_ft3: 0, Rh_g_ft3: 0 },
    totalPGM_g_ft3: 0,
    ratio: "0:0:0",
    washcoatType: "None",
    washcoatComposition: "Uncoated SiC or cordierite wall-flow substrate",
    washcoatLoading_g_L: 0,
    washcoatThickness_um: 0,
    lightOff_CO_C: 0,
    lightOff_HC_C: 0,
    lightOff_NO_C: 0,
    maxOperatingTemp_C: 1200,
    sulfurTolerance: "high",
    thermalDurability: "extreme",
    applications: ["heavy_duty_offroad", "genset", "marine"],
    costIndex: 0.2,
    description: "Uncoated DPF relying on active regeneration only. Lower cost, higher fuel penalty.",
  },

  // ============================================================
  // SCR FORMULATIONS (no PGM)
  // ============================================================
  {
    id: "SCR-CuCHA",
    name: "Cu-SSZ-13 (CHA Zeolite)",
    catalystTypes: ["SCR"],
    metals: { Pt_g_ft3: 0, Pd_g_ft3: 0, Rh_g_ft3: 0 },
    totalPGM_g_ft3: 0,
    ratio: "—",
    washcoatType: "Cu-SSZ-13 zeolite",
    washcoatComposition: "Cu-exchanged SSZ-13 (CHA framework) on cordierite",
    washcoatLoading_g_L: 180,
    washcoatThickness_um: 50,
    lightOff_CO_C: 0,
    lightOff_HC_C: 0,
    lightOff_NO_C: 200,
    maxOperatingTemp_C: 650,
    sulfurTolerance: "moderate",
    thermalDurability: "enhanced",
    applications: ["heavy_duty_onroad", "heavy_duty_offroad"],
    costIndex: 0.8,
    description: "Industry standard for HD diesel SCR. Best hydrothermal stability, wide operating window 200–550°C.",
  },
  {
    id: "SCR-FeBEA",
    name: "Fe-Beta Zeolite",
    catalystTypes: ["SCR"],
    metals: { Pt_g_ft3: 0, Pd_g_ft3: 0, Rh_g_ft3: 0 },
    totalPGM_g_ft3: 0,
    ratio: "—",
    washcoatType: "Fe-Beta zeolite",
    washcoatComposition: "Fe-exchanged Beta (BEA framework) on cordierite",
    washcoatLoading_g_L: 160,
    washcoatThickness_um: 45,
    lightOff_CO_C: 0,
    lightOff_HC_C: 0,
    lightOff_NO_C: 250,
    maxOperatingTemp_C: 700,
    sulfurTolerance: "moderate",
    thermalDurability: "enhanced",
    applications: ["heavy_duty_onroad", "genset"],
    costIndex: 0.7,
    description: "Fe-zeolite for high-temperature SCR. Better NOₓ conversion above 450°C than Cu-zeolite.",
  },
  {
    id: "SCR-VTi",
    name: "V₂O₅-WO₃/TiO₂ (Vanadia)",
    catalystTypes: ["SCR"],
    metals: { Pt_g_ft3: 0, Pd_g_ft3: 0, Rh_g_ft3: 0 },
    totalPGM_g_ft3: 0,
    ratio: "—",
    washcoatType: "V₂O₅-WO₃/TiO₂",
    washcoatComposition: "Vanadia-tungsta on titania extrudate or coated",
    washcoatLoading_g_L: 200,
    washcoatThickness_um: 60,
    lightOff_CO_C: 0,
    lightOff_HC_C: 0,
    lightOff_NO_C: 230,
    maxOperatingTemp_C: 550,
    sulfurTolerance: "high",
    thermalDurability: "standard",
    applications: ["marine", "genset"],
    costIndex: 0.5,
    description: "Low-cost vanadia SCR. Excellent SO₂ tolerance for marine/HFO. Limited to <550°C.",
  },

  // ============================================================
  // ASC FORMULATIONS
  // ============================================================
  {
    id: "ASC-DualLayer",
    name: "Dual-Layer ASC (Pt/SCR)",
    catalystTypes: ["ASC"],
    metals: { Pt_g_ft3: 15, Pd_g_ft3: 0, Rh_g_ft3: 0 },
    totalPGM_g_ft3: 15,
    ratio: "1:0:0",
    washcoatType: "Pt/Al₂O₃ + Cu-zeolite",
    washcoatComposition: "Bottom: Cu-SSZ-13 SCR layer. Top: Pt/Al₂O₃ oxidation layer",
    washcoatLoading_g_L: 100,
    washcoatThickness_um: 30,
    lightOff_CO_C: 200,
    lightOff_HC_C: 220,
    lightOff_NO_C: 200,
    maxOperatingTemp_C: 600,
    sulfurTolerance: "moderate",
    thermalDurability: "standard",
    applications: ["heavy_duty_onroad", "heavy_duty_offroad", "genset"],
    costIndex: 0.6,
    description: "Dual-layer ASC: Pt top oxidizes NH₃ to NO, Cu-zeolite bottom converts NO back to N₂. >90% N₂ selectivity.",
  },
];

// ============================================================
// TECHNOLOGY RECOMMENDATION
// ============================================================

export interface TechnologyRecommendation {
  catalystType: CatalystType;
  recommended: PGMFormulation;
  alternatives: PGMFormulation[];
  reasoning: string[];
}

export function recommendTechnology(
  catalystType: CatalystType,
  inputs: EngineInputs,
  standard: EmissionStandard
): TechnologyRecommendation {
  const candidates = PGM_FORMULATIONS.filter((f) => f.catalystTypes.includes(catalystType));
  const reasoning: string[] = [];

  // Score each candidate
  const scored = candidates.map((f) => {
    let score = 50;

    // Application match
    if (f.applications.includes(inputs.application)) {
      score += 20;
    }

    // Temperature suitability
    if (inputs.exhaustTemp_C <= f.maxOperatingTemp_C) {
      score += 10;
    }
    if (inputs.exhaustTemp_C >= f.lightOff_CO_C + 50 || catalystType === "SCR" || catalystType === "DPF") {
      score += 10;
    }

    // Sulfur tolerance
    if (inputs.SO2_ppm > 10 && f.sulfurTolerance === "high") score += 15;
    if (inputs.SO2_ppm > 5 && f.sulfurTolerance === "low") score -= 10;

    // Standard stringency
    const stringent = ["euro_vi_e", "carb_omnibus", "euro_vii"].includes(standard);
    if (stringent && f.thermalDurability !== "standard") score += 10;
    if (stringent && f.totalPGM_g_ft3 > 80) score += 5;

    // Natural gas specifics
    if (inputs.engineType === "natural_gas" || inputs.engineType === "biogas") {
      if (f.id.includes("NG")) score += 25;
      if (catalystType === "TWC") score += 10;
    }

    // Cost preference for less stringent standards
    if (!stringent) score += (1 - f.costIndex) * 10;

    return { formulation: f, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const recommended = scored[0].formulation;
  const alternatives = scored.slice(1).map((s) => s.formulation);

  // Build reasoning
  reasoning.push(`Selected ${recommended.name} (${recommended.totalPGM_g_ft3} g/ft³ total PGM, ${recommended.ratio} Pt:Pd:Rh)`);
  reasoning.push(`Washcoat: ${recommended.washcoatComposition}`);

  if (recommended.applications.includes(inputs.application)) {
    reasoning.push(`Optimized for ${inputs.application.replace(/_/g, " ")} applications`);
  }

  if (inputs.exhaustTemp_C < recommended.lightOff_CO_C) {
    reasoning.push(`⚠ Exhaust temperature (${inputs.exhaustTemp_C}°C) is below CO light-off (${recommended.lightOff_CO_C}°C) — consider preheating or higher PGM loading`);
  }

  if (inputs.SO2_ppm > 5 && recommended.sulfurTolerance === "low") {
    reasoning.push(`⚠ Fuel sulfur (${inputs.SO2_ppm} ppm SO₂) may deactivate this formulation — consider sulfur-tolerant alternative`);
  }

  return { catalystType, recommended, alternatives, reasoning };
}

// ============================================================
// CONVERSION VS TEMPERATURE SWEEP
// ============================================================

export interface ConversionPoint {
  temperature_C: number;
  CO_conversion: number;
  HC_conversion: number;
  NOx_conversion: number;
  NO2_make: number;
}

/**
 * Generate CO/HC/NOₓ conversion vs temperature curves using real kinetics.
 * Calls plugFlowConversion at each temperature point.
 */
export function conversionTemperatureSweep(
  catalystType: CatalystType,
  volume_L: number,
  gsa_m2_L: number,
  Q_m3_s: number,
  inletComposition: Record<string, number>,
  formulation: PGMFormulation,
  tempRange: [number, number] = [100, 600],
  steps: number = 30
): ConversionPoint[] {
  const points: ConversionPoint[] = [];
  const dt = (tempRange[1] - tempRange[0]) / (steps - 1);
  const length_m = 0.15;

  for (let i = 0; i < steps; i++) {
    const T_C = tempRange[0] + i * dt;
    const T_K = T_C + 273.15;

    if (catalystType === "DOC" || catalystType === "TWC" || catalystType === "SCR" || catalystType === "ASC") {
      const conversions = plugFlowConversion(
        catalystType === "DOC" ? "DOC" : catalystType === "TWC" ? "TWC" : catalystType === "SCR" ? "SCR" : "ASC",
        length_m,
        gsa_m2_L,
        volume_L,
        Q_m3_s,
        T_K,
        inletComposition,
        formulation.washcoatThickness_um,
        undefined
      );

      points.push({
        temperature_C: T_C,
        CO_conversion: (conversions["CO"] ?? 0) * 100,
        HC_conversion: (conversions["HC"] ?? 0) * 100,
        NOx_conversion: (conversions["NOx"] ?? conversions["NO"] ?? 0) * 100,
        NO2_make: (conversions["NO2_make"] ?? 0) * 100,
      });
    } else {
      // DPF — filtration efficiency is not temperature-dependent in same way
      points.push({
        temperature_C: T_C,
        CO_conversion: 0,
        HC_conversion: 0,
        NOx_conversion: 0,
        NO2_make: 0,
      });
    }
  }

  return points;
}

/**
 * Find light-off temperature (T₅₀) from conversion curve data.
 */
export function findLightOff(
  points: ConversionPoint[],
  species: "CO" | "HC" | "NOx",
  threshold: number = 50
): number {
  const key = `${species}_conversion` as keyof ConversionPoint;
  for (let i = 0; i < points.length - 1; i++) {
    const v0 = points[i][key] as number;
    const v1 = points[i + 1][key] as number;
    if (v0 < threshold && v1 >= threshold) {
      const frac = (threshold - v0) / (v1 - v0);
      return points[i].temperature_C + frac * (points[i + 1].temperature_C - points[i].temperature_C);
    }
  }
  return points[points.length - 1].temperature_C;
}
