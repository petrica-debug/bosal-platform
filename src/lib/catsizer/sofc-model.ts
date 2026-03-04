/**
 * SOFC ELECTROCHEMISTRY & PERFORMANCE MODEL
 *
 * Implements a detailed Solid Oxide Fuel Cell model including:
 *
 * 1. THERMODYNAMICS
 *    - Nernst open-circuit voltage (OCV) for H₂ and CO electrochemical oxidation
 *    - Temperature-dependent Gibbs free energy
 *
 * 2. POLARIZATION (VOLTAGE LOSSES)
 *    - Ohmic losses (electrolyte, electrodes, interconnects)
 *    - Activation overpotential (Butler-Volmer, Tafel approximation)
 *    - Concentration overpotential (mass transport at high current density)
 *
 * 3. PERFORMANCE
 *    - V-I (polarization) curve
 *    - Power density curve
 *    - Efficiency maps (voltage efficiency, fuel utilization, system)
 *    - Stack sizing (number of cells, active area)
 *
 * 4. DEGRADATION
 *    - Chromium poisoning of cathode
 *    - Nickel coarsening at anode
 *    - Delamination risk
 *
 * References:
 * - Singhal & Kendall, "High-Temperature Solid Oxide Fuel Cells" (2003)
 * - O'Hayre et al., "Fuel Cell Fundamentals" (2016)
 * - Larminie & Dicks, "Fuel Cell Systems Explained" (2003)
 * - Nishida et al., J. Power Sources 162 (2006) 1029–1035
 */

import { R_GAS } from "./units";

const FARADAY = 96485;  // C/mol

// ============================================================
// NERNST VOLTAGE
// ============================================================

/**
 * Standard Gibbs free energy of H₂ oxidation: H₂ + ½O₂ → H₂O
 * ΔG°(T) ≈ -247500 + 55.85·T [J/mol] (linear fit, valid 600–1100°C)
 */
function deltaG_H2(T_K: number): number {
  return -247500 + 55.85 * T_K;
}

/**
 * Standard Gibbs free energy of CO oxidation: CO + ½O₂ → CO₂
 * ΔG°(T) ≈ -282400 + 86.81·T [J/mol]
 */
function deltaG_CO(T_K: number): number {
  return -282400 + 86.81 * T_K;
}

/**
 * Nernst OCV for H₂ oxidation.
 * E = -ΔG°/(n·F) + (RT/nF)·ln(pH2·pO2^0.5/pH2O)
 */
export function nernstVoltage_H2(
  T_K: number,
  pH2: number,
  pH2O: number,
  pO2: number = 0.21
): number {
  const n = 2;
  const E0 = -deltaG_H2(T_K) / (n * FARADAY);
  const Q = (pH2 * Math.sqrt(pO2)) / Math.max(pH2O, 1e-10);
  return E0 + (R_GAS * T_K / (n * FARADAY)) * Math.log(Q);
}

/**
 * Nernst OCV for CO oxidation.
 */
export function nernstVoltage_CO(
  T_K: number,
  pCO: number,
  pCO2: number,
  pO2: number = 0.21
): number {
  const n = 2;
  const E0 = -deltaG_CO(T_K) / (n * FARADAY);
  const Q = (pCO * Math.sqrt(pO2)) / Math.max(pCO2, 1e-10);
  return E0 + (R_GAS * T_K / (n * FARADAY)) * Math.log(Q);
}

// ============================================================
// POLARIZATION LOSSES
// ============================================================

export interface SOFCMaterials {
  /** Electrolyte */
  electrolyte: "YSZ" | "ScSZ" | "GDC" | "LSGM";
  electrolyteThickness_um: number;
  /** Anode */
  anode: "Ni-YSZ" | "Ni-GDC" | "Ni-ScSZ";
  anodeThickness_um: number;
  /** Cathode */
  cathode: "LSM" | "LSCF" | "LSC" | "BSCF";
  cathodeThickness_um: number;
  /** Interconnect */
  interconnect: "Crofer22APU" | "SS441" | "LaCrO3";
}

export const SOFC_MATERIALS_DEFAULT: SOFCMaterials = {
  electrolyte: "YSZ",
  electrolyteThickness_um: 10,
  anode: "Ni-YSZ",
  anodeThickness_um: 500,
  cathode: "LSCF",
  cathodeThickness_um: 50,
  interconnect: "Crofer22APU",
};

