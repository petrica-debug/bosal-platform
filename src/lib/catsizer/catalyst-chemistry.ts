/**
 * Catalyst chemistry engine — OSC thermodynamics, PGM sintering/dispersion,
 * poison accumulation, and thermal aging equivalence.
 *
 * All models are semi-empirical correlations calibrated to published TWC data
 * (SAE 2018-01-0950, SAE 2020-01-0654, Johnson Matthey Technol. Rev. 2016).
 */

/* ================================================================== */
/*  Constants                                                         */
/* ================================================================== */

const R_GAS = 8.314; // J/(mol·K)

/* ================================================================== */
/*  A1. OSC Thermodynamic Model                                       */
/* ================================================================== */

export interface OscResult {
  freshUmolO2PerG: number;
  agedUmolO2PerG: number;
  retentionPct: number;
  freshUmolO2PerBrick: number;
  agedUmolO2PerBrick: number;
  /** Crystallite size growth from ~5nm fresh */
  crystalliteSizeNm: number;
}

/**
 * CeO2-ZrO2 solid solution OSC model.
 *
 * Fresh OSC scales with Ce content (max ~600 µmol O2/g at Ce0.50).
 * Aging follows Arrhenius-exponential decay driven by crystallite coarsening.
 */
export function computeOscCapacity(params: {
  cePercent: number;
  zrPercent?: number;
  agingTempC: number;
  agingHours: number;
  oscLoadingGPerL: number;
  substrateVolumeL: number;
}): OscResult {
  const { cePercent, agingTempC, agingHours, oscLoadingGPerL, substrateVolumeL } = params;

  const ceFrac = cePercent / 100;
  // Ce₀.₅Zr₀.₅O₂ has maximum OSC (~600 µmol O₂/g) due to optimal lattice oxygen mobility.
  // Above ~60% Ce, CeO₂ segregation reduces OSC. Use concave parabola peaking at Ce=50%.
  const freshOsc = 2400 * ceFrac * (1 - ceFrac); // µmol O2/g — peaks at 600 at Ce=50%

  const Ea = 130_000; // J/mol — activation energy for OSC degradation
  const T = agingTempC + 273.15;
  const Tref = 1050 + 273.15;
  const kRef = 0.08; // 1/h at 1050°C reference
  const k = kRef * Math.exp((Ea / R_GAS) * (1 / Tref - 1 / T));

  const retentionFrac = Math.max(0.25, Math.exp(-k * agingHours));
  const agedOsc = freshOsc * retentionFrac;

  // Crystallite growth: volume-diffusion Ostwald ripening d³ - d0³ = K(T)·t (n=3 for CeO₂-ZrO₂)
  // Literature: Koltsakis 1997, Ozawa Appl.Cat.B 2002 — n=3 for CeO₂-based OSC
  const d0 = 5; // nm fresh
  const Kref = 7; // nm³/h at 1050°C (calibrated to give ~5.9 nm after RAT-A 12h)
  const K = Kref * Math.exp((Ea / R_GAS) * (1 / Tref - 1 / T));
  const d = Math.pow(d0 ** 3 + K * agingHours, 1 / 3);

  const massPerBrick = oscLoadingGPerL * substrateVolumeL;

  return {
    freshUmolO2PerG: +freshOsc.toFixed(1),
    agedUmolO2PerG: +agedOsc.toFixed(1),
    retentionPct: +(retentionFrac * 100).toFixed(1),
    freshUmolO2PerBrick: +(freshOsc * massPerBrick).toFixed(0),
    agedUmolO2PerBrick: +(agedOsc * massPerBrick).toFixed(0),
    crystalliteSizeNm: +d.toFixed(1),
  };
}

/* ================================================================== */
/*  A2. PGM Dispersion & Sintering                                    */
/* ================================================================== */

export type PgmMetal = "Pd" | "Rh" | "Pt";

export interface PgmDispersionResult {
  metal: PgmMetal;
  freshDispersionPct: number;
  agedDispersionPct: number;
  freshParticleSizeNm: number;
  agedParticleSizeNm: number;
  t50ShiftC: number;
}

