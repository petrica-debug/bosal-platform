import type {
  CatalystType,
  EmissionLimits,
  EmissionStandard,
  SubstrateMaterial,
} from "./types";

// ============================================================
// GHSV DESIGN RANGES [h⁻¹]
// ============================================================

export interface GHSVRange {
  min: number;
  max: number;
  typical: number;
}

export const GHSV_RANGES: Record<
  CatalystType,
  Record<string, GHSVRange>
> = {
  DOC: {
    heavy_duty: { min: 80000, max: 200000, typical: 120000 },
    genset: { min: 60000, max: 150000, typical: 100000 },
  },
  DPF: {
    heavy_duty: { min: 80000, max: 150000, typical: 100000 },
    genset: { min: 80000, max: 150000, typical: 100000 },
  },
  SCR: {
    heavy_duty: { min: 15000, max: 60000, typical: 30000 },
    genset: { min: 20000, max: 50000, typical: 35000 },
  },
  ASC: {
    heavy_duty: { min: 100000, max: 250000, typical: 150000 },
    genset: { min: 100000, max: 250000, typical: 150000 },
  },
  TWC: {
    heavy_duty: { min: 50000, max: 150000, typical: 80000 },
    genset: { min: 50000, max: 150000, typical: 80000 },
  },
};

export function getDesignGHSV(
  catalystType: CatalystType,
  application: string
): number {
  const appKey =
    application === "genset" || application === "marine"
      ? "genset"
      : "heavy_duty";
  return GHSV_RANGES[catalystType][appKey]?.typical ?? 100000;
}

// ============================================================
// LIGHT-OFF TEMPERATURES [°C] (T₅₀)
// ============================================================

export const LIGHT_OFF_TEMPS: Record<CatalystType, number> = {
  DOC: 200,
  DPF: 250,
  SCR: 200,
  ASC: 200,
  TWC: 300,
};

// ============================================================
// TYPICAL CONVERSION EFFICIENCIES [%]
// ============================================================

export const TYPICAL_CONVERSIONS: Record<
  CatalystType,
  Record<string, number>
> = {
  DOC: { CO: 95, HC: 90, NO_to_NO2: 50 },
  DPF: { PM: 99 },
  SCR: { NOx: 95, NH3_slip: 5 },
  ASC: { NH3: 90 },
  TWC: { CO: 98, HC: 95, NOx: 95 },
};

// ============================================================
// WASHCOAT & PGM LOADING DEFAULTS
// ============================================================

export const WASHCOAT_DEFAULTS: Record<
  CatalystType,
  { washcoatLoading_g_L: number; pgmLoading_g_ft3: number }
> = {
  DOC: { washcoatLoading_g_L: 120, pgmLoading_g_ft3: 80 },
  DPF: { washcoatLoading_g_L: 30, pgmLoading_g_ft3: 10 },
  SCR: { washcoatLoading_g_L: 180, pgmLoading_g_ft3: 0 },
  ASC: { washcoatLoading_g_L: 100, pgmLoading_g_ft3: 15 },
  TWC: { washcoatLoading_g_L: 150, pgmLoading_g_ft3: 120 },
};

// ============================================================
// SUBSTRATE DENSITY [kg/L] (bare substrate)
// ============================================================

export const SUBSTRATE_DENSITY: Record<SubstrateMaterial, number> = {
  cordierite: 0.42,
  silicon_carbide: 0.55,
  metallic: 0.65,
};

// ============================================================
// EMISSION STANDARDS
// ============================================================

export const EMISSION_STANDARDS: Record<EmissionStandard, EmissionLimits> = {
  euro_vi_e: {
    standard: "euro_vi_e",
    NOx_g_kWh: 0.4,
    PM_g_kWh: 0.01,
    CO_g_kWh: 1.5,
    HC_g_kWh: 0.13,
  },
  epa_tier4_final: {
    standard: "epa_tier4_final",
    NOx_g_kWh: 0.27,
    PM_g_kWh: 0.01,
    CO_g_kWh: 3.5,
    HC_g_kWh: 0.14,
  },
  eu_stage_v: {
    standard: "eu_stage_v",
    NOx_g_kWh: 0.4,
    PM_g_kWh: 0.015,
    CO_g_kWh: 3.5,
    HC_g_kWh: 0.19,
  },
  imo_tier_iii: {
    standard: "imo_tier_iii",
    NOx_g_kWh: 2.0,
  },
  ta_luft: {
    standard: "ta_luft",
    NOx_g_Nm3: 0.5,
    PM_g_Nm3: 0.02,
    CO_g_Nm3: 0.3,
    HC_g_Nm3: 0.15,
  },
  custom: {
    standard: "custom",
  },
};

