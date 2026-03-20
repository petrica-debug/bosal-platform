/**
 * Competitor benchmarking — static data for major AM catalyst manufacturers
 * and comparison logic against a Bosal design.
 */

/* ================================================================== */
/*  Types                                                             */
/* ================================================================== */

export interface CompetitorProfile {
  name: string;
  shortName: string;
  /** Market share estimate in EU AM catalyst market (%) */
  marketSharePct: number;
  /** Typical PGM loading strategy relative to OEM */
  pgmStrategyDescription: string;
  /** Typical PGM fraction of OEM fresh (0.5 = 50%) */
  typicalPgmFractionOfOem: number;
  /** Substrate quality tier */
  substrateTier: "premium" | "standard" | "economy";
  /** Typical warranty in months */
  warrantyMonths: number;
  /** Typical warranty in km */
  warrantyKm: number;
  /** R103 coverage breadth (number of engine families typically covered) */
  r103CoverageBreadth: "wide" | "medium" | "narrow";
  /** Retail price positioning vs Bosal (multiplier: 1.0 = same, 0.8 = 20% cheaper) */
  priceVsBosal: number;
  /** Known strengths */
  strengths: string[];
  /** Known weaknesses */
  weaknesses: string[];
}

export interface BenchmarkComparison {
  competitor: CompetitorProfile;
  /** PGM loading comparison */
  pgmComparison: "higher" | "similar" | "lower";
  pgmDiffPct: number;
  /** Price comparison */
  priceComparison: "more-expensive" | "similar" | "cheaper";
  priceDiffPct: number;
  /** Warranty comparison */
  warrantyComparison: "longer" | "similar" | "shorter";
  /** Overall competitive position */
  position: "advantage" | "neutral" | "disadvantage";
  positionNotes: string[];
}

export interface BenchmarkResult {
  bosal: {
    pgmGPerL: number;
    estimatedRetailEur: number;
    warrantyMonths: number;
    warrantyKm: number;
    r103Coverage: string;
  };
  comparisons: BenchmarkComparison[];
  summary: string;
}

/* ================================================================== */
/*  Competitor Database                                               */
/* ================================================================== */

export const COMPETITORS: CompetitorProfile[] = [
  {
    name: "Walker / Tenneco",
    shortName: "Walker",
    marketSharePct: 22,
    pgmStrategyDescription: "Conservative loading, close to OEM levels. Premium positioning.",
    typicalPgmFractionOfOem: 0.65,
    substrateTier: "premium",
    warrantyMonths: 24,
    warrantyKm: 80_000,
    r103CoverageBreadth: "wide",
    priceVsBosal: 1.15,
    strengths: ["Widest R103 coverage in EU", "Strong OEM relationships", "Premium substrate quality"],
    weaknesses: ["Higher retail price", "Slower time-to-market for new applications"],
  },
  {
    name: "Klarius",
    shortName: "Klarius",
    marketSharePct: 12,
    pgmStrategyDescription: "Balanced approach with good PGM efficiency. UK manufacturing.",
    typicalPgmFractionOfOem: 0.58,
    substrateTier: "standard",
    warrantyMonths: 24,
    warrantyKm: 60_000,
    r103CoverageBreadth: "medium",
    priceVsBosal: 0.95,
    strengths: ["Competitive pricing", "Fast UK delivery", "Good technical support"],
    weaknesses: ["Limited diesel coverage", "Smaller R103 portfolio than Walker"],
  },
  {
    name: "BM Catalysts",
    shortName: "BM",
    marketSharePct: 18,
    pgmStrategyDescription: "Cost-optimized loading, aggressive derating on value lines.",
    typicalPgmFractionOfOem: 0.52,
    substrateTier: "standard",
    warrantyMonths: 24,
    warrantyKm: 50_000,
    r103CoverageBreadth: "wide",
    priceVsBosal: 0.85,
    strengths: ["Largest catalog in EU", "Aggressive pricing", "Fast availability"],
    weaknesses: ["Lower PGM loading may cause OBD issues on sensitive platforms", "Economy substrate on some lines"],
  },
  {
    name: "Ernst",
    shortName: "Ernst",
    marketSharePct: 8,
    pgmStrategyDescription: "German quality focus, moderate PGM loading.",
    typicalPgmFractionOfOem: 0.60,
    substrateTier: "premium",
    warrantyMonths: 36,
    warrantyKm: 100_000,
    r103CoverageBreadth: "narrow",
    priceVsBosal: 1.25,
    strengths: ["Longest warranty in market", "Premium quality perception", "Strong in DACH region"],
    weaknesses: ["Limited application range", "Highest price point", "Slow catalog expansion"],
  },
  {
    name: "EEC (European Exhaust & Catalyst)",
    shortName: "EEC",
    marketSharePct: 10,
    pgmStrategyDescription: "Mid-range loading, broad European coverage.",
    typicalPgmFractionOfOem: 0.55,
    substrateTier: "standard",
    warrantyMonths: 24,
    warrantyKm: 60_000,
    r103CoverageBreadth: "medium",
    priceVsBosal: 0.90,
    strengths: ["Good price/performance ratio", "Solid European distribution"],
    weaknesses: ["Limited brand recognition", "Smaller technical team"],
  },
];

