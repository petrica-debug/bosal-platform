"use client";

import { useState, useCallback, useEffect } from "react";
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
  Settings,
  Sliders,
  Building2,
  Users,
  Key,
  Upload,
  Beaker,
  Loader2,
  Check,
  X,
  FileSpreadsheet,
  Database,
  Brain,
  ChevronDown,
  ChevronRight,
  Save,
  RotateCcw,
  Clock,
  Flame,
  Layers,
  FlaskConical,
  Gem,
  Droplets,
  Thermometer,
  Factory,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  ScatterChart,
  Scatter,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  loadCostDB,
  saveCostDB,
  resetCostDB,
  DEFAULT_COST_DB,
  type CostDatabase,
} from "@/lib/pricing/cost-database";

// ─── Calibration Constants ───────────────────────────────────────────────────

const REACTIONS = [
  {
    id: "co_ox_voltz",
    label: "CO oxidation on Pt/Al₂O₃ (Voltz 1973)",
    A: 4.65e11,
    Ea: 57.9,
    order: "Langmuir-Hinshelwood",
    reference: "Voltz et al., J. Catal. 1973",
    rateExpression: "r = A·exp(-Ea/RT)·C_CO·C_O2 / (1 + K_CO·C_CO)²",
  },
  {
    id: "hc_ox",
    label: "HC oxidation on Pt/Al₂O₃",
    A: 2.1e13,
    Ea: 78.5,
    order: "0.75 in HC, 0.5 in O2",
    reference: "Voltz et al., J. Catal. 1973",
    rateExpression: "r = A·exp(-Ea/RT)·C_HC^0.75·C_O2^0.5",
  },
  {
    id: "no_ox",
    label: "NO oxidation on Pt/Al₂O₃",
    A: 8.4e10,
    Ea: 58.2,
    order: "1 in NO, 0.5 in O2",
    reference: "Olsson et al., Appl. Catal. B 2000",
    rateExpression: "r = A·exp(-Ea/RT)·C_NO·C_O2^0.5",
  },
  {
    id: "scr_standard",
    label: "SCR Standard (4NO + 4NH₃ + O₂ → 4N₂ + 6H₂O)",
    A: 3.2e14,
    Ea: 88.0,
    order: "1 in NO, 0.8 in NH3",
    reference: "Klimczak et al., J. Catal. 2010",
    rateExpression: "r = A·exp(-Ea/RT)·C_NO·C_NH3^0.8",
  },
  {
    id: "scr_fast",
    label: "SCR Fast (2NO + 2NO₂ + 4NH₃ → 4N₂ + 6H₂O)",
    A: 1.1e16,
    Ea: 72.0,
    order: "1 in NO, 1 in NO2, 0.6 in NH3",
    reference: "Koebel et al., Ind. Eng. Chem. Res. 2000",
    rateExpression: "r = A·exp(-Ea/RT)·C_NO·C_NO2·C_NH3^0.6",
  },
  {
    id: "wgs",
    label: "WGS (CO + H₂O → CO₂ + H₂)",
    A: 2.7e10,
    Ea: 52.0,
    order: "1 in CO, 0.5 in H2O",
    reference: "Ovesen et al., J. Catal. 1996",
    rateExpression: "r = A·exp(-Ea/RT)·C_CO·C_H2O^0.5·(1 - β)",
  },
  {
    id: "smr",
    label: "SMR (CH₄ + H₂O → CO + 3H₂, Xu & Froment 1989)",
    A: 4.2e11,
    Ea: 67.0,
    order: "Xu-Froment multi-step",
    reference: "Xu & Froment, AIChE J. 1989",
    rateExpression: "r = A·exp(-Ea/RT)·(p_CH4·p_H2O - p_CO·p_H2³/K)",
  },
] as const;

type ReactionId = (typeof REACTIONS)[number]["id"];

interface DataPoint {
  T_C: number;
  conversion: number;
  spaceVelocity?: number;
  concentration?: number;
}

interface FittedResult {
  A_new: number;
  Ea_new: number;
  R2: number;
  RMSE: number;
  predicted: number[];
}

const R_GAS = 8.314e-3; // kJ/(mol·K)

