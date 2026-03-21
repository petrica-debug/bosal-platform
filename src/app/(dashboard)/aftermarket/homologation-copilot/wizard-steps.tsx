"use client";

import { useCallback, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  ClipboardCopy,
  Download,
  Loader2,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

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
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  OEM_DB_MANIFEST,
  uniqueBrands,
  uniqueEmissionStandards,
} from "@/lib/catsizer/oem-database";
import type { EcsFilteredRow } from "@/lib/catsizer/oem-database/search";
import type { SystemArchitecture } from "@/lib/catsizer/system-design";

import type { useWizard } from "./use-wizard";
import type {
  AmVariant,
  ComponentScope,
  CostBreakdown,
  MarketEstimate,
  PgmPrices,
  TargetMarket,
  VariantTier,
  VehicleScopeInput,
} from "./wizard-types";
import { AgingCurvesChart, ObdSignalChart, VariantRadarChart, CostBarChart, LightOffCurveChart, T50ComparisonChart, SpaceVelocityChart } from "./wizard-charts";
import { computeSpaceVelocityEffect } from "@/lib/catsizer/catalyst-chemistry";
import {
  useSharedCatalyst,
  oscRetentionToAgingFactor,
  type SharedCatalystDesign,
} from "@/lib/catsizer/shared-catalyst-context";
import { Share2, Play } from "lucide-react";
import {
  LIGHT_DUTY_PRESETS,
  WLTP_EMISSION_LIMITS,
  type WLTPEmissionStandard,
} from "@/lib/catsizer/wltp-transient-engine";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type Wiz = ReturnType<typeof useWizard>;

function fmt(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return String(v);
}