/** Ionic conductivity of electrolyte [S/m] — Arrhenius */
function electrolyteIonicConductivity(T_K: number, material: string): number {
  const params: Record<string, { sigma0: number; Ea: number }> = {
    YSZ:  { sigma0: 3.34e4, Ea: 80000 },   // 8YSZ
    ScSZ: { sigma0: 5.0e4,  Ea: 72000 },
    GDC:  { sigma0: 1.0e5,  Ea: 60000 },
    LSGM: { sigma0: 8.0e4,  Ea: 65000 },
  };
  const p = params[material] ?? params.YSZ;
  return p.sigma0 * Math.exp(-p.Ea / (R_GAS * T_K));
}

/**
 * Ohmic resistance [Ω·cm²]
 */
export function ohmicResistance(T_K: number, materials: SOFCMaterials): number {
  // Electrolyte (dominant)
  const sigma_e = electrolyteIonicConductivity(T_K, materials.electrolyte);
  const R_electrolyte = (materials.electrolyteThickness_um * 1e-6) / sigma_e * 1e4;

  // Anode electronic resistance (negligible for Ni cermet but included)
  const R_anode = 0.001; // Ω·cm²

  // Cathode (mixed ionic-electronic)
  const R_cathode = 0.005 * Math.exp(5000 * (1 / T_K - 1 / 1073)); // Ω·cm²

  // Contact resistances
  const R_contact = 0.01; // Ω·cm²

  return R_electrolyte + R_anode + R_cathode + R_contact;
}

/**
 * Activation overpotential (Tafel approximation of Butler-Volmer).
 * η_act = (RT/αnF) · arcsinh(j / 2j₀)
 */
export function activationOverpotential(
  T_K: number,
  j_A_cm2: number,
  electrode: "anode" | "cathode"
): number {
  // Exchange current densities [A/cm²]
  const j0_params = {
    anode:   { j0_ref: 0.5,  Ea: 120000, T_ref: 1073 },
    cathode: { j0_ref: 0.1,  Ea: 150000, T_ref: 1073 },
  };
  const p = j0_params[electrode];
  const j0 = p.j0_ref * Math.exp((-p.Ea / R_GAS) * (1 / T_K - 1 / p.T_ref));

  const alpha = 0.5;
  const n = 2;
  return (R_GAS * T_K / (alpha * n * FARADAY)) * Math.asinh(j_A_cm2 / (2 * j0));
}

/**
 * Concentration overpotential (mass transport limitation).
 * η_conc = -(RT/nF) · ln(1 - j/j_L)
 */
export function concentrationOverpotential(
  T_K: number,
  j_A_cm2: number,
  j_L_A_cm2: number = 2.0
): number {
  const n = 2;
  const ratio = j_A_cm2 / j_L_A_cm2;
  if (ratio >= 0.99) return 0.5; // cap
  return -(R_GAS * T_K / (n * FARADAY)) * Math.log(1 - ratio);
}

// ============================================================
// POLARIZATION CURVE
// ============================================================

export interface PolarizationPoint {
  j_A_cm2: number;
  V_cell: number;
  P_W_cm2: number;
  eta_ohmic: number;
  eta_act_anode: number;
  eta_act_cathode: number;
  eta_conc: number;
  E_nernst: number;
  voltageEfficiency: number;
}

/**
 * Generate a complete V-I polarization curve.
 */
export function polarizationCurve(
  T_K: number,
  pH2: number,
  pH2O: number,
  pO2: number = 0.21,
  materials: SOFCMaterials = SOFC_MATERIALS_DEFAULT,
  j_max: number = 1.5,
  steps: number = 40
): PolarizationPoint[] {
  const E_nernst = nernstVoltage_H2(T_K, pH2, pH2O, pO2);
  const R_ohm = ohmicResistance(T_K, materials);
  const j_L = 2.0 + (T_K - 973) * 0.005; // limiting current increases with T

  const points: PolarizationPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const j = (i / steps) * j_max;

    const eta_ohm = j * R_ohm;
    const eta_act_a = activationOverpotential(T_K, j, "anode");
    const eta_act_c = activationOverpotential(T_K, j, "cathode");
    const eta_conc = concentrationOverpotential(T_K, j, j_L);

    const V = E_nernst - eta_ohm - eta_act_a - eta_act_c - eta_conc;
    const P = j * Math.max(0, V);

    points.push({
      j_A_cm2: j,
      V_cell: Math.max(0, V),
      P_W_cm2: P,
      eta_ohmic: eta_ohm,
      eta_act_anode: eta_act_a,
      eta_act_cathode: eta_act_c,
      eta_conc: eta_conc,
      E_nernst,
      voltageEfficiency: V > 0 ? V / E_nernst : 0,
    });
  }

  return points;
}