// ============================================================
// AIR-FUEL RATIOS (mass basis)
// ============================================================

export const AFR_STOICHIOMETRIC: Record<string, number> = {
  diesel: 14.6,
  natural_gas: 17.2,
  biogas: 11.5,
  dual_fuel: 15.5,
};

// ============================================================
// REFORMER GHSV RANGES [h⁻¹]
// ============================================================

export const REFORMER_GHSV: Record<string, GHSVRange> = {
  SMR_Ni: { min: 2000, max: 10000, typical: 5000 },
  SMR_PM: { min: 10000, max: 50000, typical: 20000 },
  POX: { min: 20000, max: 100000, typical: 50000 },
  ATR: { min: 10000, max: 60000, typical: 30000 },
  pre_reformer: { min: 2000, max: 5000, typical: 3000 },
  HT_WGS: { min: 1000, max: 5000, typical: 3000 },
  LT_WGS: { min: 2000, max: 8000, typical: 4000 },
};

// ============================================================
// REFORMER CATALYST PROPERTIES
// ============================================================

export const REFORMER_CATALYSTS: Record<
  string,
  {
    name: string;
    bulkDensity_kg_L: number;
    voidFraction: number;
    particleDiameter_mm: number;
  }
> = {
  SMR_Ni: {
    name: "Ni/Al₂O₃",
    bulkDensity_kg_L: 1.1,
    voidFraction: 0.4,
    particleDiameter_mm: 16,
  },
  SMR_PM: {
    name: "Pd-Rh/CeO₂",
    bulkDensity_kg_L: 0.9,
    voidFraction: 0.42,
    particleDiameter_mm: 6,
  },
  POX: {
    name: "Rh/Al₂O₃",
    bulkDensity_kg_L: 0.85,
    voidFraction: 0.42,
    particleDiameter_mm: 10,
  },
  ATR: {
    name: "Ni-Rh/MgAl₂O₄",
    bulkDensity_kg_L: 1.0,
    voidFraction: 0.4,
    particleDiameter_mm: 12,
  },
  pre_reformer: {
    name: "Ni/CaAl₂O₄",
    bulkDensity_kg_L: 1.05,
    voidFraction: 0.38,
    particleDiameter_mm: 5,
  },
  HT_WGS: {
    name: "Fe₂O₃-Cr₂O₃",
    bulkDensity_kg_L: 1.2,
    voidFraction: 0.4,
    particleDiameter_mm: 8,
  },
  LT_WGS: {
    name: "CuO-ZnO/Al₂O₃",
    bulkDensity_kg_L: 1.15,
    voidFraction: 0.4,
    particleDiameter_mm: 5,
  },
  desulfurizer: {
    name: "ZnO",
    bulkDensity_kg_L: 1.1,
    voidFraction: 0.38,
    particleDiameter_mm: 4,
  },
};

// ============================================================
// ENGINE PRESETS
// ============================================================

export interface EnginePreset {
  name: string;
  inputs: Partial<
    import("./types").EngineInputs
  >;
}

