/**
 * RFQ (Request for Quotation) GENERATOR
 *
 * Produces OEM-grade aftertreatment system specifications by combining:
 * - Catalyst sizing (volume, geometry, GHSV)
 * - Washcoat analysis (effectiveness factor, diffusion regime)
 * - Reaction kinetics (conversion at operating conditions)
 * - Deactivation modeling (aged performance)
 * - DPF assessment (regen strategy, ash life)
 * - SCR system (DEF consumption, NH₃ slip)
 * - Cost estimation (PGM, substrate, washcoat, canning)
 * - Test cycle compliance projection
 */

import { UNITS } from "./units";
import { exhaustComposition, gasViscosity, gasDensity } from "./gas-properties";
import { getDesignGHSV, LIGHT_OFF_TEMPS, WASHCOAT_DEFAULTS, EMISSION_STANDARDS } from "./constants";
import { plugFlowConversion } from "./kinetics";
import {
  analyzeWashcoat,
  WASHCOAT_DOC_DEFAULT,
  WASHCOAT_SCR_DEFAULT,
  WASHCOAT_TWC_DEFAULT,
  WASHCOAT_ASC_DEFAULT,
  WASHCOAT_DPF_DEFAULT,
  type WashcoatProperties,
} from "./washcoat";
import { assessDeactivation, type DeactivationInputs } from "./deactivation";
import { assessDPF, DPF_SIC_DEFAULT } from "./dpf-model";
import { assessSCRSystem } from "./scr-dosing";
import { calculateExhaustFlow, sizeDepollutionSystem } from "./depollution-engine";
import type {
  EngineInputs,
  CatalystChainElement,
  EmissionStandard,
  CatalystType,
  AgingConfig,
  SCRConfig,
  DPFConfig,
  RFQOutput,
  RFQCatalystItem,
  SubstrateSpec,
  WashcoatSpec,
  PGMSpec,
  AgingSpec,
  AgingResult,
  WarrantySpec,
  TestCycleResult,
  TestCycle,
  WashcoatAnalysis,
  DPFResult,
  SCRResult,
} from "./types";

// ============================================================
// PGM MARKET PRICES (March 2026)
// ============================================================

export const PGM_PRICES_USD_OZ: Record<string, number> = {
  Pt: 2148,
  Pd: 1671,
  Rh: 11350,
  Ir: 4800,
  Ru: 650,
};

export function calculatePGMCost(
  Pt_g: number,
  Pd_g: number,
  Rh_g: number
): { ptCost: number; pdCost: number; rhCost: number; total: number } {
  const OZ = 31.1035; // troy oz to grams
  const ptCost = (Pt_g / OZ) * PGM_PRICES_USD_OZ.Pt;
  const pdCost = (Pd_g / OZ) * PGM_PRICES_USD_OZ.Pd;
  const rhCost = (Rh_g / OZ) * PGM_PRICES_USD_OZ.Rh;
  return { ptCost, pdCost, rhCost, total: ptCost + pdCost + rhCost };
}

// ============================================================
// DEFAULT CONFIGS
// ============================================================

const DEFAULT_AGING: AgingConfig = {
  targetLife_hours: 15000,
  maxOperatingTemp_C: 650,
  fuelSulfur_ppm: 10,
  oilConsumption_g_kWh: 0.3,
  oilPhosphorus_ppm: 800,
  oilAsh_percent: 1.5,
};

const DEFAULT_SCR_CONFIG: SCRConfig = {
  catalystType: "Cu-CHA",
  targetDeNOx: 0.95,
  maxNH3Slip_ppm: 10,
  mixerLength_mm: 400,
  pipeDiameter_mm: 150,
  hasStaticMixer: true,
  hasSwirl: false,
  hasHydrolysisCatalyst: true,
};

const DEFAULT_WARRANTY: WarrantySpec = {
  warrantyPeriod_years: 5,
  warrantyMiles: 350000,
  warrantyHours: 10000,
  fullUsefulLife_years: 10,
  fullUsefulLife_miles: 700000,
  fullUsefulLife_hours: 20000,
  defectWarranty_years: 5,
  performanceWarranty_years: 5,
};

// ============================================================
// WASHCOAT DEFAULTS BY TYPE
// ============================================================

