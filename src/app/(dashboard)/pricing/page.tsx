"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Download,
  TrendingUp,
  Percent,
  Calculator,
  Settings,
  Factory,
} from "lucide-react";
import {
  loadCostDB,
  calculateBrickCost,
  calculateSystemPricing,
  type SystemPricingResult,
} from "@/lib/pricing/cost-database";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ============================================================
// COST DATABASE
// ============================================================

const PGM_PRICES: Record<string, { price_usd_oz: number; label: string }> = {
  Pt: { price_usd_oz: 2148, label: "Platinum" },
  Pd: { price_usd_oz: 1671, label: "Palladium" },
  Rh: { price_usd_oz: 11350, label: "Rhodium" },
  Ir: { price_usd_oz: 4800, label: "Iridium" },
  Ru: { price_usd_oz: 650, label: "Ruthenium" },
};

const SUBSTRATE_COSTS: Record<string, { label: string; cost_eur: number; unit: string }> = {
  cord_400_4_143x130: { label: "Cordierite 400/4 Ø143×130", cost_eur: 18, unit: "pc" },
  cord_400_4_143x160: { label: "Cordierite 400/4 Ø143×160", cost_eur: 22, unit: "pc" },
  cord_400_4_229x200: { label: "Cordierite 400/4 Ø229×200", cost_eur: 38, unit: "pc" },
  cord_600_3_143x130: { label: "Cordierite 600/3 Ø143×130", cost_eur: 24, unit: "pc" },
  sic_200_8_143x160: { label: "SiC DPF 200/8 Ø143×160", cost_eur: 65, unit: "pc" },
  sic_200_8_229x200: { label: "SiC DPF 200/8 Ø229×200", cost_eur: 110, unit: "pc" },
  metal_200_143x80: { label: "Metallic 200cpsi Ø143×80", cost_eur: 35, unit: "pc" },
};

const WASHCOAT_COSTS: Record<string, { label: string; cost_eur_kg: number }> = {
  alumina: { label: "γ-Al₂O₃", cost_eur_kg: 12 },
  cezr: { label: "CeO₂-ZrO₂", cost_eur_kg: 45 },
  zeolite_cu: { label: "Cu-SSZ-13 Zeolite", cost_eur_kg: 85 },
  zeolite_fe: { label: "Fe-ZSM-5 Zeolite", cost_eur_kg: 65 },
  titania: { label: "TiO₂", cost_eur_kg: 8 },
  binder: { label: "Binder (ZrO₂ sol)", cost_eur_kg: 25 },
};

const CANNING_COSTS: Record<string, { label: string; cost_eur: number }> = {
  mat_interam: { label: "3M Interam mat", cost_eur: 8 },
  shell_ss409: { label: "SS409 shell", cost_eur: 25 },
  shell_ss441: { label: "SS441 shell", cost_eur: 35 },
  cone_inlet: { label: "Inlet cone", cost_eur: 12 },
  cone_outlet: { label: "Outlet cone", cost_eur: 12 },
  flange: { label: "V-band flange", cost_eur: 8 },
};

const UREA_COSTS: Record<string, { label: string; cost_eur: number }> = {
  injector_bosch: { label: "Bosch Denoxtronic 6.5 injector", cost_eur: 180 },
  pump_module: { label: "DEF pump module", cost_eur: 120 },
  tank_20l: { label: "DEF tank 20L", cost_eur: 45 },
  dcu: { label: "Dosing control unit", cost_eur: 250 },
  nox_sensor: { label: "NOx sensor (Continental)", cost_eur: 95 },
  temp_sensor: { label: "Exhaust temp sensor", cost_eur: 15 },
};

// ============================================================
// CONFIGURATION TYPE
// ============================================================

interface CatalystConfig {
  id: string;
  name: string;
  type: "DOC" | "DPF" | "SCR" | "ASC" | "TWC";
  substrate: string;
  volume_L: number;
  pgm_Pt_g_ft3: number;
  pgm_Pd_g_ft3: number;
  pgm_Rh_g_ft3: number;
  washcoat_type: string;
  washcoat_loading_g_L: number;
  canning: string[];
}

interface SystemConfig {
  id: string;
  name: string;
  catalysts: CatalystConfig[];
  ureaComponents: string[];
  margin_percent: number;
  currency: "EUR" | "USD" | "GBP";
}

const TROY_OZ_G = 31.1035;
const EUR_USD = 1.08;

