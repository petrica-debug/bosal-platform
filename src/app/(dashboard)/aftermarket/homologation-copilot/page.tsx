"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import {
  BookOpen,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Database,
  FileText,
  Loader2,
  Search,
  Send,
  Sparkles,
  ClipboardList,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
const PAGE_SIZE = 50;

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

/* ------------------------------------------------------------------ */
/*  Pipeline navigation bar                                            */
/* ------------------------------------------------------------------ */

function PipelineNav({
  steps,
  currentStep,
  onStepClick,
  completedSteps,
}: {
  steps: readonly { label: string; description: string }[];
  currentStep: number;
  onStepClick: (i: number) => void;
  completedSteps: number[];
}) {
  return (
    <nav aria-label="Product development pipeline" className="w-full">
      <ol className="flex flex-wrap gap-1">
        {steps.map((s, i) => {
          const isActive = i === currentStep;
          const isDone = completedSteps.includes(i);
          return (
            <li key={i} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onStepClick(i)}
                className={[
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : isDone
                      ? "bg-primary/10 text-primary hover:bg-primary/15"
                      : "text-muted-foreground hover:bg-muted/60",
                ].join(" ")}
              >
                {isDone ? (
                  <CheckCircle2 className="size-4 shrink-0" />
                ) : (
                  <Circle className="size-4 shrink-0" />
                )}
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden font-mono text-xs">{i + 1}</span>
              </button>
              {i < steps.length - 1 && (
                <ChevronRight className="size-3 text-muted-foreground shrink-0" />
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground mt-1 pl-1">
        {WIZARD_STEPS[currentStep]?.description ?? ""}
      </p>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Completion strip                                                   */
/* ------------------------------------------------------------------ */

function CompletionStrip({ wiz }: { wiz: ReturnType<typeof useWizard> }) {
  const tokens: { label: string; value: string; color?: string }[] = [];

  if (wiz.vehicleScope.engineSearch) {
    tokens.push({ label: "Engine", value: wiz.vehicleScope.engineSearch });
  }
  if (wiz.vehicleScope.targetMarket !== "EU-West") {
    tokens.push({ label: "Market", value: wiz.vehicleScope.targetMarket });
  }
  if (wiz.oemRef.pinnedIndices.length > 0) {
    tokens.push({ label: "OEM refs", value: String(wiz.oemRef.pinnedIndices.length) });
  }
  if (wiz.variants.selectedTier) {
    tokens.push({ label: "Variant", value: wiz.variants.selectedTier });
    const sel = wiz.variants.variants.find((v) => v.tier === wiz.variants.selectedTier);
    if (sel) {
      tokens.push({ label: "PGM", value: `${sel.pgm.totalGPerFt3.toFixed(0)} g/ft³` });
    }
  }
  if (wiz.wltpSim.result) {
    const v = wiz.wltpSim.result.overallVerdict;
    tokens.push({
      label: "WLTP",
      value: v === "green" ? "PASS" : v === "amber" ? "MARGINAL" : "FAIL",
      color: v === "green" ? "text-green-600 dark:text-green-400" : v === "amber" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400",
    });
  }
  const selectedVariant = wiz.variants.variants.find((v) => v.tier === wiz.variants.selectedTier);
  const selectedCost = selectedVariant ? wiz.economics.variantCosts[selectedVariant.tier] : null;
  if (selectedCost) {
    tokens.push({ label: "BOM", value: `€${selectedCost.totalBom.toFixed(2)}` });
  }

  if (tokens.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
      {tokens.map((t, i) => (
        <span key={i} className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">{t.label}:</span>
          <span className={`font-medium ${t.color ?? ""}`}>{t.value}</span>
          {i < tokens.length - 1 && <span className="text-muted-foreground">·</span>}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function HomologationCopilotPage() {
  const wiz = useWizard();

  // ECS database drawer state
  const [dbOpen, setDbOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [fuel, setFuel] = useState<string>("all");
  const [emStd, setEmStd] = useState<string>("all");
  const [brand, setBrand] = useState<string>("all");
  const [pinned, setPinned] = useState<number[]>([]);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [tablePage, setTablePage] = useState(0);

  // AI Copilot drawer state
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotMessage, setCopilotMessage] = useState("");
  const [includeFullWashcoat, setIncludeFullWashcoat] = useState(false);
  const [answerFocus, setAnswerFocus] = useState<CopilotAnswerFocus>("balanced");
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotReply, setCopilotReply] = useState<string | null>(null);

  const fuels = useMemo(() => uniqueFuels(), []);
  const brands = useMemo(() => uniqueBrands(), []);
  const standards = useMemo(() => uniqueEmissionStandards(), []);

  const filteredRows = useMemo(
    () => filterEcsWithGlobalIndices({ search, fuel, emissionStandard: emStd, brand }),
    [search, fuel, emStd, brand],
  );

  useEffect(() => { setTablePage(0); }, [search, fuel, emStd, brand]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safeTablePage = Math.min(tablePage, pageCount - 1);
  const pageRows = useMemo(
    () => filteredRows.slice(safeTablePage * PAGE_SIZE, (safeTablePage + 1) * PAGE_SIZE),
    [filteredRows, safeTablePage],
  );

  const togglePin = useCallback((globalIndex: number) => {
    setPinned((prev) => {
      if (prev.includes(globalIndex)) return prev.filter((i) => i !== globalIndex);
      if (prev.length >= MAX_PINNED) {
        toast.message(`Maximum ${MAX_PINNED} reference rows for copilot context`);
        return prev;
      }
      return [...prev, globalIndex];
    });
  }, []);

  const detailRecord =
    detailIndex !== null && detailIndex >= 0 && detailIndex < ECS_COMPONENTS.length
      ? ECS_COMPONENTS[detailIndex]
      : null;

  const runCopilot = useCallback(async () => {
    const msg = copilotMessage.trim();
    if (!msg) { toast.error("Enter a question for the copilot"); return; }
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
    if (pinned.length === 0) { toast.message("Pin at least one ECS row"); return; }
    const lines: string[] = [
      `Bosal AM — OEM reference pins (${OEM_DB_MANIFEST.databaseVersion})`,
      `Source: ${OEM_DB_MANIFEST.sourceFile}`, "",
    ];
    for (const i of pinned) {
      const r = ECS_COMPONENTS[i];
      lines.push(
        `## ${r.brand} — ${r.engineFamily} (${r.engineCodes})`,
        `- Emission: ${r.emissionStandard} · ${r.years} · ${r.vehicleExamples}`,
        `- Component: ${r.componentType} @ ${r.position} (Comp# ${r.componentNumber})`,
        `- Substrate: ${r.substrate} Ø${r.diameterMm}×L${r.lengthMm} mm · ${r.cpsi} CPSI`,
        `- PGM g/L: Pt ${r.ptGPerL} · Pd ${r.pdGPerL} · Rh ${r.rhGPerL} (total ${r.totalPgmGPerL})`,
        `- Confidence / source: ${r.confidence} — ${r.source}`, "",
      );
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Pinned summary copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }, [pinned]);

  // Which steps are considered "completed" for the pipeline nav indicator
  const completedSteps = useMemo(() => {
    const done: number[] = [];
    if (wiz.vehicleScope.engineSearch || wiz.vehicleScope.brand !== "all") done.push(0);
    if (wiz.oemRef.pinnedIndices.length > 0) done.push(1);
    if (wiz.systemDesign.result) done.push(2);
    if (wiz.variants.selectedTier) done.push(3);
    if (wiz.wltpSim.result) done.push(4);
    const hasCosts = Object.keys(wiz.economics.variantCosts).length > 0;
    if (hasCosts) done.push(5);
    if (wiz.specCardData.testPlan) done.push(6);
    return done;
  }, [wiz.vehicleScope, wiz.oemRef.pinnedIndices, wiz.systemDesign.result, wiz.variants.selectedTier, wiz.wltpSim.result, wiz.economics.variantCosts, wiz.specCardData.testPlan]);

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">AM Product Development</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {OEM_DB_MANIFEST.databaseVersion} · {OEM_DB_MANIFEST.counts.ecsComponents} ECS components · From engine to R103 package in 7 steps
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setDbOpen(true)}
          >
            <Database className="size-3.5" />
            OEM Database
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setCopilotOpen(true)}
          >
            <Sparkles className="size-3.5" />
            AI Copilot
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground gap-1.5"
            onClick={wiz.resetWizard}
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Pipeline navigation */}
      <PipelineNav
        steps={WIZARD_STEPS}
        currentStep={wiz.step}
        onStepClick={wiz.goTo}
        completedSteps={completedSteps}
      />

      {/* Completion strip */}
      <CompletionStrip wiz={wiz} />

      {/* Current step content */}
      <div>
        {wiz.step === 0 && <Step1VehicleScope wiz={wiz} />}
        {wiz.step === 1 && <Step2OemReference wiz={wiz} />}
        {wiz.step === 2 && <Step3SystemDesign wiz={wiz} />}
        {wiz.step === 3 && <Step4CatalystDesign wiz={wiz} />}
        {wiz.step === 4 && <Step5PerformanceTest wiz={wiz} />}
        {wiz.step === 5 && <Step6BusinessCase wiz={wiz} />}
        {wiz.step === 6 && <Step7R103Package wiz={wiz} />}
      </div>

      {/* ── OEM Database drawer ── */}
      <Sheet open={dbOpen} onOpenChange={setDbOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" side="right">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Database className="size-4" />
              OEM Catalyst Database
            </SheetTitle>
            <SheetDescription>
              {OEM_DB_MANIFEST.databaseVersion} — {OEM_DB_MANIFEST.counts.ecsComponents} ECS components.
              Pin up to {MAX_PINNED} rows to include as context in AI Copilot answers.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
              <div className="flex-1 min-w-[180px]">
                <Label className="text-xs text-muted-foreground">Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Engine, brand, vehicle…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="w-full md:w-[120px]">
                <Label className="text-xs text-muted-foreground">Fuel</Label>
                <Select value={fuel} onValueChange={setFuel}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {fuels.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:w-[140px]">
                <Label className="text-xs text-muted-foreground">Standard</Label>
                <Select value={emStd} onValueChange={setEmStd}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {standards.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:w-[140px]">
                <Label className="text-xs text-muted-foreground">Brand</Label>
                <Select value={brand} onValueChange={setBrand}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void copyPinnedSummary()} disabled={pinned.length === 0} className="gap-1.5">
                  <Copy className="size-3.5" />
                  Copy ({pinned.length})
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setPinned([])} disabled={pinned.length === 0}>
                  Clear
                </Button>
              </div>
            </div>

            <div className="max-h-[55vh] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Brand</TableHead>
                    <TableHead>Engine</TableHead>
                    <TableHead>Std</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">PGM g/L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No rows match filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map(({ record: rec, globalIndex: gi }) => {
                      const isPinned = pinned.includes(gi);
                      return (
                        <TableRow key={`${gi}-${rec.engineCodes}-${rec.componentNumber}`} className={isPinned ? "bg-primary/5" : undefined}>
                          <TableCell>
                            <Button type="button" size="icon" variant="ghost" className="size-8" onClick={() => togglePin(gi)}>
                              {isPinned ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4" />}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium cursor-pointer" onClick={() => setDetailIndex(gi)}>{formatCell(rec.brand)}</TableCell>
                          <TableCell className="max-w-[180px] truncate cursor-pointer" title={formatCell(rec.engineFamily)} onClick={() => setDetailIndex(gi)}>{formatCell(rec.engineFamily)}</TableCell>
                          <TableCell onClick={() => setDetailIndex(gi)}>{formatCell(rec.emissionStandard)}</TableCell>
                          <TableCell className="max-w-[100px] truncate" onClick={() => setDetailIndex(gi)}>{formatCell(rec.componentType)}</TableCell>
                          <TableCell className="text-right font-mono text-xs" onClick={() => setDetailIndex(gi)}>{formatCell(rec.totalPgmGPerL)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {filteredRows.length === 0 ? 0 : safeTablePage * PAGE_SIZE + 1}–
                {Math.min((safeTablePage + 1) * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={safeTablePage <= 0} onClick={() => setTablePage((p) => Math.max(0, p - 1))} className="gap-1">
                  <ChevronLeft className="size-4" /> Prev
                </Button>
                <Button variant="outline" size="sm" disabled={safeTablePage >= pageCount - 1} onClick={() => setTablePage((p) => Math.min(pageCount - 1, p + 1))} className="gap-1">
                  Next <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── ECS component detail ── */}
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
                {pinned.includes(detailIndex!) ? "Remove from copilot context" : "Pin for copilot context"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── AI Copilot drawer ── */}
      <Sheet open={copilotOpen} onOpenChange={setCopilotOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto" side="right">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="size-4" />
              AI Copilot
            </SheetTitle>
            <SheetDescription>
              {OEM_DB_MANIFEST.databaseVersion} · Pinned: {pinned.length}/{MAX_PINNED}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4">
            <Tabs defaultValue="qa" className="space-y-4">
              <TabsList className="w-full flex-wrap h-auto">
                <TabsTrigger value="qa" className="flex-1 gap-1.5">
                  <Sparkles className="size-3.5" />
                  Ask
                </TabsTrigger>
                <TabsTrigger value="workspace" className="flex-1 gap-1.5">
                  <ClipboardList className="size-3.5" />
                  Workflow
                </TabsTrigger>
                <TabsTrigger value="reference" className="flex-1 gap-1.5">
                  <FileText className="size-3.5" />
                  Reference
                </TabsTrigger>
              </TabsList>

              {/* Free Q&A */}
              <TabsContent value="qa" className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="font-medium text-foreground mb-1 text-xs">
                    Pinned reference ({pinned.length}/{MAX_PINNED})
                  </p>
                  {pinned.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No rows pinned. Open OEM Database and pin rows for vehicle-specific answers.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {pinned.map((i) => {
                        const r = ECS_COMPONENTS[i];
                        return (
                          <li key={i}>
                            <span className="text-foreground font-medium">{r.brand}</span> —{" "}
                            {r.engineFamily} ({r.engineCodes}) · {r.componentType}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input type="checkbox" id="full-wc" className="size-4 rounded border-input" checked={includeFullWashcoat} onChange={(e) => setIncludeFullWashcoat(e.target.checked)} />
                  <Label htmlFor="full-wc" className="text-xs font-normal cursor-pointer">Include full washcoat + Pt–Pd tables</Label>
                </div>

                <div className="grid gap-2 sm:max-w-xs">
                  <Label className="text-xs text-muted-foreground">Answer focus</Label>
                  <Select value={answerFocus} onValueChange={(v) => setAnswerFocus(v as CopilotAnswerFocus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="evidence">Evidence &amp; traceability</SelectItem>
                      <SelectItem value="dossier">Homologation memo</SelectItem>
                      <SelectItem value="pgm">PGM &amp; R103 / OBD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Suggested questions</p>
                  <div className="flex flex-wrap gap-2">
                    {COPILOT_QUICK_PROMPTS.map((p) => (
                      <Button key={p.label} type="button" variant="outline" size="sm"
                        className="h-auto min-h-8 whitespace-normal text-left text-xs py-1.5"
                        onClick={() => setCopilotMessage(p.text)}>
                        {p.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="copilot-q">Question</Label>
                  <textarea
                    id="copilot-q"
                    className="mt-1.5 flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    placeholder="e.g. What PGM range for AM TWC replacing EA211 Euro 6d?"
                    value={copilotMessage}
                    onChange={(e) => setCopilotMessage(e.target.value)}
                  />
                </div>

                <Button onClick={() => void runCopilot()} disabled={copilotLoading}>
                  {copilotLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Send className="size-4 mr-2" />}
                  Ask copilot
                </Button>

                {copilotReply !== null && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium mb-2">Response</p>
                      <div className="rounded-lg border bg-card p-4 text-sm max-h-[45vh] overflow-y-auto prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_th]:px-2 [&_td]:px-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{copilotReply}</ReactMarkdown>
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>

              {/* Workflow */}
              <TabsContent value="workspace" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Homologation workflow</CardTitle>
                    <CardDescription>Process orientation for Bosal AM — not a legal checklist.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/catsizer/depollution">OEM sizing (depollution)</Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/compliance">Compliance hub</Link>
                      </Button>
                    </div>
                    <ol className="space-y-4 text-sm">
                      {HOMOLOGATION_WORKFLOW_STEPS.map((block) => (
                        <li key={block.phase}>
                          <p className="font-medium text-foreground">{block.phase}</p>
                          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted-foreground text-xs">
                            {block.items.map((item) => (
                              <li key={item} className="[&_strong]:font-semibold [&_strong]:text-foreground">
                                {boldInline(item)}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Reference tables */}
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
                    <ReferenceTableCard title="AM design guidance" description="Fresh AM vs OEM aged — ECE R103 / OBD alignment" rows={AM_DESIGN_GUIDANCE as unknown as Record<string, unknown>[]} />
                  </TabsContent>
                  <TabsContent value="arch" className="mt-3">
                    <ReferenceTableCard title="System architecture map" description="Which bricks to replace as AM, by archetype" rows={SYSTEM_ARCHITECTURE as unknown as Record<string, unknown>[]} />
                  </TabsContent>
                  <TabsContent value="washcoat" className="mt-3">
                    <ReferenceTableCard title="Washcoat chemistry detail" description="Layer formulations by OEM archetype / era" rows={WASHCOAT_CHEMISTRY as unknown as Record<string, unknown>[]} />
                  </TabsContent>
                  <TabsContent value="ptpd" className="mt-3">
                    <ReferenceTableCard title="Pt–Pd substitution" description="Timeline and AM impact" rows={PT_PD_SUBSTITUTION as unknown as Record<string, unknown>[]} />
                  </TabsContent>
                  <TabsContent value="trace" className="mt-3">
                    <ReferenceTableCard title="Source traceability" description="Data tiers, confidence, and recommended Bosal actions" rows={SOURCE_TRACEABILITY as unknown as Record<string, unknown>[]} />
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

/* ------------------------------------------------------------------ */
/*  Helper components                                                  */
/* ------------------------------------------------------------------ */

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
    ["Prod. vol (EU)", formatCell(r.productionVolumeEu)],
    ["Component #", formatCell(r.componentNumber)],
    ["Component type", formatCell(r.componentType)],
    ["Position", formatCell(r.position)],
    ["Substrate", formatCell(r.substrate)],
    ["Substrate supplier", formatCell(r.substrateSupplier)],
    ["Ø × L (mm)", `${formatCell(r.diameterMm)} × ${formatCell(r.lengthMm)}`],
    ["Volume (L)", formatCell(r.volumeL)],
    ["CPSI / wall (mil)", `${formatCell(r.cpsi)} / ${formatCell(r.wallMil)}`],
    ["Geom SA (m²/L)", formatCell(r.geometricSaM2PerL)],
    ["OFA %", formatCell(r.ofaPercent)],
    ["WC layers / total g/L", `${formatCell(r.wcLayers)} / ${formatCell(r.wcTotalGPerL)}`],
    ["L1 PGM", formatCell(r.l1Pgm)],
    ["L2 PGM", formatCell(r.l2Pgm)],
    ["Pt / Pd / Rh (g/L)", `${formatCell(r.ptGPerL)} / ${formatCell(r.pdGPerL)} / ${formatCell(r.rhGPerL)}`],
    ["Total PGM (g/L)", formatCell(r.totalPgmGPerL)],
    ["T50 CO / HC / NOx (°C)", `${formatCell(r.t50CoC)} / ${formatCell(r.t50HcC)} / ${formatCell(r.t50NoxC)}`],
    ["Aging protocol", formatCell(r.agingProtocol)],
    ["Confidence", formatCell(r.confidence)],
    ["Source", formatCell(r.source)],
    ["Sheet section", formatCell(r.sheetSection)],
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

function ReferenceTableCard({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: Record<string, unknown>[];
}) {
  const keys = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) Object.keys(r).forEach((k) => s.add(k));
    return [...s];
  }, [rows]);

  const displayKeys = keys.slice(0, 12);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-[min(400px,45vh)] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {displayKeys.map((k) => (
                  <TableHead key={k} className="whitespace-nowrap text-xs max-w-[120px]">
                    {k.replace(/_/g, " ")}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {displayKeys.map((k) => (
                    <TableCell key={k} className="text-xs max-w-[180px] align-top">
                      <span className="line-clamp-3">
                        {row[k] === null || row[k] === undefined ? "—" : String(row[k])}
                      </span>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {keys.length > 12 && (
          <p className="text-xs text-muted-foreground mt-2">
            Showing first 12 of {keys.length} columns.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
