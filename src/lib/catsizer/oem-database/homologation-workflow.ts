/**
 * Static homologation workflow hints for the Bosal AM team (UI + copilot grounding).
 * Not a legal checklist — engineering process orientation only.
 */

export const HOMOLOGATION_WORKFLOW_STEPS = [
  {
    phase: "1. Reference vehicle & OEM baseline",
    items: [
      "Identify target engine family, emission standard (e.g. E6b, E6d-T), and vehicle examples from the ECS database.",
      "Pin the closest OEM reference row(s) in the AM Homologation Copilot for AI context.",
      "Note **Source Traceability** tier for each number you will cite (assay vs patent vs estimate).",
    ],
  },
  {
    phase: "2. AM design targets",
    items: [
      "Compare planned Bosal catalyst to **AM Design Guidance**: fresh AM vs OEM aged PGM, Rh, washcoat loading.",
      "Check **System Architecture Map** for which brick(s) are in scope (CC TWC, GPF, SCR, etc.).",
    ],
  },
  {
    phase: "3. Evidence & validation",
    items: [
      "Plan ICP-OES / coated–bare weight / performance tests where the database tier is not HIGH.",
      "Document assumptions separately from measured or Tier-1-sourced data for the dossier.",
    ],
  },
  {
    phase: "4. Simulation & sizing (platform tools)",
    items: [
      "Run **OEM Sizing** (depollution calculator) for volumes, GHSV, and RFQ-grade specs where applicable.",
      "Use **WLTP Simulation** when transient / g·km evidence is part of the argument.",
    ],
  },
] as const;

export const COPILOT_QUICK_PROMPTS = [
  {
    label: "PGM & R103",
    text: "For my pinned reference(s), what total PGM (g/L) and Rh window aligns with AM Design Guidance vs OEM aged, and what goes wrong if we are too fresh (OBD / ECE R103)?",
  },
  {
    label: "Traceability",
    text: "Which Source Traceability tier applies to the numbers I would cite from this reference, and what validation should Bosal run before homologation submission?",
  },
  {
    label: "Architecture",
    text: "Using the System Architecture Map, which component(s) should our AM part replace for this application, and what must stay OEM?",
  },
  {
    label: "Dossier outline",
    text: "Draft an audit-friendly outline for an internal homologation memo: scope, OEM baseline, AM targets, evidence gaps, and recommended tests.",
  },
  {
    label: "Washcoat / layers",
    text: "Summarize washcoat layer roles (L1/L2) and OSC/PGM split for the pinned OEM archetype, and what we should match or deliberately offset for AM.",
  },
] as const;

export type CopilotAnswerFocus = "balanced" | "evidence" | "dossier" | "pgm";

/* ------------------------------------------------------------------ */
/*  Derating constants by emission standard                           */
/* ------------------------------------------------------------------ */

export interface DeratingRange {
  pgm: [number, number];
  osc: [number, number];
}

export const DERATING_BY_STANDARD: Record<string, DeratingRange> = {
  "Euro 6b": { pgm: [0.55, 0.65], osc: [0.60, 0.70] },
  "E6b":     { pgm: [0.55, 0.65], osc: [0.60, 0.70] },
  "Euro 6d-TEMP": { pgm: [0.60, 0.70], osc: [0.65, 0.72] },
  "E6d-T":        { pgm: [0.60, 0.70], osc: [0.65, 0.72] },
  "Euro 6d": { pgm: [0.65, 0.75], osc: [0.68, 0.75] },
  "E6d":     { pgm: [0.65, 0.75], osc: [0.68, 0.75] },
  "Euro 6e": { pgm: [0.70, 0.80], osc: [0.72, 0.78] },
  "E6e":     { pgm: [0.70, 0.80], osc: [0.72, 0.78] },
};

export const DEFAULT_DERATING: DeratingRange = { pgm: [0.60, 0.70], osc: [0.65, 0.72] };

/** Variant tier offsets relative to the standard derating range midpoint. */
export const VARIANT_TIER_OFFSETS = {
  performance: 0.05,
  balanced: 0.0,
  value: -0.05,
} as const;

/* ------------------------------------------------------------------ */
/*  Cost defaults (EUR, 2025 baseline)                                */
/* ------------------------------------------------------------------ */

export const DEFAULT_PGM_PRICES = {
  pdEurPerG: 28,
  rhEurPerG: 145,
  ptEurPerG: 30,
} as const;

/** Substrate cost per litre by material. */
export const SUBSTRATE_COST_EUR_PER_L = {
  ceramic: 18,
  metallic: 32,
} as const;

/** Washcoat cost per g/L applied (includes carrier, OSC, promoters). */
export const WASHCOAT_COST_EUR_PER_GPL = 0.12;

/** Canning + assembly flat rate per unit. */
export const CANNING_COST_EUR = 14;

/** AM retail target as fraction of OEM dealer price. */
export const AM_RETAIL_MULTIPLIER: [number, number] = [0.35, 0.55];

/** Default AM market penetration for catalyst replacement. */
export const DEFAULT_AM_PENETRATION_PCT = 10;

export function copilotFocusInstruction(focus: CopilotAnswerFocus): string {
  switch (focus) {
    case "evidence":
      return `## Requested response style: EVIDENCE & TRACEABILITY
Lead with Source Traceability tiers and confidence. For each major claim, state what the database proves vs what requires ICP-OES, bench test, or vehicle data.`;
    case "dossier":
      return `## Requested response style: HOMOLOGATION MEMO
Produce sections suitable for an internal dossier: Executive summary, OEM reference, AM targets, Evidence table (claim / source tier / gap), Risks, Recommended actions.`;
    case "pgm":
      return `## Requested response style: PGM & ACTIVITY
Focus on PGM g/L, Pt:Pd:Rh, OSC, T50, AM fresh vs OEM aged targets, and OBD/R103 implications. Use numbers from context.`;
    default:
      return "";
  }
}
