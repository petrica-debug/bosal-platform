/**
 * CFD-lite Urea-Water Droplet Evaporation Engine
 *
 * Implements the d²-law (quasi-steady evaporation) with corrections for:
 * - Convective enhancement (Ranz-Marshall)
 * - Stefan flow (blowing factor)
 * - Urea thermolysis and HNCO hydrolysis kinetics
 * - Temperature-dependent thermophysical properties
 *
 * References:
 * - Birkhold et al., SAE 2006-01-0643 (urea-water spray modeling)
 * - Abramzon & Sirignano, Int. J. Heat Mass Transfer 32(9), 1989 (droplet evaporation)
 * - Koebel et al., Catal. Today 73, 2002 (urea decomposition kinetics)
 */

// ─── Thermophysical Properties ──────────────────────────────────────────────

const R_GAS = 8.314; // J/(mol·K)

interface FluidProps {
  rho: number;       // density [kg/m³]
  mu: number;        // dynamic viscosity [Pa·s]
  cp: number;        // specific heat [J/(kg·K)]
  k: number;         // thermal conductivity [W/(m·K)]
  Dv: number;        // vapor diffusivity in air [m²/s]
  Pr: number;        // Prandtl number
  Sc: number;        // Schmidt number
}

function exhaustGasProps(T_K: number): FluidProps {
  const rho = 101325 / (287 * T_K);
  const mu = 1.458e-6 * T_K ** 1.5 / (T_K + 110.4); // Sutherland
  const cp = 1005 + 0.1 * (T_K - 300);
  const k = 0.0241 * (T_K / 273.15) ** 0.81;
  const Dv = 2.5e-5 * (T_K / 300) ** 1.75;
  const Pr = mu * cp / k;
  const Sc = mu / (rho * Dv);
  return { rho, mu, cp, k, Dv, Pr, Sc };
}

function ureaWaterProps(T_K: number) {
  const x_urea = 0.325; // 32.5% urea (AdBlue)
  const rho_w = 1000 - 0.1 * (T_K - 293);
  const rho = rho_w * (1 + 0.3 * x_urea);
  const cp = 4186 * (1 - x_urea) + 1550 * x_urea;
  const hfg = 2.257e6 * (1 - x_urea) + 1.8e6 * x_urea; // latent heat [J/kg]
  const T_boil = 373 + 10 * x_urea; // elevated boiling point [K]
  const sigma = 0.072 * (1 - 0.002 * (T_K - 293)); // surface tension [N/m]
  return { rho, cp, hfg, T_boil, sigma, x_urea };
}

// ─── Rosin-Rammler Droplet Size Distribution ────────────────────────────────

export interface RosinRammlerParams {
  smd_um: number;    // Sauter mean diameter [µm]
  n_spread: number;  // spread parameter (typically 2-4)
}

export function rosinRammlerCDF(d_um: number, params: RosinRammlerParams): number {
  const d_bar = params.smd_um * 1.2; // characteristic diameter
  return 1 - Math.exp(-Math.pow(d_um / d_bar, params.n_spread));
}

export function sampleRosinRammler(params: RosinRammlerParams, count: number): number[] {
  const sizes: number[] = [];
  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const d_bar = params.smd_um * 1.2;
    const d = d_bar * Math.pow(-Math.log(1 - u), 1 / params.n_spread);
    sizes.push(Math.max(5, Math.min(d, params.smd_um * 4)));
  }
  return sizes;
}

// ─── d²-Law Evaporation Model ───────────────────────────────────────────────

export interface EvaporationStep {
  time_ms: number;
  d_um: number;             // current diameter [µm]
  d2_ratio: number;         // (d/d0)² — should decrease linearly for d²-law
  T_droplet_C: number;      // droplet temperature [°C]
  T_gas_C: number;          // local gas temperature [°C]
  position_mm: number;      // axial position from injector [mm]
  velocity_m_s: number;     // droplet velocity [m/s]
  state: "liquid" | "evaporating" | "thermolysis" | "nh3_gas" | "deposit";
  water_fraction: number;   // remaining water fraction [0-1]
  urea_fraction: number;    // remaining urea fraction [0-1]
  hnco_ppm: number;         // HNCO concentration [ppm]
  nh3_ppm: number;          // NH₃ concentration [ppm]
  evapRate_kg_s: number;    // instantaneous evaporation rate [kg/s]
  Re_droplet: number;       // droplet Reynolds number
  Nu: number;               // Nusselt number (Ranz-Marshall)
  Sh: number;               // Sherwood number
}