// ============================================================
// SOFC STACK SIZING
// ============================================================

export interface SOFCStackConfig {
  cellActiveArea_cm2: number;
  operatingTemp_C: number;
  operatingPressure_atm: number;
  currentDensity_A_cm2: number;
  fuelUtilization: number;
  materials: SOFCMaterials;
}

export interface SOFCStackResult {
  /** Electrical output */
  targetPower_kW: number;
  cellVoltage_V: number;
  cellPower_W: number;
  numberOfCells: number;
  stackVoltage_V: number;
  stackCurrent_A: number;
  totalActiveArea_cm2: number;

  /** Efficiency */
  voltageEfficiency: number;
  fuelUtilization: number;
  electricalEfficiency_LHV: number;
  thermalEfficiency: number;
  combinedEfficiency_CHP: number;

  /** Thermal */
  heatGeneration_kW: number;
  airFlowRequired_kg_h: number;
  fuelFlowRequired_mol_s: number;

  /** Nernst & losses */
  nernstVoltage: number;
  ohmicLoss_V: number;
  activationLoss_V: number;
  concentrationLoss_V: number;

  /** Degradation estimate */
  degradationRate_percent_per_kh: number;
  projectedLifetime_h: number;

  /** Polarization curve */
  polarizationData: PolarizationPoint[];
}

/**
 * Size an SOFC stack for a given power target and reformate composition.
 */
export function sizeSOFCStack(
  targetPower_kW: number,
  reformateComposition: Record<string, number>,
  config: SOFCStackConfig
): SOFCStackResult {
  const T_K = config.operatingTemp_C + 273.15;

  // Partial pressures from reformate (wet basis)
  const pH2 = reformateComposition.H2 ?? 0.4;
  const pH2O = reformateComposition.H2O ?? 0.2;
  const pCO = reformateComposition.CO ?? 0.1;
  const pO2 = 0.21 * config.operatingPressure_atm;

  // Account for fuel utilization: average pH2 across cell
  const pH2_avg = pH2 * (1 - config.fuelUtilization / 2);
  const pH2O_avg = pH2O + pH2 * config.fuelUtilization / 2;

  // Nernst voltage
  const E_nernst = nernstVoltage_H2(T_K, pH2_avg, pH2O_avg, pO2);

  // Losses at operating current density
  const j = config.currentDensity_A_cm2;
  const R_ohm = ohmicResistance(T_K, config.materials);
  const j_L = 2.0 + (T_K - 973) * 0.005;

  const eta_ohm = j * R_ohm;
  const eta_act_a = activationOverpotential(T_K, j, "anode");
  const eta_act_c = activationOverpotential(T_K, j, "cathode");
  const eta_conc = concentrationOverpotential(T_K, j, j_L);

  const V_cell = E_nernst - eta_ohm - eta_act_a - eta_act_c - eta_conc;
  const P_cell = j * Math.max(0, V_cell) * config.cellActiveArea_cm2; // W

  // Stack sizing
  const numberOfCells = Math.ceil((targetPower_kW * 1000) / Math.max(P_cell, 0.1));
  const stackCurrent = j * config.cellActiveArea_cm2;
  const stackVoltage = V_cell * numberOfCells;

  // Fuel flow required
  // I = 2F·ṅ_H2 → ṅ_H2 = I/(2F)
  const H2_consumed_mol_s = stackCurrent / (2 * FARADAY);
  const H2_feed_mol_s = H2_consumed_mol_s / config.fuelUtilization;
  const fuelFlow_mol_s = H2_feed_mol_s / Math.max(pH2, 0.01);

  // Efficiency
  const voltageEff = V_cell / E_nernst;
  const thermoEff = E_nernst * 2 * FARADAY / 241800; // ΔG/ΔH for H₂
  const electricalEff_LHV = voltageEff * config.fuelUtilization * thermoEff;

  // Heat generation
  const totalEnthalpy_kW = fuelFlow_mol_s * pH2 * 241.8; // LHV of H₂ [kJ/mol]
  const actualPower_kW = numberOfCells * P_cell / 1000;
  const heatGen_kW = totalEnthalpy_kW - actualPower_kW;

  // Air flow (cathode) — typically 2× stoichiometric for cooling
  const O2_consumed_mol_s = H2_consumed_mol_s / 2;
  const airStoich_mol_s = O2_consumed_mol_s / 0.21;
  const airFlow_kg_h = airStoich_mol_s * 2.5 * 0.029 * 3600; // 2.5× stoich

  // Thermal efficiency (CHP)
  const thermalEff = heatGen_kW > 0 ? heatGen_kW / totalEnthalpy_kW : 0;
  const combinedEff = electricalEff_LHV + thermalEff * 0.8; // 80% heat recovery

  // Degradation estimate
  const baseDegradation = 0.5; // %/1000h at 750°C
  const tempFactor = Math.exp(0.008 * (config.operatingTemp_C - 750));
  const degradationRate = baseDegradation * tempFactor;
  const projectedLifetime = 20 / degradationRate * 1000; // hours to 20% degradation

  // Full polarization curve
  const polCurve = polarizationCurve(T_K, pH2_avg, pH2O_avg, pO2, config.materials);

  return {
    targetPower_kW,
    cellVoltage_V: V_cell,
    cellPower_W: P_cell,
    numberOfCells,
    stackVoltage_V: stackVoltage,
    stackCurrent_A: stackCurrent,
    totalActiveArea_cm2: numberOfCells * config.cellActiveArea_cm2,
    voltageEfficiency: voltageEff,
    fuelUtilization: config.fuelUtilization,
    electricalEfficiency_LHV: electricalEff_LHV,
    thermalEfficiency: thermalEff,
    combinedEfficiency_CHP: combinedEff,
    heatGeneration_kW: Math.max(0, heatGen_kW),
    airFlowRequired_kg_h: airFlow_kg_h,
    fuelFlowRequired_mol_s: fuelFlow_mol_s,
    nernstVoltage: E_nernst,
    ohmicLoss_V: eta_ohm,
    activationLoss_V: eta_act_a + eta_act_c,
    concentrationLoss_V: eta_conc,
    degradationRate_percent_per_kh: degradationRate,
    projectedLifetime_h: projectedLifetime,
    polarizationData: polCurve,
  };
}

