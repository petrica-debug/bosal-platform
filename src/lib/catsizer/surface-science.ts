/**
 * SURFACE SCIENCE & CATALYTIC ACTIVITY MODULE
 *
 * Connects catalyst characterization data to intrinsic activity:
 *
 *   Chemisorption → Metallic Surface Area → Active Sites → TOF → Rate → Volume
 *
 * This is how a catalyst chemist with 20 years of lab experience sizes catalysts:
 *
 * 1. CHARACTERIZATION (measured in lab)
 *    - CO or H₂ chemisorption uptake [µmol/g_cat]
 *    - BET surface area [m²/g]
 *    - PGM dispersion D = (surface atoms) / (total atoms) [0–1]
 *    - Metallic surface area S_met [m²/g_PGM]
 *    - Particle size d_PGM from TEM or XRD [nm]
 *
 * 2. ACTIVITY (measured or from literature)
 *    - Turnover Frequency TOF [molecules / (site · s)] at reference T
 *    - Activation energy Ea [kJ/mol]
 *    - TON (Turnover Number) = total molecules converted per site over lifetime
 *
 * 3. SIZING (first principles)
 *    - Molar flow of pollutant to convert [mol/s]
 *    - Required rate = flow × target conversion [mol/s]
 *    - Sites needed = rate / TOF [sites]
 *    - PGM mass needed = sites / (dispersion × atoms_per_g) [g]
 *    - Catalyst volume = PGM_mass / (loading × washcoat_density) [L]
 *
 * References:
 * - Boudart & Djéga-Mariadassou, "Kinetics of Heterogeneous Catalytic Reactions" (1984)
 * - Heck, Farrauto & Gulati, "Catalytic Air Pollution Control" (2009)
 * - Bartholomew & Farrauto, "Fundamentals of Industrial Catalytic Processes" (2006)
 * - Kašpar, Fornasiero & Hickey, Catal. Today 77 (2003) 419–449
 */

import { R_GAS } from "./units";

// ============================================================
// PHYSICAL CONSTANTS
// ============================================================

const AVOGADRO = 6.022e23;                // molecules/mol
const BOLTZMANN = 1.381e-23;              // J/K

/** Atomic masses [g/mol] */
const ATOMIC_MASS = {
  Pt: 195.08,
  Pd: 106.42,
  Rh: 102.91,
  Ru: 101.07,
  Ni: 58.69,
  Cu: 63.55,
  Fe: 55.85,
  V: 50.94,
};

/** Metal surface atom density [atoms/m²] — from crystallography */
const SURFACE_ATOM_DENSITY: Record<string, number> = {
  Pt: 1.25e19,   // Pt(111) polycrystalline average
  Pd: 1.27e19,   // Pd(111)
  Rh: 1.33e19,   // Rh(111)
  Ni: 1.54e19,   // Ni(111)
  Cu: 1.47e19,   // Cu(111)
  Fe: 1.22e19,   // Fe(110)
};

/** Chemisorption stoichiometry: molecules adsorbed per surface metal atom */
const CHEMISORPTION_STOICHIOMETRY: Record<string, Record<string, number>> = {
  CO: { Pt: 1.0, Pd: 1.0, Rh: 1.0, Ni: 1.0, Cu: 1.0 },
  H2: { Pt: 1.0, Pd: 1.0, Rh: 1.0, Ni: 1.0 },  // dissociative: 1 H₂ → 2 H(ads), stoich = 1 per atom
  O2: { Pt: 0.5, Pd: 0.5, Rh: 0.5 },             // dissociative: 1 O₂ → 2 O(ads)
};

// ============================================================
// CHEMISORPTION & DISPERSION
// ============================================================

