/**
 * CFD-lite Urea-Water Droplet Evaporation Engine
 *
 * Implements the d²-law (quasi-steady evaporation) with corrections for:
 * - Convective enhancement (Ranz-Marshall)
 * - Film temperature evaluation for vapor pressure
 * - Stefan flow (Spalding B_M)
 * - Turbulence intensity from mixer
 * - Urea thermolysis and HNCO hydrolysis kinetics
 * - Temperature-dependent thermophysical properties
 *
 * References:
 * - Birkhold et al., SAE 2006-01-0643 (urea-water spray modeling)
 * - Abramzon & Sirignano, Int. J. Heat Mass Transfer 32(9), 1989
 * - Koebel et al., Catal. Today 73, 2002 (urea decomposition kinetics)
 * - Mundo & Sommerfeld, Int. J. Multiphase Flow 21(2), 1995 (wall impingement)
 */

// ─── Thermophysical Properties ──────────────────────────────────────────────

interface FluidProps {
  rho: number;
  mu: number;
  cp: number;
  k: number;
  Dv: number;
  Pr: number;
  Sc: number;
}

function exhaustGasProps(T_K: number): FluidProps {
  const rho = 101325 / (287 * T_K);
  const mu = 1.458e-6 * Math.pow(T_K, 1.5) / (T_K + 110.4);
  const cp = 1005 + 0.1 * (T_K - 300);
  const k = 0.0241 * Math.pow(T_K / 273.15, 0.81);
  const Dv = 2.5e-5 * Math.pow(T_K / 300, 1.75);
  const Pr = mu * cp / k;
  const Sc = mu / (rho * Dv);
  return { rho, mu, cp, k, Dv, Pr, Sc };
}

function ureaWaterProps(T_K: number) {
  const x_urea = 0.325;
  const rho_w = 1000 - 0.15 * (T_K - 293);
  const rho = rho_w * (1 + 0.3 * x_urea);
  const cp = 4186 * (1 - x_urea) + 1550 * x_urea;
  // Watson correlation: latent heat decreases near critical point
  const T_crit = 647;
  const hfg_ref = 2.257e6;
  const hfg_water = hfg_ref * Math.pow(Math.max(0.05, (T_crit - Math.min(T_K, 640)) / (T_crit - 373)), 0.38);
  const hfg = hfg_water * (1 - x_urea) + 1.8e6 * x_urea;
  const T_boil = 373 + 10 * x_urea;
  const sigma = 0.072 * (1 - 0.002 * (T_K - 293));
  return { rho, cp, hfg, T_boil, sigma, x_urea };
}

/**
 * Water vapor pressure via Antoine equation (NIST)
 * Returns P_sat in Pa, input T in K
 */
function waterVaporPressure_Pa(T_K: number): number {
  const T_C = Math.min(T_K - 273.15, 374);
  if (T_C < 1) return 611; // triple point
  // Antoine constants for water, valid 1-100°C
  if (T_C <= 100) {
    const A = 8.07131, B = 1730.63, C = 233.426;
    const logP_mmHg = A - B / (C + T_C);
    return Math.pow(10, logP_mmHg) * 133.322;
  }
  // Above 100°C: Clausius-Clapeyron from 100°C reference
  const P_100 = 101325;
  const hfg = 2.257e6;
  const M_w = 0.018015;
  return P_100 * Math.exp((hfg * M_w / 8.314) * (1 / 373.15 - 1 / T_K));
}

// ─── Rosin-Rammler Droplet Size Distribution ────────────────────────────────

export interface RosinRammlerParams {
  smd_um: number;
  n_spread: number;
}

export function rosinRammlerCDF(d_um: number, params: RosinRammlerParams): number {
  const d_bar = params.smd_um * 1.2;
  return 1 - Math.exp(-Math.pow(d_um / d_bar, params.n_spread));
}

export function sampleRosinRammler(params: RosinRammlerParams, count: number): number[] {
  const sizes: number[] = [];
  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const d_bar = params.smd_um * 1.2;
    const d = d_bar * Math.pow(-Math.log(1 - u), 1 / params.n_spread);
    sizes.push(Math.max(5, Math.min(d, params.smd_um * 3.5)));
  }
  return sizes;
}

// ─── d²-Law Evaporation Model ───────────────────────────────────────────────