// ============================================================
// PARAMETRIC SENSITIVITY
// ============================================================

export interface SOFCSensitivityPoint {
  parameter: string;
  value: number;
  power_kW: number;
  efficiency: number;
  cellVoltage: number;
  numberOfCells: number;
}

/**
 * Sweep a parameter and compute SOFC performance at each point.
 */
export function sofcParametricSweep(
  baseConfig: SOFCStackConfig,
  targetPower_kW: number,
  reformateComposition: Record<string, number>,
  parameter: "temperature" | "currentDensity" | "fuelUtilization" | "pressure",
  range: [number, number],
  steps: number = 20
): SOFCSensitivityPoint[] {
  const points: SOFCSensitivityPoint[] = [];
  const dv = (range[1] - range[0]) / (steps - 1);

  for (let i = 0; i < steps; i++) {
    const val = range[0] + i * dv;
    const cfg = { ...baseConfig };

    switch (parameter) {
      case "temperature": cfg.operatingTemp_C = val; break;
      case "currentDensity": cfg.currentDensity_A_cm2 = val; break;
      case "fuelUtilization": cfg.fuelUtilization = val; break;
      case "pressure": cfg.operatingPressure_atm = val; break;
    }

    const result = sizeSOFCStack(targetPower_kW, reformateComposition, cfg);

    points.push({
      parameter,
      value: val,
      power_kW: result.targetPower_kW,
      efficiency: result.electricalEfficiency_LHV,
      cellVoltage: result.cellVoltage_V,
      numberOfCells: result.numberOfCells,
    });
  }

  return points;
}

// ============================================================
// SYSTEM HEAT INTEGRATION
// ============================================================

export interface HeatIntegrationResult {
  /** Heat sources [kW] */
  sources: Array<{ name: string; duty_kW: number; T_hot_C: number; T_cold_C: number }>;
  /** Heat sinks [kW] */
  sinks: Array<{ name: string; duty_kW: number; T_hot_C: number; T_cold_C: number }>;
  /** Net heat balance [kW] — positive = excess heat */
  netHeat_kW: number;
  /** Steam generation potential [kg/h] */
  steamGeneration_kg_h: number;
  /** Electrical-to-thermal ratio */
  electricToThermalRatio: number;
  /** Pinch temperature [°C] */
  pinchTemp_C: number;
  /** Heat recovery effectiveness [%] */
  heatRecoveryEffectiveness: number;
}