function calcPGMCost(config: CatalystConfig): number {
  const vol_ft3 = config.volume_L / 28.3168;
  const ptMass = config.pgm_Pt_g_ft3 * vol_ft3;
  const pdMass = config.pgm_Pd_g_ft3 * vol_ft3;
  const rhMass = config.pgm_Rh_g_ft3 * vol_ft3;
  return (
    (ptMass / TROY_OZ_G) * PGM_PRICES.Pt.price_usd_oz +
    (pdMass / TROY_OZ_G) * PGM_PRICES.Pd.price_usd_oz +
    (rhMass / TROY_OZ_G) * PGM_PRICES.Rh.price_usd_oz
  ) / EUR_USD;
}

function calcSubstrateCost(config: CatalystConfig): number {
  return SUBSTRATE_COSTS[config.substrate]?.cost_eur ?? 25;
}

function calcWashcoatCost(config: CatalystConfig): number {
  const wc = WASHCOAT_COSTS[config.washcoat_type];
  if (!wc) return 0;
  const mass_kg = (config.washcoat_loading_g_L * config.volume_L) / 1000;
  return mass_kg * wc.cost_eur_kg;
}

function calcCanningCost(config: CatalystConfig): number {
  return config.canning.reduce((s, c) => s + (CANNING_COSTS[c]?.cost_eur ?? 0), 0);
}

function calcSystemCost(system: SystemConfig) {
  let totalSubstrate = 0;
  let totalPGM = 0;
  let totalWashcoat = 0;
  let totalCanning = 0;
  const perCatalyst: Array<{ name: string; type: string; substrate: number; pgm: number; washcoat: number; canning: number; total: number }> = [];

  for (const cat of system.catalysts) {
    const sub = calcSubstrateCost(cat);
    const pgm = calcPGMCost(cat);
    const wc = calcWashcoatCost(cat);
    const can = calcCanningCost(cat);
    totalSubstrate += sub;
    totalPGM += pgm;
    totalWashcoat += wc;
    totalCanning += can;
    perCatalyst.push({ name: cat.name, type: cat.type, substrate: sub, pgm, washcoat: wc, canning: can, total: sub + pgm + wc + can });
  }

  const totalUrea = system.ureaComponents.reduce((s, c) => s + (UREA_COSTS[c]?.cost_eur ?? 0), 0);
  const assembly = 35;
  const subtotal = totalSubstrate + totalPGM + totalWashcoat + totalCanning + totalUrea + assembly;
  const margin = subtotal * (system.margin_percent / 100);
  const quoted = subtotal + margin;

  return { totalSubstrate, totalPGM, totalWashcoat, totalCanning, totalUrea, assembly, subtotal, margin, quoted, perCatalyst };
}

// ============================================================
// DEFAULT CONFIGS
// ============================================================

const DEFAULT_CONFIGS: SystemConfig[] = [
  {
    id: "config-1",
    name: "Euro VI-E HD Diesel (DOC+DPF+SCR+ASC)",
    catalysts: [
      { id: "c1", name: "DOC", type: "DOC", substrate: "cord_400_4_143x130", volume_L: 2.1, pgm_Pt_g_ft3: 50, pgm_Pd_g_ft3: 70, pgm_Rh_g_ft3: 0, washcoat_type: "alumina", washcoat_loading_g_L: 160, canning: ["mat_interam", "shell_ss409", "cone_inlet"] },
      { id: "c2", name: "DPF", type: "DPF", substrate: "sic_200_8_143x160", volume_L: 2.6, pgm_Pt_g_ft3: 10, pgm_Pd_g_ft3: 0, pgm_Rh_g_ft3: 0, washcoat_type: "alumina", washcoat_loading_g_L: 30, canning: ["mat_interam", "shell_ss441"] },
      { id: "c3", name: "SCR", type: "SCR", substrate: "cord_400_4_229x200", volume_L: 8.2, pgm_Pt_g_ft3: 0, pgm_Pd_g_ft3: 0, pgm_Rh_g_ft3: 0, washcoat_type: "zeolite_cu", washcoat_loading_g_L: 200, canning: ["mat_interam", "shell_ss409", "cone_inlet", "cone_outlet"] },
      { id: "c4", name: "ASC", type: "ASC", substrate: "cord_400_4_143x130", volume_L: 1.8, pgm_Pt_g_ft3: 15, pgm_Pd_g_ft3: 0, pgm_Rh_g_ft3: 0, washcoat_type: "alumina", washcoat_loading_g_L: 80, canning: ["mat_interam", "shell_ss409", "cone_outlet", "flange"] },
    ],
    ureaComponents: ["injector_bosch", "pump_module", "tank_20l", "dcu", "nox_sensor", "nox_sensor", "temp_sensor", "temp_sensor"],
    margin_percent: 25,
    currency: "EUR",
  },
  {
    id: "config-2",
    name: "NG Genset TWC (TA Luft)",
    catalysts: [
      { id: "c5", name: "TWC", type: "TWC", substrate: "cord_600_3_143x130", volume_L: 3.5, pgm_Pt_g_ft3: 5, pgm_Pd_g_ft3: 60, pgm_Rh_g_ft3: 15, washcoat_type: "cezr", washcoat_loading_g_L: 180, canning: ["mat_interam", "shell_ss441", "cone_inlet", "cone_outlet", "flange", "flange"] },
    ],
    ureaComponents: [],
    margin_percent: 30,
    currency: "EUR",
  },
];

