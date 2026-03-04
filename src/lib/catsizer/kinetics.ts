/**
 * REACTION KINETICS MODULE
 *
 * Implements rate expressions for all catalyst types using published
 * kinetic models with Arrhenius temperature dependence.
 *
 * References:
 * - DOC: Voltz et al. (1973), Oh & Cavendish (1982) — Langmuir-Hinshelwood
 * - SCR: Tronconi et al. (2005), Nova et al. (2006) — Eley-Rideal
 * - TWC: Koltsakis & Stamatelos (1997) — competitive L-H
 * - Reforming: Xu & Froment (1989) — intrinsic kinetics on Ni/Al₂O₃
 */

import { R_GAS } from "./units";

// ============================================================
// ARRHENIUS HELPER
// ============================================================

/**
 * Arrhenius rate constant: k = A × exp(-Ea / (R × T))
 * @param A Pre-exponential factor [units vary]
 * @param Ea Activation energy [J/mol]
 * @param T_K Temperature [K]
 */
export function arrhenius(A: number, Ea: number, T_K: number): number {
  return A * Math.exp(-Ea / (R_GAS * T_K));
}

/**
 * Arrhenius with reference temperature form:
 * k = k_ref × exp((-Ea/R) × (1/T - 1/T_ref))
 */
export function arrheniusRef(
  k_ref: number,
  Ea: number,
  T_K: number,
  T_ref_K: number
): number {
  return k_ref * Math.exp((-Ea / R_GAS) * (1 / T_K - 1 / T_ref_K));
}

// ============================================================
// DOC KINETICS — Langmuir-Hinshelwood (Voltz/Oh model)
// ============================================================

/**
 * Kinetic parameters for DOC reactions.
 * Based on Voltz et al. (1973) and Oh & Cavendish (1982).
 */
export interface DOCKineticParams {
  // CO oxidation: CO + ½O₂ → CO₂
  A_CO: number;          // Pre-exponential [mol/(m³·s)]
  Ea_CO: number;         // Activation energy [J/mol]
  // HC oxidation: CₓHᵧ + (x + y/4)O₂ → xCO₂ + (y/2)H₂O
  A_HC: number;
  Ea_HC: number;
  // NO oxidation: NO + ½O₂ ⇌ NO₂
  A_NO: number;
  Ea_NO: number;
  // Inhibition terms
  K_CO: number;          // CO adsorption equilibrium constant at T_ref
  dH_CO: number;         // CO adsorption enthalpy [J/mol]
  K_HC: number;
  dH_HC: number;
  K_NO: number;
  dH_NO: number;
  T_ref: number;         // Reference temperature [K]
}

export const DOC_KINETICS_DEFAULT: DOCKineticParams = {
  A_CO: 2.0e13,
  Ea_CO: 90000,
  A_HC: 5.0e12,
  Ea_HC: 100000,
  A_NO: 1.0e10,
  Ea_NO: 60000,
  K_CO: 65.5,
  dH_CO: -7990,
  K_HC: 2080,
  dH_HC: -3000,
  K_NO: 0.0,
  dH_NO: 0,
  T_ref: 573.15,
};

/**
 * DOC reaction rates using Langmuir-Hinshelwood mechanism.
 *
 * Rate = k_i × C_i / G²
 * G = T × (1 + K_CO×C_CO + K_HC×C_HC)² × (1 + K_NO×C_NO²×C_CO²)
 *
 * The inhibition term G captures competitive adsorption on Pt/Pd sites.
 * At low T, CO self-poisons the surface (high K_CO×C_CO).
 *
 * @returns Reaction rates [mol/(m³_washcoat · s)]
 */
