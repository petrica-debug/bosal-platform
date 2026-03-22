"use client";

import { useCallback, useMemo, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Database,
  Filter,
  Layers,
  Search,
  Sparkles,
  Target,
  TrendingDown,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell,
} from "recharts";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  EU_VEHICLES,
  EU_COMPOSITIONS,
  EU_AM_PROPOSALS,
  EU_PGM_ECONOMICS,
  EU_OEM_GROUPS,
  EU_BRANDS,
  EU_SEGMENTS,
  EU_FUELS,
  EU_STANDARDS,
  EU_COMPONENT_TYPES,
  EU_ARCHITECTURES,
  type EuVehicle,
  type EuComposition,
  type EuAmProposal,
} from "@/lib/catsizer/eu-vehicle-db";

// ============================================================
// EXHAUST SYSTEM DIAGRAM
// ============================================================

const ARCH_COLORS: Record<string, string> = {
  "CC TWC":    "#3b82f6",
  "UF TWC":    "#8b5cf6",
  "Coated GPF":"#f59e0b",
  "Uncoated GPF":"#d4a017",
  "DOC":       "#ef4444",
  "DPF":       "#6b7280",
  "SDPF (SCR-on-DPF)": "#10b981",
  "SCR":       "#06b6d4",
  "ASC":       "#ec4899",
};

function ExhaustDiagram({ components }: { components: EuComposition[] }) {
  if (components.length === 0) return null;

  const sorted = [...components].sort((a, b) => {
    const order = ["CC", "CC metallic", "UF", "UF dose 1", "Behind CC", "Behind DOC", "Underfloor", "After SCR"];
    return order.indexOf(a.position) - order.indexOf(b.position);
  });

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {/* Engine */}
      <div className="shrink-0 flex flex-col items-center">
        <div className="w-12 h-10 rounded bg-slate-700 flex items-center justify-center text-[9px] text-white font-bold">ENG</div>
        <span className="text-[8px] text-muted-foreground mt-0.5">Engine</span>
      </div>
      <ChevronRight className="size-3 text-muted-foreground shrink-0" />

      {sorted.map((c, i) => {
        const color = ARCH_COLORS[c.component] ?? "#6b7280";
        const volStr = c.volL ? `${c.volL}L` : "";
        const pgmStr = c.totalPgmGPerL ? `${c.totalPgmGPerL} g/L` : "";
        return (
          <div key={i} className="flex items-center gap-1">
            <div className="shrink-0 flex flex-col items-center">
              <div
                className="rounded px-2 py-1.5 text-white text-[9px] font-semibold text-center min-w-[60px] leading-tight"
                style={{ backgroundColor: color }}
              >
                <div>{c.component}</div>
                {volStr && <div className="font-mono opacity-80">{volStr}</div>}
              </div>
              <div className="text-[8px] text-muted-foreground mt-0.5 text-center leading-tight">
                {c.position}
                {pgmStr && <div className="font-mono">{pgmStr}</div>}
                {c.substrate && <div>{c.substrate}</div>}
              </div>
            </div>
            {i < sorted.length - 1 && <ChevronRight className="size-3 text-muted-foreground shrink-0" />}
          </div>
        );
      })}

      <ChevronRight className="size-3 text-muted-foreground shrink-0" />
      <div className="shrink-0 flex flex-col items-center">
        <div className="w-12 h-10 rounded bg-slate-400 flex items-center justify-center text-[9px] text-white font-bold">TAIL</div>
        <span className="text-[8px] text-muted-foreground mt-0.5">Tailpipe</span>
      </div>
    </div>
  );
}

// ============================================================
// MOT/MOP BUILDER
// ============================================================

interface MopDefinition {
  mopName: string;
  motEngines: string[];
  amPd: number;
  amRh: number;
  amPt: number;
  amOsc: number;
  vehicles: EuAmProposal[];
}