export const ENGINE_PRESETS: EnginePreset[] = [
  // ---- Light-Duty ----
  {
    name: "2.0L Light-Duty Diesel (VW EA288 class)",
    inputs: {
      engineType: "diesel", application: "heavy_duty_onroad",
      displacement_L: 2.0, ratedPower_kW: 110, ratedSpeed_rpm: 3500,
      peakTorque_Nm: 340, numberOfCylinders: 4,
      exhaustFlowRate_kg_h: 320, exhaustTemp_C: 280,
      exhaustPressure_kPa: 103, CO_ppm: 300, HC_ppm: 50,
      NOx_ppm: 500, NO2_fraction: 0.08, PM_mg_Nm3: 15,
      SO2_ppm: 3, O2_percent: 10, H2O_percent: 5, CO2_percent: 7,
    },
  },
  {
    name: "3.0L V6 Diesel (BMW N57 class)",
    inputs: {
      engineType: "diesel", application: "heavy_duty_onroad",
      displacement_L: 3.0, ratedPower_kW: 190, ratedSpeed_rpm: 4000,
      peakTorque_Nm: 560, numberOfCylinders: 6,
      exhaustFlowRate_kg_h: 550, exhaustTemp_C: 310,
      exhaustPressure_kPa: 104, CO_ppm: 350, HC_ppm: 60,
      NOx_ppm: 600, NO2_fraction: 0.09, PM_mg_Nm3: 18,
      SO2_ppm: 3, O2_percent: 9, H2O_percent: 5.5, CO2_percent: 7.5,
    },
  },
  // ---- Medium-Duty / Agricultural ----
  {
    name: "4.5L Tractor Diesel (JD 4045 class)",
    inputs: {
      engineType: "diesel", application: "heavy_duty_offroad",
      displacement_L: 4.5, ratedPower_kW: 130, ratedSpeed_rpm: 2200,
      peakTorque_Nm: 680, numberOfCylinders: 4,
      exhaustFlowRate_kg_h: 580, exhaustTemp_C: 320,
      exhaustPressure_kPa: 105, CO_ppm: 450, HC_ppm: 90,
      NOx_ppm: 900, NO2_fraction: 0.08, PM_mg_Nm3: 35,
      SO2_ppm: 8, O2_percent: 9, H2O_percent: 5, CO2_percent: 7,
    },
  },
  {
    name: "6.8L Tractor Diesel (JD 6068 class)",
    inputs: {
      engineType: "diesel", application: "heavy_duty_offroad",
      displacement_L: 6.8, ratedPower_kW: 225, ratedSpeed_rpm: 2100,
      peakTorque_Nm: 1200, numberOfCylinders: 6,
      exhaustFlowRate_kg_h: 850, exhaustTemp_C: 340,
      exhaustPressure_kPa: 106, CO_ppm: 400, HC_ppm: 75,
      NOx_ppm: 850, NO2_fraction: 0.1, PM_mg_Nm3: 28,
      SO2_ppm: 6, O2_percent: 8.5, H2O_percent: 5.5, CO2_percent: 7.5,
    },
  },
  // ---- Heavy-Duty On-Road ----
  {
    name: "6.7L HD Diesel (Cummins ISB class)",
    inputs: {
      engineType: "diesel", application: "heavy_duty_onroad",
      displacement_L: 6.7, ratedPower_kW: 250, ratedSpeed_rpm: 2500,
      peakTorque_Nm: 1100, numberOfCylinders: 6,
      exhaustFlowRate_kg_h: 900, exhaustTemp_C: 350,
      exhaustPressure_kPa: 105, CO_ppm: 400, HC_ppm: 80,
      NOx_ppm: 800, NO2_fraction: 0.1, PM_mg_Nm3: 30,
      SO2_ppm: 5, O2_percent: 8, H2O_percent: 6, CO2_percent: 8,
    },
  },
  {
    name: "13L HD Diesel (MAN D2676 class)",
    inputs: {
      engineType: "diesel", application: "heavy_duty_onroad",
      displacement_L: 12.8, ratedPower_kW: 375, ratedSpeed_rpm: 1800,
      peakTorque_Nm: 2500, numberOfCylinders: 6,
      exhaustFlowRate_kg_h: 1600, exhaustTemp_C: 380,
      exhaustPressure_kPa: 108, CO_ppm: 350, HC_ppm: 60,
      NOx_ppm: 1000, NO2_fraction: 0.1, PM_mg_Nm3: 25,
      SO2_ppm: 5, O2_percent: 9, H2O_percent: 5.5, CO2_percent: 7,
    },
  },
  {
    name: "15L HD Diesel (Cummins X15 class)",
    inputs: {
      engineType: "diesel", application: "heavy_duty_onroad",
      displacement_L: 15.0, ratedPower_kW: 450, ratedSpeed_rpm: 1800,
      peakTorque_Nm: 2780, numberOfCylinders: 6,
      exhaustFlowRate_kg_h: 2000, exhaustTemp_C: 400,
      exhaustPressure_kPa: 110, CO_ppm: 300, HC_ppm: 50,
      NOx_ppm: 1100, NO2_fraction: 0.12, PM_mg_Nm3: 20,
      SO2_ppm: 5, O2_percent: 9, H2O_percent: 5.5, CO2_percent: 7,
    },
  },
  // ---- Gensets ----
  {
    name: "200 kW Diesel Genset (Perkins 1106 class)",
    inputs: {
      engineType: "diesel", application: "genset",
      displacement_L: 6.6, ratedPower_kW: 200, ratedSpeed_rpm: 1500,
      peakTorque_Nm: 1270, numberOfCylinders: 6,
      exhaustFlowRate_kg_h: 750, exhaustTemp_C: 420,
      exhaustPressure_kPa: 103, CO_ppm: 500, HC_ppm: 100,
      NOx_ppm: 700, NO2_fraction: 0.08, PM_mg_Nm3: 25,
      SO2_ppm: 5, O2_percent: 10, H2O_percent: 5, CO2_percent: 6,
      loadProfile: "variable",
    },
  },
  {
    name: "500 kW Natural Gas Genset (Jenbacher class)",
    inputs: {
      engineType: "natural_gas", application: "genset",
      displacement_L: 21, ratedPower_kW: 500, ratedSpeed_rpm: 1500,
      peakTorque_Nm: 3200, numberOfCylinders: 12,
      exhaustFlowRate_kg_h: 2200, exhaustTemp_C: 450,
      exhaustPressure_kPa: 103, CO_ppm: 600, HC_ppm: 1200,
      NOx_ppm: 500, NO2_fraction: 0.05, PM_mg_Nm3: 5,
      SO2_ppm: 1, O2_percent: 7, H2O_percent: 10, CO2_percent: 9,
      loadProfile: "constant",
    },
  },
  {
    name: "1 MW Biogas Genset (MWM class)",
    inputs: {
      engineType: "biogas", application: "genset",
      displacement_L: 35, ratedPower_kW: 1000, ratedSpeed_rpm: 1500,
      peakTorque_Nm: 6400, numberOfCylinders: 16,
      exhaustFlowRate_kg_h: 4500, exhaustTemp_C: 480,
      exhaustPressure_kPa: 104, CO_ppm: 800, HC_ppm: 1500,
      NOx_ppm: 600, NO2_fraction: 0.05, PM_mg_Nm3: 8,
      SO2_ppm: 15, O2_percent: 6, H2O_percent: 12, CO2_percent: 10,
      loadProfile: "constant",
    },
  },
  {
    name: "2 MW Diesel Genset (CAT 3516 class)",
    inputs: {
      engineType: "diesel", application: "genset",
      displacement_L: 69, ratedPower_kW: 2000, ratedSpeed_rpm: 1500,
      peakTorque_Nm: 12700, numberOfCylinders: 16,
      exhaustFlowRate_kg_h: 8500, exhaustTemp_C: 430,
      exhaustPressure_kPa: 105, CO_ppm: 400, HC_ppm: 70,
      NOx_ppm: 900, NO2_fraction: 0.08, PM_mg_Nm3: 20,
      SO2_ppm: 8, O2_percent: 10, H2O_percent: 5, CO2_percent: 6,
      loadProfile: "variable",
    },
  },
  // ---- Marine ----
  {
    name: "Marine Diesel 500 kW (MAN D2862 class)",
    inputs: {
      engineType: "diesel", application: "marine",
      displacement_L: 24.2, ratedPower_kW: 500, ratedSpeed_rpm: 1800,
      peakTorque_Nm: 2650, numberOfCylinders: 12,
      exhaustFlowRate_kg_h: 2400, exhaustTemp_C: 360,
      exhaustPressure_kPa: 105, CO_ppm: 350, HC_ppm: 60,
      NOx_ppm: 1200, NO2_fraction: 0.1, PM_mg_Nm3: 30,
      SO2_ppm: 20, O2_percent: 10, H2O_percent: 5, CO2_percent: 6,
    },
  },
];