export function docReactionRates(
  T_K: number,
  C_CO: number,   // CO concentration [mol/m³]
  C_HC: number,   // HC concentration [mol/m³]
  C_NO: number,   // NO concentration [mol/m³]
  C_O2: number,   // O₂ concentration [mol/m³]
  params: DOCKineticParams = DOC_KINETICS_DEFAULT
): { r_CO: number; r_HC: number; r_NO: number } {
  const k_CO = arrhenius(params.A_CO, params.Ea_CO, T_K);
  const k_HC = arrhenius(params.A_HC, params.Ea_HC, T_K);
  const k_NO = arrhenius(params.A_NO, params.Ea_NO, T_K);

  const Kco = params.K_CO * Math.exp((-params.dH_CO / R_GAS) * (1 / T_K - 1 / params.T_ref));
  const Khc = params.K_HC * Math.exp((-params.dH_HC / R_GAS) * (1 / T_K - 1 / params.T_ref));

  // Inhibition denominator (Voltz model)
  const G =
    T_K *
    (1 + Kco * C_CO + Khc * C_HC) ** 2 *
    (1 + 0.7 * C_CO ** 2 * C_NO ** 2);

  const r_CO = G > 0 ? (k_CO * C_CO * C_O2) / G : 0;
  const r_HC = G > 0 ? (k_HC * C_HC * C_O2) / G : 0;

  // NO oxidation is equilibrium-limited
  // NO + ½O₂ ⇌ NO₂, K_eq from thermodynamics
  const K_eq_NO2 = Math.exp(6860 / T_K - 3.81); // Fitted equilibrium constant
  const C_NO2_eq = K_eq_NO2 * C_NO * Math.sqrt(C_O2);
  const r_NO = k_NO * C_NO * Math.sqrt(C_O2) * (1 - 0 / (C_NO2_eq + 1e-20));

  return { r_CO, r_HC, r_NO };
}

// ============================================================
// SCR KINETICS — Eley-Rideal (Tronconi/Nova model)
// ============================================================

export interface SCRKineticParams {
  // Standard SCR: 4NO + 4NH₃ + O₂ → 4N₂ + 6H₂O
  A_std: number;
  Ea_std: number;
  // Fast SCR: NO + NO₂ + 2NH₃ → 2N₂ + 3H₂O
  A_fast: number;
  Ea_fast: number;
  // NO₂ SCR: 3NO₂ + 4NH₃ → 3.5N₂ + 6H₂O
  A_NO2: number;
  Ea_NO2: number;
  // NH₃ oxidation (parasitic): 4NH₃ + 3O₂ → 2N₂ + 6H₂O
  A_NH3ox: number;
  Ea_NH3ox: number;
  // NH₃ adsorption capacity [mol/m³_washcoat]
  omega_max: number;
  // NH₃ adsorption/desorption
  K_ads: number;
  Ea_des: number;
  A_des: number;
}

export const SCR_KINETICS_CU_ZEOLITE: SCRKineticParams = {
  A_std: 1.5e8,
  Ea_std: 52000,
  A_fast: 8.0e9,
  Ea_fast: 35000,
  A_NO2: 2.0e7,
  Ea_NO2: 55000,
  A_NH3ox: 5.0e10,
  Ea_NH3ox: 120000,
  omega_max: 150,
  K_ads: 1.0e5,
  Ea_des: 95000,
  A_des: 1.0e13,
};

export const SCR_KINETICS_V_TITANIA: SCRKineticParams = {
  A_std: 8.0e7,
  Ea_std: 48000,
  A_fast: 5.0e9,
  Ea_fast: 32000,
  A_NO2: 1.5e7,
  Ea_NO2: 50000,
  A_NH3ox: 2.0e11,
  Ea_NH3ox: 130000,
  omega_max: 100,
  K_ads: 5.0e4,
  Ea_des: 85000,
  A_des: 5.0e12,
};

export const SCR_KINETICS_FE_ZEOLITE: SCRKineticParams = {
  A_std: 3.0e8,
  Ea_std: 58000,
  A_fast: 1.0e10,
  Ea_fast: 38000,
  A_NO2: 3.0e7,
  Ea_NO2: 60000,
  A_NH3ox: 1.0e11,
  Ea_NH3ox: 125000,
  omega_max: 120,
  K_ads: 8.0e4,
  Ea_des: 90000,
  A_des: 8.0e12,
};

/**
 * SCR reaction rates using Eley-Rideal mechanism.
 *
 * The model tracks NH₃ surface coverage (θ) on zeolite/vanadia sites.
 * Standard SCR is first-order in NO and θ.
 * Fast SCR uses equimolar NO+NO₂ and is ~10× faster than standard.
 *
 * @param theta NH₃ surface coverage [0–1]
 * @returns Reaction rates [mol/(m³_washcoat · s)] and NH₃ consumption
 */
