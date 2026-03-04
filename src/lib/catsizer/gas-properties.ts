import { R_GAS, MW, mixtureMW } from "./units";

// ============================================================
// NASA 7-COEFFICIENT POLYNOMIALS
// Two temperature ranges: 200–1000 K (low) and 1000–6000 K (high)
// Format: [a1, a2, a3, a4, a5, a6, a7]
// Cp/R = a1 + a2*T + a3*T² + a4*T³ + a5*T⁴
// H/(RT) = a1 + a2*T/2 + a3*T²/3 + a4*T³/4 + a5*T⁴/5 + a6/T
// S/R = a1*ln(T) + a2*T + a3*T²/2 + a4*T³/3 + a5*T⁴/4 + a7
// ============================================================

type NASACoeffs = [number, number, number, number, number, number, number];

interface NASAData {
  low: NASACoeffs; // 200–1000 K
  high: NASACoeffs; // 1000–6000 K
  Tswitch: number;
}

const NASA_POLYNOMIALS: Record<string, NASAData> = {
  CH4: {
    low: [5.14988e0, -1.36710e-2, 4.91801e-5, -4.84744e-8, 1.66694e-11, -1.02466e4, -4.64130e0],
    high: [7.48515e-1, 1.33909e-2, -5.73286e-6, 1.22293e-9, -1.01815e-13, -9.46834e3, 1.84373e1],
    Tswitch: 1000,
  },
  H2O: {
    low: [4.19864e0, -2.03643e-3, 6.52040e-6, -5.48797e-9, 1.77198e-12, -3.02937e4, -8.49032e-1],
    high: [3.03399e0, 2.17692e-3, -1.64073e-7, -9.70420e-11, 1.68201e-14, -3.00043e4, 4.96677e0],
    Tswitch: 1000,
  },
  CO: {
    low: [3.57953e0, -6.10354e-4, 1.01681e-6, 9.07006e-10, -9.04424e-13, -1.43441e4, 3.50840e0],
    high: [2.71519e0, 2.06253e-3, -9.98826e-7, 2.30053e-10, -2.03648e-14, -1.41519e4, 7.81869e0],
    Tswitch: 1000,
  },
  CO2: {
    low: [2.35677e0, 8.98459e-3, -7.12356e-6, 2.45919e-9, -1.43700e-13, -4.83720e4, 9.90105e0],
    high: [3.85746e0, 4.41437e-3, -2.21481e-6, 5.23490e-10, -4.72084e-14, -4.87592e4, 2.27164e0],
    Tswitch: 1000,
  },
  H2: {
    low: [2.34433e0, 7.98052e-3, -1.94782e-5, 2.01572e-8, -7.37612e-12, -9.17935e2, 6.83010e-1],
    high: [3.33728e0, -4.94025e-5, 4.99457e-7, -1.79566e-10, 2.00255e-14, -9.50159e2, -3.20502e0],
    Tswitch: 1000,
  },
  O2: {
    low: [3.78246e0, -2.99673e-3, 9.84730e-6, -9.68130e-9, 3.24373e-12, -1.06394e3, 3.65768e0],
    high: [3.28254e0, 1.48309e-3, -7.57967e-7, 2.09471e-10, -2.16718e-14, -1.08846e3, 5.45323e0],
    Tswitch: 1000,
  },
  N2: {
    low: [3.53101e0, -1.23661e-4, -5.02999e-7, 2.43531e-9, -1.40881e-12, -1.04698e3, 2.96747e0],
    high: [2.95258e0, 1.39690e-3, -4.92632e-7, 7.86010e-11, -4.60755e-15, -9.23949e2, 5.87189e0],
    Tswitch: 1000,
  },
  NO: {
    low: [4.21860e0, -4.63893e-3, 1.10443e-5, -9.33622e-9, 2.80382e-12, 9.84510e3, 2.28061e0],
    high: [3.26071e0, 1.19101e-3, -4.29122e-7, 6.94481e-11, -4.03295e-15, 9.92146e3, 6.36900e0],
    Tswitch: 1000,
  },
  NO2: {
    low: [3.94403e0, -1.58543e-3, 1.66578e-5, -2.04754e-8, 7.83505e-12, 2.89662e3, 6.31199e0],
    high: [4.88475e0, 2.17240e-3, -8.28070e-7, 1.57477e-10, -1.05108e-14, 2.31650e3, -1.17417e-1],
    Tswitch: 1000,
  },
  NH3: {
    low: [4.28618e0, -4.66065e-3, 2.17180e-5, -2.28081e-8, 8.26390e-12, -6.74156e3, -6.25410e-1],
    high: [2.63453e0, 5.66624e-3, -1.72789e-6, 2.38679e-10, -1.23699e-14, -6.54460e3, 6.56621e0],
    Tswitch: 1000,
  },
  SO2: {
    low: [3.26653e0, 5.32380e-3, 6.84376e-7, -5.28100e-9, 2.55905e-12, -3.69082e4, 9.66465e0],
    high: [5.24514e0, 1.97042e-3, -8.03757e-7, 1.51500e-10, -1.05580e-14, -3.75688e4, -1.07405e0],
    Tswitch: 1000,
  },
  C2H6: {
    low: [4.29142e0, -5.50154e-3, 5.99438e-5, -7.08466e-8, 2.68686e-11, -1.15222e4, 2.66682e0],
    high: [1.07188e0, 2.16853e-2, -1.00256e-5, 2.21412e-9, -1.90003e-13, -1.14264e4, 1.51156e1],
    Tswitch: 1000,
  },
  C3H8: {
    low: [4.21094e0, 1.71887e-3, 7.06537e-5, -9.20054e-8, 3.64633e-11, -1.43990e4, 5.61210e0],
    high: [7.53414e-1, 3.14071e-2, -1.50463e-5, 3.40661e-9, -2.97813e-13, -1.46485e4, 1.84756e1],
    Tswitch: 1000,
  },
};