function getWashcoatProps(type: CatalystType): WashcoatProperties {
  switch (type) {
    case "DOC": return WASHCOAT_DOC_DEFAULT;
    case "SCR": return WASHCOAT_SCR_DEFAULT;
    case "TWC": return WASHCOAT_TWC_DEFAULT;
    case "ASC": return WASHCOAT_ASC_DEFAULT;
    case "DPF": return WASHCOAT_DPF_DEFAULT;
  }
}

// ============================================================
// SUBSTRATE SPEC BUILDER
// ============================================================

function buildSubstrateSpec(
  type: CatalystType,
  diameter_mm: number,
  length_mm: number,
  cellDensity: number,
  wallThickness: number,
  material: string
): SubstrateSpec {
  const cellPitch = 25.4 / Math.sqrt(cellDensity);
  const wallMM = wallThickness * UNITS.mil_to_mm;
  const channelWidth = cellPitch - wallMM;
  const ofa = (channelWidth / cellPitch) ** 2;
  const dh = channelWidth;
  const gsa = (4 * ofa) / (dh / 1000) / 1000;
  const vol = Math.PI * (diameter_mm / 2000) ** 2 * (length_mm / 1000) * 1000;

  const matMap: Record<string, string> = {
    cordierite: "Corning",
    silicon_carbide: "NGK",
    metallic: "Continental",
  };

  return {
    supplier: (matMap[material] ?? "Other") as SubstrateSpec["supplier"],
    material: material as SubstrateSpec["material"],
    cellDensity_cpsi: cellDensity,
    wallThickness_mil: wallThickness,
    diameter_mm,
    length_mm,
    volume_L: vol,
    OFA_percent: ofa * 100,
    GSA_m2_L: gsa,
    hydraulicDiameter_mm: dh,
    thermalShockResistance_C: material === "silicon_carbide" ? 600 : material === "cordierite" ? 400 : 800,
    maxOperatingTemp_C: material === "silicon_carbide" ? 1200 : material === "cordierite" ? 1000 : 900,
  };
}

// ============================================================
// WASHCOAT SPEC BUILDER
// ============================================================

function buildWashcoatSpec(type: CatalystType, wc: WashcoatProperties): WashcoatSpec {
  const compositions: Record<CatalystType, string> = {
    DOC: "γ-Al₂O₃ / CeO₂-ZrO₂",
    DPF: "γ-Al₂O₃ (catalytic coating)",
    SCR: "Cu-SSZ-13 (CHA zeolite)",
    ASC: "Pt/Al₂O₃ (top) + Cu-zeolite (bottom)",
    TWC: "CeO₂-ZrO₂ / La-Al₂O₃ / BaO",
  };

  const types: Record<CatalystType, string> = {
    DOC: "Oxidation washcoat",
    DPF: "Catalytic filter coating",
    SCR: "Zeolite-based SCR",
    ASC: "Dual-layer ammonia slip",
    TWC: "Three-way catalyst",
  };

  return {
    type: types[type],
    composition: compositions[type],
    loading_g_L: wc.density_kg_m3 * wc.thickness_um * 1e-3,
    thickness_um: wc.thickness_um,
    BET_m2_g: wc.BET_surfaceArea_m2_g,
    poreDiameter_nm: wc.meanPoreDiameter_nm,
    oxygenStorageCapacity_umol_g: type === "TWC" ? 350 : type === "DOC" ? 150 : undefined,
  };
}

// ============================================================
// PGM SPEC BUILDER
// ============================================================

function buildPGMSpec(type: CatalystType, loading_g_ft3: number, volume_L: number): PGMSpec | undefined {
  if (loading_g_ft3 <= 0) return undefined;

  const loading_g_L = loading_g_ft3 * UNITS.g_ft3_to_g_L;

  const ratios: Record<string, { Pt: number; Pd: number; Rh: number }> = {
    DOC: { Pt: 0.6, Pd: 0.4, Rh: 0 },
    TWC: { Pt: 0.05, Pd: 0.75, Rh: 0.20 },
    ASC: { Pt: 0.9, Pd: 0.1, Rh: 0 },
    DPF: { Pt: 0.7, Pd: 0.3, Rh: 0 },
  };

  const r = ratios[type] ?? { Pt: 0.5, Pd: 0.5, Rh: 0 };

  const totalMass_g = loading_g_L * volume_L;
  const ptCost = totalMass_g * r.Pt / 31.1035 * PGM_PRICES_USD_OZ.Pt;
  const pdCost = totalMass_g * r.Pd / 31.1035 * PGM_PRICES_USD_OZ.Pd;
  const rhCost = totalMass_g * r.Rh / 31.1035 * PGM_PRICES_USD_OZ.Rh;

  return {
    totalLoading_g_ft3: loading_g_ft3,
    totalLoading_g_L: loading_g_L,
    Pt_g_ft3: loading_g_ft3 * r.Pt,
    Pd_g_ft3: loading_g_ft3 * r.Pd,
    Rh_g_ft3: loading_g_ft3 * r.Rh,
    Pt_Pd_ratio: r.Pd > 0 ? `${(r.Pt / r.Pd).toFixed(1)}:1` : "Pt only",
    dispersion_percent: 35,
    estimatedCost_USD_per_unit: ptCost + pdCost + rhCost,
  };
}