export interface ChemisorptionData {
  /** Probe gas used */
  probeGas: "CO" | "H2" | "O2";
  /** Chemisorption uptake [µmol/g_catalyst] */
  uptake_umol_g: number;
  /** PGM loading on catalyst [wt%] */
  pgmLoading_wt_percent: number;
  /** Primary metal */
  primaryMetal: keyof typeof ATOMIC_MASS;
  /** Measurement temperature [°C] */
  measurementTemp_C: number;
}

export interface DispersionResult {
  /** PGM dispersion [0–1] */
  dispersion: number;
  /** Metallic surface area [m²/g_PGM] */
  metallicSurfaceArea_m2_gPGM: number;
  /** Metallic surface area [m²/g_catalyst] */
  metallicSurfaceArea_m2_gCat: number;
  /** Estimated average particle size [nm] (from dispersion) */
  particleSize_nm: number;
  /** Number of surface sites per gram of catalyst [sites/g_cat] */
  surfaceSites_per_gCat: number;
  /** Number of surface sites per gram of PGM [sites/g_PGM] */
  surfaceSites_per_gPGM: number;
}

/**
 * Calculate PGM dispersion and metallic surface area from chemisorption data.
 *
 * D = (n_ads × stoich × M_PGM) / (w_PGM × 1e6)
 *
 * where:
 *   n_ads = chemisorption uptake [µmol/g_cat]
 *   stoich = chemisorption stoichiometry [molecules/atom]
 *   M_PGM = atomic mass of PGM [g/mol]
 *   w_PGM = PGM loading [wt fraction]
 */
export function calculateDispersion(data: ChemisorptionData): DispersionResult {
  const metal = data.primaryMetal;
  const M = ATOMIC_MASS[metal];
  const stoich = CHEMISORPTION_STOICHIOMETRY[data.probeGas]?.[metal] ?? 1.0;
  const w_PGM = data.pgmLoading_wt_percent / 100;

  // Dispersion D = (uptake × stoich × M) / (w_PGM × 1e6)
  const D = (data.uptake_umol_g * stoich * M) / (w_PGM * 1e6);
  const dispersion = Math.min(1.0, Math.max(0, D));

  // Metallic surface area [m²/g_PGM]
  const sigma = SURFACE_ATOM_DENSITY[metal] ?? 1.25e19;
  const S_met = (dispersion * AVOGADRO) / (M * sigma) * 1e-4;
  // convert: (atoms/mol) / (g/mol × atoms/m²) = m²/g, then ×1e-4 for correct scaling
  // Actually: S_met = D × N_A / (M × σ_s)
  const S_met_correct = (dispersion * AVOGADRO) / (M * sigma);

  // Particle size from dispersion (spherical approximation)
  // d = 6 × v_atom / (σ_s × D × a_atom)
  // Simplified: d ≈ 1.1 / D for Pt (nm), 0.9/D for Pd
  const sizeFactors: Record<string, number> = { Pt: 1.13, Pd: 0.94, Rh: 0.95, Ni: 0.97, Cu: 0.90 };
  const particleSize = dispersion > 0 ? (sizeFactors[metal] ?? 1.0) / dispersion : 100;

  // Surface sites per gram
  const sites_per_gPGM = dispersion * AVOGADRO / M;
  const sites_per_gCat = sites_per_gPGM * w_PGM;

  return {
    dispersion,
    metallicSurfaceArea_m2_gPGM: S_met_correct,
    metallicSurfaceArea_m2_gCat: S_met_correct * w_PGM,
    particleSize_nm: particleSize,
    surfaceSites_per_gPGM: sites_per_gPGM,
    surfaceSites_per_gCat: sites_per_gCat,
  };
}

// ============================================================
// TURNOVER FREQUENCY (TOF) DATABASE
// ============================================================

