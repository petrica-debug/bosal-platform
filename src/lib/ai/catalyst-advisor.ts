/**
 * AI CATALYST ADVISOR
 *
 * Analyzes WLTP simulation results against emission limits, diagnoses the
 * root cause of any failure (kinetic, mass transfer, thermal, aging), and
 * uses the BelgaLabs AI engine to generate structured, actionable recommendations
 * for catalyst optimization.
 *
 * Also provides OEM system-level advice for depollution system sizing.
 */

import { complete } from "./engine";
import { CATALYST_ADVISOR_PROMPT, OEM_ADVISOR_PROMPT } from "./prompts";
import type {
  AIAdvisorResponse,
  AIAdvisorDiagnosis,
  AIAdvisorRecommendation,
  AIAdvisorOverallAssessment,
  AIAdvisorAlternativeFormulation,
  OEMAdvisorResponse,
} from "./types";
import type { SGBenchData } from "../catsizer/sgb-data";
import type {
  TransientSimResult,
  TransientCatalystConfig,
  WLTPEmissionStandard,
} from "../catsizer/wltp-transient-engine";
import { WLTP_EMISSION_LIMITS } from "../catsizer/wltp-transient-engine";

// ============================================================
// GAP ANALYSIS (deterministic, runs before AI call)
// ============================================================

interface GapAnalysisEntry {
  species: string;
  cumulative_g_km: number;
  limit_g_km: number;
  margin_pct: number;
  verdict: "green" | "amber" | "red";
  exceeds: boolean;
}

function analyzeGap(
  simResult: TransientSimResult,
  standard: WLTPEmissionStandard
): GapAnalysisEntry[] {
  const limits = WLTP_EMISSION_LIMITS[standard];
  if (!limits) return [];

  return simResult.homologation.map((h) => ({
    species: h.species,
    cumulative_g_km: h.cumulative_g_km,
    limit_g_km: h.limit_g_km,
    margin_pct: h.margin_percent,
    verdict: h.verdict,
    exceeds: h.margin_percent < 0,
  }));
}

function diagnoseLimitation(
  simResult: TransientSimResult,
  sgbData: SGBenchData,
  catalyst: TransientCatalystConfig
): {
  primaryLimitation: AIAdvisorDiagnosis["primaryLimitation"];
  coldStartPct: number;
  kineticScore: number;
  massTransferScore: number;
  thermalScore: number;
  agingScore: number;
} {
  const lightOffSlow = simResult.lightOffTime_s > 120;
  const highGHSV = simResult.peakGHSV_h > 100000;
  const severeAging = simResult.agingFactor < 0.6;

  const avgT50 = sgbData.species.reduce((s, sp) => s + sp.T50_C, 0) / sgbData.species.length;
  const highT50 = avgT50 > 250;

  const coldStartEmissions = simResult.coldStartPenalty_g_km;
  const totalTailpipe = simResult.homologation.reduce((s, h) => s + h.cumulative_g_km, 0);
  const coldStartPct = totalTailpipe > 0
    ? ((coldStartEmissions.CO + coldStartEmissions.HC + coldStartEmissions.NOx) / totalTailpipe) * 100
    : 0;

  let kineticScore = 0;
  let massTransferScore = 0;
  let thermalScore = 0;
  let agingScore = 0;

  if (highT50) kineticScore += 3;
  if (sgbData.species.some((s) => s.TOF_s1 < 1.0 && s.name !== "NOx")) kineticScore += 2;
  if (sgbData.species.some((s) => s.Ea_kJ_mol > 100)) kineticScore += 1;

  if (highGHSV) massTransferScore += 3;
  if (catalyst.cpsi < 400) massTransferScore += 2;
  if (sgbData.washcoatThickness_um > 40) massTransferScore += 1;

  if (lightOffSlow) thermalScore += 3;
  if (coldStartPct > 60) thermalScore += 2;

  if (severeAging) agingScore += 3;
  if (simResult.agingFactor < 0.7) agingScore += 1;

  const scores = { kineticScore, massTransferScore, thermalScore, agingScore };
  const maxScore = Math.max(kineticScore, massTransferScore, thermalScore, agingScore);

  let primaryLimitation: AIAdvisorDiagnosis["primaryLimitation"] = "kinetic";
  const topScorers = [kineticScore, massTransferScore, thermalScore, agingScore].filter(
    (s) => s === maxScore
  ).length;

  if (topScorers > 1) {
    primaryLimitation = "multiple";
  } else if (maxScore === massTransferScore) {
    primaryLimitation = "mass_transfer";
  } else if (maxScore === thermalScore) {
    primaryLimitation = "thermal_inertia";
  } else if (maxScore === agingScore) {
    primaryLimitation = "aging";
  }

  return { primaryLimitation, coldStartPct, ...scores };
}

