/**
 * PRE-DEVELOPMENT PARAMETRIC SWEEP ENGINE
 *
 * Enables parametric catalyst optimization by sweeping across:
 *   - CPSI (cell density): 300, 400, 600, 900
 *   - Washcoat type: oxidation (Pt-Pd/Al₂O₃), ceria (Pd-Rh/CeZrO₂), alumina (Pt/Al₂O₃)
 *   - PGM loading: user-defined range
 *   - Substrate split: single brick vs 2"+gap+2" configurations
 *
 * Uses calibrated TOF data from surface-science.ts and deactivation models
 * to predict fresh and aged conversion, then applies a RAG traffic-light
 * verdict against emission standard limits.
 */

import type { EngineInputs, EmissionStandard, EmissionLimits } from "./types";
import { EMISSION_STANDARDS } from "./constants";
import { substrateGeometry, calculateExhaustFlow } from "./depollution-engine";
import {
  CATALYST_PROFILES_DB,
  type DetailedCatalystProfile,
} from "./catalyst-profiles";
import { assessDeactivation, type DeactivationInputs, type DeactivationResult } from "./deactivation";
import { calculateExhaustMolarFlows } from "./tof-sizing-engine";
import {
  analyzeWashcoat,
  type WashcoatAnalysisResult,
  type WashcoatProperties,
  WASHCOAT_DOC_DEFAULT,
  WASHCOAT_TWC_DEFAULT,
  WASHCOAT_SCR_DEFAULT,
  washcoatThicknessSweep,
} from "./washcoat";
import {
  PGM_FORMULATIONS,
  type PGMFormulation,
} from "./catalyst-technology";
import {
  filterCatalog,
  type SubstrateCatalogEntry,
} from "./substrate-catalog";

// ============================================================
// TYPES
// ============================================================

export type WashcoatType = "oxidation" | "ceria" | "alumina";
export type SplitConfig = "single" | "2in_1in_2in" | "2in_2in_2in";
export type RAGVerdict = "green" | "amber" | "red";

export interface PreDevConfig {
  cpsi: number;
  wallThickness_mil: number;
  washcoatType: WashcoatType;
  pgmLoading_g_ft3: number;
  substrateLength_mm: number;
  splitConfig: SplitConfig;
  catalystType: "DOC" | "TWC" | "SCR";
  diameter_mm: number;
}

export interface PreDevInput {
  rawNOx_ppm: number;
  rawCO_ppm: number;
  rawHC_ppm: number;
  oemNOx_ppm: number;
  exhaustFlow_kg_h: number;
  exhaustTemp_C: number;
  power_kW: number;
  O2_percent: number;
  H2O_percent: number;
  CO2_percent: number;
  SO2_ppm: number;
  emissionStandard: EmissionStandard;
  agingHours: number;
  maxTemp_C: number;
  fuelSulfur_ppm: number;
}

export interface SpeciesResult {
  species: string;
  freshConversion_percent: number;
  agedConversion_percent: number;
  tailpipeFresh_g_kWh: number;
  tailpipeAged_g_kWh: number;
  limit_g_kWh: number;
  margin_percent: number;
  verdict: RAGVerdict;
}

export interface LightOffPoint {
  temperature_C: number;
  CO_conversion_fresh: number;
  HC_conversion_fresh: number;
  NOx_conversion_fresh: number;
  CO_conversion_aged: number;
  HC_conversion_aged: number;
  NOx_conversion_aged: number;
}

export interface WashcoatAnalysisSummary {
  species: string;
  phi: number;
  eta_internal: number;
  eta_overall: number;
  regime: "kinetic" | "transitional" | "diffusion_limited";
  D_eff_m2_s: number;
  washcoatUtilization_percent: number;
}

export interface WashcoatSweepPoint {
  thickness_um: number;
  eta: number;
  phi: number;
  regime: string;
}

export interface DeactivationBreakdown {
  overallActivity: number;
  sulfurActivity: number;
  phosphorusActivity: number;
  thermalActivity: number;
  chemicalActivity: number;
  sulfurLoading_g_L: number;
  phosphorusLoading_g_L: number;
  particleSize_nm: number;
  equivalentAging_h: number;
  endOfLife_hours: number;
  warrantyMargin_percent: number;
  warnings: string[];
}

