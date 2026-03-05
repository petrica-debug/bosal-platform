/**
 * WLTP TRANSIENT SIMULATION ENGINE
 *
 * Connects the WLTP drive cycle with real catalyst physics from the
 * pre-development engine (TOF/TON calibrated profiles, GHSV-dependent
 * sigmoidal model, deactivation).
 *
 * Key features:
 * - Exhaust flow & temperature generated from engine displacement and
 *   speed/load using literature correlations (Heywood, SAE papers)
 * - Instantaneous conversion at each timestep using predictConversion()
 *   with real catalyst profiles (T50, Ea, GHSV effects)
 * - Catalyst thermal inertia model (lumped capacitance)
 * - Cumulative g/km integration for homologation verdict
 * - Deactivation-adjusted (aged) conversion in parallel
 *
 * References:
 * - Heywood, "Internal Combustion Engine Fundamentals" (2018)
 * - SAE 2017-01-0935 (WLTP exhaust temperature correlations)
 * - Koltsakis et al., "Catalytic Automotive Exhaust Aftertreatment" (1997)
 */

import {
  predictConversion,
  getProfile,
  cpsiMassTransferFactor,
  pgmLoadingFactor,
  splitBoost,
  getDefaultWallThickness,
  type WashcoatType,
  type SplitConfig,
  type RAGVerdict,
} from "./predev-engine";
import { substrateGeometry } from "./depollution-engine";
import { assessDeactivation, type DeactivationInputs } from "./deactivation";

// ============================================================
// TYPES
// ============================================================

export interface TransientCatalystConfig {
  cpsi: number;
  wallThickness_mil: number;
  washcoatType: WashcoatType;
  pgmLoading_g_ft3: number;
  diameter_mm: number;
  length_mm: number;
  splitConfig: SplitConfig;
}

export interface TransientEngineConfig {
  displacement_L: number;
  ratedPower_kW: number;
  fuelType: "diesel" | "gasoline";
  numberOfCylinders: number;
  /** Engine-out raw emission concentrations (ppm) */
  rawCO_ppm: number;
  rawHC_ppm: number;
  rawNOx_ppm: number;
  rawPM_mg_Nm3: number;
}

export interface TransientSimConfig {
  engine: TransientEngineConfig;
  catalyst: TransientCatalystConfig;
  emissionStandard: WLTPEmissionStandard;
  agingHours: number;
  maxTemp_C: number;
  fuelSulfur_ppm: number;
}

export interface TransientStep {
  time: number;
  speed_kmh: number;
  phase: string;
  load: number;
  exhaustFlow_kg_h: number;
  exhaustTemp_C: number;
  catalystTemp_C: number;
  GHSV_h: number;
  // Engine-out (g/s)
  engineCO_g_s: number;
  engineHC_g_s: number;
  engineNOx_g_s: number;
  enginePM_g_s: number;
  // Instantaneous conversion (%) - fresh
  convCO_fresh: number;
  convHC_fresh: number;
  convNOx_fresh: number;
  // Instantaneous conversion (%) - aged
  convCO_aged: number;
  convHC_aged: number;
  convNOx_aged: number;
  // Tailpipe (g/s) - aged
  tailpipeCO_g_s: number;
  tailpipeHC_g_s: number;
  tailpipeNOx_g_s: number;
  tailpipePM_g_s: number;
  // Cumulative
  cumDistance_km: number;
  cumCO_g_km: number;
  cumHC_g_km: number;
  cumNOx_g_km: number;
  cumPM_g_km: number;
}

export interface TransientPhaseResult {
  phase: string;
  duration_s: number;
  distance_km: number;
  avgExhaustTemp_C: number;
  avgCatalystTemp_C: number;
  avgConvCO: number;
  avgConvHC: number;
  avgConvNOx: number;
  CO_g_km: number;
  HC_g_km: number;
  NOx_g_km: number;
  PM_g_km: number;
}

export interface HomologationVerdict {
  species: string;
  cumulative_g_km: number;
  limit_g_km: number;
  margin_percent: number;
  verdict: RAGVerdict;
}

export interface TransientSimResult {
  steps: TransientStep[];
  phases: TransientPhaseResult[];
  homologation: HomologationVerdict[];
  overallVerdict: RAGVerdict;
  totalDistance_km: number;
  totalDuration_s: number;
  coldStartPenalty_g_km: { CO: number; HC: number; NOx: number };
  agingFactor: number;
  catalystVolume_L: number;
  peakGHSV_h: number;
  avgGHSV_h: number;
  lightOffTime_s: number;
  T50_reached_s: { CO: number; HC: number; NOx: number };
}