export interface TOFEntry {
  id: string;
  reaction: string;
  catalyst: string;
  metal: string;
  /** TOF at reference temperature [molecules / (site · s)] or [s⁻¹] */
  TOF_ref: number;
  /** Reference temperature [°C] */
  T_ref_C: number;
  /** Apparent activation energy [kJ/mol] */
  Ea_kJ_mol: number;
  /** Reaction order in key reactant */
  reactionOrder: number;
  /** Conditions */
  conditions: string;
  /** Literature source */
  reference: string;
  /** Applicable catalyst types */
  catalystTypes: string[];
}

/**
 * Literature TOF values for key reactions.
 * Curated from published kinetic studies on well-characterized catalysts.
 */
export const TOF_DATABASE: TOFEntry[] = [
  // ============================================================
  // CO OXIDATION
  // ============================================================
  {
    id: "CO-ox-Pt",
    reaction: "CO + ½O₂ → CO₂",
    catalyst: "Pt/γ-Al₂O₃",
    metal: "Pt",
    TOF_ref: 3.5,
    T_ref_C: 200,
    Ea_kJ_mol: 80,
    reactionOrder: 1,
    conditions: "1% CO, 10% O₂, balance N₂, GHSV 50,000 h⁻¹",
    reference: "Allian et al., JACS 133 (2011) 4498",
    catalystTypes: ["DOC", "TWC"],
  },
  {
    id: "CO-ox-Pd",
    reaction: "CO + ½O₂ → CO₂",
    catalyst: "Pd/γ-Al₂O₃",
    metal: "Pd",
    TOF_ref: 5.2,
    T_ref_C: 200,
    Ea_kJ_mol: 75,
    reactionOrder: 1,
    conditions: "1% CO, 10% O₂, balance N₂",
    reference: "Datye et al., J. Catal. 198 (2001) 179",
    catalystTypes: ["DOC", "TWC"],
  },
  {
    id: "CO-ox-PtPd",
    reaction: "CO + ½O₂ → CO₂",
    catalyst: "Pt-Pd/γ-Al₂O₃ (bimetallic)",
    metal: "Pt",
    TOF_ref: 8.0,
    T_ref_C: 200,
    Ea_kJ_mol: 70,
    reactionOrder: 1,
    conditions: "0.1% CO, 10% O₂, 5% H₂O, balance N₂",
    reference: "Morlang et al., Appl. Catal. B 60 (2005) 191",
    catalystTypes: ["DOC"],
  },

  // ============================================================
  // HC OXIDATION
  // ============================================================
  {
    id: "HC-ox-Pt-C3H6",
    reaction: "C₃H₆ + 4.5O₂ → 3CO₂ + 3H₂O",
    catalyst: "Pt/γ-Al₂O₃",
    metal: "Pt",
    TOF_ref: 1.8,
    T_ref_C: 250,
    Ea_kJ_mol: 95,
    reactionOrder: 1,
    conditions: "500 ppm C₃H₆, 10% O₂, 5% H₂O",
    reference: "Yao, J. Catal. 87 (1984) 152",
    catalystTypes: ["DOC", "TWC"],
  },
  {
    id: "HC-ox-Pd-CH4",
    reaction: "CH₄ + 2O₂ → CO₂ + 2H₂O",
    catalyst: "Pd/γ-Al₂O₃",
    metal: "Pd",
    TOF_ref: 0.05,
    T_ref_C: 350,
    Ea_kJ_mol: 130,
    reactionOrder: 1,
    conditions: "1000 ppm CH₄, 10% O₂, 5% H₂O — methane is very stable",
    reference: "Gélin & Primet, Appl. Catal. B 39 (2002) 1",
    catalystTypes: ["DOC"],
  },

  // ============================================================
  // NO OXIDATION
  // ============================================================
  {
    id: "NO-ox-Pt",
    reaction: "NO + ½O₂ ⇌ NO₂",
    catalyst: "Pt/γ-Al₂O₃",
    metal: "Pt",
    TOF_ref: 0.8,
    T_ref_C: 300,
    Ea_kJ_mol: 45,
    reactionOrder: 1,
    conditions: "200 ppm NO, 10% O₂, 5% H₂O — equilibrium-limited above 400°C",
    reference: "Olsson et al., J. Catal. 210 (2002) 340",
    catalystTypes: ["DOC"],
  },

  // ============================================================
  // NOₓ REDUCTION (TWC)
  // ============================================================
  {
    id: "NO-red-Rh",
    reaction: "NO + CO → ½N₂ + CO₂",
    catalyst: "Rh/γ-Al₂O₃",
    metal: "Rh",
    TOF_ref: 4.5,
    T_ref_C: 300,
    Ea_kJ_mol: 85,
    reactionOrder: 1,
    conditions: "0.1% NO, 1% CO, λ = 1.0",
    reference: "Shelef & Graham, Catal. Rev. 36 (1994) 433",
    catalystTypes: ["TWC"],
  },

  // ============================================================
  // SCR (Cu-zeolite)
  // ============================================================
  {
    id: "SCR-std-Cu",
    reaction: "4NO + 4NH₃ + O₂ → 4N₂ + 6H₂O",
    catalyst: "Cu-SSZ-13 (CHA)",
    metal: "Cu",
    TOF_ref: 0.12,
    T_ref_C: 250,
    Ea_kJ_mol: 55,
    reactionOrder: 1,
    conditions: "500 ppm NO, 500 ppm NH₃, 5% O₂, 5% H₂O — standard SCR",
    reference: "Kwak et al., J. Catal. 275 (2010) 187",
    catalystTypes: ["SCR"],
  },
  {
    id: "SCR-fast-Cu",
    reaction: "NO + NO₂ + 2NH₃ → 2N₂ + 3H₂O",
    catalyst: "Cu-SSZ-13 (CHA)",
    metal: "Cu",
    TOF_ref: 1.2,
    T_ref_C: 250,
    Ea_kJ_mol: 40,
    reactionOrder: 1,
    conditions: "250 ppm NO, 250 ppm NO₂, 500 ppm NH₃, 5% O₂ — fast SCR (10× faster)",
    reference: "Tronconi et al., Catal. Today 105 (2005) 529",
    catalystTypes: ["SCR"],
  },
  {
    id: "SCR-Fe-zeolite",
    reaction: "4NO + 4NH₃ + O₂ → 4N₂ + 6H₂O",
    catalyst: "Fe-ZSM-5",
    metal: "Fe",
    TOF_ref: 0.08,
    T_ref_C: 300,
    Ea_kJ_mol: 60,
    reactionOrder: 1,
    conditions: "500 ppm NO, 500 ppm NH₃, 5% O₂, 5% H₂O",
    reference: "Brandenberger et al., Catal. Rev. 50 (2008) 492",
    catalystTypes: ["SCR"],
  },
  {
    id: "SCR-V-Ti",
    reaction: "4NO + 4NH₃ + O₂ → 4N₂ + 6H₂O",
    catalyst: "V₂O₅-WO₃/TiO₂",
    metal: "V",
    TOF_ref: 0.03,
    T_ref_C: 300,
    Ea_kJ_mol: 50,
    reactionOrder: 1,
    conditions: "500 ppm NO, 500 ppm NH₃, 5% O₂ — lower activity but SO₂ tolerant",
    reference: "Busca et al., Appl. Catal. B 18 (1998) 1",
    catalystTypes: ["SCR"],
  },

  // ============================================================
  // REFORMING (SMR)
  // ============================================================
  {
    id: "SMR-Ni",
    reaction: "CH₄ + H₂O ⇌ CO + 3H₂",
    catalyst: "Ni/α-Al₂O₃",
    metal: "Ni",
    TOF_ref: 12.0,
    T_ref_C: 550,
    Ea_kJ_mol: 240,
    reactionOrder: 1,
    conditions: "S/C = 3.0, P = 1 atm — industrial SMR conditions",
    reference: "Xu & Froment, AIChE J. 35 (1989) 88",
    catalystTypes: ["SMR"],
  },
  {
    id: "SMR-Rh",
    reaction: "CH₄ + H₂O ⇌ CO + 3H₂",
    catalyst: "Rh/CeO₂-ZrO₂",
    metal: "Rh",
    TOF_ref: 45.0,
    T_ref_C: 550,
    Ea_kJ_mol: 185,
    reactionOrder: 1,
    conditions: "S/C = 2.5, P = 1 atm — precious metal reforming",
    reference: "Jones et al., J. Catal. 259 (2008) 147",
    catalystTypes: ["SMR", "ATR"],
  },
  {
    id: "WGS-Fe",
    reaction: "CO + H₂O ⇌ CO₂ + H₂",
    catalyst: "Fe₂O₃-Cr₂O₃ (HT-WGS)",
    metal: "Fe",
    TOF_ref: 0.5,
    T_ref_C: 400,
    Ea_kJ_mol: 115,
    reactionOrder: 1,
    conditions: "10% CO, 20% H₂O, balance N₂",
    reference: "Newsome, Catal. Rev. 21 (1980) 275",
    catalystTypes: ["WGS"],
  },
  {
    id: "WGS-Cu",
    reaction: "CO + H₂O ⇌ CO₂ + H₂",
    catalyst: "CuO-ZnO/Al₂O₃ (LT-WGS)",
    metal: "Cu",
    TOF_ref: 0.15,
    T_ref_C: 250,
    Ea_kJ_mol: 80,
    reactionOrder: 1,
    conditions: "3% CO, 10% H₂O, 15% CO₂, 40% H₂",
    reference: "Ovesen et al., J. Catal. 158 (1996) 170",
    catalystTypes: ["WGS"],
  },
];