/* ================================================================== */
/*  Benchmarking Logic                                                */
/* ================================================================== */

/**
 * Compare a Bosal AM design against all major competitors.
 */
export function benchmarkVsCompetitors(params: {
  bosalPgmGPerL: number;
  oemFreshPgmGPerL: number;
  bosalEstimatedRetailEur: number;
  bosalWarrantyMonths?: number;
  bosalWarrantyKm?: number;
  bosalR103Coverage?: string;
}): BenchmarkResult {
  const {
    bosalPgmGPerL,
    oemFreshPgmGPerL,
    bosalEstimatedRetailEur,
    bosalWarrantyMonths = 24,
    bosalWarrantyKm = 80_000,
    bosalR103Coverage = "Standard",
  } = params;

  const bosalPgmFraction = bosalPgmGPerL / oemFreshPgmGPerL;

  const comparisons: BenchmarkComparison[] = COMPETITORS.map((comp) => {
    const compPgmGPerL = oemFreshPgmGPerL * comp.typicalPgmFractionOfOem;
    const pgmDiffPct = +((bosalPgmGPerL - compPgmGPerL) / compPgmGPerL * 100).toFixed(1);
    const pgmComparison: BenchmarkComparison["pgmComparison"] =
      pgmDiffPct > 5 ? "higher" : pgmDiffPct < -5 ? "lower" : "similar";

    const compPrice = bosalEstimatedRetailEur * comp.priceVsBosal;
    const priceDiffPct = +((bosalEstimatedRetailEur - compPrice) / compPrice * 100).toFixed(1);
    const priceComparison: BenchmarkComparison["priceComparison"] =
      priceDiffPct > 5 ? "more-expensive" : priceDiffPct < -5 ? "cheaper" : "similar";

    const warrantyComparison: BenchmarkComparison["warrantyComparison"] =
      bosalWarrantyMonths > comp.warrantyMonths ? "longer" :
      bosalWarrantyMonths < comp.warrantyMonths ? "shorter" : "similar";

    // Overall position scoring
    let score = 0;
    const positionNotes: string[] = [];

    if (bosalPgmFraction > comp.typicalPgmFractionOfOem + 0.03) {
      score += 1;
      positionNotes.push("Higher PGM loading → better emission performance and OBD margin");
    }
    if (bosalPgmFraction < comp.typicalPgmFractionOfOem - 0.03) {
      score -= 1;
      positionNotes.push("Lower PGM loading → potential OBD risk vs competitor");
    }
    if (priceDiffPct < -5) {
      score += 1;
      positionNotes.push("Price advantage");
    }
    if (priceDiffPct > 5) {
      score -= 1;
      positionNotes.push("Price disadvantage");
    }
    if (bosalWarrantyMonths > comp.warrantyMonths) {
      score += 0.5;
      positionNotes.push("Longer warranty");
    }

    const position: BenchmarkComparison["position"] =
      score > 0 ? "advantage" : score < 0 ? "disadvantage" : "neutral";

    return {
      competitor: comp,
      pgmComparison,
      pgmDiffPct,
      priceComparison,
      priceDiffPct,
      warrantyComparison,
      position,
      positionNotes,
    };
  });

  const advantages = comparisons.filter((c) => c.position === "advantage").length;
  const disadvantages = comparisons.filter((c) => c.position === "disadvantage").length;

  let summary: string;
  if (advantages > disadvantages) {
    summary = `Bosal design is competitively positioned against ${advantages} of ${comparisons.length} major competitors. PGM loading at ${(bosalPgmFraction * 100).toFixed(0)}% of OEM provides good emission margin.`;
  } else if (disadvantages > advantages) {
    summary = `Bosal design faces competitive pressure from ${disadvantages} of ${comparisons.length} competitors. Consider adjusting PGM loading or pricing strategy.`;
  } else {
    summary = `Bosal design is neutrally positioned in the market. Differentiation through warranty, technical support, or R103 coverage breadth recommended.`;
  }

  return {
    bosal: {
      pgmGPerL: bosalPgmGPerL,
      estimatedRetailEur: bosalEstimatedRetailEur,
      warrantyMonths: bosalWarrantyMonths,
      warrantyKm: bosalWarrantyKm,
      r103Coverage: bosalR103Coverage,
    },
    comparisons,
    summary,
  };
}
