/**
 * TOF-BASED CATALYST SIZING ENGINE
 *
 * First-principles sizing: from molecules to be converted → required active sites → catalyst volume
 *
 * This module bridges the gap between:
 * - Surface science (chemisorption, dispersion, TOF) — what a chemist measures
 * - Engineering sizing (volume, pressure drop, GHSV) — what an engineer needs
 *
 * The sizing chain:
 *
 *   Exhaust composition → Molar flow of each pollutant [mol/s]
 *   × Target conversion → Required reaction rate [mol/s]
 *   ÷ TOF(T) → Required active sites [sites]
 *   ÷ (Dispersion × N_A / M_PGM) → Required PGM mass [g]
 *   ÷ PGM loading density → Required catalyst volume [L]
 *
 * This is compared against the empirical GHSV method to validate and cross-check.
 */

import { R_GAS, UNITS, MW } from "./units";
import type { EngineInputs, CatalystType, EmissionStandard } from "./types";
import type { DetailedCatalystProfile } from "./catalyst-profiles";
import { CATALYST_PROFILES_DB, getProfilesByType } from "./catalyst-profiles";
import {
  calculateDispersion,
  tofAtTemperature,
  sizeCatalystFromTOF,
  generateActivityProfile,
  type TOFSizingResult,
  type ActivityPoint,
  type TOFEntry,
  type DispersionResult,
  TOF_DATABASE,
} from "./surface-science";

const AVOGADRO = 6.022e23;

// ============================================================
// EXHAUST MOLAR FLOW CALCULATOR
// ============================================================

export interface ExhaustMolarFlows {
  totalFlow_mol_s: number;
  CO_mol_s: number;
  HC_mol_s: number;
  NOx_mol_s: number;
  PM_mol_s: number;
  SO2_mol_s: number;
  O2_mol_s: number;
  H2O_mol_s: number;
  CO2_mol_s: number;
  N2_mol_s: number;
}

/**
 * Convert engine exhaust mass flow and composition to molar flows.
 */
export function calculateExhaustMolarFlows(inputs: EngineInputs): ExhaustMolarFlows {
  // Total exhaust mass flow [kg/h] → [kg/s]
  const massFlow_kg_s = inputs.exhaustFlowRate_kg_h / 3600;

  // Average molecular weight of exhaust [g/mol]
  // Approximate from composition
  const y_O2 = inputs.O2_percent / 100;
  const y_H2O = inputs.H2O_percent / 100;
  const y_CO2 = inputs.CO2_percent / 100;
  const y_N2 = 1 - y_O2 - y_H2O - y_CO2;
  const M_avg = y_N2 * MW.N2 + y_O2 * MW.O2 + y_H2O * MW.H2O + y_CO2 * MW.CO2;

  // Total molar flow [mol/s]
  const totalFlow = (massFlow_kg_s * 1000) / M_avg;

  return {
    totalFlow_mol_s: totalFlow,
    CO_mol_s: totalFlow * inputs.CO_ppm * 1e-6,
    HC_mol_s: totalFlow * inputs.HC_ppm * 1e-6,
    NOx_mol_s: totalFlow * inputs.NOx_ppm * 1e-6,
    PM_mol_s: 0,
    SO2_mol_s: totalFlow * inputs.SO2_ppm * 1e-6,
    O2_mol_s: totalFlow * y_O2,
    H2O_mol_s: totalFlow * y_H2O,
    CO2_mol_s: totalFlow * y_CO2,
    N2_mol_s: totalFlow * y_N2,
  };
}

// ============================================================
// MULTI-SPECIES TOF SIZING
// ============================================================

export interface SpeciesSizingResult {
  species: string;
  inletConcentration_ppm: number;
  molarFlow_mol_s: number;
  targetConversion: number;
  requiredRate_mol_s: number;
  tofEntry: TOFEntry;
  TOF_at_T: number;
  requiredSites: number;
  requiredPGM_g: number;
  requiredVolume_L: number;
  molecules_per_second: number;
}

export interface TOFSystemSizingResult {
  catalystType: CatalystType;
  profile: DetailedCatalystProfile;
  operatingTemp_C: number;

  /** Per-species sizing (the limiting species determines the volume) */
  speciesSizing: SpeciesSizingResult[];

  /** Limiting species (determines minimum volume) */
  limitingSpecies: string;

  /** Required volume from TOF method [L] */
  requiredVolume_TOF_L: number;

  /** Required volume from GHSV method [L] (for comparison) */
  requiredVolume_GHSV_L: number;

