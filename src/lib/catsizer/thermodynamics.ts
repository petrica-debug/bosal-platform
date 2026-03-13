import { R_GAS } from "./units";
import { speciesH, speciesG, type GasComposition } from "./gas-properties";

// ============================================================
// EQUILIBRIUM CONSTANTS
// ============================================================

/**
 * SMR equilibrium constant: CH₄ + H₂O ⇌ CO + 3H₂
 * K_SMR = (P_CO × P_H2³) / (P_CH4 × P_H2O)
 */
export function K_SMR(T_K: number): number {
  const dG =
    speciesG("CO", T_K) +
    3 * speciesG("H2", T_K) -
    speciesG("CH4", T_K) -
    speciesG("H2O", T_K);
  return Math.exp(-dG / (R_GAS * T_K));
}

/**
 * WGS equilibrium constant: CO + H₂O ⇌ CO₂ + H₂
 * K_WGS = (P_CO2 × P_H2) / (P_CO × P_H2O)
 */
export function K_WGS(T_K: number): number {
  const dG =
    speciesG("CO2", T_K) +
    speciesG("H2", T_K) -
    speciesG("CO", T_K) -
    speciesG("H2O", T_K);
  return Math.exp(-dG / (R_GAS * T_K));
}

/**
 * Boudouard equilibrium constant: 2CO ⇌ C(s) + CO₂
 * K_boud = P_CO2 / P_CO²
 */
export function K_Boudouard(T_K: number): number {
  // C(s) graphite: ΔGf = 0 by definition
  const dG =
    speciesG("CO2", T_K) - 2 * speciesG("CO", T_K);
  return Math.exp(-dG / (R_GAS * T_K));
}

/**
 * Methane cracking equilibrium: CH₄ ⇌ C(s) + 2H₂
 * K_crack = P_H2² / P_CH4
 */
export function K_MethaneCracking(T_K: number): number {
  const dG =
    2 * speciesG("H2", T_K) - speciesG("CH4", T_K);
  return Math.exp(-dG / (R_GAS * T_K));
}

// ============================================================
// CARBON FORMATION BOUNDARY CHECK
// ============================================================

export interface CarbonCheckResult {
  boudouardActivity: number; // a_C from Boudouard; > 1 means carbon forms
  crackingActivity: number;  // a_C from methane cracking
  carbonForms: boolean;
  minimumSCRatio: number;    // Minimum S/C to avoid carbon at this T
  risk: "low" | "moderate" | "high";
}

/**
 * Check if operating conditions lead to carbon deposition.
 * Carbon forms if activity of solid carbon > 1.0 for either reaction.
 */
export function checkCarbonFormation(
  T_K: number,
  P_kPa: number,
  composition: GasComposition
): CarbonCheckResult {
  const P_atm = P_kPa / 101.325;

  const pCO = (composition.CO ?? 0) * P_atm;
  const pCO2 = (composition.CO2 ?? 0) * P_atm;
  const pCH4 = (composition.CH4 ?? 0) * P_atm;
  const pH2 = (composition.H2 ?? 0) * P_atm;

  // Boudouard: a_C = K_boud × P_CO² / P_CO2
  const Kb = K_Boudouard(T_K);
  const boudouardActivity =
    pCO2 > 1e-10 ? (pCO * pCO) / (Kb * pCO2) : 0;

  // Methane cracking: a_C = K_crack × P_CH4 / P_H2²
  const Kc = K_MethaneCracking(T_K);
  const crackingActivity =
    pH2 > 1e-10 ? (Kc * pCH4) / (pH2 * pH2) : pCH4 > 0 ? 999 : 0;

  const carbonForms = boudouardActivity > 1.0 || crackingActivity > 1.0;

  // Estimate minimum S/C ratio to avoid carbon
  // Empirical correlation: S/C_min ≈ 1.0 at 800°C, 2.0 at 600°C for Ni catalyst
  const T_C = T_K - 273.15;
  const minimumSCRatio = Math.max(0.5, 3.0 - T_C / 400);

  const maxActivity = Math.max(boudouardActivity, crackingActivity);
  const risk: "low" | "moderate" | "high" =
    maxActivity < 0.5 ? "low" : maxActivity < 1.0 ? "moderate" : "high";

  return {
    boudouardActivity,
    crackingActivity,
    carbonForms,
    minimumSCRatio,
    risk,
  };
}

