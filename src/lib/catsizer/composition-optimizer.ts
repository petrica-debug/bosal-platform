/**
 * COMPOSITION OPTIMIZER — Minimum-PGM search engine for AM catalysts
 *
 * Core idea: In aftermarket, you don't fight the absolute emission limit.
 * You fight the OE sample. The AM part, after aging (with deterioration factor),
 * must perform within an acceptable window of the OE aged reference.
 *
 * This module searches for the minimum PGM loading (lowest cost) that still
 * passes against the OE reference after applying the same aging protocol.
 *
 * The search runs the SAME aging simulation on both OE and AM candidates,
 * then compares their aged states — this is the relative comparison that
 * engineers do mentally, now automated.
 *
 * References:
 * - ECE R103: AM emissions ≤ 115% of OE reference
 * - Bosal AM Methodology Steps C–G (see bosal-methodology.ts)
 */

import {
  computeOscCapacity,
  computePgmDispersion,
  computePoisonLoading,
  computeLightOffCurve,
  predictFullAging,
  type FullAgingPrediction,
  type OscResult,
  type LightOffCurve,
} from "./catalyst-chemistry";

import {
  validateDesign,
  type DesignInput,
  type BaselineInput,
  type ValidationResult,
  BOSAL_TOOLING_DIAMETERS_MM,
} from "./design-rules";

import {
  benchmarkVsCompetitors,
  type BenchmarkResult,
} from "./competitor-bench";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export type EmissionEra = "euro_6b" | "euro_6d_temp" | "euro_6d" | "euro_6e";

export interface OeReference {
  /** Engine code for traceability */
  engineCode: string;
  /** OEM group / brand */
  oemGroup: string;
  /** Emission standard era */
  era: EmissionEra;
  /** Component type being optimized */
  componentType: "CC-TWC" | "UF-TWC" | "DOC" | "GPF" | "DPF";
  /** OE fresh PGM in g/L — Pd */
  oeFreshPdGPerL: number;
  /** OE fresh PGM in g/L — Rh */
  oeFreshRhGPerL: number;
  /** OE fresh PGM in g/L — Pt */
  oeFreshPtGPerL: number;
  /** OE fresh total PGM in g/L */
  oeFreshTotalPgmGPerL: number;
  /** OE fresh OSC in g/L (CeO₂-ZrO₂ material) */
  oeFreshOscGPerL: number;
  /** OE CeO₂ content in OSC phase (wt%) */
  oeCePercent: number;
  /** OE washcoat total in g/L */
  oeWashcoatGPerL: number;
  /** Substrate volume in L */
  substrateVolumeL: number;
  /** Substrate diameter in mm */
  substrateDiameterMm: number;
  /** Substrate length in mm */
  substrateLengthMm: number;
  /** Substrate GSA in m²/L */
  substrateGsaM2PerL?: number;
  /** OE system backpressure in kPa (if known) */
  oeBackpressureKPa?: number;
  /** Exhaust flow at rated power in kg/h */
  exhaustFlowKgPerH?: number;
  /** OBD sensitivity of this platform */
  obdSensitivity?: "tight" | "moderate" | "tolerant";
}

export interface AgingProtocolInput {
  /** Aging temperature in °C (default: 1050 for RAT-A) */
  agingTempC: number;
  /** Aging duration in hours (default: 12 for RAT-A) */
  agingHours: number;
  /** Protocol name for traceability */
  protocolName: string;
  /** Target mileage equivalence in km */
  equivalentMileageKm: number;
  /** Fuel type for poison model */
  fuelType: "gasoline" | "diesel";
  /** Oil consumption in L/1000km (typical 0.1-0.5) */
  oilConsumptionLPer1000km?: number;
}

export interface OptimizationConstraints {
  /** Pd:Rh ratio constraint — minimum (default 4) */
  minPdRhRatio?: number;
  /** Pd:Rh ratio constraint — maximum (default 18) */
  maxPdRhRatio?: number;
  /** Include Pt substitution in search? (default false) */
  allowPtSubstitution?: boolean;
  /** Max Pt fraction if substitution allowed (default 0.25) */
  maxPtFraction?: number;
  /** Force a specific Bosal tooling diameter (mm) — null = use OE diameter */
  forceToolingDiameterMm?: number;
  /** Search resolution in g/L increments (default 0.05) */
  searchResolutionGPerL?: number;
  /** Pd price EUR/g (used for cost ranking) */
  pdPriceEurPerG: number;
  /** Rh price EUR/g */
  rhPriceEurPerG: number;
  /** Pt price EUR/g */
  ptPriceEurPerG: number;
}