// ============================================================
// FUEL PRESETS
// ============================================================

export interface FuelPreset {
  name: string;
  inputs: Partial<import("./types").FuelInputs>;
}

export const FUEL_PRESETS: FuelPreset[] = [
  {
    name: "Pipeline Natural Gas",
    inputs: {
      fuelType: "pipeline_natural_gas",
      CH4_percent: 93,
      C2H6_percent: 3.5,
      C3H8_percent: 0.8,
      CO2_percent: 1.2,
      N2_percent: 1.5,
      H2S_ppm: 4,
    },
  },
  {
    name: "Biogas (Anaerobic Digester)",
    inputs: {
      fuelType: "biogas",
      CH4_percent: 60,
      C2H6_percent: 0,
      C3H8_percent: 0,
      CO2_percent: 38,
      N2_percent: 2,
      H2S_ppm: 500,
      siloxanes_ppm: 10,
    },
  },
  {
    name: "Landfill Gas",
    inputs: {
      fuelType: "landfill_gas",
      CH4_percent: 50,
      C2H6_percent: 0,
      C3H8_percent: 0,
      CO2_percent: 40,
      N2_percent: 10,
      H2S_ppm: 200,
      siloxanes_ppm: 30,
    },
  },
  {
    name: "Pure Methane",
    inputs: {
      fuelType: "pure_methane",
      CH4_percent: 100,
      C2H6_percent: 0,
      C3H8_percent: 0,
      CO2_percent: 0,
      N2_percent: 0,
      H2S_ppm: 0,
    },
  },
];