// ============================================================
// WASHCOAT ANALYSIS FOR RFQ
// ============================================================

function runWashcoatAnalysis(
  type: CatalystType,
  T_K: number,
  P_kPa: number,
  dh_mm: number,
  length_mm: number,
  Q_actual_m3_s: number,
  nCells: number,
  composition: Record<string, number>
): WashcoatAnalysis {
  const wc = getWashcoatProps(type);
  const speciesMW = type === "SCR" ? 30 : 28; // NO for SCR, CO for DOC/TWC
  const mu = gasViscosity(T_K, composition);
  const rho = gasDensity(T_K, P_kPa, composition);
  const nu = mu / rho;

  const A_cell = (dh_mm / 1000) ** 2;
  const u = Q_actual_m3_s / (nCells * A_cell);

  // Estimate volumetric rate constant from GHSV and typical conversion
  const k_v = 100; // 1/s (order of magnitude for DOC at 350°C)

  const result = analyzeWashcoat(
    T_K, P_kPa, speciesMW, k_v, wc,
    dh_mm / 1000, length_mm / 1000, u, nu
  );

  return {
    effectiveDiffusivity_m2_s: result.D_eff_m2_s,
    thieleModulus: result.phi,
    effectivenessFactor: result.eta_overall,
    regime: result.regime,
    washcoatUtilization_percent: result.washcoatUtilization_percent,
  };
}

// ============================================================
// KINETICS-BASED CONVERSION
// ============================================================

function computeKineticConversion(
  type: CatalystType,
  T_K: number,
  volume_L: number,
  gsa_m2_L: number,
  Q_m3_s: number,
  composition: Record<string, number>,
  eta: number,
  wc: WashcoatProperties
): Record<string, number> {
  // Convert ppm-level concentrations to mol/m³
  const P_Pa = 101325;
  const C_total = P_Pa / (8.314 * T_K); // total molar concentration

  const conc: Record<string, number> = {
    CO: (composition.CO ?? 0) * C_total,
    HC: (composition.HC ?? 0) * C_total,
    NO: (composition.NO ?? 0) * C_total,
    NO2: (composition.NO2 ?? 0) * C_total,
    O2: (composition.O2 ?? 0) * C_total,
    NH3: (composition.NH3 ?? 0) * C_total,
    H2: (composition.H2 ?? 0) * C_total,
    H2O: (composition.H2O ?? 0) * C_total,
  };

  if (type === "DPF") {
    return { PM: 99.5 }; // DPF filtration efficiency is geometric, not kinetic
  }

  const length_m = 0.254; // Approximate
  const outlet = plugFlowConversion(
    type === "TWC" ? "TWC" : type === "SCR" ? "SCR" : type === "ASC" ? "ASC" : "DOC",
    length_m,
    gsa_m2_L,
    volume_L,
    Q_m3_s,
    T_K,
    conc,
    wc.thickness_um,
    eta
  );

  const result: Record<string, number> = {};
  if (conc.CO > 0) result.CO = Math.max(0, (1 - (outlet.CO ?? 0) / conc.CO) * 100);
  if (conc.HC > 0) result.HC = Math.max(0, (1 - (outlet.HC ?? 0) / conc.HC) * 100);
  if (conc.NO + conc.NO2 > 0) {
    const inNOx = conc.NO + conc.NO2;
    const outNOx = (outlet.NO ?? 0) + (outlet.NO2 ?? 0);
    result.NOx = Math.max(0, (1 - outNOx / inNOx) * 100);
  }
  if (conc.NH3 > 0) result.NH3 = Math.max(0, (1 - (outlet.NH3 ?? 0) / conc.NH3) * 100);

  return result;
}