function eur(v: number): string {
  return `€${v.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PROSE_CLASSES =
  "prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_th]:px-2 [&_td]:px-2";

const SYSTEM_ARCHITECTURES: { value: SystemArchitecture; label: string }[] = [
  { value: "CC-TWC-only", label: "CC-TWC only (single brick)" },
  { value: "CC-TWC+GPF", label: "CC-TWC + GPF (Euro 6d+)" },
  { value: "CC-TWC+UF-TWC", label: "CC-TWC + UF-TWC (HEV)" },
  { value: "DOC+SDPF+SCR", label: "DOC + SDPF + SCR (diesel)" },
  { value: "DOC+DPF+SCR", label: "DOC + DPF + SCR (diesel)" },
];

/* ================================================================== */
/*  STEP 1 — Vehicle & Scope (enhanced with architecture)             */
/* ================================================================== */

export function Step1VehicleScope({ wiz }: { wiz: Wiz }) {
  const brands = useMemo(() => uniqueBrands(), []);
  const standards = useMemo(() => uniqueEmissionStandards(), []);
  const [local, setLocal] = useState<VehicleScopeInput>({ ...wiz.vehicleScope });

  const scopes: ComponentScope[] = ["CC-TWC", "UF-TWC", "GPF", "DOC", "DPF", "SCR"];
  const markets: TargetMarket[] = ["EU-West", "EU-East", "Turkey", "MENA", "Global"];

  const toggleScope = (s: ComponentScope) => {
    setLocal((p) => ({
      ...p,
      componentScope: p.componentScope.includes(s)
        ? p.componentScope.filter((x) => x !== s)
        : [...p.componentScope, s],
    }));
  };

  const matchCount = wiz.matchedRows.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Step 1 — Vehicle &amp; scope</CardTitle>
        <CardDescription>
          Define the target application and system architecture. The database will auto-filter to matching OEM references.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs text-muted-foreground">Brand / OEM group</Label>
            <Select value={local.brand} onValueChange={(v) => setLocal((p) => ({ ...p, brand: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All brands</SelectItem>
                {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Engine family / vehicle search</Label>
            <Input
              className="mt-1"
              placeholder="e.g. EA211, PureTech, K9K…"
              value={local.engineSearch}
              onChange={(e) => setLocal((p) => ({ ...p, engineSearch: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Emission standard</Label>
            <Select value={local.emissionStandard} onValueChange={(v) => setLocal((p) => ({ ...p, emissionStandard: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All standards</SelectItem>
                {standards.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Target market</Label>
            <Select value={local.targetMarket} onValueChange={(v) => setLocal((p) => ({ ...p, targetMarket: v as TargetMarket }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {markets.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">System architecture</Label>
          <Select
            value={local.systemArchitecture}
            onValueChange={(v) => setLocal((p) => ({ ...p, systemArchitecture: v as SystemArchitecture }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SYSTEM_ARCHITECTURES.map((a) => (
                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Component scope</Label>
          <div className="flex flex-wrap gap-2">
            {scopes.map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={local.componentScope.includes(s) ? "default" : "outline"}
                onClick={() => toggleScope(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Packaging constraints (optional)</Label>
          <Input
            className="mt-1"
            placeholder="e.g. max Ø132mm, max L152mm, existing canning tool…"
            value={local.packagingConstraints}
            onChange={(e) => setLocal((p) => ({ ...p, packagingConstraints: e.target.value }))}
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {matchCount} matching ECS rows in Database {OEM_DB_MANIFEST.databaseVersion}
          </p>
          <Button
            onClick={() => wiz.submitVehicleScope(local)}
            disabled={local.componentScope.length === 0}
            className="gap-1.5"
          >
            Continue to OEM reference
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ================================================================== */
/*  STEP 2 — OEM Reference Review                                    */
/* ================================================================== */

const OEM_PAGE_SIZE = 30;

export function Step2OemReference({ wiz }: { wiz: Wiz }) {
  const [page, setPage] = useState(0);
  const rows = wiz.matchedRows;
  const pageCount = Math.max(1, Math.ceil(rows.length / OEM_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => rows.slice(safePage * OEM_PAGE_SIZE, (safePage + 1) * OEM_PAGE_SIZE),
    [rows, safePage],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step 2 — OEM reference review</CardTitle>
          <CardDescription>
            {rows.length} rows matched. The top rows were auto-pinned. Adjust pins, then generate baseline summary.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-h-[min(420px,50vh)] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Brand</TableHead>
                  <TableHead>Engine</TableHead>
                  <TableHead>Std</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">PGM g/L</TableHead>
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No rows match. Go back and adjust filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map(({ record: rec, globalIndex: gi }: EcsFilteredRow) => {
                    const pinned = wiz.oemRef.pinnedIndices.includes(gi);
                    return (
                      <TableRow key={gi} className={pinned ? "bg-primary/5" : undefined}>
                        <TableCell>
                          <Button type="button" size="icon" variant="ghost" className="size-8" onClick={() => wiz.togglePin(gi)}>
                            {pinned ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4" />}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">{fmt(rec.brand)}</TableCell>
                        <TableCell className="max-w-[180px] truncate" title={fmt(rec.engineFamily)}>{fmt(rec.engineFamily)}</TableCell>
                        <TableCell>{fmt(rec.emissionStandard)}</TableCell>
                        <TableCell className="max-w-[100px] truncate">{fmt(rec.componentType)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{fmt(rec.totalPgmGPerL)}</TableCell>
                        <TableCell>
                          <Badge variant={rec.confidence === "HIGH" ? "default" : rec.confidence === "MEDIUM" ? "secondary" : "outline"} className="text-[10px]">
                            {fmt(rec.confidence)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Page {safePage + 1}/{pageCount} · {wiz.oemRef.pinnedIndices.length} pinned</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={safePage <= 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>

          <Separator />

          <Button
            variant="secondary"
            className="gap-1.5"
            onClick={() => void wiz.requestBaselineSummary()}
            disabled={wiz.oemRef.baselineLoading || wiz.oemRef.pinnedIndices.length === 0}
          >
            {wiz.oemRef.baselineLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Generate OEM baseline summary
          </Button>

          {wiz.oemRef.aiBaselineSummary && (
            <div className={`rounded-lg border bg-card p-4 max-h-[min(400px,40vh)] overflow-y-auto ${PROSE_CLASSES}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{wiz.oemRef.aiBaselineSummary}</ReactMarkdown>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={wiz.prev} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Button onClick={wiz.proceedToSystemDesign} disabled={wiz.oemRef.pinnedIndices.length === 0} className="gap-1.5">
          Continue to system design <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  STEP 3 — System Design (NEW)                                      */
/* ================================================================== */

export function Step3SystemDesign({ wiz }: { wiz: Wiz }) {
  const sd = wiz.systemDesign.result;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step 3 — System design</CardTitle>
          <CardDescription>
            Multi-brick coordinated architecture: {wiz.vehicleScope.systemArchitecture}. Backpressure budget and per-brick allocation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!sd ? (
            <p className="text-sm text-muted-foreground">System design not yet computed.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <InfoCard label="Architecture" value={sd.architecture} />
                <InfoCard label="Total backpressure" value={`${sd.totalBackpressureKPa} kPa`} />
                <InfoCard
                  label="BP margin vs OEM+10%"
                  value={`${sd.backpressureMarginPct}%`}
                  variant={sd.backpressureMarginPct < 0 ? "danger" : sd.backpressureMarginPct < 10 ? "warning" : "success"}
                />
              </div>

              <div className="overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Brick</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Ø mm</TableHead>
                      <TableHead className="text-right">L mm</TableHead>
                      <TableHead className="text-right">Vol L</TableHead>
                      <TableHead className="text-right">PGM g/L</TableHead>
                      <TableHead className="text-right">OSC g/L</TableHead>
                      <TableHead className="text-right">WC g/L</TableHead>
                      <TableHead className="text-right">BP kPa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sd.bricks.map((b) => (
                      <TableRow key={b.role}>
                        <TableCell className="font-medium">{b.role}</TableCell>
                        <TableCell>{b.substrateType}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{b.diameterMm}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{b.lengthMm}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{b.volumeL}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{b.pgmGPerL}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{b.oscGPerL}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{b.washcoatGPerL}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{b.backpressureKPa.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <InfoCard label="Total system PGM" value={`${sd.totalPgmG} g`} />
                <InfoCard label="Total system OSC" value={`${sd.totalOscG} g`} />
              </div>

              {sd.notes.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  {sd.notes.map((n, i) => (
                    <p key={i} className={`text-xs ${n.startsWith("WARNING") ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}`}>
                      {n}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={wiz.prev} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Button onClick={wiz.generateAmVariants} disabled={wiz.oemRef.pinnedIndices.length === 0} className="gap-1.5">
          Generate AM variants <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  STEP 4 — AM Design Variants (enhanced with aging)                 */
/* ================================================================== */

function VariantCard({ v, selected, onSelect }: { v: AmVariant; selected: boolean; onSelect: () => void }) {
  const riskColor = v.obdRisk === "LOW" ? "text-green-600 dark:text-green-400" : v.obdRisk === "MEDIUM" ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
  const aging = v.agingPrediction;

  return (
    <Card className={`cursor-pointer transition-all ${selected ? "ring-2 ring-primary" : "hover:border-primary/40"}`} onClick={onSelect}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{v.label}</CardTitle>
          <Badge variant={v.tier === "performance" ? "default" : v.tier === "balanced" ? "secondary" : "outline"}>
            {v.tier}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-muted-foreground">PGM total</span>
          <span className="font-mono">{v.pgm.totalGPerL} g/L ({v.pgm.totalGPerFt3} g/ft³)</span>
          <span className="text-muted-foreground">Pd / Rh / Pt</span>
          <span className="font-mono text-xs">{v.pgm.pdGPerL} / {v.pgm.rhGPerL} / {v.pgm.ptGPerL} g/L</span>
          <span className="text-muted-foreground">Pd:Rh ratio</span>
          <span className="font-mono">{v.pgm.pdRhRatio}:1</span>
          <span className="text-muted-foreground">OSC target</span>
          <span className="font-mono">{v.oscTargetGPerL} g/L</span>
          <span className="text-muted-foreground">OSC ratio</span>
          <span className="font-mono">{v.oscRatio}</span>
        </div>

        {aging && (
          <>
            <Separator />
            <p className="text-xs font-medium text-muted-foreground">Aging prediction (12h @ 1050°C)</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-muted-foreground">OSC retention</span>
              <span className="font-mono">{aging.osc.retentionPct}%</span>
              <span className="text-muted-foreground">Pd dispersion</span>
              <span className="font-mono">{aging.pgmPd.agedDispersionPct}%</span>
              <span className="text-muted-foreground">T50 CO (aged)</span>
              <span className="font-mono">{aging.predictedT50CoC}°C</span>
              <span className="text-muted-foreground">T50 HC (aged)</span>
              <span className="font-mono">{aging.predictedT50HcC}°C</span>
            </div>
          </>
        )}

        <Separator />
        <div>
          <span className="text-muted-foreground">OBD risk: </span>
          <span className={`font-semibold ${riskColor}`}>{v.obdRisk}</span>
          <p className="text-xs text-muted-foreground mt-1">{v.obdNote}</p>
        </div>
        {v.aiCommentary && (
          <>
            <Separator />
            <div className={PROSE_CLASSES}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{v.aiCommentary}</ReactMarkdown>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const AGING_PROTOCOL_PRESETS: Record<string, { agingTempC: number; agingHours: number }> = {
  "RAT-A": { agingTempC: 1050, agingHours: 12 },
  "ZDAKW": { agingTempC: 1000, agingHours: 25 },
  "Bosal-bench": { agingTempC: 1080, agingHours: 8 },
  "Custom": { agingTempC: 1050, agingHours: 12 },
};

const TOOLING_DIAMETERS = [93, 101.6, 105.7, 118.4, 127, 132, 143, 152.4, 170];

export function Step4Variants({ wiz }: { wiz: Wiz }) {
  const [editingTier, setEditingTier] = useState<VariantTier | null>(null);
  const selectedVariant = wiz.variants.variants.find((v) => v.tier === wiz.variants.selectedTier)
    ?? wiz.variants.variants[0];
  const editingVariant = wiz.variants.variants.find((v) => v.tier === editingTier);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step 4 — AM design variants</CardTitle>
          <CardDescription>
            Three variants from OEM baseline ({wiz.oemBaseline.totalPgmGPerL.toFixed(2)} g/L PGM, {wiz.oemBaseline.totalOscGPerL.toFixed(1)} g/L OSC).
            Select a variant and click <strong>Adjust</strong> to tune PGM, substrate, and aging protocol with live recalculation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Aging protocol selector — top level, applies to all variants */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Aging protocol (applies to all variants)</p>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <Label className="text-xs">Protocol</Label>
                <Select
                  value={wiz.agingParams.protocol}
                  onValueChange={(v) => {
                    const preset = AGING_PROTOCOL_PRESETS[v as string];
                    wiz.updateAgingParams({ protocol: v as typeof wiz.agingParams.protocol, ...preset });
                  }}
                >
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(AGING_PROTOCOL_PRESETS).map((p) => (
                      <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Temp (°C)</Label>
                <Input
                  type="number" min={900} max={1150} step={10}
                  value={wiz.agingParams.agingTempC}
                  onChange={(e) => wiz.updateAgingParams({ protocol: "Custom", agingTempC: +e.target.value })}
                  className="h-8 w-24 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Hours</Label>
                <Input
                  type="number" min={1} max={100} step={1}
                  value={wiz.agingParams.agingHours}
                  onChange={(e) => wiz.updateAgingParams({ protocol: "Custom", agingHours: +e.target.value })}
                  className="h-8 w-20 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Flow (kg/h)</Label>
                <Input
                  type="number" min={30} max={400} step={10}
                  value={wiz.agingParams.exhaustFlowKgPerH}
                  onChange={(e) => wiz.updateAgingParams({ exhaustFlowKgPerH: +e.target.value })}
                  className="h-8 w-24 text-xs font-mono"
                />
              </div>
              <p className="text-xs text-muted-foreground self-end pb-1">
                SV: {selectedVariant?.agingPrediction?.svH ? `${(selectedVariant.agingPrediction.svH / 1000).toFixed(0)}k h⁻¹` : "—"}
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            className="gap-1.5"
            onClick={() => void wiz.requestVariantCommentary()}
            disabled={wiz.variants.aiLoading}
          >
            {wiz.variants.aiLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Get AI engineering commentary
          </Button>

          {wiz.variants.variants.length > 0 && (
            <VariantRadarChart variants={wiz.variants.variants} />
          )}

          <div className="grid gap-4 md:grid-cols-3">
            {wiz.variants.variants.map((v) => (
              <div key={v.tier} className="space-y-2">
                <VariantCard
                  v={v}
                  selected={wiz.variants.selectedTier === v.tier}
                  onSelect={() => wiz.selectVariant(v.tier)}
                />
                <Button
                  size="sm"
                  variant={editingTier === v.tier ? "secondary" : "outline"}
                  className="w-full gap-1 text-xs h-7"
                  onClick={() => setEditingTier(editingTier === v.tier ? null : v.tier)}
                >
                  {editingTier === v.tier ? "Close adjust" : "Adjust design"}
                </Button>
              </div>
            ))}
          </div>

          {/* Inline editing panel */}
          {editingTier && editingVariant && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Adjust: {editingVariant.label}</CardTitle>
                <CardDescription className="text-xs">All changes trigger live recalculation of aging, OBD risk, and cost.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* PGM */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">PGM loading (g/L)</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(["pdGPerL", "rhGPerL", "ptGPerL"] as const).map((field) => (
                      <div key={field}>
                        <Label className="text-xs">{field === "pdGPerL" ? "Pd" : field === "rhGPerL" ? "Rh" : "Pt"} g/L</Label>
                        <Input
                          type="number" min={0} max={5} step={0.01}
                          value={editingVariant.pgm[field]}
                          onChange={(e) => wiz.updateVariantPgm(editingTier, field, +e.target.value)}
                          className="h-8 font-mono text-xs"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total: <strong>{editingVariant.pgm.totalGPerL} g/L</strong> — Pd:Rh <strong>{editingVariant.pgm.pdRhRatio}:1</strong>
                  </p>
                </div>

                {/* OSC */}
                <div>
                  <Label className="text-xs">OSC target (g/L)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number" min={0} max={200} step={1}
                      value={editingVariant.oscTargetGPerL}
                      onChange={(e) => wiz.updateVariantOsc(editingTier, +e.target.value)}
                      className="h-8 font-mono text-xs w-28"
                    />
                    <span className="text-xs text-muted-foreground">OEM: {wiz.oemBaseline.totalOscGPerL.toFixed(1)} g/L</span>
                  </div>
                </div>

                {/* Substrate */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Substrate</p>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div>
                      <Label className="text-xs">Diameter (mm)</Label>
                      <Select
                        value={String(editingVariant.substrate.diameterMm)}
                        onValueChange={(v) => wiz.updateVariantSubstrate(editingTier, "diameterMm", +v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TOOLING_DIAMETERS.map((d) => (
                            <SelectItem key={d} value={String(d)} className="text-xs">{d} mm</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Length (mm)</Label>
                      <Input
                        type="number" min={50} max={305} step={5}
                        value={editingVariant.substrate.lengthMm}
                        onChange={(e) => wiz.updateVariantSubstrate(editingTier, "lengthMm", +e.target.value)}
                        className="h-8 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">CPSI</Label>
                      <Select
                        value={String(editingVariant.substrate.cpsi)}
                        onValueChange={(v) => wiz.updateVariantSubstrate(editingTier, "cpsi", +v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[400, 600, 900].map((c) => (
                            <SelectItem key={c} value={String(c)} className="text-xs">{c} CPSI</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <InfoCard label="Volume" value={`${editingVariant.substrate.volumeL} L`} />
                  </div>
                </div>

                {/* Live aging preview after edit */}
                {editingVariant.agingPrediction && (
                  <div className="grid gap-2 sm:grid-cols-4 text-xs">
                    <InfoCard label="OSC retention" value={`${editingVariant.agingPrediction.osc.retentionPct}%`} variant={editingVariant.agingPrediction.osc.retentionPct < 55 ? "danger" : editingVariant.agingPrediction.osc.retentionPct < 65 ? "warning" : "success"} />
                    <InfoCard label="T50 CO (fresh)" value={`${editingVariant.agingPrediction.freshT50CoC}°C`} />
                    <InfoCard label="T50 CO (aged)" value={`${editingVariant.agingPrediction.predictedT50CoC}°C`} variant={editingVariant.agingPrediction.predictedT50CoC > 320 ? "danger" : editingVariant.agingPrediction.predictedT50CoC > 290 ? "warning" : "success"} />
                    <InfoCard label="Pd dispersion (aged)" value={`${editingVariant.agingPrediction.pgmPd.agedDispersionPct}%`} />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Aging curves + light-off curves for selected variant */}
          {selectedVariant?.agingPrediction && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Aging curves — {selectedVariant.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <AgingCurvesChart prediction={selectedVariant.agingPrediction} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">T50 comparison — fresh vs aged</CardTitle>
                </CardHeader>
                <CardContent>
                  <T50ComparisonChart
                    freshT50Co={selectedVariant.agingPrediction.freshT50CoC}
                    freshT50Hc={selectedVariant.agingPrediction.freshT50HcC}
                    agedT50Co={selectedVariant.agingPrediction.predictedT50CoC}
                    agedT50Hc={selectedVariant.agingPrediction.predictedT50HcC}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {selectedVariant?.agingPrediction && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Light-off curves — fresh vs aged ({wiz.agingParams.agingTempC}°C / {wiz.agingParams.agingHours}h)</CardTitle>
                <CardDescription className="text-xs">Solid = fresh, dashed = aged. Shift indicates performance margin loss.</CardDescription>
              </CardHeader>
              <CardContent>
                <LightOffCurveChart curve={selectedVariant.agingPrediction.lightOffCurve} />
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={wiz.prev} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Button onClick={wiz.proceedToChemistry} disabled={!wiz.variants.selectedTier} className="gap-1.5">
          Continue to chemistry <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  STEP 5 — Chemistry & Washcoat (enhanced with Ce slider)           */
/* ================================================================== */

export function Step5Chemistry({ wiz }: { wiz: Wiz }) {
  const c = wiz.chemistry;
  const selected = wiz.variants.variants.find((v) => v.tier === wiz.variants.selectedTier);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step 5 — Chemistry &amp; washcoat</CardTitle>
          <CardDescription>
            Washcoat specification for {selected?.label ?? "selected variant"} (OSC ratio {selected?.oscRatio ?? "—"}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label className="text-xs text-muted-foreground">Ce content in CeO₂-ZrO₂ (%)</Label>
            <div className="flex items-center gap-3 mt-1">
              <input
                type="range"
                min={20}
                max={60}
                value={c.cePercent}
                onChange={(e) => wiz.setCePercent(+e.target.value)}
                className="flex-1"
              />
              <span className="font-mono text-sm w-12 text-right">{c.cePercent}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Higher Ce% → more OSC capacity but faster crystallite coarsening during aging
            </p>
          </div>

          {/* Editable washcoat layers */}
          <div className="grid gap-6 md:grid-cols-2">
            {(["layer1", "layer2"] as const).map((layerKey) => {
              const layer = c[layerKey];
              const isL1 = layerKey === "layer1";
              return (
                <Card key={layerKey}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{isL1 ? "Layer 1 — Inner (substrate-side)" : "Layer 2 — Outer (gas-side)"}</CardTitle>
                    <CardDescription className="text-xs">{isL1 ? "Pd-rich, BaO NOx trapping, high OSC" : "Rh-rich, lean NOx reduction, lower OSC"}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(
                      [
                        { field: "aluminaGPerL" as const, label: "γ-Al₂O₃ (g/L)", hint: "Support material — thermal stability" },
                        { field: "oscGPerL" as const, label: "CeO₂-ZrO₂ OSC (g/L)", hint: "Oxygen buffer — higher = more OBD buffer" },
                        { field: "oscCePercent" as const, label: "Ce content (%)", hint: "Higher Ce% = more OSC capacity, faster aging" },
                        ...(isL1 ? [{ field: "baoGPerL" as const, label: "BaO (g/L)", hint: "NOx trap — lean burn stabiliser" }] : []),
                        { field: "la2o3GPerL" as const, label: "La₂O₃ (g/L)", hint: "Thermal stabiliser for alumina" },
                        ...(isL1 ? [{ field: "nd2o3GPerL" as const, label: "Nd₂O₃ (g/L)", hint: "Redox promoter" }] : []),
                      ] as { field: keyof typeof layer; label: string; hint: string }[]
                    ).map(({ field, label, hint }) => (
                      <div key={field}>
                        <Label className="text-xs">{label}</Label>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number" min={0} max={field === "oscCePercent" ? 70 : 300} step={field === "oscCePercent" ? 1 : 0.5}
                            value={layer[field]}
                            onChange={(e) => wiz.updateChemistryLayer(layerKey, field, +e.target.value)}
                            className="h-7 font-mono text-xs w-24"
                          />
                          <span className="text-xs text-muted-foreground">{hint}</span>
                        </div>
                      </div>
                    ))}
                    <Separator className="my-1" />
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Layer total</span>
                      <span className="font-semibold font-mono">{layer.totalGPerL} g/L</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">Total washcoat:</span>
            <span className="font-semibold">{c.totalWashcoatGPerL} g/L</span>
            <span className="text-muted-foreground">OSC formulation:</span>
            <span className="font-mono text-xs">{c.oscFormulation}</span>
          </div>

          {selected?.agingPrediction && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Poison accumulation (160k km)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <Row label="Sulfur" value={`${selected.agingPrediction.poison.sulfurMgPerBrick} mg/brick`} />
                  <Row label="Phosphorus" value={`${selected.agingPrediction.poison.phosphorusMgPerBrick} mg/brick`} />
                  <Row label="Zinc" value={`${selected.agingPrediction.poison.zincMgPerBrick} mg/brick`} />
                  <Row label="GSA loss" value={`${selected.agingPrediction.poison.gsaLossPct}%`} />
                  <Row label="T50 shift (poison)" value={`+${selected.agingPrediction.poison.t50ShiftFromPoisonC}°C`} />
                  <Row label="Activity loss" value={`${selected.agingPrediction.poison.activityLossPct}%`} />
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Light-off curve and SV analysis for selected variant */}
          {selected?.agingPrediction && (
            <>
              <Separator />
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Light-off curve — CO / HC / NOx</CardTitle>
                    <CardDescription className="text-xs">
                      SV: {(selected.agingPrediction.svH / 1000).toFixed(0)}k h⁻¹. Solid = fresh, dashed = aged.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <LightOffCurveChart curve={selected.agingPrediction.lightOffCurve} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Space velocity effect @ 450°C</CardTitle>
                    <CardDescription className="text-xs">
                      Higher SV = shorter contact time = lower conversion. Red dot = current SV.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SpaceVelocityChart
                      points={computeSpaceVelocityEffect({ pdGPerL: selected.pgm.pdGPerL, rhGPerL: selected.pgm.rhGPerL, substrateVolumeL: selected.substrate.volumeL })}
                      svCurrent={selected.agingPrediction.svH}
                    />
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          <Separator />

          <Button
            variant="secondary"
            className="gap-1.5"
            onClick={() => void wiz.requestChemistryNotes()}
            disabled={c.chemistryLoading}
          >
            {c.chemistryLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Get AI chemistry recommendations
          </Button>

          {c.aiChemistryNotes && (
            <div className={`rounded-lg border bg-card p-4 max-h-[min(400px,40vh)] overflow-y-auto ${PROSE_CLASSES}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.aiChemistryNotes}</ReactMarkdown>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={wiz.prev} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Button onClick={wiz.proceedToObdValidation} className="gap-1.5">
          Continue to OBD &amp; validation <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-semibold" : "font-mono"}>{value}</span>
    </div>
  );
}

/* ================================================================== */
/*  STEP 6 — WLTP Simulation                                          */
/* ================================================================== */

export function Step6WltpSimulation({ wiz }: { wiz: Wiz }) {
  const selected =
    wiz.variants.variants.find((v) => v.tier === wiz.variants.selectedTier) ??
    wiz.variants.variants[0];
  const preset = LIGHT_DUTY_PRESETS[wiz.wltpSim.enginePresetIndex] ?? LIGHT_DUTY_PRESETS[0];
  const result = wiz.wltpSim.result;

  const emissionStdOptions = Object.entries(WLTP_EMISSION_LIMITS).map(([key, val]) => ({
    key: key as WLTPEmissionStandard,
    label: val.label,
  }));

  const verdictColor =
    result?.overallVerdict === "green"
      ? "text-green-600 dark:text-green-400"
      : result?.overallVerdict === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  const chartData = result?.homologation.map((h) => ({
    species: h.species,
    Actual: parseFloat(h.cumulative_g_km.toFixed(4)),
    Limit: parseFloat(h.limit_g_km.toFixed(4)),
  }));

  return (
    <div className="space-y-4">
      {/* Simulation inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Play className="size-4 text-[#C8102E]" />
            WLTP Transient Simulation
          </CardTitle>
          <CardDescription>
            Validate your catalyst design against a real driving cycle using the engine selected in
            Step 1. Results feed directly into the OBD check in Step 7.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pre-filled summary */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Engine (from Step 1)</p>
              <p className="text-sm font-semibold">{preset.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {preset.displacement_L} L · {preset.power_kW} kW · {preset.fuelType}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Catalyst (from Step 4)</p>
              {selected ? (
                <>
                  <p className="text-sm font-semibold capitalize">{selected.tier} variant</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selected.pgm.totalGPerFt3.toFixed(0)} g/ft³ · ⌀{selected.substrate.diameterMm}×
                    {selected.substrate.lengthMm} mm · {selected.substrate.cpsi} CPSI
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No variant selected yet (go back to Step 4)</p>
              )}
            </div>
          </div>

          {/* Adjustable inputs */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Engine Preset</Label>
              <Select
                value={String(wiz.wltpSim.enginePresetIndex)}
                onValueChange={(v) => wiz.setWltpEnginePreset(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIGHT_DUTY_PRESETS.map((p, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Emission Standard</Label>
              <Select
                value={wiz.wltpSim.emissionStandard}
                onValueChange={(v) => wiz.setWltpEmissionStandard(v as WLTPEmissionStandard)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {emissionStdOptions.map((o) => (
                    <SelectItem key={o.key} value={o.key}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            className="w-full gap-2"
            onClick={wiz.runWltpSim}
            disabled={wiz.wltpSim.isRunning || !selected}
          >
            {wiz.wltpSim.isRunning ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Running WLTP simulation…
              </>
            ) : (
              <>
                <Play className="size-4" /> Run WLTP Simulation
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className={`text-base font-bold ${verdictColor}`}>
                {result.overallVerdict === "green"
                  ? "✓ PASS"
                  : result.overallVerdict === "amber"
                    ? "⚠ MARGINAL"
                    : "✗ FAIL"}
              </span>
              <span className="text-sm text-muted-foreground font-normal">— Homologation Results</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Species cards */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {result.homologation.map((h) => (
                <div
                  key={h.species}
                  className={`rounded-lg border p-3 text-center ${
                    h.verdict === "green"
                      ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
                      : h.verdict === "amber"
                        ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
                        : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                  }`}
                >
                  <p className="text-xs font-medium text-muted-foreground">{h.species}</p>
                  <p
                    className={`text-lg font-bold mt-0.5 ${
                      h.verdict === "green"
                        ? "text-green-700 dark:text-green-400"
                        : h.verdict === "amber"
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-red-700 dark:text-red-400"
                    }`}
                  >
                    {h.cumulative_g_km.toFixed(3)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    limit: {h.limit_g_km.toFixed(3)} g/km
                  </p>
                  <p className="text-[10px] font-medium mt-0.5">
                    margin: {h.margin_percent > 0 ? "+" : ""}
                    {h.margin_percent.toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>

            {/* Actual vs limit bar chart */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Actual vs Limit (g/km)
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="species" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Actual" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Limit" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <InfoCard label="Light-off time" value={`${result.lightOffTime_s.toFixed(0)} s`} />
              <InfoCard
                label="Peak GHSV"
                value={`${Math.round(result.peakGHSV_h).toLocaleString()} h⁻¹`}
              />
              <InfoCard label="Distance" value={`${result.totalDistance_km.toFixed(1)} km`} />
              <InfoCard label="Aging factor" value={result.agingFactor.toFixed(2)} />
            </div>

            <p className="text-xs text-muted-foreground">
              For detailed phase breakdown, SGB data upload, and advanced pre-dev sweep,{" "}
              <a
                href="/aftermarket/wltp"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                open the full WLTP Simulator →
              </a>
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={wiz.prev} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Button onClick={wiz.next} className="gap-1.5">
          Next — OBD Validation <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  STEP 7 — OBD & Validation                                         */
/* ================================================================== */

const OBD_STRATEGY_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: "amplitude", label: "Amplitude (VAG, BMW)", description: "Compares rear-O₂ switch amplitude to threshold. Common in German OEMs." },
  { value: "delay", label: "Delay (PSA, Stellantis)", description: "Measures lag between front/rear switch events. Detects slow OSC." },
  { value: "ratio", label: "Ratio (Toyota, Honda)", description: "Front/rear switch frequency ratio. Robust across lambda cycles." },
];

export function Step7ObdValidation({ wiz }: { wiz: Wiz }) {
  const obd = wiz.obdValidation;
  const mc = obd.multiCycleResult;
  const dv = obd.designValidation;
  const selected = wiz.variants.variants.find((v) => v.tier === wiz.variants.selectedTier);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step 6 — OBD simulation &amp; design validation</CardTitle>
          <CardDescription>
            Rear-O₂ signal simulation, P0420 prediction, and design rules check. Adjust strategy and flow to match target OEM calibration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* OBD Controls */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">OBD simulation parameters</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">OBD monitoring strategy</Label>
                <Select
                  value={obd.obdStrategy}
                  onValueChange={(v) => wiz.updateObdStrategy(v as typeof obd.obdStrategy)}
                >
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OBD_STRATEGY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {OBD_STRATEGY_OPTIONS.find((o) => o.value === obd.obdStrategy)?.description}
                </p>
              </div>
              <div>
                <Label className="text-xs">Rated exhaust flow (kg/h)</Label>
                <Input
                  type="number" min={30} max={400} step={10}
                  value={obd.exhaustFlowKgPerH}
                  onChange={(e) => wiz.updateExhaustFlow(+e.target.value)}
                  className="h-8 font-mono text-xs mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Higher flow = shorter residence time = weaker OSC buffering = harder OBD.
                </p>
              </div>
            </div>
            {selected?.agingPrediction && (
              <div className="grid gap-2 sm:grid-cols-3 text-xs">
                <InfoCard label="AM OSC (aged)" value={`${selected.agingPrediction.osc.agedUmolO2PerBrick.toFixed(0)} µmol`} />
                <InfoCard label="SV" value={`${(selected.agingPrediction.svH / 1000).toFixed(0)}k h⁻¹`} />
                <InfoCard label="Ce content" value={`${wiz.chemistry.cePercent}%`} />
              </div>
            )}
          </div>

          {mc && (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <InfoCard
                  label="Overall OBD"
                  value={mc.overallPass ? "PASS" : "FAIL"}
                  variant={mc.overallPass ? "success" : "danger"}
                />
                <InfoCard
                  label="Worst margin"
                  value={`${mc.worstMarginPct}%`}
                  variant={mc.worstMarginPct < 10 ? "warning" : "success"}
                />
                <InfoCard label="OBD strategy" value={obd.obdStrategy} />
                <InfoCard label="OBD counter" value={String(mc.obdCounterFinal)} />
              </div>

              <div className="overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cycle</TableHead>
                      <TableHead className="text-right">OSC var %</TableHead>
                      <TableHead className="text-right">Eff. OSC µmol</TableHead>
                      <TableHead className="text-right">Metric</TableHead>
                      <TableHead className="text-right">Threshold</TableHead>
                      <TableHead className="text-right">Margin %</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>MIL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mc.cycles.map((c) => (
                      <TableRow key={c.cycleNumber}>
                        <TableCell className="font-medium">Cycle {c.cycleNumber}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{c.oscVariationPct}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{c.effectiveOscUmol}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{c.p0420.metricValue}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{c.p0420.threshold}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{c.p0420.marginPct}</TableCell>
                        <TableCell>
                          <Badge variant={c.p0420.pass ? "default" : "destructive"} className="text-[10px]">
                            {c.p0420.pass ? "PASS" : "FAIL"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.milStatus === "OFF" ? "outline" : c.milStatus === "PENDING" ? "secondary" : "destructive"} className="text-[10px]">
                            {c.milStatus}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {mc.cycles[0] && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Rear-O₂ signal waveform (Cycle 1)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ObdSignalChart signal={mc.cycles[0].p0420.signal} />
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {dv && (
            <>
              <Separator />
              <h3 className="text-sm font-semibold flex items-center gap-2">
                {dv.valid ? (
                  <ShieldCheck className="size-4 text-green-600" />
                ) : (
                  <ShieldAlert className="size-4 text-red-600" />
                )}
                Design rules validation — {dv.blockCount} blocks, {dv.warnCount} warnings
              </h3>

              {dv.violations.length > 0 && (
                <div className="space-y-2">
                  {dv.violations.map((v) => (
                    <div key={v.id} className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3">
                      <XCircle className="size-4 text-red-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-red-800 dark:text-red-300">
                          BLOCK: {v.field} = {String(v.value)} (limit: {String(v.limit)})
                        </p>
                        <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">{v.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {dv.warnings.length > 0 && (
                <div className="space-y-2">
                  {dv.warnings.map((w) => (
                    <div key={w.id} className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3">
                      <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                          WARN: {w.field} = {String(w.value)} (limit: {String(w.limit)})
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{w.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {dv.valid && dv.warnCount === 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-3">
                  <ShieldCheck className="size-4 text-green-600" />
                  <p className="text-sm text-green-800 dark:text-green-300">All design rules pass. No violations or warnings.</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={wiz.prev} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Button
          onClick={() => wiz.proceedToEconomics()}
          disabled={dv != null && !dv.valid}
          className="gap-1.5"
        >
          Continue to economics <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  STEP 7 — Economics & Market (enhanced with competitor bench)       */
/* ================================================================== */

export function Step8Economics({ wiz }: { wiz: Wiz }) {
  const e = wiz.economics;
  const [prices, setPrices] = useState<PgmPrices>({ ...e.pgmPrices });
  const [pen, setPen] = useState(10);

  const tiers: VariantTier[] = ["performance", "balanced", "value"];
  const tierLabels: Record<VariantTier, string> = { performance: "A — Perf", balanced: "B — Bal", value: "C — Value" };

  const hasCosts = Object.keys(e.variantCosts).length > 0;

  const handleRecalc = useCallback(() => {
    wiz.recalcEconomics(prices, pen);
  }, [wiz, prices, pen]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step 7 — Economics &amp; market sizing</CardTitle>
          <CardDescription>
            Cost breakdown, revenue potential, and competitor benchmarking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <Label className="text-xs text-muted-foreground">Pd (€/g)</Label>
              <Input type="number" className="mt-1" value={prices.pdEurPerG} onChange={(ev) => setPrices((p) => ({ ...p, pdEurPerG: +ev.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Rh (€/g)</Label>
              <Input type="number" className="mt-1" value={prices.rhEurPerG} onChange={(ev) => setPrices((p) => ({ ...p, rhEurPerG: +ev.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Pt (€/g)</Label>
              <Input type="number" className="mt-1" value={prices.ptEurPerG} onChange={(ev) => setPrices((p) => ({ ...p, ptEurPerG: +ev.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">AM penetration (%)</Label>
              <Input type="number" className="mt-1" value={pen} onChange={(ev) => setPen(+ev.target.value)} />
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={handleRecalc}>
            Recalculate
          </Button>

          {hasCosts && (
            <>
              <CostBarChart costs={e.variantCosts} />

              <Separator />
              <h3 className="text-sm font-semibold">Cost breakdown per brick (€)</h3>
              <div className="overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      {tiers.map((t) => <TableHead key={t} className="text-right">{tierLabels[t]}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(["pgmCostPerBrick", "substrateCost", "washcoatCost", "canningCost", "totalBom", "targetRetail"] as (keyof CostBreakdown)[]).map((k) => (
                      <TableRow key={k}>
                        <TableCell className="text-muted-foreground">{k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}</TableCell>
                        {tiers.map((t) => (
                          <TableCell key={t} className="text-right font-mono text-xs">
                            {e.variantCosts[t] ? eur(e.variantCosts[t][k]) : "—"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <h3 className="text-sm font-semibold mt-4">Market sizing (EU annual)</h3>
              <div className="overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metric</TableHead>
                      {tiers.map((t) => <TableHead key={t} className="text-right">{tierLabels[t]}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(["euAnnualVolume", "amPenetrationPct", "amAnnualUnits", "revenueEur"] as (keyof MarketEstimate)[]).map((k) => (
                      <TableRow key={k}>
                        <TableCell className="text-muted-foreground">{k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}</TableCell>
                        {tiers.map((t) => (
                          <TableCell key={t} className="text-right font-mono text-xs">
                            {e.variantMarket[t]
                              ? k === "revenueEur"
                                ? eur(e.variantMarket[t][k])
                                : k === "amPenetrationPct"
                                  ? `${e.variantMarket[t][k]}%`
                                  : e.variantMarket[t][k].toLocaleString()
                              : "—"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {e.benchmark && (
            <>
              <Separator />
              <h3 className="text-sm font-semibold">Competitor benchmarking</h3>
              <p className="text-xs text-muted-foreground">{e.benchmark.summary}</p>
              <div className="overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Competitor</TableHead>
                      <TableHead>PGM</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Warranty</TableHead>
                      <TableHead>Position</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {e.benchmark.comparisons.map((c) => (
                      <TableRow key={c.competitor.shortName}>
                        <TableCell className="font-medium">{c.competitor.shortName}</TableCell>
                        <TableCell>
                          <Badge variant={c.pgmComparison === "higher" ? "default" : c.pgmComparison === "lower" ? "destructive" : "secondary"} className="text-[10px]">
                            {c.pgmComparison} ({c.pgmDiffPct > 0 ? "+" : ""}{c.pgmDiffPct}%)
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.priceComparison === "cheaper" ? "default" : c.priceComparison === "more-expensive" ? "destructive" : "secondary"} className="text-[10px]">
                            {c.priceComparison}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{c.warrantyComparison}</TableCell>
                        <TableCell>
                          <Badge variant={c.position === "advantage" ? "default" : c.position === "disadvantage" ? "destructive" : "outline"} className="text-[10px]">
                            {c.position}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={wiz.prev} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Button onClick={wiz.next} className="gap-1.5">
          Continue to spec card &amp; test plan <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  STEP 8 — Spec Card & Test Plan (enhanced)                         */
/* ================================================================== */

export function Step9SpecCard({ wiz }: { wiz: Wiz }) {
  const selected = wiz.variants.variants.find((v) => v.tier === wiz.variants.selectedTier);
  const c = wiz.chemistry;
  const cost = wiz.economics.variantCosts[wiz.variants.selectedTier ?? "balanced"];
  const market = wiz.economics.variantMarket[wiz.variants.selectedTier ?? "balanced"];
  const baseline = wiz.oemBaseline;
  const scope = wiz.vehicleScope;
  const pinned = wiz.pinnedRecords;
  const ref = pinned[0];
  const tp = wiz.specCardData.testPlan;
  const r103 = wiz.specCardData.r103Scope;
  const { setSharedDesign, sharedDesign } = useSharedCatalyst();
  const [shared, setShared] = useState(false);

  const handleShareToPlatform = useCallback(() => {
    if (!selected) return;
    const design: SharedCatalystDesign = {
      source: "copilot",
      label: `${selected.label} — ${ref?.emissionStandard ?? scope.emissionStandard}`,
      sharedAt: new Date().toISOString(),
      substrateDiameterMm: selected.substrate.diameterMm,
      substrateLengthMm: selected.substrate.lengthMm,
      substrateVolumeL: selected.substrate.volumeL,
      cpsi: selected.substrate.cpsi,
      wallMil: selected.substrate.wallMil,
      substrateFamily: selected.substrate.material === "metallic" ? "metallic" : "cordierite",
      pdGPerL: selected.pgm.pdGPerL,
      rhGPerL: selected.pgm.rhGPerL,
      ptGPerL: selected.pgm.ptGPerL,
      totalPgmGPerL: selected.pgm.totalGPerL,
      pgmLoadingGPerFt3: selected.pgm.totalGPerFt3,
      oscGPerL: selected.oscTargetGPerL,
      cePercent: c.cePercent,
      washcoatTotalGPerL: c.totalWashcoatGPerL,
      agingTempC: wiz.agingParams.agingTempC,
      agingHours: wiz.agingParams.agingHours,
      agingFactor: selected.agingPrediction
        ? oscRetentionToAgingFactor(selected.agingPrediction.osc.retentionPct)
        : 0.92,
      agingPrediction: selected.agingPrediction ?? undefined,
      emissionStandard: ref?.emissionStandard ?? scope.emissionStandard,
      engineFamily: ref?.engineFamily ?? scope.engineSearch,
      oemPgmGPerL: baseline.totalPgmGPerL,
      oemOscGPerL: baseline.totalOscGPerL,
    };
    setSharedDesign(design);
    setShared(true);
    toast.success("Design shared to WLTP Simulation & Product Configuration", {
      description: "Open either tool — your catalyst design will be pre-loaded.",
    });
  }, [selected, c, wiz.agingParams, ref, scope, baseline, setSharedDesign]);

  const specText = useMemo(() => {
    if (!selected) return "";
    const lines = [
      "╔══════════════════════════════════════════════════╗",
      "║  BOSAL AM CATALYST SPECIFICATION                ║",
      "╠══════════════════════════════════════════════════╣",
      `  Part:           BSL-AM-${(ref?.engineFamily ?? "XXX").replace(/\s/g, "").slice(0, 8).toUpperCase()}-${selected.tier.charAt(0).toUpperCase()}`,
      `  Target engine:  ${ref?.engineFamily ?? scope.engineSearch} (${ref?.engineCodes ?? "—"})`,
      `  Emission std:   ${ref?.emissionStandard ?? scope.emissionStandard}`,
      `  OEM reference:  ${ref?.brand ?? scope.brand} — ${ref?.componentType ?? "CC-TWC"}`,
      `  Architecture:   ${scope.systemArchitecture}`,
      `  Database:       ${OEM_DB_MANIFEST.databaseVersion} (${OEM_DB_MANIFEST.sourceFile})`,
      "",
      "── SUBSTRATE ──────────────────────────────────────",
      `  Type:      ${selected.substrate.material}`,
      `  Diameter:  ${selected.substrate.diameterMm} mm`,
      `  Length:    ${selected.substrate.lengthMm} mm`,
      `  Volume:    ${selected.substrate.volumeL} L`,
      `  CPSI:      ${selected.substrate.cpsi}`,
      `  Wall:      ${selected.substrate.wallMil} mil`,
      "",
      "── WASHCOAT — Layer 1 (Inner) ─────────────────────",
      `  γ-Al₂O₃:       ${c.layer1.aluminaGPerL} g/L`,
      `  CeO₂-ZrO₂ OSC: ${c.layer1.oscGPerL} g/L (Ce ${c.layer1.oscCePercent}%)`,
      `  BaO:            ${c.layer1.baoGPerL} g/L`,
      `  La₂O₃:          ${c.layer1.la2o3GPerL} g/L`,
      `  Nd₂O₃:          ${c.layer1.nd2o3GPerL} g/L`,
      `  Layer total:    ${c.layer1.totalGPerL} g/L`,
      "",
      "── WASHCOAT — Layer 2 (Outer) ─────────────────────",
      `  γ-Al₂O₃:       ${c.layer2.aluminaGPerL} g/L`,
      `  CeO₂-ZrO₂ OSC: ${c.layer2.oscGPerL} g/L (Ce ${c.layer2.oscCePercent}%)`,
      `  La₂O₃:          ${c.layer2.la2o3GPerL} g/L`,
      `  Layer total:    ${c.layer2.totalGPerL} g/L`,
      "",
      `  Total washcoat: ${c.totalWashcoatGPerL} g/L`,
      `  OSC formulation: ${c.oscFormulation}`,
      "",
      "── PGM LOADING ────────────────────────────────────",
      `  Pd:  ${selected.pgm.pdGPerL} g/L  (${selected.pgm.pdGPerBrick} g/brick)`,
      `  Rh:  ${selected.pgm.rhGPerL} g/L  (${selected.pgm.rhGPerBrick} g/brick)`,
      `  Pt:  ${selected.pgm.ptGPerL} g/L  (${selected.pgm.ptGPerBrick} g/brick)`,
      `  Total: ${selected.pgm.totalGPerL} g/L (${selected.pgm.totalGPerFt3} g/ft³)`,
      `  Pd:Rh ratio: ${selected.pgm.pdRhRatio}:1`,
      "",
      "── AGING PREDICTION ───────────────────────────────",
      `  T50 CO (aged): ${selected.agingPrediction?.predictedT50CoC ?? "—"}°C`,
      `  T50 HC (aged): ${selected.agingPrediction?.predictedT50HcC ?? "—"}°C`,
      `  OSC retention: ${selected.agingPrediction?.osc.retentionPct ?? "—"}%`,
      `  Pd dispersion: ${selected.agingPrediction?.pgmPd.agedDispersionPct ?? "—"}%`,
      "",
      "── OBD COMPATIBILITY ──────────────────────────────",
      `  Risk:  ${selected.obdRisk}`,
      `  Note:  ${selected.obdNote}`,
      "",
      "── COST ESTIMATE ──────────────────────────────────",
      `  PGM/brick:   ${cost ? eur(cost.pgmCostPerBrick) : "—"}`,
      `  Substrate:   ${cost ? eur(cost.substrateCost) : "—"}`,
      `  Washcoat:    ${cost ? eur(cost.washcoatCost) : "—"}`,
      `  Canning:     ${cost ? eur(cost.canningCost) : "—"}`,
      `  Total BOM:   ${cost ? eur(cost.totalBom) : "—"}`,
      `  Target retail: ${cost ? eur(cost.targetRetail) : "—"}`,
      "",
      "── MARKET ─────────────────────────────────────────",
      `  EU volume:   ${market ? market.euAnnualVolume.toLocaleString() : "—"} units/yr`,
      `  AM units:    ${market ? market.amAnnualUnits.toLocaleString() : "—"} units/yr`,
      `  Revenue:     ${market ? eur(market.revenueEur) : "—"}/yr`,
      "",
      "── HOMOLOGATION ───────────────────────────────────",
      `  Test vehicle:  ${ref?.vehicleExamples ?? "TBD"} (lowest-emission variant)`,
      `  R103 scope:    ${ref?.engineFamily ?? scope.engineSearch} family`,
      `  Aging:         ${tp ? `${tp.sections[5]?.items?.[2] ?? "80,000 km bench equivalent"}` : "80,000 km bench equivalent"}`,
      "╚══════════════════════════════════════════════════╝",
    ];
    return lines.join("\n");
  }, [selected, c, cost, market, ref, scope, tp]);

  const copySpec = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(specText);
      toast.success("Spec card copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  }, [specText]);

  const exportJson = useCallback(() => {
    if (!selected) return;
    const blob = new Blob(
      [JSON.stringify({
        variant: selected,
        chemistry: c,
        cost,
        market,
        oemBaseline: baseline,
        scope,
        testPlan: tp,
        r103Scope: r103,
      }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bosal-am-spec-${selected.tier}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selected, c, cost, market, baseline, scope, tp, r103]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step 8 — Specification &amp; R103 test plan</CardTitle>
          <CardDescription>
            Final specification for {selected?.label ?? "—"}. Includes R103 test plan and engine family expansion.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="rounded-lg border bg-muted/30 p-4 text-xs font-mono overflow-auto max-h-[min(500px,55vh)] whitespace-pre">
            {specText}
          </pre>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="gap-1.5" onClick={() => void copySpec()}>
              <ClipboardCopy className="size-4" /> Copy to clipboard
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={exportJson}>
              <Download className="size-4" /> Export JSON
            </Button>
            <Button
              variant={shared ? "default" : "outline"}
              className="gap-1.5"
              onClick={handleShareToPlatform}
              disabled={!selected}
            >
              <Share2 className="size-4" />
              {shared ? "Design shared ✓" : "Share to WLTP & Products"}
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={wiz.resetWizard}>
              <RotateCcw className="size-4" /> Start new product
            </Button>
          </div>

          {(shared || sharedDesign?.source === "copilot") && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
              <p className="font-semibold text-primary">Design is live in the platform</p>
              <p className="text-muted-foreground">
                Navigate to <strong>WLTP Simulation</strong> or <strong>Product Configuration</strong> — your catalyst design ({selected?.label}) will be pre-loaded automatically.
              </p>
              <div className="flex gap-2 mt-2">
                <a href="/aftermarket/wltp" className="underline text-primary">Open WLTP Simulation →</a>
                <span className="text-muted-foreground">·</span>
                <a href="/aftermarket/products" className="underline text-primary">Open Product Configuration →</a>
              </div>
            </div>
          )}

          {tp && (
            <>
              <Separator />
              <h3 className="text-sm font-semibold">R103 Test Plan — {tp.title}</h3>
              <p className="text-xs text-muted-foreground">
                Ref: {tp.reference} · Est. {tp.estimatedDurationDays} days · Est. €{tp.estimatedCostEur.toLocaleString()}
              </p>
              <div className="space-y-3">
                {tp.sections.map((s) => (
                  <div key={s.number} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{s.number}. {s.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.content}</p>
                    {s.items && s.items.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground list-disc pl-4">
                        {s.items.filter(Boolean).map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {r103 && (
            <>
              <Separator />
              <h3 className="text-sm font-semibold">R103 Scope Optimization</h3>
              <p className="text-xs text-muted-foreground">
                Test vehicle: {r103.testVehicle.engineCode} — {r103.selectionReason}
              </p>
              <p className="text-xs text-muted-foreground">
                Min test vehicles: {r103.minTestVehicles}
              </p>
              {r103.memberRisks.length > 0 && (
                <div className="overflow-auto rounded-md border mt-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Engine</TableHead>
                        <TableHead className="text-right">Disp cc</TableHead>
                        <TableHead className="text-right">Power kW</TableHead>
                        <TableHead>Risk</TableHead>
                        <TableHead>Factors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {r103.memberRisks.map((mr) => (
                        <TableRow key={mr.member.engineCode}>
                          <TableCell className="font-medium">{mr.member.engineCode}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{mr.member.displacementCc}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{mr.member.powerKw}</TableCell>
                          <TableCell>
                            <Badge variant={mr.riskLevel === "LOW" ? "default" : mr.riskLevel === "MEDIUM" ? "secondary" : "destructive"} className="text-[10px]">
                              {mr.riskLevel}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                            {mr.riskFactors.length > 0 ? mr.riskFactors.join("; ") : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={wiz.prev} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back
        </Button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Shared: Info Card                                                 */
/* ================================================================== */

function InfoCard({ label, value, variant }: { label: string; value: string; variant?: "success" | "warning" | "danger" }) {
  const color = variant === "success" ? "text-green-600 dark:text-green-400"
    : variant === "warning" ? "text-amber-600 dark:text-amber-400"
    : variant === "danger" ? "text-red-600 dark:text-red-400"
    : "";
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}