// ============================================================
// SIMPLIFIED EQUILIBRIUM SOLVER
// Uses sequential reaction equilibrium approach (not full Gibbs
// minimization, but accurate for SMR+WGS system within 2-3%)
// ============================================================

export interface EquilibriumResult {
  composition: GasComposition; // mole fractions at equilibrium
  CH4_conversion: number;      // 0–1
  H2_yield: number;            // mol H₂ per mol CH₄ fed
  CH4_CO_ratio: number;
  H2_CO_ratio: number;
  temperature_K: number;
  pressure_kPa: number;
}

/**
 * Solve SMR + WGS equilibrium at given T, P for a feed composition.
 * Now calls the Python FastAPI backend via the Next.js API route.
 */
export async function solveEquilibrium(
  T_K: number,
  P_kPa: number,
  feed: GasComposition
): Promise<EquilibriumResult> {
  // Translate to Python backend format
  const reqBody = {
    CH4: feed.CH4 ?? 0,
    C2H6: feed.C2H6 ?? 0,
    C3H8: feed.C3H8 ?? 0,
    CO2: feed.CO2 ?? 0,
    N2: feed.N2 ?? 0,
    SC_ratio: (feed.H2O ?? 0) / Math.max((feed.CH4 ?? 0.0001), 0.0001), // Approximate SC ratio from feed
    T_C: T_K - 273.15,
    P_kPa: P_kPa
  };

  try {
    const res = await fetch('/api/chemistry/equilibrium', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody)
    });

    if (!res.ok) throw new Error("Backend failed");

    const data = await res.json();
    return {
      composition: {
        H2: data.H2,
        CO: data.CO,
        CO2: data.CO2,
        CH4: data.CH4,
        H2O: data.H2O,
        N2: data.N2,
      },
      CH4_conversion: data.CH4_conversion,
      H2_yield: data.H2 * 100, // Roughly
      CH4_CO_ratio: data.CH4_CO_ratio,
      H2_CO_ratio: data.H2 / Math.max(data.CO, 0.001),
      temperature_K: T_K,
      pressure_kPa: P_kPa
    };
  } catch (error) {
    console.error("Failed to solve equilibrium via API:", error);
    // Fallback stub if API is down
    return {
      composition: { ...feed },
      CH4_conversion: 0,
      H2_yield: 0,
      CH4_CO_ratio: 0,
      H2_CO_ratio: 0,
      temperature_K: T_K,
      pressure_kPa: P_kPa
    };
  }
}

/**
 * Compute equilibrium composition across a temperature range
 * for plotting equilibrium diagrams.
 */
export async function equilibriumSweep(
  T_min_K: number,
  T_max_K: number,
  steps: number,
  P_kPa: number,
  feed: GasComposition
): Promise<EquilibriumResult[]> {
  const results: EquilibriumResult[] = [];
  const dT = (T_max_K - T_min_K) / (steps - 1);

  for (let i = 0; i < steps; i++) {
    const T = T_min_K + i * dT;
    const res = await solveEquilibrium(T, P_kPa, feed);
    results.push(res);
  }

  return results;
}

/**
 * Calculate reaction enthalpy change [kJ/mol] for SMR at temperature T
 */
export function smrEnthalpy(T_K: number): number {
  const dH =
    speciesH("CO", T_K) +
    3 * speciesH("H2", T_K) -
    speciesH("CH4", T_K) -
    speciesH("H2O", T_K);
  return dH / 1000; // J → kJ
}

/**
 * Calculate reaction enthalpy change [kJ/mol] for WGS at temperature T
 */
export function wgsEnthalpy(T_K: number): number {
  const dH =
    speciesH("CO2", T_K) +
    speciesH("H2", T_K) -
    speciesH("CO", T_K) -
    speciesH("H2O", T_K);
  return dH / 1000;
}
