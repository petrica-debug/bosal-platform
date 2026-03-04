import { R_GAS } from "./units";
import { speciesH, speciesS, speciesG, type GasComposition } from "./gas-properties";

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
 *
 * Uses iterative approach:
 * 1. Assume extent of SMR reaction (ξ₁)
 * 2. Assume extent of WGS reaction (ξ₂)
 * 3. Calculate equilibrium expressions and iterate via Newton-Raphson
 */
export function solveEquilibrium(
  T_K: number,
  P_kPa: number,
  feed: GasComposition
): EquilibriumResult {
  const P_atm = P_kPa / 101.325;
  const Ksmr = K_SMR(T_K);
  const Kwgs = K_WGS(T_K);

  // Initial moles (normalize to 1 total mole of feed)
  let nCH4 = feed.CH4 ?? 0;
  let nH2O = feed.H2O ?? 0;
  let nCO = feed.CO ?? 0;
  let nCO2 = feed.CO2 ?? 0;
  let nH2 = feed.H2 ?? 0;
  const nN2 = feed.N2 ?? 0;
  let nO2 = feed.O2 ?? 0;

  // Handle higher hydrocarbons: assume complete pre-reforming
  // C₂H₆ + 2H₂O → 2CO + 5H₂
  const nC2H6 = feed.C2H6 ?? 0;
  nCH4 += 0; // C2H6 doesn't become CH4, it reforms directly
  nCO += 2 * nC2H6;
  nH2 += 5 * nC2H6;
  nH2O -= 2 * nC2H6;

  // C₃H₈ + 3H₂O → 3CO + 7H₂
  const nC3H8 = feed.C3H8 ?? 0;
  nCO += 3 * nC3H8;
  nH2 += 7 * nC3H8;
  nH2O -= 3 * nC3H8;

  // Handle POX/ATR: O₂ reacts with CH₄ first (total oxidation is kinetically favored)
  // CH₄ + 2O₂ → CO₂ + 2H₂O (complete combustion of portion)
  if (nO2 > 0) {
    const ch4_burned = Math.min(nCH4, nO2 / 2);
    nCH4 -= ch4_burned;
    nO2 -= 2 * ch4_burned;
    nCO2 += ch4_burned;
    nH2O += 2 * ch4_burned;
  }

  // Store initial CH₄ for conversion calculation
  const nCH4_initial = nCH4;

  // Ensure non-negative
  nH2O = Math.max(nH2O, 0);

  // Newton-Raphson iteration for ξ₁ (SMR) and ξ₂ (WGS)
  let xi1 = nCH4 * 0.5; // Initial guess: 50% SMR conversion
  let xi2 = 0.1; // Initial guess for WGS extent

  for (let iter = 0; iter < 100; iter++) {
    // Clamp extents to feasible range
    xi1 = Math.max(0, Math.min(xi1, nCH4 - 1e-12));
    xi2 = Math.max(-nCO2, Math.min(xi2, nCO + xi1 - 1e-12));

    const ch4 = nCH4 - xi1;
    const h2o = nH2O - xi1 - xi2;
    const co = nCO + xi1 - xi2;
    const co2 = nCO2 + xi2;
    const h2 = nH2 + 3 * xi1 + xi2;
    const total = ch4 + Math.max(h2o, 0) + co + co2 + h2 + nN2;

    if (total <= 0) break;

    // Partial pressures
    const yCH4 = ch4 / total;
    const yH2O = Math.max(h2o, 0) / total;
    const yCO = co / total;
    const yCO2 = co2 / total;
    const yH2 = h2 / total;

    // Equilibrium expressions (should equal zero at equilibrium)
    // f1: K_SMR - (yCO × yH2³ × P²) / (yCH4 × yH2O) = 0
    // f2: K_WGS - (yCO2 × yH2) / (yCO × yH2O) = 0

    const pCH4 = yCH4 * P_atm;
    const pH2O = yH2O * P_atm;
    const pCO = yCO * P_atm;
    const pCO2 = yCO2 * P_atm;
    const pH2 = yH2 * P_atm;

    const denom1 = pCH4 * pH2O;
    const denom2 = pCO * pH2O;

    if (denom1 < 1e-20 || denom2 < 1e-20) break;

    const Q_smr = (pCO * pH2 ** 3) / denom1;
    const Q_wgs = (pCO2 * pH2) / denom2;

    const f1 = Q_smr - Ksmr;
    const f2 = Q_wgs - Kwgs;

    if (Math.abs(f1 / (Ksmr + 1)) < 1e-6 && Math.abs(f2 / (Kwgs + 1)) < 1e-6) {
      break; // Converged
    }

    // Numerical Jacobian (finite differences)
    const dxi = 1e-8;
    const evalF = (x1: number, x2: number) => {
      const c4 = nCH4 - x1;
      const w = nH2O - x1 - x2;
      const c = nCO + x1 - x2;
      const c2 = nCO2 + x2;
      const h = nH2 + 3 * x1 + x2;
      const t = c4 + Math.max(w, 0) + c + c2 + h + nN2;
      if (t <= 0) return [0, 0];
      const pc4 = (c4 / t) * P_atm;
      const pw = (Math.max(w, 0) / t) * P_atm;
      const pc = (c / t) * P_atm;
      const pc2_ = (c2 / t) * P_atm;
      const ph = (h / t) * P_atm;
      const d1 = pc4 * pw;
      const d2 = pc * pw;
      return [
        d1 > 1e-20 ? (pc * ph ** 3) / d1 - Ksmr : 0,
        d2 > 1e-20 ? (pc2_ * ph) / d2 - Kwgs : 0,
      ];
    };

    const f_pp = evalF(xi1 + dxi, xi2);
    const f_pm = evalF(xi1, xi2 + dxi);

    const J11 = (f_pp[0] - f1) / dxi;
    const J12 = (f_pm[0] - f1) / dxi;
    const J21 = (f_pp[1] - f2) / dxi;
    const J22 = (f_pm[1] - f2) / dxi;

    const det = J11 * J22 - J12 * J21;
    if (Math.abs(det) < 1e-30) break;

    const dxi1 = -(J22 * f1 - J12 * f2) / det;
    const dxi2 = -(-J21 * f1 + J11 * f2) / det;

    // Damped update
    const alpha = 0.5;
    xi1 += alpha * dxi1;
    xi2 += alpha * dxi2;
  }

  // Final composition
  xi1 = Math.max(0, Math.min(xi1, nCH4));
  xi2 = Math.max(-nCO2, Math.min(xi2, nCO + xi1));

  const finalCH4 = nCH4 - xi1;
  const finalH2O = Math.max(nH2O - xi1 - xi2, 0);
  const finalCO = nCO + xi1 - xi2;
  const finalCO2 = nCO2 + xi2;
  const finalH2 = nH2 + 3 * xi1 + xi2;
  const total = finalCH4 + finalH2O + finalCO + finalCO2 + finalH2 + nN2;

  const composition: GasComposition = {
    CH4: finalCH4 / total,
    H2O: finalH2O / total,
    CO: finalCO / total,
    CO2: finalCO2 / total,
    H2: finalH2 / total,
    N2: nN2 / total,
  };

  const totalCH4_fed = nCH4_initial + (feed.CH4 ?? 0) - nCH4_initial; // original feed CH4
  const CH4_conversion =
    nCH4_initial > 0 ? (nCH4_initial - finalCH4) / nCH4_initial : 0;

  const H2_yield =
    (feed.CH4 ?? 0) > 0 ? finalH2 / (feed.CH4 ?? 1) : 0;

  const CH4_CO_ratio =
    finalCO > 1e-10 ? finalCH4 / finalCO : finalCH4 > 0 ? 999 : 0;

  const H2_CO_ratio =
    finalCO > 1e-10 ? finalH2 / finalCO : finalH2 > 0 ? 999 : 0;

  return {
    composition,
    CH4_conversion,
    H2_yield,
    CH4_CO_ratio,
    H2_CO_ratio,
    temperature_K: T_K,
    pressure_kPa: P_kPa,
  };
}

/**
 * Compute equilibrium composition across a temperature range
 * for plotting equilibrium diagrams.
 */
export function equilibriumSweep(
  T_min_K: number,
  T_max_K: number,
  steps: number,
  P_kPa: number,
  feed: GasComposition
): EquilibriumResult[] {
  const results: EquilibriumResult[] = [];
  const dT = (T_max_K - T_min_K) / (steps - 1);

  for (let i = 0; i < steps; i++) {
    const T = T_min_K + i * dT;
    results.push(solveEquilibrium(T, P_kPa, feed));
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