export interface GHSVAnalysis {
  GHSV_STP: number;
  GHSV_actual: number;
  GHSV_effective: number;
  residenceTime_ms: number;
  gasVelocity_m_s: number;
}

export interface SubstrateAnalysis {
  volume_L: number;
  GSA_m2_L: number;
  totalGSA_m2: number;
  hydraulicDiameter_mm: number;
  OFA: number;
  weight_kg: number;
  pressureDrop_kPa: number;
}

export interface TechnologyMatch {
  formulation: PGMFormulation;
  matchScore: number;
  reasons: string[];
}

export interface PreDevResult {
  config: PreDevConfig;
  configLabel: string;
  species: SpeciesResult[];
  overallVerdict: RAGVerdict;
  lightOffCurve: LightOffPoint[];
  T50_CO_fresh: number;
  T50_CO_aged: number;
  T50_HC_fresh: number;
  T50_HC_aged: number;
  T50_NOx_fresh: number;
  T50_NOx_aged: number;
  agingFactor: number;
  splitBoostFactor: number;
  gsaFactor: number;
  notes: string[];
  washcoatAnalysis: WashcoatAnalysisSummary[];
  washcoatSweep: WashcoatSweepPoint[];
  deactivation: DeactivationBreakdown;
  ghsv: GHSVAnalysis;
  substrate: SubstrateAnalysis;
  technologyMatch: TechnologyMatch | null;
  pgmCost_USD: number;
  profileUsed: { id: string; name: string; catalystType: string };
  matchingCatalogSubstrates: SubstrateCatalogEntry[];
}

// ============================================================
// WASHCOAT → PROFILE MAPPING
// ============================================================

const WASHCOAT_PROFILE_MAP: Record<WashcoatType, string> = {
  oxidation: "DOC-001",
  ceria: "TWC-001",
  alumina: "DOC-002",
};

export function getProfile(washcoatType: WashcoatType): DetailedCatalystProfile {
  const id = WASHCOAT_PROFILE_MAP[washcoatType];
  const profile = CATALYST_PROFILES_DB.find((p) => p.id === id);
  if (!profile) {
    return CATALYST_PROFILES_DB.find((p) => p.catalystType === "DOC")!;
  }
  return profile;
}

// ============================================================
// DEFAULT WALL THICKNESS PER CPSI
// ============================================================

const DEFAULT_WALL_THICKNESS: Record<number, number> = {
  300: 8,
  400: 6.5,
  600: 4,
  900: 2.5,
};

export function getDefaultWallThickness(cpsi: number): number {
  return DEFAULT_WALL_THICKNESS[cpsi] ?? 4;
}

// ============================================================
// CPSI EFFECT ON MASS TRANSFER (GSA-BASED)
// ============================================================

/**
 * Higher cpsi → higher GSA → better external mass transfer.
 * Returns a multiplier relative to 400 cpsi baseline.
 */
export function cpsiMassTransferFactor(cpsi: number, wallThickness_mil: number): number {
  const geo = substrateGeometry(cpsi, wallThickness_mil);
  const geoRef = substrateGeometry(400, 6.5);
  const gsaRatio = geo.geometricSurfaceArea_m2_L / geoRef.geometricSurfaceArea_m2_L;
  const dhRatio = geoRef.hydraulicDiameter_mm / geo.hydraulicDiameter_mm;
  return Math.sqrt(gsaRatio) * Math.pow(dhRatio, 0.33);
}

// ============================================================
// SPLIT SUBSTRATE MODEL
// ============================================================

/**
 * Air gap between bricks breaks the boundary layer, improving mass transfer
 * in the second brick. Zone coating on the front of brick 1 further boosts activity.
 */
export function splitBoost(splitConfig: SplitConfig): {
  factor: number;
  brick1ZoneBoost: number;
  brick2MassTransferBoost: number;
} {
  switch (splitConfig) {
    case "2in_1in_2in":
      return { factor: 1.08, brick1ZoneBoost: 1.12, brick2MassTransferBoost: 1.05 };
    case "2in_2in_2in":
      return { factor: 1.11, brick1ZoneBoost: 1.15, brick2MassTransferBoost: 1.08 };
    default:
      return { factor: 1.0, brick1ZoneBoost: 1.0, brick2MassTransferBoost: 1.0 };
  }
}

// ============================================================
// PGM LOADING SCALING
// ============================================================