  /** Ratio: TOF volume / GHSV volume */
  volumeRatio: number;

  /** Required PGM mass [g] */
  totalPGM_g: number;

  /** Activity profile (conversion vs temperature) */
  activityProfiles: Record<string, ActivityPoint[]>;

  /** Dispersion data */
  dispersion: DispersionResult;

  /** Site utilization [%] — how efficiently sites are used */
  siteUtilization_percent: number;

  /** Confidence */
  confidence: "high" | "moderate" | "low";
  notes: string[];
}

/**
 * Size a catalyst using TOF-based first-principles method.
 *
 * This is the main entry point for the TOF sizing engine.
 */
export function sizeCatalystSystemFromTOF(
  catalystType: CatalystType,
  inputs: EngineInputs,
  profileId?: string,
  ghsvDesign?: number,
  targetConversions?: Record<string, number>
): TOFSystemSizingResult {
  const notes: string[] = [];

  // Select catalyst profile
  const profiles = getProfilesByType(catalystType);
  const profile = profileId
    ? profiles.find((p) => p.id === profileId) ?? profiles[0]
    : profiles[0];

  if (!profile) {
    throw new Error(`No catalyst profile found for type: ${catalystType}`);
  }

  // Calculate exhaust molar flows
  const flows = calculateExhaustMolarFlows(inputs);
  const T_C = inputs.exhaustTemp_C;

  // Build dispersion from profile chemisorption
  const disp = calculateDispersion({
    probeGas: profile.chemisorption.probeGas,
    uptake_umol_g: profile.chemisorption.uptake_umol_gCat,
    pgmLoading_wt_percent: profile.composition.pgm_wt_percent,
    primaryMetal: metalKey(profile),
    measurementTemp_C: profile.chemisorption.measurementTemp_C,
  });

  // Default target conversions
  const targets = targetConversions ?? defaultTargets(catalystType);

  // Species to size for
  const speciesMap = buildSpeciesMap(catalystType, flows, targets);

  // Find applicable TOF entries from profile activity data
  const speciesSizing: SpeciesSizingResult[] = [];
  const activityProfiles: Record<string, ActivityPoint[]> = {};

  for (const [species, { flow, target }] of Object.entries(speciesMap)) {
    const reaction = profile.activity.reactions.find((r) =>
      r.species.toLowerCase() === species.toLowerCase()
    );

    if (!reaction || flow <= 0) continue;

    // Build a TOFEntry from profile data
    const tofEntry: TOFEntry = {
      id: `${profile.id}-${species}`,
      reaction: reaction.name,
      catalyst: profile.name,
      metal: metalKey(profile),
      TOF_ref: reaction.TOF_ref,
      T_ref_C: reaction.T_ref_C,
      Ea_kJ_mol: reaction.Ea_kJ_mol,
      reactionOrder: 1,
      conditions: reaction.conditions,
      reference: "Profile database",
      catalystTypes: [catalystType],
    };

    const tof_T = tofAtTemperature(tofEntry, T_C);
    const requiredRate = flow * target;
    const requiredMolecules = requiredRate * AVOGADRO;
    const requiredSites = tof_T > 0 ? requiredMolecules / tof_T : Infinity;

    // PGM mass needed
    const sites_per_gPGM = disp.surfaceSites_per_gPGM;
    const requiredPGM_g = sites_per_gPGM > 0 ? requiredSites / sites_per_gPGM : Infinity;

    // Volume from PGM loading
    const pgm_g_per_L = profile.composition.totalPGM_g_ft3 / 28.317;
    const requiredVolume = pgm_g_per_L > 0 ? requiredPGM_g / pgm_g_per_L : Infinity;

    speciesSizing.push({
      species,
      inletConcentration_ppm: speciesConcentration(species, inputs),
      molarFlow_mol_s: flow,
      targetConversion: target,
      requiredRate_mol_s: requiredRate,
      tofEntry,
      TOF_at_T: tof_T,
      requiredSites,
      requiredPGM_g: isFinite(requiredPGM_g) ? requiredPGM_g : 0,
      requiredVolume_L: isFinite(requiredVolume) ? requiredVolume : 0,
      molecules_per_second: requiredMolecules,
    });

    // Generate activity profile for this species
    activityProfiles[species] = generateActivityProfile(
      tofEntry,
      disp,
      1.0, // 1L reference volume
      profile.composition.washcoatLoading_g_L,
      flow,
      profile.composition.washcoatThickness_um,
      1e-6,
      [100, 650],
      50
    );
  }

  // Limiting species = largest required volume
  const validSizing = speciesSizing.filter((s) => s.requiredVolume_L > 0);
  const limitingSpecies = validSizing.length > 0
    ? validSizing.reduce((a, b) => a.requiredVolume_L > b.requiredVolume_L ? a : b)
    : speciesSizing[0];

  const requiredVolume_TOF = limitingSpecies?.requiredVolume_L ?? 0;
  const totalPGM = limitingSpecies?.requiredPGM_g ?? 0;

  // GHSV comparison
  const ghsv = ghsvDesign ?? defaultGHSV(catalystType);
  const Q_STP_L_h = (flows.totalFlow_mol_s * 22.414 * 3600);
  const requiredVolume_GHSV = ghsv > 0 ? Q_STP_L_h / ghsv : 0;

  const volumeRatio = requiredVolume_GHSV > 0
    ? requiredVolume_TOF / requiredVolume_GHSV
    : 0;

  // Site utilization
  const totalSitesAvailable = disp.surfaceSites_per_gCat *
    profile.composition.washcoatLoading_g_L * requiredVolume_TOF;
  const totalSitesNeeded = limitingSpecies?.requiredSites ?? 0;
  const siteUtilization = totalSitesAvailable > 0
    ? Math.min(100, (totalSitesNeeded / totalSitesAvailable) * 100)
    : 0;

  // Confidence
  let confidence: "high" | "moderate" | "low" = "moderate";
  if (volumeRatio > 0.5 && volumeRatio < 2.0) confidence = "high";
  if (volumeRatio > 3.0 || volumeRatio < 0.3) {
    confidence = "low";
    notes.push(`TOF sizing differs significantly from GHSV (ratio: ${volumeRatio.toFixed(2)}) — verify catalyst characterization data`);
  }

  if (T_C < (profile.operatingWindow.minTemp_C)) {
    notes.push(`Operating temperature (${T_C}°C) is below catalyst minimum (${profile.operatingWindow.minTemp_C}°C)`);
    confidence = "low";
  }

  return {
    catalystType,
    profile,
    operatingTemp_C: T_C,
    speciesSizing,
    limitingSpecies: limitingSpecies?.species ?? "unknown",
    requiredVolume_TOF_L: requiredVolume_TOF,
    requiredVolume_GHSV_L: requiredVolume_GHSV,
    volumeRatio,
    totalPGM_g: totalPGM,
    activityProfiles,
    dispersion: disp,
    siteUtilization_percent: siteUtilization,
    confidence,
    notes,
  };
}