// ============================================================
// TEST CYCLE COMPLIANCE
// ============================================================

function projectTestCycleCompliance(
  inputs: EngineInputs,
  standard: EmissionStandard,
  freshConversions: Record<string, number>,
  agedConversions: Record<string, number>,
  flow_Nm3_h: number
): TestCycleResult[] {
  const limits = EMISSION_STANDARDS[standard];
  const cycles: TestCycle[] = getApplicableCycles(inputs.application, standard);

  return cycles.map((cycle) => {
    // Weighting factors for different operating points
    const weightingFactor = cycle === "WHTC" || cycle === "ETC" || cycle === "FTP" ? 0.85 : 1.0;

    const ppmToGkWh = (ppm: number, mw: number) =>
      (ppm * 1e-6 * mw * flow_Nm3_h * 1000) / (22.4 * inputs.ratedPower_kW);

    const agedCO = inputs.CO_ppm * (1 - (agedConversions.CO ?? 90) / 100);
    const agedHC = inputs.HC_ppm * (1 - (agedConversions.HC ?? 85) / 100);
    const agedNOx = inputs.NOx_ppm * (1 - (agedConversions.NOx ?? 90) / 100);
    const agedPM = inputs.PM_mg_Nm3 * (1 - (agedConversions.PM ?? 99) / 100);

    const NOx = ppmToGkWh(agedNOx, 46) * weightingFactor;
    const CO = ppmToGkWh(agedCO, 28) * weightingFactor;
    const HC = ppmToGkWh(agedHC, 16) * weightingFactor;
    const PM = (agedPM * flow_Nm3_h) / (inputs.ratedPower_kW * 1000) * weightingFactor;

    const compliant =
      (limits.NOx_g_kWh ? NOx <= limits.NOx_g_kWh : true) &&
      (limits.PM_g_kWh ? PM <= limits.PM_g_kWh : true) &&
      (limits.CO_g_kWh ? CO <= limits.CO_g_kWh : true) &&
      (limits.HC_g_kWh ? HC <= limits.HC_g_kWh : true);

    return {
      cycle,
      NOx_g_kWh: NOx,
      PM_g_kWh: PM,
      CO_g_kWh: CO,
      HC_g_kWh: HC,
      NH3_ppm: 5,
      N2O_g_kWh: 0.02,
      compliant,
    };
  });
}

function getApplicableCycles(application: string, standard: EmissionStandard): TestCycle[] {
  if (application === "genset") return ["ISO_8178"];
  if (standard === "epa_tier4_final") return ["FTP", "SET"];
  if (standard === "eu_stage_v") return ["NRTC"];
  if (standard === "imo_tier_iii") return ["ISO_8178"];
  return ["WHTC", "WHSC"];
}

// ============================================================
// COST ESTIMATION
// ============================================================

function estimateCosts(
  catalysts: RFQCatalystItem[]
): RFQOutput["costEstimate"] {
  let substrateCost = 0;
  let washcoatCost = 0;
  let pgmCost = 0;
  let canningCost = 0;

  for (const cat of catalysts) {
    const vol = cat.substrate.volume_L;

    // Substrate: $15–40/L depending on material
    const subPricePerL =
      cat.substrate.material === "silicon_carbide" ? 35 :
      cat.substrate.material === "metallic" ? 40 : 18;
    substrateCost += vol * subPricePerL;

    // Washcoat: $5–15/L
    washcoatCost += vol * 10;

    // PGM
    if (cat.pgm) pgmCost += cat.pgm.estimatedCost_USD_per_unit;

    // Canning: $50–200 per unit
    canningCost += 80 + vol * 5;
  }

  const assemblyCost = catalysts.length * 30;
  const total = substrateCost + washcoatCost + pgmCost + canningCost + assemblyCost;

  // PGM sensitivity analysis
  const pgmSensitivity = [800, 1000, 1200, 1500, 2000].map((price) => ({
    pgmPrice_USD_oz: price,
    unitCost_USD: total + (pgmCost * (price / 1000) - pgmCost),
  }));

  return {
    substrateCost_USD: substrateCost,
    washcoatCost_USD: washcoatCost,
    pgmCost_USD: pgmCost,
    canningCost_USD: canningCost,
    assemblyCost_USD: assemblyCost,
    totalPerUnit_USD: total,
    pgmSensitivity,
  };
}