const PGM_PARAMS: Record<PgmMetal, {
  freshDisp: number;
  d0Nm: number;
  sinterN: number;
  Ea: number;
  kRef: number;
  t50K: number;
}> = {
  // freshDisp derived from 1.1/d0 so the sintering model is active from t=0 onward
  Pd: { freshDisp: 0.44, d0Nm: 2.5, sinterN: 5, Ea: 125_000, kRef: 200, t50K: 18 },
  Rh: { freshDisp: 0.55, d0Nm: 2.0, sinterN: 7, Ea: 145_000, kRef: 80, t50K: 22 },
  Pt: { freshDisp: 0.37, d0Nm: 3.0, sinterN: 4, Ea: 115_000, kRef: 350, t50K: 15 },
};

/**
 * PGM sintering via Ostwald ripening: d^n - d0^n = K(T) * t
 * T50 shift: ΔT50 = k_t50 * ln(d_aged / d_fresh)
 */
export function computePgmDispersion(params: {
  metal: PgmMetal;
  loadingGPerL: number;
  agingTempC: number;
  agingHours: number;
}): PgmDispersionResult {
  const { metal, agingTempC, agingHours } = params;
  const p = PGM_PARAMS[metal];

  const T = agingTempC + 273.15;
  const Tref = 1050 + 273.15;
  const K = p.kRef * Math.exp((p.Ea / R_GAS) * (1 / Tref - 1 / T));

  const dAged = Math.pow(p.d0Nm ** p.sinterN + K * agingHours, 1 / p.sinterN);

  // Dispersion ≈ 1.1 / d(nm) for spherical particles
  const agedDisp = Math.min(p.freshDisp, 1.1 / dAged);

  const t50Shift = p.t50K * Math.log(dAged / p.d0Nm);

  return {
    metal,
    freshDispersionPct: +(p.freshDisp * 100).toFixed(1),
    agedDispersionPct: +(agedDisp * 100).toFixed(1),
    freshParticleSizeNm: p.d0Nm,
    agedParticleSizeNm: +dAged.toFixed(1),
    t50ShiftC: +t50Shift.toFixed(1),
  };
}

/* ================================================================== */
/*  A3. Poison Accumulation                                           */
/* ================================================================== */

export interface PoisonResult {
  sulfurMgPerBrick: number;
  phosphorusMgPerBrick: number;
  zincMgPerBrick: number;
  /** Front-face P deposition depth as fraction of brick length */
  pDepthFraction: number;
  gsaLossPct: number;
  t50ShiftFromPoisonC: number;
  activityLossPct: number;
}

/**
 * Poison accumulation from fuel sulfur (EU 10 ppm) and oil-derived ZDDP.
 * P deposits preferentially on the front face (exponential decay profile).
 */