// ============================================================
// MULTI-POINT CONVERSION PROFILE
// ============================================================

export interface ConversionProfilePoint {
  temperature_C: number;
  species: Record<string, {
    TOF: number;
    rate_mol_s: number;
    conversion_percent: number;
    regime: string;
  }>;
}

/**
 * Generate conversion-vs-temperature data for all species on a given catalyst.
 * This is the "light-off curve" that engineers use to validate catalyst performance.
 */
export function generateConversionProfile(
  profile: DetailedCatalystProfile,
  catalystVolume_L: number,
  exhaustFlows: ExhaustMolarFlows,
  tempRange: [number, number] = [100, 650],
  steps: number = 50
): ConversionProfilePoint[] {
  const disp = calculateDispersion({
    probeGas: profile.chemisorption.probeGas,
    uptake_umol_g: profile.chemisorption.uptake_umol_gCat,
    pgmLoading_wt_percent: profile.composition.pgm_wt_percent,
    primaryMetal: metalKey(profile),
    measurementTemp_C: profile.chemisorption.measurementTemp_C,
  });

  const points: ConversionProfilePoint[] = [];
  const dt = (tempRange[1] - tempRange[0]) / (steps - 1);

  for (let i = 0; i < steps; i++) {
    const T_C = tempRange[0] + i * dt;
    const speciesData: ConversionProfilePoint["species"] = {};

    for (const reaction of profile.activity.reactions) {
      const species = reaction.species;
      const flow = speciesFlow(species, exhaustFlows);
      if (flow <= 0) continue;

      const tofEntry: TOFEntry = {
        id: `${profile.id}-${species}`,
        reaction: reaction.name,
        catalyst: profile.name,
        metal: metalKey(profile),
        TOF_ref: reaction.TOF_ref,
        T_ref_C: reaction.T_ref_C,
        Ea_kJ_mol: reaction.Ea_kJ_mol,
        reactionOrder: 1,
        conditions: reaction.conditions,
        reference: "Profile database",
        catalystTypes: [profile.catalystType],
      };

      const tof = tofAtTemperature(tofEntry, T_C);
      const r_intrinsic = tof * disp.surfaceSites_per_gCat / AVOGADRO;

      // Effectiveness factor (simplified Thiele)
      const wc_m = profile.composition.washcoatThickness_um * 1e-6;
      const k_v = r_intrinsic * profile.composition.washcoatLoading_g_L * 1000;
      const D_eff = 1e-6;
      const phi = wc_m * Math.sqrt(Math.abs(k_v) / (D_eff + 1e-20));
      const eta = phi > 0.1 ? Math.tanh(phi) / phi : 1.0;

      const r_effective = r_intrinsic * eta;
      const totalRate = r_effective * profile.composition.washcoatLoading_g_L * catalystVolume_L;
      const conversion = Math.min(
        reaction.maxConversion_percent,
        (totalRate / flow) * 100
      );

      let regime = "kinetic";
      if (eta < 0.5) regime = "diffusion-limited";
      else if (eta < 0.9) regime = "transition";
      if (conversion >= reaction.maxConversion_percent * 0.99) regime = "equilibrium";

      speciesData[species] = {
        TOF: tof,
        rate_mol_s: totalRate,
        conversion_percent: Math.max(0, conversion),
        regime,
      };
    }

    points.push({ temperature_C: T_C, species: speciesData });
  }

  return points;
}