// ============================================================
// PROMPT BUILDER
// ============================================================

function buildAdvisorPrompt(
  sgbData: SGBenchData,
  simResult: TransientSimResult,
  standard: WLTPEmissionStandard,
  catalyst: TransientCatalystConfig,
  gap: GapAnalysisEntry[],
  limitation: ReturnType<typeof diagnoseLimitation>
): string {
  const limits = WLTP_EMISSION_LIMITS[standard];

  return `## CATALYST DEVELOPMENT OPTIMIZATION REQUEST

### Emission Standard
${limits?.label ?? standard} (g/km limits: CO=${limits?.CO}, HC=${limits?.HC}, NOx=${limits?.NOx}, PM=${limits?.PM})

### Current Catalyst Configuration
- CPSI: ${catalyst.cpsi}
- Wall thickness: ${catalyst.wallThickness_mil} mil
- Washcoat type: ${catalyst.washcoatType}
- PGM loading: ${catalyst.pgmLoading_g_ft3} g/ft³
- Substrate: Ø${catalyst.diameter_mm}mm × ${catalyst.length_mm}mm
- Split config: ${catalyst.splitConfig}
- Catalyst volume: ${simResult.catalystVolume_L.toFixed(2)} L

### SGB Bench Data (Supplier: ${sgbData.supplierName}, Sample: ${sgbData.sampleId})
- Catalyst type: ${sgbData.catalystType}
- PGM ratio: Pt=${sgbData.pgm_ratio.Pt}%, Pd=${sgbData.pgm_ratio.Pd}%, Rh=${sgbData.pgm_ratio.Rh}%
- Dispersion: ${sgbData.dispersion_pct}%
- Metallic SA: ${sgbData.metallicSA_m2_gPGM} m²/gPGM
- Particle size: ${sgbData.avgParticleSize_nm} nm
- BET: ${sgbData.BET_m2_g} m²/g
- Washcoat: ${sgbData.washcoatLoading_g_L} g/L, ${sgbData.washcoatThickness_um} µm
- Bench GHSV: ${sgbData.GHSV_bench} h⁻¹

Species kinetics:
${sgbData.species.map((s) => `  ${s.name}: Ea=${s.Ea_kJ_mol} kJ/mol, TOF=${s.TOF_s1} s⁻¹ @${s.T_ref_C}°C, T50=${s.T50_C}°C, T90=${s.T90_C}°C, maxConv=${s.maxConversion_pct}%`).join("\n")}

### WLTP Simulation Results
- Total distance: ${simResult.totalDistance_km.toFixed(1)} km
- Duration: ${simResult.totalDuration_s} s
- Light-off time: ${simResult.lightOffTime_s} s
- T50 reached: CO=${simResult.T50_reached_s.CO}s, HC=${simResult.T50_reached_s.HC}s, NOx=${simResult.T50_reached_s.NOx}s
- Peak GHSV: ${simResult.peakGHSV_h.toFixed(0)} h⁻¹
- Avg GHSV: ${simResult.avgGHSV_h.toFixed(0)} h⁻¹
- Aging factor: ${(simResult.agingFactor * 100).toFixed(0)}%
- Cold start penalty: CO=${simResult.coldStartPenalty_g_km.CO.toFixed(4)}, HC=${simResult.coldStartPenalty_g_km.HC.toFixed(4)}, NOx=${simResult.coldStartPenalty_g_km.NOx.toFixed(4)} g/km

### Gap Analysis
${gap.map((g) => `  ${g.species}: ${g.cumulative_g_km.toFixed(4)} g/km vs limit ${g.limit_g_km} g/km → margin ${g.margin_pct.toFixed(1)}% → ${g.verdict.toUpperCase()}`).join("\n")}

### Phase Breakdown
${simResult.phases.map((p) => `  ${p.phase}: ${p.distance_km.toFixed(1)}km, avgCatT=${p.avgCatalystTemp_C.toFixed(0)}°C, CO conv=${p.avgConvCO.toFixed(1)}%, HC conv=${p.avgConvHC.toFixed(1)}%, NOx conv=${p.avgConvNOx.toFixed(1)}%`).join("\n")}

### Pre-Diagnosis (deterministic)
- Primary limitation: ${limitation.primaryLimitation}
- Cold start contribution: ${limitation.coldStartPct.toFixed(0)}%
- Scores: kinetic=${limitation.kineticScore}, mass_transfer=${limitation.massTransferScore}, thermal=${limitation.thermalScore}, aging=${limitation.agingScore}

Overall verdict: ${simResult.homologation.some((h) => h.verdict === "red") ? "FAIL" : simResult.homologation.some((h) => h.verdict === "amber") ? "MARGINAL" : "PASS"}

Please provide your structured JSON analysis and recommendations.`;
}