export function computePoisonLoading(params: {
  mileageKm: number;
  fuelType: "gasoline" | "diesel";
  /** Oil consumption in L/1000km — typical 0.1-0.5 */
  oilConsumptionLPer1000km: number;
  substrateVolumeL: number;
  substrateGsaM2PerL?: number;
}): PoisonResult {
  const { mileageKm, fuelType, oilConsumptionLPer1000km, substrateVolumeL, substrateGsaM2PerL = 2.8 } = params;

  const fuelConsumptionLPer100km = fuelType === "gasoline" ? 7.5 : 6.0;
  const totalFuelL = (mileageKm / 100) * fuelConsumptionLPer100km;
  const fuelSulfurPpm = 10; // EU standard
  const fuelDensity = fuelType === "gasoline" ? 0.745 : 0.835; // kg/L

  // S from fuel: ~30% retained on catalyst
  const sMass = totalFuelL * fuelDensity * (fuelSulfurPpm / 1e6) * 0.30 * 1000; // mg

  // P from oil: ZDDP contains ~3.5% P by weight, oil density ~0.88 kg/L
  const totalOilL = (mileageKm / 1000) * oilConsumptionLPer1000km;
  const pMass = totalOilL * 0.88 * 0.035 * 0.60 * 1000; // 60% retention on cat

  // Zn co-deposits with P at ~1:1 molar ratio (Zn:P ≈ 1.05 mass ratio)
  const znMass = pMass * 1.05;

  // P penetration depth: exponential decay profile.
  // Field data (MECA 2004, SAE 2005-01-1113): ~30-35% depth at 160 000 km.
  const pDepthFraction = Math.min(0.5, 0.15 + 0.001 * (mileageKm / 1000));

  // GSA loss: P covers geometric surface area
  const totalGsa = substrateGsaM2PerL * substrateVolumeL * 1e4; // cm²
  const pCoverage = pMass / (totalGsa * pDepthFraction); // mg/cm² on affected zone
  const gsaLossPct = Math.min(40, pCoverage * 8); // ~8% loss per mg/cm²

  // T50 shift from poisoning
  const t50Shift = gsaLossPct * 0.6; // ~0.6°C per % GSA loss

  // Activity loss combines GSA loss and S poisoning of OSC
  const sActivityLoss = Math.min(15, sMass / (substrateVolumeL * 50)); // S impact on OSC
  const activityLoss = Math.min(50, gsaLossPct * 0.7 + sActivityLoss);

  return {
    sulfurMgPerBrick: +sMass.toFixed(1),
    phosphorusMgPerBrick: +pMass.toFixed(1),
    zincMgPerBrick: +znMass.toFixed(1),
    pDepthFraction: +pDepthFraction.toFixed(3),
    gsaLossPct: +gsaLossPct.toFixed(1),
    t50ShiftFromPoisonC: +t50Shift.toFixed(1),
    activityLossPct: +activityLoss.toFixed(1),
  };
}

/* ================================================================== */
/*  A4. Thermal Aging Equivalence                                     */
/* ================================================================== */

export interface AgingProtocol {
  name: string;
  tempC: number;
  hours: number;
  equivalentMileageKm: number;
}

export const STANDARD_AGING_PROTOCOLS: AgingProtocol[] = [
  { name: "RAT-A (EU standard)", tempC: 1050, hours: 12, equivalentMileageKm: 160_000 },
  { name: "ZDAKW (German)", tempC: 1000, hours: 16, equivalentMileageKm: 160_000 },
  { name: "Bosal bench standard", tempC: 1000, hours: 12, equivalentMileageKm: 120_000 },
  { name: "Ford DACT", tempC: 1050, hours: 50, equivalentMileageKm: 240_000 },
  { name: "Light aging (R103 min)", tempC: 1000, hours: 8, equivalentMileageKm: 80_000 },
];