/**
 * Active sites scale with PGM loading, but with diminishing returns
 * due to increasing Thiele modulus (diffusion limitation).
 */
export function pgmLoadingFactor(
  actualLoading_g_ft3: number,
  baselineLoading_g_ft3: number
): number {
  const ratio = actualLoading_g_ft3 / baselineLoading_g_ft3;
  return Math.pow(ratio, 0.85);
}

// ============================================================
// CONVERSION PREDICTION (TOF-BASED)
// ============================================================

/**
 * Predict conversion using a GHSV-dependent sigmoidal model calibrated to
 * real-world catalyst performance data.
 *
 * The model computes an effective GHSV from the catalyst volume and exhaust flow,
 * then applies parametric corrections for cpsi, PGM loading, and split configuration.
 *
 * Key relationships:
 * - T50 shifts with PGM loading (-20°C per doubling) and cpsi (-10°C per GSA doubling)
 * - Maximum achievable conversion depends on GHSV: higher GHSV → lower plateau
 * - Split substrate provides a multiplicative boost to effective conversion
 *
 * This creates meaningful differentiation across all parameters at any temperature.
 */
export function predictConversion(
  profile: DetailedCatalystProfile,
  species: string,
  T_C: number,
  catalystVolume_L: number,
  molarFlow_mol_s: number,
  pgmFactor: number,
  gsaFactor: number,
  splitFactor: number,
  isLeanBurn: boolean = true,
  exhaustFlow_kg_h: number = 900
): number {
  const reaction = profile.activity.reactions.find(
    (r) => r.species.toLowerCase() === species.toLowerCase()
  );
  if (!reaction || molarFlow_mol_s <= 0) return 0;

  let maxConv = reaction.maxConversion_percent;
  if (isLeanBurn && species.toLowerCase() === "nox" && reaction.name.toLowerCase().includes("reduction")) {
    maxConv = Math.min(maxConv, 15);
  }

  // ── Effective GHSV ──
  // GHSV at STP (0°C, 1 atm) — industry convention
  const rho_STP = (101325 * 28.8e-3) / (8.314 * 273.15); // kg/m³ at STP
  const Q_Nm3_h = exhaustFlow_kg_h / rho_STP; // Nm³/h
  const GHSV_STP = (Q_Nm3_h * 1000) / (catalystVolume_L + 1e-10); // h⁻¹

  // GHSV correction: higher cpsi/PGM/split → more effective catalyst → lower effective GHSV
  const GHSV_eff = GHSV_STP / (gsaFactor * pgmFactor * splitFactor);

  const T_K = T_C + 273.15;

  // ── T50 shift ──
  const T50_base = reaction.T50_lightOff_C;
  const dT_pgm = -20 * Math.log2(Math.max(0.25, pgmFactor));
  const dT_gsa = -10 * Math.log2(Math.max(0.5, gsaFactor));
  const dT_split = -(splitFactor - 1) * 100;
  const T50_eff = T50_base + dT_pgm + dT_gsa + dT_split;

  // ── Steepness from activation energy ──
  const T50_K = T50_eff + 273.15;
  const steepness = (reaction.Ea_kJ_mol * 1000) / (4 * 8.314 * T50_K);
  const k_sig = Math.max(0.03, Math.min(0.12, steepness));

  // ── GHSV-dependent maximum conversion ──
  // At very high GHSV, even a fully lit-off catalyst can't achieve 100% conversion
  // Empirical: X_max_eff = X_max × (1 - exp(-GHSV_ref / GHSV_eff))
  // where GHSV_ref is the space velocity at which the profile data was measured (~50k h⁻¹)
  const GHSV_ref = 50000; // h⁻¹
  const ghsvPenalty = 1 - Math.exp(-GHSV_ref / (GHSV_eff + 1));
  const maxConv_eff = maxConv * Math.max(0.3, Math.min(1.0, ghsvPenalty));

  // ── Sigmoidal conversion ──
  const X = maxConv_eff / (1 + Math.exp(-k_sig * (T_C - T50_eff)));

  return Math.max(0, Math.min(maxConv, X));
}

// ============================================================
// LIGHT-OFF CURVE GENERATION
// ============================================================