function MotMopBuilder({ filteredAm }: { filteredAm: EuAmProposal[] }) {
  const [selectedEngines, setSelectedEngines] = useState<string[]>([]);
  const [mopName, setMopName] = useState("MOP-001");

  const engineGroups = useMemo(() => {
    const map = new Map<string, EuAmProposal[]>();
    for (const a of filteredAm) {
      const key = a.engine;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filteredAm]);

  const toggleEngine = useCallback((eng: string) => {
    setSelectedEngines((prev) =>
      prev.includes(eng) ? prev.filter((e) => e !== eng) : [...prev, eng]
    );
  }, []);

  const mop = useMemo((): MopDefinition | null => {
    if (selectedEngines.length === 0) return null;
    const vehicles = filteredAm.filter((a) => selectedEngines.includes(a.engine));
    if (vehicles.length === 0) return null;

    const maxPd = Math.max(...vehicles.map((v) => v.amPd));
    const maxRh = Math.max(...vehicles.map((v) => v.amRh));
    const maxPt = Math.max(...vehicles.map((v) => v.amPt));
    const maxOsc = Math.max(...vehicles.map((v) => v.amOsc ?? 0));

    return {
      mopName,
      motEngines: selectedEngines,
      amPd: +maxPd.toFixed(2),
      amRh: +maxRh.toFixed(2),
      amPt: +maxPt.toFixed(2),
      amOsc: +maxOsc.toFixed(1),
      vehicles,
    };
  }, [selectedEngines, filteredAm, mopName]);

  const totalSavings = mop
    ? mop.vehicles.reduce((a, v) => a + v.saveEurPerBrick * (v.oem ? 1 : 0), 0)
    : 0;
  const totalVehicles = mop ? mop.vehicles.length : 0;
  const avgPgmSave = mop && totalVehicles > 0
    ? mop.vehicles.reduce((a, v) => a + v.pgmSavePct, 0) / totalVehicles
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="space-y-1 flex-1">
          <Label className="text-xs">MOP Name</Label>
          <Input value={mopName} onChange={(e) => setMopName(e.target.value)} className="h-8 text-sm max-w-[200px]" />
        </div>
        <div className="text-xs text-muted-foreground">
          Select engine families below to define MOT coverage → the MOP formulation auto-sizes to the worst-case.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* MOT engine list */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">MOT — Engine Families ({engineGroups.length})</p>
          <div className="max-h-[400px] overflow-y-auto rounded border divide-y">
            {engineGroups.map(([eng, vehicles]) => {
              const isSelected = selectedEngines.includes(eng);
              const avgSave = vehicles.reduce((a, v) => a + v.pgmSavePct, 0) / vehicles.length;
              const worstObd = vehicles.some((v) => v.obdRisk === "HIGH") ? "HIGH" : vehicles.some((v) => v.obdRisk === "MED") ? "MED" : "LOW";
              return (
                <button
                  key={eng}
                  type="button"
                  onClick={() => toggleEngine(eng)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-muted/40 transition-colors ${isSelected ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{eng}</span>
                      <span className="text-muted-foreground ml-2">({vehicles.length} vehicles)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px]">-{avgSave.toFixed(0)}% PGM</span>
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 ${worstObd === "HIGH" ? "text-red-600 border-red-300" : worstObd === "MED" ? "text-amber-600 border-amber-300" : "text-green-600 border-green-300"}`}>
                        OBD {worstObd}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    {vehicles[0].oem} · {vehicles[0].emStd} · {vehicles[0].arch}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* MOP summary */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">MOP — AM Part Definition</p>
          {mop ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="size-4 text-primary" />
                  {mop.mopName}
                </CardTitle>
                <CardDescription>
                  Covers {mop.motEngines.length} engine famil{mop.motEngines.length !== 1 ? "ies" : "y"} · {totalVehicles} vehicle applications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded border p-2">
                    <p className="text-[10px] text-muted-foreground">AM Formulation (worst-case)</p>
                    <p className="font-mono font-semibold">Pd {mop.amPd} · Rh {mop.amRh} · Pt {mop.amPt} g/L</p>
                    <p className="font-mono text-xs text-muted-foreground">OSC {mop.amOsc} g/L</p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-[10px] text-muted-foreground">Economics</p>
                    <p className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">-{avgPgmSave.toFixed(1)}% PGM avg</p>
                    <p className="font-mono text-xs">€{totalSavings.toFixed(0)} total savings</p>
                  </div>
                </div>

                <Separator />
                <p className="text-xs font-medium">Covered MOTs</p>
                <div className="max-h-[200px] overflow-y-auto text-xs space-y-1">
                  {mop.vehicles.map((v, i) => (
                    <div key={i} className="flex items-center justify-between py-0.5">
                      <span className="truncate max-w-[200px]">{v.vehicle}</span>
                      <span className="font-mono text-muted-foreground">
                        OE {v.oePgm} → AM {v.amPgm} g/L
                        <span className="ml-1 text-emerald-600">(-{v.pgmSavePct}%)</span>
                      </span>
                    </div>
                  ))}
                </div>

                <Separator />
                <p className="text-xs font-medium">AM Dispersion Advantage</p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    Target: <span className="font-medium text-foreground">higher PGM dispersion</span> than OE
                    to achieve equivalent or better fresh-state activity at lower PGM loading.
                  </p>
                  <p>
                    OE typical Pd dispersion: 25–35% (sintered after 1050°C/12h).
                    AM target: 40–55% fresh (impregnation optimization + La₂O₃ stabiliser).
                  </p>
                  <p>
                    At {mop.amPd} g/L Pd with 45% dispersion → effective active surface ≈
                    {" "}{(mop.amPd * 0.45 * 4.46).toFixed(1)} m²/L Pd
                    vs OE {(mop.vehicles[0]?.oePd * 0.30 * 4.46).toFixed(1)} m²/L at 30%.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Select engine families on the left to build a MOP definition.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function OeDatabasePage() {
  // Slicers
  const [oemGroup, setOemGroup] = useState("all");
  const [brand, setBrand] = useState("all");
  const [segment, setSegment] = useState("all");
  const [fuel, setFuel] = useState("all");
  const [emStd, setEmStd] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);

  // Filtered vehicles
  const filtered = useMemo(() => {
    return EU_VEHICLES.filter((v) => {
      if (oemGroup !== "all" && v.oemGroup !== oemGroup) return false;
      if (brand !== "all" && v.brand !== brand) return false;
      if (segment !== "all" && v.segment !== segment) return false;
      if (fuel !== "all" && v.fuel !== fuel) return false;
      if (emStd !== "all" && v.emStd !== emStd) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          v.vehicle.toLowerCase().includes(q) ||
          v.engineFamily.toLowerCase().includes(q) ||
          v.brand.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [oemGroup, brand, segment, fuel, emStd, search]);

  // Filtered AM proposals (same filters)
  const filteredAm = useMemo(() => {
    return EU_AM_PROPOSALS.filter((a) => {
      if (oemGroup !== "all" && a.oem !== oemGroup) return false;
      if (fuel !== "all" && a.fuel !== fuel) return false;
      if (emStd !== "all" && a.emStd !== emStd) return false;
      if (segment !== "all" && a.segment !== segment) return false;
      if (search) {
        const q = search.toLowerCase();
        return a.vehicle.toLowerCase().includes(q) || a.engine.toLowerCase().includes(q);
      }
      return true;
    });
  }, [oemGroup, fuel, emStd, segment, search]);

  // Selected vehicle detail
  const selectedVehicle = selectedVehicleId !== null
    ? EU_VEHICLES.find((v) => v.id === selectedVehicleId) ?? null
    : null;

  const selectedComps = useMemo(() => {
    if (!selectedVehicle) return [];
    return EU_COMPOSITIONS.filter(
      (c) => c.vehicle === selectedVehicle.vehicle || c.engineFamily === selectedVehicle.engineFamily
    );
  }, [selectedVehicle]);

  const selectedAm = useMemo(() => {
    if (!selectedVehicle) return null;
    return EU_AM_PROPOSALS.find((a) => a.vehicle === selectedVehicle.vehicle) ?? null;
  }, [selectedVehicle]);

  const selectedEcon = useMemo(() => {
    if (!selectedVehicle) return null;
    return EU_PGM_ECONOMICS.find((e) => e.vehicle === selectedVehicle.vehicle) ?? null;
  }, [selectedVehicle]);

  // Chart data: PGM by OEM group
  const pgmByOem = useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>();
    for (const v of filtered) {
      const key = v.oemGroup;
      const entry = map.get(key) ?? { sum: 0, count: 0 };
      entry.sum += v.totalPgmGPerL;
      entry.count += 1;
      map.set(key, entry);
    }
    return [...map.entries()]
      .map(([name, { sum, count }]) => ({ name, avgPgm: +(sum / count).toFixed(2), count }))
      .sort((a, b) => b.avgPgm - a.avgPgm);
  }, [filtered]);

  // Scatter data: PGM vs T50
  const scatterData = useMemo(() => {
    return filtered
      .filter((v) => v.t50Co && v.totalPgmGPerL > 0)
      .map((v) => ({
        pgm: v.totalPgmGPerL,
        t50: v.t50Co!,
        name: v.vehicle,
        brand: v.brand,
      }));
  }, [filtered]);

  const clearFilters = () => {
    setOemGroup("all"); setBrand("all"); setSegment("all");
    setFuel("all"); setEmStd("all"); setSearch("");
  };

  const hasFilters = oemGroup !== "all" || brand !== "all" || segment !== "all" || fuel !== "all" || emStd !== "all" || search !== "";

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">OE Catalyst Database</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              EU 2015–2024 · {EU_VEHICLES.length} vehicles · {EU_COMPOSITIONS.length} catalyst compositions · {EU_OEM_GROUPS.length} OEM groups
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs">
          {filtered.length} / {EU_VEHICLES.length} vehicles
        </Badge>
      </div>

      {/* Slicers */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px]">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input className="pl-8 h-8 text-xs" placeholder="Vehicle, engine, brand…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            {[
              { label: "OEM Group", value: oemGroup, setter: setOemGroup, options: EU_OEM_GROUPS },
              { label: "Brand", value: brand, setter: setBrand, options: EU_BRANDS },
              { label: "Segment", value: segment, setter: setSegment, options: EU_SEGMENTS },
              { label: "Fuel", value: fuel, setter: setFuel, options: EU_FUELS },
              { label: "Standard", value: emStd, setter: setEmStd, options: EU_STANDARDS },
            ].map(({ label, value, setter, options }) => (
              <div key={label} className="w-[130px]">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Select value={value} onValueChange={setter}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={clearFilters}>
                <X className="size-3" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main content tabs */}
      <Tabs defaultValue="vehicles">
        <TabsList>
          <TabsTrigger value="vehicles" className="gap-1.5">
            <Layers className="size-3.5" /> Vehicles ({filtered.length})
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5">
            <BarChart3 className="size-3.5" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="mot-mop" className="gap-1.5">
            <Target className="size-3.5" /> MOT / MOP Builder
          </TabsTrigger>
          <TabsTrigger value="am-proposals" className="gap-1.5">
            <TrendingDown className="size-3.5" /> AM Proposals ({filteredAm.length})
          </TabsTrigger>
        </TabsList>

        {/* ── VEHICLES TAB ── */}
        <TabsContent value="vehicles" className="mt-4 space-y-4">
          <div className="flex gap-4">
            {/* Vehicle table */}
            <div className={`flex-1 ${selectedVehicle ? "max-w-[55%]" : ""}`}>
              <div className="max-h-[600px] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="text-xs">Vehicle</TableHead>
                      <TableHead className="text-xs">OEM</TableHead>
                      <TableHead className="text-xs">Engine</TableHead>
                      <TableHead className="text-xs">Std</TableHead>
                      <TableHead className="text-xs text-right">PGM g/L</TableHead>
                      <TableHead className="text-xs text-right">T50 CO</TableHead>
                      <TableHead className="text-xs text-right">AM Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.slice(0, 100).map((v) => (
                      <TableRow
                        key={v.id}
                        className={`cursor-pointer hover:bg-muted/40 ${selectedVehicleId === v.id ? "bg-primary/5" : ""}`}
                        onClick={() => setSelectedVehicleId(v.id === selectedVehicleId ? null : v.id)}
                      >
                        <TableCell className="text-xs font-medium max-w-[180px] truncate">{v.vehicle}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{v.brand}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">{v.engineFamily}</TableCell>
                        <TableCell className="text-xs">{v.emStd}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{v.totalPgmGPerL}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{v.t50Co ?? "—"}</TableCell>
                        <TableCell className="text-xs text-right">
                          {v.amScore && (
                            <Badge variant={v.amScore >= 4 ? "default" : v.amScore >= 3 ? "secondary" : "outline"} className="text-[10px] px-1 py-0">
                              {v.amScore}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filtered.length > 100 && (
                <p className="text-xs text-muted-foreground mt-2">Showing first 100 of {filtered.length} results. Use filters to narrow down.</p>
              )}
            </div>

            {/* Vehicle detail panel */}
            {selectedVehicle && (
              <div className="w-[45%] space-y-4 max-h-[600px] overflow-y-auto">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{selectedVehicle.vehicle}</CardTitle>
                    <CardDescription>
                      {selectedVehicle.brand} · {selectedVehicle.oemGroup} · {selectedVehicle.segment} · {selectedVehicle.years}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <span className="text-muted-foreground">Engine</span>
                      <span className="font-medium">{selectedVehicle.engineFamily}</span>
                      <span className="text-muted-foreground">Fuel</span>
                      <span>{selectedVehicle.fuel}</span>
                      <span className="text-muted-foreground">Emission Std</span>
                      <span>{selectedVehicle.emStd}</span>
                      <span className="text-muted-foreground">CC Volume</span>
                      <span className="font-mono">{selectedVehicle.ccVolL ?? "—"} L</span>
                      <span className="text-muted-foreground">Substrate</span>
                      <span className="font-mono">⌀{selectedVehicle.diameterMm}×{selectedVehicle.lengthMm} mm · {selectedVehicle.cpsi} CPSI</span>
                      <span className="text-muted-foreground">PGM</span>
                      <span className="font-mono font-semibold">
                        Pd {selectedVehicle.pdGPerL} · Rh {selectedVehicle.rhGPerL} · Pt {selectedVehicle.ptGPerL} g/L
                        <span className="ml-1 opacity-70">(∑ {selectedVehicle.totalPgmGPerL})</span>
                      </span>
                      <span className="text-muted-foreground">OSC / WC</span>
                      <span className="font-mono">{selectedVehicle.oscGPerL ?? "—"} / {selectedVehicle.wcGPerL ?? "—"} g/L</span>
                      <span className="text-muted-foreground">T50 CO / HC / NOx</span>
                      <span className="font-mono">{selectedVehicle.t50Co ?? "—"} / {selectedVehicle.t50Hc ?? "—"} / {selectedVehicle.t50Nox ?? "—"} °C</span>
                      <span className="text-muted-foreground">OBD Sensitivity</span>
                      <span>{selectedVehicle.obdSense ?? "—"}</span>
                      <span className="text-muted-foreground">EU Volume (est)</span>
                      <span className="font-mono">{selectedVehicle.euVol?.toLocaleString() ?? "—"}</span>
                      {selectedVehicle.gpf && <><span className="text-muted-foreground">GPF</span><span>{selectedVehicle.gpf}</span></>}
                      {selectedVehicle.ufTwc && <><span className="text-muted-foreground">UF-TWC</span><span>{selectedVehicle.ufTwc}</span></>}
                    </div>
                  </CardContent>
                </Card>

                {/* Exhaust system diagram */}
                {selectedComps.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Layers className="size-4" /> Exhaust System Architecture
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ExhaustDiagram components={selectedComps} />
                      <Separator className="my-3" />
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px]">Component</TableHead>
                            <TableHead className="text-[10px]">Position</TableHead>
                            <TableHead className="text-[10px]">Substrate</TableHead>
                            <TableHead className="text-[10px] text-right">Vol (L)</TableHead>
                            <TableHead className="text-[10px] text-right">PGM g/L</TableHead>
                            <TableHead className="text-[10px]">L1 PGM</TableHead>
                            <TableHead className="text-[10px]">L2 PGM</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedComps.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell className="text-[10px] font-medium">{c.component}</TableCell>
                              <TableCell className="text-[10px]">{c.position}</TableCell>
                              <TableCell className="text-[10px]">{c.substrate} {c.cpsi} CPSI</TableCell>
                              <TableCell className="text-[10px] text-right font-mono">{c.volL ?? "—"}</TableCell>
                              <TableCell className="text-[10px] text-right font-mono">{c.totalPgmGPerL ?? "—"}</TableCell>
                              <TableCell className="text-[10px] font-mono">{c.l1Pgm ?? "—"}</TableCell>
                              <TableCell className="text-[10px] font-mono">{c.l2Pgm ?? "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {/* AM proposal */}
                {selectedAm && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="size-4 text-primary" /> AM Proposal
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded border p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">OE PGM</p>
                          <p className="font-mono font-semibold">{selectedAm.oePgm} g/L</p>
                        </div>
                        <div className="rounded border p-2 text-center bg-primary/5">
                          <p className="text-[10px] text-muted-foreground">AM PGM</p>
                          <p className="font-mono font-semibold text-primary">{selectedAm.amPgm} g/L</p>
                        </div>
                        <div className="rounded border p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">Saving</p>
                          <p className="font-mono font-semibold text-emerald-600">-{selectedAm.pgmSavePct}%</p>
                          <p className="font-mono text-[10px]">€{selectedAm.saveEurPerBrick}/brick</p>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <span className="text-muted-foreground">AM Pd / Rh / Pt</span>
                        <span className="font-mono">{selectedAm.amPd} / {selectedAm.amRh} / {selectedAm.amPt} g/L</span>
                        <span className="text-muted-foreground">AM OSC / WC</span>
                        <span className="font-mono">{selectedAm.amOsc ?? "—"} / {selectedAm.amWc ?? "—"} g/L</span>
                        <span className="text-muted-foreground">Architecture</span>
                        <span>{selectedAm.arch}</span>
                        <span className="text-muted-foreground">OBD Risk</span>
                        <Badge variant="outline" className={`w-fit text-[10px] px-1 py-0 ${selectedAm.obdRisk === "HIGH" ? "text-red-600 border-red-300" : selectedAm.obdRisk === "MED" ? "text-amber-600 border-amber-300" : "text-green-600 border-green-300"}`}>
                          {selectedAm.obdRisk}
                        </Badge>
                        <span className="text-muted-foreground">Derate factor</span>
                        <span className="font-mono">{selectedAm.derate ?? "—"}</span>
                      </div>
                      {selectedAm.notes && (
                        <p className="text-xs text-muted-foreground mt-2 italic">{selectedAm.notes}</p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Economics */}
                {selectedEcon && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">PGM Economics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <span className="text-muted-foreground">PGM/brick</span>
                        <span className="font-mono">{selectedEcon.pgmPerBrickG} g</span>
                        <span className="text-muted-foreground">OE cost</span>
                        <span className="font-mono">€{selectedEcon.oeCostEur}</span>
                        <span className="text-muted-foreground">OE @ Pd+30%</span>
                        <span className="font-mono">€{selectedEcon.oePd30Eur}</span>
                        <span className="text-muted-foreground">OE @ Rh+50%</span>
                        <span className="font-mono">€{selectedEcon.oeRh50Eur}</span>
                        <span className="text-muted-foreground">AM cost</span>
                        <span className="font-mono font-semibold text-emerald-600">€{selectedEcon.amCostEur}</span>
                        <span className="text-muted-foreground">Saving</span>
                        <span className="font-mono">€{selectedEcon.saveEur} ({selectedEcon.savePct}%)</span>
                        <span className="text-muted-foreground">Fleet volume</span>
                        <span className="font-mono">{selectedEcon.fleetVol?.toLocaleString()}</span>
                        <span className="text-muted-foreground">Fleet savings</span>
                        <span className="font-mono font-semibold text-emerald-600">€{selectedEcon.fleetSaveKEur}k</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── ANALYTICS TAB ── */}
        <TabsContent value="analytics" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* PGM by OEM */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Average PGM Loading by OEM Group</CardTitle>
                <CardDescription className="text-xs">{filtered.length} vehicles in current filter</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pgmByOem} layout="vertical" margin={{ left: 80, right: 16, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" tick={{ fontSize: 10 }} label={{ value: "Avg PGM (g/L)", position: "insideBottom", offset: -4, fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={75} />
                      <RechartTooltip formatter={(v: number) => `${v} g/L`} labelFormatter={(l: string) => l} />
                      <Bar dataKey="avgPgm" fill="#C8102E" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* PGM vs T50 scatter */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">PGM Loading vs T50 CO</CardTitle>
                <CardDescription className="text-xs">Higher PGM → lower T50 (better light-off)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ left: 4, right: 16, top: 4, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" dataKey="pgm" name="PGM" tick={{ fontSize: 10 }} label={{ value: "Total PGM (g/L)", position: "insideBottom", offset: -12, fontSize: 10 }} />
                      <YAxis type="number" dataKey="t50" name="T50 CO" tick={{ fontSize: 10 }} label={{ value: "T50 CO (°C)", angle: -90, position: "insideLeft", fontSize: 10 }} />
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <RechartTooltip
                        content={(props: any) => {
                          const payload = props?.payload;
                          if (!payload?.[0]) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="rounded border bg-background p-2 text-xs shadow-md">
                              <p className="font-medium">{d.name}</p>
                              <p className="text-muted-foreground">{d.brand}</p>
                              <p className="font-mono">PGM: {d.pgm} g/L · T50: {d.t50}°C</p>
                            </div>
                          );
                        }}
                      />
                      <Scatter data={scatterData} fill="#3b82f6" fillOpacity={0.6} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Avg PGM", value: `${(filtered.reduce((a, v) => a + v.totalPgmGPerL, 0) / filtered.length).toFixed(2)} g/L` },
              { label: "Avg T50 CO", value: `${Math.round(filtered.filter(v => v.t50Co).reduce((a, v) => a + (v.t50Co ?? 0), 0) / filtered.filter(v => v.t50Co).length)}°C` },
              { label: "Avg OSC", value: `${Math.round(filtered.filter(v => v.oscGPerL).reduce((a, v) => a + (v.oscGPerL ?? 0), 0) / filtered.filter(v => v.oscGPerL).length)} g/L` },
              { label: "Avg EU Vol", value: `${Math.round(filtered.filter(v => v.euVol).reduce((a, v) => a + (v.euVol ?? 0), 0) / filtered.filter(v => v.euVol).length / 1000)}k` },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="pt-4 pb-3 text-center">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-lg font-mono font-bold">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── MOT/MOP BUILDER TAB ── */}
        <TabsContent value="mot-mop" className="mt-4">
          <MotMopBuilder filteredAm={filteredAm} />
        </TabsContent>

        {/* ── AM PROPOSALS TAB ── */}
        <TabsContent value="am-proposals" className="mt-4">
          <div className="max-h-[600px] overflow-auto rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="text-xs">Vehicle</TableHead>
                  <TableHead className="text-xs">Engine</TableHead>
                  <TableHead className="text-xs">Std</TableHead>
                  <TableHead className="text-xs">Arch</TableHead>
                  <TableHead className="text-xs text-right">OE PGM</TableHead>
                  <TableHead className="text-xs text-right">AM PGM</TableHead>
                  <TableHead className="text-xs text-right">Save %</TableHead>
                  <TableHead className="text-xs text-right">€/brick</TableHead>
                  <TableHead className="text-xs text-center">OBD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAm.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs max-w-[180px] truncate">{a.vehicle}</TableCell>
                    <TableCell className="text-xs max-w-[140px] truncate text-muted-foreground">{a.engine}</TableCell>
                    <TableCell className="text-xs">{a.emStd}</TableCell>
                    <TableCell className="text-xs">{a.arch}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{a.oePgm}</TableCell>
                    <TableCell className="text-xs text-right font-mono text-primary font-semibold">{a.amPgm}</TableCell>
                    <TableCell className="text-xs text-right font-mono text-emerald-600">-{a.pgmSavePct}%</TableCell>
                    <TableCell className="text-xs text-right font-mono">€{a.saveEurPerBrick}</TableCell>
                    <TableCell className="text-xs text-center">
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 ${a.obdRisk === "HIGH" ? "text-red-600 border-red-300" : a.obdRisk === "MED" ? "text-amber-600 border-amber-300" : "text-green-600 border-green-300"}`}>
                        {a.obdRisk}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