export interface EvaporationStep {
  time_ms: number;
  d_um: number;
  d2_ratio: number;
  T_droplet_C: number;
  T_gas_C: number;
  position_mm: number;
  velocity_m_s: number;
  state: "liquid" | "evaporating" | "thermolysis" | "nh3_gas" | "deposit";
  water_fraction: number;
  urea_fraction: number;
  hnco_ppm: number;
  nh3_ppm: number;
  evapRate_kg_s: number;
  Re_droplet: number;
  Nu: number;
  Sh: number;
}

export interface EvaporationProfile {
  steps: EvaporationStep[];
  totalTime_ms: number;
  evapComplete_pct: number;
  d2_slope: number;
  wallImpingement: boolean;
  depositRisk: "none" | "low" | "moderate" | "high";
  nh3_yield_pct: number;
  hnco_slip_ppm: number;
  residenceTime_ms: number;
}

export interface EvaporationInputs {
  d0_um: number;
  T_gas_C: number;
  T_droplet_init_C: number;
  v_gas_m_s: number;
  v_droplet_init_m_s: number;
  pipe_diameter_mm: number;
  injector_to_scr_mm: number;
  mixerType: "none" | "blade" | "swirl" | "tab";
  pressure_kPa: number;
}

export function computeEvaporationProfile(inputs: EvaporationInputs): EvaporationProfile {
  const dt_ms = 0.05; // fine timestep for smooth charts
  const maxTime_ms = 200;
  const steps: EvaporationStep[] = [];
  let stepCounter = 0;
  const recordInterval = 5; // record every 5th step (0.25 ms resolution)

  // Mixer secondary breakup — applied to effective initial diameter
  const breakupFactor = inputs.mixerType === "blade" ? 0.65
    : inputs.mixerType === "swirl" ? 0.80
    : inputs.mixerType === "tab" ? 0.75 : 1.0;

  const d0_eff = inputs.d0_um * breakupFactor;
  let d = d0_eff;
  let T_d = inputs.T_droplet_init_C + 273.15;
  let T_g = inputs.T_gas_C + 273.15;
  let v_d = inputs.v_droplet_init_m_s;
  const v_g = inputs.v_gas_m_s;
  let x_mm = 0;
  let water_frac = 1 - 0.325;
  let urea_frac = 0.325;
  let nh3_cumul = 0;
  let hnco_cumul = 0;
  let wallHit = false;

  const pipeR_mm = inputs.pipe_diameter_mm / 2;

  // Mixer turbulence intensity
  const turbIntensity = inputs.mixerType === "swirl" ? 0.25
    : inputs.mixerType === "blade" ? 0.18
    : inputs.mixerType === "tab" ? 0.15 : 0.05;

  const mixerPos_mm = inputs.injector_to_scr_mm * 0.35;

  for (let t = 0; t <= maxTime_ms; t += dt_ms) {
    if (d < 1) break;

    const dt_s = dt_ms / 1000;
    const d_m = d * 1e-6;

    // Film temperature (1/3 rule) — but clamp to avoid extreme vapor pressures
    const T_film = T_d + (T_g - T_d) * 0.33;
    const gas_film = exhaustGasProps(T_film);
    const gas_inf = exhaustGasProps(T_g);
    const liq = ureaWaterProps(T_d);

    // Relative velocity with turbulent fluctuation
    const v_rel_mean = Math.abs(v_g - v_d);
    const v_turb = v_g * turbIntensity * (x_mm > mixerPos_mm ? 1.0 : 0.3);
    const v_rel = Math.sqrt(v_rel_mean * v_rel_mean + v_turb * v_turb);

    // Droplet Reynolds number
    const Re_d = Math.max(0.01, gas_inf.rho * v_rel * d_m / gas_film.mu);

    // Ranz-Marshall correlations
    const Nu_0 = 2 + 0.6 * Math.pow(Re_d, 0.5) * Math.pow(gas_film.Pr, 0.333);
    const Sh_0 = 2 + 0.6 * Math.pow(Re_d, 0.5) * Math.pow(gas_film.Sc, 0.333);

    // Vapor pressure at DROPLET surface temperature (not film T)
    // Using droplet T is physically correct — the vapor is at the droplet surface
    const P_vap = waterVaporPressure_Pa(T_d);
    const P_total = inputs.pressure_kPa * 1000;
    const Y_s = Math.min(0.95, (P_vap / P_total) * (18.015 / 28.97));
    const Y_inf = 0.03;
    const B_M = Math.max(0.001, (Y_s - Y_inf) / Math.max(0.05, 1 - Y_s));

    // Abramzon-Sirignano blowing correction
    const F_M = B_M > 0.01
      ? Math.pow(1 + B_M, 0.7) * Math.log(1 + B_M) / B_M
      : 1.0;
    const Sh_star = 2 + (Sh_0 - 2) / Math.max(0.1, F_M);

    // Evaporation constant K [m²/s]
    const K = (4 * gas_inf.rho * gas_film.Dv * Sh_star * Math.log(1 + B_M)) / liq.rho;

    // d² decrease
    const d2_old = d_m * d_m;
    const d2_new = Math.max(0, d2_old - K * dt_s);
    const d_new_m = Math.sqrt(d2_new);

    // Mass evaporated
    const m_old = (Math.PI / 6) * liq.rho * Math.pow(d_m, 3);
    const m_new = (Math.PI / 6) * liq.rho * Math.pow(d_new_m, 3);
    const dm = Math.max(0, m_old - m_new);
    const evapRate = dm / dt_s;

    // Water evaporates first
    if (water_frac > 0.005) {
      const dw = dm / (m_old + 1e-30) * water_frac;
      water_frac = Math.max(0, water_frac - dw);
    }

    // Urea thermolysis: (NH₂)₂CO → NH₃ + HNCO (onset ~133°C / 406K)
    let state: EvaporationStep["state"] = "liquid";
    if (T_d > 353) state = "evaporating";

    if (water_frac < 0.15 && T_d > 406) {
      state = "thermolysis";
      const k_therm = 4.9e3 * Math.exp(-6200 / T_d);
      const urea_decomp = urea_frac * (1 - Math.exp(-k_therm * dt_s));
      urea_frac = Math.max(0, urea_frac - urea_decomp);
      nh3_cumul += urea_decomp * 0.283;
      hnco_cumul += urea_decomp * 0.717;
    }

    // HNCO hydrolysis (mixer surfaces act as catalyst)
    if (hnco_cumul > 0 && T_d > 423) {
      const surfaceFactor = inputs.mixerType !== "none" ? 3.0 : 1.0;
      const k_hydro = 2.5e5 * surfaceFactor * Math.exp(-8500 / T_g);
      const hnco_conv = hnco_cumul * (1 - Math.exp(-k_hydro * dt_s));
      hnco_cumul = Math.max(0, hnco_cumul - hnco_conv);
      nh3_cumul += hnco_conv * 0.395;
    }

    if (d_new_m < 3e-6 && urea_frac < 0.03) {
      state = "nh3_gas";
    }

    // Droplet heating — energy balance with Spalding B_T correction
    const B_T = Math.max(0, gas_inf.cp * (T_g - T_d) / (liq.hfg + 1e-10));
    const F_T = B_T > 0.01
      ? Math.pow(1 + B_T, 0.7) * Math.log(1 + B_T) / B_T
      : 1.0;
    const Nu_star = 2 + (Nu_0 - 2) / Math.max(0.1, F_T);
    const Q_conv = Nu_star * gas_film.k * Math.PI * d_m * (T_g - T_d);
    const Q_evap = dm * liq.hfg;
    const m_thermal = m_new * liq.cp;
    if (m_thermal > 1e-20) {
      const dT = (Q_conv - Q_evap) / m_thermal;
      T_d += dT * dt_s;
    }
    T_d = Math.min(T_d, T_g);
    T_d = Math.max(T_d, inputs.T_droplet_init_C + 273.15);

    // Drag (Schiller-Naumann)
    const Cd = Re_d > 0.01 ? (24 / Re_d) * (1 + 0.15 * Math.pow(Re_d, 0.687)) : 2400;
    const F_drag = 0.5 * Cd * gas_inf.rho * Math.PI * Math.pow(d_m / 2, 2) * v_rel * v_rel;
    const a_drag = F_drag / (m_new + 1e-20);
    if (v_d > v_g) {
      v_d -= a_drag * dt_s;
    } else {
      v_d += a_drag * dt_s * 0.3;
    }
    v_d = Math.max(0.05, v_d);

    // Position update
    x_mm += v_d * dt_s * 1000;

    // Wall impingement check
    const radialDrift_mm = x_mm * Math.tan((15 * Math.PI) / 180);
    if (radialDrift_mm > pipeR_mm * 0.85 && T_d < 473) {
      wallHit = true;
      if (T_d < 433) state = "deposit";
    }

    // Gas T decreases along pipe
    T_g = (inputs.T_gas_C + 273.15) - 0.015 * x_mm;

    d = d_new_m * 1e6;

    stepCounter++;
    if (stepCounter % recordInterval === 0 || d < 1 || t === 0) {
      steps.push({
        time_ms: t,
        d_um: d,
        d2_ratio: Math.pow(d / d0_eff, 2),
        T_droplet_C: T_d - 273.15,
        T_gas_C: T_g - 273.15,
        position_mm: x_mm,
        velocity_m_s: v_d,
        state,
        water_fraction: water_frac,
        urea_fraction: urea_frac,
        hnco_ppm: hnco_cumul * 1e6,
        nh3_ppm: nh3_cumul * 1e6,
        evapRate_kg_s: evapRate,
        Re_droplet: Re_d,
        Nu: Nu_star,
        Sh: Sh_star,
      });
    }

    if (x_mm > inputs.injector_to_scr_mm) break;
  }

  // d²-law slope (linear regression)
  const n = steps.length;
  let sumT = 0, sumD2 = 0, sumTD2 = 0, sumT2 = 0;
  for (const s of steps) {
    sumT += s.time_ms;
    sumD2 += s.d2_ratio;
    sumTD2 += s.time_ms * s.d2_ratio;
    sumT2 += s.time_ms * s.time_ms;
  }
  const d2_slope = n > 1 ? (n * sumTD2 - sumT * sumD2) / (n * sumT2 - sumT * sumT) : 0;

  const lastStep = steps[steps.length - 1];
  const evapComplete = lastStep ? (1 - lastStep.d2_ratio) * 100 : 0;

  let depositRisk: EvaporationProfile["depositRisk"] = "none";
  if (wallHit && inputs.T_gas_C < 200) depositRisk = "high";
  else if (wallHit && inputs.T_gas_C < 250) depositRisk = "moderate";
  else if (wallHit) depositRisk = "low";

  return {
    steps,
    totalTime_ms: lastStep?.time_ms ?? 0,
    evapComplete_pct: Math.min(100, evapComplete),
    d2_slope: d2_slope * d0_eff * d0_eff,
    wallImpingement: wallHit,
    depositRisk,
    nh3_yield_pct: nh3_cumul * 100 / 0.325,
    hnco_slip_ppm: lastStep?.hnco_ppm ?? 0,
    residenceTime_ms: lastStep?.time_ms ?? 0,
  };
}

