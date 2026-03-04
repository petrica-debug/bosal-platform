/**
 * DPF (Diesel Particulate Filter) MODEL
 *
 * Comprehensive model covering:
 * 1. Soot accumulation and filtration efficiency
 * 2. Passive regeneration (NO₂-assisted, continuous)
 * 3. Active regeneration (O₂-based, periodic)
 * 4. Pressure drop vs. soot loading
 * 5. Ash accumulation (non-combustible residue)
 * 6. Thermal runaway risk assessment
 *
 * References:
 * - Konstandopoulos & Johnson (1989) — wall-flow filter model
 * - Bissett & Shadman (1985) — regeneration kinetics
 * - Kandylas & Koltsakis (2002) — 1D DPF model
 */

import { arrhenius } from "./kinetics";

// ============================================================
// DPF PHYSICAL PROPERTIES
// ============================================================

export interface DPFProperties {
  material: "cordierite" | "silicon_carbide" | "aluminum_titanate";
  cellDensity_cpsi: number;
  wallThickness_mm: number;
  filterLength_mm: number;
  filterDiameter_mm: number;
  wallPorosity: number;           // ε_wall [0–1]
  meanPoreSize_um: number;        // d_pore [µm]
  wallPermeability_m2: number;    // κ_wall [m²]
  thermalConductivity_W_mK: number;
  heatCapacity_J_kgK: number;
  substrateDensity_kg_m3: number;
  maxSootLoading_g_L: number;     // Before forced regen
  ashCapacity_g_L: number;        // Lifetime ash capacity
  /** Catalytic coating (for CDPF) */
  hasCatalyticCoating: boolean;
  pgmLoading_g_ft3: number;
}

export const DPF_CORDIERITE_DEFAULT: DPFProperties = {
  material: "cordierite",
  cellDensity_cpsi: 200,
  wallThickness_mm: 0.305,
  filterLength_mm: 254,
  filterDiameter_mm: 267,
  wallPorosity: 0.52,
  meanPoreSize_um: 15,
  wallPermeability_m2: 2.5e-13,
  thermalConductivity_W_mK: 1.5,
  heatCapacity_J_kgK: 1100,
  substrateDensity_kg_m3: 1200,
  maxSootLoading_g_L: 8.0,
  ashCapacity_g_L: 40,
  hasCatalyticCoating: true,
  pgmLoading_g_ft3: 10,
};

export const DPF_SIC_DEFAULT: DPFProperties = {
  material: "silicon_carbide",
  cellDensity_cpsi: 200,
  wallThickness_mm: 0.356,
  filterLength_mm: 254,
  filterDiameter_mm: 267,
  wallPorosity: 0.48,
  meanPoreSize_um: 12,
  wallPermeability_m2: 1.8e-13,
  thermalConductivity_W_mK: 15,
  heatCapacity_J_kgK: 800,
  substrateDensity_kg_m3: 1800,
  maxSootLoading_g_L: 10.0,
  ashCapacity_g_L: 50,
  hasCatalyticCoating: true,
  pgmLoading_g_ft3: 10,
};

// ============================================================
// SOOT ACCUMULATION
// ============================================================

export interface SootAccumulationResult {
  sootLoading_g_L: number;
  sootMass_g: number;
  filtrationEfficiency_percent: number;
  backpressure_kPa: number;
  timeToMaxLoading_h: number;
  regenRequired: boolean;
}

/**
 * Calculate soot accumulation rate and current loading.
 *
 * Soot generation rate depends on engine operating point:
 * m_soot = PM_mg_Nm3 × Q_Nm3_h × (1 - η_passive_regen)
 *
 * Filtration efficiency increases with soot cake buildup (deep-bed → cake filtration).
 */
