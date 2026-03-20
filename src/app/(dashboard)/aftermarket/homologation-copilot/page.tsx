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
  Loader2,
  Search,
  Send,
  Database,
  FileText,
  Sparkles,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Copy,
  Wand2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Stepper } from "@/components/ui/stepper";
import { Progress } from "@/components/ui/progress";

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
  Step3Variants,
  Step4Chemistry,
  Step5Economics,
  Step6SpecCard,
} from "./wizard-steps";

const MAX_PINNED = 12;
const PAGE_SIZE = 50;

function formatCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return String(v);
}

/** Renders `**bold**` segments from static workflow copy (no HTML injection). */
function boldInline(text: string): ReactNode {
  const parts = text.split(/(\*\*.+?\*\*)/g);
  return parts.map((part, i) => {
    const m = /^\*\*(.+)\*\*$/.exec(part);
    if (m) return <strong key={i}>{m[1]}</strong>;
    return part;
  });
}

export default function HomologationCopilotPage() {
  const wiz = useWizard();

  const [search, setSearch] = useState("");
  const [fuel, setFuel] = useState<string>("all");
  const [emStd, setEmStd] = useState<string>("all");
  const [brand, setBrand] = useState<string>("all");
  const [pinned, setPinned] = useState<number[]>([]);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);

  const [copilotMessage, setCopilotMessage] = useState("");
  const [includeFullWashcoat, setIncludeFullWashcoat] = useState(false);
  const [answerFocus, setAnswerFocus] = useState<CopilotAnswerFocus>("balanced");
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotReply, setCopilotReply] = useState<string | null>(null);
  const [tablePage, setTablePage] = useState(0);

  const fuels = useMemo(() => uniqueFuels(), []);
  const brands = useMemo(() => uniqueBrands(), []);
  const standards = useMemo(() => uniqueEmissionStandards(), []);

  const filteredRows = useMemo(
    () =>
      filterEcsWithGlobalIndices({
        search,
        fuel,
        emissionStandard: emStd,
        brand,
      }),
    [search, fuel, emStd, brand],
  );

  useEffect(() => {
    setTablePage(0);
  }, [search, fuel, emStd, brand]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safeTablePage = Math.min(tablePage, pageCount - 1);
  const pageRows = useMemo(
    () =>
      filteredRows.slice(
        safeTablePage * PAGE_SIZE,
        (safeTablePage + 1) * PAGE_SIZE,
      ),
    [filteredRows, safeTablePage],
  );

  const togglePin = useCallback((globalIndex: number) => {
    setPinned((prev) => {
      if (prev.includes(globalIndex)) {
        return prev.filter((i) => i !== globalIndex);
      }
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
    if (!msg) {
      toast.error("Enter a question for the copilot");
      return;
    }
    setCopilotLoading(true);
    setCopilotReply(null);
    try {
      const res = await fetch("/api/am-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          selectedIndices: pinned,
          includeFullWashcoat: includeFullWashcoat,
          answerFocus,
        }),
      });
      const data = (await res.json()) as { content?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? res.statusText);
      }
      setCopilotReply(data.content ?? "");
    } catch (e) {
      const m = e instanceof Error ? e.message : "Request failed";
      toast.error(m);
    } finally {
      setCopilotLoading(false);
    }
  }, [copilotMessage, pinned, includeFullWashcoat, answerFocus]);

  const copyPinnedSummary = useCallback(async () => {
    if (pinned.length === 0) {
      toast.message("Pin at least one ECS row to copy a summary");
      return;
    }
    const lines: string[] = [
      `Bosal AM — OEM reference pins (${OEM_DB_MANIFEST.databaseVersion})`,
      `Source: ${OEM_DB_MANIFEST.sourceFile}`,
      "",
    ];
    for (const i of pinned) {
      const r = ECS_COMPONENTS[i];
      lines.push(
        `## ${r.brand} — ${r.engineFamily} (${r.engineCodes})`,
        `- Emission: ${r.emissionStandard} · ${r.years} · ${r.vehicleExamples}`,
        `- Component: ${r.componentType} @ ${r.position} (Comp# ${r.componentNumber})`,
        `- Substrate: ${r.substrate} Ø${r.diameterMm}×L${r.lengthMm} mm · ${r.cpsi} CPSI`,
        `- PGM g/L: Pt ${r.ptGPerL} · Pd ${r.pdGPerL} · Rh ${r.rhGPerL} (total ${r.totalPgmGPerL})`,
        `- Confidence / source: ${r.confidence} — ${r.source}`,
        "",
      );
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Pinned summary copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }, [pinned]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              AM Homologation Copilot
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl mt-1">
              OEM Catalyst Database {OEM_DB_MANIFEST.databaseVersion} — browse reference
              catalyst data, source traceability tiers, and AM design targets. Pin ECS rows
              and ask the copilot for homologation-oriented guidance (requires{" "}
              <code className="text-xs bg-muted px-1 rounded">OPENAI_API_KEY</code> on the
              server).
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant="outline">
                {OEM_DB_MANIFEST.counts.ecsComponents} ECS components
              </Badge>
              {OEM_DB_MANIFEST.counts.sourceTraceability != null && (
                <Badge variant="outline">
                  {OEM_DB_MANIFEST.counts.sourceTraceability} traceability tiers
                </Badge>
              )}
              <Badge variant="secondary">{OEM_DB_MANIFEST.sourceFile}</Badge>
            </div>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href="/catsizer/depollution">Open OEM sizing calculator</Link>
        </Button>
      </div>

      <Tabs defaultValue="wizard" className="space-y-4">
        <TabsList className="flex w-full flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="wizard" className="gap-1.5">
            <Wand2 className="size-3.5" />
            Product wizard
          </TabsTrigger>
          <TabsTrigger value="ecs" className="gap-1.5">
            <Database className="size-3.5" />
            ECS database
          </TabsTrigger>
          <TabsTrigger value="workspace" className="gap-1.5">
            <ClipboardList className="size-3.5" />
            Workspace
          </TabsTrigger>
          <TabsTrigger value="reference" className="gap-1.5">
            <FileText className="size-3.5" />
            Guidance &amp; maps
          </TabsTrigger>
          <TabsTrigger value="copilot" className="gap-1.5">
            <Sparkles className="size-3.5" />
            Free Q&amp;A
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wizard" className="space-y-4">
          <Progress value={((wiz.step + 1) / WIZARD_STEPS.length) * 100} className="mb-2" />
          <Stepper
            steps={WIZARD_STEPS.map((s) => ({ label: s.label, description: s.description }))}
            currentStep={wiz.step}
            className="mb-4"
          />
          {wiz.step === 0 && <Step1VehicleScope wiz={wiz} />}
          {wiz.step === 1 && <Step2OemReference wiz={wiz} />}
          {wiz.step === 2 && <Step3Variants wiz={wiz} />}
          {wiz.step === 3 && <Step4Chemistry wiz={wiz} />}
          {wiz.step === 4 && <Step5Economics wiz={wiz} />}
          {wiz.step === 5 && <Step6SpecCard wiz={wiz} />}
        </TabsContent>

        <TabsContent value="ecs" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filter &amp; search</CardTitle>
              <CardDescription>
                Pin up to {MAX_PINNED} rows — they are sent as primary evidence to the AI
                copilot.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs text-muted-foreground">Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Engine, brand, vehicle, PGM, standard…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="w-full md:w-[140px]">
                <Label className="text-xs text-muted-foreground">Fuel</Label>
                <Select value={fuel} onValueChange={setFuel}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {fuels.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:w-[160px]">
                <Label className="text-xs text-muted-foreground">Emission std</Label>
                <Select value={emStd} onValueChange={setEmStd}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {standards.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:w-[160px]">
                <Label className="text-xs text-muted-foreground">Brand</Label>
                <Select value={brand} onValueChange={setBrand}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {brands.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void copyPinnedSummary()}
                  disabled={pinned.length === 0}
                  className="gap-1.5"
                >
                  <Copy className="size-3.5" />
                  Copy pinned summary
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPinned([])}
                  disabled={pinned.length === 0}
                >
                  Clear pins ({pinned.length})
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="max-h-[min(520px,55vh)] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Brand</TableHead>
                      <TableHead>Engine</TableHead>
                      <TableHead>Std</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">PGM g/L</TableHead>
                      <TableHead className="text-right">CPSI</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No rows match filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pageRows.map(({ record: rec, globalIndex: gi }) => {
                        const isPinned = pinned.includes(gi);
                        return (
                          <TableRow
                            key={`${gi}-${rec.engineCodes}-${rec.componentNumber}`}
                            className={isPinned ? "bg-primary/5" : undefined}
                          >
                            <TableCell>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                aria-label={isPinned ? "Unpin row" : "Pin row for copilot"}
                                onClick={() => togglePin(gi)}
                              >
                                {isPinned ? (
                                  <BookmarkCheck className="size-4 text-primary" />
                                ) : (
                                  <Bookmark className="size-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell
                              className="font-medium cursor-pointer"
                              onClick={() => setDetailIndex(gi)}
                            >
                              {formatCell(rec.brand)}
                            </TableCell>
                            <TableCell
                              className="max-w-[200px] truncate cursor-pointer"
                              title={formatCell(rec.engineFamily)}
                              onClick={() => setDetailIndex(gi)}
                            >
                              {formatCell(rec.engineFamily)}
                            </TableCell>
                            <TableCell onClick={() => setDetailIndex(gi)}>
                              {formatCell(rec.emissionStandard)}
                            </TableCell>
                            <TableCell
                              className="max-w-[120px] truncate"
                              title={formatCell(rec.componentType)}
                              onClick={() => setDetailIndex(gi)}
                            >
                              {formatCell(rec.componentType)}
                            </TableCell>
                            <TableCell
                              className="text-right font-mono text-xs"
                              onClick={() => setDetailIndex(gi)}
                            >
                              {formatCell(rec.totalPgmGPerL)}
                            </TableCell>
                            <TableCell
                              className="text-right font-mono text-xs"
                              onClick={() => setDetailIndex(gi)}
                            >
                              {formatCell(rec.cpsi)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-2 border-t p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Page {safeTablePage + 1} of {pageCount} · Showing{" "}
                  {filteredRows.length === 0
                    ? 0
                    : safeTablePage * PAGE_SIZE + 1}
                  –
                  {Math.min((safeTablePage + 1) * PAGE_SIZE, filteredRows.length)} of{" "}
                  {filteredRows.length} filtered ({ECS_COMPONENTS.length} total). Click a
                  row (except pin) for full detail.
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={safeTablePage <= 0}
                    onClick={() => setTablePage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="size-4" />
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={safeTablePage >= pageCount - 1}
                    onClick={() => setTablePage((p) => Math.min(pageCount - 1, p + 1))}
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workspace" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Homologation workspace</CardTitle>
              <CardDescription>
                Process orientation for Bosal AM — not a legal checklist. Pair with pinned
                ECS rows and the AI copilot for vehicle-specific work.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/catsizer/depollution">OEM sizing (depollution)</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/aftermarket/wltp">WLTP simulation</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/compliance">Compliance hub</Link>
                </Button>
              </div>
              <ol className="space-y-5 text-sm">
                {HOMOLOGATION_WORKFLOW_STEPS.map((block) => (
                  <li key={block.phase}>
                    <p className="font-medium text-foreground">{block.phase}</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                      {block.items.map((item) => (
                        <li
                          key={item}
                          className="[&_strong]:font-semibold [&_strong]:text-foreground"
                        >
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

        <TabsContent value="reference" className="space-y-4">
          <Tabs defaultValue="am">
            <TabsList className="flex w-full flex-wrap h-auto gap-1">
              <TabsTrigger value="am">AM targets</TabsTrigger>
              <TabsTrigger value="arch">Architecture</TabsTrigger>
              <TabsTrigger value="washcoat">Washcoat</TabsTrigger>
              <TabsTrigger value="ptpd">Pt–Pd</TabsTrigger>
              <TabsTrigger value="trace">Traceability</TabsTrigger>
            </TabsList>
            <TabsContent value="am" className="mt-4">
              <ReferenceTableCard
                title="AM design guidance"
                description="Fresh AM vs OEM aged — ECE R103 / OBD alignment"
                rows={AM_DESIGN_GUIDANCE as unknown as Record<string, unknown>[]}
              />
            </TabsContent>
            <TabsContent value="arch" className="mt-4">
              <ReferenceTableCard
                title="System architecture map"
                description="Which bricks to replace as AM, by archetype"
                rows={SYSTEM_ARCHITECTURE as unknown as Record<string, unknown>[]}
              />
            </TabsContent>
            <TabsContent value="washcoat" className="mt-4">
              <ReferenceTableCard
                title="Washcoat chemistry detail"
                description="Layer formulations by OEM archetype / era"
                rows={WASHCOAT_CHEMISTRY as unknown as Record<string, unknown>[]}
              />
            </TabsContent>
            <TabsContent value="ptpd" className="mt-4">
              <ReferenceTableCard
                title="Pt–Pd substitution"
                description="Timeline and AM impact"
                rows={PT_PD_SUBSTITUTION as unknown as Record<string, unknown>[]}
              />
            </TabsContent>
            <TabsContent value="trace" className="mt-4">
              <ReferenceTableCard
                title="Source traceability"
                description="Data tiers, confidence, and recommended Bosal actions"
                rows={SOURCE_TRACEABILITY as unknown as Record<string, unknown>[]}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="copilot" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="size-4" />
                Homologation copilot
              </CardTitle>
              <CardDescription>
                Uses Database {OEM_DB_MANIFEST.databaseVersion} context: pinned ECS rows
                (if any), AM guidance, architecture map, source traceability, and optionally
                full washcoat + Pt–Pd tables.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-medium text-foreground mb-2">
                  Pinned reference ({pinned.length}/{MAX_PINNED})
                </p>
                {pinned.length === 0 ? (
                  <p className="text-muted-foreground">
                    No rows pinned — the copilot still receives AM guidance, architecture,
                    and traceability tiers. Pin ECS rows from the first tab for
                    vehicle-specific answers.
                  </p>
                ) : (
                  <ul className="space-y-1 text-muted-foreground">
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
                <input
                  type="checkbox"
                  id="full-wc"
                  className="size-4 rounded border-input"
                  checked={includeFullWashcoat}
                  onChange={(e) => setIncludeFullWashcoat(e.target.checked)}
                />
                <Label htmlFor="full-wc" className="text-sm font-normal cursor-pointer">
                  Include full washcoat + Pt–Pd tables in context (larger prompt, more
                  detail)
                </Label>
              </div>

              <div className="grid gap-2 sm:max-w-xs">
                <Label className="text-xs text-muted-foreground">Answer focus</Label>
                <Select
                  value={answerFocus}
                  onValueChange={(v) => setAnswerFocus(v as CopilotAnswerFocus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="evidence">Evidence &amp; traceability</SelectItem>
                    <SelectItem value="dossier">Homologation memo style</SelectItem>
                    <SelectItem value="pgm">PGM &amp; R103 / OBD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Suggested questions
                </p>
                <div className="flex flex-wrap gap-2">
                  {COPILOT_QUICK_PROMPTS.map((p) => (
                    <Button
                      key={p.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto min-h-8 whitespace-normal text-left text-xs py-1.5"
                      onClick={() => setCopilotMessage(p.text)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="copilot-q">Question</Label>
                <textarea
                  id="copilot-q"
                  className="mt-1.5 flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  placeholder="e.g. What PGM range should we target for an AM TWC replacing an E6d-T EA211 application, and which source tier should we cite for total grams vs g/L?"
                  value={copilotMessage}
                  onChange={(e) => setCopilotMessage(e.target.value)}
                />
              </div>

              <Button onClick={() => void runCopilot()} disabled={copilotLoading}>
                {copilotLoading ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : (
                  <Send className="size-4 mr-2" />
                )}
                Ask copilot
              </Button>

              {copilotReply !== null && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-2">Response</p>
                    <div className="rounded-lg border bg-card p-4 text-sm max-h-[min(480px,50vh)] overflow-y-auto prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_th]:px-2 [&_td]:px-2">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{copilotReply}</ReactMarkdown>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet open={detailIndex !== null} onOpenChange={(o) => !o && setDetailIndex(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>ECS component detail</SheetTitle>
            <SheetDescription>
              {detailRecord
                ? `${detailRecord.brand} — ${detailRecord.engineFamily}`
                : ""}
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
    </div>
  );
}

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
    for (const r of rows) {
      Object.keys(r).forEach((k) => s.add(k));
    }
    return [...s];
  }, [rows]);

  const displayKeys = keys.slice(0, 12);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-[min(480px,50vh)] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {displayKeys.map((k) => (
                  <TableHead key={k} className="whitespace-nowrap text-xs max-w-[140px]">
                    {k.replace(/_/g, " ")}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {displayKeys.map((k) => (
                    <TableCell key={k} className="text-xs max-w-[200px] align-top">
                      <span className="line-clamp-4">
                        {row[k] === null || row[k] === undefined
                          ? "—"
                          : String(row[k])}
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
            Showing first 12 columns of {keys.length}. Full data is included in copilot
            context where configured.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
