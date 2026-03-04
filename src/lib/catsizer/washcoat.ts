/**
 * WASHCOAT DIFFUSION & MASS TRANSFER MODULE
 *
 * Models the interplay between:
 * 1. External mass transfer (gas → washcoat surface)
 * 2. Internal diffusion within the porous washcoat (Knudsen + molecular)
 * 3. Reaction at the catalytic sites
 *
 * The effectiveness factor η captures how much of the washcoat volume
 * is actually utilized. Thick washcoats with fast reactions have low η
 * (diffusion-limited), while thin washcoats with slow reactions have η ≈ 1
 * (kinetically-limited).
 *
 * References:
 * - Hayes & Kolaczkowski, "Introduction to Catalytic Combustion" (1997)
 * - Heck, Farrauto & Gulati, "Catalytic Air Pollution Control" (2009)
 */

import { R_GAS, MW } from "./units";

// ============================================================
// WASHCOAT PHYSICAL PROPERTIES
// ============================================================

export interface WashcoatProperties {
  thickness_um: number;           // Washcoat thickness [µm]
  density_kg_m3: number;          // Washcoat apparent density [kg/m³]
  porosity: number;               // Washcoat porosity ε_wc [0–1]
  tortuosity: number;             // Pore tortuosity τ [typically 2–5]
  meanPoreDiameter_nm: number;    // Mean pore diameter [nm]
  BET_surfaceArea_m2_g: number;   // BET specific surface area [m²/g]
  pgmLoading_g_ft3: number;       // Precious metal loading [g/ft³]
  pgmDispersion: number;          // PGM dispersion [0–1] (fraction of atoms on surface)
  activeSiteDensity_mol_m2: number; // Active site density [mol/m²_BET]
}

export const WASHCOAT_DOC_DEFAULT: WashcoatProperties = {
  thickness_um: 30,
  density_kg_m3: 1200,
  porosity: 0.45,
  tortuosity: 3.0,
  meanPoreDiameter_nm: 12,
  BET_surfaceArea_m2_g: 150,
  pgmLoading_g_ft3: 80,
  pgmDispersion: 0.35,
  activeSiteDensity_mol_m2: 1.5e-5,
};

export const WASHCOAT_SCR_DEFAULT: WashcoatProperties = {
  thickness_um: 50,
  density_kg_m3: 1100,
  porosity: 0.50,
  tortuosity: 2.5,
  meanPoreDiameter_nm: 8,
  BET_surfaceArea_m2_g: 200,
  pgmLoading_g_ft3: 0,
  pgmDispersion: 0,
  activeSiteDensity_mol_m2: 5.0e-4,
};

export const WASHCOAT_TWC_DEFAULT: WashcoatProperties = {
  thickness_um: 40,
  density_kg_m3: 1300,
  porosity: 0.42,
  tortuosity: 3.5,
  meanPoreDiameter_nm: 10,
  BET_surfaceArea_m2_g: 120,
  pgmLoading_g_ft3: 120,
  pgmDispersion: 0.30,
  activeSiteDensity_mol_m2: 2.0e-5,
};

export const WASHCOAT_ASC_DEFAULT: WashcoatProperties = {
  thickness_um: 25,
  density_kg_m3: 1150,
  porosity: 0.48,
  tortuosity: 2.8,
  meanPoreDiameter_nm: 11,
  BET_surfaceArea_m2_g: 160,
  pgmLoading_g_ft3: 15,
  pgmDispersion: 0.40,
  activeSiteDensity_mol_m2: 1.0e-5,
};

export const WASHCOAT_DPF_DEFAULT: WashcoatProperties = {
  thickness_um: 15,
  density_kg_m3: 900,
  porosity: 0.55,
  tortuosity: 2.0,
  meanPoreDiameter_nm: 20,
  BET_surfaceArea_m2_g: 80,
  pgmLoading_g_ft3: 10,
  pgmDispersion: 0.45,
  activeSiteDensity_mol_m2: 5.0e-6,
};

// ============================================================
// DIFFUSION COEFFICIENTS
// ============================================================

/**
 * Molecular (binary) diffusion coefficient [m²/s]
 * using Chapman-Enskog theory (simplified Fuller correlation)
 *
 * D_AB = 1.013e-2 × T^1.75 × (1/M_A + 1/M_B)^0.5 / (P × (V_A^(1/3) + V_B^(1/3))²)
 *
 * @param T_K Temperature [K]
 * @param P_kPa Pressure [kPa]
 * @param mw_A Molecular weight of diffusing species [g/mol]
 * @param mw_B Molecular weight of carrier gas [g/mol]
 */