// ============================================================
// LITERATURE-BASED EXHAUST FLOW MODEL
// ============================================================

/**
 * Exhaust mass flow rate from engine displacement, speed, and load.
 *
 * Based on volumetric efficiency model:
 *   ṁ_exhaust ≈ ṁ_air × (1 + 1/AFR)
 *   ṁ_air = η_vol × V_d × N / (2 × 60) × ρ_air  (for 4-stroke)
 *
 * With load-dependent volumetric efficiency and turbo boost.
 *
 * References: Heywood (2018), Ch. 6; SAE 2017-01-0935
 */
function exhaustFlowFromDriveCycle(
  displacement_L: number,
  speed_kmh: number,
  load: number,
  fuelType: "diesel" | "gasoline",
  nCyl: number
): number {
  const rho_air = 1.184; // kg/m³ at 25°C
  const AFR = fuelType === "diesel" ? 25 : 14.7; // lean diesel vs stoich gasoline
  const eta_vol = 0.85 + load * 0.1; // volumetric efficiency

  // Engine speed from vehicle speed (simplified gearing model)
  const gearRatio = speed_kmh < 15 ? 12 : speed_kmh < 40 ? 8 : speed_kmh < 70 ? 5.5 : speed_kmh < 100 ? 4 : 3.2;
  const tireCirc_m = 2.0; // ~637mm diameter tire
  const engineSpeed_rpm = speed_kmh > 0
    ? Math.max(800, Math.min(4500, (speed_kmh / 3.6 / tireCirc_m) * gearRatio * 60))
    : 800; // idle

  // Air mass flow (4-stroke: 1 intake per 2 revolutions)
  const V_d_m3 = displacement_L / 1000;
  const m_air_kg_s = eta_vol * V_d_m3 * (engineSpeed_rpm / (2 * 60)) * rho_air;

  // Turbo boost for diesel (load-dependent)
  const boostFactor = fuelType === "diesel" ? 1.0 + load * 0.8 : 1.0;

  // Exhaust mass flow
  const m_exhaust_kg_s = m_air_kg_s * boostFactor * (1 + 1 / AFR);
  return m_exhaust_kg_s * 3600; // kg/h
}

/**
 * Exhaust gas temperature model.
 *
 * Based on load, speed, and fuel type. Diesel exhaust is cooler than
 * gasoline at part load due to lean operation.
 *
 * T_exhaust = T_base + f(load) + f(speed) + noise
 *
 * References: SAE 2017-01-0935, Koltsakis (1997)
 */
function exhaustTempFromDriveCycle(
  speed_kmh: number,
  load: number,
  fuelType: "diesel" | "gasoline",
  displacement_L: number
): number {
  const T_idle = fuelType === "diesel" ? 150 : 200;
  const T_load_coeff = fuelType === "diesel" ? 350 : 450;
  const T_speed_coeff = fuelType === "diesel" ? 0.6 : 0.8;
  const displacementEffect = Math.max(0, (displacement_L - 2) * 5);

  if (speed_kmh <= 0) return T_idle + displacementEffect;

  return T_idle + load * T_load_coeff + speed_kmh * T_speed_coeff + displacementEffect;
}

/**
 * Engine-out emission rates (g/s) based on load and displacement.
 *
 * Uses brake-specific emission factors from literature, scaled by
 * instantaneous power output.
 *
 * CO and HC are higher at cold start and high load (rich excursions).
 * NOx peaks at high load and temperature.
 * PM is primarily a diesel concern, peaking at high load.
 */