export function scrReactionRates(
  T_K: number,
  C_NO: number,
  C_NO2: number,
  C_NH3: number,
  C_O2: number,
  theta: number,
  params: SCRKineticParams = SCR_KINETICS_CU_ZEOLITE
): {
  r_stdSCR: number;
  r_fastSCR: number;
  r_NO2SCR: number;
  r_NH3ox: number;
  r_ads: number;
  r_des: number;
  totalNOx_removed: number;
  NH3_consumed: number;
} {
  const k_std = arrhenius(params.A_std, params.Ea_std, T_K);
  const k_fast = arrhenius(params.A_fast, params.Ea_fast, T_K);
  const k_NO2 = arrhenius(params.A_NO2, params.Ea_NO2, T_K);
  const k_NH3ox = arrhenius(params.A_NH3ox, params.Ea_NH3ox, T_K);
  const k_des = arrhenius(params.A_des, params.Ea_des, T_K);

  // Standard SCR: 4NO + 4NH₃ + O₂ → 4N₂ + 6H₂O
  const r_stdSCR = k_std * C_NO * theta * Math.sqrt(C_O2);

  // Fast SCR: NO + NO₂ + 2NH₃ → 2N₂ + 3H₂O (requires equimolar NO:NO₂)
  const C_NO_NO2_min = Math.min(C_NO, C_NO2);
  const r_fastSCR = k_fast * C_NO_NO2_min * theta;

  // NO₂ SCR: 3NO₂ + 4NH₃ → 3.5N₂ + 6H₂O (slow, only when NO₂ excess)
  const C_NO2_excess = Math.max(0, C_NO2 - C_NO);
  const r_NO2SCR = k_NO2 * C_NO2_excess * theta;

  // Parasitic NH₃ oxidation: 4NH₃ + 3O₂ → 2N₂ + 6H₂O
  const r_NH3ox = k_NH3ox * theta * C_O2;

  // NH₃ adsorption/desorption
  const r_ads = params.K_ads * C_NH3 * (1 - theta);
  const r_des = k_des * theta;

  const totalNOx_removed = r_stdSCR + 2 * r_fastSCR + 3 * r_NO2SCR;
  const NH3_consumed = r_stdSCR + 2 * r_fastSCR + (4 / 3) * r_NO2SCR + r_NH3ox;

  return {
    r_stdSCR,
    r_fastSCR,
    r_NO2SCR,
    r_NH3ox,
    r_ads,
    r_des,
    totalNOx_removed,
    NH3_consumed,
  };
}

// ============================================================
// TWC KINETICS — Competitive Langmuir-Hinshelwood
// (Koltsakis & Stamatelos, 1997)
// ============================================================

export interface TWCKineticParams {
  A_CO_ox: number;       Ea_CO_ox: number;
  A_HC_ox: number;       Ea_HC_ox: number;
  A_NO_red_CO: number;   Ea_NO_red_CO: number;
  A_NO_red_HC: number;   Ea_NO_red_HC: number;
  A_NO_red_H2: number;   Ea_NO_red_H2: number;
  A_WGS: number;         Ea_WGS: number;
  A_steam: number;       Ea_steam: number;
  // Oxygen storage capacity (OSC) of CeO₂-ZrO₂
  OSC_mol_m3: number;
  K_inh_CO: number;
  K_inh_HC: number;
  K_inh_NO: number;
}

export const TWC_KINETICS_DEFAULT: TWCKineticParams = {
  A_CO_ox: 5.0e16,       Ea_CO_ox: 100000,
  A_HC_ox: 2.0e15,       Ea_HC_ox: 110000,
  A_NO_red_CO: 1.0e14,   Ea_NO_red_CO: 80000,
  A_NO_red_HC: 5.0e13,   Ea_NO_red_HC: 85000,
  A_NO_red_H2: 3.0e14,   Ea_NO_red_H2: 70000,
  A_WGS: 1.0e12,         Ea_WGS: 60000,
  A_steam: 5.0e11,       Ea_steam: 70000,
  OSC_mol_m3: 50,
  K_inh_CO: 65.5,
  K_inh_HC: 2080,
  K_inh_NO: 0.0,
};