// ============================================================
// TOF-BASED ACTIVITY CALCULATION
// ============================================================

/**
 * Calculate TOF at any temperature using Arrhenius extrapolation.
 */
export function tofAtTemperature(entry: TOFEntry, T_C: number): number {
  const T_K = T_C + 273.15;
  const T_ref_K = entry.T_ref_C + 273.15;
  const Ea = entry.Ea_kJ_mol * 1000; // J/mol
  return entry.TOF_ref * Math.exp((-Ea / R_GAS) * (1 / T_K - 1 / T_ref_K));
}

/**
 * Calculate intrinsic reaction rate from TOF and catalyst characterization.
 *
 * rate [mol/(g_cat · s)] = TOF × (sites per g_cat) / N_A
 */
export function intrinsicRate(
  tof: number,
  sites_per_gCat: number
): number {
  return tof * sites_per_gCat / AVOGADRO;
}

// ============================================================
// CATALYST CHEMICAL PROFILE
// ============================================================

export interface CatalystProfile {
  id: string;
  name: string;
  catalystType: string;
  /** Characterization data */
  characterization: {
    BET_m2_g: number;
    chemisorption: ChemisorptionData;
    dispersion: DispersionResult;
    particleSize_nm: number;
    metallicSA_m2_gPGM: number;
  };
  /** Active phase */
  activePhase: {
    primaryMetal: string;
    secondaryMetal?: string;
    support: string;
    promoters: string[];
    pgmLoading_wt_percent: number;
    pgmLoading_g_ft3: number;
  };
  /** Washcoat properties */
  washcoat: {
    loading_g_L: number;
    thickness_um: number;
    porosity: number;
    poreSize_nm: number;
  };
  /** Activity data (from TOF database) */
  reactions: Array<{
    tofEntry: TOFEntry;
    measuredTOF?: number;
    measuredT_C?: number;
  }>;
}

