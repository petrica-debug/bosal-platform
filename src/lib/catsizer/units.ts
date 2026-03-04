export const UNITS = {
  kPa_to_atm: 1 / 101.325,
  atm_to_kPa: 101.325,
  bar_to_kPa: 100,
  kPa_to_bar: 0.01,
  psi_to_kPa: 6.8948,
  inH2O_to_kPa: 0.2491,
  mbar_to_kPa: 0.1,

  C_to_K: (c: number) => c + 273.15,
  K_to_C: (k: number) => k - 273.15,
  F_to_C: (f: number) => ((f - 32) * 5) / 9,

  L_to_m3: 0.001,
  m3_to_L: 1000,
  ft3_to_L: 28.3168,
  in3_to_L: 0.016387,

  cfm_to_m3_h: 1.699,
  scfm_to_Nm3_h: 1.699,

  ppm_to_fraction: 1e-6,
  percent_to_fraction: 0.01,

  cpsi_to_cells_cm2: 0.155,
  mil_to_mm: 0.0254,
  g_ft3_to_g_L: 0.03531,
} as const;

export const R_GAS = 8.314462; // J/(mol·K)
export const P_STP = 101.325; // kPa
export const T_STP = 273.15; // K (0°C)

export const MW: Record<string, number> = {
  CH4: 16.043,
  H2O: 18.015,
  CO: 28.01,
  CO2: 44.009,
  H2: 2.016,
  O2: 31.999,
  N2: 28.014,
  NO: 30.006,
  NO2: 46.006,
  SO2: 64.066,
  NH3: 17.031,
  C2H6: 30.069,
  C3H8: 44.096,
  Ar: 39.948,
};

export function mixtureMW(composition: Record<string, number>): number {
  let totalMW = 0;
  let totalFrac = 0;
  for (const [species, fraction] of Object.entries(composition)) {
    if (MW[species] !== undefined) {
      totalMW += fraction * MW[species];
      totalFrac += fraction;
    }
  }
  return totalFrac > 0 ? totalMW / totalFrac : 28.97;
}

export function idealGasDensity(
  T_K: number,
  P_kPa: number,
  mw_g_mol: number
): number {
  return (P_kPa * 1000 * mw_g_mol) / (R_GAS * T_K * 1000);
}

export function molarVolume(T_K: number, P_kPa: number): number {
  return (R_GAS * T_K) / (P_kPa * 1000) * 1000;
}

export function volumeFlowSTPtoActual(
  Q_Nm3_h: number,
  T_actual_K: number,
  P_actual_kPa: number
): number {
  return Q_Nm3_h * (T_actual_K / T_STP) * (P_STP / P_actual_kPa);
}

export function volumeFlowActualToSTP(
  Q_actual_m3_h: number,
  T_actual_K: number,
  P_actual_kPa: number
): number {
  return Q_actual_m3_h * (T_STP / T_actual_K) * (P_actual_kPa / P_STP);
}