// ============================================================
// SPECIES PROFILE ALONG REACTOR
// ============================================================

export interface ReactorPositionPoint {
  position_mm: number;
  position_fraction: number;
  species: Record<string, {
    concentration_ppm: number;
    conversion_percent: number;
    localRate_mol_m3_s: number;
  }>;
  temperature_C: number;
}

/**
 * Generate species concentration profiles along the reactor length.
 * Shows how pollutants are consumed as gas flows through the catalyst.
 */
export function generateReactorProfile(
  profile: DetailedCatalystProfile,
  catalystLength_mm: number,
  catalystDiameter_mm: number,
  exhaustFlows: ExhaustMolarFlows,
  inletTemp_C: number,
  steps: number = 30
): ReactorPositionPoint[] {
  const disp = calculateDispersion({
    probeGas: profile.chemisorption.probeGas,
    uptake_umol_g: profile.chemisorption.uptake_umol_gCat,
    pgmLoading_wt_percent: profile.composition.pgm_wt_percent,
    primaryMetal: metalKey(profile),
    measurementTemp_C: profile.chemisorption.measurementTemp_C,
  });

  const totalVolume_L = Math.PI * (catalystDiameter_mm / 2000) ** 2 * (catalystLength_mm / 1000) * 1000;
  const dz = catalystLength_mm / steps;
  const dV_L = totalVolume_L / steps;

  const points: ReactorPositionPoint[] = [];

  // Track remaining species flows
  const remaining: Record<string, number> = {};
  const initial: Record<string, number> = {};

  for (const reaction of profile.activity.reactions) {
    const sp = reaction.species;
    const flow = speciesFlow(sp, exhaustFlows);
    remaining[sp] = flow;
    initial[sp] = flow;
  }

  let T_C = inletTemp_C;

  for (let i = 0; i <= steps; i++) {
    const z_mm = i * dz;
    const speciesData: ReactorPositionPoint["species"] = {};

    for (const reaction of profile.activity.reactions) {
      const sp = reaction.species;
      const flow = remaining[sp] ?? 0;
      const initFlow = initial[sp] ?? 1;

      const concentration_ppm = exhaustFlows.totalFlow_mol_s > 0
        ? (flow / exhaustFlows.totalFlow_mol_s) * 1e6
        : 0;

      const conversion = initFlow > 0
        ? ((initFlow - flow) / initFlow) * 100
        : 0;

      // Local rate at this position
      const tofEntry: TOFEntry = {
        id: `${profile.id}-${sp}`,
        reaction: reaction.name,
        catalyst: profile.name,
        metal: metalKey(profile),
        TOF_ref: reaction.TOF_ref,
        T_ref_C: reaction.T_ref_C,
        Ea_kJ_mol: reaction.Ea_kJ_mol,
        reactionOrder: 1,
        conditions: reaction.conditions,
        reference: "Profile database",
        catalystTypes: [profile.catalystType],
      };

      const tof = tofAtTemperature(tofEntry, T_C);
      const r_intrinsic = tof * disp.surfaceSites_per_gCat / AVOGADRO;

      // Scale rate by remaining concentration (first-order)
      const concFraction = initFlow > 0 ? flow / initFlow : 0;
      const r_local = r_intrinsic * concFraction;

      // Effectiveness factor
      const wc_m = profile.composition.washcoatThickness_um * 1e-6;
      const k_v = r_local * profile.composition.washcoatLoading_g_L * 1000;
      const phi = wc_m * Math.sqrt(Math.abs(k_v) / (1e-6 + 1e-20));
      const eta = phi > 0.1 ? Math.tanh(phi) / phi : 1.0;

      const r_eff = r_local * eta;
      const localRate_mol_m3_s = r_eff * profile.composition.washcoatLoading_g_L * 1000;

      speciesData[sp] = {
        concentration_ppm,
        conversion_percent: conversion,
        localRate_mol_m3_s: localRate_mol_m3_s,
      };

      // Update remaining flow for next step
      if (i < steps) {
        const consumed = r_eff * profile.composition.washcoatLoading_g_L * dV_L;
        remaining[sp] = Math.max(0, flow - consumed);
      }
    }

    // Adiabatic temperature rise from exothermic reactions
    if (i < steps) {
      const totalConsumed_mol_s = Object.entries(remaining).reduce((sum, [sp, flow]) => {
        const prev = points.length > 0
          ? (points[points.length - 1].species[sp]?.concentration_ppm ?? 0) * exhaustFlows.totalFlow_mol_s * 1e-6
          : initial[sp] ?? 0;
        return sum + Math.max(0, prev - flow);
      }, 0);
      // ~50 kJ/mol average heat of reaction, Cp_exhaust ≈ 1100 J/(kg·K)
      const massFlow_kg_s = exhaustFlows.totalFlow_mol_s * 0.029;
      if (massFlow_kg_s > 0) {
        T_C += (totalConsumed_mol_s * 50000) / (massFlow_kg_s * 1100);
      }
    }

    points.push({
      position_mm: z_mm,
      position_fraction: z_mm / catalystLength_mm,
      species: speciesData,
      temperature_C: T_C,
    });
  }

  return points;
}