// ============================================================
// MAIN RFQ GENERATOR
// ============================================================

export function generateRFQ(
  inputs: EngineInputs,
  chain: CatalystChainElement[],
  standard: EmissionStandard,
  aging: AgingConfig = DEFAULT_AGING,
  scrConfig: SCRConfig = DEFAULT_SCR_CONFIG,
  warranty: WarrantySpec = DEFAULT_WARRANTY,
  customerName: string = "OEM Customer"
): RFQOutput {
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // 1. Base sizing
  const baseResult = sizeDepollutionSystem(inputs, chain, standard);
  warnings.push(...baseResult.warnings);

  // 2. Flow calculations
  const flow = calculateExhaustFlow(inputs);
  const T_K = UNITS.C_to_K(inputs.exhaustTemp_C);
  const composition = exhaustComposition(inputs);

  // 3. Build RFQ catalyst items with full analysis
  const rfqCatalysts: RFQCatalystItem[] = baseResult.catalysts.map((cat, idx) => {
    const wc = getWashcoatProps(cat.type);

    // Substrate spec
    const substrate = buildSubstrateSpec(
      cat.type, cat.diameter_mm, cat.length_mm,
      cat.cellDensity_cpsi, cat.wallThickness_mil, cat.material
    );

    // Washcoat spec
    const washcoatSpec = buildWashcoatSpec(cat.type, wc);

    // PGM spec
    const pgm = buildPGMSpec(cat.type, cat.preciousMetalLoading_g_ft3, cat.selectedVolume_L);

    // Washcoat analysis
    const cellsPerM2 = cat.cellDensity_cpsi * UNITS.cpsi_to_cells_cm2 * 1e4;
    const A_frontal = Math.PI * (cat.diameter_mm / 2000) ** 2;
    const nCells = cellsPerM2 * A_frontal;

    const washcoatAnalysis = runWashcoatAnalysis(
      cat.type, T_K, inputs.exhaustPressure_kPa,
      substrate.hydraulicDiameter_mm, cat.length_mm,
      flow.volumeFlow_actual_m3_h / 3600, nCells, composition
    );

    // Kinetics-based fresh conversion
    const freshConv = computeKineticConversion(
      cat.type, T_K, cat.selectedVolume_L, substrate.GSA_m2_L,
      flow.volumeFlow_actual_m3_h / 3600, composition,
      washcoatAnalysis.effectivenessFactor, wc
    );

    // Aged conversion (apply deactivation factor)
    const deactInputs: DeactivationInputs = {
      catalystType: cat.type,
      scrCatalystType: cat.type === "SCR" ? scrConfig.catalystType : undefined,
      SO2_ppm: inputs.SO2_ppm,
      operatingTemp_C: inputs.exhaustTemp_C,
      maxTemp_C: aging.maxOperatingTemp_C,
      operatingHours: aging.targetLife_hours,
      oilConsumption_g_kWh: aging.oilConsumption_g_kWh,
      oilPhosphorus_ppm: aging.oilPhosphorus_ppm,
      power_kW: inputs.ratedPower_kW,
      catalystVolume_L: cat.selectedVolume_L,
      fuelSulfur_ppm: aging.fuelSulfur_ppm,
    };

    const deact = assessDeactivation(deactInputs);
    const agedConv: Record<string, number> = {};
    for (const [key, val] of Object.entries(freshConv)) {
      agedConv[key] = val * deact.overallActivity;
    }

    // Aged pressure drop (10–20% increase due to washcoat sintering)
    const agedPressureDrop = cat.pressureDrop_kPa * (1 + (1 - deact.thermalActivity) * 0.3);

    // Aged light-off temperature (increases with sintering)
    const agedLightOff = cat.lightOffTemp_C + (1 - deact.thermalActivity) * 50;

    return {
      position: idx + 1,
      type: cat.type,
      substrate,
      washcoat: washcoatSpec,
      pgm,
      canningDiameter_mm: cat.canDiameter_mm,
      canningLength_mm: cat.canLength_mm,
      canningMaterial: "SS409",
      matMaterial: "Interam™ 100HT",
      totalWeight_kg: cat.weight_kg,
      GHSV_design_h: cat.GHSV_design,
      pressureDrop_kPa_clean: cat.pressureDrop_kPa,
      pressureDrop_kPa_aged: agedPressureDrop,
      lightOffTemp_C_fresh: cat.lightOffTemp_C,
      lightOffTemp_C_aged: agedLightOff,
      freshConversion_percent: freshConv,
      agedConversion_percent: agedConv,
      washcoatAnalysis,
    };
  });

  // 4. DPF assessment
  let dpfResult: DPFResult | undefined;
  const hasDPF = chain.some((c) => c.enabled && c.type === "DPF");
  if (hasDPF) {
    const dpfAssessment = assessDPF(
      DPF_SIC_DEFAULT,
      inputs.PM_mg_Nm3,
      flow.volumeFlow_Nm3_h,
      aging.targetLife_hours,
      inputs.exhaustTemp_C,
      inputs.NOx_ppm * inputs.NO2_fraction,
      inputs.O2_percent,
      aging.oilConsumption_g_kWh,
      aging.oilAsh_percent,
      inputs.ratedPower_kW
    );
    dpfResult = {
      sootLoading_g_L: dpfAssessment.soot.sootLoading_g_L,
      filtrationEfficiency_percent: dpfAssessment.soot.filtrationEfficiency_percent,
      backpressure_kPa: dpfAssessment.soot.backpressure_kPa,
      passiveRegenRate_g_h: dpfAssessment.passiveRegen.regenRate_g_h,
      passiveRegenBalancePoint_C: dpfAssessment.passiveRegen.balancePoint_C,
      activeRegenPeakTemp_C: dpfAssessment.activeRegen.peakTemp_C,
      activeRegenDuration_min: dpfAssessment.activeRegen.regenDuration_min,
      fuelPenalty_percent: dpfAssessment.activeRegen.fuelPenalty_percent,
      thermalRunawayRisk: dpfAssessment.activeRegen.thermalRunawayRisk,
      ashLoading_g_L: dpfAssessment.ash.ashLoading_g_L,
      ashCapacityRemaining_percent: 100 - dpfAssessment.ash.capacityLoss_percent,
      overallStatus: dpfAssessment.overallStatus,
      warnings: dpfAssessment.warnings,
    };
    warnings.push(...dpfAssessment.warnings);
  }

  // 5. SCR system assessment
  let scrResult: SCRResult | undefined;
  const hasSCR = chain.some((c) => c.enabled && c.type === "SCR");
  if (hasSCR) {
    const scrCat = rfqCatalysts.find((c) => c.type === "SCR");
    const scrAssessment = assessSCRSystem(
      inputs.exhaustTemp_C,
      inputs.NOx_ppm,
      inputs.NO2_fraction,
      flow.volumeFlow_Nm3_h,
      flow.massFlow_kg_h,
      scrCat?.substrate.volume_L ?? 10,
      scrConfig.pipeDiameter_mm,
      scrConfig.mixerLength_mm,
      scrConfig.catalystType,
      scrConfig.targetDeNOx,
      inputs.fuelConsumption_kg_h ?? 0,
      0
    );
    scrResult = {
      optimalANR: scrAssessment.anr.optimalANR,
      systemDeNOx_percent: scrAssessment.systemDeNOx_percent,
      NH3_slip_ppm: scrAssessment.tailpipeNH3_ppm,
      DEF_consumption_L_h: scrAssessment.anr.DEF_consumption_L_h,
      DEF_consumption_L_100km: scrAssessment.anr.DEF_consumption_L_100km,
      specificDEF_percent_fuel: scrAssessment.anr.specificDEF_percent_fuel,
      ureaDecomposition_percent: scrAssessment.decomposition.overallConversion * 100,
      depositRisk: scrAssessment.decomposition.depositRisk,
      nh3Storage_g_L: scrAssessment.nh3Storage.storedNH3_g_L,
      mixerUniformity: scrAssessment.mixer.uniformityIndex,
      warnings: scrAssessment.warnings,
    };
    warnings.push(...scrAssessment.warnings);
  }

  // 6. Aging assessment
  const overallDeact = assessDeactivation({
    catalystType: "DOC",
    SO2_ppm: inputs.SO2_ppm,
    operatingTemp_C: inputs.exhaustTemp_C,
    maxTemp_C: aging.maxOperatingTemp_C,
    operatingHours: aging.targetLife_hours,
    oilConsumption_g_kWh: aging.oilConsumption_g_kWh,
    oilPhosphorus_ppm: aging.oilPhosphorus_ppm,
    power_kW: inputs.ratedPower_kW,
    catalystVolume_L: rfqCatalysts.reduce((s, c) => s + c.substrate.volume_L, 0),
    fuelSulfur_ppm: aging.fuelSulfur_ppm,
  });

  const agingSpec: AgingSpec = {
    protocol: "Accelerated bench aging per EPA MECA protocol",
    temperature_C: aging.maxOperatingTemp_C,
    duration_hours: Math.min(aging.targetLife_hours, 2000),
    equivalentMiles: warranty.fullUsefulLife_miles,
    equivalentHours: aging.targetLife_hours,
    fuelSulfur_ppm: aging.fuelSulfur_ppm,
    oilAsh_percent: aging.oilAsh_percent,
    agedConversionTarget_percent: 80,
  };

  const agingResult: AgingResult = {
    overallActivity: overallDeact.overallActivity,
    sulfurActivity: overallDeact.sulfurActivity,
    phosphorusActivity: overallDeact.phosphorusActivity,
    thermalActivity: overallDeact.thermalActivity,
    chemicalActivity: overallDeact.chemicalActivity,
    endOfLife_hours: overallDeact.endOfLife_hours,
    warrantyMargin_percent: overallDeact.warrantyMargin_percent,
    agedConversion_percent: overallDeact.overallActivity * 90,
    warnings: overallDeact.warnings,
  };
  warnings.push(...overallDeact.warnings);

  // 7. Test cycle compliance
  const combinedFreshConv: Record<string, number> = {};
  const combinedAgedConv: Record<string, number> = {};
  for (const cat of rfqCatalysts) {
    for (const [k, v] of Object.entries(cat.freshConversion_percent)) {
      combinedFreshConv[k] = Math.max(combinedFreshConv[k] ?? 0, v);
    }
    for (const [k, v] of Object.entries(cat.agedConversion_percent)) {
      combinedAgedConv[k] = Math.max(combinedAgedConv[k] ?? 0, v);
    }
  }

  const testCycles = projectTestCycleCompliance(
    inputs, standard, combinedFreshConv, combinedAgedConv, flow.volumeFlow_Nm3_h
  );

  // 8. Cost estimation
  const costEstimate = estimateCosts(rfqCatalysts);

  // 9. Recommendations
  if (costEstimate.pgmCost_USD > costEstimate.totalPerUnit_USD * 0.6) {
    recommendations.push("PGM cost exceeds 60% of total — consider Pd-rich formulation to reduce cost.");
  }
  for (const cat of rfqCatalysts) {
    if (cat.washcoatAnalysis.regime === "diffusion_limited") {
      recommendations.push(
        `${cat.type}: Operating in diffusion-limited regime (η=${cat.washcoatAnalysis.effectivenessFactor.toFixed(2)}). ` +
        `Consider thinner washcoat or higher cell density for better utilization.`
      );
    }
  }
  if (agingResult.warrantyMargin_percent < 20) {
    recommendations.push("Warranty margin below 20% — consider oversizing catalysts or higher PGM loading for durability.");
  }

  return {
    projectInfo: {
      rfqNumber: `RFQ-${Date.now().toString(36).toUpperCase()}`,
      date: new Date().toISOString().split("T")[0],
      customer: customerName,
      engineModel: `${inputs.displacement_L}L ${inputs.engineType} ${inputs.numberOfCylinders}-cyl`,
      application: inputs.application,
      emissionStandard: standard,
    },
    engineData: inputs,
    aftertreatmentSystem: {
      architecture: chain.filter((c) => c.enabled).map((c) => c.type).join(" → "),
      catalysts: rfqCatalysts,
      totalSystemLength_mm: baseResult.totalLength_mm,
      totalSystemWeight_kg: baseResult.totalWeight_kg,
      totalPressureDrop_kPa: baseResult.totalPressureDrop_kPa,
      maxBackpressure_kPa: inputs.application === "genset" ? 10 : 20,
    },
    dpfAssessment: dpfResult,
    scrSystem: scrResult,
    aging: {
      protocol: agingSpec,
      results: agingResult,
    },
    compliance: {
      standard,
      testCycles,
      overallCompliant: testCycles.every((tc) => tc.compliant),
    },
    warranty,
    costEstimate,
    recommendations,
    warnings,
  };
}
