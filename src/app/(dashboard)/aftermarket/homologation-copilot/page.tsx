"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  FileText,
  FlaskConical,
  Loader2,
  Search,
  Send,
  Sparkles,
  XCircle,
  ClipboardList,
  Info,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { EcsComponentRecord } from "@/lib/catsizer/oem-database/types";
import {
  AM_DESIGN_GUIDANCE,
  COPILOT_QUICK_PROMPTS,
  ECS_COMPONENTS,
  HOMOLOGATION_WORKFLOW_STEPS,
  OEM_DB_MANIFEST,
  PT_PD_SUBSTITUTION,
  SOURCE_TRACEABILITY,
  SYSTEM_ARCHITECTURE,
  WASHCOAT_CHEMISTRY,
  filterEcsWithGlobalIndices,
  uniqueBrands,
  uniqueEmissionStandards,
  uniqueFuels,
  type CopilotAnswerFocus,
} from "@/lib/catsizer/oem-database";

import { useWizard } from "./use-wizard";
import { WIZARD_STEPS } from "./wizard-types";
import {
  Step1VehicleScope,
  Step2OemReference,
  Step3SystemDesign,
  Step4CatalystDesign,
  Step5PerformanceTest,
  Step6BusinessCase,
  Step7R103Package,
} from "./wizard-steps";

const MAX_PINNED = 12;
const PAGE_SIZE = 30;

function formatCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return String(v);
}

function boldInline(text: string): ReactNode {
  const parts = text.split(/(\*\*.+?\*\*)/g);
  return parts.map((part, i) => {
    const m = /^\*\*(.+)\*\*$/.exec(part);
    if (m) return <strong key={i}>{m[1]}</strong>;
    return part;
  });
}

// ============================================================
// ENGINEERING RULE CHECKER
// Rules fire automatically on the current formulation state.
// Each rule cites a specific reason and recommended action.
// ============================================================

type RuleLevel = "error" | "warn" | "info";

interface EngRule {
  level: RuleLevel;
  code: string;
  text: string;
  action: string;
}