function generateDemoData(): DataPoint[] {
  const T50 = 220;
  const width = 35;
  const noise = 0.03;
  const points: DataPoint[] = [];
  for (let T = 150; T <= 450; T += 15) {
    const sigmoid = 100 / (1 + Math.exp(-(T - T50) / width));
    const conv = Math.max(0, Math.min(100, sigmoid + (Math.random() - 0.5) * 2 * noise * 100));
    points.push({
      T_C: T,
      conversion: Math.round(conv * 10) / 10,
      spaceVelocity: 30000,
      concentration: 0.5,
    });
  }
  return points;
}

function fitArrhenius(data: DataPoint[]): FittedResult {
  const n = data.length;
  if (n < 3) return { A_new: 1e12, Ea_new: 60, R2: 0, RMSE: 0, predicted: [] };

  const logA_min = 8;
  const logA_max = 18;
  const Ea_min = 30;
  const Ea_max = 120;
  const steps_A = 25;
  const steps_Ea = 25;

  let bestSSE = Infinity;
  let bestA = 1e12;
  let bestEa = 60;
  let bestPred: number[] = [];

  const tau_nom = 1 / 30000;
  const C_nom = 0.5;

  for (let i = 0; i <= steps_A; i++) {
    const logA = logA_min + (i / steps_A) * (logA_max - logA_min);
    const A = Math.pow(10, logA);
    for (let j = 0; j <= steps_Ea; j++) {
      const Ea = Ea_min + (j / steps_Ea) * (Ea_max - Ea_min);
      const pred: number[] = [];
      let sse = 0;
      for (const pt of data) {
        const T_K = pt.T_C + 273.15;
        const tau = pt.spaceVelocity ? 1 / pt.spaceVelocity : tau_nom;
        const C = pt.concentration ?? C_nom;
        const k = A * Math.exp(-Ea / (R_GAS * T_K));
        const X_pred = 100 * (1 - Math.exp(-k * tau * C));
        pred.push(Math.max(0, Math.min(100, X_pred)));
        sse += (pt.conversion - pred[pred.length - 1]) ** 2;
      }
      if (sse < bestSSE) {
        bestSSE = sse;
        bestA = A;
        bestEa = Ea;
        bestPred = pred;
      }
    }
  }

  const meanY = data.reduce((s, p) => s + p.conversion, 0) / n;
  const SS_tot = data.reduce((s, p) => s + (p.conversion - meanY) ** 2, 0);
  const R2 = SS_tot > 0 ? 1 - bestSSE / SS_tot : 0;
  const RMSE = Math.sqrt(bestSSE / n);

  return { A_new: bestA, Ea_new: bestEa, R2, RMSE, predicted: bestPred };
}

function parseCSV(text: string): DataPoint[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const rows = lines.slice(1);
  const out: DataPoint[] = [];
  for (const row of rows) {
    const cols = row.split(/[,\t]/).map((c) => c.trim());
    const T = parseFloat(cols[0]);
    const conv = parseFloat(cols[1]);
    if (Number.isFinite(T) && Number.isFinite(conv)) {
      out.push({
        T_C: T,
        conversion: conv,
        spaceVelocity: cols[2] ? parseFloat(cols[2]) : undefined,
        concentration: cols[3] ? parseFloat(cols[3]) : undefined,
      });
    }
  }
  return out;
}

// ─── Cost Database Section Definitions ───────────────────────────────────────

interface CostField {
  key: string;
  label: string;
  unit: string;
}

interface CostSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  dbKey: keyof CostDatabase;
  fields: CostField[];
}

