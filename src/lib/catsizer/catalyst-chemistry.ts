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
  const freshOsc = 1200 * ceFrac * (1 - 0.4 * ceFrac); // µmol O2/g — peaks ~600 at Ce50%

  const Ea = 130_000; // J/mol — activation energy for OSC degradation
  const T = agingTempC + 273.15;
  const Tref = 1050 + 273.15;
  const kRef = 0.08; // 1/h at 1050°C reference
  const k = kRef * Math.exp((Ea / R_GAS) * (1 / Tref - 1 / T));

  const retentionFrac = Math.max(0.25, Math.exp(-k * agingHours));
  const agedOsc = freshOsc * retentionFrac;

  // Crystallite growth: Ostwald ripening d^4 - d0^4 = K*t
  const d0 = 5; // nm fresh
  const Kref = 50; // nm^4/h at 1050°C
  const K = Kref * Math.exp((Ea / R_GAS) * (1 / Tref - 1 / T));
  const d = Math.pow(d0 ** 4 + K * agingHours, 0.25);

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
  Pd: { freshDisp: 0.40, d0Nm: 2.5, sinterN: 5, Ea: 125_000, kRef: 200, t50K: 18 },
  Rh: { freshDisp: 0.50, d0Nm: 2.0, sinterN: 7, Ea: 145_000, kRef: 80, t50K: 22 },
  Pt: { freshDisp: 0.32, d0Nm: 3.0, sinterN: 4, Ea: 115_000, kRef: 350, t50K: 15 },
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

  // P penetration depth: exponential decay, ~80% in front 20% of brick
  const pDepthFraction = Math.min(0.5, 0.15 + 0.0001 * (mileageKm / 1000));

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
}): FullAgingPrediction {
  const {
    cePercent, oscLoadingGPerL, pdGPerL, rhGPerL, ptGPerL,
    substrateVolumeL, substrateGsaM2PerL = 2.8,
    freshT50CoC = 250, freshT50HcC = 270,
    agingTempC = 1050, agingHours = 12,
    targetMileageKm = 160_000,
    fuelType = "gasoline", oilConsumptionLPer1000km = 0.2,
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

  return { osc, pgmPd, pgmRh, pgmPt, poison, aging, predictedT50CoC, predictedT50HcC };
}