function engineOutEmissions(
  rawCO_ppm: number,
  rawHC_ppm: number,
  rawNOx_ppm: number,
  rawPM_mg_Nm3: number,
  exhaustFlow_kg_h: number,
  load: number,
  fuelType: "diesel" | "gasoline"
): { CO_g_s: number; HC_g_s: number; NOx_g_s: number; PM_g_s: number } {
  const rho_STP = (101325 * 28.8e-3) / (8.314 * 273.15);
  const Q_Nm3_s = exhaustFlow_kg_h / 3600 / rho_STP;

  // Load-dependent emission modulation
  // At idle/low load: CO and HC are higher (poor combustion), NOx is lower
  // At high load: NOx peaks, CO drops (diesel), PM peaks
  const coLoadFactor = fuelType === "diesel"
    ? 0.6 + load * 0.8 + (load > 0.7 ? 0.4 : 0)
    : 0.8 + load * 0.5 + (load > 0.8 ? 0.6 : 0);
  const hcLoadFactor = 0.5 + load * 0.6 + (load < 0.1 ? 0.3 : 0);
  const noxLoadFactor = 0.2 + load * 1.5 + (load > 0.6 ? 0.3 : 0);
  const pmLoadFactor = fuelType === "diesel"
    ? 0.3 + load * 1.2 + (load > 0.7 ? 0.5 : 0)
    : 0.1 + load * 0.3;

  // ppm → g/s: C_g_s = ppm × 1e-6 × MW × Q_Nm3_s / V_mol
  const V_mol = 22.414e-3; // Nm³/mol
  const CO_g_s = rawCO_ppm * 1e-6 * 28.01 * Q_Nm3_s / V_mol * coLoadFactor;
  const HC_g_s = rawHC_ppm * 1e-6 * 44.096 * Q_Nm3_s / V_mol * hcLoadFactor;
  const NOx_g_s = rawNOx_ppm * 1e-6 * 46.006 * Q_Nm3_s / V_mol * noxLoadFactor;
  const PM_g_s = rawPM_mg_Nm3 * 1e-6 * Q_Nm3_s * 1000 * pmLoadFactor;

  return { CO_g_s, HC_g_s, NOx_g_s, PM_g_s };
}

// ============================================================
// LIGHT-DUTY ENGINE PRESETS (< 2L, aftermarket focus)
// ============================================================

export interface LightDutyEnginePreset {
  name: string;
  displacement_L: number;
  power_kW: number;
  fuelType: "diesel" | "gasoline";
  cylinders: number;
  rawCO_ppm: number;
  rawHC_ppm: number;
  rawNOx_ppm: number;
  rawPM_mg_Nm3: number;
}

export const LIGHT_DUTY_PRESETS: LightDutyEnginePreset[] = [
  // ── Diesel ──
  {
    name: "1.5 dCi Diesel (Renault K9K class)",
    displacement_L: 1.5, power_kW: 81, fuelType: "diesel", cylinders: 4,
    rawCO_ppm: 350, rawHC_ppm: 60, rawNOx_ppm: 650, rawPM_mg_Nm3: 25,
  },
  {
    name: "1.6 TDI Diesel (VW EA189 class)",
    displacement_L: 1.6, power_kW: 77, fuelType: "diesel", cylinders: 4,
    rawCO_ppm: 300, rawHC_ppm: 55, rawNOx_ppm: 600, rawPM_mg_Nm3: 22,
  },
  {
    name: "1.6 HDi Diesel (PSA DV6 class)",
    displacement_L: 1.6, power_kW: 82, fuelType: "diesel", cylinders: 4,
    rawCO_ppm: 320, rawHC_ppm: 58, rawNOx_ppm: 620, rawPM_mg_Nm3: 24,
  },
  {
    name: "2.0 TDI Diesel (VW EA288 class)",
    displacement_L: 2.0, power_kW: 110, fuelType: "diesel", cylinders: 4,
    rawCO_ppm: 380, rawHC_ppm: 65, rawNOx_ppm: 700, rawPM_mg_Nm3: 20,
  },
  {
    name: "1.3 CDTI Diesel (Opel/Fiat class)",
    displacement_L: 1.3, power_kW: 66, fuelType: "diesel", cylinders: 4,
    rawCO_ppm: 280, rawHC_ppm: 50, rawNOx_ppm: 580, rawPM_mg_Nm3: 28,
  },
  // ── Gasoline ──
  {
    name: "1.0 TSI Gasoline (VW EA211 class)",
    displacement_L: 1.0, power_kW: 85, fuelType: "gasoline", cylinders: 3,
    rawCO_ppm: 4500, rawHC_ppm: 350, rawNOx_ppm: 180, rawPM_mg_Nm3: 5,
  },
  {
    name: "1.2 PureTech Gasoline (PSA EB class)",
    displacement_L: 1.2, power_kW: 96, fuelType: "gasoline", cylinders: 3,
    rawCO_ppm: 4200, rawHC_ppm: 320, rawNOx_ppm: 200, rawPM_mg_Nm3: 6,
  },
  {
    name: "1.4 TSI Gasoline (VW EA211 class)",
    displacement_L: 1.4, power_kW: 110, fuelType: "gasoline", cylinders: 4,
    rawCO_ppm: 4800, rawHC_ppm: 380, rawNOx_ppm: 220, rawPM_mg_Nm3: 4,
  },
  {
    name: "1.6 MPI Gasoline (Hyundai Gamma class)",
    displacement_L: 1.6, power_kW: 97, fuelType: "gasoline", cylinders: 4,
    rawCO_ppm: 5000, rawHC_ppm: 400, rawNOx_ppm: 250, rawPM_mg_Nm3: 3,
  },
  {
    name: "2.0 GDI Gasoline (Ford EcoBoost class)",
    displacement_L: 2.0, power_kW: 147, fuelType: "gasoline", cylinders: 4,
    rawCO_ppm: 5200, rawHC_ppm: 420, rawNOx_ppm: 280, rawPM_mg_Nm3: 8,
  },
];