export function calculateSootAccumulation(
  PM_mg_Nm3: number,
  Q_Nm3_h: number,
  operatingHours: number,
  dpf: DPFProperties,
  passiveRegenRate_g_h: number = 0
): SootAccumulationResult {
  const filterVolume_L =
    Math.PI * (dpf.filterDiameter_mm / 2000) ** 2 * (dpf.filterLength_mm / 1000) * 1000;

  // Soot generation rate [g/h]
  const sootGenRate = PM_mg_Nm3 * Q_Nm3_h / 1000;

  // Net accumulation (generation minus passive regen)
  const netRate = Math.max(0, sootGenRate - passiveRegenRate_g_h);

  // Current soot loading
  const sootMass = netRate * operatingHours;
  const sootLoading = sootMass / filterVolume_L;

  // Filtration efficiency: starts at ~85% (clean), rises to >99% with soot cake
  const eta_clean = 0.85;
  const eta_loaded = 0.999;
  const loadingFraction = Math.min(1, sootLoading / dpf.maxSootLoading_g_L);
  const filtrationEfficiency = eta_clean + (eta_loaded - eta_clean) * (1 - Math.exp(-5 * loadingFraction));

  // Pressure drop: clean wall + soot cake contribution
  // ΔP = ΔP_wall + ΔP_soot
  // ΔP_wall = μ × v_w × w / κ_wall
  // ΔP_soot = μ × v_w × w_soot / κ_soot
  const mu = 3e-5; // Pa·s (exhaust at ~400°C)
  const A_filter = Math.PI * (dpf.filterDiameter_mm / 2000) ** 2;
  const v_w = (Q_Nm3_h / 3600) * 2.5 / (A_filter * dpf.cellDensity_cpsi * 0.155 * 1e4); // wall velocity
  const dP_wall = mu * v_w * dpf.wallThickness_mm / 1000 / dpf.wallPermeability_m2;

  // Soot cake permeability: κ_soot ≈ 5e-14 m² (typical)
  const sootDensity = 100; // kg/m³ (soot cake)
  const sootThickness = sootLoading * filterVolume_L / 1000 / (sootDensity * A_filter * dpf.cellDensity_cpsi * 0.155 * 1e4);
  const kappa_soot = 5e-14;
  const dP_soot = mu * v_w * sootThickness / kappa_soot;

  const backpressure = (dP_wall + dP_soot) / 1000; // Pa → kPa

  // Time to max loading
  const timeToMax = netRate > 0 ? (dpf.maxSootLoading_g_L * filterVolume_L) / netRate : Infinity;

  return {
    sootLoading_g_L: sootLoading,
    sootMass_g: sootMass,
    filtrationEfficiency_percent: filtrationEfficiency * 100,
    backpressure_kPa: backpressure,
    timeToMaxLoading_h: timeToMax,
    regenRequired: sootLoading >= dpf.maxSootLoading_g_L * 0.8,
  };
}

// ============================================================
// PASSIVE REGENERATION (NO₂-assisted)
// ============================================================

/**
 * Passive regeneration rate via NO₂-assisted soot oxidation.
 *
 * C(soot) + NO₂ → CO + NO  (T > 250°C)
 * C(soot) + 2NO₂ → CO₂ + 2NO  (T > 300°C)
 *
 * The DOC upstream produces NO₂ from NO oxidation.
 * Passive regen is continuous and requires NO₂/soot ratio > 8:1 by mass.
 *
 * Rate: r = A × exp(-Ea/RT) × C_NO2 × m_soot
 */
export function passiveRegenRate(
  T_C: number,
  NO2_ppm: number,
  sootLoading_g_L: number,
  filterVolume_L: number
): {
  regenRate_g_h: number;
  balancePoint_C: number;
  isPassiveRegenActive: boolean;
} {
  const T_K = T_C + 273.15;

  // NO₂-soot reaction kinetics
  const A = 2.5e6; // Pre-exponential [g_soot / (g_soot · ppm_NO2 · h)]
  const Ea = 80000; // J/mol

  const k = arrhenius(A, Ea, T_K);
  const sootMass = sootLoading_g_L * filterVolume_L;
  const regenRate = k * NO2_ppm * sootMass;

  // Balance point: temperature where soot generation = passive regen
  // Approximate: typically 300–400°C depending on NO₂ availability
  const balancePoint = NO2_ppm > 50 ? 300 + (200 - NO2_ppm) * 0.5 : 450;

  return {
    regenRate_g_h: regenRate,
    balancePoint_C: Math.max(250, Math.min(500, balancePoint)),
    isPassiveRegenActive: T_C > 250 && NO2_ppm > 20,
  };
}