/**
 * Generate a complete catalyst chemical profile from characterization inputs.
 */
export function generateCatalystProfile(
  name: string,
  catalystType: string,
  chemisorptionData: ChemisorptionData,
  BET_m2_g: number,
  pgmLoading_g_ft3: number,
  washcoatLoading_g_L: number,
  washcoatThickness_um: number,
  washcoatPorosity: number = 0.45,
  washcoatPoreSize_nm: number = 12
): CatalystProfile {
  const disp = calculateDispersion(chemisorptionData);

  // Find applicable TOF entries
  const applicableTOFs = TOF_DATABASE.filter((t) =>
    t.catalystTypes.includes(catalystType) &&
    t.metal === chemisorptionData.primaryMetal
  );

  return {
    id: `${catalystType}-${name.replace(/\s+/g, "-").toLowerCase()}`,
    name,
    catalystType,
    characterization: {
      BET_m2_g,
      chemisorption: chemisorptionData,
      dispersion: disp,
      particleSize_nm: disp.particleSize_nm,
      metallicSA_m2_gPGM: disp.metallicSurfaceArea_m2_gPGM,
    },
    activePhase: {
      primaryMetal: chemisorptionData.primaryMetal,
      support: "γ-Al₂O₃",
      promoters: [],
      pgmLoading_wt_percent: chemisorptionData.pgmLoading_wt_percent,
      pgmLoading_g_ft3: pgmLoading_g_ft3,
    },
    washcoat: {
      loading_g_L: washcoatLoading_g_L,
      thickness_um: washcoatThickness_um,
      porosity: washcoatPorosity,
      poreSize_nm: washcoatPoreSize_nm,
    },
    reactions: applicableTOFs.map((t) => ({ tofEntry: t })),
  };
}