/**
 * TWC reaction rates.
 *
 * The TWC operates near stoichiometry (λ ≈ 1.0).
 * CeO₂-ZrO₂ oxygen storage buffers λ excursions.
 *
 * Key reactions:
 * 1. CO + ½O₂ → CO₂
 * 2. CₓHᵧ + O₂ → CO₂ + H₂O
 * 3. NO + CO → ½N₂ + CO₂
 * 4. NO + CₓHᵧ → N₂ + CO₂ + H₂O
 * 5. NO + H₂ → ½N₂ + H₂O
 * 6. CO + H₂O ⇌ CO₂ + H₂ (WGS)
 * 7. CₓHᵧ + H₂O → CO + H₂ (steam reforming)
 */
export function twcReactionRates(
  T_K: number,
  C_CO: number,
  C_HC: number,
  C_NO: number,
  C_O2: number,
  C_H2: number,
  C_H2O: number,
  lambda: number,
  params: TWCKineticParams = TWC_KINETICS_DEFAULT
): {
  r_CO_ox: number;
  r_HC_ox: number;
  r_NO_red_CO: number;
  r_NO_red_HC: number;
  r_NO_red_H2: number;
  r_WGS: number;
  r_steam: number;
} {
  // Inhibition denominator
  const G = (1 + params.K_inh_CO * C_CO + params.K_inh_HC * C_HC) ** 2;

  // Lambda window effect: TWC is most effective at λ = 1.0 ± 0.005
  const lambdaFactor = Math.exp(-((lambda - 1.0) ** 2) / (2 * 0.005 ** 2));

  const r_CO_ox = arrhenius(params.A_CO_ox, params.Ea_CO_ox, T_K) * C_CO * C_O2 / G;
  const r_HC_ox = arrhenius(params.A_HC_ox, params.Ea_HC_ox, T_K) * C_HC * C_O2 / G;
  const r_NO_red_CO = arrhenius(params.A_NO_red_CO, params.Ea_NO_red_CO, T_K) * C_NO * C_CO / G * lambdaFactor;
  const r_NO_red_HC = arrhenius(params.A_NO_red_HC, params.Ea_NO_red_HC, T_K) * C_NO * C_HC / G * lambdaFactor;
  const r_NO_red_H2 = arrhenius(params.A_NO_red_H2, params.Ea_NO_red_H2, T_K) * C_NO * C_H2 / G * lambdaFactor;
  const r_WGS = arrhenius(params.A_WGS, params.Ea_WGS, T_K) * C_CO * C_H2O / G;
  const r_steam = arrhenius(params.A_steam, params.Ea_steam, T_K) * C_HC * C_H2O / G;

  return { r_CO_ox, r_HC_ox, r_NO_red_CO, r_NO_red_HC, r_NO_red_H2, r_WGS, r_steam };
}

// ============================================================
// REFORMING KINETICS — Xu & Froment (1989)
// Intrinsic kinetics on Ni/Al₂O₃
// ============================================================

export interface ReformingKineticParams {
  // SMR: CH₄ + H₂O ⇌ CO + 3H₂
  k1_ref: number;       // Rate constant at T_ref [kmol/(kg_cat · h · bar^0.5)]
  Ea1: number;          // [J/mol]
  // WGS: CO + H₂O ⇌ CO₂ + H₂
  k2_ref: number;
  Ea2: number;
  // Global SMR: CH₄ + 2H₂O ⇌ CO₂ + 4H₂
  k3_ref: number;
  Ea3: number;
  // Adsorption constants
  K_CH4_ref: number;    dH_CH4: number;
  K_CO_ref: number;     dH_CO: number;
  K_H2_ref: number;     dH_H2: number;
  K_H2O_ref: number;    dH_H2O: number;
  T_ref: number;
}

export const XU_FROMENT_PARAMS: ReformingKineticParams = {
  k1_ref: 4.225e15,     Ea1: 240100,
  k2_ref: 1.955e6,      Ea2: 67130,
  k3_ref: 1.020e15,     Ea3: 243900,
  K_CH4_ref: 6.65e-4,   dH_CH4: -38280,
  K_CO_ref: 8.23e-5,    dH_CO: -70650,
  K_H2_ref: 6.12e-9,    dH_H2: -82900,
  K_H2O_ref: 1.77e5,    dH_H2O: 88680,
  T_ref: 648,
};