export interface CandidateFormulation {
  /** PGM loadings in g/L */
  pdGPerL: number;
  rhGPerL: number;
  ptGPerL: number;
  totalPgmGPerL: number;
  /** PGM loadings in g/ft³ (industry convention) */
  pdGPerFt3: number;
  rhGPerFt3: number;
  ptGPerFt3: number;
  totalPgmGPerFt3: number;
  /** PGM mass per brick in g */
  pdGPerBrick: number;
  rhGPerBrick: number;
  ptGPerBrick: number;
  totalPgmGPerBrick: number;
  /** Pd:Rh mass ratio */
  pdRhRatio: number;
  /** PGM fraction of OE fresh */
  pgmFractionOfOe: number;
  /** Recommended OSC loading in g/L */
  oscGPerL: number;
  /** OSC fraction of OE fresh */
  oscFractionOfOe: number;
  /** Recommended CeO₂ content in OSC (wt%) */
  cePercent: number;
  /** Total washcoat loading in g/L */
  washcoatGPerL: number;
}

export interface AgedComparison {
  /** AM aged T50 CO */
  amAgedT50CoC: number;
  /** AM aged T50 HC */
  amAgedT50HcC: number;
  /** OE aged T50 CO */
  oeAgedT50CoC: number;
  /** OE aged T50 HC */
  oeAgedT50HcC: number;
  /** T50 CO delta: AM - OE (positive = AM is worse) */
  t50DeltaCoC: number;
  /** T50 HC delta: AM - OE */
  t50DeltaHcC: number;
  /** AM fresh T50 CO */
  amFreshT50CoC: number;
  /** OE fresh T50 CO */
  oeFreshT50CoC: number;
  /** AM OSC retention after aging (%) */
  amOscRetentionPct: number;
  /** OE OSC retention after aging (%) */
  oeOscRetentionPct: number;
  /** AM aged OSC in µmol O₂/brick */
  amAgedOscUmolPerBrick: number;
  /** OE aged OSC in µmol O₂/brick */
  oeAgedOscUmolPerBrick: number;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "BLOCK";

export interface ObdRiskAssessment {
  /** OSC ratio: AM_fresh / OE_fresh */
  oscRatio: number;
  /** Risk level */
  riskLevel: RiskLevel;
  /** Risk description */
  riskDescription: string;
  /** Platform-specific notes */
  platformNotes: string;
}

export interface OptimizedCandidate {
  /** Rank (1 = best cost, all passing) */
  rank: number;
  /** Tier label */
  tier: "minimum-cost" | "balanced" | "performance" | "conservative";
  /** Formulation details */
  formulation: CandidateFormulation;
  /** Aged comparison against OE reference */
  agedComparison: AgedComparison;
  /** OBD risk assessment */
  obdRisk: ObdRiskAssessment;
  /** Design rule validation result */
  designValidation: ValidationResult;
  /** PGM cost per brick (EUR) */
  pgmCostPerBrickEur: number;
  /** PGM cost breakdown */
  pgmCostBreakdown: { pd: number; rh: number; pt: number };
  /** Estimated total BOM per brick (EUR) — PGM + substrate + washcoat */
  estimatedBomEur: number;
  /** Competitor benchmark */
  competitorBenchmark: BenchmarkResult;
  /** Full aging prediction for this formulation */
  agingPrediction: FullAgingPrediction;
  /** AM light-off curve */
  amLightOffCurve: LightOffCurve;
  /** OE light-off curve (for overlay comparison) */
  oeLightOffCurve: LightOffCurve;
  /** Pass/fail against OE reference + deterioration */
  passesOeReference: boolean;
  /** Margin: how many °C below the T50 limit */
  t50MarginC: number;
  /** Confidence level */
  confidence: "HIGH" | "MEDIUM" | "LOW";
  /** Explanation of why this candidate was selected */
  rationale: string;
}

export interface OptimizationResult {
  /** OE reference used */
  oeReference: OeReference;
  /** Aging protocol used */
  agingProtocol: AgingProtocolInput;
  /** OE aged prediction (baseline) */
  oeAgingPrediction: FullAgingPrediction;
  /** Ranked candidates (best cost first) */
  candidates: OptimizedCandidate[];
  /** PGM price sensitivity: how candidates shift under ±30% price moves */
  pgmSensitivity: PgmSensitivityPoint[];
  /** Search metadata */
  searchMeta: {
    totalCandidatesEvaluated: number;
    candidatesPassed: number;
    candidatesBlocked: number;
    searchDurationMs: number;
    searchResolutionGPerL: number;
  };
  /** Recommendations from the optimizer */
  recommendations: string[];
  /** Warnings */
  warnings: string[];
}

export interface PgmSensitivityPoint {
  /** Price scenario label */
  scenario: string;
  /** Pd price in this scenario */
  pdPriceEurPerG: number;
  /** Rh price in this scenario */
  rhPriceEurPerG: number;
  /** Which candidate tier is cheapest under this scenario */
  cheapestTier: string;
  /** Cost of cheapest under this scenario */
  cheapestCostEur: number;
}

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

const G_PER_L_TO_G_PER_FT3 = 28.3168; // 1 ft³ = 28.3168 L

/** PGM derating bands by emission era */
const PGM_DERATING: Record<EmissionEra, { min: number; max: number; mid: number }> = {
  euro_6b:      { min: 0.55, max: 0.65, mid: 0.60 },
  euro_6d_temp: { min: 0.60, max: 0.70, mid: 0.65 },
  euro_6d:      { min: 0.65, max: 0.75, mid: 0.70 },
  euro_6e:      { min: 0.70, max: 0.80, mid: 0.75 },
};

/** OSC derating bands by emission era */
const OSC_DERATING: Record<EmissionEra, { min: number; max: number; mid: number }> = {
  euro_6b:      { min: 0.60, max: 0.70, mid: 0.65 },
  euro_6d_temp: { min: 0.65, max: 0.72, mid: 0.68 },
  euro_6d:      { min: 0.68, max: 0.75, mid: 0.72 },
  euro_6e:      { min: 0.72, max: 0.78, mid: 0.75 },
};

/** T50 tolerance: AM aged T50 must be within this many °C of OE aged T50 */
const T50_TOLERANCE_PASS_C = 20;
const T50_TOLERANCE_WARN_C = 15;

/* ================================================================== */
/*  Helper: compute OE aged baseline                                   */
/* ================================================================== */

function computeOeAgedBaseline(
  oe: OeReference,
  aging: AgingProtocolInput,
): FullAgingPrediction {
  return predictFullAging({
    cePercent: oe.oeCePercent,
    oscLoadingGPerL: oe.oeFreshOscGPerL,
    pdGPerL: oe.oeFreshPdGPerL,
    rhGPerL: oe.oeFreshRhGPerL,
    ptGPerL: oe.oeFreshPtGPerL,
    substrateVolumeL: oe.substrateVolumeL,
    substrateGsaM2PerL: oe.substrateGsaM2PerL,
    agingTempC: aging.agingTempC,
    agingHours: aging.agingHours,
    targetMileageKm: aging.equivalentMileageKm,
    fuelType: aging.fuelType,
    oilConsumptionLPer1000km: aging.oilConsumptionLPer1000km ?? 0.2,
    exhaustFlowKgPerH: oe.exhaustFlowKgPerH,
  });
}

/* ================================================================== */
/*  Helper: compute AM candidate aging                                 */
/* ================================================================== */

function computeAmAgingForCandidate(
  candidate: CandidateFormulation,
  oe: OeReference,
  aging: AgingProtocolInput,
): FullAgingPrediction {
  return predictFullAging({
    cePercent: candidate.cePercent,
    oscLoadingGPerL: candidate.oscGPerL,
    pdGPerL: candidate.pdGPerL,
    rhGPerL: candidate.rhGPerL,
    ptGPerL: candidate.ptGPerL,
    substrateVolumeL: oe.substrateVolumeL,
    substrateGsaM2PerL: oe.substrateGsaM2PerL,
    agingTempC: aging.agingTempC,
    agingHours: aging.agingHours,
    targetMileageKm: aging.equivalentMileageKm,
    fuelType: aging.fuelType,
    oilConsumptionLPer1000km: aging.oilConsumptionLPer1000km ?? 0.2,
    exhaustFlowKgPerH: oe.exhaustFlowKgPerH,
  });
}

/* ================================================================== */
/*  Helper: OBD risk assessment                                        */
/* ================================================================== */

function assessObdRisk(
  amOscGPerL: number,
  oeFreshOscGPerL: number,
  obdSensitivity?: "tight" | "moderate" | "tolerant",
): ObdRiskAssessment {
  const oscRatio = amOscGPerL / oeFreshOscGPerL;

  // Tighten thresholds for sensitive platforms (VAG MQB etc.)
  const tightFactor = obdSensitivity === "tight" ? 0.03 : obdSensitivity === "tolerant" ? -0.03 : 0;

  let riskLevel: RiskLevel;
  let riskDescription: string;

  if (oscRatio < 0.55 + tightFactor) {
    riskLevel = "BLOCK";
    riskDescription = `OSC ratio ${(oscRatio * 100).toFixed(1)}% is critically low — rear O₂ sensor will detect insufficient oxygen buffering, causing P0420/P0430.`;
  } else if (oscRatio < 0.62 + tightFactor) {
    riskLevel = "HIGH";
    riskDescription = `OSC ratio ${(oscRatio * 100).toFixed(1)}% is in the danger zone — marginal OBD pass, high risk of field returns on sensitive vehicles.`;
  } else if (oscRatio > 0.80 - tightFactor) {
    riskLevel = "HIGH";
    riskDescription = `OSC ratio ${(oscRatio * 100).toFixed(1)}% is too high — catalyst appears "too new", OBD may flag excessive storage vs. expected aged behavior.`;
  } else if (oscRatio > 0.75 - tightFactor) {
    riskLevel = "MEDIUM";
    riskDescription = `OSC ratio ${(oscRatio * 100).toFixed(1)}% is on the upper edge of the safe window — acceptable but monitor during R103 testing.`;
  } else if (oscRatio < 0.65 + tightFactor) {
    riskLevel = "MEDIUM";
    riskDescription = `OSC ratio ${(oscRatio * 100).toFixed(1)}% is on the lower edge — should pass but validate with OBD bench test.`;
  } else {
    riskLevel = "LOW";
    riskDescription = `OSC ratio ${(oscRatio * 100).toFixed(1)}% is in the sweet spot (62–75%). Minimal OBD risk.`;
  }

  const platformNotes =
    obdSensitivity === "tight"
      ? "Platform flagged as OBD-tight (e.g., VAG MQB). Thresholds narrowed by 3%. Recommend OBD bench validation before R103."
      : obdSensitivity === "tolerant"
        ? "Platform has wide OBD tolerance (e.g., Toyota HEV, PSA). Slightly wider OSC window acceptable."
        : "Standard OBD sensitivity assumed. Recommend bench validation if unsure of platform calibration.";

  return { oscRatio, riskLevel, riskDescription, platformNotes };
}

/* ================================================================== */
/*  Helper: cost calculation                                           */
/* ================================================================== */

function computePgmCost(
  candidate: CandidateFormulation,
  prices: { pd: number; rh: number; pt: number },
): { total: number; pd: number; rh: number; pt: number } {
  const pd = candidate.pdGPerBrick * prices.pd;
  const rh = candidate.rhGPerBrick * prices.rh;
  const pt = candidate.ptGPerBrick * prices.pt;
  return { total: pd + rh + pt, pd, rh, pt };
}

function estimateBomCost(pgmCost: number, volumeL: number, washcoatGPerL: number): number {
  // Substrate: ~€8-15/L for cordierite 600/3
  const substrateCost = volumeL * 12;
  // Washcoat: ~€0.02-0.04/g for standard alumina+CeZr
  const washcoatCost = washcoatGPerL * volumeL * 0.03;
  // Canning + mat + assembly: ~€8-15 per unit
  const canningCost = 12;
  return pgmCost + substrateCost + washcoatCost + canningCost;
}

/* ================================================================== */
/*  MAIN: optimizeComposition                                          */
/* ================================================================== */

/**
 * Find the minimum-PGM AM formulation that passes against the OE reference
 * after applying the same aging protocol with deterioration factor.
 *
 * The search:
 * 1. Ages the OE reference → gets OE aged T50, OSC, conversion
 * 2. Scans PGM loading from minimum to maximum derating band
 * 3. For each PGM point, calculates the Pd/Rh split, OSC loading
 * 4. Ages the AM candidate → gets AM aged T50, OSC, conversion
 * 5. Compares AM aged vs OE aged (the RELATIVE test, not absolute)
 * 6. Checks design rules, OBD risk, backpressure
 * 7. Returns ranked candidates: minimum-cost, balanced, performance, conservative
 */
export function optimizeComposition(
  oeReference: OeReference,
  agingProtocol: AgingProtocolInput,
  constraints: OptimizationConstraints,
): OptimizationResult {
  const startTime = Date.now();
  const warnings: string[] = [];
  const recommendations: string[] = [];

  const resolution = constraints.searchResolutionGPerL ?? 0.05;
  const minPdRhRatio = constraints.minPdRhRatio ?? 4;
  const maxPdRhRatio = constraints.maxPdRhRatio ?? 18;
  const allowPt = constraints.allowPtSubstitution ?? false;
  const maxPtFrac = constraints.maxPtFraction ?? 0.25;
  const prices = {
    pd: constraints.pdPriceEurPerG,
    rh: constraints.rhPriceEurPerG,
    pt: constraints.ptPriceEurPerG,
  };

  const era = oeReference.era;
  const pgmBand = PGM_DERATING[era];
  const oscBand = OSC_DERATING[era];

  // Step 1: Age the OE reference
  const oeAging = computeOeAgedBaseline(oeReference, agingProtocol);
  const oeAgedT50Co = oeAging.predictedT50CoC;
  const oeAgedT50Hc = oeAging.predictedT50HcC;

  // Step 2: Define search space
  const oeTotal = oeReference.oeFreshTotalPgmGPerL;
  const minPgm = oeTotal * pgmBand.min;
  const maxPgm = oeTotal * pgmBand.max;

  // Also scan Pd:Rh ratios within allowed band
  const pdRhSteps = [
    minPdRhRatio,
    Math.round((minPdRhRatio + maxPdRhRatio) / 3),
    Math.round((minPdRhRatio + maxPdRhRatio) * 2 / 3),
    maxPdRhRatio,
  ];

  // OSC search: scan through OSC derating band
  const oscSteps = 5;
  const oscValues: number[] = [];
  for (let i = 0; i <= oscSteps; i++) {
    oscValues.push(
      oeReference.oeFreshOscGPerL * (oscBand.min + (oscBand.max - oscBand.min) * i / oscSteps)
    );
  }

  // Step 3: Search loop
  const passingCandidates: {
    formulation: CandidateFormulation;
    amAging: FullAgingPrediction;
    pgmCost: ReturnType<typeof computePgmCost>;
    obdRisk: ObdRiskAssessment;
    validation: ValidationResult;
    t50DeltaCo: number;
    t50DeltaHc: number;
  }[] = [];

  let totalEvaluated = 0;
  let blockedCount = 0;

  for (let totalPgm = minPgm; totalPgm <= maxPgm; totalPgm += resolution) {
    for (const pdRhRatio of pdRhSteps) {
      for (const oscGPerL of oscValues) {
        totalEvaluated++;

        // Split PGM into Pd/Rh/Pt
        let ptGPerL = 0;
        let pdGPerL: number;
        let rhGPerL: number;

        if (allowPt && prices.pt < prices.pd * 0.8) {
          // Pt substitution is cost-effective — replace up to maxPtFrac of Pd
          const ptFrac = Math.min(maxPtFrac, 1 - 1 / (pdRhRatio + 1));
          ptGPerL = totalPgm * ptFrac * 0.5; // Pt at 0.5:1 mass equivalence to Pd
          const remaining = totalPgm - ptGPerL;
          rhGPerL = remaining / (pdRhRatio + 1);
          pdGPerL = remaining - rhGPerL;
        } else {
          rhGPerL = totalPgm / (pdRhRatio + 1);
          pdGPerL = totalPgm - rhGPerL;
        }

        // Ce% for recommended OSC — stay with OE base or reduce slightly
        const cePercent = oeReference.oeCePercent * (oscGPerL / oeReference.oeFreshOscGPerL);
        const clampedCe = Math.max(30, Math.min(55, cePercent));

        // Washcoat: scale proportionally to OSC change
        const washcoatRatio = oscGPerL / oeReference.oeFreshOscGPerL;
        const washcoatGPerL = Math.max(120, Math.min(320, oeReference.oeWashcoatGPerL * (0.7 + 0.3 * washcoatRatio)));

        const formulation: CandidateFormulation = {
          pdGPerL: +pdGPerL.toFixed(3),
          rhGPerL: +rhGPerL.toFixed(3),
          ptGPerL: +ptGPerL.toFixed(3),
          totalPgmGPerL: +(pdGPerL + rhGPerL + ptGPerL).toFixed(3),
          pdGPerFt3: +(pdGPerL * G_PER_L_TO_G_PER_FT3).toFixed(1),
          rhGPerFt3: +(rhGPerL * G_PER_L_TO_G_PER_FT3).toFixed(1),
          ptGPerFt3: +(ptGPerL * G_PER_L_TO_G_PER_FT3).toFixed(1),
          totalPgmGPerFt3: +((pdGPerL + rhGPerL + ptGPerL) * G_PER_L_TO_G_PER_FT3).toFixed(1),
          pdGPerBrick: +(pdGPerL * oeReference.substrateVolumeL).toFixed(3),
          rhGPerBrick: +(rhGPerL * oeReference.substrateVolumeL).toFixed(3),
          ptGPerBrick: +(ptGPerL * oeReference.substrateVolumeL).toFixed(3),
          totalPgmGPerBrick: +((pdGPerL + rhGPerL + ptGPerL) * oeReference.substrateVolumeL).toFixed(3),
          pdRhRatio: rhGPerL > 0 ? +(pdGPerL / rhGPerL).toFixed(1) : 0,
          pgmFractionOfOe: +((pdGPerL + rhGPerL + ptGPerL) / oeTotal).toFixed(3),
          oscGPerL: +oscGPerL.toFixed(1),
          oscFractionOfOe: +(oscGPerL / oeReference.oeFreshOscGPerL).toFixed(3),
          cePercent: +clampedCe.toFixed(1),
          washcoatGPerL: +washcoatGPerL.toFixed(0),
        };

        // Quick pre-check: design rules (skip full aging if BLOCK)
        const designInput: DesignInput = {
          pdGPerL: formulation.pdGPerL,
          rhGPerL: formulation.rhGPerL,
          ptGPerL: formulation.ptGPerL,
          totalPgmGPerL: formulation.totalPgmGPerL,
          oscGPerL: formulation.oscGPerL,
          washcoatGPerL: formulation.washcoatGPerL,
          substrateDiameterMm: oeReference.substrateDiameterMm,
          substrateLengthMm: oeReference.substrateLengthMm,
          substrateVolumeL: oeReference.substrateVolumeL,
        };
        const baseline: BaselineInput = {
          oemFreshPgmGPerL: oeReference.oeFreshTotalPgmGPerL,
          oemFreshOscGPerL: oeReference.oeFreshOscGPerL,
          oemBackpressureKPa: oeReference.oeBackpressureKPa,
        };
        const validation = validateDesign(designInput, baseline);
        if (!validation.valid) {
          blockedCount++;
          continue; // Skip candidates that violate BLOCK rules
        }

        // OBD check (pre-filter)
        const obdRisk = assessObdRisk(
          formulation.oscGPerL,
          oeReference.oeFreshOscGPerL,
          oeReference.obdSensitivity,
        );
        if (obdRisk.riskLevel === "BLOCK") {
          blockedCount++;
          continue;
        }

        // Full aging simulation
        const amAging = computeAmAgingForCandidate(formulation, oeReference, agingProtocol);

        // THE RELATIVE TEST: compare AM aged vs OE aged
        const t50DeltaCo = amAging.predictedT50CoC - oeAgedT50Co;
        const t50DeltaHc = amAging.predictedT50HcC - oeAgedT50Hc;

        // Pass criteria: AM aged T50 must not exceed OE aged T50 + tolerance
        if (t50DeltaCo <= T50_TOLERANCE_PASS_C && t50DeltaHc <= T50_TOLERANCE_PASS_C) {
          const pgmCost = computePgmCost(formulation, prices);
          passingCandidates.push({
            formulation,
            amAging,
            pgmCost,
            obdRisk,
            validation,
            t50DeltaCo,
            t50DeltaHc,
          });
        }
      }
    }
  }

  // Step 4: Rank by cost and select tier representatives
  passingCandidates.sort((a, b) => a.pgmCost.total - b.pgmCost.total);

  const selectedCandidates: OptimizedCandidate[] = [];

  // Select 4 tiers
  const tiers: Array<{
    tier: OptimizedCandidate["tier"];
    selector: (candidates: typeof passingCandidates) => (typeof passingCandidates)[0] | undefined;
    rationale: string;
  }> = [
    {
      tier: "minimum-cost",
      selector: (c) => c[0], // cheapest that passes
      rationale: "Absolute minimum PGM that passes the OE reference after aging. Best for price-sensitive markets.",
    },
    {
      tier: "balanced",
      selector: (c) => {
        // Find candidate closest to mid-band derating with LOW OBD risk
        return c.find(
          (x) =>
            x.obdRisk.riskLevel === "LOW" &&
            x.formulation.pgmFractionOfOe >= pgmBand.mid - 0.03 &&
            x.formulation.pgmFractionOfOe <= pgmBand.mid + 0.03,
        ) ?? c[Math.floor(c.length * 0.35)];
      },
      rationale: "Mid-band PGM derating with low OBD risk. Best balance of cost, compliance margin, and reliability.",
    },
    {
      tier: "performance",
      selector: (c) => {
        // Higher PGM for maximum thermal margin
        return c.find(
          (x) =>
            x.t50DeltaCo <= T50_TOLERANCE_WARN_C - 5 &&
            x.formulation.pgmFractionOfOe >= pgmBand.mid + 0.02,
        ) ?? c[Math.floor(c.length * 0.7)];
      },
      rationale: "Higher PGM loading for maximum aged performance margin. Recommended for tight platforms (VAG MQB) or extended warranty.",
    },
    {
      tier: "conservative",
      selector: (c) => c[c.length - 1], // highest PGM in band
      rationale: "Maximum PGM within derating band. Most OE-like behavior. Use when unsure of OBD calibration or for first-to-market launch.",
    },
  ];

  for (const { tier, selector, rationale } of tiers) {
    const selected = selector(passingCandidates);
    if (!selected) continue;

    // Compute full light-off curves for comparison overlay
    const amLightOff = computeLightOffCurve({
      pdGPerL: selected.formulation.pdGPerL,
      rhGPerL: selected.formulation.rhGPerL,
      ptGPerL: selected.formulation.ptGPerL,
      oscGPerL: selected.formulation.oscGPerL,
      substrateVolumeL: oeReference.substrateVolumeL,
      exhaustFlowKgPerH: oeReference.exhaustFlowKgPerH,
      agingTempC: agingProtocol.agingTempC,
      agingHours: agingProtocol.agingHours,
      cePercent: selected.formulation.cePercent,
    });
    const oeLightOff = computeLightOffCurve({
      pdGPerL: oeReference.oeFreshPdGPerL,
      rhGPerL: oeReference.oeFreshRhGPerL,
      ptGPerL: oeReference.oeFreshPtGPerL,
      oscGPerL: oeReference.oeFreshOscGPerL,
      substrateVolumeL: oeReference.substrateVolumeL,
      exhaustFlowKgPerH: oeReference.exhaustFlowKgPerH,
      agingTempC: agingProtocol.agingTempC,
      agingHours: agingProtocol.agingHours,
      cePercent: oeReference.oeCePercent,
    });

    // Competitor benchmark
    const benchmark = benchmarkVsCompetitors({
      bosalPgmGPerL: selected.formulation.totalPgmGPerL,
      oemFreshPgmGPerL: oeReference.oeFreshTotalPgmGPerL,
      bosalEstimatedRetailEur: estimateBomCost(
        selected.pgmCost.total,
        oeReference.substrateVolumeL,
        selected.formulation.washcoatGPerL,
      ) * 2.2, // ~2.2× markup to retail
    });

    // Aged comparison
    const amOsc = computeOscCapacity({
      cePercent: selected.formulation.cePercent,
      agingTempC: agingProtocol.agingTempC,
      agingHours: agingProtocol.agingHours,
      oscLoadingGPerL: selected.formulation.oscGPerL,
      substrateVolumeL: oeReference.substrateVolumeL,
    });
    const oeOsc = computeOscCapacity({
      cePercent: oeReference.oeCePercent,
      agingTempC: agingProtocol.agingTempC,
      agingHours: agingProtocol.agingHours,
      oscLoadingGPerL: oeReference.oeFreshOscGPerL,
      substrateVolumeL: oeReference.substrateVolumeL,
    });

    const agedComparison: AgedComparison = {
      amAgedT50CoC: selected.amAging.predictedT50CoC,
      amAgedT50HcC: selected.amAging.predictedT50HcC,
      oeAgedT50CoC: oeAging.predictedT50CoC,
      oeAgedT50HcC: oeAging.predictedT50HcC,
      t50DeltaCoC: +(selected.t50DeltaCo).toFixed(1),
      t50DeltaHcC: +(selected.t50DeltaHc).toFixed(1),
      amFreshT50CoC: selected.amAging.freshT50CoC,
      oeFreshT50CoC: oeAging.freshT50CoC,
      amOscRetentionPct: amOsc.retentionPct,
      oeOscRetentionPct: oeOsc.retentionPct,
      amAgedOscUmolPerBrick: amOsc.agedUmolO2PerBrick,
      oeAgedOscUmolPerBrick: oeOsc.agedUmolO2PerBrick,
    };

    const t50Margin = T50_TOLERANCE_PASS_C - Math.max(selected.t50DeltaCo, selected.t50DeltaHc);
    const bom = estimateBomCost(
      selected.pgmCost.total,
      oeReference.substrateVolumeL,
      selected.formulation.washcoatGPerL,
    );

    // Update validation with T50 now that we have it
    const fullDesignInput: DesignInput = {
      ...{
        pdGPerL: selected.formulation.pdGPerL,
        rhGPerL: selected.formulation.rhGPerL,
        ptGPerL: selected.formulation.ptGPerL,
        totalPgmGPerL: selected.formulation.totalPgmGPerL,
        oscGPerL: selected.formulation.oscGPerL,
        washcoatGPerL: selected.formulation.washcoatGPerL,
        substrateDiameterMm: oeReference.substrateDiameterMm,
        substrateLengthMm: oeReference.substrateLengthMm,
        substrateVolumeL: oeReference.substrateVolumeL,
      },
      predictedT50CoC: selected.amAging.predictedT50CoC,
      systemBackpressureKPa: oeReference.oeBackpressureKPa,
    };
    const fullBaseline: BaselineInput = {
      oemFreshPgmGPerL: oeReference.oeFreshTotalPgmGPerL,
      oemFreshOscGPerL: oeReference.oeFreshOscGPerL,
      oemBackpressureKPa: oeReference.oeBackpressureKPa,
      oemAgedT50CoC: oeAging.predictedT50CoC,
    };
    const fullValidation = validateDesign(fullDesignInput, fullBaseline);

    selectedCandidates.push({
      rank: selectedCandidates.length + 1,
      tier,
      formulation: selected.formulation,
      agedComparison,
      obdRisk: selected.obdRisk,
      designValidation: fullValidation,
      pgmCostPerBrickEur: +selected.pgmCost.total.toFixed(2),
      pgmCostBreakdown: {
        pd: +selected.pgmCost.pd.toFixed(2),
        rh: +selected.pgmCost.rh.toFixed(2),
        pt: +selected.pgmCost.pt.toFixed(2),
      },
      estimatedBomEur: +bom.toFixed(2),
      competitorBenchmark: benchmark,
      agingPrediction: selected.amAging,
      amLightOffCurve: amLightOff,
      oeLightOffCurve: oeLightOff,
      passesOeReference: true,
      t50MarginC: +t50Margin.toFixed(1),
      confidence:
        t50Margin > 10 ? "HIGH" : t50Margin > 5 ? "MEDIUM" : "LOW",
      rationale,
    });
  }

  // Step 5: PGM price sensitivity
  const pgmSensitivity: PgmSensitivityPoint[] = [];
  const scenarios = [
    { scenario: "Rh +50%", pdMult: 1.0, rhMult: 1.5 },
    { scenario: "Rh -30%", pdMult: 1.0, rhMult: 0.7 },
    { scenario: "Pd +50%", pdMult: 1.5, rhMult: 1.0 },
    { scenario: "Pd -30%", pdMult: 0.7, rhMult: 1.0 },
    { scenario: "Both +30%", pdMult: 1.3, rhMult: 1.3 },
  ];

  for (const { scenario, pdMult, rhMult } of scenarios) {
    const scenarioPrices = {
      pd: prices.pd * pdMult,
      rh: prices.rh * rhMult,
      pt: prices.pt,
    };
    let cheapest = { tier: "none", cost: Infinity };
    for (const c of selectedCandidates) {
      const cost = computePgmCost(c.formulation, scenarioPrices).total;
      if (cost < cheapest.cost) {
        cheapest = { tier: c.tier, cost };
      }
    }
    pgmSensitivity.push({
      scenario,
      pdPriceEurPerG: scenarioPrices.pd,
      rhPriceEurPerG: scenarioPrices.rh,
      cheapestTier: cheapest.tier,
      cheapestCostEur: +cheapest.cost.toFixed(2),
    });
  }

  // Step 6: Recommendations
  if (selectedCandidates.length === 0) {
    warnings.push(
      "No feasible formulation found within the derating band that passes OE reference. " +
      "Consider widening the PGM band or reviewing the OE reference data.",
    );
  } else {
    const cheapest = selectedCandidates[0];
    const balanced = selectedCandidates.find((c) => c.tier === "balanced");

    recommendations.push(
      `Minimum PGM: ${cheapest.formulation.totalPgmGPerFt3} g/ft³ (${(cheapest.formulation.pgmFractionOfOe * 100).toFixed(0)}% of OE) at €${cheapest.pgmCostPerBrickEur}/brick.`,
    );

    if (balanced) {
      recommendations.push(
        `Recommended balanced spec: ${balanced.formulation.totalPgmGPerFt3} g/ft³, Pd:Rh ${balanced.formulation.pdRhRatio}:1, OSC ${balanced.formulation.oscGPerL} g/L.`,
      );
    }

    if (oeReference.obdSensitivity === "tight") {
      recommendations.push(
        "Platform has tight OBD calibration — start with balanced or performance tier. Validate with OBD bench before committing to minimum-cost.",
      );
    }

    // Check if Rh is the cost driver
    if (prices.rh > prices.pd * 4) {
      recommendations.push(
        `Rh is ${(prices.rh / prices.pd).toFixed(1)}× more expensive than Pd. Consider higher Pd:Rh ratio (within 4–18 band) to reduce cost.`,
      );
    }
  }

  return {
    oeReference,
    agingProtocol,
    oeAgingPrediction: oeAging,
    candidates: selectedCandidates,
    pgmSensitivity,
    searchMeta: {
      totalCandidatesEvaluated: totalEvaluated,
      candidatesPassed: passingCandidates.length,
      candidatesBlocked: blockedCount,
      searchDurationMs: Date.now() - startTime,
      searchResolutionGPerL: resolution,
    },
    recommendations,
    warnings,
  };
}