// ============================================================
// COMPONENT
// ============================================================

export default function PricingPage() {
  const [configs] = useState<SystemConfig[]>(DEFAULT_CONFIGS);
  const [selectedId, setSelectedId] = useState(configs[0].id);
  const [_pgmSlider, _setPgmSlider] = useState(0);
  const [_volumeSlider, _setVolumeSlider] = useState(0);

  const integratorPricing = useMemo<SystemPricingResult | null>(() => {
    const db = loadCostDB();
    const sel = configs.find((c) => c.id === selectedId) ?? configs[0];
    const brickCosts = sel.catalysts.map((cat) =>
      calculateBrickCost(db, {
        name: cat.name,
        type: cat.type,
        volume_L: cat.volume_L,
        diameter_mm: cat.type === "SCR" ? 229 : 143,
        length_mm: cat.type === "SCR" ? 200 : 130,
        substrateMaterial: cat.type === "DPF" ? "sic" : "cordierite",
        washcoatType: cat.washcoat_type,
        washcoatLoading_g_L: cat.washcoat_loading_g_L,
        pgm_Pt_g_ft3: cat.pgm_Pt_g_ft3,
        pgm_Pd_g_ft3: cat.pgm_Pd_g_ft3,
        pgm_Rh_g_ft3: cat.pgm_Rh_g_ft3,
        shellMaterial: "ss409",
        hasCones: true,
      })
    );
    const hasUrea = sel.ureaComponents.length > 0;
    return calculateSystemPricing(db, brickCosts, hasUrea, {
      hasMixer: true,
      mixerType: "swirl",
      tankSize: "20l",
    });
  }, [configs, selectedId]);

  const selected = configs.find((c) => c.id === selectedId) ?? configs[0];
  const cost = useMemo(() => calcSystemCost(selected), [selected]);

  const pgmSensitivity = useMemo(() => {
    const points: Array<{ pgmDelta: string; cost: number }> = [];
    for (let delta = -30; delta <= 30; delta += 10) {
      const factor = 1 + delta / 100;
      const origPGM = cost.totalPGM;
      const adjustedPGM = origPGM * factor;
      const adjustedSubtotal = cost.subtotal - origPGM + adjustedPGM;
      const adjustedQuoted = adjustedSubtotal * (1 + selected.margin_percent / 100);
      points.push({ pgmDelta: `${delta > 0 ? "+" : ""}${delta}%`, cost: adjustedQuoted });
    }
    return points;
  }, [cost, selected.margin_percent]);

  const comparisonData = useMemo(() => {
    return configs.map((cfg) => {
      const c = calcSystemCost(cfg);
      return {
        name: cfg.name.length > 30 ? cfg.name.slice(0, 30) + "..." : cfg.name,
        Substrate: c.totalSubstrate,
        PGM: c.totalPGM,
        Washcoat: c.totalWashcoat,
        Canning: c.totalCanning,
        Urea: c.totalUrea,
        Assembly: c.assembly,
        Quoted: c.quoted,
      };
    });
  }, [configs]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pricing Engine</h1>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#C8102E]/10 px-2.5 py-0.5 mt-1">
            <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C8102E] opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#C8102E]" /></span>
            <span className="text-[10px] font-medium tracking-wide text-[#C8102E]/80">AI Copilot — powered by BelgaLabs</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Component pricing, PGM cost tracking, margin analysis, and multi-config comparison
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" /> Export XLSX
          </Button>
          <Button className="bg-[#C8102E] hover:bg-[#A00D24]" size="sm">
            <Plus className="mr-2 h-4 w-4" /> New Config
          </Button>
        </div>
      </div>

      {/* PGM Market Prices */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#C8102E]" /> PGM Market Prices (March 2026)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            {Object.entries(PGM_PRICES).map(([metal, data]) => (
              <div key={metal} className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">{metal}</Badge>
                <span className="font-mono font-bold">${data.price_usd_oz.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">/troy oz</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Config Selector */}
      <div className="flex items-center gap-4">
        <Label>Configuration</Label>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="w-96">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {configs.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline">{selected.currency}</Badge>
        <Badge variant="outline">Margin: {selected.margin_percent}%</Badge>
      </div>

      <Tabs defaultValue="breakdown">
        <TabsList>
          <TabsTrigger value="breakdown">Cost Breakdown</TabsTrigger>
          <TabsTrigger value="sensitivity">PGM Sensitivity</TabsTrigger>
          <TabsTrigger value="compare">Multi-Config Compare</TabsTrigger>
          <TabsTrigger value="costdb">Cost Database</TabsTrigger>
          <TabsTrigger value="integrator">Integrator Pricing</TabsTrigger>
        </TabsList>

        {/* ---- BREAKDOWN ---- */}
        <TabsContent value="breakdown" className="mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Summary KPIs */}
            <div className="md:col-span-1 space-y-3">
              {[
                { label: "Substrate", value: cost.totalSubstrate, color: "#3B82F6" },
                { label: "PGM", value: cost.totalPGM, color: "#F59E0B" },
                { label: "Washcoat", value: cost.totalWashcoat, color: "#10B981" },
                { label: "Canning", value: cost.totalCanning, color: "#8B5CF6" },
                { label: "Urea System", value: cost.totalUrea, color: "#EC4899" },
                { label: "Assembly", value: cost.assembly, color: "#6B7280" },
              ].map((item) => {
                const pct = cost.subtotal > 0 ? (item.value / cost.subtotal) * 100 : 0;
                return (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className="w-20 text-xs text-muted-foreground">{item.label}</span>
                    <div className="flex-1 h-4 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                    </div>
                    <span className="w-20 text-right font-mono text-xs">&euro;{item.value.toFixed(0)}</span>
                  </div>
                );
              })}
              <div className="border-t pt-2 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span className="font-mono">&euro;{cost.subtotal.toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Margin ({selected.margin_percent}%)</span>
                  <span className="font-mono">&euro;{cost.margin.toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Quoted Price</span>
                  <span className="font-mono text-[#C8102E]">&euro;{cost.quoted.toFixed(0)}</span>
                </div>
              </div>
            </div>

            {/* Per-catalyst table */}
            <div className="md:col-span-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Per-Element Cost</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Element</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Substrate</TableHead>
                          <TableHead>PGM</TableHead>
                          <TableHead>Washcoat</TableHead>
                          <TableHead>Canning</TableHead>
                          <TableHead className="font-bold">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cost.perCatalyst.map((cat) => (
                          <TableRow key={cat.name}>
                            <TableCell className="font-medium">{cat.name}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{cat.type}</Badge></TableCell>
                            <TableCell className="font-mono text-xs">&euro;{cat.substrate.toFixed(0)}</TableCell>
                            <TableCell className="font-mono text-xs">&euro;{cat.pgm.toFixed(0)}</TableCell>
                            <TableCell className="font-mono text-xs">&euro;{cat.washcoat.toFixed(0)}</TableCell>
                            <TableCell className="font-mono text-xs">&euro;{cat.canning.toFixed(0)}</TableCell>
                            <TableCell className="font-mono text-xs font-bold">&euro;{cat.total.toFixed(0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ---- SENSITIVITY ---- */}
        <TabsContent value="sensitivity" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Percent className="h-4 w-4" /> PGM Price Sensitivity
                </CardTitle>
                <CardDescription>Quoted price vs PGM market price change (±30%)</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={pgmSensitivity}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="pgmDelta" />
                    <YAxis tickFormatter={(v: number) => `€${v.toFixed(0)}`} />
                    <Tooltip formatter={(v: number) => `€${v.toFixed(0)}`} />
                    <Bar dataKey="cost" fill="#C8102E" radius={[4, 4, 0, 0]} name="Quoted Price" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">PGM Cost Share</CardTitle>
                <CardDescription>
                  PGM represents {cost.subtotal > 0 ? ((cost.totalPGM / cost.subtotal) * 100).toFixed(0) : 0}% of total cost
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {selected.catalysts.filter((c) => c.pgm_Pt_g_ft3 + c.pgm_Pd_g_ft3 + c.pgm_Rh_g_ft3 > 0).map((cat) => {
                    const pgm = calcPGMCost(cat);
                    const vol_ft3 = cat.volume_L / 28.3168;
                    return (
                      <div key={cat.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">{cat.type}</Badge>
                          <span className="font-mono font-bold">&euro;{pgm.toFixed(0)}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Pt</p>
                            <p className="font-mono">{cat.pgm_Pt_g_ft3} g/ft³ ({(cat.pgm_Pt_g_ft3 * vol_ft3).toFixed(2)}g)</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Pd</p>
                            <p className="font-mono">{cat.pgm_Pd_g_ft3} g/ft³ ({(cat.pgm_Pd_g_ft3 * vol_ft3).toFixed(2)}g)</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Rh</p>
                            <p className="font-mono">{cat.pgm_Rh_g_ft3} g/ft³ ({(cat.pgm_Rh_g_ft3 * vol_ft3).toFixed(2)}g)</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---- COMPARE ---- */}
        <TabsContent value="compare" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Multi-Configuration Comparison</CardTitle>
              <CardDescription>Side-by-side cost breakdown across all saved configurations</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v: number) => `€${v}`} />
                  <Tooltip formatter={(v: number) => `€${v.toFixed(0)}`} />
                  <Legend />
                  <Bar dataKey="Substrate" stackId="a" fill="#3B82F6" />
                  <Bar dataKey="PGM" stackId="a" fill="#F59E0B" />
                  <Bar dataKey="Washcoat" stackId="a" fill="#10B981" />
                  <Bar dataKey="Canning" stackId="a" fill="#8B5CF6" />
                  <Bar dataKey="Urea" stackId="a" fill="#EC4899" />
                  <Bar dataKey="Assembly" stackId="a" fill="#6B7280" />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-4 rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Configuration</TableHead>
                      <TableHead>Substrate</TableHead>
                      <TableHead>PGM</TableHead>
                      <TableHead>Washcoat</TableHead>
                      <TableHead>Canning</TableHead>
                      <TableHead>Urea</TableHead>
                      <TableHead className="font-bold">Quoted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonData.map((row) => (
                      <TableRow key={row.name}>
                        <TableCell className="font-medium text-xs">{row.name}</TableCell>
                        <TableCell className="font-mono text-xs">&euro;{row.Substrate.toFixed(0)}</TableCell>
                        <TableCell className="font-mono text-xs">&euro;{row.PGM.toFixed(0)}</TableCell>
                        <TableCell className="font-mono text-xs">&euro;{row.Washcoat.toFixed(0)}</TableCell>
                        <TableCell className="font-mono text-xs">&euro;{row.Canning.toFixed(0)}</TableCell>
                        <TableCell className="font-mono text-xs">&euro;{row.Urea.toFixed(0)}</TableCell>
                        <TableCell className="font-mono text-xs font-bold">&euro;{row.Quoted.toFixed(0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- COST DATABASE ---- */}
        <TabsContent value="costdb" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Substrates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Part</TableHead>
                        <TableHead>Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(SUBSTRATE_COSTS).map(([k, v]) => (
                        <TableRow key={k}>
                          <TableCell className="text-xs">{v.label}</TableCell>
                          <TableCell className="font-mono text-xs">&euro;{v.cost_eur}/{v.unit}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Washcoat Chemicals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead>Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(WASHCOAT_COSTS).map(([k, v]) => (
                        <TableRow key={k}>
                          <TableCell className="text-xs">{v.label}</TableCell>
                          <TableCell className="font-mono text-xs">&euro;{v.cost_eur_kg}/kg</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Canning Components</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Component</TableHead>
                        <TableHead>Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(CANNING_COSTS).map(([k, v]) => (
                        <TableRow key={k}>
                          <TableCell className="text-xs">{v.label}</TableCell>
                          <TableCell className="font-mono text-xs">&euro;{v.cost_eur}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Urea / SCR Components</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Component</TableHead>
                        <TableHead>Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(UREA_COSTS).map(([k, v]) => (
                        <TableRow key={k}>
                          <TableCell className="text-xs">{v.label}</TableCell>
                          <TableCell className="font-mono text-xs">&euro;{v.cost_eur}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---- INTEGRATOR PRICING ---- */}
        <TabsContent value="integrator" className="mt-4">
          {integratorPricing && (
            <div className="grid gap-4">
              {/* Header */}
              <Card className="bg-gradient-to-r from-[#7A0A1E] to-[#C8102E] text-white">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Factory className="h-6 w-6" />
                      <div>
                        <p className="text-sm font-bold">BOSAL Integrator Pricing</p>
                        <p className="text-xs text-white/70">Substrate + Coating + PGM + Mat + Canning + Welding</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">&euro;{integratorPricing.quotedPrice_eur.toFixed(0)}</p>
                      <p className="text-xs text-white/70">Quoted price (incl. margin)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Per-brick breakdown */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-[#C8102E]" /> Per-Element Cost Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Element</TableHead>
                            <TableHead>Substrate</TableHead>
                            <TableHead>Coating</TableHead>
                            <TableHead>PGM</TableHead>
                            <TableHead>Mat</TableHead>
                            <TableHead>Shell</TableHead>
                            <TableHead>Cone</TableHead>
                            <TableHead>Weld</TableHead>
                            <TableHead className="font-bold">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {integratorPricing.bricks.map((b) => (
                            <TableRow key={b.name}>
                              <TableCell className="font-medium text-xs">{b.name} <Badge variant="outline" className="text-[9px] ml-1">{b.type}</Badge></TableCell>
                              <TableCell className="font-mono text-[10px]">&euro;{b.substrate_eur.toFixed(0)}</TableCell>
                              <TableCell className="font-mono text-[10px]">&euro;{b.coating_eur.toFixed(0)}</TableCell>
                              <TableCell className="font-mono text-[10px]">&euro;{b.pgm_eur.toFixed(0)}</TableCell>
                              <TableCell className="font-mono text-[10px]">&euro;{b.mat_eur.toFixed(0)}</TableCell>
                              <TableCell className="font-mono text-[10px]">&euro;{b.canning_shell_eur.toFixed(0)}</TableCell>
                              <TableCell className="font-mono text-[10px]">&euro;{b.canning_cone_eur.toFixed(0)}</TableCell>
                              <TableCell className="font-mono text-[10px]">&euro;{b.welding_eur.toFixed(0)}</TableCell>
                              <TableCell className="font-mono text-[10px] font-bold">&euro;{b.subtotal_eur.toFixed(0)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Cost waterfall */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Cost Waterfall — Integrator View</CardTitle>
                    <CardDescription className="text-[10px]">Material → Manufacturing → Overhead → Margin → Quoted</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {[
                        { label: "Material Total", value: integratorPricing.materialTotal_eur, color: "#3B82F6" },
                        { label: "Manufacturing", value: integratorPricing.manufacturing_eur, color: "#F59E0B" },
                        { label: "Quality / QC", value: integratorPricing.qualityInspection_eur, color: "#8B5CF6" },
                        { label: "Packaging", value: integratorPricing.packaging_eur, color: "#6B7280" },
                        { label: "Logistics", value: integratorPricing.logistics_eur, color: "#EC4899" },
                        { label: "Overhead", value: integratorPricing.overhead_eur, color: "#14B8A6" },
                        { label: "Warranty Reserve", value: integratorPricing.warrantyReserve_eur, color: "#EF4444" },
                      ].map((item) => {
                        const pct = integratorPricing.quotedPrice_eur > 0 ? (item.value / integratorPricing.quotedPrice_eur) * 100 : 0;
                        return (
                          <div key={item.label} className="flex items-center gap-2">
                            <span className="w-28 text-[10px] text-muted-foreground">{item.label}</span>
                            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                            </div>
                            <span className="w-16 text-right font-mono text-[10px]">&euro;{item.value.toFixed(0)}</span>
                            <span className="w-10 text-right font-mono text-[10px] text-muted-foreground">{pct.toFixed(0)}%</span>
                          </div>
                        );
                      })}
                      <div className="border-t pt-2 mt-2 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Cost Price</span>
                          <span className="font-mono">&euro;{integratorPricing.costPrice_eur.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Profit Margin</span>
                          <span className="font-mono">&euro;{integratorPricing.profitMargin_eur.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between text-base font-bold border-t pt-2">
                          <span>Quoted Price</span>
                          <span className="font-mono text-[#C8102E]">&euro;{integratorPricing.quotedPrice_eur.toFixed(0)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Settings className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        Costs editable in Settings → Cost Database
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Urea system if applicable */}
              {integratorPricing.ureaSystem_eur > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Urea / SCR Dosing System</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-xs">
                      <Badge variant="outline">Injector + Pump + DCU + Tank + Sensors + Mixer</Badge>
                      <span className="font-mono font-bold">&euro;{integratorPricing.ureaSystem_eur.toFixed(0)}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