const COST_SECTIONS: CostSection[] = [
  {
    id: "welding",
    title: "Welding Costs",
    icon: <Flame className="h-4 w-4" />,
    dbKey: "welding",
    fields: [
      { key: "mig_per_meter_eur", label: "MIG", unit: "€/m" },
      { key: "tig_per_meter_eur", label: "TIG", unit: "€/m" },
      { key: "laser_per_meter_eur", label: "Laser", unit: "€/m" },
      { key: "robot_per_meter_eur", label: "Robot", unit: "€/m" },
      { key: "spot_per_point_eur", label: "Spot", unit: "€/point" },
    ],
  },
  {
    id: "canning",
    title: "Canning & Shell",
    icon: <Layers className="h-4 w-4" />,
    dbKey: "canning",
    fields: [
      { key: "shell_ss409_per_kg_eur", label: "SS409 shell", unit: "€/kg" },
      { key: "shell_ss441_per_kg_eur", label: "SS441 shell", unit: "€/kg" },
      { key: "shell_ss304_per_kg_eur", label: "SS304 shell", unit: "€/kg" },
      { key: "cone_per_kg_eur", label: "Cone", unit: "€/kg" },
      { key: "flange_vband_eur", label: "V-band flange", unit: "€" },
      { key: "flange_bolted_eur", label: "Bolted flange", unit: "€" },
      { key: "mounting_mat_per_m2_eur", label: "Mounting mat", unit: "€/m²" },
      { key: "mounting_mat_interam_per_pc_eur", label: "Interam mat", unit: "€/pc" },
      { key: "heatshield_per_kg_eur", label: "Heat shield", unit: "€/kg" },
    ],
  },
  {
    id: "substrate",
    title: "Substrates",
    icon: <FlaskConical className="h-4 w-4" />,
    dbKey: "substrate",
    fields: [
      { key: "cordierite_per_liter_eur", label: "Cordierite", unit: "€/L" },
      { key: "sic_per_liter_eur", label: "SiC", unit: "€/L" },
      { key: "metallic_per_liter_eur", label: "Metallic", unit: "€/L" },
      { key: "gpf_cordierite_per_liter_eur", label: "GPF", unit: "€/L" },
    ],
  },
  {
    id: "coating",
    title: "Washcoat Chemicals",
    icon: <Beaker className="h-4 w-4" />,
    dbKey: "coating",
    fields: [
      { key: "alumina_per_kg_eur", label: "Alumina", unit: "€/kg" },
      { key: "cezr_per_kg_eur", label: "CeZr", unit: "€/kg" },
      { key: "zeolite_cu_per_kg_eur", label: "Cu-zeolite", unit: "€/kg" },
      { key: "zeolite_fe_per_kg_eur", label: "Fe-zeolite", unit: "€/kg" },
      { key: "titania_per_kg_eur", label: "TiO₂", unit: "€/kg" },
      { key: "binder_per_kg_eur", label: "Binder", unit: "€/kg" },
      { key: "coating_labor_per_brick_eur", label: "Coating labor", unit: "€/brick" },
    ],
  },
  {
    id: "pgm",
    title: "PGM Prices",
    icon: <Gem className="h-4 w-4" />,
    dbKey: "pgm",
    fields: [
      { key: "pt_per_troy_oz_usd", label: "Pt", unit: "$/oz" },
      { key: "pd_per_troy_oz_usd", label: "Pd", unit: "$/oz" },
      { key: "rh_per_troy_oz_usd", label: "Rh", unit: "$/oz" },
      { key: "ir_per_troy_oz_usd", label: "Ir", unit: "$/oz" },
      { key: "ru_per_troy_oz_usd", label: "Ru", unit: "$/oz" },
      { key: "eur_usd_rate", label: "EUR/USD rate", unit: "" },
    ],
  },
  {
    id: "urea",
    title: "Urea / SCR System",
    icon: <Droplets className="h-4 w-4" />,
    dbKey: "urea",
    fields: [
      { key: "injector_eur", label: "Injector", unit: "€" },
      { key: "pump_module_eur", label: "Pump module", unit: "€" },
      { key: "tank_20l_eur", label: "Tank 20L", unit: "€" },
      { key: "tank_40l_eur", label: "Tank 40L", unit: "€" },
      { key: "dcu_eur", label: "DCU", unit: "€" },
      { key: "nox_sensor_eur", label: "NOx sensor", unit: "€" },
      { key: "temp_sensor_eur", label: "Temp sensor", unit: "€" },
      { key: "mixer_blade_eur", label: "Blade mixer", unit: "€" },
      { key: "mixer_swirl_eur", label: "Swirl mixer", unit: "€" },
      { key: "def_line_per_meter_eur", label: "DEF line", unit: "€/m" },
    ],
  },
  {
    id: "heatExchanger",
    title: "Heat Exchanger",
    icon: <Thermometer className="h-4 w-4" />,
    dbKey: "heatExchanger",
    fields: [
      { key: "inconel625_tube_per_kg_eur", label: "Inconel 625 tube", unit: "€/kg" },
      { key: "ss310_tube_per_kg_eur", label: "SS310 tube", unit: "€/kg" },
      { key: "haynes230_tube_per_kg_eur", label: "Haynes 230 tube", unit: "€/kg" },
      { key: "shell_per_kg_eur", label: "Shell", unit: "€/kg" },
      { key: "tubesheet_per_kg_eur", label: "Tubesheet", unit: "€/kg" },
      { key: "baffle_per_pc_eur", label: "Baffle", unit: "€/pc" },
      { key: "insulation_per_m2_eur", label: "Insulation", unit: "€/m²" },
      { key: "plate_ss316_per_kg_eur", label: "Plate SS316", unit: "€/kg" },
    ],
  },
  {
    id: "manufacturing",
    title: "Manufacturing Overhead",
    icon: <Factory className="h-4 w-4" />,
    dbKey: "manufacturing",
    fields: [
      { key: "manufacturing_pct", label: "Manufacturing", unit: "%" },
      { key: "quality_inspection_pct", label: "QC", unit: "%" },
      { key: "packaging_per_unit_eur", label: "Packaging", unit: "€/unit" },
      { key: "logistics_pct", label: "Logistics", unit: "%" },
      { key: "overhead_pct", label: "Overhead", unit: "%" },
      { key: "profit_margin_pct", label: "Profit margin", unit: "%" },
      { key: "warranty_reserve_pct", label: "Warranty reserve", unit: "%" },
    ],
  },
];