function getCoeffs(species: string, T_K: number): NASACoeffs {
  const data = NASA_POLYNOMIALS[species];
  if (!data) {
    return [3.5, 0, 0, 0, 0, 0, 0]; // Fallback: monatomic ideal
  }
  return T_K < data.Tswitch ? data.low : data.high;
}

/**
 * Molar heat capacity at constant pressure Cp [J/(mol·K)]
 */
export function speciesCp(species: string, T_K: number): number {
  const a = getCoeffs(species, T_K);
  const CpOverR = a[0] + a[1] * T_K + a[2] * T_K ** 2 + a[3] * T_K ** 3 + a[4] * T_K ** 4;
  return CpOverR * R_GAS;
}

/**
 * Molar enthalpy H [J/mol]
 */
export function speciesH(species: string, T_K: number): number {
  const a = getCoeffs(species, T_K);
  const HOverRT =
    a[0] +
    (a[1] * T_K) / 2 +
    (a[2] * T_K ** 2) / 3 +
    (a[3] * T_K ** 3) / 4 +
    (a[4] * T_K ** 4) / 5 +
    a[5] / T_K;
  return HOverRT * R_GAS * T_K;
}

/**
 * Molar entropy S [J/(mol·K)]
 */
export function speciesS(species: string, T_K: number): number {
  const a = getCoeffs(species, T_K);
  const SOverR =
    a[0] * Math.log(T_K) +
    a[1] * T_K +
    (a[2] * T_K ** 2) / 2 +
    (a[3] * T_K ** 3) / 3 +
    (a[4] * T_K ** 4) / 4 +
    a[6];
  return SOverR * R_GAS;
}

/**
 * Standard Gibbs free energy of formation ΔG°f [J/mol]
 */
export function speciesG(species: string, T_K: number): number {
  return speciesH(species, T_K) - T_K * speciesS(species, T_K);
}

// ============================================================
// MIXTURE PROPERTIES
// ============================================================

export type GasComposition = Record<string, number>; // species → mole fraction

/**
 * Mixture molar Cp [J/(mol·K)]
 */
export function mixtureCp(T_K: number, composition: GasComposition): number {
  let cp = 0;
  for (const [species, fraction] of Object.entries(composition)) {
    if (fraction > 0 && NASA_POLYNOMIALS[species]) {
      cp += fraction * speciesCp(species, T_K);
    }
  }
  return cp;
}

/**
 * Mixture mass-based Cp [J/(kg·K)]
 */
export function mixtureCpMass(T_K: number, composition: GasComposition): number {
  const molarCp = mixtureCp(T_K, composition);
  const mw = mixtureMW(composition) / 1000; // kg/mol
  return molarCp / mw;
}

/**
 * Mixture molar enthalpy [J/mol]
 */
export function mixtureH(T_K: number, composition: GasComposition): number {
  let h = 0;
  for (const [species, fraction] of Object.entries(composition)) {
    if (fraction > 0 && NASA_POLYNOMIALS[species]) {
      h += fraction * speciesH(species, T_K);
    }
  }
  return h;
}

