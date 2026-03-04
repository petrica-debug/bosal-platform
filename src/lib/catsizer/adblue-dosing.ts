/**
 * AdBlue / DEF DOSING CALCULATOR
 *
 * Calculates DEF injection rate as a function of:
 * - NOx inlet concentration and exhaust mass flow
 * - Exhaust temperature (affects decomposition and SCR activity)
 * - Target alpha (ANR = NH₃/NOₓ ratio)
 *
 * Provides:
 * 1. DEF dosing rate vs. temperature map
 * 2. Alpha dosing strategy (feedforward + feedback)
 * 3. Operating window analysis
 * 4. DEF consumption over duty cycle
 */

import { DEF_PROPERTIES } from "./scr-dosing";

// ============================================================
// CORE DOSING CALCULATION
// ============================================================

export interface DosingPoint {
  temperature_C: number;
  NOx_ppm: number;
  exhaustMassFlow_kg_h: number;
  alpha: number;
  DEF_rate_mL_min: number;
  DEF_rate_L_h: number;
  NH3_rate_g_h: number;
  ureaDecomposition_percent: number;
  effectiveAlpha: number;
  scrActivity: number;
  expectedDeNOx_percent: number;
}

/**
 * Calculate DEF dosing rate for a single operating point.
 *
 * DEF_rate = (NOx_ppm × Q_Nm3_h × MW_NO2 × alpha) / (MW_NH3 × 2 × urea_conc × ρ_DEF)
 *
 * The factor of 2 comes from: 1 mol urea → 2 mol NH₃
 */
export function calculateDosingPoint(
  NOx_ppm: number,
  exhaustMassFlow_kg_h: number,
  exhaustTemp_C: number,
  alpha: number,
  exhaustMW: number = 28.8
): DosingPoint {
  // Exhaust volume flow at STP
  const Q_Nm3_h = exhaustMassFlow_kg_h / (exhaustMW * 101325 / (8314 * 273.15));

  // NOx mass flow [g/h] (as NO₂ equivalent, MW = 46)
  const NOx_mass_g_h = NOx_ppm * 1e-6 * Q_Nm3_h * 46 * 1000 / 22.414;

  // Required NH₃ [g/h]
  const NH3_required_g_h = NOx_mass_g_h * alpha * (17.031 / 46);

  // Urea required [g/h] (1 mol urea → 2 mol NH₃)
  const urea_g_h = NH3_required_g_h * DEF_PROPERTIES.urea_MW / (2 * DEF_PROPERTIES.NH3_MW);

  // DEF volume [L/h]
  const DEF_L_h = urea_g_h / (DEF_PROPERTIES.ureaConcentration * DEF_PROPERTIES.density_kg_L * 1000);
  const DEF_mL_min = DEF_L_h * 1000 / 60;

  // Urea decomposition efficiency (temperature-dependent)
  const decomp = 1 / (1 + Math.exp(-(exhaustTemp_C - 200) / 20)) *
                 1 / (1 + Math.exp(-(exhaustTemp_C - 220) / 15));

  // SCR catalyst activity (temperature-dependent)
  const T_K = exhaustTemp_C + 273.15;
  const k_scr = 1e6 * Math.exp(-45000 / (8.314 * T_K));
  const scrActivity = Math.min(1, 1 - Math.exp(-k_scr * 0.001));

  // Effective alpha (after decomposition losses)
  const effectiveAlpha = alpha * decomp;

  // Expected DeNOx
  const expectedDeNOx = Math.min(99, effectiveAlpha * scrActivity * 100);

  return {
    temperature_C: exhaustTemp_C,
    NOx_ppm,
    exhaustMassFlow_kg_h,
    alpha,
    DEF_rate_mL_min: DEF_mL_min,
    DEF_rate_L_h: DEF_L_h,
    NH3_rate_g_h: NH3_required_g_h,
    ureaDecomposition_percent: decomp * 100,
    effectiveAlpha,
    scrActivity,
    expectedDeNOx_percent: expectedDeNOx,
  };
}

// ============================================================
// DOSING MAP (Temperature sweep)
// ============================================================

export interface DosingMap {
  points: DosingPoint[];
  minDosingTemp_C: number;
  maxEfficiencyTemp_C: number;
  totalDEF_L_h_at_rated: number;
}

/**
 * Generate a dosing map across a temperature range.
 * Shows how DEF rate and DeNOx vary with exhaust temperature.
 */