// ─── AI Config Types ─────────────────────────────────────────────────────────

interface AIConfig {
  provider: "openai" | "ollama" | "off";
  openaiKey: string;
  openaiModel: string;
  ollamaUrl: string;
  ollamaModel: string;
}

const DEFAULT_AI_CONFIG: AIConfig = {
  provider: "off",
  openaiKey: "",
  openaiModel: "gpt-4o",
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "llama3.1",
};

// ─── Collapsible Cost Section Component ──────────────────────────────────────

function CostSectionCard({
  section,
  values,
  onChange,
}: {
  section: CostSection;
  values: Record<string, number>;
  onChange: (key: string, value: number) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <CardTitle className="text-base flex items-center gap-2">
          {section.icon}
          {section.title}
          <span className="ml-auto">
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </span>
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {section.fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`${section.id}-${field.key}`} className="text-xs font-medium">
                  {field.label}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={`${section.id}-${field.key}`}
                    type="number"
                    step="any"
                    value={values[field.key] ?? 0}
                    onChange={(e) => onChange(field.key, parseFloat(e.target.value) || 0)}
                    className="h-8 font-mono text-sm"
                  />
                  {field.unit && (
                    <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                      {field.unit}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function SettingsPage() {
  // ── Cost Database State ──
  const [costDB, setCostDB] = useState<CostDatabase>(DEFAULT_COST_DB);
  const [costSaveStatus, setCostSaveStatus] = useState<"idle" | "saved">("idle");

  useEffect(() => {
    setCostDB(loadCostDB());
  }, []);

  const updateCostField = (sectionKey: keyof CostDatabase, fieldKey: string, value: number) => {
    setCostDB((prev) => ({
      ...prev,
      [sectionKey]: {
        ...(prev[sectionKey] as unknown as Record<string, unknown>),
        [fieldKey]: value,
      },
    }));
  };

  const handleSaveCosts = () => {
    saveCostDB(costDB);
    setCostDB((prev) => ({ ...prev, lastUpdated: new Date().toISOString() }));
    setCostSaveStatus("saved");
    setTimeout(() => setCostSaveStatus("idle"), 2500);
  };

  const handleResetCosts = () => {
    const fresh = resetCostDB();
    setCostDB(fresh);
  };

  // ── AI Config State ──
  const [aiConfig, setAIConfig] = useState<AIConfig>(DEFAULT_AI_CONFIG);
  const [aiTestStatus, setAITestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("bosal-ai-config");
      if (raw) setAIConfig({ ...DEFAULT_AI_CONFIG, ...JSON.parse(raw) });
    } catch { /* use defaults */ }
  }, []);

  const saveAIConfig = (cfg: AIConfig) => {
    setAIConfig(cfg);
    localStorage.setItem("bosal-ai-config", JSON.stringify(cfg));
  };

  const testAIConnection = async () => {
    setAITestStatus("testing");
    try {
      if (aiConfig.provider === "openai") {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${aiConfig.openaiKey}` },
        });
        setAITestStatus(res.ok ? "success" : "error");
      } else if (aiConfig.provider === "ollama") {
        const res = await fetch(`${aiConfig.ollamaUrl}/api/tags`);
        setAITestStatus(res.ok ? "success" : "error");
      } else {
        setAITestStatus("error");
      }
    } catch {
      setAITestStatus("error");
    }
    setTimeout(() => setAITestStatus("idle"), 3000);
  };

  // ── Calibration State ──
  const [activeReaction, setActiveReaction] = useState<ReactionId>("co_ox_voltz");
  const [csvData, setCsvData] = useState<DataPoint[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isFitting, setIsFitting] = useState(false);
  const [fitProgress, setFitProgress] = useState(0);
  const [fitResult, setFitResult] = useState<FittedResult | null>(null);
  const [acceptedParams, setAcceptedParams] = useState<{ A: number; Ea: number } | null>(null);

  const reaction = REACTIONS.find((r) => r.id === activeReaction)!;

  const handleFile = useCallback((file: File | null) => {
    setCsvError(null);
    if (!file) {
      setCsvData([]);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const parsed = parseCSV(text);
        if (parsed.length < 2) {
          setCsvError("Need at least 2 data points. Format: T(°C), conversion(%), [space_velocity, concentration]");
          setCsvData([]);
        } else {
          setCsvData(parsed);
        }
      } catch {
        setCsvError("Invalid CSV format");
        setCsvData([]);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".csv") || f?.type === "text/csv") {
      handleFile(f);
    } else {
      setCsvError("Please upload a CSV file");
    }
  };

  const handleLoadDemo = () => {
    setCsvData(generateDemoData());
    setCsvError(null);
    setFitResult(null);
  };

  const runFit = () => {
    if (csvData.length < 3) return;
    setIsFitting(true);
    setFitProgress(0);
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      setTimeout(() => {
        setFitProgress((i / steps) * 100);
        if (i === steps) {
          const result = fitArrhenius(csvData);
          setFitResult(result);
          setIsFitting(false);
        }
      }, 50 * i);
    }
  };

  const handleAccept = () => {
    if (fitResult) {
      setAcceptedParams({ A: fitResult.A_new, Ea: fitResult.Ea_new });
    }
  };

  const handleReject = () => {
    setFitResult(null);
    setAcceptedParams(null);
  };

  const parityData =
    fitResult && csvData.length > 0
      ? csvData.map((p, i) => ({ measured: p.conversion, predicted: fitResult.predicted[i] ?? 0 }))
      : [];
  const lightoffData =
    csvData.length > 0
      ? csvData
          .map((p) => ({ T: p.T_C, measured: p.conversion }))
          .sort((a, b) => a.T - b.T)
      : [];
  const fittedCurveData =
    fitResult && csvData.length > 0
      ? (() => {
          const sorted = [...csvData].sort((a, b) => a.T_C - b.T_C);
          const T_min = sorted[0]!.T_C;
          const T_max = sorted[sorted.length - 1]!.T_C;
          const out: { T: number; fitted: number }[] = [];
          for (let T = T_min; T <= T_max; T += 2) {
            const T_K = T + 273.15;
            const tau = 1 / 30000;
            const C = 0.5;
            const k = fitResult.A_new * Math.exp(-fitResult.Ea_new / (R_GAS * T_K));
            const X = 100 * (1 - Math.exp(-k * tau * C));
            out.push({ T, fitted: Math.max(0, Math.min(100, X)) });
          }
          return out;
        })()
      : [];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-bosal-red text-white">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Settings</h1>
          <p className="text-sm text-muted-foreground">
            Cost database, AI configuration, calibration & platform settings
          </p>
        </div>
      </div>

      <Tabs defaultValue="costs" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="costs">
            <Database className="mr-1.5 h-3.5 w-3.5" />
            Cost Database
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Brain className="mr-1.5 h-3.5 w-3.5" />
            AI Config
          </TabsTrigger>
          <TabsTrigger value="calibration">
            <Beaker className="mr-1.5 h-3.5 w-3.5" />
            Calibration
          </TabsTrigger>
          <TabsTrigger value="general">
            <Settings className="mr-1.5 h-3.5 w-3.5" />
            General
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 1: COST DATABASE
            ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="costs" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">BOSAL Integrator Cost Database</h2>
              <p className="text-sm text-muted-foreground">
                Edit all material, manufacturing and overhead costs used in pricing calculations.
              </p>
            </div>
            <Badge variant="outline" className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              Last updated: {costDB.lastUpdated ? new Date(costDB.lastUpdated).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never"}
            </Badge>
          </div>

          <Separator />

          {COST_SECTIONS.map((section) => (
            <CostSectionCard
              key={section.id}
              section={section}
              values={costDB[section.dbKey] as unknown as Record<string, number>}
              onChange={(fieldKey, value) => updateCostField(section.dbKey, fieldKey, value)}
            />
          ))}

          <div className="sticky bottom-0 z-10 flex items-center gap-3 rounded-lg border bg-background/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <Button
              onClick={handleSaveCosts}
              className="bg-bosal-red hover:bg-bosal-red/90 text-white"
            >
              {costSaveStatus === "saved" ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleResetCosts}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset to Defaults
            </Button>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 2: AI CONFIGURATION
            ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="ai" className="mt-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold">AI Configuration</h2>
            <p className="text-sm text-muted-foreground">
              Configure the AI provider for intelligent suggestions and analysis.
            </p>
          </div>

          <Separator />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Provider</CardTitle>
              <CardDescription>Select which AI backend to use</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={aiConfig.provider}
                onValueChange={(v) => saveAIConfig({ ...aiConfig, provider: v as AIConfig["provider"] })}
              >
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">
                    <span className="flex items-center gap-2">
                      <Brain className="h-3.5 w-3.5" /> BelgaLabs AI (Cloud)
                    </span>
                  </SelectItem>
                  <SelectItem value="ollama">
                    <span className="flex items-center gap-2">
                      <Wifi className="h-3.5 w-3.5" /> BelgaLabs AI (Local)
                    </span>
                  </SelectItem>
                  <SelectItem value="off">
                    <span className="flex items-center gap-2">
                      <WifiOff className="h-3.5 w-3.5" /> Off
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {aiConfig.provider === "openai" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">BelgaLabs AI (Cloud) Settings</CardTitle>
                <CardDescription>API key and model configuration for cloud AI engine</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="openai-key">API Key</Label>
                  <Input
                    id="openai-key"
                    type="password"
                    placeholder="sk-..."
                    value={aiConfig.openaiKey}
                    onChange={(e) => saveAIConfig({ ...aiConfig, openaiKey: e.target.value })}
                    className="max-w-md font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="openai-model">Model</Label>
                  <Select
                    value={aiConfig.openaiModel}
                    onValueChange={(v) => saveAIConfig({ ...aiConfig, openaiModel: v })}
                  >
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                      <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">gpt-3.5-turbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {aiConfig.provider === "ollama" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">BelgaLabs AI (Local) Settings</CardTitle>
                <CardDescription>Local AI engine server configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ollama-url">Server URL</Label>
                  <Input
                    id="ollama-url"
                    type="text"
                    placeholder="http://localhost:11434"
                    value={aiConfig.ollamaUrl}
                    onChange={(e) => saveAIConfig({ ...aiConfig, ollamaUrl: e.target.value })}
                    className="max-w-md font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ollama-model">Model</Label>
                  <Input
                    id="ollama-model"
                    type="text"
                    placeholder="llama3.1"
                    value={aiConfig.ollamaModel}
                    onChange={(e) => saveAIConfig({ ...aiConfig, ollamaModel: e.target.value })}
                    className="max-w-xs font-mono"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {aiConfig.provider !== "off" && (
            <Button
              onClick={testAIConnection}
              disabled={aiTestStatus === "testing"}
              variant="outline"
              className="border-bosal-red text-bosal-red hover:bg-bosal-red/10"
            >
              {aiTestStatus === "testing" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : aiTestStatus === "success" ? (
                <>
                  <Check className="mr-2 h-4 w-4 text-green-600" />
                  Connected!
                </>
              ) : aiTestStatus === "error" ? (
                <>
                  <X className="mr-2 h-4 w-4 text-destructive" />
                  Failed
                </>
              ) : (
                <>
                  <Wifi className="mr-2 h-4 w-4" />
                  Test Connection
                </>
              )}
            </Button>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 3: CALIBRATION (preserved from original)
            ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="calibration" className="mt-6 space-y-6">
          {/* Reaction Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reaction Selector</CardTitle>
              <CardDescription>
                Choose which reaction to calibrate from the literature database
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={activeReaction} onValueChange={(v) => setActiveReaction(v as ReactionId)}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REACTIONS.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Current Parameters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current Parameters</CardTitle>
              <CardDescription>Literature values for {reaction.label}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">A (pre-exponential)</p>
                  <p className="font-mono text-sm font-semibold">
                    {acceptedParams
                      ? acceptedParams.A.toExponential(2)
                      : reaction.A.toExponential(2)}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Ea (kJ/mol)</p>
                  <p className="font-mono text-sm font-semibold">
                    {acceptedParams ? acceptedParams.Ea.toFixed(1) : reaction.Ea}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Reaction order</p>
                  <p className="text-sm font-medium">{reaction.order}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Reference</p>
                  <p className="text-sm font-medium">{reaction.reference}</p>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground">Rate expression</p>
                <p className="font-mono text-sm">{reaction.rateExpression}</p>
              </div>
            </CardContent>
          </Card>

          {/* CSV Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                CSV Upload
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadDemo}
                  className="border-bosal-red text-bosal-red hover:bg-bosal-red/10"
                >
                  <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                  Load Demo Data
                </Button>
              </CardTitle>
              <CardDescription>
                Expected format: T(°C), conversion(%), [space_velocity, concentration]
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`
                  flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors
                  ${isDragging ? "border-bosal-red bg-bosal-red/5" : "border-muted-foreground/25 hover:border-bosal-red/50 hover:bg-muted/30"}
                `}
                onClick={() => document.getElementById("csv-input")?.click()}
              >
                <input
                  id="csv-input"
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
                <Upload className="mb-2 h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">Drop CSV or click to browse</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Columns: T(°C), conversion(%), optional: space_velocity, concentration
                </p>
              </div>
              {csvError && (
                <p className="mt-2 text-sm text-destructive">{csvError}</p>
              )}
              {csvData.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-medium">Preview (first 10 rows)</p>
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>T (°C)</TableHead>
                          <TableHead>Conversion (%)</TableHead>
                          <TableHead>SV (1/h)</TableHead>
                          <TableHead>Conc</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvData.slice(0, 10).map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono">{row.T_C}</TableCell>
                            <TableCell className="font-mono">{row.conversion}</TableCell>
                            <TableCell className="font-mono">{row.spaceVelocity ?? "—"}</TableCell>
                            <TableCell className="font-mono">{row.concentration ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {csvData.length} rows total
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Auto-Fit Engine */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sliders className="h-4 w-4" />
                Auto-Fit Engine
              </CardTitle>
              <CardDescription>
                Grid search over A and Ea — Arrhenius fit, minimize sum of squared residuals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={runFit}
                disabled={csvData.length < 3 || isFitting}
                className="bg-bosal-red hover:bg-bosal-red/90 text-white"
              >
                {isFitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fitting... {Math.round(fitProgress)}%
                  </>
                ) : (
                  <>
                    <Beaker className="mr-2 h-4 w-4" />
                    Run Fit
                  </>
                )}
              </Button>
              {isFitting && (
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-bosal-red transition-all duration-150"
                    style={{ width: `${fitProgress}%` }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fit Results */}
          {fitResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fit Results</CardTitle>
                <CardDescription>
                  Parity plot, light-off comparison, and fitted parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-medium">Parity Plot (predicted vs measured)</p>
                    <div className="h-[280px] w-full">
                      <ParityChart parityData={parityData} />
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium">Light-off Comparison</p>
                    <div className="h-[280px] w-full">
                      <LightoffChart
                        measuredData={lightoffData}
                        fittedData={fittedCurveData}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border-2 border-bosal-red/30 bg-bosal-red/5 p-4">
                    <p className="text-xs font-medium text-muted-foreground">A_new</p>
                    <p className="font-mono text-lg font-bold text-bosal-red">
                      {fitResult.A_new.toExponential(2)}
                    </p>
                  </div>
                  <div className="rounded-lg border-2 border-bosal-red/30 bg-bosal-red/5 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Ea_new (kJ/mol)</p>
                    <p className="font-mono text-lg font-bold text-bosal-red">
                      {fitResult.Ea_new.toFixed(1)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-xs font-medium text-muted-foreground">R²</p>
                    <p className="font-mono text-lg font-semibold">{fitResult.R2.toFixed(4)}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-xs font-medium text-muted-foreground">RMSE</p>
                    <p className="font-mono text-lg font-semibold">{fitResult.RMSE.toFixed(3)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAccept}
                    className="bg-bosal-red hover:bg-bosal-red/90 text-white"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Accept
                  </Button>
                  <Button variant="outline" onClick={handleReject}>
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 4: GENERAL
            ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="general" className="mt-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="relative overflow-hidden">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Organization
                </CardTitle>
                <CardDescription>Company details and branding</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary" className="mt-2">
                  Coming Soon
                </Badge>
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Users
                </CardTitle>
                <CardDescription>Team members and permissions</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary" className="mt-2">
                  Coming Soon
                </Badge>
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  API Keys
                </CardTitle>
                <CardDescription>External integrations and keys</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary" className="mt-2">
                  Coming Soon
                </Badge>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Chart Sub-Components ────────────────────────────────────────────────────

function ParityChart({ parityData }: { parityData: { measured: number; predicted: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="measured"
          name="Measured"
          unit="%"
          domain={[0, 100]}
        />
        <YAxis
          type="number"
          dataKey="predicted"
          name="Predicted"
          unit="%"
          domain={[0, 100]}
        />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} />
        <ReferenceLine
          segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]}
          stroke="hsl(var(--muted-foreground))"
          strokeDasharray="5 5"
        />
        <Scatter data={parityData} fill="#C8102E" fillOpacity={0.8} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function LightoffChart({
  measuredData,
  fittedData,
}: {
  measuredData: { T: number; measured: number }[];
  fittedData: { T: number; fitted: number }[];
}) {
  const allT = new Set<number>();
  fittedData.forEach((f) => allT.add(f.T));
  measuredData.forEach((m) => allT.add(m.T));
  const sortedT = [...allT].sort((a, b) => a - b);
  const merged = sortedT.map((T) => {
    const m = measuredData.find((d) => d.T === T);
    const fPrev = fittedData.filter((f) => f.T <= T).pop();
    const fNext = fittedData.find((f) => f.T >= T);
    let fitted: number | undefined;
    if (fPrev && fNext) {
      if (fPrev.T === fNext.T) fitted = fPrev.fitted;
      else
        fitted =
          fPrev.fitted +
          ((fNext.fitted - fPrev.fitted) * (T - fPrev.T)) / (fNext.T - fPrev.T);
    } else if (fPrev) fitted = fPrev.fitted;
    else if (fNext) fitted = fNext.fitted;
    return { T, fitted, measured: m?.measured };
  });
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={merged} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="T" name="T" unit="°C" />
        <YAxis domain={[0, 100]} unit="%" />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="fitted"
          stroke="#C8102E"
          strokeWidth={2}
          dot={false}
          name="Fitted"
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="measured"
          stroke="hsl(var(--chart-2))"
          strokeWidth={0}
          dot={{ r: 4, fill: "hsl(var(--chart-2))" }}
          name="Measured"
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