function computeEngineeringRules(wiz: ReturnType<typeof useWizard>): EngRule[] {
  const rules: EngRule[] = [];
  const selected = wiz.variants.variants.find((v) => v.tier === wiz.variants.selectedTier);

  if (!selected) return rules;

  const aging = selected.agingPrediction;
  const result = wiz.wltpSim.result;

  // ── PGM rules ────────────────────────────────────────────────
  const pdRh = selected.pgm.pdRhRatio;
  if (pdRh > 15) {
    rules.push({
      level: "warn",
      code: "PD-RH-RATIO",
      text: `Pd:Rh = ${pdRh}:1 — high ratio increases NOx cold-start slip.`,
      action: "For Euro 6d TWC: target Pd:Rh ≤ 10:1. Increase Rh to ≥ 4 g/ft³ (SAE 2018-01-0944).",
    });
  }

  if (selected.pgm.totalGPerFt3 < 20) {
    rules.push({
      level: "warn",
      code: "PGM-LOW",
      text: `Total PGM = ${selected.pgm.totalGPerFt3} g/ft³ — below typical AM minimum for Euro 6d TWC.`,
      action: "Euro 6d TWC typically requires 60–120 g/ft³ total PGM. Increase to at least 60 g/ft³.",
    });
  }

  if (selected.pgm.rhGPerL < 1) {
    rules.push({
      level: "error",
      code: "RH-CRITICAL",
      text: `Rh = ${selected.pgm.rhGPerL} g/L — critically low. NOx conversion will be inadequate.`,
      action: "Minimum Rh for Euro 6d: 1.5–3 g/L. This formulation will likely fail R103 NOx.",
    });
  }

  // ── OSC rules ────────────────────────────────────────────────
  const osc = Number(selected.oscTargetGPerL);
  if (osc < 50 && selected.pgm.rhGPerL > 0) {
    rules.push({
      level: "warn",
      code: "OSC-LOW",
      text: `OSC = ${osc} g/L — insufficient oxygen buffer for Euro 6d TWC.`,
      action: "Typical TWC requires 80–150 g/L Ce-Zr OSC. Low OSC narrows the lambda window and raises DF.",
    });
  }

  // ── T50 rules ────────────────────────────────────────────────
  if (aging) {
    if (aging.predictedT50CoC > 300) {
      rules.push({
        level: "error",
        code: "T50-HIGH",
        text: `Aged T50 CO = ${aging.predictedT50CoC}°C — too high for Euro 6d cold start requirement.`,
        action: "Maximum aged T50 CO for Euro 6d: ~280°C. Increase Pd loading or reduce aging temperature by ≥20°C.",
      });
    } else if (aging.predictedT50CoC > 260) {
      rules.push({
        level: "warn",
        code: "T50-MARGINAL",
        text: `Aged T50 CO = ${aging.predictedT50CoC}°C — marginal. Cold-start risk during type approval.`,
        action: "Consider increasing Pd by 10–15 g/ft³ to pull T50 below 250°C after aging.",
      });
    }

    if (aging.osc.retentionPct < 55) {
      rules.push({
        level: "warn",
        code: "OSC-RETENTION",
        text: `OSC retention after aging = ${aging.osc.retentionPct}% — accelerated sintering likely.`,
        action: "Add La₂O₃ or BaO stabiliser (2–5 wt%) to improve Ce-Zr thermal stability above 900°C.",
      });
    }
  }

  // ── WLTP / DF rules ──────────────────────────────────────────
  if (result) {
    const DF_LIMITS = { CO: 1.55, HC: 1.4375, NOx: 1.38 }; // 1.15 × OEM ref

    if (result.DF_CO > DF_LIMITS.CO) {
      rules.push({
        level: "error",
        code: "DF-CO-FAIL",
        text: `DF_CO = ${result.DF_CO.toFixed(2)} — exceeds R103 limit of ${DF_LIMITS.CO}. Will FAIL type approval.`,
        action: "Options: (1) Increase Ce-Zr OSC by +20 g/L, (2) Reduce aging protocol by 20h, (3) Increase Pd by 10 g/ft³.",
      });
    } else if (result.DF_CO > 1.35) {
      rules.push({
        level: "warn",
        code: "DF-CO-MARGIN",
        text: `DF_CO = ${result.DF_CO.toFixed(2)} — within ${((DF_LIMITS.CO - result.DF_CO) / DF_LIMITS.CO * 100).toFixed(0)}% of R103 limit.`,
        action: "Low margin. Upload chassis dyno data in Lab Data to validate this estimate (±20% model uncertainty).",
      });
    }

    if (result.DF_NOx > DF_LIMITS.NOx) {
      rules.push({
        level: "error",
        code: "DF-NOX-FAIL",
        text: `DF_NOx = ${result.DF_NOx.toFixed(2)} — exceeds R103 limit of ${DF_LIMITS.NOx}.`,
        action: "Increase Rh loading — it is the primary NOx catalyst. Also check OSC content and lambda calibration.",
      });
    }

    if (result.overallVerdict === "red") {
      const failing = result.homologation
        .filter((h) => h.verdict === "red")
        .map((h) => `${h.species}: ${h.cumulative_g_km.toFixed(3)} g/km (limit ${h.limit_g_km})`)
        .join(", ");
      rules.push({
        level: "error",
        code: "WLTP-FAIL",
        text: `WLTP FAIL — ${failing}`,
        action: "Go to Performance tab → click 'Find passing configuration' for a minimum-change fix.",
      });
    }
  }

  // ── Substrate rules ───────────────────────────────────────────
  const substrate = selected.substrate;
  if (substrate) {
    const vol = (Math.PI * Math.pow(substrate.diameterMm / 2, 2) * substrate.lengthMm) / 1e6;
    const preset = wiz.variants.variants[0];
    if (preset && vol < 0.8) {
      rules.push({
        level: "warn",
        code: "SUBSTRATE-SMALL",
        text: `Substrate volume ≈ ${vol.toFixed(2)} L — may be undersized for target engine displacement.`,
        action: "Typical TWC sizing: 0.8–1.5× engine displacement. Check GHSV < 150,000 h⁻¹ at rated power.",
      });
    }
  }

  return rules;
}

// ============================================================
// ENGINEERING RULES PANEL
// ============================================================