// ============================================================
// ACTIVE REGENERATION (O₂-based)
// ============================================================

export interface ActiveRegenResult {
  peakTemp_C: number;
  regenDuration_min: number;
  fuelPenalty_percent: number;
  thermalStress: "low" | "moderate" | "high" | "critical";
  thermalRunawayRisk: boolean;
  maxTempGradient_C_mm: number;
}

/**
 * Active regeneration assessment.
 *
 * During active regen, the DOC is used to raise exhaust temperature to
 * 550–650°C by injecting extra fuel (late post-injection or in-exhaust dosing).
 *
 * C(soot) + O₂ → CO₂  (T > 550°C, exothermic: ΔH = -393 kJ/mol)
 *
 * Risk: uncontrolled soot oxidation can cause thermal runaway (>1000°C),
 * cracking the DPF substrate.
 */
export function assessActiveRegen(
  sootLoading_g_L: number,
  filterVolume_L: number,
  inletTemp_C: number,
  O2_percent: number,
  dpf: DPFProperties
): ActiveRegenResult {
  // Soot combustion enthalpy: 393 kJ/mol C = 32.75 kJ/g_soot
  const H_combustion = 32750; // J/g
  const sootMass = sootLoading_g_L * filterVolume_L;

  // Adiabatic temperature rise from soot combustion
  const filterMass =
    dpf.substrateDensity_kg_m3 *
    Math.PI * (dpf.filterDiameter_mm / 2000) ** 2 *
    (dpf.filterLength_mm / 1000);
  const dT_adiabatic =
    (H_combustion * sootMass) / (filterMass * dpf.heatCapacity_J_kgK);

  const peakTemp = inletTemp_C + dT_adiabatic;

  // Regeneration duration (simplified)
  const T_K = (inletTemp_C + 600) / 2 + 273.15;
  const k_regen = arrhenius(1e8, 150000, T_K); // O₂-based soot oxidation
  const regenRate = k_regen * O2_percent * sootMass;
  const regenDuration = regenRate > 0 ? (sootMass / regenRate) * 60 : 30; // minutes

  // Fuel penalty: extra fuel injected to heat exhaust
  const fuelPenalty = 2 + sootLoading_g_L * 0.3; // % of fuel consumption

  // Thermal stress assessment
  const thermalStress: "low" | "moderate" | "high" | "critical" =
    peakTemp < 800 ? "low" :
    peakTemp < 1000 ? "moderate" :
    peakTemp < 1200 ? "high" : "critical";

  // Thermal runaway: occurs when soot loading is too high and regen starts
  const thermalRunawayRisk = sootLoading_g_L > dpf.maxSootLoading_g_L * 1.5 || peakTemp > 1100;

  // Temperature gradient (SiC handles better than cordierite)
  const maxGradient = dT_adiabatic / (dpf.filterLength_mm / 10);

  return {
    peakTemp_C: peakTemp,
    regenDuration_min: Math.max(5, Math.min(60, regenDuration)),
    fuelPenalty_percent: Math.min(10, fuelPenalty),
    thermalStress,
    thermalRunawayRisk,
    maxTempGradient_C_mm: maxGradient,
  };
}

// ============================================================
// ASH ACCUMULATION
// ============================================================

/**
 * Ash accumulation from lube oil additives (Ca, Zn, Mg, P).
 *
 * Ash is non-combustible and permanently reduces DPF capacity.
 * Typical ash accumulation: 10–30 g/L over 500,000 km.
 *
 * @returns Ash loading and remaining useful life
 */