// ============================================================
// TOF-BASED CATALYST SIZING
// ============================================================

export interface TOFSizingInput {
  /** Molar flow of pollutant to convert [mol/s] */
  pollutantFlow_mol_s: number;
  /** Target conversion [0–1] */
  targetConversion: number;
  /** Operating temperature [°C] */
  operatingTemp_C: number;
  /** TOF entry to use */
  tofEntry: TOFEntry;
  /** Catalyst characterization */
  dispersion: DispersionResult;
  /** Washcoat loading [g/L] */
  washcoatLoading_g_L: number;
  /** PGM loading [g/ft³] */
  pgmLoading_g_ft3: number;
}

export interface TOFSizingResult {
  /** Required reaction rate [mol/s] */
  requiredRate_mol_s: number;
  /** TOF at operating temperature [s⁻¹] */
  TOF_at_T: number;
  /** Required number of active sites */
  requiredSites: number;
  /** Required PGM mass [g] */
  requiredPGM_g: number;
  /** Required catalyst mass [g] */
  requiredCatalystMass_g: number;
  /** Required catalyst volume [L] */
  requiredVolume_L: number;
  /** Equivalent GHSV [h⁻¹] (for comparison with empirical methods) */
  equivalentGHSV: number;
  /** Molecules converted per second */
  molecules_per_second: number;
  /** Confidence level */
  confidence: "high" | "moderate" | "low";
  /** Notes */
  notes: string[];
}

/**
 * Size a catalyst from first principles using TOF and chemisorption data.
 *
 * This is the core calculation:
 *   1. Required rate = pollutant_flow × target_conversion
 *   2. TOF at T = TOF_ref × exp(-Ea/R × (1/T - 1/T_ref))
 *   3. Required sites = required_rate × N_A / TOF
 *   4. Required PGM = sites / (D × N_A / M_PGM)
 *   5. Required volume = PGM_mass / (loading_density)
 */