/**
 * Xu-Froment intrinsic reaction rates for steam methane reforming.
 *
 * Three reactions:
 * R1: CH₄ + H₂O ⇌ CO + 3H₂
 * R2: CO + H₂O ⇌ CO₂ + H₂
 * R3: CH₄ + 2H₂O ⇌ CO₂ + 4H₂
 *
 * @param p Partial pressures [bar]
 * @returns Rates [kmol/(kg_cat · h)]
 */
export function xuFromentRates(
  T_K: number,
  p_CH4: number,
  p_H2O: number,
  p_CO: number,
  p_CO2: number,
  p_H2: number,
  K_eq1: number,
  K_eq2: number,
  params: ReformingKineticParams = XU_FROMENT_PARAMS
): { r1: number; r2: number; r3: number } {
  const k1 = arrheniusRef(params.k1_ref, params.Ea1, T_K, params.T_ref);
  const k2 = arrheniusRef(params.k2_ref, params.Ea2, T_K, params.T_ref);
  const k3 = arrheniusRef(params.k3_ref, params.Ea3, T_K, params.T_ref);

  const K_CH4 = params.K_CH4_ref * Math.exp((-params.dH_CH4 / R_GAS) * (1 / T_K - 1 / params.T_ref));
  const K_CO = params.K_CO_ref * Math.exp((-params.dH_CO / R_GAS) * (1 / T_K - 1 / params.T_ref));
  const K_H2 = params.K_H2_ref * Math.exp((-params.dH_H2 / R_GAS) * (1 / T_K - 1 / params.T_ref));
  const K_H2O = params.K_H2O_ref * Math.exp((-params.dH_H2O / R_GAS) * (1 / T_K - 1 / params.T_ref));

  // Denominator (DEN)
  const pH2_safe = Math.max(p_H2, 1e-10);
  const DEN = 1 + K_CO * p_CO + K_H2 * pH2_safe + K_CH4 * p_CH4 + K_H2O * p_H2O / pH2_safe;
  const DEN2 = DEN * DEN;

  // Driving forces (approach to equilibrium)
  const DF1 = p_CH4 * p_H2O / (pH2_safe ** 2.5) - p_CO * pH2_safe ** 0.5 / K_eq1;
  const DF2 = p_CO * p_H2O / pH2_safe - p_CO2 / K_eq2;
  const DF3 = p_CH4 * p_H2O ** 2 / (pH2_safe ** 3.5) - p_CO2 * pH2_safe ** 0.5 / (K_eq1 * K_eq2);

  const r1 = k1 * DF1 / DEN2;
  const r2 = k2 * DF2 / DEN2;
  const r3 = k3 * DF3 / DEN2;

  return { r1, r2, r3 };
}

// ============================================================
// ASC KINETICS — Dual-layer model
// ============================================================

/**
 * ASC (Ammonia Slip Catalyst) uses a dual-layer design:
 * - Top layer: Pt/Al₂O₃ oxidizes NH₃
 * - Bottom layer: SCR catalyst converts produced NOₓ
 *
 * Net result: NH₃ → N₂ (selective) instead of NH₃ → NO (non-selective)
 */
export function ascReactionRates(
  T_K: number,
  C_NH3: number,
  C_O2: number,
  C_NO: number
): {
  r_NH3_to_N2: number;   // Selective oxidation
  r_NH3_to_NO: number;   // Non-selective oxidation
  selectivity_N2: number; // Fraction going to N₂
} {
  // NH₃ oxidation on Pt (total)
  const k_ox = arrhenius(5.0e12, 90000, T_K);
  const r_total = k_ox * C_NH3 * C_O2;

  // Selectivity to N₂ depends on temperature
  // At low T: high selectivity to N₂ (~95%)
  // At high T: selectivity drops as NO formation increases
  const selectivity_N2 = 0.95 - 0.3 * Math.max(0, (T_K - 573) / 400);
  const sel = Math.max(0.4, Math.min(0.98, selectivity_N2));

  return {
    r_NH3_to_N2: r_total * sel,
    r_NH3_to_NO: r_total * (1 - sel),
    selectivity_N2: sel,
  };
}

// ============================================================
// CONVERSION CALCULATOR (1D plug-flow with kinetics)
// ============================================================

