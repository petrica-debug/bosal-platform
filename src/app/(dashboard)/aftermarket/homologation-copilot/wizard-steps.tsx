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
  ECS_COMPONENTS,
  OEM_DB_MANIFEST,
  uniqueBrands,
  uniqueEmissionStandards,
} from "@/lib/catsizer/oem-database";
import type { EcsFilteredRow } from "@/lib/catsizer/oem-database/search";

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

/* ================================================================== */
/*  STEP 1 — Vehicle & Scope                                         */
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
          Define the target application. The database will auto-filter to matching OEM references.
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
        <Button onClick={wiz.generateAmVariants} disabled={wiz.oemRef.pinnedIndices.length === 0} className="gap-1.5">
          Generate AM variants <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  STEP 3 — AM Design Variants                                      */
/* ================================================================== */

function VariantCard({ v, selected, onSelect }: { v: AmVariant; selected: boolean; onSelect: () => void }) {
  const riskColor = v.obdRisk === "LOW" ? "text-green-600 dark:text-green-400" : v.obdRisk === "MEDIUM" ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
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
          <span className="text-muted-foreground">PGM derating</span>
          <span className="font-mono text-xs">{v.pgmDeratingFactor[0]}–{v.pgmDeratingFactor[1]}</span>
          <span className="text-muted-foreground">OSC derating</span>
          <span className="font-mono text-xs">{v.oscDeratingFactor[0]}–{v.oscDeratingFactor[1]}</span>
        </div>
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

export function Step3Variants({ wiz }: { wiz: Wiz }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step 3 — AM design variants</CardTitle>
          <CardDescription>
            Three variants generated from OEM baseline ({wiz.oemBaseline.totalPgmGPerL.toFixed(2)} g/L PGM, {wiz.oemBaseline.totalOscGPerL.toFixed(1)} g/L OSC). Select one to proceed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="secondary"
            className="gap-1.5"
            onClick={() => void wiz.requestVariantCommentary()}
            disabled={wiz.variants.aiLoading}
          >
            {wiz.variants.aiLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Get AI engineering commentary
          </Button>

          <div className="grid gap-4 md:grid-cols-3">
            {wiz.variants.variants.map((v) => (
              <VariantCard
                key={v.tier}
                v={v}
                selected={wiz.variants.selectedTier === v.tier}
                onSelect={() => wiz.selectVariant(v.tier)}
              />
            ))}
          </div>
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
/*  STEP 4 — Chemistry & Washcoat                                    */
/* ================================================================== */

export function Step4Chemistry({ wiz }: { wiz: Wiz }) {
  const c = wiz.chemistry;
  const selected = wiz.variants.variants.find((v) => v.tier === wiz.variants.selectedTier);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step 4 — Chemistry &amp; washcoat</CardTitle>
          <CardDescription>
            Washcoat specification for {selected?.label ?? "selected variant"} (OSC ratio {selected?.oscRatio ?? "—"}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Layer 1 — Inner (substrate-side)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <Row label="γ-Al₂O₃" value={`${c.layer1.aluminaGPerL} g/L`} />
                <Row label="CeO₂-ZrO₂ OSC" value={`${c.layer1.oscGPerL} g/L (Ce ${c.layer1.oscCePercent}%)`} />
                <Row label="BaO" value={`${c.layer1.baoGPerL} g/L`} />
                <Row label="La₂O₃" value={`${c.layer1.la2o3GPerL} g/L`} />
                <Row label="Nd₂O₃" value={`${c.layer1.nd2o3GPerL} g/L`} />
                <Separator className="my-2" />
                <Row label="Layer total" value={`${c.layer1.totalGPerL} g/L`} bold />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Layer 2 — Outer (gas-side)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <Row label="γ-Al₂O₃" value={`${c.layer2.aluminaGPerL} g/L`} />
                <Row label="CeO₂-ZrO₂ OSC" value={`${c.layer2.oscGPerL} g/L (Ce ${c.layer2.oscCePercent}%)`} />
                <Row label="La₂O₃" value={`${c.layer2.la2o3GPerL} g/L`} />
                <Separator className="my-2" />
                <Row label="Layer total" value={`${c.layer2.totalGPerL} g/L`} bold />
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">Total washcoat:</span>
            <span className="font-semibold">{c.totalWashcoatGPerL} g/L</span>
            <span className="text-muted-foreground">OSC formulation:</span>
            <span className="font-mono text-xs">{c.oscFormulation}</span>
          </div>

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
        <Button onClick={() => wiz.proceedToEconomics()} className="gap-1.5">
          Continue to economics <ArrowRight className="size-4" />
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
/*  STEP 5 — Economics & Market                                       */
/* ================================================================== */

export function Step5Economics({ wiz }: { wiz: Wiz }) {
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
          <CardTitle className="text-lg">Step 5 — Economics &amp; market sizing</CardTitle>
          <CardDescription>
            Cost breakdown and revenue potential across all three variants. Adjust PGM spot prices and AM penetration rate.
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
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={wiz.prev} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Button onClick={wiz.next} className="gap-1.5">
          Continue to spec card <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  STEP 6 — Spec Card & Export                                       */
/* ================================================================== */

export function Step6SpecCard({ wiz }: { wiz: Wiz }) {
  const selected = wiz.variants.variants.find((v) => v.tier === wiz.variants.selectedTier);
  const c = wiz.chemistry;
  const cost = wiz.economics.variantCosts[wiz.variants.selectedTier ?? "balanced"];
  const market = wiz.economics.variantMarket[wiz.variants.selectedTier ?? "balanced"];
  const baseline = wiz.oemBaseline;
  const scope = wiz.vehicleScope;
  const pinned = wiz.pinnedRecords;
  const ref = pinned[0];

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
      "── PERFORMANCE TARGETS ────────────────────────────",
      `  OSC:       ${selected.oscTargetGPerL} g/L`,
      `  OSC ratio: ${selected.oscRatio} (AM/OEM fresh)`,
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
      `  Aging:         80,000 km bench equivalent`,
      "╚══════════════════════════════════════════════════╝",
    ];
    return lines.join("\n");
  }, [selected, c, cost, market, ref, scope, baseline]);

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
      [JSON.stringify({ variant: selected, chemistry: c, cost, market, oemBaseline: baseline, scope }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bosal-am-spec-${selected.tier}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selected, c, cost, market, baseline, scope]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step 6 — AM product specification card</CardTitle>
          <CardDescription>
            Final specification for {selected?.label ?? "—"}. Copy or export for PLM/ERP.
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
            <Button variant="outline" className="gap-1.5" onClick={wiz.resetWizard}>
              <RotateCcw className="size-4" /> Start new product
            </Button>
          </div>
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