export interface AgingEquivalenceResult {
  protocol: AgingProtocol;
  targetMileageKm: number;
  requiredHours: number;
  requiredTempC: number;
  /** Confidence: HIGH if standard protocol, MEDIUM if interpolated, LOW if extrapolated */
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

/**
 * Arrhenius equivalence: t2 = t1 * exp(Ea/R * (1/T2 - 1/T1))
 * Used to convert between aging protocols or calculate hours for target mileage.
 */
export function computeAgingEquivalence(params: {
  /** Name or index into STANDARD_AGING_PROTOCOLS */
  protocolName?: string;
  targetTempC?: number;
  targetMileageKm: number;
  Ea?: number;
}): AgingEquivalenceResult {
  const { protocolName, targetTempC, targetMileageKm, Ea = 130_000 } = params;

  const protocol = STANDARD_AGING_PROTOCOLS.find((p) =>
    protocolName ? p.name.toLowerCase().includes(protocolName.toLowerCase()) : false,
  ) ?? STANDARD_AGING_PROTOCOLS[0];

  const mileageRatio = targetMileageKm / protocol.equivalentMileageKm;
  const baseHours = protocol.hours * mileageRatio;

  const useTempC = targetTempC ?? protocol.tempC;
  const T1 = protocol.tempC + 273.15;
  const T2 = useTempC + 273.15;

  const requiredHours = baseHours * Math.exp((Ea / R_GAS) * (1 / T2 - 1 / T1));

  let confidence: "HIGH" | "MEDIUM" | "LOW" = "HIGH";
  if (Math.abs(useTempC - protocol.tempC) > 100) confidence = "LOW";
  else if (Math.abs(useTempC - protocol.tempC) > 30 || mileageRatio > 1.5) confidence = "MEDIUM";

  return {
    protocol,
    targetMileageKm,
    requiredHours: +requiredHours.toFixed(1),
    requiredTempC: useTempC,
    confidence,
  };
}

/* ================================================================== */
/*  Light-off Curve                                                   */
/* ================================================================== */

export interface LightOffPoint {
  tempC: number;
  coPct: number;
  hcPct: number;
  noxPct: number;
}

export interface LightOffCurve {
  fresh: LightOffPoint[];
  aged: LightOffPoint[];
  t50FreshCo: number;
  t50FreshHc: number;
  t50AgedCo: number;
  t50AgedHc: number;
  /** Space velocity in h⁻¹ */
  svH: number;
}

/**
 * Sigmoidal light-off curve: conversion% = 100 / (1 + exp(-(T - T50) / k))
 *
 * T50 is derived from PGM loading and space velocity.
 * Higher PGM loading → lower T50. Higher SV → higher T50.
 * Steepness k ≈ 25°C for fresh TWC, 30°C after aging.
 */
export function computeLightOffCurve(params: {
  pdGPerL: number;
  rhGPerL: number;
  ptGPerL?: number;
  oscGPerL: number;
  substrateVolumeL: number;
  /** Rated exhaust flow in kg/h (default 120 kg/h) */
  exhaustFlowKgPerH?: number;
  agingTempC?: number;
  agingHours?: number;
  cePercent?: number;
}): LightOffCurve {
  const {
    pdGPerL, rhGPerL, ptGPerL = 0, oscGPerL, substrateVolumeL,
    exhaustFlowKgPerH = 120, agingTempC = 1050, agingHours = 12, cePercent = 45,
  } = params;

  // GHSV at STP (0°C, 1 atm) — industry-standard reference so values are temperature-independent.
  // ρ_STP = pM/(RT) = (101325 × 0.0288) / (8.314 × 273.15) ≈ 1.285 kg/m³ → 778 NL/kg
  const exhaustFlowLPerH = exhaustFlowKgPerH * 778; // NL/h at STP
  const svH = exhaustFlowLPerH / Math.max(substrateVolumeL, 0.01);

  // Base T50 from PGM: empirical correlation (lower PGM → higher T50)
  const totalPgm = pdGPerL + rhGPerL + ptGPerL;
  const t50BaseCo = 300 - Math.min(80, totalPgm * 40); // 300°C at 0 PGM, ~220°C at 2 g/L
  const t50BaseHc = t50BaseCo + 20;

  // SV correction: each doubling of SV adds ~15°C to T50
  const svRef = 50_000;
  const svCorrectionCo = Math.max(0, Math.log2(svH / svRef) * 15);
  const svCorrectionHc = svCorrectionCo * 1.1;

  const t50FreshCo = +(t50BaseCo + svCorrectionCo).toFixed(1);
  const t50FreshHc = +(t50BaseHc + svCorrectionHc).toFixed(1);

  // Aging T50 shift: from sintering model
  const pdDisp = computePgmDispersion({ metal: "Pd", loadingGPerL: pdGPerL, agingTempC, agingHours });
  const rhDisp = computePgmDispersion({ metal: "Rh", loadingGPerL: rhGPerL, agingTempC, agingHours });
  const ptDisp = ptGPerL > 0 ? computePgmDispersion({ metal: "Pt", loadingGPerL: ptGPerL, agingTempC, agingHours }) : null;

  const pdWeight = pdGPerL / Math.max(0.01, totalPgm);
  const rhWeight = rhGPerL / Math.max(0.01, totalPgm);
  const ptWeight = ptGPerL / Math.max(0.01, totalPgm);
  const sinterShift = pdDisp.t50ShiftC * pdWeight + rhDisp.t50ShiftC * rhWeight + (ptDisp?.t50ShiftC ?? 0) * ptWeight;

  // Poison T50 shift
  const osc = computeOscCapacity({ cePercent, agingTempC, agingHours, oscLoadingGPerL: oscGPerL, substrateVolumeL });
  const poisonShift = osc.retentionPct < 60 ? (60 - osc.retentionPct) * 0.4 : 0;

  const totalShiftCo = sinterShift + poisonShift;
  const totalShiftHc = sinterShift * 1.1 + poisonShift * 1.2;

  const t50AgedCo = +(t50FreshCo + totalShiftCo).toFixed(1);
  const t50AgedHc = +(t50FreshHc + totalShiftHc).toFixed(1);

  // Rh also controls NOx — T50 NOx relates to Rh loading
  const t50FreshNox = 270 - Math.min(70, rhGPerL * 60) + svCorrectionCo * 0.8;
  const t50AgedNox = t50FreshNox + rhDisp.t50ShiftC;

  // Generate curves: 100–600°C in 10°C steps
  const kFresh = 25;
  const kAged = 32;

  function sigmoid(T: number, T50: number, k: number) {
    return +(100 / (1 + Math.exp(-(T - T50) / k))).toFixed(1);
  }

  const freshPoints: LightOffPoint[] = [];
  const agedPoints: LightOffPoint[] = [];

  for (let T = 100; T <= 600; T += 10) {
    freshPoints.push({
      tempC: T,
      coPct: sigmoid(T, t50FreshCo, kFresh),
      hcPct: sigmoid(T, t50FreshHc, kFresh),
      noxPct: sigmoid(T, t50FreshNox, kFresh * 1.2),
    });
    agedPoints.push({
      tempC: T,
      coPct: sigmoid(T, t50AgedCo, kAged),
      hcPct: sigmoid(T, t50AgedHc, kAged),
      noxPct: sigmoid(T, t50AgedNox, kAged * 1.2),
    });
  }

  return {
    fresh: freshPoints,
    aged: agedPoints,
    t50FreshCo,
    t50FreshHc,
    t50AgedCo,
    t50AgedHc,
    svH: +svH.toFixed(0),
  };
}

/* ================================================================== */
/*  Space Velocity Analysis                                           */
/* ================================================================== */

export interface SpaceVelocityPoint {
  svH: number;
  conversionCo: number;
  conversionHc: number;
}

/**
 * Conversion efficiency at rated conditions vs space velocity.
 * At high SV, residence time is too short for complete conversion.
 */
export function computeSpaceVelocityEffect(params: {
  pdGPerL: number;
  rhGPerL: number;
  substrateVolumeL?: number;
  evalTempC?: number;
}): SpaceVelocityPoint[] {
  const { pdGPerL, rhGPerL, evalTempC = 450 } = params;
  const totalPgm = pdGPerL + rhGPerL;
  const t50Co = 300 - Math.min(80, totalPgm * 40);
  const t50Hc = t50Co + 20;

  const points: SpaceVelocityPoint[] = [];
  const svValues = [10000, 20000, 30000, 50000, 75000, 100000, 150000, 200000];

  for (const sv of svValues) {
    const svRef = 50_000;
    const svCorr = Math.max(0, Math.log2(sv / svRef) * 15);
    const t50SvCo = t50Co + svCorr;
    const t50SvHc = t50Hc + svCorr * 1.1;
    const convCo = +(100 / (1 + Math.exp(-(evalTempC - t50SvCo) / 25))).toFixed(1);
    const convHc = +(100 / (1 + Math.exp(-(evalTempC - t50SvHc) / 25))).toFixed(1);
    points.push({ svH: sv, conversionCo: convCo, conversionHc: convHc });
  }

  return points;
}

/* ================================================================== */
/*  Composite: full aging prediction for a catalyst spec              */
/* ================================================================== */

export interface FullAgingPrediction {
  osc: OscResult;
  pgmPd: PgmDispersionResult;
  pgmRh: PgmDispersionResult;
  pgmPt: PgmDispersionResult | null;
  poison: PoisonResult;
  aging: AgingEquivalenceResult;
  /** Predicted T50 CO after aging (fresh T50 + sintering shift + poison shift) */
  predictedT50CoC: number;
  /** Predicted T50 HC after aging */
  predictedT50HcC: number;
  /** Fresh T50 CO (before aging) */
  freshT50CoC: number;
  /** Fresh T50 HC (before aging) */
  freshT50HcC: number;
  /** Light-off curve for selected variant */
  lightOffCurve: LightOffCurve;
  /** Space velocity at rated flow */
  svH: number;
}

export function predictFullAging(params: {
  cePercent: number;
  oscLoadingGPerL: number;
  pdGPerL: number;
  rhGPerL: number;
  ptGPerL: number;
  substrateVolumeL: number;
  substrateGsaM2PerL?: number;
  freshT50CoC?: number;
  freshT50HcC?: number;
  agingTempC?: number;
  agingHours?: number;
  targetMileageKm?: number;
  fuelType?: "gasoline" | "diesel";
  oilConsumptionLPer1000km?: number;
  exhaustFlowKgPerH?: number;
}): FullAgingPrediction {
  const {
    cePercent, oscLoadingGPerL, pdGPerL, rhGPerL, ptGPerL,
    substrateVolumeL, substrateGsaM2PerL = 2.8,
    freshT50CoC = 250, freshT50HcC = 270,
    agingTempC = 1050, agingHours = 12,
    targetMileageKm = 160_000,
    fuelType = "gasoline", oilConsumptionLPer1000km = 0.2,
    exhaustFlowKgPerH = 120,
  } = params;

  const osc = computeOscCapacity({ cePercent, agingTempC, agingHours, oscLoadingGPerL, substrateVolumeL });
  const pgmPd = computePgmDispersion({ metal: "Pd", loadingGPerL: pdGPerL, agingTempC, agingHours });
  const pgmRh = computePgmDispersion({ metal: "Rh", loadingGPerL: rhGPerL, agingTempC, agingHours });
  const pgmPt = ptGPerL > 0
    ? computePgmDispersion({ metal: "Pt", loadingGPerL: ptGPerL, agingTempC, agingHours })
    : null;
  const poison = computePoisonLoading({ mileageKm: targetMileageKm, fuelType, oilConsumptionLPer1000km, substrateVolumeL, substrateGsaM2PerL });
  const aging = computeAgingEquivalence({ targetMileageKm, targetTempC: agingTempC });

  // Weighted T50 shift from PGM sintering (Pd dominates for CO, Rh for NOx)
  const pdWeight = pdGPerL / Math.max(0.01, pdGPerL + rhGPerL + ptGPerL);
  const rhWeight = rhGPerL / Math.max(0.01, pdGPerL + rhGPerL + ptGPerL);
  const ptWeight = ptGPerL / Math.max(0.01, pdGPerL + rhGPerL + ptGPerL);
  const sinterShift = pgmPd.t50ShiftC * pdWeight + pgmRh.t50ShiftC * rhWeight + (pgmPt?.t50ShiftC ?? 0) * ptWeight;

  const predictedT50CoC = +(freshT50CoC + sinterShift + poison.t50ShiftFromPoisonC).toFixed(1);
  const predictedT50HcC = +(freshT50HcC + sinterShift * 1.1 + poison.t50ShiftFromPoisonC * 1.2).toFixed(1);

  const lightOffCurve = computeLightOffCurve({
    pdGPerL,
    rhGPerL,
    ptGPerL,
    oscGPerL: oscLoadingGPerL,
    substrateVolumeL,
    exhaustFlowKgPerH,
    agingTempC,
    agingHours,
    cePercent,
  });

  return {
    osc, pgmPd, pgmRh, pgmPt, poison, aging,
    predictedT50CoC, predictedT50HcC,
    freshT50CoC: lightOffCurve.t50FreshCo,
    freshT50HcC: lightOffCurve.t50FreshHc,
    lightOffCurve,
    svH: lightOffCurve.svH,
  };
}