// ============================================================
// HELPERS
// ============================================================

function metalKey(profile: DetailedCatalystProfile): "Pt" | "Pd" | "Rh" | "Ni" | "Cu" | "Fe" | "V" | "Ru" {
  const phase = profile.composition.activePhase.toLowerCase();
  if (phase.includes("rh")) return "Rh";
  if (phase.includes("pd")) return "Pd";
  if (phase.includes("pt")) return "Pt";
  if (phase.includes("ni")) return "Ni";
  if (phase.includes("cu")) return "Cu";
  if (phase.includes("fe")) return "Fe";
  if (phase.includes("v")) return "V";
  return "Pt";
}

function defaultTargets(type: CatalystType): Record<string, number> {
  switch (type) {
    case "DOC": return { CO: 0.95, HC: 0.90, NOx: 0.50 };
    case "TWC": return { CO: 0.98, HC: 0.95, NOx: 0.95 };
    case "SCR": return { NOx: 0.95 };
    case "ASC": return { NOx: 0.50 };
    default: return { CO: 0.90 };
  }
}

function defaultGHSV(type: CatalystType): number {
  switch (type) {
    case "DOC": return 120000;
    case "TWC": return 80000;
    case "SCR": return 30000;
    case "ASC": return 150000;
    case "DPF": return 100000;
    default: return 50000;
  }
}

function buildSpeciesMap(
  type: CatalystType,
  flows: ExhaustMolarFlows,
  targets: Record<string, number>
): Record<string, { flow: number; target: number }> {
  const map: Record<string, { flow: number; target: number }> = {};
  if (targets.CO !== undefined) map.CO = { flow: flows.CO_mol_s, target: targets.CO };
  if (targets.HC !== undefined) map.HC = { flow: flows.HC_mol_s, target: targets.HC };
  if (targets.NOx !== undefined) map.NOx = { flow: flows.NOx_mol_s, target: targets.NOx };
  return map;
}

function speciesConcentration(species: string, inputs: EngineInputs): number {
  switch (species) {
    case "CO": return inputs.CO_ppm;
    case "HC": return inputs.HC_ppm;
    case "NOx": return inputs.NOx_ppm;
    default: return 0;
  }
}

function speciesFlow(species: string, flows: ExhaustMolarFlows): number {
  switch (species) {
    case "CO": return flows.CO_mol_s;
    case "HC": return flows.HC_mol_s;
    case "NOx": return flows.NOx_mol_s;
    default: return 0;
  }
}