export interface EvaporationProfile {
  steps: EvaporationStep[];
  totalTime_ms: number;
  evapComplete_pct: number;
  d2_slope: number;         // d²-law slope [µm²/ms] — the evaporation constant K
  wallImpingement: boolean;
  depositRisk: "none" | "low" | "moderate" | "high";
  nh3_yield_pct: number;
  hnco_slip_ppm: number;
  residenceTime_ms: number;
}

export interface EvaporationInputs {
  d0_um: number;            // initial droplet diameter [µm]
  T_gas_C: number;          // exhaust gas temperature [°C]
  T_droplet_init_C: number; // initial droplet temperature [°C]
  v_gas_m_s: number;        // gas velocity [m/s]
  v_droplet_init_m_s: number; // initial droplet velocity [m/s]
  pipe_diameter_mm: number;
  injector_to_scr_mm: number;
  mixerType: "none" | "blade" | "swirl" | "tab";
  pressure_kPa: number;
}

export function computeEvaporationProfile(inputs: EvaporationInputs): EvaporationProfile {
  const dt_ms = 0.5; // time step [ms]
  const maxTime_ms = 200; // max simulation time
  const steps: EvaporationStep[] = [];

  let d = inputs.d0_um; // current diameter [µm]
  const d0 = inputs.d0_um;
  let T_d = inputs.T_droplet_init_C + 273.15; // droplet T [K]
  let T_g = inputs.T_gas_C + 273.15; // gas T [K]
  let v_d = inputs.v_droplet_init_m_s;
  let v_g = inputs.v_gas_m_s;
  let x_mm = 0; // axial position [mm]
  let water_frac = 1 - 0.325; // water fraction (AdBlue = 67.5% water)
  let urea_frac = 0.325;
  let nh3_cumul = 0;
  let hnco_cumul = 0;
  let wallHit = false;

  const pipeR_mm = inputs.pipe_diameter_mm / 2;

  // Mixer effects on gas velocity profile
  const mixerFactor = inputs.mixerType === "swirl" ? 1.3
    : inputs.mixerType === "blade" ? 1.1
    : inputs.mixerType === "tab" ? 1.15 : 1.0;

  // Mixer position (typically 30-40% of distance)
  const mixerPos_mm = inputs.injector_to_scr_mm * 0.35;

  for (let t = 0; t <= maxTime_ms; t += dt_ms) {
    if (d < 1) break; // fully evaporated

    const dt_s = dt_ms / 1000;
    const d_m = d * 1e-6;
    const gas = exhaustGasProps(T_g);
    const liq = ureaWaterProps(T_d);

    // Relative velocity
    const v_rel = Math.abs(v_g * mixerFactor - v_d);

    // Droplet Reynolds number
    const Re_d = gas.rho * v_rel * d_m / gas.mu;

    // Ranz-Marshall correlations
    const Nu = 2 + 0.6 * Re_d ** 0.5 * gas.Pr ** 0.333;
    const Sh = 2 + 0.6 * Re_d ** 0.5 * gas.Sc ** 0.333;

    // Spalding mass transfer number
    const Y_s = Math.min(0.95, Math.exp(17.44 - 5330 / T_d) / (inputs.pressure_kPa * 1000 / 101325));
    const B_M = Math.max(0, Y_s / (1 - Y_s));

    // Evaporation rate (d²-law with convective correction)
    const K = (8 * gas.k * Math.log(1 + B_M)) / (liq.rho * liq.cp);
    const K_conv = K * (Nu / 2); // convective enhancement

    // d² decrease
    const d2_old = d_m * d_m;
    const d2_new = Math.max(0, d2_old - K_conv * dt_s);
    const d_new_m = Math.sqrt(d2_new);

    // Mass evaporated this step
    const m_old = (Math.PI / 6) * liq.rho * d_m ** 3;
    const m_new = (Math.PI / 6) * liq.rho * d_new_m ** 3;
    const dm = m_old - m_new;
    const evapRate = dm / dt_s;

    // Water evaporates first, then urea decomposes
    if (water_frac > 0.01) {
      water_frac -= dm / m_old * water_frac;
      water_frac = Math.max(0, water_frac);
    }

    // Urea thermolysis: (NH₂)₂CO → NH₃ + HNCO (T > 133°C / 406K)
    let state: EvaporationStep["state"] = "liquid";
    if (T_d > 373) {
      state = "evaporating";
    }

    if (water_frac < 0.1 && T_d > 406) {
      state = "thermolysis";
      const k_therm = 4.9e3 * Math.exp(-6200 / T_d); // Koebel 2002
      const urea_decomp = urea_frac * (1 - Math.exp(-k_therm * dt_s));
      urea_frac -= urea_decomp;
      nh3_cumul += urea_decomp * 0.283; // stoichiometric NH₃ yield
      hnco_cumul += urea_decomp * 0.717; // HNCO intermediate
    }

    // HNCO hydrolysis: HNCO + H₂O → NH₃ + CO₂ (catalyzed by surfaces)
    if (hnco_cumul > 0 && T_d > 473) {
      const k_hydro = 2.5e5 * Math.exp(-8500 / T_g); // Koebel 2002
      const hnco_conv = hnco_cumul * (1 - Math.exp(-k_hydro * dt_s));
      hnco_cumul -= hnco_conv;
      nh3_cumul += hnco_conv * 0.395; // stoichiometric
    }

    if (d_new_m < 5e-6 && urea_frac < 0.05) {
      state = "nh3_gas";
    }

    // Droplet heating (energy balance)
    const Q_conv = Nu * gas.k * Math.PI * d_m * (T_g - T_d);
    const Q_evap = dm * liq.hfg;
    const dT = (Q_conv - Q_evap) / (m_new * liq.cp + 1e-20);
    T_d += dT * dt_s;
    T_d = Math.min(T_d, T_g); // can't exceed gas T

    // Droplet drag (Stokes + correction)
    const Cd = Re_d > 0 ? (24 / Re_d) * (1 + 0.15 * Re_d ** 0.687) : 24;
    const F_drag = 0.5 * Cd * gas.rho * Math.PI * (d_m / 2) ** 2 * v_rel ** 2;
    const a_drag = F_drag / (m_new + 1e-20);
    if (v_d > v_g) {
      v_d -= a_drag * dt_s;
    } else {
      v_d += a_drag * dt_s * 0.5;
    }
    v_d = Math.max(0.1, v_d);

    // Position update
    x_mm += v_d * dt_s * 1000;

    // Wall impingement check
    if (x_mm > pipeR_mm * 0.9 * Math.tan(30 * Math.PI / 180) && T_d < 473) {
      wallHit = true;
      if (T_d < 433) state = "deposit";
    }

    // Gas temperature decreases slightly along pipe (heat loss)
    T_g = (inputs.T_gas_C + 273.15) - 0.02 * x_mm;

    d = d_new_m * 1e6; // back to µm

    steps.push({
      time_ms: t,
      d_um: d,
      d2_ratio: (d / d0) ** 2,
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
      Nu,
      Sh,
    });

    if (x_mm > inputs.injector_to_scr_mm) break;
  }

  // Compute d²-law slope (linear regression on d² vs time)
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
    d2_slope: d2_slope * d0 * d0, // absolute slope [µm²/ms]
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

  // Build size distribution histogram
  const bins = [10, 20, 40, 60, 80, 100, 150, 200, 300];
  const sizeDistribution = bins.map((d) => ({
    d_um: d,
    count: sizes.filter((s) => s >= d - 10 && s < d + 10).length,
  }));

  // Build ensemble d² vs time
  const maxTime = Math.max(...profiles.map((p) => p.totalTime_ms));
  const d2_vs_time: EnsembleResult["d2_vs_time"] = [];
  for (let t = 0; t <= maxTime; t += 1) {
    const d2Values = profiles
      .map((p) => {
        const step = p.steps.find((s) => Math.abs(s.time_ms - t) < 0.6);
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