export function generateDosingMap(
  NOx_ppm: number,
  exhaustMassFlow_kg_h: number,
  alpha: number,
  tempRange: [number, number] = [150, 550],
  steps: number = 25
): DosingMap {
  const points: DosingPoint[] = [];
  const dt = (tempRange[1] - tempRange[0]) / (steps - 1);

  for (let i = 0; i < steps; i++) {
    const T = tempRange[0] + i * dt;
    points.push(calculateDosingPoint(NOx_ppm, exhaustMassFlow_kg_h, T, alpha));
  }

  // Find minimum dosing temperature (where decomposition > 50%)
  const minDosingTemp = points.find((p) => p.ureaDecomposition_percent > 50)?.temperature_C ?? 200;

  // Find temperature of maximum efficiency
  const maxEff = points.reduce((best, p) =>
    p.expectedDeNOx_percent > best.expectedDeNOx_percent ? p : best, points[0]);

  return {
    points,
    minDosingTemp_C: minDosingTemp,
    maxEfficiencyTemp_C: maxEff.temperature_C,
    totalDEF_L_h_at_rated: points.find((p) => p.temperature_C >= 350)?.DEF_rate_L_h ?? 0,
  };
}

// ============================================================
// ALPHA DOSING STRATEGY
// ============================================================

export interface AlphaStrategy {
  /** Temperature-dependent alpha map */
  alphaMap: Array<{ temp_C: number; alpha: number; reason: string }>;
  /** Recommended alpha for current conditions */
  recommendedAlpha: number;
  /** Operating mode */
  mode: "off" | "warmup" | "normal" | "high_load" | "regen";
  /** DEF inhibit conditions */
  inhibitReasons: string[];
}

/**
 * Determine optimal alpha dosing strategy based on operating conditions.
 *
 * Alpha varies with temperature:
 * - Below 180°C: DEF off (no decomposition)
 * - 180–220°C: Reduced alpha (0.5–0.8) to avoid deposits
 * - 220–450°C: Full alpha (0.95–1.05)
 * - Above 450°C: Slightly reduced (0.9) due to NH₃ oxidation
 * - During DPF regen: DEF off or reduced
 */
export function determineAlphaStrategy(
  exhaustTemp_C: number,
  NOx_ppm: number,
  targetDeNOx: number = 0.95,
  isDPFRegen: boolean = false,
  sootLoading_g_L: number = 0,
  NH3_storage_g_L: number = 0
): AlphaStrategy {
  const inhibitReasons: string[] = [];

  // Alpha map across temperature range
  const alphaMap: AlphaStrategy["alphaMap"] = [
    { temp_C: 150, alpha: 0, reason: "Below minimum decomposition temperature" },
    { temp_C: 180, alpha: 0.3, reason: "Warmup — partial dosing to pre-load NH₃ on zeolite" },
    { temp_C: 200, alpha: 0.6, reason: "Warmup — increasing decomposition efficiency" },
    { temp_C: 220, alpha: 0.85, reason: "Transition — decomposition >80%" },
    { temp_C: 250, alpha: 0.95, reason: "Normal operation — full dosing" },
    { temp_C: 300, alpha: 1.0, reason: "Optimal SCR window" },
    { temp_C: 350, alpha: 1.02, reason: "Slight over-dosing for margin" },
    { temp_C: 400, alpha: 1.0, reason: "High efficiency zone" },
    { temp_C: 450, alpha: 0.95, reason: "Reducing alpha — NH₃ oxidation increases" },
    { temp_C: 500, alpha: 0.90, reason: "High temperature — significant NH₃ oxidation" },
    { temp_C: 550, alpha: 0.85, reason: "Very high temperature — parasitic NH₃ loss" },
  ];

  // Determine current mode
  let mode: AlphaStrategy["mode"] = "normal";
  if (exhaustTemp_C < 180) mode = "off";
  else if (exhaustTemp_C < 220) mode = "warmup";
  else if (exhaustTemp_C > 450) mode = "high_load";
  if (isDPFRegen) mode = "regen";

  // Interpolate alpha for current temperature
  let alpha = 0;
  if (exhaustTemp_C <= alphaMap[0].temp_C) {
    alpha = alphaMap[0].alpha;
  } else if (exhaustTemp_C >= alphaMap[alphaMap.length - 1].temp_C) {
    alpha = alphaMap[alphaMap.length - 1].alpha;
  } else {
    for (let i = 0; i < alphaMap.length - 1; i++) {
      if (exhaustTemp_C >= alphaMap[i].temp_C && exhaustTemp_C < alphaMap[i + 1].temp_C) {
        const frac = (exhaustTemp_C - alphaMap[i].temp_C) / (alphaMap[i + 1].temp_C - alphaMap[i].temp_C);
        alpha = alphaMap[i].alpha + frac * (alphaMap[i + 1].alpha - alphaMap[i].alpha);
        break;
      }
    }
  }

  // Inhibit conditions
  if (exhaustTemp_C < 180) {
    inhibitReasons.push("Exhaust temperature below 180°C — DEF injection inhibited");
    alpha = 0;
  }
  if (isDPFRegen) {
    inhibitReasons.push("DPF active regeneration in progress — DEF reduced to prevent ammonium nitrate");
    alpha *= 0.3;
  }
  if (NH3_storage_g_L > 4) {
    inhibitReasons.push("NH₃ storage near capacity — reducing dosing to prevent slip");
    alpha *= 0.8;
  }

  return {
    alphaMap,
    recommendedAlpha: alpha,
    mode,
    inhibitReasons,
  };
}

