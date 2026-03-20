import type { EcsComponentRecord } from "./types";
import {
  AM_DESIGN_GUIDANCE,
  ECS_COMPONENTS,
  OEM_DB_MANIFEST,
  PT_PD_SUBSTITUTION,
  SOURCE_TRACEABILITY,
  SYSTEM_ARCHITECTURE,
  WASHCOAT_CHEMISTRY,
} from "./data";

function ecsToMarkdown(r: EcsComponentRecord): string {
  const lines = [
    `### ${r.brand ?? "?"} — ${r.engineFamily ?? ""} (${r.engineCodes ?? ""})`,
    `- **Emission std / years:** ${r.emissionStandard ?? "—"} / ${r.years ?? "—"}`,
    `- **Vehicle examples:** ${r.vehicleExamples ?? "—"}`,
    `- **Component:** ${r.componentType ?? "—"} @ ${r.position ?? "—"} (Comp# ${r.componentNumber ?? "—"})`,
    `- **Substrate:** ${r.substrate ?? "—"} (${r.substrateSupplier ?? "—"}) Ø${r.diameterMm ?? "—"}mm × L${r.lengthMm ?? "—"}mm, Vol ${r.volumeL ?? "—"}L, ${r.cpsi ?? "—"} CPSI`,
    `- **Washcoat:** ${r.wcLayers ?? "—"} layers, total ${r.wcTotalGPerL ?? "—"} g/L | L1 PGM: ${r.l1Pgm ?? "—"} | L2 PGM: ${r.l2Pgm ?? "—"}`,
    `- **PGM (g/L):** Pt ${r.ptGPerL ?? "—"}, Pd ${r.pdGPerL ?? "—"}, Rh ${r.rhGPerL ?? "—"} (total ${r.totalPgmGPerL ?? "—"})`,
    `- **T50:** CO ${r.t50CoC ?? "—"}°C, HC ${r.t50HcC ?? "—"}°C, NOx ${r.t50NoxC ?? "—"}°C`,
    `- **Aging / confidence / source:** ${r.agingProtocol ?? "—"} | ${r.confidence ?? "—"} | ${r.source ?? "—"}`,
  ];
  return lines.join("\n");
}

function compactJson(obj: unknown, maxChars = 12000): string {
  const s = JSON.stringify(obj, null, 2);
  if (s.length <= maxChars) return s;
  return `${s.slice(0, maxChars)}\n… [truncated, ${s.length} chars total]`;
}

/**
 * Build RAG-style context for the AM homologation copilot.
 * Include selected ECS rows in full; include summary tables for other sheets.
 */