export function molecularDiffusivity(
  T_K: number,
  P_kPa: number,
  mw_A: number,
  mw_B: number = 28.97 // air
): number {
  const P_atm = P_kPa / 101.325;
  // Diffusion volumes (Fuller et al.) — simplified for common exhaust species
  const V_A = 2.0 * Math.pow(mw_A, 0.6); // Approximate
  const V_B = 2.0 * Math.pow(mw_B, 0.6);

  return (
    (1.013e-2 * Math.pow(T_K, 1.75) * Math.sqrt(1 / mw_A + 1 / mw_B)) /
    (P_atm * Math.pow(Math.pow(V_A, 1 / 3) + Math.pow(V_B, 1 / 3), 2))
  );
}

/**
 * Knudsen diffusion coefficient [m²/s]
 * For pore diffusion when pore diameter is comparable to mean free path
 *
 * D_K = (d_pore / 3) × √(8RT / (πM))
 */
export function knudsenDiffusivity(
  d_pore_m: number,
  T_K: number,
  mw_g_mol: number
): number {
  return (d_pore_m / 3) * Math.sqrt((8 * R_GAS * T_K) / (Math.PI * mw_g_mol * 1e-3));
}

/**
 * Effective diffusivity within the washcoat [m²/s]
 *
 * Combines molecular and Knudsen diffusion in series (Bosanquet equation),
 * then corrects for porosity and tortuosity:
 *
 * 1/D_eff = 1/D_mol + 1/D_K
 * D_eff_wc = (ε / τ) × D_eff
 */
export function effectiveDiffusivity(
  T_K: number,
  P_kPa: number,
  mw_species: number,
  wc: WashcoatProperties
): number {
  const D_mol = molecularDiffusivity(T_K, P_kPa, mw_species);
  const D_K = knudsenDiffusivity(wc.meanPoreDiameter_nm * 1e-9, T_K, mw_species);

  // Bosanquet combination
  const D_combined = 1 / (1 / D_mol + 1 / D_K);

  // Correct for washcoat structure
  return (wc.porosity / wc.tortuosity) * D_combined;
}

// ============================================================
// EXTERNAL MASS TRANSFER
// ============================================================

/**
 * External mass transfer coefficient [m/s] in monolith channels.
 *
 * Uses Hawthorn correlation for developing flow in square channels:
 * Sh = 2.977 × (1 + 0.095 × Re × Sc × d_h / L)^0.45
 *
 * @param d_h Hydraulic diameter [m]
 * @param L Channel length [m]
 * @param u Gas velocity in channel [m/s]
 * @param D_AB Molecular diffusivity [m²/s]
 * @param nu Kinematic viscosity [m²/s]
 */
export function externalMassTransferCoeff(
  d_h: number,
  L: number,
  u: number,
  D_AB: number,
  nu: number
): number {
  const Re = u * d_h / nu;
  const Sc = nu / D_AB;
  const Gz = Re * Sc * d_h / L; // Graetz number

  // Hawthorn (1974) correlation for square channels
  const Sh = 2.977 * Math.pow(1 + 0.095 * Gz, 0.45);

  return Sh * D_AB / d_h;
}

// ============================================================
// THIELE MODULUS & EFFECTIVENESS FACTOR
// ============================================================

/**
 * Generalized Thiele modulus for a slab geometry (washcoat layer).
 *
 * φ = L_wc × √(k_v / D_eff)
 *
 * where:
 * - L_wc = washcoat thickness [m] (characteristic length for slab)
 * - k_v = volumetric reaction rate constant [1/s]
 * - D_eff = effective diffusivity in washcoat [m²/s]
 *
 * For first-order reaction: r = k_v × C
 */
export function thieleModulus(
  washcoatThickness_m: number,
  k_v_per_s: number,
  D_eff_m2_s: number
): number {
  if (D_eff_m2_s <= 0 || k_v_per_s <= 0) return 0;
  return washcoatThickness_m * Math.sqrt(k_v_per_s / D_eff_m2_s);
}

/**
 * Internal effectiveness factor for slab geometry.
 *
 * η = tanh(φ) / φ
 *
 * η → 1 when φ → 0 (kinetically limited, all washcoat utilized)
 * η → 1/φ when φ → ∞ (diffusion limited, only surface layer active)
 */
export function internalEffectivenessFactor(phi: number): number {
  if (phi < 0.01) return 1.0;
  if (phi > 50) return 1.0 / phi;
  return Math.tanh(phi) / phi;
}

/**
 * Overall effectiveness factor including external mass transfer.
 *
 * 1/η_overall = 1/η_internal + (k_v × L_wc) / k_m
 *
 * where k_m is the external mass transfer coefficient.
 */