/**
 * Gas dynamic viscosity [Pa·s] using Sutherland's law approximation
 * For exhaust gas mixtures, we use a simplified correlation
 */
export function gasViscosity(T_K: number, composition: GasComposition): number {
  const mw = mixtureMW(composition);
  const T_ref = 473.15; // 200°C reference
  const mu_ref = 2.5e-5; // Pa·s at reference (typical exhaust)
  const S = 110.4; // Sutherland constant for air-like mixtures

  let mu = mu_ref * (T_K / T_ref) ** 1.5 * ((T_ref + S) / (T_K + S));

  // Light gases (H₂-rich) have lower viscosity
  const h2Frac = composition.H2 ?? 0;
  if (h2Frac > 0.1) {
    mu *= 1 - 0.4 * h2Frac; // H₂ reduces mixture viscosity significantly
  }

  // MW correction: heavier gases are more viscous
  mu *= Math.sqrt(mw / 29); // Normalize to air MW

  return mu;
}

/**
 * Gas density [kg/m³] from ideal gas law
 */
export function gasDensity(
  T_K: number,
  P_kPa: number,
  composition: GasComposition
): number {
  const mw = mixtureMW(composition) / 1000; // kg/mol
  return (P_kPa * 1000 * mw) / (R_GAS * T_K);
}

/**
 * Gas thermal conductivity [W/(m·K)] — simplified Eucken correlation
 */
export function gasThermalConductivity(
  T_K: number,
  composition: GasComposition
): number {
  const mu = gasViscosity(T_K, composition);
  const cp = mixtureCpMass(T_K, composition);
  const mw = mixtureMW(composition);

  // Eucken: λ = (Cp + 5R/(4M)) × μ
  const gamma = cp / (cp - R_GAS * 1000 / mw);
  return mu * (cp + (1.25 * R_GAS * 1000) / mw) * (9 * gamma - 5) / (4 * gamma);
}

/**
 * Exhaust gas composition (mole fractions) from engine parameters
 */
export function exhaustComposition(inputs: {
  O2_percent: number;
  H2O_percent: number;
  CO2_percent: number;
  CO_ppm: number;
  HC_ppm: number;
  NOx_ppm: number;
  SO2_ppm: number;
}): GasComposition {
  const comp: GasComposition = {
    O2: inputs.O2_percent / 100,
    H2O: inputs.H2O_percent / 100,
    CO2: inputs.CO2_percent / 100,
    CO: inputs.CO_ppm * 1e-6,
    NO: inputs.NOx_ppm * 1e-6 * 0.9, // ~90% NO
    NO2: inputs.NOx_ppm * 1e-6 * 0.1,
    SO2: inputs.SO2_ppm * 1e-6,
  };

  // Balance is N₂
  const sum = Object.values(comp).reduce((a, b) => a + b, 0);
  comp.N2 = Math.max(0, 1 - sum);

  return comp;
}

/**
 * Reformer feed composition (mole fractions) from fuel + steam + optional O₂
 */
export function reformerFeedComposition(inputs: {
  CH4_percent: number;
  C2H6_percent: number;
  C3H8_percent: number;
  CO2_percent: number;
  N2_percent: number;
  steamToCarbonRatio: number;
  oxygenToCarbonRatio?: number;
}): GasComposition {
  // Total carbon atoms per mole of fuel
  const totalC =
    inputs.CH4_percent / 100 +
    2 * (inputs.C2H6_percent / 100) +
    3 * (inputs.C3H8_percent / 100);

  const steamMoles = inputs.steamToCarbonRatio * totalC;
  const oxygenMoles = (inputs.oxygenToCarbonRatio ?? 0) * totalC;

  const totalMoles =
    1 + // 1 mole of fuel mixture
    steamMoles +
    oxygenMoles +
    (oxygenMoles > 0 ? oxygenMoles * (79 / 21) : 0); // N₂ from air if O₂ used

  return {
    CH4: inputs.CH4_percent / 100 / totalMoles,
    C2H6: inputs.C2H6_percent / 100 / totalMoles,
    C3H8: inputs.C3H8_percent / 100 / totalMoles,
    CO2: inputs.CO2_percent / 100 / totalMoles,
    N2:
      (inputs.N2_percent / 100 +
        (oxygenMoles > 0 ? oxygenMoles * (79 / 21) : 0)) /
      totalMoles,
    H2O: steamMoles / totalMoles,
    O2: oxygenMoles / totalMoles,
    H2: 0,
    CO: 0,
  };
}

export { MW, mixtureMW };
