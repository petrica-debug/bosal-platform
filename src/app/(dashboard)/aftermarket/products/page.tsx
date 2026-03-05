"use client";

import { useState, useMemo } from "react";
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
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  Layers,
  Settings2,
  DollarSign,
  Box,
  Ruler,
  Scale,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Substrate Catalog Data ---
const DIAMETERS_MM = [93, 118, 143, 171, 229, 267, 305];
const LENGTH_RANGE = { min: 80, max: 300 };

type SubstrateFamily = "cordierite" | "sic" | "metallic";

interface SubstrateSpec {
  id: string;
  family: SubstrateFamily;
  cpsi: string;
  wall_mil: number;
  ofa: number;
  gsa: number;
  hydraulicDiam_mm: number;
}

const SUBSTRATE_CATALOG: SubstrateSpec[] = [
  { id: "cor-200-12", family: "cordierite", cpsi: "200/12", wall_mil: 12, ofa: 0.72, gsa: 1.82, hydraulicDiam_mm: 1.58 },
  { id: "cor-300-8", family: "cordierite", cpsi: "300/8", wall_mil: 8, ofa: 0.75, gsa: 2.42, hydraulicDiam_mm: 1.24 },
  { id: "cor-400-4", family: "cordierite", cpsi: "400/4", wall_mil: 4, ofa: 0.69, gsa: 2.74, hydraulicDiam_mm: 1.01 },
  { id: "cor-400-6", family: "cordierite", cpsi: "400/6", wall_mil: 6, ofa: 0.65, gsa: 2.52, hydraulicDiam_mm: 1.03 },
  { id: "cor-600-3", family: "cordierite", cpsi: "600/3", wall_mil: 3, ofa: 0.72, gsa: 3.18, hydraulicDiam_mm: 0.91 },
  { id: "cor-600-4", family: "cordierite", cpsi: "600/4", wall_mil: 4, ofa: 0.68, gsa: 3.02, hydraulicDiam_mm: 0.90 },
  { id: "sic-200-8", family: "sic", cpsi: "200/8", wall_mil: 8, ofa: 0.74, gsa: 1.95, hydraulicDiam_mm: 1.52 },
  { id: "sic-300-8", family: "sic", cpsi: "300/8", wall_mil: 8, ofa: 0.75, gsa: 2.40, hydraulicDiam_mm: 1.25 },
  { id: "met-200", family: "metallic", cpsi: "200", wall_mil: 0, ofa: 0.82, gsa: 2.05, hydraulicDiam_mm: 1.60 },
  { id: "met-400", family: "metallic", cpsi: "400", wall_mil: 0, ofa: 0.78, gsa: 2.82, hydraulicDiam_mm: 1.11 },
];

const CATALYST_TYPES = ["DOC", "DPF", "SCR", "ASC", "TWC"] as const;
type CatalystType = (typeof CATALYST_TYPES)[number];

// PGM prices USD/oz (approx)
const PGM_PRICES = { Pt: 980, Pd: 1050, Rh: 4500 };

interface BrickConfig {
  id: string;
  position: "close-coupled" | "underfloor";
  catalystType: CatalystType;
  substrateId: string;
  diameter_mm: number;
  length_mm: number;
  volume_L: number;
  weight_kg: number;
  pgmRatio: { pt: number; pd: number; rh: number };
  totalLoading_g_ft3: number;
  washcoat: { alumina: number; cezr: number; zeolite: number; binder: number };
  zoneCoating: { front: number; rear: number };
}

function computeVolume(diam_mm: number, len_mm: number): number {
  return (Math.PI * (diam_mm / 1000) ** 2 * (len_mm / 1000)) / 4;
}

function computeWeight(vol_L: number, family: SubstrateFamily): number {
  const density = family === "sic" ? 2.6 : family === "metallic" ? 2.8 : 2.3;
  return vol_L * density;
}