// ============================================================
// DUTY CYCLE DEF CONSUMPTION
// ============================================================

export interface DutyCyclePoint {
  time_s: number;
  speed_rpm: number;
  load_percent: number;
  exhaustTemp_C: number;
  NOx_ppm: number;
  exhaustFlow_kg_h: number;
}

export interface DutyCycleResult {
  totalDEF_L: number;
  totalTime_s: number;
  averageDEF_L_h: number;
  averageDeNOx_percent: number;
  cumulativeNOx_g: number;
  cumulativeTailpipeNOx_g: number;
  dosingProfile: Array<{
    time_s: number;
    DEF_mL_min: number;
    alpha: number;
    DeNOx_percent: number;
    mode: string;
  }>;
}

/**
 * Calculate DEF consumption over a duty cycle.
 */
export function calculateDutyCycleDEF(
  cycle: DutyCyclePoint[],
  targetAlpha: number = 1.0
): DutyCycleResult {
  let totalDEF_mL = 0;
  let totalNOx_g = 0;
  let totalTailpipeNOx_g = 0;
  const dosingProfile: DutyCycleResult["dosingProfile"] = [];

  for (let i = 0; i < cycle.length; i++) {
    const pt = cycle[i];
    const dt_s = i < cycle.length - 1 ? cycle[i + 1].time_s - pt.time_s : 1;
    const dt_h = dt_s / 3600;

    const strategy = determineAlphaStrategy(pt.exhaustTemp_C, pt.NOx_ppm);
    const alpha = Math.min(strategy.recommendedAlpha, targetAlpha);
    const dosing = calculateDosingPoint(pt.NOx_ppm, pt.exhaustFlow_kg_h, pt.exhaustTemp_C, alpha);

    totalDEF_mL += dosing.DEF_rate_mL_min * (dt_s / 60);

    // NOx mass
    const Q_Nm3_h = pt.exhaustFlow_kg_h / (28.8 * 101325 / (8314 * 273.15));
    const NOx_g = pt.NOx_ppm * 1e-6 * Q_Nm3_h * 46 * 1000 / 22.414 * dt_h;
    totalNOx_g += NOx_g;
    totalTailpipeNOx_g += NOx_g * (1 - dosing.expectedDeNOx_percent / 100);

    dosingProfile.push({
      time_s: pt.time_s,
      DEF_mL_min: dosing.DEF_rate_mL_min,
      alpha,
      DeNOx_percent: dosing.expectedDeNOx_percent,
      mode: strategy.mode,
    });
  }

  const totalTime = cycle.length > 0 ? cycle[cycle.length - 1].time_s - cycle[0].time_s : 0;

  return {
    totalDEF_L: totalDEF_mL / 1000,
    totalTime_s: totalTime,
    averageDEF_L_h: totalTime > 0 ? (totalDEF_mL / 1000) / (totalTime / 3600) : 0,
    averageDeNOx_percent: totalNOx_g > 0 ? (1 - totalTailpipeNOx_g / totalNOx_g) * 100 : 0,
    cumulativeNOx_g: totalNOx_g,
    cumulativeTailpipeNOx_g: totalTailpipeNOx_g,
    dosingProfile,
  };
}