// ============================================================
// EURO 3–6 + UNECE R83 EMISSION LIMITS (g/km)
//
// Light-duty passenger vehicles (Category M1)
// UNECE Regulation 83 (Rev.5) — Type I test (NEDC / WLTP)
//
// Sources:
// - Regulation (EC) No 715/2007 (Euro 5/6)
// - Directive 98/69/EC (Euro 3/4)
// - UNECE R83 Rev.5 Annex 7
// ============================================================

export type WLTPEmissionStandard =
  | "euro_3_diesel" | "euro_3_gasoline"
  | "euro_4_diesel" | "euro_4_gasoline"
  | "euro_5_diesel" | "euro_5_gasoline"
  | "euro_6b_diesel" | "euro_6b_gasoline"
  | "euro_6d_diesel" | "euro_6d_gasoline";

export interface WLTPEmissionLimits {
  label: string;
  CO: number;
  HC: number;
  NOx: number;
  HC_NOx?: number;
  PM: number;
  PN?: number; // #/km × 10¹¹
}

export const WLTP_EMISSION_LIMITS: Record<WLTPEmissionStandard, WLTPEmissionLimits> = {
  // ── Euro 3 (2000) — NEDC, UNECE R83.05 ──
  euro_3_diesel: {
    label: "Euro 3 Diesel",
    CO: 0.64, HC: 0.56, NOx: 0.50, HC_NOx: 0.56, PM: 0.05,
  },
  euro_3_gasoline: {
    label: "Euro 3 Gasoline",
    CO: 2.3, HC: 0.20, NOx: 0.15, PM: 999,
  },
  // ── Euro 4 (2005) — NEDC ──
  euro_4_diesel: {
    label: "Euro 4 Diesel",
    CO: 0.50, HC: 0.30, NOx: 0.25, HC_NOx: 0.30, PM: 0.025,
  },
  euro_4_gasoline: {
    label: "Euro 4 Gasoline",
    CO: 1.0, HC: 0.10, NOx: 0.08, PM: 999,
  },
  // ── Euro 5 (2009) — NEDC ──
  euro_5_diesel: {
    label: "Euro 5 Diesel",
    CO: 0.50, HC: 0.23, NOx: 0.18, HC_NOx: 0.23, PM: 0.005, PN: 6.0,
  },
  euro_5_gasoline: {
    label: "Euro 5 Gasoline",
    CO: 1.0, HC: 0.10, NOx: 0.06, PM: 0.005,
  },
  // ── Euro 6b (2014) — NEDC ──
  euro_6b_diesel: {
    label: "Euro 6b Diesel",
    CO: 0.50, HC: 0.17, NOx: 0.08, HC_NOx: 0.17, PM: 0.005, PN: 6.0,
  },
  euro_6b_gasoline: {
    label: "Euro 6b Gasoline",
    CO: 1.0, HC: 0.10, NOx: 0.06, PM: 0.005, PN: 6.0,
  },
  // ── Euro 6d (2020) — WLTP + RDE ──
  euro_6d_diesel: {
    label: "Euro 6d Diesel",
    CO: 0.50, HC: 0.17, NOx: 0.08, HC_NOx: 0.17, PM: 0.0045, PN: 6.0,
  },
  euro_6d_gasoline: {
    label: "Euro 6d Gasoline",
    CO: 1.0, HC: 0.10, NOx: 0.06, PM: 0.0045, PN: 6.0,
  },
};