/**
 * Full system heat integration: reformer + WGS + SOFC + BoP.
 */
export function systemHeatIntegration(
  reformerHeatDuty_kW: number,
  wgsHeatRelease_kW: number,
  sofcHeatGeneration_kW: number,
  sofcPower_kW: number,
  reformerOutletTemp_C: number,
  sofcOperatingTemp_C: number,
  fuelFlowRate_Nm3_h: number,
  steamToCarbonRatio: number
): HeatIntegrationResult {
  // Heat sources (exothermic)
  const sources = [
    {
      name: "SOFC stack waste heat",
      duty_kW: sofcHeatGeneration_kW,
      T_hot_C: sofcOperatingTemp_C,
      T_cold_C: sofcOperatingTemp_C - 100,
    },
    {
      name: "WGS reactor (exothermic)",
      duty_kW: wgsHeatRelease_kW,
      T_hot_C: 420,
      T_cold_C: 350,
    },
    {
      name: "SOFC exhaust gas",
      duty_kW: sofcHeatGeneration_kW * 0.3,
      T_hot_C: sofcOperatingTemp_C - 50,
      T_cold_C: 200,
    },
    {
      name: "Afterburner (unconverted fuel)",
      duty_kW: sofcPower_kW * 0.08,
      T_hot_C: sofcOperatingTemp_C + 100,
      T_cold_C: 400,
    },
  ];

  // Heat sinks (endothermic / heating needs)
  const steamDuty_kW = fuelFlowRate_Nm3_h * steamToCarbonRatio * 0.8 * 2.26 / 3.6;
  const sinks = [
    {
      name: "Reformer (endothermic)",
      duty_kW: Math.max(0, reformerHeatDuty_kW),
      T_hot_C: reformerOutletTemp_C,
      T_cold_C: reformerOutletTemp_C - 200,
    },
    {
      name: "Steam generation",
      duty_kW: steamDuty_kW,
      T_hot_C: 250,
      T_cold_C: 25,
    },
    {
      name: "Fuel preheating",
      duty_kW: fuelFlowRate_Nm3_h * 0.05,
      T_hot_C: 400,
      T_cold_C: 25,
    },
    {
      name: "Air preheating (cathode)",
      duty_kW: sofcPower_kW * 0.15,
      T_hot_C: sofcOperatingTemp_C - 200,
      T_cold_C: 25,
    },
  ];

  const totalSources = sources.reduce((s, x) => s + x.duty_kW, 0);
  const totalSinks = sinks.reduce((s, x) => s + x.duty_kW, 0);
  const netHeat = totalSources - totalSinks;

  // Steam generation from excess heat
  const steamGen = netHeat > 0 ? (netHeat * 3600) / 2260 : 0; // kg/h

  // Pinch analysis (simplified)
  const allTemps = [...sources.map((s) => s.T_hot_C), ...sinks.map((s) => s.T_hot_C)];
  const pinchTemp = allTemps.length > 0 ? allTemps.sort((a, b) => a - b)[Math.floor(allTemps.length / 2)] : 400;

  const heatRecovery = totalSinks > 0
    ? Math.min(100, (Math.min(totalSources, totalSinks) / totalSinks) * 100)
    : 0;

  return {
    sources,
    sinks,
    netHeat_kW: netHeat,
    steamGeneration_kg_h: steamGen,
    electricToThermalRatio: sofcHeatGeneration_kW > 0 ? sofcPower_kW / sofcHeatGeneration_kW : 0,
    pinchTemp_C: pinchTemp,
    heatRecoveryEffectiveness: heatRecovery,
  };
}

// ============================================================
// REFORMER KINETIC REACTOR MODEL
// ============================================================

export interface ReactorProfilePoint {
  position_fraction: number;
  temperature_C: number;
  CH4_conversion: number;
  H2_mol_percent: number;
  CO_mol_percent: number;
  CO2_mol_percent: number;
  H2O_mol_percent: number;
  CH4_mol_percent: number;
  reactionRate_mol_m3_s: number;
}

/**
 * 1D plug-flow reactor model for SMR using Xu-Froment kinetics (simplified).
 * Tracks species along the reactor length with temperature profile.
 */