export function overallEffectivenessFactor(
  eta_internal: number,
  k_v_per_s: number,
  washcoatThickness_m: number,
  k_m_m_s: number
): number {
  if (k_m_m_s <= 0) return eta_internal;

  const Da = (k_v_per_s * washcoatThickness_m) / k_m_m_s; // Damköhler number
  const eta_overall = 1 / (1 / eta_internal + Da);

  return Math.max(0, Math.min(1, eta_overall));
}

// ============================================================
// COMPLETE WASHCOAT ANALYSIS
// ============================================================

export interface WashcoatAnalysisResult {
  D_eff_m2_s: number;             // Effective diffusivity
  D_mol_m2_s: number;             // Molecular diffusivity
  D_K_m2_s: number;               // Knudsen diffusivity
  phi: number;                     // Thiele modulus
  eta_internal: number;            // Internal effectiveness factor
  eta_overall: number;             // Overall effectiveness factor (with ext. mass transfer)
  k_m_m_s: number;                // External mass transfer coefficient
  regime: "kinetic" | "transitional" | "diffusion_limited";
  washcoatUtilization_percent: number;
  activeSites_mol_m3: number;     // Total active sites per m³ washcoat
}

/**
 * Complete washcoat mass transfer analysis for a given species.
 *
 * Determines whether the catalyst is operating in the kinetic regime
 * (η ≈ 1, all washcoat active) or diffusion-limited regime (η << 1,
 * only the outer shell of washcoat is active).
 */
export function analyzeWashcoat(
  T_K: number,
  P_kPa: number,
  speciesMW: number,
  k_v_per_s: number,
  wc: WashcoatProperties,
  channelHydraulicDiameter_m: number,
  channelLength_m: number,
  gasVelocity_m_s: number,
  kinematicViscosity_m2_s: number
): WashcoatAnalysisResult {
  const D_mol = molecularDiffusivity(T_K, P_kPa, speciesMW);
  const D_K = knudsenDiffusivity(wc.meanPoreDiameter_nm * 1e-9, T_K, speciesMW);
  const D_eff = effectiveDiffusivity(T_K, P_kPa, speciesMW, wc);

  const wc_m = wc.thickness_um * 1e-6;
  const phi = thieleModulus(wc_m, k_v_per_s, D_eff);
  const eta_internal = internalEffectivenessFactor(phi);

  const k_m = externalMassTransferCoeff(
    channelHydraulicDiameter_m,
    channelLength_m,
    gasVelocity_m_s,
    D_mol,
    kinematicViscosity_m2_s
  );

  const eta_overall = overallEffectivenessFactor(eta_internal, k_v_per_s, wc_m, k_m);

  const regime: "kinetic" | "transitional" | "diffusion_limited" =
    phi < 0.3 ? "kinetic" : phi < 3.0 ? "transitional" : "diffusion_limited";

  const activeSites_mol_m3 =
    wc.BET_surfaceArea_m2_g * wc.density_kg_m3 * 1000 * wc.activeSiteDensity_mol_m2;

  return {
    D_eff_m2_s: D_eff,
    D_mol_m2_s: D_mol,
    D_K_m2_s: D_K,
    phi,
    eta_internal,
    eta_overall,
    k_m_m_s: k_m,
    regime,
    washcoatUtilization_percent: eta_overall * 100,
    activeSites_mol_m3,
  };
}

/**
 * Washcoat thickness optimization.
 *
 * Sweeps washcoat thickness and returns effectiveness factor vs thickness.
 * Used to find the optimal thickness where adding more washcoat gives
 * diminishing returns (diffusion limitation onset).
 */
export function washcoatThicknessSweep(
  T_K: number,
  P_kPa: number,
  speciesMW: number,
  k_v_per_s: number,
  baseWC: WashcoatProperties,
  thicknessRange_um: [number, number] = [5, 100],
  steps: number = 20
): Array<{ thickness_um: number; eta: number; phi: number; regime: string }> {
  const results: Array<{ thickness_um: number; eta: number; phi: number; regime: string }> = [];
  const dt = (thicknessRange_um[1] - thicknessRange_um[0]) / (steps - 1);

  for (let i = 0; i < steps; i++) {
    const t = thicknessRange_um[0] + i * dt;
    const wc = { ...baseWC, thickness_um: t };
    const D_eff = effectiveDiffusivity(T_K, P_kPa, speciesMW, wc);
    const phi = thieleModulus(t * 1e-6, k_v_per_s, D_eff);
    const eta = internalEffectivenessFactor(phi);

    results.push({
      thickness_um: t,
      eta,
      phi,
      regime: phi < 0.3 ? "kinetic" : phi < 3.0 ? "transitional" : "diffusion_limited",
    });
  }

  return results;
}