export function sizeCatalystFromTOF(input: TOFSizingInput): TOFSizingResult {
  const notes: string[] = [];

  // 1. Required rate
  const requiredRate = input.pollutantFlow_mol_s * input.targetConversion;

  // 2. TOF at operating temperature
  const TOF_T = tofAtTemperature(input.tofEntry, input.operatingTemp_C);

  // 3. Required sites
  const requiredMolecules_per_s = requiredRate * AVOGADRO;
  const requiredSites = requiredMolecules_per_s / TOF_T;

  // 4. Required PGM mass
  const sites_per_gPGM = input.dispersion.surfaceSites_per_gPGM;
  const requiredPGM_g = sites_per_gPGM > 0 ? requiredSites / sites_per_gPGM : 0;

  // 5. Required catalyst volume
  // PGM loading: g/ft³ → g/L (1 ft³ = 28.317 L)
  const pgm_g_per_L = input.pgmLoading_g_ft3 / 28.317;
  const requiredVolume_L = pgm_g_per_L > 0 ? requiredPGM_g / pgm_g_per_L : 0;

  // Required catalyst mass (washcoat)
  const washcoatDensity_g_L = input.washcoatLoading_g_L;
  const requiredCatalystMass_g = requiredVolume_L * washcoatDensity_g_L;

  // Equivalent GHSV (for comparison)
  // Assume exhaust is mostly N₂ at STP: ~22.4 L/mol
  const totalFlow_mol_s = input.pollutantFlow_mol_s / 0.001; // rough: pollutant is ~0.1% of total
  const Q_L_h = totalFlow_mol_s * 22.4 * 3600;
  const equivalentGHSV = requiredVolume_L > 0 ? Q_L_h / requiredVolume_L : 0;

  // Confidence assessment
  let confidence: "high" | "moderate" | "low" = "moderate";
  if (input.operatingTemp_C >= input.tofEntry.T_ref_C - 50 &&
      input.operatingTemp_C <= input.tofEntry.T_ref_C + 150) {
    confidence = "high";
  }
  if (Math.abs(input.operatingTemp_C - input.tofEntry.T_ref_C) > 200) {
    confidence = "low";
    notes.push("Operating temperature is far from reference — TOF extrapolation may be unreliable");
  }

  if (input.dispersion.dispersion < 0.1) {
    notes.push("Low dispersion (<10%) — large particles, underutilized PGM");
  }
  if (input.dispersion.dispersion > 0.6) {
    notes.push("Very high dispersion (>60%) — may be unstable under thermal aging");
  }

  if (TOF_T < 0.001) {
    notes.push("TOF extremely low at this temperature — catalyst is below light-off");
    confidence = "low";
  }

  return {
    requiredRate_mol_s: requiredRate,
    TOF_at_T: TOF_T,
    requiredSites,
    requiredPGM_g: requiredPGM_g,
    requiredCatalystMass_g,
    requiredVolume_L,
    equivalentGHSV,
    molecules_per_second: requiredMolecules_per_s,
    confidence,
    notes,
  };
}

// ============================================================
// ACTIVITY TEMPERATURE PROFILE
// ============================================================

export interface ActivityPoint {
  temperature_C: number;
  TOF: number;
  rate_mol_gCat_s: number;
  rate_mol_L_s: number;
  conversion_percent: number;
  regime: "kinetic" | "transition" | "diffusion" | "equilibrium";
}

/**
 * Generate a complete activity profile vs temperature.
 *
 * Shows how TOF, rate, and conversion evolve with temperature,
 * including the transition from kinetically-limited to diffusion-limited regime.
 */