export function buildAmCopilotContext(options: {
  selectedRecords: EcsComponentRecord[];
  includeFullReferenceTables?: boolean;
}): string {
  const { selectedRecords, includeFullReferenceTables = false } = options;

  const parts: string[] = [
    "## Database metadata",
    `- Version: ${OEM_DB_MANIFEST.databaseVersion} (source: ${OEM_DB_MANIFEST.sourceFile})`,
    `- Generated: ${OEM_DB_MANIFEST.generatedAt}`,
    `- Record counts: ECS ${OEM_DB_MANIFEST.counts.ecsComponents}, washcoat ${OEM_DB_MANIFEST.counts.washcoatChemistry}, AM guidance ${OEM_DB_MANIFEST.counts.amDesignGuidance}, architecture ${OEM_DB_MANIFEST.counts.systemArchitecture}, Pt-Pd ${OEM_DB_MANIFEST.counts.ptPdSubstitution}${OEM_DB_MANIFEST.counts.sourceTraceability != null ? `, source traceability ${OEM_DB_MANIFEST.counts.sourceTraceability}` : ""}`,
    "",
    "## Source traceability (data tiers — use when judging confidence)",
    SOURCE_TRACEABILITY.length > 0
      ? compactJson(SOURCE_TRACEABILITY, 16000)
      : "_No source traceability sheet in this export._",
    "",
    "## Instructions for the assistant",
    "Use ONLY the facts below when citing specific numbers, part attributes, or OEM reference ranges.",
    "If the user asks outside this data, say you are extrapolating and label assumptions clearly.",
    "For Bosal AM homologation: align fresh AM targets with ECE R103 / OBD compatibility per AM Design Guidance.",
    "",
  ];

  if (selectedRecords.length > 0) {
    parts.push("## Selected ECS component reference rows (primary evidence)");
    for (const r of selectedRecords) {
      parts.push(ecsToMarkdown(r));
      parts.push("");
    }
  } else {
    parts.push(
      "## No specific ECS row selected",
      "Answer from general tables below or ask the user to select a reference engine/component from the database.",
      "",
    );
  }

  parts.push("## AM design guidance (ECE R103 / OBD — fresh vs OEM aged targets)");
  parts.push(compactJson(AM_DESIGN_GUIDANCE, 8000));
  parts.push("");

  parts.push("## System architecture map (AM replacement strategy by archetype)");
  parts.push(compactJson(SYSTEM_ARCHITECTURE, 6000));
  parts.push("");

  if (includeFullReferenceTables) {
    parts.push("## Washcoat chemistry detail (layer formulations)");
    parts.push(compactJson(WASHCOAT_CHEMISTRY, 14000));
    parts.push("");
    parts.push("## Pt–Pd substitution timeline");
    parts.push(compactJson(PT_PD_SUBSTITUTION, 4000));
    parts.push("");
  } else {
    parts.push(
      "## Washcoat & Pt–Pd sheets",
      `Full washcoat rows: ${WASHCOAT_CHEMISTRY.length}; Pt-Pd rows: ${PT_PD_SUBSTITUTION.length}.`,
      "Ask the user to narrow by OEM archetype / emission era if detailed washcoat matching is needed.",
      "",
    );
  }

  parts.push("## Full ECS catalog size");
  parts.push(
    `Total ECS component records available in app: ${ECS_COMPONENTS.length}. User may filter/search in UI.`,
  );

  return parts.join("\n");
}

/* ------------------------------------------------------------------ */
/*  Variant-aware context for the wizard API                          */
/* ------------------------------------------------------------------ */

export interface VariantContextInput {
  selectedRecords: EcsComponentRecord[];
  emissionStandard: string;
  componentScope: string[];
  /** Pre-computed variant summaries (from variant-engine) */
  variantSummaries?: {
    tier: string;
    pgmTotalGPerL: number;
    oscTargetGPerL: number;
    oscRatio: number;
    obdRisk: string;
  }[];
  wizardStep?: string;
}

export function buildVariantContext(input: VariantContextInput): string {
  const { selectedRecords, emissionStandard, componentScope, variantSummaries, wizardStep } = input;

  const parts: string[] = [
    "## Database metadata",
    `- Version: ${OEM_DB_MANIFEST.databaseVersion} (source: ${OEM_DB_MANIFEST.sourceFile})`,
    "",
    `## Wizard context — step: ${wizardStep ?? "variant-generation"}`,
    `- Emission standard: ${emissionStandard}`,
    `- Component scope: ${componentScope.join(", ")}`,
    "",
  ];

  if (selectedRecords.length > 0) {
    parts.push("## OEM reference rows (pinned by engineer)");
    for (const r of selectedRecords) {
      parts.push(ecsToMarkdown(r));
      parts.push("");
    }
  }

  parts.push("## AM design guidance");
  parts.push(compactJson(AM_DESIGN_GUIDANCE, 6000));
  parts.push("");

  parts.push("## Source traceability");
  parts.push(compactJson(SOURCE_TRACEABILITY, 8000));
  parts.push("");

  parts.push("## System architecture map");
  parts.push(compactJson(SYSTEM_ARCHITECTURE, 4000));
  parts.push("");

  parts.push("## Washcoat chemistry detail");
  parts.push(compactJson(WASHCOAT_CHEMISTRY, 10000));
  parts.push("");

  if (variantSummaries && variantSummaries.length > 0) {
    parts.push("## Pre-computed AM variants (from Bosal derating engine)");
    for (const v of variantSummaries) {
      parts.push(
        `- **${v.tier}**: PGM ${v.pgmTotalGPerL} g/L, OSC target ${v.oscTargetGPerL} g/L, OSC ratio ${v.oscRatio}, OBD risk ${v.obdRisk}`,
      );
    }
    parts.push("");
  }

  return parts.join("\n");
}