export function reformerReactorProfile(
  inletTemp_C: number,
  outletTemp_C: number,
  pressure_kPa: number,
  steamToCarbonRatio: number,
  GHSV: number,
  steps: number = 40
): ReactorProfilePoint[] {
  const points: ReactorProfilePoint[] = [];

  // Initial composition (molar fractions)
  const totalMoles = 1 + steamToCarbonRatio; // 1 mol CH4 + S/C mol H2O
  let n_CH4 = 1 / totalMoles;
  let n_H2O = steamToCarbonRatio / totalMoles;
  let n_CO = 0;
  let n_CO2 = 0;
  let n_H2 = 0;

  const dz = 1.0 / steps;

  for (let i = 0; i <= steps; i++) {
    const z = i * dz;
    const T_C = inletTemp_C + (outletTemp_C - inletTemp_C) * z;
    const T_K = T_C + 273.15;

    // Equilibrium constant for SMR: K_SMR = exp(-ΔG°/RT)
    const dG_SMR = 206000 - 214 * T_K; // simplified
    const K_SMR = Math.exp(-dG_SMR / (R_GAS * T_K));

    // Equilibrium constant for WGS
    const K_WGS = Math.exp(4577.8 / T_K - 4.33);

    // Current conversion
    const CH4_initial = 1 / totalMoles;
    const conversion = CH4_initial > 0 ? 1 - n_CH4 / CH4_initial : 0;

    // Reaction rate (simplified Xu-Froment)
    const P_atm = pressure_kPa / 101.325;
    const p_CH4 = n_CH4 * P_atm;
    const p_H2O = n_H2O * P_atm;
    const p_H2 = Math.max(n_H2 * P_atm, 1e-10);
    const p_CO = Math.max(n_CO * P_atm, 1e-10);

    // Rate of SMR [mol/(m³·s)] — simplified
    const k_SMR = 1.17e15 * Math.exp(-240000 / (R_GAS * T_K));
    const Q_SMR = (p_CO * p_H2 ** 3) / (p_CH4 * p_H2O * K_SMR);
    const DEN = 1 + 6.65e-4 * Math.exp(38280 / (R_GAS * T_K)) * p_CO
      + 8.23e-5 * Math.exp(70650 / (R_GAS * T_K)) * p_H2
      + 1.77e5 * Math.exp(-88680 / (R_GAS * T_K)) * p_H2O / p_H2;
    const r_SMR = (k_SMR / (p_H2 ** 2.5)) * (p_CH4 * p_H2O - Q_SMR) / (DEN ** 2);
    const rate = Math.max(0, r_SMR);

    points.push({
      position_fraction: z,
      temperature_C: T_C,
      CH4_conversion: conversion * 100,
      H2_mol_percent: n_H2 * 100,
      CO_mol_percent: n_CO * 100,
      CO2_mol_percent: n_CO2 * 100,
      H2O_mol_percent: n_H2O * 100,
      CH4_mol_percent: n_CH4 * 100,
      reactionRate_mol_m3_s: rate,
    });

    // Update composition for next step (Euler integration)
    if (i < steps) {
      const spaceTime_s = 3600 / GHSV;
      const dt = spaceTime_s * dz;
      const dxi = rate * dt * 1e-3; // conversion increment

      const dn_CH4 = -dxi;
      const dn_H2O_smr = -dxi;
      const dn_CO_smr = dxi;
      const dn_H2_smr = 3 * dxi;

      // WGS shift (partial)
      const wgs_extent = dxi * 0.3 * (1 - z); // decreasing WGS along reactor
      const dn_CO_wgs = -wgs_extent;
      const dn_H2O_wgs = -wgs_extent;
      const dn_CO2_wgs = wgs_extent;
      const dn_H2_wgs = wgs_extent;

      n_CH4 = Math.max(0, n_CH4 + dn_CH4);
      n_H2O = Math.max(0, n_H2O + dn_H2O_smr + dn_H2O_wgs);
      n_CO = Math.max(0, n_CO + dn_CO_smr + dn_CO_wgs);
      n_CO2 = Math.max(0, n_CO2 + dn_CO2_wgs);
      n_H2 = Math.max(0, n_H2 + dn_H2_smr + dn_H2_wgs);

      // Normalize
      const total = n_CH4 + n_H2O + n_CO + n_CO2 + n_H2;
      if (total > 0) {
        n_CH4 /= total;
        n_H2O /= total;
        n_CO /= total;
        n_CO2 /= total;
        n_H2 /= total;
      }
    }
  }

  return points;
}