// ============================================================
// MAIN TRANSIENT SIMULATION
// ============================================================

export function runTransientWLTPSim(
  cycle: Array<{ time: number; speed: number; phase?: string }>,
  config: TransientSimConfig
): TransientSimResult {
  const { engine, catalyst, emissionStandard, agingHours, maxTemp_C, fuelSulfur_ppm } = config;

  // Catalyst setup
  const profile = getProfile(catalyst.washcoatType);
  const geo = substrateGeometry(catalyst.cpsi, catalyst.wallThickness_mil);
  const gsaFac = cpsiMassTransferFactor(catalyst.cpsi, catalyst.wallThickness_mil);
  const split = splitBoost(catalyst.splitConfig);
  const pgmFac = pgmLoadingFactor(catalyst.pgmLoading_g_ft3, profile.composition.totalPGM_g_ft3);

  const catVolume_L =
    Math.PI * Math.pow(catalyst.diameter_mm / 2000, 2) * (catalyst.length_mm / 1000) * 1000;

  // Deactivation
  const deactInput: DeactivationInputs = {
    catalystType: "DOC",
    SO2_ppm: 5,
    operatingTemp_C: 350,
    maxTemp_C,
    operatingHours: agingHours,
    oilConsumption_g_kWh: 0.3,
    oilPhosphorus_ppm: 800,
    power_kW: engine.ratedPower_kW,
    catalystVolume_L: catVolume_L,
    fuelSulfur_ppm,
  };
  const aging = assessDeactivation(deactInput);
  const agingActivity = aging.overallActivity;

  // Thermal inertia
  const tau = engine.fuelType === "diesel" ? 22 : 15; // thermal time constant (s)
  const isLean = engine.fuelType === "diesel";

  // Molar flow placeholders (used by predictConversion but not critical for sigmoidal model)
  const molarFlowPlaceholder = 0.01;

  // Emission limits (g/km) from UNECE R83 / Euro 3-6
  const limits = WLTP_EMISSION_LIMITS[emissionStandard] ?? WLTP_EMISSION_LIMITS.euro_6d_diesel;

  // Simulation state
  let catalystTemp = 25; // cold start
  let cumCO = 0, cumHC = 0, cumNOx = 0, cumPM = 0;
  let cumDistance = 0;
  const dt = 1; // 1 second timestep

  const steps: TransientStep[] = [];
  let peakGHSV = 0;
  let sumGHSV = 0;
  let lightOffTime = -1;
  const t50Reached = { CO: -1, HC: -1, NOx: -1 };

  // Seeded PRNG for reproducible noise
  let seed = 42;
  function noise(): number {
    seed = (seed * 16807) % 2147483647;
    return ((seed / 2147483647) - 0.5) * 6;
  }

  for (let i = 0; i < cycle.length; i++) {
    const { time, speed, phase } = cycle[i];

    // Load estimation (simplified: speed² + acceleration proxy)
    const prevSpeed = i > 0 ? cycle[i - 1].speed : 0;
    const accel = (speed - prevSpeed) / dt;
    const load = speed > 0
      ? Math.min(1.0, 0.05 + (speed / 131) * 0.4 + Math.pow(speed / 131, 2) * 0.25 + Math.max(0, accel / 3) * 0.3)
      : 0.03;

    // Exhaust flow from displacement model
    const exhaustFlow_kg_h = exhaustFlowFromDriveCycle(
      engine.displacement_L, speed, load, engine.fuelType, engine.numberOfCylinders
    );

    // Exhaust temperature
    const rawExhaustTemp = exhaustTempFromDriveCycle(speed, load, engine.fuelType, engine.displacement_L);
    const exhaustTemp = rawExhaustTemp + noise();

    // Catalyst thermal inertia: dT/dt = (T_gas - T_cat) / τ
    catalystTemp += (exhaustTemp - catalystTemp) / tau * dt;

    // GHSV
    const rho_STP = (101325 * 28.8e-3) / (8.314 * 273.15);
    const Q_Nm3_h = exhaustFlow_kg_h / rho_STP;
    const GHSV = (Q_Nm3_h * 1000) / (catVolume_L + 1e-10);
    if (GHSV > peakGHSV) peakGHSV = GHSV;
    sumGHSV += GHSV;

    // Engine-out emissions
    const eo = engineOutEmissions(
      engine.rawCO_ppm, engine.rawHC_ppm, engine.rawNOx_ppm, engine.rawPM_mg_Nm3,
      exhaustFlow_kg_h, load, engine.fuelType
    );

    // Instantaneous conversion using real catalyst physics
    const convCO_fresh = predictConversion(
      profile, "CO", catalystTemp, catVolume_L, molarFlowPlaceholder,
      pgmFac, gsaFac, split.factor, isLean, exhaustFlow_kg_h
    );
    const convHC_fresh = predictConversion(
      profile, "HC", catalystTemp, catVolume_L, molarFlowPlaceholder,
      pgmFac, gsaFac, split.factor, isLean, exhaustFlow_kg_h
    );
    const convNOx_fresh = predictConversion(
      profile, "NOx", catalystTemp, catVolume_L, molarFlowPlaceholder,
      pgmFac, gsaFac, split.factor, isLean, exhaustFlow_kg_h
    );

    const convCO_aged = convCO_fresh * agingActivity;
    const convHC_aged = convHC_fresh * agingActivity;
    const convNOx_aged = convNOx_fresh * agingActivity;

    // DPF PM filtration (simplified)
    const convPM = engine.fuelType === "diesel" ? 99.5 * agingActivity : 50 * agingActivity;

    // Tailpipe (aged)
    const tailpipeCO = eo.CO_g_s * (1 - convCO_aged / 100);
    const tailpipeHC = eo.HC_g_s * (1 - convHC_aged / 100);
    const tailpipeNOx = eo.NOx_g_s * (1 - convNOx_aged / 100);
    const tailpipePM = eo.PM_g_s * (1 - convPM / 100);

    // Cumulative
    cumCO += tailpipeCO * dt;
    cumHC += tailpipeHC * dt;
    cumNOx += tailpipeNOx * dt;
    cumPM += tailpipePM * dt;
    cumDistance += (speed / 3600) * dt;

    const dist = Math.max(cumDistance, 0.001);

    // Track light-off
    if (lightOffTime < 0 && convCO_aged > 50) lightOffTime = time;
    if (t50Reached.CO < 0 && convCO_aged > 50) t50Reached.CO = time;
    if (t50Reached.HC < 0 && convHC_aged > 50) t50Reached.HC = time;
    if (t50Reached.NOx < 0 && convNOx_aged > 50) t50Reached.NOx = time;

    steps.push({
      time, speed_kmh: speed, phase: phase || "Unknown", load,
      exhaustFlow_kg_h, exhaustTemp_C: Math.round(exhaustTemp * 10) / 10,
      catalystTemp_C: Math.round(catalystTemp * 10) / 10,
      GHSV_h: Math.round(GHSV),
      engineCO_g_s: eo.CO_g_s, engineHC_g_s: eo.HC_g_s,
      engineNOx_g_s: eo.NOx_g_s, enginePM_g_s: eo.PM_g_s,
      convCO_fresh, convHC_fresh, convNOx_fresh,
      convCO_aged, convHC_aged, convNOx_aged,
      tailpipeCO_g_s: tailpipeCO, tailpipeHC_g_s: tailpipeHC,
      tailpipeNOx_g_s: tailpipeNOx, tailpipePM_g_s: tailpipePM,
      cumDistance_km: cumDistance,
      cumCO_g_km: cumCO / dist,
      cumHC_g_km: cumHC / dist,
      cumNOx_g_km: cumNOx / dist,
      cumPM_g_km: cumPM / dist,
    });
  }

  // Phase breakdown
  const phaseMap = new Map<string, TransientStep[]>();
  for (const s of steps) {
    if (!phaseMap.has(s.phase)) phaseMap.set(s.phase, []);
    phaseMap.get(s.phase)!.push(s);
  }

  const phases: TransientPhaseResult[] = [];
  for (const [phaseName, phaseSteps] of phaseMap) {
    const n = phaseSteps.length;
    const dist = phaseSteps.reduce((a, s) => a + s.speed_kmh / 3600, 0);
    const avgExhT = phaseSteps.reduce((a, s) => a + s.exhaustTemp_C, 0) / n;
    const avgCatT = phaseSteps.reduce((a, s) => a + s.catalystTemp_C, 0) / n;
    const avgConvCO = phaseSteps.reduce((a, s) => a + s.convCO_aged, 0) / n;
    const avgConvHC = phaseSteps.reduce((a, s) => a + s.convHC_aged, 0) / n;
    const avgConvNOx = phaseSteps.reduce((a, s) => a + s.convNOx_aged, 0) / n;
    const totalCO = phaseSteps.reduce((a, s) => a + s.tailpipeCO_g_s, 0);
    const totalHC = phaseSteps.reduce((a, s) => a + s.tailpipeHC_g_s, 0);
    const totalNOx = phaseSteps.reduce((a, s) => a + s.tailpipeNOx_g_s, 0);
    const totalPM = phaseSteps.reduce((a, s) => a + s.tailpipePM_g_s, 0);
    const d = Math.max(dist, 0.001);

    phases.push({
      phase: phaseName, duration_s: n, distance_km: dist,
      avgExhaustTemp_C: avgExhT, avgCatalystTemp_C: avgCatT,
      avgConvCO, avgConvHC, avgConvNOx,
      CO_g_km: totalCO / d, HC_g_km: totalHC / d,
      NOx_g_km: totalNOx / d, PM_g_km: totalPM / d,
    });
  }

  // Homologation verdict
  const finalStep = steps[steps.length - 1];
  const homologation: HomologationVerdict[] = [
    { species: "CO", cumulative_g_km: finalStep.cumCO_g_km, limit_g_km: limits.CO, margin_percent: ((limits.CO - finalStep.cumCO_g_km) / limits.CO) * 100, verdict: "green" },
    { species: "HC", cumulative_g_km: finalStep.cumHC_g_km, limit_g_km: limits.HC, margin_percent: ((limits.HC - finalStep.cumHC_g_km) / limits.HC) * 100, verdict: "green" },
    { species: "NOx", cumulative_g_km: finalStep.cumNOx_g_km, limit_g_km: limits.NOx, margin_percent: ((limits.NOx - finalStep.cumNOx_g_km) / limits.NOx) * 100, verdict: "green" },
    { species: "PM", cumulative_g_km: finalStep.cumPM_g_km, limit_g_km: limits.PM, margin_percent: ((limits.PM - finalStep.cumPM_g_km) / limits.PM) * 100, verdict: "green" },
  ];

  for (const h of homologation) {
    if (h.margin_percent < 0) h.verdict = "red";
    else if (h.margin_percent < 15) h.verdict = "amber";
  }

  const overallVerdict: RAGVerdict = homologation.some((h) => h.verdict === "red")
    ? "red" : homologation.some((h) => h.verdict === "amber") ? "amber" : "green";

  // Cold start penalty (emissions in first 60s vs rest)
  const first60 = steps.filter((s) => s.time <= 60);
  const rest = steps.filter((s) => s.time > 60);
  const coldCO = first60.reduce((a, s) => a + s.tailpipeCO_g_s, 0);
  const restCO = rest.length > 0 ? rest.reduce((a, s) => a + s.tailpipeCO_g_s, 0) : 0;
  const totalCO_all = coldCO + restCO;
  const coldHC = first60.reduce((a, s) => a + s.tailpipeHC_g_s, 0);
  const coldNOx = first60.reduce((a, s) => a + s.tailpipeNOx_g_s, 0);

  return {
    steps,
    phases,
    homologation,
    overallVerdict,
    totalDistance_km: cumDistance,
    totalDuration_s: cycle.length,
    coldStartPenalty_g_km: {
      CO: totalCO_all > 0 ? (coldCO / totalCO_all) * 100 : 0,
      HC: (coldHC + rest.reduce((a, s) => a + s.tailpipeHC_g_s, 0)) > 0 ? (coldHC / (coldHC + rest.reduce((a, s) => a + s.tailpipeHC_g_s, 0))) * 100 : 0,
      NOx: (coldNOx + rest.reduce((a, s) => a + s.tailpipeNOx_g_s, 0)) > 0 ? (coldNOx / (coldNOx + rest.reduce((a, s) => a + s.tailpipeNOx_g_s, 0))) * 100 : 0,
    },
    agingFactor: agingActivity,
    catalystVolume_L: catVolume_L,
    peakGHSV_h: peakGHSV,
    avgGHSV_h: sumGHSV / Math.max(1, steps.length),
    lightOffTime_s: lightOffTime >= 0 ? lightOffTime : 999,
    T50_reached_s: {
      CO: t50Reached.CO >= 0 ? t50Reached.CO : 999,
      HC: t50Reached.HC >= 0 ? t50Reached.HC : 999,
      NOx: t50Reached.NOx >= 0 ? t50Reached.NOx : 999,
    },
  };
}