function generateLightOffCurve(
  profile: DetailedCatalystProfile,
  catalystVolume_L: number,
  flows: { CO_mol_s: number; HC_mol_s: number; NOx_mol_s: number },
  pgmFactor: number,
  gsaFactor: number,
  splitFactor: number,
  agingActivity: number,
  isLeanBurn: boolean = true,
  exhaustFlow_kg_h: number = 900
): LightOffPoint[] {
  const points: LightOffPoint[] = [];
  for (let T = 100; T <= 650; T += 10) {
    const co_f = predictConversion(profile, "CO", T, catalystVolume_L, flows.CO_mol_s, pgmFactor, gsaFactor, splitFactor, isLeanBurn, exhaustFlow_kg_h);
    const hc_f = predictConversion(profile, "HC", T, catalystVolume_L, flows.HC_mol_s, pgmFactor, gsaFactor, splitFactor, isLeanBurn, exhaustFlow_kg_h);
    const nox_f = predictConversion(profile, "NOx", T, catalystVolume_L, flows.NOx_mol_s, pgmFactor, gsaFactor, splitFactor, isLeanBurn, exhaustFlow_kg_h);

    points.push({
      temperature_C: T,
      CO_conversion_fresh: co_f,
      HC_conversion_fresh: hc_f,
      NOx_conversion_fresh: nox_f,
      CO_conversion_aged: co_f * agingActivity,
      HC_conversion_aged: hc_f * agingActivity,
      NOx_conversion_aged: nox_f * agingActivity,
    });
  }
  return points;
}

function findT50(curve: LightOffPoint[], key: keyof LightOffPoint): number {
  for (const p of curve) {
    if ((p[key] as number) >= 50) return p.temperature_C;
  }
  return 999;
}

// ============================================================
// PPM → g/kWh CONVERSION
// ============================================================

function ppmToGkWh(
  ppm: number,
  mw: number,
  Q_Nm3_h: number,
  power_kW: number
): number {
  return (ppm * 1e-6 * mw * Q_Nm3_h * 1000) / (22.414 * power_kW);
}

// ============================================================
// MAIN SWEEP FUNCTION
// ============================================================

const WASHCOAT_DEFAULTS: Record<WashcoatType, WashcoatProperties> = {
  oxidation: { ...WASHCOAT_DOC_DEFAULT },
  ceria: { ...WASHCOAT_TWC_DEFAULT },
  alumina: { ...WASHCOAT_DOC_DEFAULT, BET_surfaceArea_m2_g: 180, meanPoreDiameter_nm: 10 },
};

const SPECIES_MW: Record<string, number> = { CO: 28.01, HC: 44.096, NOx: 46.006 };

const PGM_PRICE_USD_G: Record<string, number> = { Pt: 32, Pd: 42, Rh: 145 };

function matchTechnology(config: PreDevConfig, profile: DetailedCatalystProfile): TechnologyMatch | null {
  const candidates = PGM_FORMULATIONS.filter((f) =>
    f.catalystTypes.includes(config.catalystType as "DOC" | "TWC" | "SCR")
  );
  if (candidates.length === 0) return null;

  let bestMatch: PGMFormulation | null = null;
  let bestScore = -1;
  const reasons: string[] = [];

  for (const f of candidates) {
    let score = 0;
    const pgmDiff = Math.abs(f.totalPGM_g_ft3 - config.pgmLoading_g_ft3) / (f.totalPGM_g_ft3 + 1);
    score += Math.max(0, 1 - pgmDiff) * 40;
    if (f.sulfurTolerance === "high") score += 15;
    else if (f.sulfurTolerance === "moderate") score += 8;
    if (f.thermalDurability === "extreme") score += 15;
    else if (f.thermalDurability === "enhanced") score += 10;
    score += (1 - f.costIndex / 2) * 20;
    score += Math.max(0, 10 - Math.abs(f.lightOff_CO_C - 200) / 10);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = f;
    }
  }

  if (!bestMatch) return null;

  reasons.push(`PGM: ${bestMatch.ratio} (${bestMatch.totalPGM_g_ft3} g/ft³)`);
  reasons.push(`Washcoat: ${bestMatch.washcoatType} — ${bestMatch.washcoatComposition}`);
  reasons.push(`Light-off: CO ${bestMatch.lightOff_CO_C}°C, HC ${bestMatch.lightOff_HC_C}°C`);
  reasons.push(`S tolerance: ${bestMatch.sulfurTolerance}, thermal: ${bestMatch.thermalDurability}`);

  return { formulation: bestMatch, matchScore: Math.min(100, bestScore), reasons };
}