function EngineeringRulesPanel({ rules }: { rules: EngRule[] }) {
  const [expanded, setExpanded] = useState(true);

  if (rules.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="size-3.5 shrink-0" />
        No engineering rule violations detected on the current formulation.
      </div>
    );
  }

  const errors = rules.filter((r) => r.level === "error").length;
  const warns = rules.filter((r) => r.level === "warn").length;

  const iconMap: Record<RuleLevel, ReactNode> = {
    error: <XCircle className="size-3.5 shrink-0 text-red-500" />,
    warn:  <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />,
    info:  <Info className="size-3.5 shrink-0 text-blue-500" />,
  };
  const bgMap: Record<RuleLevel, string> = {
    error: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20",
    warn:  "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20",
    info:  "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20",
  };

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 bg-amber-50 dark:bg-amber-950/20 text-sm font-medium hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors"
      >
        <span className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-500" />
          Engineering Check
          {errors > 0 && (
            <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50 dark:bg-red-950/30 text-[10px] px-1 py-0">
              {errors} error{errors !== 1 ? "s" : ""}
            </Badge>
          )}
          {warns > 0 && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-[10px] px-1 py-0">
              {warns} warning{warns !== 1 ? "s" : ""}
            </Badge>
          )}
        </span>
        <span className="text-xs text-muted-foreground">{expanded ? "hide" : "show"}</span>
      </button>

      {expanded && (
        <div className="divide-y divide-border">
          {rules.map((rule, i) => (
            <div key={i} className={`px-3 py-2.5 ${bgMap[rule.level]}`}>
              <div className="flex items-start gap-2">
                {iconMap[rule.level]}
                <div className="space-y-0.5">
                  <p className="text-xs font-medium leading-snug">
                    <span className="font-mono text-[10px] opacity-60 mr-1">[{rule.code}]</span>
                    {rule.text}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">→ </span>{rule.action}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// OEM REFERENCE SIDEBAR (always visible)
// ============================================================

function OemSidebar({
  pinned,
  togglePin,
  onDetail,
}: {
  pinned: number[];
  togglePin: (i: number) => void;
  onDetail: (i: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [fuel, setFuel] = useState("all");
  const [emStd, setEmStd] = useState("all");
  const [brand, setBrand] = useState("all");
  const [tablePage, setTablePage] = useState(0);

  const fuels = useMemo(() => uniqueFuels(), []);
  const brands = useMemo(() => uniqueBrands(), []);
  const standards = useMemo(() => uniqueEmissionStandards(), []);

  const filteredRows = useMemo(
    () => filterEcsWithGlobalIndices({ search, fuel, emissionStandard: emStd, brand }),
    [search, fuel, emStd, brand],
  );
  useEffect(() => { setTablePage(0); }, [search, fuel, emStd, brand]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(tablePage, pageCount - 1);
  const pageRows = useMemo(
    () => filteredRows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [filteredRows, safePage],
  );

  const pinnedRecords = pinned.map((i) => ECS_COMPONENTS[i]).filter(Boolean);

  return (
    <div className="flex flex-col h-full gap-0 overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Database className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">OEM Reference</span>
          <span className="text-xs text-muted-foreground ml-auto">{OEM_DB_MANIFEST.counts.ecsComponents} records</span>
        </div>
        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-xs"
            placeholder="Engine, brand, vehicle…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {/* Compact filters */}
        <div className="grid grid-cols-3 gap-1">
          <Select value={fuel} onValueChange={setFuel}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Fuel" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All fuels</SelectItem>
              {fuels.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={emStd} onValueChange={setEmStd}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Std" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All std.</SelectItem>
              {standards.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={brand} onValueChange={setBrand}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Brand" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All brands</SelectItem>
              {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
            <tr>
              <th className="w-8 px-2 py-1.5"></th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Brand / Engine</th>
              <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">PGM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {pageRows.length === 0 ? (
              <tr><td colSpan={3} className="text-center text-muted-foreground py-6">No results</td></tr>
            ) : (
              pageRows.map(({ record: rec, globalIndex: gi }) => {
                const isPinned = pinned.includes(gi);
                return (
                  <tr
                    key={gi}
                    className={`cursor-pointer hover:bg-muted/40 transition-colors ${isPinned ? "bg-primary/5" : ""}`}
                  >
                    <td className="px-1 py-1">
                      <button
                        type="button"
                        onClick={() => togglePin(gi)}
                        className="p-1 rounded hover:bg-muted"
                      >
                        {isPinned
                          ? <BookmarkCheck className="size-3.5 text-primary" />
                          : <Bookmark className="size-3.5 text-muted-foreground" />}
                      </button>
                    </td>
                    <td className="px-2 py-1.5" onClick={() => onDetail(gi)}>
                      <div className="font-medium truncate max-w-[130px]" title={rec.brand ?? ""}>{rec.brand}</div>
                      <div className="text-muted-foreground truncate max-w-[130px]" title={rec.engineFamily ?? ""}>{rec.engineFamily}</div>
                      <div className="text-muted-foreground opacity-70">{rec.emissionStandard}</div>
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono" onClick={() => onDetail(gi)}>
                      {rec.totalPgmGPerL ?? "—"} g/L
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {/* Pagination */}
        <div className="flex items-center justify-between px-2 py-1.5 border-t text-xs text-muted-foreground bg-muted/30 sticky bottom-0">
          <span>{filteredRows.length} found</span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={safePage <= 0}
              onClick={() => setTablePage((p) => Math.max(0, p - 1))}
              className="p-0.5 rounded disabled:opacity-40 hover:bg-muted"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="px-1">{safePage + 1}/{pageCount}</span>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setTablePage((p) => Math.min(pageCount - 1, p + 1))}
              className="p-0.5 rounded disabled:opacity-40 hover:bg-muted"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Pinned references */}
      {pinnedRecords.length > 0 && (
        <div className="border-t shrink-0 max-h-[280px] overflow-y-auto">
          <div className="px-3 py-2 bg-primary/5 border-b">
            <p className="text-xs font-semibold text-primary">Pinned OEM Reference ({pinnedRecords.length})</p>
          </div>
          {pinnedRecords.map((rec, idx) => (
            <div key={idx} className="px-3 py-2 border-b last:border-0 text-xs">
              <p className="font-medium">{rec.brand} — {rec.engineFamily}</p>
              <div className="text-muted-foreground space-y-0.5 mt-0.5">
                <p>{rec.emissionStandard} · {rec.componentType}</p>
                <p className="font-mono">
                  ⌀{rec.diameterMm}×{rec.lengthMm}mm · {rec.cpsi} CPSI
                </p>
                <p className="font-mono">
                  Pt {rec.ptGPerL} · Pd {rec.pdGPerL} · Rh {rec.rhGPerL} g/L
                  <span className="font-semibold ml-1">(∑ {rec.totalPgmGPerL})</span>
                </p>
                {rec.t50CoC && (
                  <p className="font-mono text-[10px]">
                    T50: CO {rec.t50CoC}°C · HC {rec.t50HcC ?? "—"}°C · NOx {rec.t50NoxC ?? "—"}°C
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// STATUS BAR
// ============================================================

function StatusBar({ wiz }: { wiz: ReturnType<typeof useWizard> }) {
  const selected = wiz.variants.variants.find((v) => v.tier === wiz.variants.selectedTier);
  const result = wiz.wltpSim.result;
  const cost = selected ? wiz.economics.variantCosts[selected.tier] : null;
  const aging = selected?.agingPrediction;

  if (!selected && !wiz.vehicleScope.engineSearch) return null;

  const verdictColor = result
    ? result.overallVerdict === "green"
      ? "text-emerald-600 dark:text-emerald-400"
      : result.overallVerdict === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400"
    : "text-muted-foreground";

  const verdictLabel = result
    ? result.overallVerdict === "green" ? "WLTP PASS"
      : result.overallVerdict === "amber" ? "WLTP MARGINAL"
      : "WLTP FAIL"
    : "WLTP: not run";

  return (
    <div className="border-t bg-background/95 backdrop-blur-sm px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      {wiz.vehicleScope.engineSearch && (
        <span className="text-muted-foreground">
          <span className="font-medium text-foreground">{wiz.vehicleScope.engineSearch}</span>
          {" · "}{wiz.vehicleScope.emissionStandard}
        </span>
      )}
      {selected && (
        <>
          <span className="text-muted-foreground border-l pl-4">
            PGM: <span className="font-mono font-medium text-foreground">{selected.pgm.totalGPerFt3} g/ft³</span>
            <span className="opacity-60 ml-1">(Pd {selected.pgm.pdGPerL} / Rh {selected.pgm.rhGPerL} / Pt {selected.pgm.ptGPerL} g/L)</span>
          </span>
          {aging && (
            <span className="text-muted-foreground border-l pl-4">
              T50 CO: <span className={`font-mono font-medium ${aging.predictedT50CoC > 280 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                {aging.predictedT50CoC}°C
              </span>
              <span className="opacity-60 ml-1">(aged)</span>
            </span>
          )}
        </>
      )}
      {result && (
        <span className={`border-l pl-4 font-semibold ${verdictColor}`}>
          {verdictLabel}
          {result.DF_CO > 0 && (
            <span className="font-normal font-mono ml-1.5 opacity-80">
              DF: CO {result.DF_CO.toFixed(2)} · HC {result.DF_HC.toFixed(2)} · NOx {result.DF_NOx.toFixed(2)}
            </span>
          )}
        </span>
      )}
      {cost && (
        <span className="text-muted-foreground border-l pl-4">
          BOM: <span className="font-mono font-medium text-foreground">€{cost.totalBom.toFixed(2)}</span>
        </span>
      )}
    </div>
  );
}

// ============================================================
// SECTION NAVIGATION
// ============================================================

// Map sections to the wizard step indices they contain
const SECTIONS = [
  { id: "target",      label: "① Target",      description: "Engine & OEM reference",   steps: [0, 1, 2] },
  { id: "design",      label: "② Design",       description: "Catalyst formulation",     steps: [3] },
  { id: "performance", label: "③ Performance",  description: "WLTP · DF · OBD",         steps: [4] },
  { id: "economics",   label: "④ Economics",    description: "Cost · family",            steps: [5] },
  { id: "r103",        label: "⑤ R103",         description: "Spec · type approval",     steps: [6] },
] as const;

type SectionId = typeof SECTIONS[number]["id"];

// ============================================================
// MAIN PAGE
// ============================================================

export default function HomologationCopilotPage() {
  const wiz = useWizard();

  // Pinned OEM indices (local; also synced to wiz.oemRef)
  const [pinned, setPinned] = useState<number[]>([]);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);

  // Active section tab
  const [activeSection, setActiveSection] = useState<SectionId>("target");

  // AI Copilot drawer
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotMessage, setCopilotMessage] = useState("");
  const [includeFullWashcoat, setIncludeFullWashcoat] = useState(false);
  const [answerFocus, setAnswerFocus] = useState<CopilotAnswerFocus>("balanced");
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotReply, setCopilotReply] = useState<string | null>(null);

  // Keep wizard pinned indices in sync
  useEffect(() => {
    wiz.oemRef.pinnedIndices.forEach((i) => {
      if (!pinned.includes(i)) setPinned((p) => [...p, i]);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePin = useCallback((gi: number) => {
    setPinned((prev) => {
      if (prev.includes(gi)) return prev.filter((i) => i !== gi);
      if (prev.length >= MAX_PINNED) {
        toast.message(`Maximum ${MAX_PINNED} reference rows`);
        return prev;
      }
      return [...prev, gi];
    });
  }, []);

  const detailRecord =
    detailIndex !== null && detailIndex >= 0 && detailIndex < ECS_COMPONENTS.length
      ? ECS_COMPONENTS[detailIndex]
      : null;

  // Engineering rules — live checks on current formulation
  const engineeringRules = useMemo(() => computeEngineeringRules(wiz), [wiz]);

  // Auto-advance section when wizard step changes due to internal navigation
  useEffect(() => {
    const section = SECTIONS.find((s) => (s.steps as readonly number[]).includes(wiz.step));
    if (section) setActiveSection(section.id);
  }, [wiz.step]);

  // When section tab changes, set wizard step to the first step of that section
  const handleSectionChange = useCallback((sectionId: string) => {
    const section = SECTIONS.find((s) => s.id === sectionId);
    if (section) {
      setActiveSection(sectionId as SectionId);
      wiz.goTo(section.steps[0] as number);
    }
  }, [wiz]);

  const runCopilot = useCallback(async () => {
    const msg = copilotMessage.trim();
    if (!msg) { toast.error("Enter a question"); return; }
    setCopilotLoading(true);
    setCopilotReply(null);
    try {
      const res = await fetch("/api/am-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, selectedIndices: pinned, includeFullWashcoat, answerFocus }),
      });
      const data = (await res.json()) as { content?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setCopilotReply(data.content ?? "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setCopilotLoading(false);
    }
  }, [copilotMessage, pinned, includeFullWashcoat, answerFocus]);

  const copyPinnedSummary = useCallback(async () => {
    if (pinned.length === 0) { toast.message("Pin at least one row"); return; }
    const lines = [
      `Bosal AM — OEM reference (${OEM_DB_MANIFEST.databaseVersion})`, "",
      ...pinned.map((i) => {
        const r = ECS_COMPONENTS[i];
        return [
          `${r.brand} — ${r.engineFamily} (${r.engineCodes}) · ${r.emissionStandard}`,
          `  Substrate: ${r.substrate} Ø${r.diameterMm}×L${r.lengthMm} mm · ${r.cpsi} CPSI`,
          `  PGM: Pt ${r.ptGPerL} · Pd ${r.pdGPerL} · Rh ${r.rhGPerL} (∑ ${r.totalPgmGPerL}) g/L`,
          `  T50: CO ${r.t50CoC ?? "—"} · HC ${r.t50HcC ?? "—"} · NOx ${r.t50NoxC ?? "—"} °C`,
          `  Confidence: ${r.confidence} — ${r.source}`,
        ].join("\n");
      }),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  }, [pinned]);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-4 py-2.5 border-b bg-background shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FlaskConical className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight leading-none">AM Product Development</h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {OEM_DB_MANIFEST.databaseVersion} · {OEM_DB_MANIFEST.counts.ecsComponents} ECS records
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pinned.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => void copyPinnedSummary()}>
              <Copy className="size-3.5" />
              Copy OEM ref ({pinned.length})
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setCopilotOpen(true)}
          >
            <Sparkles className="size-3.5" />
            Copilot
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={wiz.resetWizard}
          >
            Reset
          </Button>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: OEM Reference sidebar */}
        <aside className="w-[300px] xl:w-[340px] shrink-0 border-r flex flex-col overflow-hidden bg-background">
          <OemSidebar
            pinned={pinned}
            togglePin={togglePin}
            onDetail={(i) => setDetailIndex(i)}
          />
        </aside>

        {/* RIGHT: Design workspace */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Engineering rules */}
          <div className="px-4 pt-3 shrink-0">
            <EngineeringRulesPanel rules={engineeringRules} />
          </div>

          {/* Section tabs */}
          <div className="px-4 pt-3 shrink-0">
            <Tabs value={activeSection} onValueChange={handleSectionChange}>
              <TabsList className="w-full">
                {SECTIONS.map((s) => {
                  const hasContent =
                    s.id === "target"
                      ? !!(wiz.vehicleScope.engineSearch || wiz.oemRef.pinnedIndices.length > 0)
                      : s.id === "design"
                        ? !!wiz.variants.selectedTier
                        : s.id === "performance"
                          ? !!wiz.wltpSim.result
                          : s.id === "economics"
                            ? Object.keys(wiz.economics.variantCosts).length > 0
                            : !!wiz.specCardData.testPlan;
                  return (
                    <TabsTrigger key={s.id} value={s.id} className="flex-1 relative">
                      <span className="flex flex-col items-center gap-0">
                        <span className="text-xs">{s.label}</span>
                        <span className="text-[9px] opacity-60 hidden sm:block">{s.description}</span>
                      </span>
                      {hasContent && (
                        <span className="absolute top-0.5 right-1 size-1.5 rounded-full bg-primary/60" />
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>

          {/* Step content scrollable area */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {activeSection === "target" && (
              <div className="space-y-4">
                {wiz.step === 0 && <Step1VehicleScope wiz={wiz} />}
                {wiz.step === 1 && <Step2OemReference wiz={wiz} />}
                {wiz.step === 2 && <Step3SystemDesign wiz={wiz} />}
                {/* If the user hasn't progressed within target, show step 0 */}
                {![0, 1, 2].includes(wiz.step) && <Step1VehicleScope wiz={wiz} />}
              </div>
            )}
            {activeSection === "design" && <Step4CatalystDesign wiz={wiz} />}
            {activeSection === "performance" && <Step5PerformanceTest wiz={wiz} />}
            {activeSection === "economics" && <Step6BusinessCase wiz={wiz} />}
            {activeSection === "r103" && <Step7R103Package wiz={wiz} />}
          </div>

          {/* Status bar */}
          <StatusBar wiz={wiz} />
        </main>
      </div>

      {/* ── ECS component detail sheet ───────────────────────────── */}
      <Sheet open={detailIndex !== null} onOpenChange={(o) => !o && setDetailIndex(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>ECS component detail</SheetTitle>
            <SheetDescription>
              {detailRecord ? `${detailRecord.brand} — ${detailRecord.engineFamily}` : ""}
            </SheetDescription>
          </SheetHeader>
          {detailRecord && (
            <div className="mt-6 space-y-4 text-sm">
              <DetailGrid record={detailRecord} />
              <Button
                className="w-full"
                variant={pinned.includes(detailIndex!) ? "secondary" : "default"}
                onClick={() => detailIndex !== null && togglePin(detailIndex)}
              >
                {pinned.includes(detailIndex!) ? "Remove from reference" : "Pin as OEM reference"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── AI Copilot sheet ─────────────────────────────────────── */}
      <Sheet open={copilotOpen} onOpenChange={setCopilotOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto" side="right">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="size-4" />
              AI Copilot
            </SheetTitle>
            <SheetDescription>
              {OEM_DB_MANIFEST.databaseVersion} · {pinned.length} OEM refs pinned
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4">
            {/* Show engineering rules in copilot too */}
            {engineeringRules.length > 0 && (
              <div className="mb-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Active engineering flags</p>
                {engineeringRules.slice(0, 3).map((r, i) => (
                  <div key={i} className={`rounded border px-2 py-1.5 text-xs ${r.level === "error" ? "border-red-300 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300" : "border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300"}`}>
                    <p className="font-medium">[{r.code}] {r.text}</p>
                    <p className="opacity-80 mt-0.5">→ {r.action}</p>
                  </div>
                ))}
                {engineeringRules.length > 3 && (
                  <p className="text-xs text-muted-foreground">+{engineeringRules.length - 3} more flags — see Engineering Check panel</p>
                )}
                <Separator />
              </div>
            )}

            <Tabs defaultValue="qa" className="space-y-4">
              <TabsList className="w-full">
                <TabsTrigger value="qa" className="flex-1 gap-1.5">
                  <Sparkles className="size-3.5" /> Ask
                </TabsTrigger>
                <TabsTrigger value="workspace" className="flex-1 gap-1.5">
                  <ClipboardList className="size-3.5" /> Workflow
                </TabsTrigger>
                <TabsTrigger value="reference" className="flex-1 gap-1.5">
                  <FileText className="size-3.5" /> Reference
                </TabsTrigger>
              </TabsList>

              <TabsContent value="qa" className="space-y-4">
                {pinned.length > 0 && (
                  <div className="rounded-lg border bg-muted/30 p-2 text-xs space-y-1">
                    <p className="font-medium text-muted-foreground">Pinned context ({pinned.length})</p>
                    {pinned.map((i) => {
                      const r = ECS_COMPONENTS[i];
                      return (
                        <p key={i} className="text-muted-foreground">
                          <span className="text-foreground font-medium">{r.brand}</span> — {r.engineFamily} · {r.componentType}
                        </p>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs">
                  <input type="checkbox" id="full-wc" className="size-3.5" checked={includeFullWashcoat} onChange={(e) => setIncludeFullWashcoat(e.target.checked)} />
                  <Label htmlFor="full-wc" className="font-normal cursor-pointer">Include full washcoat tables</Label>
                </div>

                <Select value={answerFocus} onValueChange={(v) => setAnswerFocus(v as CopilotAnswerFocus)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="evidence">Evidence &amp; traceability</SelectItem>
                    <SelectItem value="dossier">Homologation memo</SelectItem>
                    <SelectItem value="pgm">PGM &amp; R103 / OBD</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex flex-wrap gap-1.5">
                  {COPILOT_QUICK_PROMPTS.map((p) => (
                    <Button key={p.label} type="button" variant="outline" size="sm"
                      className="h-auto text-xs py-1 px-2 whitespace-normal text-left"
                      onClick={() => setCopilotMessage(p.text)}>
                      {p.label}
                    </Button>
                  ))}
                </div>

                <textarea
                  className="flex min-h-[90px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2"
                  placeholder="e.g. What PGM range for AM TWC replacing EA211 Euro 6d?"
                  value={copilotMessage}
                  onChange={(e) => setCopilotMessage(e.target.value)}
                />

                <Button onClick={() => void runCopilot()} disabled={copilotLoading} className="w-full">
                  {copilotLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Send className="size-4 mr-2" />}
                  Ask copilot
                </Button>

                {copilotReply !== null && (
                  <div className="rounded-lg border bg-card p-4 text-sm max-h-[40vh] overflow-y-auto prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{copilotReply}</ReactMarkdown>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="workspace" className="space-y-4">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Homologation workflow</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/catsizer/depollution">OEM sizing</Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/compliance">Compliance hub</Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/aftermarket/lab-data">Lab Data upload</Link>
                      </Button>
                    </div>
                    <ol className="space-y-4 text-sm">
                      {HOMOLOGATION_WORKFLOW_STEPS.map((block) => (
                        <li key={block.phase}>
                          <p className="font-medium">{block.phase}</p>
                          <ul className="mt-1 list-disc pl-5 space-y-1 text-xs text-muted-foreground">
                            {block.items.map((item) => (
                              <li key={item}>{boldInline(item)}</li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reference" className="space-y-4">
                <Tabs defaultValue="am">
                  <TabsList className="flex w-full flex-wrap h-auto gap-1">
                    <TabsTrigger value="am">AM targets</TabsTrigger>
                    <TabsTrigger value="arch">Architecture</TabsTrigger>
                    <TabsTrigger value="washcoat">Washcoat</TabsTrigger>
                    <TabsTrigger value="ptpd">Pt–Pd</TabsTrigger>
                    <TabsTrigger value="trace">Traceability</TabsTrigger>
                  </TabsList>
                  <TabsContent value="am" className="mt-3">
                    <ReferenceTableCard title="AM design guidance" rows={AM_DESIGN_GUIDANCE as unknown as Record<string, unknown>[]} />
                  </TabsContent>
                  <TabsContent value="arch" className="mt-3">
                    <ReferenceTableCard title="System architecture" rows={SYSTEM_ARCHITECTURE as unknown as Record<string, unknown>[]} />
                  </TabsContent>
                  <TabsContent value="washcoat" className="mt-3">
                    <ReferenceTableCard title="Washcoat chemistry" rows={WASHCOAT_CHEMISTRY as unknown as Record<string, unknown>[]} />
                  </TabsContent>
                  <TabsContent value="ptpd" className="mt-3">
                    <ReferenceTableCard title="Pt–Pd substitution" rows={PT_PD_SUBSTITUTION as unknown as Record<string, unknown>[]} />
                  </TabsContent>
                  <TabsContent value="trace" className="mt-3">
                    <ReferenceTableCard title="Source traceability" rows={SOURCE_TRACEABILITY as unknown as Record<string, unknown>[]} />
                  </TabsContent>
                </Tabs>
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================

function DetailGrid({ record: r }: { record: EcsComponentRecord }) {
  const pairs: [string, string][] = [
    ["OEM group", formatCell(r.oemGroup)],
    ["Brand", formatCell(r.brand)],
    ["Engine family", formatCell(r.engineFamily)],
    ["Engine code(s)", formatCell(r.engineCodes)],
    ["Fuel", formatCell(r.fuel)],
    ["Displacement (L)", formatCell(r.displacementL)],
    ["Cylinders", formatCell(r.cylinders)],
    ["Power (kW)", formatCell(r.powerKw)],
    ["Emission standard", formatCell(r.emissionStandard)],
    ["Years", formatCell(r.years)],
    ["Vehicles", formatCell(r.vehicleExamples)],
    ["Production vol (EU)", formatCell(r.productionVolumeEu)],
    ["Component #", formatCell(r.componentNumber)],
    ["Component type", formatCell(r.componentType)],
    ["Position", formatCell(r.position)],
    ["Substrate", formatCell(r.substrate)],
    ["Substrate supplier", formatCell(r.substrateSupplier)],
    ["Ø × L (mm)", `${formatCell(r.diameterMm)} × ${formatCell(r.lengthMm)}`],
    ["Volume (L)", formatCell(r.volumeL)],
    ["CPSI / wall (mil)", `${formatCell(r.cpsi)} / ${formatCell(r.wallMil)}`],
    ["GSA (m²/L)", formatCell(r.geometricSaM2PerL)],
    ["OFA %", formatCell(r.ofaPercent)],
    ["WC layers / g/L", `${formatCell(r.wcLayers)} / ${formatCell(r.wcTotalGPerL)}`],
    ["L1 PGM", formatCell(r.l1Pgm)],
    ["L2 PGM", formatCell(r.l2Pgm)],
    ["Pt / Pd / Rh (g/L)", `${formatCell(r.ptGPerL)} / ${formatCell(r.pdGPerL)} / ${formatCell(r.rhGPerL)}`],
    ["Total PGM (g/L)", formatCell(r.totalPgmGPerL)],
    ["T50 CO / HC / NOx (°C)", `${formatCell(r.t50CoC)} / ${formatCell(r.t50HcC)} / ${formatCell(r.t50NoxC)}`],
    ["Aging protocol", formatCell(r.agingProtocol)],
    ["Confidence", formatCell(r.confidence)],
    ["Source", formatCell(r.source)],
  ];
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
      {pairs.map(([k, v]) => (
        <div key={k} className="space-y-0.5">
          <p className="text-xs text-muted-foreground">{k}</p>
          <p className="text-sm font-medium break-words">{v}</p>
        </div>
      ))}
    </div>
  );
}

function ReferenceTableCard({ title, rows }: { title: string; rows: Record<string, unknown>[] }) {
  const keys = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) Object.keys(r).forEach((k) => s.add(k));
    return [...s].slice(0, 10);
  }, [rows]);

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="max-h-[340px] overflow-auto rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                {keys.map((k) => <TableHead key={k} className="text-xs whitespace-nowrap">{k.replace(/_/g, " ")}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {keys.map((k) => (
                    <TableCell key={k} className="text-xs max-w-[160px] align-top">
                      <span className="line-clamp-2">{row[k] == null ? "—" : String(row[k])}</span>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