/**
 * Calculate conversion through a monolith catalyst using 1D plug-flow
 * model with kinetic rate expressions.
 *
 * Discretizes the channel length into N segments and integrates
 * species balances along the flow direction.
 *
 * @param catalystType Which kinetic model to use
 * @param length_m Monolith length [m]
 * @param gsa_m2_L Geometric surface area [m²/L]
 * @param volume_L Catalyst volume [L]
 * @param Q_m3_s Volumetric flow at actual conditions [m³/s]
 * @param T_K Gas temperature [K]
 * @param concentrations Inlet species concentrations [mol/m³]
 * @param washcoatThickness_um Washcoat thickness [µm]
 * @param effectivenessFactor Washcoat effectiveness factor [0–1]
 */
export function plugFlowConversion(
  catalystType: "DOC" | "SCR" | "TWC" | "ASC",
  length_m: number,
  gsa_m2_L: number,
  volume_L: number,
  Q_m3_s: number,
  T_K: number,
  concentrations: Record<string, number>,
  washcoatThickness_um: number = 30,
  effectivenessFactor: number = 0.7
): Record<string, number> {
  const N_STEPS = 50;
  const dz = length_m / N_STEPS;
  const S_v = gsa_m2_L * 1000; // m²/m³ catalyst
  const tau = (volume_L * 1e-3) / Q_m3_s; // residence time [s]
  const dt = tau / N_STEPS;

  const C = { ...concentrations };
  const wc_m = washcoatThickness_um * 1e-6;
  const eta = effectivenessFactor;

  for (let i = 0; i < N_STEPS; i++) {
    if (catalystType === "DOC") {
      const rates = docReactionRates(
        T_K,
        C.CO ?? 0,
        C.HC ?? 0,
        C.NO ?? 0,
        C.O2 ?? 0
      );
      C.CO = Math.max(0, (C.CO ?? 0) - rates.r_CO * eta * wc_m * S_v * dt);
      C.HC = Math.max(0, (C.HC ?? 0) - rates.r_HC * eta * wc_m * S_v * dt);
      const dNO = rates.r_NO * eta * wc_m * S_v * dt;
      C.NO = Math.max(0, (C.NO ?? 0) - dNO);
      C.NO2 = (C.NO2 ?? 0) + dNO;
    } else if (catalystType === "SCR") {
      const theta = Math.min(1, (C.NH3 ?? 0) / ((C.NH3 ?? 0) + 0.01));
      const rates = scrReactionRates(
        T_K,
        C.NO ?? 0,
        C.NO2 ?? 0,
        C.NH3 ?? 0,
        C.O2 ?? 0,
        theta
      );
      const dNOx = rates.totalNOx_removed * eta * wc_m * S_v * dt;
      const dNH3 = rates.NH3_consumed * eta * wc_m * S_v * dt;
      C.NO = Math.max(0, (C.NO ?? 0) - dNOx * 0.7);
      C.NO2 = Math.max(0, (C.NO2 ?? 0) - dNOx * 0.3);
      C.NH3 = Math.max(0, (C.NH3 ?? 0) - dNH3);
    } else if (catalystType === "TWC") {
      const rates = twcReactionRates(
        T_K,
        C.CO ?? 0,
        C.HC ?? 0,
        C.NO ?? 0,
        C.O2 ?? 0,
        C.H2 ?? 0,
        C.H2O ?? 0,
        1.0
      );
      C.CO = Math.max(0, (C.CO ?? 0) - (rates.r_CO_ox + rates.r_NO_red_CO) * eta * wc_m * S_v * dt);
      C.HC = Math.max(0, (C.HC ?? 0) - (rates.r_HC_ox + rates.r_NO_red_HC) * eta * wc_m * S_v * dt);
      C.NO = Math.max(0, (C.NO ?? 0) - (rates.r_NO_red_CO + rates.r_NO_red_HC + rates.r_NO_red_H2) * eta * wc_m * S_v * dt);
    } else if (catalystType === "ASC") {
      const rates = ascReactionRates(T_K, C.NH3 ?? 0, C.O2 ?? 0, C.NO ?? 0);
      C.NH3 = Math.max(0, (C.NH3 ?? 0) - (rates.r_NH3_to_N2 + rates.r_NH3_to_NO) * eta * wc_m * S_v * dt);
      C.NO = (C.NO ?? 0) + rates.r_NH3_to_NO * eta * wc_m * S_v * dt;
    }
  }

  return C;
}