export function generateActivityProfile(
  tofEntry: TOFEntry,
  dispResult: DispersionResult,
  catalystVolume_L: number,
  washcoatLoading_g_L: number,
  pollutantFlow_mol_s: number,
  washcoatThickness_um: number = 30,
  effectiveDiffusivity_m2_s: number = 1e-6,
  tempRange: [number, number] = [100, 600],
  steps: number = 40
): ActivityPoint[] {
  const points: ActivityPoint[] = [];
  const dt = (tempRange[1] - tempRange[0]) / (steps - 1);

  const catalystMass_g = catalystVolume_L * washcoatLoading_g_L;
  const sites_per_gCat = dispResult.surfaceSites_per_gCat;

  for (let i = 0; i < steps; i++) {
    const T_C = tempRange[0] + i * dt;
    const tof = tofAtTemperature(tofEntry, T_C);

    // Intrinsic rate [mol/(g_cat·s)]
    const r_intrinsic = tof * sites_per_gCat / AVOGADRO;

    // Thiele modulus for effectiveness factor
    const wc_m = washcoatThickness_um * 1e-6;
    const k_v = r_intrinsic * washcoatLoading_g_L * 1000; // volumetric rate constant [mol/(m³·s)] per unit conc
    const phi = wc_m * Math.sqrt(Math.abs(k_v) / (effectiveDiffusivity_m2_s + 1e-20));
    const eta = phi > 0.1 ? Math.tanh(phi) / phi : 1.0;

    // Effective rate
    const r_effective = r_intrinsic * eta;

    // Rate per liter [mol/(L·s)]
    const r_per_L = r_effective * washcoatLoading_g_L;

    // Total rate in reactor [mol/s]
    const totalRate = r_per_L * catalystVolume_L;

    // Conversion
    const conversion = pollutantFlow_mol_s > 0
      ? Math.min(100, (totalRate / pollutantFlow_mol_s) * 100)
      : 0;

    // Regime
    let regime: ActivityPoint["regime"] = "kinetic";
    if (eta < 0.5) regime = "diffusion";
    else if (eta < 0.9) regime = "transition";
    if (conversion > 99) regime = "equilibrium";

    points.push({
      temperature_C: T_C,
      TOF: tof,
      rate_mol_gCat_s: r_effective,
      rate_mol_L_s: r_per_L,
      conversion_percent: conversion,
      regime,
    });
  }

  return points;
}

// ============================================================
// PRESET CATALYST PROFILES
// ============================================================

export const PRESET_PROFILES: Record<string, () => CatalystProfile> = {
  "DOC-PtPd-Standard": () => generateCatalystProfile(
    "Standard Pt-Pd DOC", "DOC",
    { probeGas: "CO", uptake_umol_g: 45, pgmLoading_wt_percent: 1.2, primaryMetal: "Pt", measurementTemp_C: 35 },
    150, 80, 120, 30
  ),
  "DOC-Pd-Rich": () => generateCatalystProfile(
    "Pd-Rich DOC (NG)", "DOC",
    { probeGas: "CO", uptake_umol_g: 55, pgmLoading_wt_percent: 1.5, primaryMetal: "Pd", measurementTemp_C: 35 },
    180, 95, 140, 35
  ),
  "TWC-PdRh": () => generateCatalystProfile(
    "Pd-Rh TWC", "TWC",
    { probeGas: "CO", uptake_umol_g: 60, pgmLoading_wt_percent: 1.8, primaryMetal: "Pd", measurementTemp_C: 35 },
    120, 100, 150, 35
  ),
  "SCR-CuCHA": () => generateCatalystProfile(
    "Cu-SSZ-13 SCR", "SCR",
    { probeGas: "H2", uptake_umol_g: 250, pgmLoading_wt_percent: 3.0, primaryMetal: "Cu", measurementTemp_C: 35 },
    200, 0, 180, 50, 0.50, 8
  ),
  "SMR-Ni": () => generateCatalystProfile(
    "Ni/α-Al₂O₃ SMR", "SMR",
    { probeGas: "H2", uptake_umol_g: 80, pgmLoading_wt_percent: 15.0, primaryMetal: "Ni", measurementTemp_C: 35 },
    25, 0, 800, 0, 0.40, 50
  ),
  "SMR-Rh": () => generateCatalystProfile(
    "Rh/CeZrO₂ Reformer", "SMR",
    { probeGas: "CO", uptake_umol_g: 35, pgmLoading_wt_percent: 0.5, primaryMetal: "Rh", measurementTemp_C: 35 },
    60, 50, 200, 40
  ),
};