// ============================================================
// MAIN ADVISOR FUNCTION
// ============================================================

export async function getAIOptimizationAdvice(
  sgbData: SGBenchData,
  simResult: TransientSimResult,
  standard: WLTPEmissionStandard,
  catalyst: TransientCatalystConfig
): Promise<AIAdvisorResponse> {
  const gap = analyzeGap(simResult, standard);
  const limitation = diagnoseLimitation(simResult, sgbData, catalyst);
  const userPrompt = buildAdvisorPrompt(sgbData, simResult, standard, catalyst, gap, limitation);

  const aiResponse = await complete({
    messages: [
      { role: "system", content: CATALYST_ADVISOR_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    maxTokens: 4096,
  });

  try {
    const jsonStr = extractJSON(aiResponse.content);
    const parsed = JSON.parse(jsonStr);

    return {
      diagnosis: parsed.diagnosis as AIAdvisorDiagnosis,
      recommendations: (parsed.recommendations ?? []) as AIAdvisorRecommendation[],
      alternativeFormulation: parsed.alternativeFormulation as AIAdvisorAlternativeFormulation,
      overallAssessment: parsed.overallAssessment as AIAdvisorOverallAssessment,
      raw: aiResponse.content,
      tokensUsed: aiResponse.tokensUsed,
    };
  } catch {
    return buildFallbackResponse(gap, limitation, sgbData, catalyst, aiResponse.content, aiResponse.tokensUsed);
  }
}

// ============================================================
// OEM ADVISOR
// ============================================================

export async function getOEMAdvisorAdvice(
  systemDescription: string,
  context: Record<string, unknown>
): Promise<OEMAdvisorResponse> {
  const userPrompt = `## OEM SYSTEM REVIEW REQUEST\n\n${systemDescription}\n\n### Additional Context\n${JSON.stringify(context, null, 2)}`;

  const aiResponse = await complete({
    messages: [
      { role: "system", content: OEM_ADVISOR_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    maxTokens: 4096,
  });

  try {
    const jsonStr = extractJSON(aiResponse.content);
    const parsed = JSON.parse(jsonStr);
    return {
      ...parsed,
      raw: aiResponse.content,
      tokensUsed: aiResponse.tokensUsed,
    } as OEMAdvisorResponse;
  } catch {
    return {
      systemReview: {
        summary: aiResponse.content.slice(0, 500),
        strengths: [],
        weaknesses: [],
        costDrivers: [],
      },
      recommendations: [],
      alternativeArchitecture: {
        description: "Unable to parse AI response",
        components: [],
        rationale: "",
        estimatedCostSaving_pct: 0,
      },
      overallAssessment: {
        currentSystemAdequate: true,
        optimizationPotential: "medium",
        summary: "AI response could not be parsed. Raw response available.",
      },
      raw: aiResponse.content,
      tokensUsed: aiResponse.tokensUsed,
    };
  }
}

// ============================================================
// HELPERS
// ============================================================

function extractJSON(text: string): string {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  return text;
}

function buildFallbackResponse(
  gap: GapAnalysisEntry[],
  limitation: ReturnType<typeof diagnoseLimitation>,
  sgbData: SGBenchData,
  catalyst: TransientCatalystConfig,
  rawContent: string,
  tokensUsed?: number
): AIAdvisorResponse {
  const failingSpecies = gap.filter((g) => g.exceeds).map((g) => g.species);
  const recommendations: AIAdvisorRecommendation[] = [];

  if (limitation.kineticScore >= limitation.massTransferScore) {
    recommendations.push({
      priority: 1,
      parameter: "pgmLoading_g_ft3",
      currentValue: String(catalyst.pgmLoading_g_ft3),
      suggestedValue: String(Math.round(catalyst.pgmLoading_g_ft3 * 1.3)),
      expectedImprovement: "T50 shift ~-10-15°C per 30% PGM increase",
      rationale: "Higher PGM loading increases active site density, lowering light-off temperature",
      tradeoffs: "~30% increase in PGM cost",
      confidence: "high",
    });
  }

  if (limitation.massTransferScore > 2 && catalyst.cpsi < 600) {
    recommendations.push({
      priority: 2,
      parameter: "cpsi",
      currentValue: String(catalyst.cpsi),
      suggestedValue: "600",
      expectedImprovement: "T50 shift ~-8°C, improved GSA by ~20%",
      rationale: "Higher cell density increases geometric surface area and mass transfer coefficient",
      tradeoffs: "Higher backpressure (+15-25%), thinner walls required",
      confidence: "high",
    });
  }

  if (limitation.thermalScore > 2 && catalyst.splitConfig === "single") {
    recommendations.push({
      priority: 3,
      parameter: "splitConfig",
      currentValue: "single",
      suggestedValue: "2in_1in_2in",
      expectedImprovement: "Light-off improvement 10-20% in first brick due to zone coating effect",
      rationale: "Split substrate with air gap allows faster heat-up of first brick and zone coating",
      tradeoffs: "Additional packaging complexity, +€5-10 per unit",
      confidence: "medium",
    });
  }

  return {
    diagnosis: {
      primaryLimitation: limitation.primaryLimitation,
      failingSpecies,
      summary: `Deterministic analysis: primary limitation is ${limitation.primaryLimitation}. AI parsing failed, using rule-based fallback.`,
      coldStartContribution_pct: limitation.coldStartPct,
      detailedAnalysis: {
        kinetic: `Score: ${limitation.kineticScore}/6. ${limitation.kineticScore > 3 ? "Significant kinetic limitation detected." : "Kinetics appear adequate."}`,
        massTransfer: `Score: ${limitation.massTransferScore}/6. Peak GHSV indicates ${limitation.massTransferScore > 3 ? "mass transfer limited operation" : "acceptable mass transfer"}.`,
        thermal: `Score: ${limitation.thermalScore}/5. Cold start contributes ${limitation.coldStartPct.toFixed(0)}% of total emissions.`,
        aging: `Score: ${limitation.agingScore}/4. ${limitation.agingScore > 2 ? "Severe deactivation detected." : "Aging within acceptable range."}`,
      },
    },
    recommendations,
    alternativeFormulation: {
      description: "Consider alternative PGM formulation",
      pgm_ratio: sgbData.pgm_ratio,
      pgmLoading_g_ft3: Math.round(sgbData.pgmLoading_g_ft3 * 1.2),
      washcoatType: sgbData.catalystType === "TWC" ? "ceria" : "oxidation",
      rationale: "Fallback suggestion based on deterministic gap analysis",
    },
    overallAssessment: {
      canPassWithModifications: failingSpecies.length <= 2,
      estimatedIterations: failingSpecies.length + 1,
      costImpact: "higher",
      summary: `${failingSpecies.length} species failing. Rule-based recommendations provided (AI parsing failed).`,
    },
    raw: rawContent,
    tokensUsed,
  };
}