// ─── Multi-Droplet Ensemble ─────────────────────────────────────────────────

export interface EnsembleResult {
  profiles: EvaporationProfile[];
  meanD2Slope: number;
  meanEvapTime_ms: number;
  overallEvapPct: number;
  sizeDistribution: { d_um: number; count: number }[];
  d2_vs_time: { time_ms: number; mean_d2: number; min_d2: number; max_d2: number }[];
}

export function computeEnsembleEvaporation(
  baseInputs: Omit<EvaporationInputs, "d0_um">,
  rrParams: RosinRammlerParams,
  nDroplets: number = 20,
): EnsembleResult {
  const sizes = sampleRosinRammler(rrParams, nDroplets);
  const profiles = sizes.map((d0) =>
    computeEvaporationProfile({ ...baseInputs, d0_um: d0 })
  );

  const meanSlope = profiles.reduce((s, p) => s + p.d2_slope, 0) / nDroplets;
  const meanTime = profiles.reduce((s, p) => s + p.totalTime_ms, 0) / nDroplets;
  const meanEvap = profiles.reduce((s, p) => s + p.evapComplete_pct, 0) / nDroplets;

  const bins = [5, 10, 20, 30, 40, 50, 60, 80, 100, 120];
  const sizeDistribution = bins.map((d) => ({
    d_um: d,
    count: sizes.filter((s) => s >= d - 5 && s < d + 5).length,
  }));

  const maxTime = Math.max(...profiles.map((p) => p.totalTime_ms));
  const d2_vs_time: EnsembleResult["d2_vs_time"] = [];
  const timeStep = Math.max(0.1, maxTime / 80); // ~80 points for smooth charts
  for (let t = 0; t <= maxTime; t += timeStep) {
    const d2Values = profiles
      .map((p) => {
        const step = p.steps.find((s) => Math.abs(s.time_ms - t) < timeStep);
        return step?.d2_ratio;
      })
      .filter((v): v is number => v !== undefined);

    if (d2Values.length > 0) {
      d2_vs_time.push({
        time_ms: t,
        mean_d2: d2Values.reduce((a, b) => a + b, 0) / d2Values.length,
        min_d2: Math.min(...d2Values),
        max_d2: Math.max(...d2Values),
      });
    }
  }

  return { profiles, meanD2Slope: meanSlope, meanEvapTime_ms: meanTime, overallEvapPct: meanEvap, sizeDistribution, d2_vs_time };
}