export function calculateAshAccumulation(
  oilConsumption_g_kWh: number,
  ashContent_percent: number,
  power_kW: number,
  operatingHours: number,
  filterVolume_L: number,
  dpf: DPFProperties
): {
  ashLoading_g_L: number;
  capacityLoss_percent: number;
  remainingLife_hours: number;
  cleaningRecommended: boolean;
} {
  // Ash generation rate [g/h]
  const ashRate = oilConsumption_g_kWh * power_kW * ashContent_percent / 100;

  // Assume 80% of ash is trapped by DPF
  const ashTrapped = ashRate * 0.8 * operatingHours;
  const ashLoading = ashTrapped / filterVolume_L;

  const capacityLoss = (ashLoading / dpf.ashCapacity_g_L) * 100;
  const remainingLife =
    ashRate > 0
      ? ((dpf.ashCapacity_g_L * filterVolume_L - ashTrapped) / (ashRate * 0.8))
      : Infinity;

  return {
    ashLoading_g_L: ashLoading,
    capacityLoss_percent: Math.min(100, capacityLoss),
    remainingLife_hours: Math.max(0, remainingLife),
    cleaningRecommended: capacityLoss > 60,
  };
}

// ============================================================
// COMPLETE DPF ASSESSMENT
// ============================================================

export interface DPFAssessmentResult {
  soot: SootAccumulationResult;
  passiveRegen: ReturnType<typeof passiveRegenRate>;
  activeRegen: ActiveRegenResult;
  ash: ReturnType<typeof calculateAshAccumulation>;
  overallStatus: "normal" | "regen_needed" | "maintenance" | "critical";
  warnings: string[];
}

export function assessDPF(
  dpf: DPFProperties,
  PM_mg_Nm3: number,
  Q_Nm3_h: number,
  operatingHours: number,
  T_C: number,
  NO2_ppm: number,
  O2_percent: number,
  oilConsumption_g_kWh: number,
  ashContent_percent: number,
  power_kW: number
): DPFAssessmentResult {
  const warnings: string[] = [];
  const filterVolume_L =
    Math.PI * (dpf.filterDiameter_mm / 2000) ** 2 * (dpf.filterLength_mm / 1000) * 1000;

  const passive = passiveRegenRate(T_C, NO2_ppm, 4.0, filterVolume_L);
  const soot = calculateSootAccumulation(PM_mg_Nm3, Q_Nm3_h, operatingHours, dpf, passive.regenRate_g_h);
  const activeRegen = assessActiveRegen(soot.sootLoading_g_L, filterVolume_L, T_C, O2_percent, dpf);
  const ash = calculateAshAccumulation(oilConsumption_g_kWh, ashContent_percent, power_kW, operatingHours, filterVolume_L, dpf);

  if (activeRegen.thermalRunawayRisk) {
    warnings.push("CRITICAL: Thermal runaway risk during active regeneration. Reduce soot loading immediately.");
  }
  if (soot.regenRequired) {
    warnings.push(`Soot loading (${soot.sootLoading_g_L.toFixed(1)} g/L) approaching maximum. Active regeneration required.`);
  }
  if (ash.cleaningRecommended) {
    warnings.push(`Ash loading (${ash.ashLoading_g_L.toFixed(1)} g/L) is high. DPF cleaning/replacement recommended.`);
  }
  if (!passive.isPassiveRegenActive) {
    warnings.push("Passive regeneration inactive — exhaust temperature or NO₂ too low for continuous soot oxidation.");
  }

  const overallStatus: DPFAssessmentResult["overallStatus"] =
    activeRegen.thermalRunawayRisk ? "critical" :
    soot.regenRequired || ash.cleaningRecommended ? "maintenance" :
    soot.sootLoading_g_L > dpf.maxSootLoading_g_L * 0.5 ? "regen_needed" :
    "normal";

  return { soot, passiveRegen: passive, activeRegen, ash, overallStatus, warnings };
}