function estimatePGMCost(config: PreDevConfig, profile: DetailedCatalystProfile, volume_L: number): number {
  const volume_ft3 = volume_L / 28.3168;
  const totalPGM_g = config.pgmLoading_g_ft3 * volume_ft3;
  const ptFrac = profile.composition.Pt_g_ft3 / (profile.composition.totalPGM_g_ft3 + 1e-10);
  const pdFrac = profile.composition.Pd_g_ft3 / (profile.composition.totalPGM_g_ft3 + 1e-10);
  const rhFrac = profile.composition.Rh_g_ft3 / (profile.composition.totalPGM_g_ft3 + 1e-10);
  return totalPGM_g * (ptFrac * PGM_PRICE_USD_G.Pt + pdFrac * PGM_PRICE_USD_G.Pd + rhFrac * PGM_PRICE_USD_G.Rh);
}

export function runPreDevSweep(
  input: PreDevInput,
  configs: PreDevConfig[]
): PreDevResult[] {
  const limits = EMISSION_STANDARDS[input.emissionStandard];

  const engineInputs: EngineInputs = {
    engineType: "diesel",
    application: "heavy_duty_onroad",
    displacement_L: 0,
    ratedPower_kW: input.power_kW,
    ratedSpeed_rpm: 1800,
    peakTorque_Nm: 0,
    numberOfCylinders: 6,
    exhaustFlowRate_kg_h: input.exhaustFlow_kg_h,
    exhaustTemp_C: input.exhaustTemp_C,
    exhaustPressure_kPa: 101.325,
    ambientTemp_C: 25,
    altitude_m: 0,
    CO_ppm: input.rawCO_ppm,
    HC_ppm: input.rawHC_ppm,
    NOx_ppm: input.rawNOx_ppm,
    NO2_fraction: 0.1,
    PM_mg_Nm3: 50,
    SO2_ppm: input.SO2_ppm,
    O2_percent: input.O2_percent,
    H2O_percent: input.H2O_percent,
    CO2_percent: input.CO2_percent,
  };

  const flow = calculateExhaustFlow(engineInputs);
  const Q = flow.volumeFlow_Nm3_h;
  const molarFlows = calculateExhaustMolarFlows(engineInputs);

  const T_K = input.exhaustTemp_C + 273.15;
  const P_kPa = 101.325;
  const rho_STP = (101325 * 28.8e-3) / (8.314 * 273.15);
  const Q_Nm3_h = input.exhaustFlow_kg_h / rho_STP;
  const nu_gas = 1.5e-5 * Math.pow(T_K / 293, 1.7);

  const results: PreDevResult[] = [];

  for (const config of configs) {
    const notes: string[] = [];
    const profile = getProfile(config.washcoatType);

    const geo = substrateGeometry(config.cpsi, config.wallThickness_mil);
    const gsaFac = cpsiMassTransferFactor(config.cpsi, config.wallThickness_mil);
    const split = splitBoost(config.splitConfig);
    const pgmFac = pgmLoadingFactor(config.pgmLoading_g_ft3, profile.composition.totalPGM_g_ft3);

    const catVolume_L =
      Math.PI *
      Math.pow(config.diameter_mm / 2 / 1000, 2) *
      (config.substrateLength_mm / 1000) *
      1000;

    const effectiveVolume_L = catVolume_L;
    if (config.splitConfig !== "single") {
      const gapInches = config.splitConfig === "2in_1in_2in" ? 1 : 2;
      notes.push(`Split: 2" + ${gapInches}" gap + 2" — BL reset +${Math.round((split.brick2MassTransferBoost - 1) * 100)}% mass transfer`);
    }

    // ── Deactivation ──
    const deactivationInput: DeactivationInputs = {
      catalystType: config.catalystType === "TWC" ? "TWC" : "DOC",
      SO2_ppm: input.SO2_ppm,
      operatingTemp_C: input.exhaustTemp_C,
      maxTemp_C: input.maxTemp_C,
      operatingHours: input.agingHours,
      oilConsumption_g_kWh: 0.3,
      oilPhosphorus_ppm: 800,
      power_kW: input.power_kW,
      catalystVolume_L: effectiveVolume_L,
      fuelSulfur_ppm: input.fuelSulfur_ppm,
    };

    const aging = assessDeactivation(deactivationInput);
    const agingActivity = aging.overallActivity;

    const deactivationBreakdown: DeactivationBreakdown = {
      overallActivity: aging.overallActivity,
      sulfurActivity: aging.sulfurActivity,
      phosphorusActivity: aging.phosphorusActivity,
      thermalActivity: aging.thermalActivity,
      chemicalActivity: aging.chemicalActivity,
      sulfurLoading_g_L: aging.sulfurLoading_g_L,
      phosphorusLoading_g_L: aging.phosphorusLoading_g_L,
      particleSize_nm: aging.particleSize_nm,
      equivalentAging_h: aging.equivalentAging_h,
      endOfLife_hours: aging.endOfLife_hours,
      warrantyMargin_percent: aging.warrantyMargin_percent,
      warnings: aging.warnings,
    };

    // ── GHSV Analysis ──
    const GHSV_STP = (Q_Nm3_h * 1000) / (effectiveVolume_L + 1e-10);
    const Q_actual_m3_s = (input.exhaustFlow_kg_h / 3600) / ((P_kPa * 1000 * 28.8e-3) / (8.314 * T_K));
    const GHSV_actual = (Q_actual_m3_s * 3600 * 1000) / (effectiveVolume_L + 1e-10);
    const GHSV_effective = GHSV_STP / (gsaFac * pgmFac * split.factor);
    const crossSection_m2 = Math.PI * Math.pow(config.diameter_mm / 2000, 2);
    const gasVelocity = Q_actual_m3_s / (crossSection_m2 * geo.openFrontalArea + 1e-10);
    const residenceTime_ms = (effectiveVolume_L * 1e-3) / (Q_actual_m3_s + 1e-10) * 1000;

    const ghsvAnalysis: GHSVAnalysis = {
      GHSV_STP,
      GHSV_actual,
      GHSV_effective,
      residenceTime_ms,
      gasVelocity_m_s: gasVelocity,
    };

    // ── Substrate Analysis ──
    const totalGSA_m2 = geo.geometricSurfaceArea_m2_L * effectiveVolume_L;
    const substrateWeight_kg = effectiveVolume_L * 0.55;
    const dP_kPa = 128 * nu_gas * (config.substrateLength_mm / 1000) * gasVelocity /
      (Math.pow(geo.hydraulicDiameter_mm / 1000, 2) + 1e-10) / 1000;

    const substrateAnalysis: SubstrateAnalysis = {
      volume_L: effectiveVolume_L,
      GSA_m2_L: geo.geometricSurfaceArea_m2_L,
      totalGSA_m2,
      hydraulicDiameter_mm: geo.hydraulicDiameter_mm,
      OFA: geo.openFrontalArea,
      weight_kg: substrateWeight_kg,
      pressureDrop_kPa: Math.abs(dP_kPa),
    };

    // ── Washcoat Analysis ──
    const wcProps = { ...WASHCOAT_DEFAULTS[config.washcoatType], pgmLoading_g_ft3: config.pgmLoading_g_ft3 };
    const k_v_base = 50;
    const k_v = k_v_base * Math.exp(-(profile.activity.reactions[0]?.Ea_kJ_mol ?? 80) * 1000 / 8.314 * (1 / T_K - 1 / 623.15));

    const wcAnalysisList: WashcoatAnalysisSummary[] = [];
    for (const sp of ["CO", "HC", "NOx"]) {
      const mw = SPECIES_MW[sp] ?? 28;
      const wcResult = analyzeWashcoat(
        T_K, P_kPa, mw, Math.abs(k_v),
        wcProps,
        geo.hydraulicDiameter_mm / 1000,
        config.substrateLength_mm / 1000,
        gasVelocity,
        nu_gas
      );
      wcAnalysisList.push({
        species: sp,
        phi: wcResult.phi,
        eta_internal: wcResult.eta_internal,
        eta_overall: wcResult.eta_overall,
        regime: wcResult.regime,
        D_eff_m2_s: wcResult.D_eff_m2_s,
        washcoatUtilization_percent: wcResult.washcoatUtilization_percent,
      });
    }

    // ── Washcoat thickness sweep (for CO) ──
    const wcSweep = washcoatThicknessSweep(T_K, P_kPa, 28.01, Math.abs(k_v), wcProps);

    // ── Technology match ──
    const techMatch = matchTechnology(config, profile);

    // ── PGM Cost ──
    const pgmCost = estimatePGMCost(config, profile, effectiveVolume_L);

    // ── Matching catalog substrates ──
    const catalogMatches = filterCatalog(
      config.catalystType as "DOC" | "TWC" | "SCR",
      undefined,
      undefined,
      effectiveVolume_L * 0.7,
      effectiveVolume_L * 1.3
    ).filter((s) =>
      Math.abs(s.cellDensity_cpsi - config.cpsi) < 50
    ).slice(0, 5);

    // ── Conversion predictions ──
    const isLean = true;

    const lightOff = generateLightOffCurve(
      profile, effectiveVolume_L,
      { CO_mol_s: molarFlows.CO_mol_s, HC_mol_s: molarFlows.HC_mol_s, NOx_mol_s: molarFlows.NOx_mol_s },
      pgmFac, gsaFac, split.factor, agingActivity, isLean, input.exhaustFlow_kg_h
    );

    const T = input.exhaustTemp_C;
    const co_fresh = predictConversion(profile, "CO", T, effectiveVolume_L, molarFlows.CO_mol_s, pgmFac, gsaFac, split.factor, isLean, input.exhaustFlow_kg_h);
    const hc_fresh = predictConversion(profile, "HC", T, effectiveVolume_L, molarFlows.HC_mol_s, pgmFac, gsaFac, split.factor, isLean, input.exhaustFlow_kg_h);
    const nox_fresh = predictConversion(profile, "NOx", T, effectiveVolume_L, molarFlows.NOx_mol_s, pgmFac, gsaFac, split.factor, isLean, input.exhaustFlow_kg_h);

    const co_aged = co_fresh * agingActivity;
    const hc_aged = hc_fresh * agingActivity;
    const nox_aged = nox_fresh * agingActivity;

    const speciesResults: SpeciesResult[] = [];
    const speciesData: Array<{
      name: string; freshConv: number; agedConv: number;
      tailpipeFresh_ppm: number; tailpipeAged_ppm: number;
      mw: number; limitKey: keyof EmissionLimits;
    }> = [
      { name: "CO", freshConv: co_fresh, agedConv: co_aged, tailpipeFresh_ppm: input.rawCO_ppm * (1 - co_fresh / 100), tailpipeAged_ppm: input.rawCO_ppm * (1 - co_aged / 100), mw: 28.01, limitKey: "CO_g_kWh" },
      { name: "HC", freshConv: hc_fresh, agedConv: hc_aged, tailpipeFresh_ppm: input.rawHC_ppm * (1 - hc_fresh / 100), tailpipeAged_ppm: input.rawHC_ppm * (1 - hc_aged / 100), mw: 44.096, limitKey: "HC_g_kWh" },
      { name: "NOx", freshConv: nox_fresh, agedConv: nox_aged, tailpipeFresh_ppm: input.rawNOx_ppm * (1 - nox_fresh / 100), tailpipeAged_ppm: input.rawNOx_ppm * (1 - nox_aged / 100), mw: 46.006, limitKey: "NOx_g_kWh" },
    ];

    for (const sp of speciesData) {
      const tp_fresh = ppmToGkWh(sp.tailpipeFresh_ppm, sp.mw, Q, input.power_kW);
      const tp_aged = ppmToGkWh(sp.tailpipeAged_ppm, sp.mw, Q, input.power_kW);
      const limit = (limits[sp.limitKey] as number) ?? Infinity;
      const margin = limit > 0 ? ((limit - tp_aged) / limit) * 100 : 100;

      let verdict: RAGVerdict = "green";
      if (margin < 0) verdict = "red";
      else if (margin < 15) verdict = "amber";

      speciesResults.push({
        species: sp.name, freshConversion_percent: sp.freshConv, agedConversion_percent: sp.agedConv,
        tailpipeFresh_g_kWh: tp_fresh, tailpipeAged_g_kWh: tp_aged, limit_g_kWh: limit, margin_percent: margin, verdict,
      });
    }

    const worstVerdict = speciesResults.some((s) => s.verdict === "red")
      ? "red" : speciesResults.some((s) => s.verdict === "amber") ? "amber" : "green";

    const washcoatLabels: Record<WashcoatType, string> = {
      oxidation: "Ox (Pt-Pd/Al₂O₃)", ceria: "Ce (Pd-Rh/CeZrO₂)", alumina: "Al (Pt/Al₂O₃)",
    };
    const splitLabels: Record<SplitConfig, string> = {
      single: "Single", "2in_1in_2in": '2"+1"+2"', "2in_2in_2in": '2"+2"+2"',
    };

    if (ghsvAnalysis.GHSV_STP > 150000) notes.push(`⚠ High GHSV (${Math.round(ghsvAnalysis.GHSV_STP)} h⁻¹) — consider larger volume`);
    if (substrateAnalysis.pressureDrop_kPa > 5) notes.push(`⚠ Pressure drop ${substrateAnalysis.pressureDrop_kPa.toFixed(1)} kPa — may impact engine performance`);
    if (wcAnalysisList.some((w) => w.regime === "diffusion_limited")) notes.push("⚠ Diffusion-limited regime — thinner washcoat or higher cpsi recommended");
    if (deactivationBreakdown.sulfurActivity < 0.85) notes.push(`⚠ Significant sulfur poisoning (${(deactivationBreakdown.sulfurActivity * 100).toFixed(0)}% activity)`);
    if (catalogMatches.length > 0) notes.push(`${catalogMatches.length} matching substrate(s) found in catalog`);

    const configLabel = `${config.cpsi} cpsi | ${washcoatLabels[config.washcoatType]} | ${config.pgmLoading_g_ft3} g/ft³ | ${splitLabels[config.splitConfig]}`;

    results.push({
      config, configLabel, species: speciesResults, overallVerdict: worstVerdict,
      lightOffCurve: lightOff,
      T50_CO_fresh: findT50(lightOff, "CO_conversion_fresh"),
      T50_CO_aged: findT50(lightOff, "CO_conversion_aged"),
      T50_HC_fresh: findT50(lightOff, "HC_conversion_fresh"),
      T50_HC_aged: findT50(lightOff, "HC_conversion_aged"),
      T50_NOx_fresh: findT50(lightOff, "NOx_conversion_fresh"),
      T50_NOx_aged: findT50(lightOff, "NOx_conversion_aged"),
      agingFactor: agingActivity, splitBoostFactor: split.factor, gsaFactor: gsaFac, notes,
      washcoatAnalysis: wcAnalysisList,
      washcoatSweep: wcSweep,
      deactivation: deactivationBreakdown,
      ghsv: ghsvAnalysis,
      substrate: substrateAnalysis,
      technologyMatch: techMatch,
      pgmCost_USD: pgmCost,
      profileUsed: { id: profile.id, name: profile.name, catalystType: profile.catalystType },
      matchingCatalogSubstrates: catalogMatches,
    });
  }

  return results.sort((a, b) => {
    const verdictOrder: Record<RAGVerdict, number> = { green: 0, amber: 1, red: 2 };
    if (verdictOrder[a.overallVerdict] !== verdictOrder[b.overallVerdict]) {
      return verdictOrder[a.overallVerdict] - verdictOrder[b.overallVerdict];
    }
    const marginA = Math.min(...a.species.map((s) => s.margin_percent));
    const marginB = Math.min(...b.species.map((s) => s.margin_percent));
    return marginB - marginA;
  });
}

// ============================================================
// HELPER: GENERATE CONFIG MATRIX
// ============================================================

export function generateConfigMatrix(
  cpsiValues: number[],
  washcoatTypes: WashcoatType[],
  pgmMin: number,
  pgmMax: number,
  pgmStep: number,
  splitConfigs: SplitConfig[],
  catalystType: "DOC" | "TWC" | "SCR",
  diameter_mm: number,
  substrateLength_mm: number
): PreDevConfig[] {
  const configs: PreDevConfig[] = [];

  for (const cpsi of cpsiValues) {
    for (const wc of washcoatTypes) {
      for (let pgm = pgmMin; pgm <= pgmMax; pgm += pgmStep) {
        for (const split of splitConfigs) {
          configs.push({
            cpsi,
            wallThickness_mil: getDefaultWallThickness(cpsi),
            washcoatType: wc,
            pgmLoading_g_ft3: pgm,
            substrateLength_mm,
            splitConfig: split,
            catalystType,
            diameter_mm,
          });
        }
      }
    }
  }

  return configs;
}