export default function ProductConfigPage() {
  const [bricks, setBricks] = useState<BrickConfig[]>([
    {
      id: "b1",
      position: "close-coupled",
      catalystType: "DOC",
      substrateId: "cor-400-4",
      diameter_mm: 143,
      length_mm: 120,
      volume_L: 0,
      weight_kg: 0,
      pgmRatio: { pt: 5, pd: 2, rh: 1 },
      totalLoading_g_ft3: 45,
      washcoat: { alumina: 120, cezr: 80, zeolite: 0, binder: 30 },
      zoneCoating: { front: 60, rear: 40 },
    },
    {
      id: "b2",
      position: "underfloor",
      catalystType: "SCR",
      substrateId: "cor-400-6",
      diameter_mm: 171,
      length_mm: 180,
      volume_L: 0,
      weight_kg: 0,
      pgmRatio: { pt: 0, pd: 0, rh: 0 },
      totalLoading_g_ft3: 0,
      washcoat: { alumina: 0, cezr: 0, zeolite: 180, binder: 25 },
      zoneCoating: { front: 50, rear: 50 },
    },
    {
      id: "b3",
      position: "underfloor",
      catalystType: "ASC",
      substrateId: "cor-400-4",
      diameter_mm: 171,
      length_mm: 100,
      volume_L: 0,
      weight_kg: 0,
      pgmRatio: { pt: 1, pd: 3, rh: 2 },
      totalLoading_g_ft3: 30,
      washcoat: { alumina: 100, cezr: 60, zeolite: 40, binder: 20 },
      zoneCoating: { front: 70, rear: 30 },
    },
  ]);

  // Compute derived brick values
  const bricksComputed = useMemo(() => {
    return bricks.map((b) => {
      const vol = computeVolume(b.diameter_mm, b.length_mm);
      const spec = SUBSTRATE_CATALOG.find((s) => s.id === b.substrateId);
      const fam = spec?.family ?? "cordierite";
      const w = computeWeight(vol, fam);
      return { ...b, volume_L: vol, weight_kg: w };
    });
  }, [bricks]);

  const totals = useMemo(() => {
    const vol = bricksComputed.reduce((s, b) => s + b.volume_L, 0);
    const len = bricksComputed.reduce((s, b) => s + b.length_mm, 0);
    const wt = bricksComputed.reduce((s, b) => s + b.weight_kg, 0);
    return { volume_L: vol, length_mm: len, weight_kg: wt };
  }, [bricksComputed]);

  const pgmCostEstimate = useMemo(() => {
    let total = 0;
    for (const b of bricksComputed) {
      const vol_ft3 = b.volume_L * 35.3147;
      const load_g = (b.totalLoading_g_ft3 * vol_ft3) / 1000;
      const sum = b.pgmRatio.pt + b.pgmRatio.pd + b.pgmRatio.rh;
      if (sum > 0) {
        const pt_g = (b.pgmRatio.pt / sum) * load_g;
        const pd_g = (b.pgmRatio.pd / sum) * load_g;
        const rh_g = (b.pgmRatio.rh / sum) * load_g;
        const pt_oz = pt_g / 31.1;
        const pd_oz = pd_g / 31.1;
        const rh_oz = rh_g / 31.1;
        total += pt_oz * PGM_PRICES.Pt + pd_oz * PGM_PRICES.Pd + rh_oz * PGM_PRICES.Rh;
      }
    }
    return total;
  }, [bricksComputed]);

  const updateBrick = (id: string, upd: Partial<BrickConfig>) => {
    setBricks((prev) => prev.map((b) => (b.id === id ? { ...b, ...upd } : b)));
  };

  const addBrick = () => {
    const nextId = `b${Date.now()}`;
    setBricks((prev) => [
      ...prev,
      {
        id: nextId,
        position: "underfloor",
        catalystType: "DOC",
        substrateId: "cor-400-4",
        diameter_mm: 143,
        length_mm: 120,
        volume_L: 0,
        weight_kg: 0,
        pgmRatio: { pt: 5, pd: 2, rh: 1 },
        totalLoading_g_ft3: 45,
        washcoat: { alumina: 120, cezr: 80, zeolite: 0, binder: 30 },
        zoneCoating: { front: 60, rear: 40 },
      },
    ]);
  };

  const removeBrick = (id: string) => {
    if (bricks.length <= 1) return;
    setBricks((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Product Configuration</h1>
        <p className="text-sm text-muted-foreground">
          BOSAL substrate catalog, multi-brick configs, PGM & washcoat loading, zone coating
        </p>
      </div>

      <Tabs defaultValue="catalog" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="catalog">Substrate Catalog</TabsTrigger>
          <TabsTrigger value="builder">Configuration Builder</TabsTrigger>
          <TabsTrigger value="pgm">PGM & Washcoat</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>BOSAL Substrate Catalog</CardTitle>
              <CardDescription>
                Cordierite, SiC (DPF), and metallic substrates with cpsi/wall, diameters Ø93–305 mm, lengths 80–300 mm
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Family</TableHead>
                      <TableHead>cpsi/wall</TableHead>
                      <TableHead>OFA %</TableHead>
                      <TableHead>GSA (m²/L)</TableHead>
                      <TableHead>Hydr. Ø (mm)</TableHead>
                      <TableHead>Diameters (mm)</TableHead>
                      <TableHead>Length (mm)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {SUBSTRATE_CATALOG.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              s.family === "cordierite" && "border-amber-600/50 text-amber-700 dark:text-amber-400",
                              s.family === "sic" && "border-slate-600/50 text-slate-700 dark:text-slate-300",
                              s.family === "metallic" && "border-sky-600/50 text-sky-700 dark:text-sky-400"
                            )}
                          >
                            {s.family}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">{s.cpsi}</TableCell>
                        <TableCell className="font-mono">{(s.ofa * 100).toFixed(1)}</TableCell>
                        <TableCell className="font-mono">{s.gsa.toFixed(2)}</TableCell>
                        <TableCell className="font-mono">{s.hydraulicDiam_mm.toFixed(2)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          Ø{DIAMETERS_MM.join(", ")}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {LENGTH_RANGE.min}–{LENGTH_RANGE.max}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="builder" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Multi-Brick Configuration Builder
              </CardTitle>
              <CardDescription>
                Close-coupled and underfloor positions. Assign catalyst type per brick. Drag to reorder or click to add.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {/* Visual schematic */}
                <div className="rounded-lg border-2 border-border bg-muted/30 p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    {bricksComputed
                      .filter((b) => b.position === "close-coupled")
                      .map((b) => (
                        <div
                          key={b.id}
                          className="group flex flex-col items-center gap-1"
                        >
                          <div
                            className="relative h-24 w-16 rounded-lg border-2 bg-gradient-to-b from-primary/20 to-primary/5 transition-all hover:border-bosal-red"
                            style={{
                              height: 60 + (b.length_mm / 300) * 80,
                              width: 24 + (b.diameter_mm / 305) * 32,
                            }}
                          >
                            <Badge
                              className="absolute -top-2 left-1/2 -translate-x-1/2 bg-bosal-red text-white text-xs"
                              variant="default"
                            >
                              {b.catalystType}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Ø{b.diameter_mm} × {b.length_mm}mm
                          </span>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            className="opacity-0 group-hover:opacity-100"
                            onClick={() => removeBrick(b.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    {bricksComputed.filter((b) => b.position === "close-coupled").length === 0 && (
                      <div className="rounded border border-dashed border-muted-foreground/40 px-4 py-6 text-center text-sm text-muted-foreground">
                        Close-coupled (none)
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Close-coupled</p>
                </div>

                <div className="flex flex-wrap items-end gap-3 rounded-lg border-2 border-border bg-muted/20 p-4">
                  {bricksComputed
                    .filter((b) => b.position === "underfloor")
                    .map((b) => (
                      <div key={b.id} className="group flex flex-col items-center gap-1">
                        <div
                          className="relative h-24 w-16 rounded-lg border-2 bg-gradient-to-b from-primary/20 to-primary/5 transition-all hover:border-bosal-red"
                          style={{
                            height: 60 + (b.length_mm / 300) * 80,
                            width: 24 + (b.diameter_mm / 305) * 32,
                          }}
                        >
                          <Badge
                            className="absolute -top-2 left-1/2 -translate-x-1/2 bg-bosal-red text-white text-xs"
                            variant="default"
                          >
                            {b.catalystType}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Ø{b.diameter_mm} × {b.length_mm}mm
                        </span>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100"
                          onClick={() => removeBrick(b.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  {bricksComputed.filter((b) => b.position === "underfloor").length === 0 && (
                    <div className="rounded border border-dashed border-muted-foreground/40 px-4 py-6 text-center text-sm text-muted-foreground">
                      Underfloor (none)
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">Underfloor</p>
                </div>

                <Button
                  onClick={addBrick}
                  className="w-fit bg-bosal-red hover:bg-bosal-red/90 text-white"
                >
                  <Plus className="h-4 w-4" />
                  Add brick
                </Button>

                {/* Brick editors */}
                <div className="space-y-4">
                  {bricksComputed.map((b) => (
                    <div key={b.id} className="flex flex-wrap gap-4 rounded-lg border p-4">
                      <div className="flex flex-col gap-2">
                        <Label>Position</Label>
                        <Select
                          value={b.position}
                          onValueChange={(v) => updateBrick(b.id, { position: v as "close-coupled" | "underfloor" })}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="close-coupled">Close-coupled</SelectItem>
                            <SelectItem value="underfloor">Underfloor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Catalyst</Label>
                        <Select
                          value={b.catalystType}
                          onValueChange={(v) => updateBrick(b.id, { catalystType: v as CatalystType })}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATALYST_TYPES.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Substrate</Label>
                        <Select
                          value={b.substrateId}
                          onValueChange={(v) => updateBrick(b.id, { substrateId: v })}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SUBSTRATE_CATALOG.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.cpsi}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Ø (mm)</Label>
                        <Select
                          value={String(b.diameter_mm)}
                          onValueChange={(v) => updateBrick(b.id, { diameter_mm: +v })}
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DIAMETERS_MM.map((d) => (
                              <SelectItem key={d} value={String(d)}>
                                Ø{d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Length (mm)</Label>
                        <Input
                          type="number"
                          value={b.length_mm}
                          min={80}
                          max={300}
                          onChange={(e) => updateBrick(b.id, { length_mm: +e.target.value })}
                          className="w-24"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="flex flex-wrap gap-6 rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center gap-2">
                    <Box className="h-5 w-5 text-bosal-red" />
                    <span className="font-mono font-semibold">{totals.volume_L.toFixed(2)} L</span>
                    <span className="text-muted-foreground">total volume</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Ruler className="h-5 w-5 text-bosal-red" />
                    <span className="font-mono font-semibold">{totals.length_mm} mm</span>
                    <span className="text-muted-foreground">total length</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-bosal-red" />
                    <span className="font-mono font-semibold">{totals.weight_kg.toFixed(1)} kg</span>
                    <span className="text-muted-foreground">weight est.</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pgm" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                PGM & Washcoat Loading
              </CardTitle>
              <CardDescription>
                Per-brick PGM ratio (Pt:Pd:Rh), total loading g/ft³, washcoat layers (alumina, CeZr, zeolite, binder), zone coating split
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {bricksComputed.map((b) => (
                  <div key={b.id} className="space-y-4 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-sm">
                        {b.catalystType} — Ø{b.diameter_mm} × {b.length_mm}mm
                      </Badge>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label className="mb-2 block">PGM ratio (Pt : Pd : Rh)</Label>
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <Label className="text-xs">Pt</Label>
                            <Slider
                              value={[b.pgmRatio.pt]}
                              max={10}
                              onValueChange={([v]) =>
                                updateBrick(b.id, { pgmRatio: { ...b.pgmRatio, pt: v } })
                              }
                            />
                            <span className="text-xs">{b.pgmRatio.pt}</span>
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs">Pd</Label>
                            <Slider
                              value={[b.pgmRatio.pd]}
                              max={10}
                              onValueChange={([v]) =>
                                updateBrick(b.id, { pgmRatio: { ...b.pgmRatio, pd: v } })
                              }
                            />
                            <span className="text-xs">{b.pgmRatio.pd}</span>
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs">Rh</Label>
                            <Slider
                              value={[b.pgmRatio.rh]}
                              max={10}
                              onValueChange={([v]) =>
                                updateBrick(b.id, { pgmRatio: { ...b.pgmRatio, rh: v } })
                              }
                            />
                            <span className="text-xs">{b.pgmRatio.rh}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label>Total loading (g/ft³)</Label>
                        <Input
                          type="number"
                          value={b.totalLoading_g_ft3}
                          min={0}
                          onChange={(e) =>
                            updateBrick(b.id, { totalLoading_g_ft3: +e.target.value })
                          }
                          className="mt-1 w-32"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="mb-2 block">Washcoat layers (g/L)</Label>
                      <div className="flex flex-wrap gap-4">
                        <div>
                          <Label className="text-xs">Alumina</Label>
                          <Input
                            type="number"
                            value={b.washcoat.alumina}
                            min={0}
                            onChange={(e) =>
                              updateBrick(b.id, {
                                washcoat: { ...b.washcoat, alumina: +e.target.value },
                              })
                            }
                            className="mt-0.5 w-20"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">CeZr</Label>
                          <Input
                            type="number"
                            value={b.washcoat.cezr}
                            min={0}
                            onChange={(e) =>
                              updateBrick(b.id, {
                                washcoat: { ...b.washcoat, cezr: +e.target.value },
                              })
                            }
                            className="mt-0.5 w-20"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Zeolite</Label>
                          <Input
                            type="number"
                            value={b.washcoat.zeolite}
                            min={0}
                            onChange={(e) =>
                              updateBrick(b.id, {
                                washcoat: { ...b.washcoat, zeolite: +e.target.value },
                              })
                            }
                            className="mt-0.5 w-20"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Binder</Label>
                          <Input
                            type="number"
                            value={b.washcoat.binder}
                            min={0}
                            onChange={(e) =>
                              updateBrick(b.id, {
                                washcoat: { ...b.washcoat, binder: +e.target.value },
                              })
                            }
                            className="mt-0.5 w-20"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="mb-2 block">Zone coating (front : rear %)</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[b.zoneCoating.front]}
                          max={100}
                          onValueChange={([v]) =>
                            updateBrick(b.id, {
                              zoneCoating: { front: v, rear: 100 - v },
                            })
                          }
                        />
                        <span className="text-sm font-mono">
                          {b.zoneCoating.front}% / {b.zoneCoating.rear}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex items-center gap-2 rounded-lg border-2 border-bosal-red/30 bg-bosal-red/5 p-4">
                  <DollarSign className="h-6 w-6 text-bosal-red" />
                  <div>
                    <p className="text-sm font-medium">PGM cost estimate</p>
                    <p className="text-2xl font-mono font-bold text-bosal-red">
                      ${pgmCostEstimate.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Based on Pt ${PGM_PRICES.Pt}/oz, Pd ${PGM_PRICES.Pd}/oz, Rh ${PGM_PRICES.Rh}/oz
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
