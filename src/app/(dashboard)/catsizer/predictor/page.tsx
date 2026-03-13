"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
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
  Play,
  Loader2,
  Thermometer,
  Activity,
  BarChart3,
  Layers,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Plus,
  Trash2,
  Settings2,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  ReferenceLine,
  BarChart,
  Bar,
  ComposedChart,
} from "recharts";
import type { CatalystType } from "@/lib/catsizer/types";
import { ENGINE_PRESETS } from "@/lib/catsizer/constants";
import {
  conversionTemperatureSweep,
  findLightOff,
  PGM_FORMULATIONS,
  type ConversionPoint,
  type PGMFormulation,
} from "@/lib/catsizer/catalyst-technology";
import { plugFlowConversion } from "@/lib/catsizer/kinetics";
import {
  runTransientWLTPSim,
  type TransientSimConfig,
  type TransientSimResult,
  type WLTPEmissionStandard,
} from "@/lib/catsizer/wltp-transient-engine";
import type { WashcoatType } from "@/lib/catsizer/predev-engine";
import {
  assessDeactivation,
  type DeactivationInputs,
} from "@/lib/catsizer/deactivation";

// ============================================================
// TYPES
// ============================================================

interface BrickConfig {
  id: string;
  type: CatalystType;
  diameter_mm: number;
  length_mm: number;
  cpsi: number;
  wallThickness_mil: number;
  pgmLoading_g_ft3: number;
  washcoatThickness_um: number;
  formulation: PGMFormulation | null;
}

interface SystemConfig {
  displacement_L: number;
  ratedPower_kW: number;
  fuelType: "diesel" | "gasoline";
  numberOfCylinders: number;
  exhaustTemp_C: number;
  exhaustFlow_kg_h: number;
  rawCO_ppm: number;
  rawHC_ppm: number;
  rawNOx_ppm: number;
  rawPM_mg_Nm3: number;
  emissionStandard: WLTPEmissionStandard;
}

interface InletConcentrations {
  CO_ppm: number;
  HC_ppm: number;
  NOx_ppm: number;
}

interface ReactorProfilePoint {
  position: number;
  position_mm: number;
  T_C: number;
  CO_pct: number;
  HC_pct: number;
  NOx_pct: number;
  inletConcentrations?: InletConcentrations;
}

interface SweepPoint {
  param: number;
  CO_conv: number;
  HC_conv: number;
  NOx_conv: number;
  T50_CO: number;
  T50_HC: number;
}

// ============================================================
// DEFAULTS
// ============================================================

const DEFAULT_SYSTEM: SystemConfig = {
  displacement_L: 6.7,
  ratedPower_kW: 250,
  fuelType: "diesel",
  numberOfCylinders: 6,
  exhaustTemp_C: 350,
  exhaustFlow_kg_h: 900,
  rawCO_ppm: 400,
  rawHC_ppm: 120,
  rawNOx_ppm: 800,
  rawPM_mg_Nm3: 22,
  emissionStandard: "euro_6d_diesel",
};

function defaultBrick(type: CatalystType, idx: number): BrickConfig {
  const formulations = PGM_FORMULATIONS.filter((f) =>
    f.catalystTypes.includes(type)
  );
  return {
    id: `brick-${idx}-${Date.now()}`,
    type,
    diameter_mm: type === "ASC" ? 267 : 267,
    length_mm: type === "DPF" ? 305 : type === "ASC" ? 76 : 152,
    cpsi: type === "DPF" ? 200 : type === "SCR" ? 400 : 400,
    wallThickness_mil: type === "DPF" ? 12 : 4,
    pgmLoading_g_ft3: type === "SCR" ? 0 : type === "ASC" ? 5 : 60,
    washcoatThickness_um: 30,
    formulation: formulations[0] ?? null,
  };
}

const DEFAULT_CHAIN: BrickConfig[] = [
  defaultBrick("DOC", 0),
  defaultBrick("DPF", 1),
  defaultBrick("SCR", 2),
  defaultBrick("ASC", 3),
];

function brickVolume(b: BrickConfig): number {
  const r_m = b.diameter_mm / 2000;
  return Math.PI * r_m * r_m * (b.length_mm / 1000) * 1000;
}

function brickGSA(cpsi: number, wallThickness_mil: number): number {
  const cellDensity = cpsi / 6.4516e-4;
  const wallThickness_m = wallThickness_mil * 25.4e-6;
  const pitch = 1 / Math.sqrt(cellDensity);
  const channelSide = pitch - wallThickness_m;
  return (4 * channelSide) / (pitch * pitch) / 1000;
}

const BRICK_COLORS: Record<CatalystType, string> = {
  DOC: "#3B82F6",
  DPF: "#8B5CF6",
  SCR: "#10B981",
  ASC: "#F59E0B",
  TWC: "#EF4444",
};

const SPECIES_COLORS = {
  CO: "#F87171",
  HC: "#FBBF24",
  NOx: "#60A5FA",
  NO2: "#A78BFA",
  PM: "#9CA3AF",
};

function verdictBadge(v: string) {
  if (v === "green")
    return (
      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
        <CheckCircle2 className="h-3 w-3 mr-1" /> PASS
      </Badge>
    );
  if (v === "amber")
    return (
      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
        <AlertTriangle className="h-3 w-3 mr-1" /> MARGINAL
      </Badge>
    );
  return (
    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
      <XCircle className="h-3 w-3 mr-1" /> FAIL
    </Badge>
  );
}

// ============================================================
// 1D REACTOR PROFILE GENERATOR
// ============================================================

function generate1DProfile(
  brick: BrickConfig,
  system: SystemConfig,
  customInlet?: InletConcentrations
): ReactorProfilePoint[] {
  const vol = brickVolume(brick);
  const gsa = brickGSA(brick.cpsi, brick.wallThickness_mil);
  const Q = system.exhaustFlow_kg_h / 3600 / 1.1;
  const T_K = system.exhaustTemp_C + 273.15;
  const nSteps = 20;

  const inletCO_ppm = customInlet?.CO_ppm ?? system.rawCO_ppm;
  const inletHC_ppm = customInlet?.HC_ppm ?? system.rawHC_ppm;
  const inletNOx_ppm = customInlet?.NOx_ppm ?? system.rawNOx_ppm;

  const points: ReactorProfilePoint[] = [];
  const length_m = brick.length_mm / 1000;

  const inlet: Record<string, number> = {
    CO: (inletCO_ppm / 1e6) * (101325 / (8.314 * T_K)),
    HC: (inletHC_ppm / 1e6) * (101325 / (8.314 * T_K)),
    NO: (inletNOx_ppm / 1e6) * (101325 / (8.314 * T_K)) * 0.9,
    NO2: (inletNOx_ppm / 1e6) * (101325 / (8.314 * T_K)) * 0.1,
    O2: 0.1 * (101325 / (8.314 * T_K)),
    H2O: 0.08 * (101325 / (8.314 * T_K)),
    NH3:
      brick.type === "SCR" || brick.type === "ASC"
        ? (inletNOx_ppm / 1e6) * (101325 / (8.314 * T_K)) * 1.05
        : 0,
  };

  if (
    brick.type === "DOC" ||
    brick.type === "TWC" ||
    brick.type === "SCR" ||
    brick.type === "ASC"
  ) {
    for (let i = 0; i <= nSteps; i++) {
      const frac = i / nSteps;
      const sliceLength = length_m * frac;
      const sliceVol = vol * frac || 0.001;

      if (frac === 0) {
        points.push({
          position: 0,
          position_mm: 0,
          T_C: system.exhaustTemp_C,
          CO_pct: 0,
          HC_pct: 0,
          NOx_pct: 0,
          inletConcentrations: { CO_ppm: inletCO_ppm, HC_ppm: inletHC_ppm, NOx_ppm: inletNOx_ppm },
        });
        continue;
      }

      const outlet = plugFlowConversion(
        brick.type as "DOC" | "SCR" | "TWC" | "ASC",
        sliceLength,
        gsa,
        sliceVol,
        Q,
        T_K,
        inlet,
        brick.washcoatThickness_um,
        0.7
      );

      const convCO = inlet.CO > 0 ? (inlet.CO - (outlet["CO"] ?? 0)) / inlet.CO : 0;
      const convHC = inlet.HC > 0 ? (inlet.HC - (outlet["HC"] ?? 0)) / inlet.HC : 0;
      const inNOx = (inlet.NO ?? 0) + (inlet.NO2 ?? 0);
      const outNOx = (outlet["NO"] ?? 0) + (outlet["NO2"] ?? 0);
      const convNOx = inNOx > 0 ? (inNOx - outNOx) / inNOx : 0;

      const exotherm =
        brick.type === "DOC" || brick.type === "TWC"
          ? convCO * 40 + convHC * 60
          : 0;

      points.push({
        position: frac,
        position_mm: Math.round(frac * brick.length_mm),
        T_C: Math.round((system.exhaustTemp_C + exotherm) * 10) / 10,
        CO_pct: Math.round(convCO * 1000) / 10,
        HC_pct: Math.round(convHC * 1000) / 10,
        NOx_pct: Math.round(convNOx * 1000) / 10,
      });
    }
  } else {
    for (let i = 0; i <= nSteps; i++) {
      const frac = i / nSteps;
      const pm_eff = 1 - Math.exp(-frac * 4.5);
      points.push({
        position: frac,
        position_mm: Math.round(frac * brick.length_mm),
        T_C: system.exhaustTemp_C - frac * 5,
        CO_pct: 0,
        HC_pct: 0,
        NOx_pct: Math.round(pm_eff * 1000) / 10,
      });
    }
  }

  return points;
}

// ============================================================
// PARAMETRIC SWEEP
// ============================================================

function runParametricSweep(
  brick: BrickConfig,
  system: SystemConfig,
  param: "temperature" | "ghsv" | "pgm_loading" | "washcoat_thickness",
  range: [number, number],
  steps: number
): SweepPoint[] {
  const points: SweepPoint[] = [];
  const dt = (range[1] - range[0]) / (steps - 1);

  for (let i = 0; i < steps; i++) {
    const val = range[0] + i * dt;
    const tempSystem = { ...system };
    const tempBrick = { ...brick };

    if (param === "temperature") tempSystem.exhaustTemp_C = val;
    else if (param === "ghsv") tempSystem.exhaustFlow_kg_h = val * brickVolume(brick) / 1000 * 1.1 * 3600;
    else if (param === "pgm_loading") tempBrick.pgmLoading_g_ft3 = val;
    else if (param === "washcoat_thickness") tempBrick.washcoatThickness_um = val;

    const profile = generate1DProfile(tempBrick, tempSystem);
    const last = profile[profile.length - 1];

    const vol = brickVolume(tempBrick);
    const gsa = brickGSA(tempBrick.cpsi, tempBrick.wallThickness_mil);
    const Q = tempSystem.exhaustFlow_kg_h / 3600 / 1.1;

    const formulation = tempBrick.formulation ?? PGM_FORMULATIONS[0];
    const T_K = tempSystem.exhaustTemp_C + 273.15;
    const inletComp: Record<string, number> = {
      CO: (tempSystem.rawCO_ppm / 1e6) * (101325 / (8.314 * T_K)),
      HC: (tempSystem.rawHC_ppm / 1e6) * (101325 / (8.314 * T_K)),
      NO: (tempSystem.rawNOx_ppm / 1e6) * (101325 / (8.314 * T_K)) * 0.9,
      NO2: (tempSystem.rawNOx_ppm / 1e6) * (101325 / (8.314 * T_K)) * 0.1,
      O2: 0.1 * (101325 / (8.314 * T_K)),
      H2O: 0.08 * (101325 / (8.314 * T_K)),
    };

    const lightOffData =
      tempBrick.type !== "DPF"
        ? conversionTemperatureSweep(
            tempBrick.type,
            vol,
            gsa,
            Q,
            inletComp,
            formulation,
            [100, 600],
            30
          )
        : [];

    const t50co = lightOffData.length > 0 ? findLightOff(lightOffData, "CO") : 999;
    const t50hc = lightOffData.length > 0 ? findLightOff(lightOffData, "HC") : 999;

    points.push({
      param: Math.round(val * 10) / 10,
      CO_conv: last.CO_pct,
      HC_conv: last.HC_pct,
      NOx_conv: last.NOx_pct,
      T50_CO: Math.round(t50co),
      T50_HC: Math.round(t50hc),
    });
  }

  return points;
}

// ============================================================
// DOWNSAMPLE FOR CHARTS
// ============================================================

function downsample<T>(data: T[], maxPts: number): T[] {
  if (data.length <= maxPts) return data;
  const step = Math.ceil(data.length / maxPts);
  const r: T[] = [];
  for (let i = 0; i < data.length; i += step) r.push(data[i]);
  if (r[r.length - 1] !== data[data.length - 1]) r.push(data[data.length - 1]);
  return r;
}

// ============================================================
// COMPONENT
// ============================================================

export default function CatalystPredictorPage() {
  const [system, setSystem] = useState<SystemConfig>(DEFAULT_SYSTEM);
  const [chain, setChain] = useState<BrickConfig[]>(DEFAULT_CHAIN);
  const [selectedBrickIdx, setSelectedBrickIdx] = useState(0);
  const [activeTab, setActiveTab] = useState("system");
  const [simRunning, setSimRunning] = useState(false);
  const [transientResult, setTransientResult] = useState<TransientSimResult | null>(null);
  const [sweepParam, setSweepParam] = useState<"temperature" | "ghsv" | "pgm_loading" | "washcoat_thickness">("temperature");

  const selectedBrick = chain[selectedBrickIdx] ?? chain[0];

  // Apply engine preset
  const applyPreset = useCallback(
    (idx: number) => {
      const p = ENGINE_PRESETS[idx];
      if (!p?.inputs) return;
      const inp = p.inputs;
      setSystem((s) => ({
        ...s,
        displacement_L: inp.displacement_L ?? s.displacement_L,
        ratedPower_kW: inp.ratedPower_kW ?? s.ratedPower_kW,
        fuelType: (inp.engineType === "diesel" ? "diesel" : "gasoline") as "diesel" | "gasoline",
        numberOfCylinders: inp.numberOfCylinders ?? s.numberOfCylinders,
        exhaustTemp_C: inp.exhaustTemp_C ?? s.exhaustTemp_C,
        exhaustFlow_kg_h: inp.exhaustFlowRate_kg_h ?? s.exhaustFlow_kg_h,
        rawCO_ppm: inp.CO_ppm ?? s.rawCO_ppm,
        rawHC_ppm: inp.HC_ppm ?? s.rawHC_ppm,
        rawNOx_ppm: inp.NOx_ppm ?? s.rawNOx_ppm,
        rawPM_mg_Nm3: inp.PM_mg_Nm3 ?? s.rawPM_mg_Nm3,
      }));
    },
    []
  );

  const addBrick = useCallback((type: CatalystType) => {
    setChain((c) => [...c, defaultBrick(type, c.length)]);
  }, []);

  const removeBrick = useCallback(
    (idx: number) => {
      setChain((c) => c.filter((_, i) => i !== idx));
      if (selectedBrickIdx >= chain.length - 1) setSelectedBrickIdx(Math.max(0, chain.length - 2));
    },
    [selectedBrickIdx, chain.length]
  );

  const updateBrick = useCallback(
    (idx: number, updates: Partial<BrickConfig>) => {
      setChain((c) => c.map((b, i) => (i === idx ? { ...b, ...updates } : b)));
    },
    []
  );

  // 1D reactor profiles for all bricks — cascaded inlet concentrations
  const reactorProfiles = useMemo(() => {
    let currentCO = system.rawCO_ppm;
    let currentHC = system.rawHC_ppm;
    let currentNOx = system.rawNOx_ppm;

    const results: Array<{ brick: BrickConfig; profile: ReactorProfilePoint[] }> = [];

    for (const brick of chain) {
      const customInlet: InletConcentrations = {
        CO_ppm: currentCO,
        HC_ppm: currentHC,
        NOx_ppm: currentNOx,
      };
      const profile = generate1DProfile(brick, system, customInlet);
      results.push({ brick, profile });

      const last = profile[profile.length - 1];
      if (brick.type !== "DPF") {
        currentCO = currentCO * (1 - last.CO_pct / 100);
        currentHC = currentHC * (1 - last.HC_pct / 100);
        currentNOx = currentNOx * (1 - last.NOx_pct / 100);
      }
    }

    return results;
  }, [chain, system]);

  // System KPI computations
  const systemKPIs = useMemo(() => {
    const totalVol = chain.reduce((s, b) => s + brickVolume(b), 0);

    const systemBackpressure = chain.reduce((s, b) => {
      const ghsv = system.exhaustFlow_kg_h / 1.1 / brickVolume(b);
      return s + (0.5 + ghsv / 100000 * 2.5) * (b.length_mm / 152);
    }, 0);

    const pressureDropPct = (systemBackpressure / 15) * 100;
    const pressureDropColor = pressureDropPct < 60 ? "text-green-400" : pressureDropPct < 85 ? "text-yellow-400" : "text-red-400";
    const pressureDropBg = pressureDropPct < 60 ? "bg-green-500/20" : pressureDropPct < 85 ? "bg-yellow-500/20" : "bg-red-500/20";

    const Q_m3s = system.exhaustFlow_kg_h / 3600 / 1.1;
    const residenceTime_ms = Q_m3s > 0 ? (totalVol / 1000) / Q_m3s * 1000 : 0;

    const PGM_COST_INDEX: Record<string, number> = { DOC: 1.0, TWC: 1.2, ASC: 0.8, SCR: 0.1, DPF: 0.3 };
    const pgmCostIndex = chain.reduce((s, b) => {
      return s + b.pgmLoading_g_ft3 * brickVolume(b) * (PGM_COST_INDEX[b.type] ?? 0.5);
    }, 0);
    const normalizedPgmCost = Math.round(pgmCostIndex / 10);

    const catalyticBricks = chain.filter((b) => b.type !== "DPF");
    const allBricksT50 = catalyticBricks.map((b) => {
      const vol = brickVolume(b);
      const gsa = brickGSA(b.cpsi, b.wallThickness_mil);
      const Q = system.exhaustFlow_kg_h / 3600 / 1.1;
      const T_K_ref = 300 + 273.15;
      const inl: Record<string, number> = {
        CO: (system.rawCO_ppm / 1e6) * (101325 / (8.314 * T_K_ref)),
        HC: (system.rawHC_ppm / 1e6) * (101325 / (8.314 * T_K_ref)),
        NO: (system.rawNOx_ppm / 1e6) * (101325 / (8.314 * T_K_ref)) * 0.9,
        NO2: (system.rawNOx_ppm / 1e6) * (101325 / (8.314 * T_K_ref)) * 0.1,
        O2: 0.1 * (101325 / (8.314 * T_K_ref)),
        H2O: 0.08 * (101325 / (8.314 * T_K_ref)),
        NH3: b.type === "SCR" || b.type === "ASC" ? (system.rawNOx_ppm / 1e6) * (101325 / (8.314 * T_K_ref)) * 1.05 : 0,
      };
      const f = b.formulation ?? PGM_FORMULATIONS[0];
      const data = conversionTemperatureSweep(b.type, vol, gsa, Q, inl, f, [100, 600], 20);
      return findLightOff(data, "CO");
    });
    const maxT50 = allBricksT50.length > 0 ? Math.max(...allBricksT50) : 999;
    const systemStatus: "Active" | "Warming Up" | "Cold" =
      system.exhaustTemp_C > maxT50 + 50 ? "Active" :
      system.exhaustTemp_C > maxT50 - 30 ? "Warming Up" : "Cold";
    const statusColor = systemStatus === "Active" ? "text-green-400" : systemStatus === "Warming Up" ? "text-yellow-400" : "text-red-400";
    const statusBg = systemStatus === "Active" ? "bg-green-500/20" : systemStatus === "Warming Up" ? "bg-yellow-500/20" : "bg-red-500/20";

    return {
      totalVol,
      systemBackpressure,
      pressureDropPct,
      pressureDropColor,
      pressureDropBg,
      residenceTime_ms,
      normalizedPgmCost,
      systemStatus,
      statusColor,
      statusBg,
    };
  }, [chain, system]);

  // Light-off curves for selected brick
  const lightOffData = useMemo((): ConversionPoint[] => {
    const b = selectedBrick;
    if (b.type === "DPF") return [];
    const vol = brickVolume(b);
    const gsa = brickGSA(b.cpsi, b.wallThickness_mil);
    const Q = system.exhaustFlow_kg_h / 3600 / 1.1;
    const T_K = 300 + 273.15;
    const inlet: Record<string, number> = {
      CO: (system.rawCO_ppm / 1e6) * (101325 / (8.314 * T_K)),
      HC: (system.rawHC_ppm / 1e6) * (101325 / (8.314 * T_K)),
      NO: (system.rawNOx_ppm / 1e6) * (101325 / (8.314 * T_K)) * 0.9,
      NO2: (system.rawNOx_ppm / 1e6) * (101325 / (8.314 * T_K)) * 0.1,
      O2: 0.1 * (101325 / (8.314 * T_K)),
      H2O: 0.08 * (101325 / (8.314 * T_K)),
      NH3:
        b.type === "SCR" || b.type === "ASC"
          ? (system.rawNOx_ppm / 1e6) * (101325 / (8.314 * T_K)) * 1.05
          : 0,
    };
    const formulation = b.formulation ?? PGM_FORMULATIONS[0];
    return conversionTemperatureSweep(b.type, vol, gsa, Q, inlet, formulation, [100, 600], 40);
  }, [selectedBrick, system]);

  const t50 = useMemo(() => {
    if (lightOffData.length === 0) return { CO: 0, HC: 0, NOx: 0 };
    return {
      CO: Math.round(findLightOff(lightOffData, "CO")),
      HC: Math.round(findLightOff(lightOffData, "HC")),
      NOx: Math.round(findLightOff(lightOffData, "NOx")),
    };
  }, [lightOffData]);

  // Aged light-off data for fresh vs aged comparison
  const agedLightOff = useMemo(() => {
    const b = selectedBrick;
    if (b.type === "DPF" || lightOffData.length === 0) return { data: [] as ConversionPoint[], agingFactor: 1, t50Aged: { CO: 0, HC: 0, NOx: 0 } };

    const deactivationInput: DeactivationInputs = {
      catalystType: b.type,
      SO2_ppm: 10,
      operatingTemp_C: 400,
      maxTemp_C: 700,
      operatingHours: 5000,
      oilConsumption_g_kWh: 0.3,
      oilPhosphorus_ppm: 800,
      power_kW: system.ratedPower_kW,
      catalystVolume_L: brickVolume(b),
      fuelSulfur_ppm: 10,
    };
    const result = assessDeactivation(deactivationInput);
    const agingFactor = result.overallActivity;

    const agedData: ConversionPoint[] = lightOffData.map((pt) => ({
      ...pt,
      CO_conversion: pt.CO_conversion * agingFactor,
      HC_conversion: pt.HC_conversion * agingFactor,
      NOx_conversion: pt.NOx_conversion * agingFactor,
      NO2_make: pt.NO2_make * agingFactor,
    }));

    return {
      data: agedData,
      agingFactor,
      t50Aged: {
        CO: Math.round(findLightOff(agedData, "CO")),
        HC: Math.round(findLightOff(agedData, "HC")),
        NOx: Math.round(findLightOff(agedData, "NOx")),
      },
    };
  }, [selectedBrick, lightOffData, system.ratedPower_kW]);

  // Parametric sweep
  const sweepData = useMemo((): SweepPoint[] => {
    const b = selectedBrick;
    if (b.type === "DPF") return [];
    const ranges: Record<string, [number, number]> = {
      temperature: [100, 600],
      ghsv: [20000, 200000],
      pgm_loading: [10, 150],
      washcoat_thickness: [10, 100],
    };
    return runParametricSweep(b, system, sweepParam, ranges[sweepParam], 25);
  }, [selectedBrick, system, sweepParam]);

  // Run transient sim
  const runTransient = useCallback(async () => {
    setSimRunning(true);
    try {
      const firstCat = chain.find((b) => b.type !== "DPF") ?? chain[0];
      const washcoat: WashcoatType = firstCat.type === "SCR" ? "alumina" : "oxidation";
      const config: TransientSimConfig = {
        engine: {
          displacement_L: system.displacement_L,
          ratedPower_kW: system.ratedPower_kW,
          fuelType: system.fuelType,
          numberOfCylinders: system.numberOfCylinders,
          rawCO_ppm: system.rawCO_ppm,
          rawHC_ppm: system.rawHC_ppm,
          rawNOx_ppm: system.rawNOx_ppm,
          rawPM_mg_Nm3: system.rawPM_mg_Nm3,
        },
        catalyst: {
          cpsi: firstCat.cpsi,
          wallThickness_mil: firstCat.wallThickness_mil,
          washcoatType: washcoat,
          pgmLoading_g_ft3: firstCat.pgmLoading_g_ft3,
          diameter_mm: firstCat.diameter_mm,
          length_mm: firstCat.length_mm,
          splitConfig: "single",
        },
        emissionStandard: system.emissionStandard,
        agingHours: 5000,
        maxTemp_C: 700,
        fuelSulfur_ppm: 10,
      };

      // WLTP Class 3 cycle (simplified 1800s, key points)
      const wltpCycle: Array<{ time: number; speed: number; phase: string }> = [];
      const phases = [
        { name: "Low", dur: 589, maxSpd: 56.5 },
        { name: "Medium", dur: 433, maxSpd: 76.6 },
        { name: "High", dur: 455, maxSpd: 97.4 },
        { name: "Extra-High", dur: 323, maxSpd: 131.3 },
      ];
      let t = 0;
      for (const ph of phases) {
        for (let s = 0; s < ph.dur; s++) {
          const frac = s / ph.dur;
          const ramp = Math.sin(frac * Math.PI) * ph.maxSpd;
          const variation = Math.sin(frac * Math.PI * 8) * ph.maxSpd * 0.15;
          wltpCycle.push({ time: t, speed: Math.max(0, ramp + variation), phase: ph.name });
          t++;
        }
      }

      await new Promise((r) => setTimeout(r, 50));
      const result = runTransientWLTPSim(wltpCycle, config);
      setTransientResult(result);
    } finally {
      setSimRunning(false);
    }
  }, [chain, system]);

  // System summary
  const totalVolume = chain.reduce((s, b) => s + brickVolume(b), 0);
  const avgGHSV = chain.reduce((s, b) => {
    const vol = brickVolume(b);
    return s + (system.exhaustFlow_kg_h / 1.1 / vol);
  }, 0) / chain.length;

  return (
    <div className="flex flex-col gap-0 min-h-screen bg-background">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 border-b">
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        <div className="relative px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/30">
              <Activity className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">Catalyst Predictor</h1>
                <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-300">1D Reactor Model</Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                AxiSuite-class aftertreatment simulation — reactor profiles, light-off analysis, transient cycles, parametric studies
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — System Definition */}
        <div className="w-80 border-r bg-muted/30 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Engine */}
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5" /> Engine
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              <div>
                <Label className="text-[10px]">Preset</Label>
                <Select onValueChange={(v) => applyPreset(parseInt(v))}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Select engine..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ENGINE_PRESETS.map((p, i) => (
                      <SelectItem key={i} value={String(i)} className="text-xs">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Displ. [L]</Label>
                  <Input
                    type="number"
                    className="h-7 text-xs"
                    value={system.displacement_L}
                    onChange={(e) => setSystem((s) => ({ ...s, displacement_L: +e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Power [kW]</Label>
                  <Input
                    type="number"
                    className="h-7 text-xs"
                    value={system.ratedPower_kW}
                    onChange={(e) => setSystem((s) => ({ ...s, ratedPower_kW: +e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Fuel</Label>
                  <Select
                    value={system.fuelType}
                    onValueChange={(v) => setSystem((s) => ({ ...s, fuelType: v as "diesel" | "gasoline" }))}
                  >
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diesel" className="text-xs">Diesel</SelectItem>
                      <SelectItem value="gasoline" className="text-xs">Gasoline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px]">Standard</Label>
                  <Select
                    value={system.emissionStandard}
                    onValueChange={(v) => setSystem((s) => ({ ...s, emissionStandard: v as WLTPEmissionStandard }))}
                  >
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="euro_6d_diesel" className="text-xs">Euro 6d Diesel</SelectItem>
                      <SelectItem value="euro_6d_gasoline" className="text-xs">Euro 6d Gasoline</SelectItem>
                      <SelectItem value="euro_5_diesel" className="text-xs">Euro 5 Diesel</SelectItem>
                      <SelectItem value="euro_5_gasoline" className="text-xs">Euro 5 Gasoline</SelectItem>
                      <SelectItem value="euro_4" className="text-xs">Euro 4</SelectItem>
                      <SelectItem value="euro_3" className="text-xs">Euro 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-[10px]">Exhaust Temp [°C]: {system.exhaustTemp_C}</Label>
                <Slider
                  value={[system.exhaustTemp_C]}
                  onValueChange={([v]) => setSystem((s) => ({ ...s, exhaustTemp_C: v }))}
                  min={100}
                  max={700}
                  step={5}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[10px]">Exhaust Flow [kg/h]: {system.exhaustFlow_kg_h}</Label>
                <Slider
                  value={[system.exhaustFlow_kg_h]}
                  onValueChange={([v]) => setSystem((s) => ({ ...s, exhaustFlow_kg_h: v }))}
                  min={100}
                  max={3000}
                  step={10}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">CO [ppm]</Label>
                  <Input type="number" className="h-7 text-xs" value={system.rawCO_ppm}
                    onChange={(e) => setSystem((s) => ({ ...s, rawCO_ppm: +e.target.value }))} />
                </div>
                <div>
                  <Label className="text-[10px]">HC [ppm]</Label>
                  <Input type="number" className="h-7 text-xs" value={system.rawHC_ppm}
                    onChange={(e) => setSystem((s) => ({ ...s, rawHC_ppm: +e.target.value }))} />
                </div>
                <div>
                  <Label className="text-[10px]">NOₓ [ppm]</Label>
                  <Input type="number" className="h-7 text-xs" value={system.rawNOx_ppm}
                    onChange={(e) => setSystem((s) => ({ ...s, rawNOx_ppm: +e.target.value }))} />
                </div>
                <div>
                  <Label className="text-[10px]">PM [mg/Nm³]</Label>
                  <Input type="number" className="h-7 text-xs" value={system.rawPM_mg_Nm3}
                    onChange={(e) => setSystem((s) => ({ ...s, rawPM_mg_Nm3: +e.target.value }))} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Aftertreatment Chain */}
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Aftertreatment Chain
              </CardTitle>
              <CardDescription className="text-[10px]">
                Total: {chain.length} bricks &middot; {totalVolume.toFixed(1)} L &middot; avg GHSV {Math.round(avgGHSV).toLocaleString()} h⁻¹
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-1.5">
              {chain.map((brick, i) => (
                <div
                  key={brick.id}
                  className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                    selectedBrickIdx === i
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-border hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedBrickIdx(i)}
                >
                  <div
                    className="w-3 h-8 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: BRICK_COLORS[brick.type] }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium">{brick.type}</span>
                      {i < chain.length - 1 && (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      ⌀{brick.diameter_mm}×{brick.length_mm}mm &middot; {brick.cpsi}cpsi &middot;{" "}
                      {brickVolume(brick).toFixed(1)}L
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBrick(i);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-1 pt-1">
                {(["DOC", "DPF", "SCR", "ASC", "TWC"] as CatalystType[]).map((t) => (
                  <Button
                    key={t}
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => addBrick(t)}
                  >
                    <Plus className="h-3 w-3 mr-0.5" />
                    {t}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Selected Brick Properties */}
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                <Settings2 className="h-3.5 w-3.5" />
                {selectedBrick.type} Properties
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Diameter [mm]</Label>
                  <Input
                    type="number"
                    className="h-7 text-xs"
                    value={selectedBrick.diameter_mm}
                    onChange={(e) => updateBrick(selectedBrickIdx, { diameter_mm: +e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Length [mm]</Label>
                  <Input
                    type="number"
                    className="h-7 text-xs"
                    value={selectedBrick.length_mm}
                    onChange={(e) => updateBrick(selectedBrickIdx, { length_mm: +e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">CPSI</Label>
                  <Input
                    type="number"
                    className="h-7 text-xs"
                    value={selectedBrick.cpsi}
                    onChange={(e) => updateBrick(selectedBrickIdx, { cpsi: +e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Wall [mil]</Label>
                  <Input
                    type="number"
                    className="h-7 text-xs"
                    value={selectedBrick.wallThickness_mil}
                    onChange={(e) => updateBrick(selectedBrickIdx, { wallThickness_mil: +e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-[10px]">PGM Loading [g/ft³]: {selectedBrick.pgmLoading_g_ft3}</Label>
                <Slider
                  value={[selectedBrick.pgmLoading_g_ft3]}
                  onValueChange={([v]) => updateBrick(selectedBrickIdx, { pgmLoading_g_ft3: v })}
                  min={0}
                  max={200}
                  step={5}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[10px]">Washcoat Thickness [µm]: {selectedBrick.washcoatThickness_um}</Label>
                <Slider
                  value={[selectedBrick.washcoatThickness_um]}
                  onValueChange={([v]) => updateBrick(selectedBrickIdx, { washcoatThickness_um: v })}
                  min={10}
                  max={100}
                  step={5}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[10px]">Formulation</Label>
                <Select
                  value={selectedBrick.formulation?.id ?? ""}
                  onValueChange={(v) => {
                    const f = PGM_FORMULATIONS.find((p) => p.id === v);
                    if (f) updateBrick(selectedBrickIdx, { formulation: f });
                  }}
                >
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {PGM_FORMULATIONS.filter((f) => f.catalystTypes.includes(selectedBrick.type)).map((f) => (
                      <SelectItem key={f.id} value={f.id} className="text-xs">{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-[10px] text-muted-foreground space-y-0.5 pt-1 border-t">
                <div>Volume: <strong>{brickVolume(selectedBrick).toFixed(2)} L</strong></div>
                <div>GSA: <strong>{brickGSA(selectedBrick.cpsi, selectedBrick.wallThickness_mil).toFixed(1)} m²/L</strong></div>
                <div>GHSV: <strong>{Math.round(system.exhaustFlow_kg_h / 1.1 / brickVolume(selectedBrick)).toLocaleString()} h⁻¹</strong></div>
                <div>Residence Time: <strong>{((brickVolume(selectedBrick) * 1e-3) / (system.exhaustFlow_kg_h / 3600 / 1.1) * 1000).toFixed(1)} ms</strong></div>
                {(() => {
                  const cellDensity = selectedBrick.cpsi / 6.4516e-4;
                  const wallM = selectedBrick.wallThickness_mil * 25.4e-6;
                  const pitch = 1 / Math.sqrt(cellDensity);
                  const channelSide = pitch - wallM;
                  const ofs = Math.pow(channelSide / pitch, 2) * 100;
                  return <div>Open Frontal Area: <strong>{ofs.toFixed(1)}%</strong></div>;
                })()}
                <div>ΔP Estimate: <strong>{((0.5 + (system.exhaustFlow_kg_h / 1.1 / brickVolume(selectedBrick)) / 100000 * 2.5) * (selectedBrick.length_mm / 152)).toFixed(2)} kPa</strong></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main content — Analysis tabs */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* System diagram bar */}
          <div className="mb-4 p-3 bg-muted/30 rounded-lg border">
            <div className="flex items-center gap-1">
              <div className="text-[10px] text-muted-foreground font-medium mr-2">
                ENGINE<br />
                <span className="text-foreground">{system.displacement_L}L {system.fuelType}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              {chain.map((b, i) => (
                <div key={b.id} className="flex items-center gap-1">
                  <div
                    className={`px-3 py-1.5 rounded text-[10px] font-bold text-white cursor-pointer transition-all ${
                      selectedBrickIdx === i ? "ring-2 ring-offset-1 ring-blue-500" : ""
                    }`}
                    style={{ backgroundColor: BRICK_COLORS[b.type] }}
                    onClick={() => setSelectedBrickIdx(i)}
                  >
                    {b.type}
                    <div className="text-[8px] font-normal opacity-80">
                      {brickVolume(b).toFixed(1)}L
                    </div>
                  </div>
                  {i < chain.length - 1 && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              ))}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <div className="text-[10px] text-muted-foreground font-medium">TAILPIPE</div>
            </div>
          </div>

          {/* KPI Dashboard Strip */}
          <div className="mb-4 flex gap-2">
            <div className="flex-1 p-2 border rounded-lg bg-muted/20">
              <div className="flex items-center gap-1.5">
                <Layers className="h-3 w-3 text-blue-400" />
                <span className="text-[10px] text-muted-foreground">Total Volume</span>
              </div>
              <div className="text-sm font-bold mt-0.5">{systemKPIs.totalVol.toFixed(1)} L</div>
            </div>
            <div className="flex-1 p-2 border rounded-lg bg-muted/20">
              <div className="flex items-center gap-1.5">
                <Gauge className="h-3 w-3 text-orange-400" />
                <span className="text-[10px] text-muted-foreground">Backpressure</span>
              </div>
              <div className="text-sm font-bold mt-0.5">{systemKPIs.systemBackpressure.toFixed(1)} kPa</div>
            </div>
            <div className={`flex-1 p-2 border rounded-lg ${systemKPIs.pressureDropBg}`}>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-yellow-400" />
                <span className="text-[10px] text-muted-foreground">ΔP Budget</span>
              </div>
              <div className={`text-sm font-bold mt-0.5 ${systemKPIs.pressureDropColor}`}>{systemKPIs.pressureDropPct.toFixed(0)}% of 15 kPa</div>
            </div>
            <div className="flex-1 p-2 border rounded-lg bg-muted/20">
              <div className="flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-purple-400" />
                <span className="text-[10px] text-muted-foreground">Residence Time</span>
              </div>
              <div className="text-sm font-bold mt-0.5">{systemKPIs.residenceTime_ms.toFixed(1)} ms</div>
            </div>
            <div className="flex-1 p-2 border rounded-lg bg-muted/20">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3 text-emerald-400" />
                <span className="text-[10px] text-muted-foreground">PGM Cost Index</span>
              </div>
              <div className="text-sm font-bold mt-0.5">{systemKPIs.normalizedPgmCost}</div>
            </div>
            <div className={`flex-1 p-2 border rounded-lg ${systemKPIs.statusBg}`}>
              <div className="flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-green-400" />
                <span className="text-[10px] text-muted-foreground">System Status</span>
              </div>
              <div className={`text-sm font-bold mt-0.5 ${systemKPIs.statusColor}`}>{systemKPIs.systemStatus}</div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="system" className="text-xs gap-1">
                <Layers className="h-3.5 w-3.5" /> System
              </TabsTrigger>
              <TabsTrigger value="reactor" className="text-xs gap-1">
                <BarChart3 className="h-3.5 w-3.5" /> Reactor Profiles
              </TabsTrigger>
              <TabsTrigger value="lightoff" className="text-xs gap-1">
                <Thermometer className="h-3.5 w-3.5" /> Light-off / T₅₀
              </TabsTrigger>
              <TabsTrigger value="transient" className="text-xs gap-1">
                <Activity className="h-3.5 w-3.5" /> Transient Cycle
              </TabsTrigger>
              <TabsTrigger value="parametric" className="text-xs gap-1">
                <TrendingUp className="h-3.5 w-3.5" /> Parametric Study
              </TabsTrigger>
              <TabsTrigger value="engineering" className="text-xs gap-1">
                <Settings2 className="h-3.5 w-3.5" /> Engineering
              </TabsTrigger>
            </TabsList>

            {/* ─── System Overview ──────────────────────────────────── */}
            <TabsContent value="system">
              <div className="space-y-4">
                {/* Waterfall / stacked bar chart — species reduction per brick */}
                <Card>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm">Species Reduction Waterfall — Per-Brick Contribution</CardTitle>
                    <CardDescription className="text-[10px]">
                      Stacked bar showing each brick&apos;s contribution to total conversion of CO, HC, NOₓ
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    {(() => {
                      const waterfallData = ["CO", "HC", "NOx"].map((species) => {
                        const entry: Record<string, string | number> = { species };
                        let remaining = species === "CO" ? system.rawCO_ppm : species === "HC" ? system.rawHC_ppm : system.rawNOx_ppm;
                        const initial = remaining;
                        for (const { brick, profile } of reactorProfiles) {
                          if (brick.type === "DPF") {
                            entry[brick.type + "_" + brick.id] = 0;
                            continue;
                          }
                          const last = profile[profile.length - 1];
                          const convPct = species === "CO" ? last.CO_pct : species === "HC" ? last.HC_pct : last.NOx_pct;
                          const removed = remaining * (convPct / 100);
                          entry[brick.type + "_" + brick.id] = initial > 0 ? (removed / initial) * 100 : 0;
                          remaining -= removed;
                        }
                        return entry;
                      });
                      return (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={waterfallData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#94A3B8" }} label={{ value: "Conversion Contribution [%]", fontSize: 10, position: "bottom" }} />
                            <YAxis type="category" dataKey="species" tick={{ fontSize: 10, fill: "#94A3B8" }} width={40} />
                            <Tooltip contentStyle={{ fontSize: 11, backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }} />
                            <Legend wrapperStyle={{ fontSize: 10, color: "#CBD5E1" }} />
                            {chain.map((b) => (
                              <Bar key={b.id} dataKey={b.type + "_" + b.id} name={b.type} fill={BRICK_COLORS[b.type]} stackId="stack" />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {/* System summary table */}
                  <Card>
                    <CardHeader className="p-3 pb-2">
                      <CardTitle className="text-sm">System Summary — Per-Brick</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px]">Brick</TableHead>
                            <TableHead className="text-[10px] text-right">Vol [L]</TableHead>
                            <TableHead className="text-[10px] text-right">GHSV [h⁻¹]</TableHead>
                            <TableHead className="text-[10px] text-right">CO [%]</TableHead>
                            <TableHead className="text-[10px] text-right">HC [%]</TableHead>
                            <TableHead className="text-[10px] text-right">NOₓ [%]</TableHead>
                            <TableHead className="text-[10px] text-right">ΔP [kPa]</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reactorProfiles.map(({ brick, profile }) => {
                            const vol = brickVolume(brick);
                            const ghsv = Math.round(system.exhaustFlow_kg_h / 1.1 / vol);
                            const last = profile[profile.length - 1];
                            const dp = (0.5 + ghsv / 100000 * 2.5) * (brick.length_mm / 152);
                            return (
                              <TableRow key={brick.id}>
                                <TableCell className="text-xs font-medium">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: BRICK_COLORS[brick.type] }} />
                                    {brick.type}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs text-right">{vol.toFixed(1)}</TableCell>
                                <TableCell className="text-xs text-right">{ghsv.toLocaleString()}</TableCell>
                                <TableCell className="text-xs text-right">{brick.type !== "DPF" ? last.CO_pct.toFixed(1) : "—"}</TableCell>
                                <TableCell className="text-xs text-right">{brick.type !== "DPF" ? last.HC_pct.toFixed(1) : "—"}</TableCell>
                                <TableCell className="text-xs text-right">{last.NOx_pct.toFixed(1)}</TableCell>
                                <TableCell className="text-xs text-right">{dp.toFixed(2)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* Pressure drop budget bar */}
                  <Card>
                    <CardHeader className="p-3 pb-2">
                      <CardTitle className="text-sm">Pressure Drop Budget</CardTitle>
                      <CardDescription className="text-[10px]">
                        Per-brick contribution to total backpressure (max 15 kPa)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 space-y-3">
                      {chain.map((b) => {
                        const vol = brickVolume(b);
                        const ghsv = system.exhaustFlow_kg_h / 1.1 / vol;
                        const dp = (0.5 + ghsv / 100000 * 2.5) * (b.length_mm / 152);
                        const pct = (dp / 15) * 100;
                        return (
                          <div key={b.id} className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: BRICK_COLORS[b.type] }} />
                                <span className="font-medium">{b.type}</span>
                              </div>
                              <span>{dp.toFixed(2)} kPa ({pct.toFixed(0)}%)</span>
                            </div>
                            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${Math.min(100, pct)}%`, backgroundColor: BRICK_COLORS[b.type] }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-between text-[10px] pt-2 border-t">
                        <span className="font-semibold">Total</span>
                        <span className={`font-bold ${systemKPIs.pressureDropColor}`}>
                          {systemKPIs.systemBackpressure.toFixed(2)} kPa / 15.00 kPa ({systemKPIs.pressureDropPct.toFixed(0)}%)
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* ─── Reactor Profiles ──────────────────────────────────── */}
            <TabsContent value="reactor">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {reactorProfiles.map(({ brick, profile }, bIdx) => (
                  <Card key={brick.id} className={selectedBrickIdx === bIdx ? "ring-2 ring-blue-500" : ""}>
                    <CardHeader className="p-3 pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: BRICK_COLORS[brick.type] }} />
                        {brick.type} — Axial Conversion Profile
                      </CardTitle>
                      <CardDescription className="text-[10px]">
                        ⌀{brick.diameter_mm}×{brick.length_mm}mm &middot; {brickVolume(brick).toFixed(1)}L &middot;
                        GHSV {Math.round(system.exhaustFlow_kg_h / 1.1 / brickVolume(brick)).toLocaleString()} h⁻¹
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <ResponsiveContainer width="100%" height={220}>
                        <ComposedChart data={profile} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                          <XAxis dataKey="position_mm" tick={{ fontSize: 10, fill: "#94A3B8" }} tickFormatter={(v: number) => Math.round(v).toString()} label={{ value: "Position [mm]", fontSize: 10, position: "bottom" }} />
                          <YAxis yAxisId="conv" domain={[0, 100]} tick={{ fontSize: 10, fill: "#94A3B8" }} label={{ value: "Conversion [%]", angle: -90, fontSize: 10, position: "insideLeft" }} />
                          <YAxis yAxisId="temp" orientation="right" domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "#94A3B8" }} label={{ value: "T [°C]", angle: 90, fontSize: 10, position: "insideRight" }} />
                          <Tooltip contentStyle={{ fontSize: 11, backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }} />
                          <Legend wrapperStyle={{ fontSize: 10, color: "#CBD5E1" }} />
                          {brick.type !== "DPF" && (
                            <>
                              <Area yAxisId="conv" type="monotone" dataKey="CO_pct" name="CO [%]" stroke={SPECIES_COLORS.CO} fill={SPECIES_COLORS.CO} fillOpacity={0.1} strokeWidth={2} dot={false} />
                              <Area yAxisId="conv" type="monotone" dataKey="HC_pct" name="HC [%]" stroke={SPECIES_COLORS.HC} fill={SPECIES_COLORS.HC} fillOpacity={0.1} strokeWidth={2} dot={false} />
                            </>
                          )}
                          <Area yAxisId="conv" type="monotone" dataKey="NOx_pct" name={brick.type === "DPF" ? "PM Filt. [%]" : "NOₓ [%]"} stroke={SPECIES_COLORS.NOx} fill={SPECIES_COLORS.NOx} fillOpacity={0.1} strokeWidth={2} dot={false} />
                          <Line yAxisId="temp" type="monotone" dataKey="T_C" name="Temp [°C]" stroke="#F97316" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                      <div className="flex gap-3 mt-2 text-[10px]">
                        {brick.type !== "DPF" && (
                          <>
                            <span>CO exit: <strong className="text-red-400">{profile[profile.length - 1].CO_pct}%</strong></span>
                            <span>HC exit: <strong className="text-yellow-400">{profile[profile.length - 1].HC_pct}%</strong></span>
                          </>
                        )}
                        <span>{brick.type === "DPF" ? "PM Filt." : "NOₓ"} exit: <strong className="text-blue-400">{profile[profile.length - 1].NOx_pct}%</strong></span>
                        <span>T out: <strong className="text-orange-400">{profile[profile.length - 1].T_C}°C</strong></span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* ─── Light-off / T₅₀ ───────────────────────────────────── */}
            <TabsContent value="lightoff">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <Card className="xl:col-span-2">
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm">Conversion vs Temperature — {selectedBrick.type}</CardTitle>
                    <CardDescription className="text-[10px]">
                      Light-off curves using Langmuir–Hinshelwood / Eley–Rideal kinetics &middot; {selectedBrick.formulation?.name ?? "Default"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    {lightOffData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={350}>
                        <LineChart
                          data={lightOffData.map((pt, idx) => ({
                            ...pt,
                            CO_aged: agedLightOff.data[idx]?.CO_conversion ?? 0,
                            HC_aged: agedLightOff.data[idx]?.HC_conversion ?? 0,
                            NOx_aged: agedLightOff.data[idx]?.NOx_conversion ?? 0,
                          }))}
                          margin={{ top: 5, right: 5, bottom: 5, left: -10 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                          <XAxis dataKey="temperature_C" tick={{ fontSize: 10, fill: "#94A3B8" }} tickFormatter={(v: number) => Math.round(v).toString()} label={{ value: "Temperature [°C]", fontSize: 10, position: "bottom" }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94A3B8" }} label={{ value: "Conversion [%]", angle: -90, fontSize: 10, position: "insideLeft" }} />
                          <Tooltip contentStyle={{ fontSize: 11, backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }} />
                          <Legend wrapperStyle={{ fontSize: 10, color: "#CBD5E1" }} />
                          <ReferenceLine y={50} stroke="#6B7280" strokeDasharray="3 3" label={{ value: "T₅₀", fontSize: 10, position: "right" }} />
                          <ReferenceLine x={system.exhaustTemp_C} stroke="#F97316" strokeDasharray="3 3" label={{ value: `T_exh = ${system.exhaustTemp_C}°C`, fontSize: 9, position: "top" }} />
                          <Line type="monotone" dataKey="CO_conversion" name="CO Fresh [%]" stroke={SPECIES_COLORS.CO} strokeWidth={2.5} dot={false} />
                          <Line type="monotone" dataKey="HC_conversion" name="HC Fresh [%]" stroke={SPECIES_COLORS.HC} strokeWidth={2.5} dot={false} />
                          <Line type="monotone" dataKey="NOx_conversion" name="NOₓ Fresh [%]" stroke={SPECIES_COLORS.NOx} strokeWidth={2.5} dot={false} />
                          <Line type="monotone" dataKey="CO_aged" name="CO Aged [%]" stroke={SPECIES_COLORS.CO} strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                          <Line type="monotone" dataKey="HC_aged" name="HC Aged [%]" stroke={SPECIES_COLORS.HC} strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                          <Line type="monotone" dataKey="NOx_aged" name="NOₓ Aged [%]" stroke={SPECIES_COLORS.NOx} strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[350px] flex items-center justify-center text-sm text-muted-foreground">
                        DPF — filtration efficiency is not kinetics-dependent. Select a catalytic brick.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm">T₅₀ Light-off Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-3">
                    {selectedBrick.type !== "DPF" ? (
                      <>
                        <div className="space-y-2">
                          {(["CO", "HC", "NOx"] as const).map((sp) => (
                            <div key={sp} className="flex items-center justify-between p-2 rounded border">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SPECIES_COLORS[sp] }} />
                                <span className="text-xs font-medium">{sp === "NOx" ? "NOₓ" : sp}</span>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold">{t50[sp]}°C</div>
                                <div className="text-[10px] text-muted-foreground">
                                  Aged: <strong>{agedLightOff.t50Aged[sp]}°C</strong>
                                  {" · "}
                                  {t50[sp] < system.exhaustTemp_C ? (
                                    <span className="text-green-400">Active ✓</span>
                                  ) : (
                                    <span className="text-red-400">Below T₅₀ ✗</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Aging summary card */}
                        <div className="p-2 rounded border bg-orange-500/5 border-orange-500/20 space-y-1 text-[10px]">
                          <div className="font-semibold text-orange-400">Aging Assessment</div>
                          <div className="text-muted-foreground">Activity: <strong className="text-foreground">{(agedLightOff.agingFactor * 100).toFixed(1)}%</strong></div>
                          <div className="text-muted-foreground">Conditions: <strong className="text-foreground">5000 h, 700°C max, 10 ppm S</strong></div>
                          <div className="text-muted-foreground">ΔT₅₀ CO: <strong className="text-foreground">+{agedLightOff.t50Aged.CO - t50.CO}°C</strong></div>
                        </div>
                        <div className="border-t pt-2 space-y-1 text-[10px] text-muted-foreground">
                          <div>Formulation: <strong>{selectedBrick.formulation?.name ?? "—"}</strong></div>
                          <div>PGM: <strong>{selectedBrick.formulation?.ratio ?? "—"} @ {selectedBrick.pgmLoading_g_ft3} g/ft³</strong></div>
                          <div>Washcoat: <strong>{selectedBrick.formulation?.washcoatComposition ?? "—"}</strong></div>
                          <div>Volume: <strong>{brickVolume(selectedBrick).toFixed(2)} L</strong></div>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        DPF uses wall-flow filtration, not kinetic light-off. Select DOC, SCR, ASC, or TWC.
                      </div>
                    )}

                    {/* Multi-brick T50 comparison */}
                    <div className="border-t pt-2">
                      <div className="text-[10px] font-semibold mb-2">All Bricks — T₅₀ CO</div>
                      <div className="space-y-1">
                        {chain.map((b, i) => {
                          if (b.type === "DPF") return (
                            <div key={b.id} className="flex items-center gap-2 text-[10px]">
                              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: BRICK_COLORS[b.type] }} />
                              <span>{b.type}</span>
                              <span className="text-muted-foreground ml-auto">N/A (filter)</span>
                            </div>
                          );
                          const vol = brickVolume(b);
                          const gsa = brickGSA(b.cpsi, b.wallThickness_mil);
                          const Q = system.exhaustFlow_kg_h / 3600 / 1.1;
                          const T_K = 300 + 273.15;
                          const inlet: Record<string, number> = {
                            CO: (system.rawCO_ppm / 1e6) * (101325 / (8.314 * T_K)),
                            HC: (system.rawHC_ppm / 1e6) * (101325 / (8.314 * T_K)),
                            NO: (system.rawNOx_ppm / 1e6) * (101325 / (8.314 * T_K)) * 0.9,
                            NO2: (system.rawNOx_ppm / 1e6) * (101325 / (8.314 * T_K)) * 0.1,
                            O2: 0.1 * (101325 / (8.314 * T_K)),
                            H2O: 0.08 * (101325 / (8.314 * T_K)),
                            NH3: b.type === "SCR" || b.type === "ASC" ? (system.rawNOx_ppm / 1e6) * (101325 / (8.314 * T_K)) * 1.05 : 0,
                          };
                          const f = b.formulation ?? PGM_FORMULATIONS[0];
                          const data = conversionTemperatureSweep(b.type, vol, gsa, Q, inlet, f, [100, 600], 30);
                          const t = Math.round(findLightOff(data, "CO"));
                          return (
                            <div key={b.id} className="flex items-center gap-2 text-[10px] cursor-pointer hover:bg-muted/50 rounded p-0.5" onClick={() => setSelectedBrickIdx(i)}>
                              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: BRICK_COLORS[b.type] }} />
                              <span className="font-medium">{b.type}</span>
                              <span className="text-muted-foreground">{t}°C</span>
                              <div className="flex-1" />
                              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (t / 600) * 100)}%`, backgroundColor: BRICK_COLORS[b.type] }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ─── Transient Cycle ────────────────────────────────────── */}
            <TabsContent value="transient">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Button onClick={runTransient} disabled={simRunning} className="gap-1.5">
                    {simRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Run WLTP Cycle
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {system.fuelType === "diesel" ? "Euro 6d Diesel" : "Euro 6d Gasoline"} &middot; WLTP Class 3
                  </span>
                  {transientResult && (
                    <div className="ml-auto">{verdictBadge(transientResult.overallVerdict)}</div>
                  )}
                </div>

                {transientResult ? (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {/* Speed + Temperature */}
                    <Card>
                      <CardHeader className="p-3 pb-2">
                        <CardTitle className="text-sm">Drive Cycle — Speed & Temperature</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <ResponsiveContainer width="100%" height={200}>
                          <ComposedChart data={downsample(transientResult.steps, 300)} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.5} />
                            <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#94A3B8" }} tickFormatter={(v: number) => Math.round(v).toString()} label={{ value: "Time [s]", fontSize: 9, position: "bottom" }} />
                            <YAxis yAxisId="spd" domain={[0, 140]} tick={{ fontSize: 9, fill: "#94A3B8" }} />
                            <YAxis yAxisId="tmp" orientation="right" tick={{ fontSize: 9, fill: "#94A3B8" }} />
                            <Tooltip contentStyle={{ fontSize: 10, backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }} />
                            <Legend wrapperStyle={{ fontSize: 9, color: "#CBD5E1" }} />
                            <Area yAxisId="spd" type="monotone" dataKey="speed_kmh" name="Speed [km/h]" stroke="#6366F1" fill="#6366F1" fillOpacity={0.15} strokeWidth={1} dot={false} />
                            <Line yAxisId="tmp" type="monotone" dataKey="catalystTemp_C" name="Cat T [°C]" stroke="#EF4444" strokeWidth={1.5} dot={false} />
                            <Line yAxisId="tmp" type="monotone" dataKey="exhaustTemp_C" name="Exh T [°C]" stroke="#F97316" strokeWidth={1} strokeDasharray="3 2" dot={false} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Conversion */}
                    <Card>
                      <CardHeader className="p-3 pb-2">
                        <CardTitle className="text-sm">Instantaneous Conversion</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={downsample(transientResult.steps, 300)} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.5} />
                            <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#94A3B8" }} tickFormatter={(v: number) => Math.round(v).toString()} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#94A3B8" }} />
                            <Tooltip contentStyle={{ fontSize: 10, backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }} />
                            <Legend wrapperStyle={{ fontSize: 9, color: "#CBD5E1" }} />
                            <Line type="monotone" dataKey="convCO_aged" name="CO [%]" stroke={SPECIES_COLORS.CO} strokeWidth={1.5} dot={false} />
                            <Line type="monotone" dataKey="convHC_aged" name="HC [%]" stroke={SPECIES_COLORS.HC} strokeWidth={1.5} dot={false} />
                            <Line type="monotone" dataKey="convNOx_aged" name="NOₓ [%]" stroke={SPECIES_COLORS.NOx} strokeWidth={1.5} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Cumulative Emissions */}
                    <Card>
                      <CardHeader className="p-3 pb-2">
                        <CardTitle className="text-sm">Cumulative Emissions [g/km]</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={downsample(transientResult.steps, 300)} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.5} />
                            <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#94A3B8" }} tickFormatter={(v: number) => Math.round(v).toString()} />
                            <YAxis tick={{ fontSize: 9, fill: "#94A3B8" }} />
                            <Tooltip contentStyle={{ fontSize: 10, backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }} />
                            <Legend wrapperStyle={{ fontSize: 9, color: "#CBD5E1" }} />
                            <Line type="monotone" dataKey="cumCO_g_km" name="CO [g/km]" stroke={SPECIES_COLORS.CO} strokeWidth={1.5} dot={false} />
                            <Line type="monotone" dataKey="cumHC_g_km" name="HC [g/km]" stroke={SPECIES_COLORS.HC} strokeWidth={1.5} dot={false} />
                            <Line type="monotone" dataKey="cumNOx_g_km" name="NOₓ [g/km]" stroke={SPECIES_COLORS.NOx} strokeWidth={1.5} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Homologation Table */}
                    <Card>
                      <CardHeader className="p-3 pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          Homologation Verdict
                          {verdictBadge(transientResult.overallVerdict)}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[10px]">Species</TableHead>
                              <TableHead className="text-[10px] text-right">Result [g/km]</TableHead>
                              <TableHead className="text-[10px] text-right">Limit [g/km]</TableHead>
                              <TableHead className="text-[10px] text-right">Margin</TableHead>
                              <TableHead className="text-[10px] text-right">Verdict</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {transientResult.homologation.map((h) => (
                              <TableRow key={h.species}>
                                <TableCell className="text-xs font-medium">{h.species}</TableCell>
                                <TableCell className="text-xs text-right">{h.cumulative_g_km.toFixed(4)}</TableCell>
                                <TableCell className="text-xs text-right">{h.limit_g_km.toFixed(4)}</TableCell>
                                <TableCell className="text-xs text-right">{h.margin_percent > 0 ? "+" : ""}{h.margin_percent.toFixed(1)}%</TableCell>
                                <TableCell className="text-right">{verdictBadge(h.verdict)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                          <div className="p-2 border rounded">
                            <div className="text-muted-foreground">Light-off</div>
                            <div className="font-bold">{transientResult.lightOffTime_s}s</div>
                          </div>
                          <div className="p-2 border rounded">
                            <div className="text-muted-foreground">Cold-start CO</div>
                            <div className="font-bold">{transientResult.coldStartPenalty_g_km.CO.toFixed(3)} g/km</div>
                          </div>
                          <div className="p-2 border rounded">
                            <div className="text-muted-foreground">Peak GHSV</div>
                            <div className="font-bold">{transientResult.peakGHSV_h.toLocaleString()} h⁻¹</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Phase Breakdown */}
                    <Card className="xl:col-span-2">
                      <CardHeader className="p-3 pb-2">
                        <CardTitle className="text-sm">Phase Breakdown</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[10px]">Phase</TableHead>
                              <TableHead className="text-[10px] text-right">Duration</TableHead>
                              <TableHead className="text-[10px] text-right">Distance</TableHead>
                              <TableHead className="text-[10px] text-right">Avg Cat T</TableHead>
                              <TableHead className="text-[10px] text-right">CO conv</TableHead>
                              <TableHead className="text-[10px] text-right">NOₓ conv</TableHead>
                              <TableHead className="text-[10px] text-right">CO [g/km]</TableHead>
                              <TableHead className="text-[10px] text-right">NOₓ [g/km]</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {transientResult.phases.map((p) => (
                              <TableRow key={p.phase}>
                                <TableCell className="text-xs font-medium">{p.phase}</TableCell>
                                <TableCell className="text-xs text-right">{p.duration_s}s</TableCell>
                                <TableCell className="text-xs text-right">{p.distance_km.toFixed(2)} km</TableCell>
                                <TableCell className="text-xs text-right">{Math.round(p.avgCatalystTemp_C)}°C</TableCell>
                                <TableCell className="text-xs text-right">{p.avgConvCO.toFixed(1)}%</TableCell>
                                <TableCell className="text-xs text-right">{p.avgConvNOx.toFixed(1)}%</TableCell>
                                <TableCell className="text-xs text-right">{p.CO_g_km.toFixed(4)}</TableCell>
                                <TableCell className="text-xs text-right">{p.NOx_g_km.toFixed(4)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Zap className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Click <strong>Run WLTP Cycle</strong> to simulate the full WLTP Class 3 transient cycle
                        with catalyst thermal inertia, kinetic conversion, and homologation assessment.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* ─── Parametric Study ──────────────────────────────────── */}
            <TabsContent value="parametric">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Label className="text-xs">Sweep Parameter:</Label>
                  <Select value={sweepParam} onValueChange={(v) => setSweepParam(v as typeof sweepParam)}>
                    <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="temperature" className="text-xs">Exhaust Temperature [°C]</SelectItem>
                      <SelectItem value="ghsv" className="text-xs">GHSV [h⁻¹]</SelectItem>
                      <SelectItem value="pgm_loading" className="text-xs">PGM Loading [g/ft³]</SelectItem>
                      <SelectItem value="washcoat_thickness" className="text-xs">Washcoat Thickness [µm]</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge variant="outline" className="text-[10px]">{selectedBrick.type}</Badge>
                  {selectedBrick.type === "DPF" && (
                    <span className="text-[10px] text-yellow-400">Select a catalytic brick for meaningful results</span>
                  )}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="p-3 pb-2">
                      <CardTitle className="text-sm">
                        Conversion vs {sweepParam === "temperature" ? "Temperature" : sweepParam === "ghsv" ? "GHSV" : sweepParam === "pgm_loading" ? "PGM Loading" : "Washcoat Thickness"}
                      </CardTitle>
                      <CardDescription className="text-[10px]">
                        {selectedBrick.type} — exit conversion at varying {sweepParam.replace("_", " ")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={sweepData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                          <XAxis dataKey="param" tick={{ fontSize: 10, fill: "#94A3B8" }} tickFormatter={(v: number) => typeof v === 'number' ? Math.round(v).toString() : String(v)} label={{
                            value: sweepParam === "temperature" ? "Temperature [°C]" : sweepParam === "ghsv" ? "GHSV [h⁻¹]" : sweepParam === "pgm_loading" ? "PGM Loading [g/ft³]" : "Washcoat Thickness [µm]",
                            fontSize: 10, position: "bottom"
                          }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94A3B8" }} label={{ value: "Conversion [%]", angle: -90, fontSize: 10, position: "insideLeft" }} />
                          <Tooltip contentStyle={{ fontSize: 11, backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }} />
                          <Legend wrapperStyle={{ fontSize: 10, color: "#CBD5E1" }} />
                          <Line type="monotone" dataKey="CO_conv" name="CO [%]" stroke={SPECIES_COLORS.CO} strokeWidth={2.5} dot={false} />
                          <Line type="monotone" dataKey="HC_conv" name="HC [%]" stroke={SPECIES_COLORS.HC} strokeWidth={2.5} dot={false} />
                          <Line type="monotone" dataKey="NOx_conv" name="NOₓ [%]" stroke={SPECIES_COLORS.NOx} strokeWidth={2.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="p-3 pb-2">
                      <CardTitle className="text-sm">
                        T₅₀ vs {sweepParam === "temperature" ? "Temperature" : sweepParam === "ghsv" ? "GHSV" : sweepParam === "pgm_loading" ? "PGM Loading" : "Washcoat Thickness"}
                      </CardTitle>
                      <CardDescription className="text-[10px]">
                        Light-off temperature (50% conversion) sensitivity
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={sweepData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                          <XAxis dataKey="param" tick={{ fontSize: 10, fill: "#94A3B8" }} tickFormatter={(v: number) => typeof v === 'number' ? Math.round(v).toString() : String(v)} />
                          <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} label={{ value: "T₅₀ [°C]", angle: -90, fontSize: 10, position: "insideLeft" }} />
                          <Tooltip contentStyle={{ fontSize: 11, backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }} />
                          <Legend wrapperStyle={{ fontSize: 10, color: "#CBD5E1" }} />
                          <Bar dataKey="T50_CO" name="T₅₀ CO" fill={SPECIES_COLORS.CO} opacity={0.8} />
                          <Bar dataKey="T50_HC" name="T₅₀ HC" fill={SPECIES_COLORS.HC} opacity={0.8} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* ─── Engineering ──────────────────────────────────────── */}
            <TabsContent value="engineering">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Section A — Kinetic Model Reference */}
                <Card className="xl:col-span-2">
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Settings2 className="h-4 w-4 text-blue-400" />
                      Kinetic Model Reference
                    </CardTitle>
                    <CardDescription className="text-[10px]">
                      Published rate expressions used in the 1D reactor model. All parameters are adjustable via brick formulation selection.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="space-y-4">
                      <div className="p-3 rounded-lg border bg-muted/20">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-sm bg-blue-500" />
                          <span className="text-xs font-semibold">DOC — Diesel Oxidation Catalyst</span>
                          <Badge variant="outline" className="text-[9px] ml-auto">Voltz et al. (1973), Oh & Cavendish (1982)</Badge>
                        </div>
                        <div className="text-[10px] text-muted-foreground space-y-1.5">
                          <div className="font-mono bg-background/50 p-2 rounded border text-[10px] leading-relaxed">
                            <div><span className="text-blue-400">Mechanism:</span> Langmuir–Hinshelwood competitive adsorption</div>
                            <div className="mt-1"><span className="text-emerald-400">CO oxidation:</span> r_CO = k_CO · C_CO · C_O₂ / G²</div>
                            <div><span className="text-emerald-400">HC oxidation:</span> r_HC = k_HC · C_HC · C_O₂ / G²</div>
                            <div><span className="text-emerald-400">NO → NO₂:</span> r_NO = k_NO · C_NO · C_O₂^0.5 / G²</div>
                            <div className="mt-1"><span className="text-amber-400">Inhibition:</span> G = T · (1 + K_CO·C_CO + K_HC·C_HC)² · (1 + 0.7·C_CO²·C_NO²)</div>
                            <div className="mt-1"><span className="text-rose-400">Arrhenius:</span> k_i = A_i · exp(-Ea_i / (R·T))</div>
                            <div><span className="text-rose-400">Adsorption:</span> K_i(T) = K_i,ref · exp((-ΔH_i/R) · (1/T − 1/T_ref))</div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            <div className="p-1.5 border rounded bg-background/30">
                              <div className="text-[9px] text-muted-foreground">A_CO</div>
                              <div className="font-mono text-[10px] font-semibold">2.0 × 10¹³</div>
                            </div>
                            <div className="p-1.5 border rounded bg-background/30">
                              <div className="text-[9px] text-muted-foreground">Ea_CO [kJ/mol]</div>
                              <div className="font-mono text-[10px] font-semibold">90.0</div>
                            </div>
                            <div className="p-1.5 border rounded bg-background/30">
                              <div className="text-[9px] text-muted-foreground">K_CO (@ 300°C)</div>
                              <div className="font-mono text-[10px] font-semibold">65.5</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg border bg-muted/20">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                          <span className="text-xs font-semibold">SCR — Selective Catalytic Reduction</span>
                          <Badge variant="outline" className="text-[9px] ml-auto">Tronconi et al. (2005), Nova et al. (2006)</Badge>
                        </div>
                        <div className="text-[10px] text-muted-foreground space-y-1.5">
                          <div className="font-mono bg-background/50 p-2 rounded border text-[10px] leading-relaxed">
                            <div><span className="text-blue-400">Mechanism:</span> Eley–Rideal on Cu-zeolite / V₂O₅-WO₃/TiO₂</div>
                            <div className="mt-1"><span className="text-emerald-400">Standard SCR:</span> 4NH₃ + 4NO + O₂ → 4N₂ + 6H₂O</div>
                            <div><span className="text-emerald-400">r_std = k_std · θ_NH₃ · C_NO</span></div>
                            <div className="mt-1"><span className="text-amber-400">Fast SCR:</span> 4NH₃ + 2NO + 2NO₂ → 4N₂ + 6H₂O</div>
                            <div><span className="text-amber-400">r_fast = k_fast · θ_NH₃ · C_NO · C_NO₂</span></div>
                            <div className="mt-1"><span className="text-rose-400">NH₃ coverage:</span> θ_NH₃ = K_ads · C_NH₃ / (1 + K_ads · C_NH₃)</div>
                            <div><span className="text-rose-400">NH₃ oxidation:</span> r_ox = k_ox · θ_NH₃ · C_O₂</div>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg border bg-muted/20">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-sm bg-red-500" />
                          <span className="text-xs font-semibold">TWC — Three-Way Catalyst</span>
                          <Badge variant="outline" className="text-[9px] ml-auto">Koltsakis & Stamatelos (1997)</Badge>
                        </div>
                        <div className="text-[10px] text-muted-foreground space-y-1.5">
                          <div className="font-mono bg-background/50 p-2 rounded border text-[10px] leading-relaxed">
                            <div><span className="text-blue-400">Mechanism:</span> Competitive Langmuir–Hinshelwood (3 simultaneous reactions)</div>
                            <div className="mt-1"><span className="text-emerald-400">CO + ½O₂ → CO₂</span></div>
                            <div><span className="text-emerald-400">HC + O₂ → CO₂ + H₂O</span></div>
                            <div><span className="text-amber-400">NO + CO → ½N₂ + CO₂</span></div>
                            <div className="mt-1"><span className="text-rose-400">Rate:</span> r_i = k_i · C_i / (1 + Σ K_j · C_j)²</div>
                            <div><span className="text-rose-400">Window:</span> λ = 0.97 – 1.03 (stoichiometric ± 3%)</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Section B — Live Calculation Breakdown */}
                <Card>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-emerald-400" />
                      Live Calculation — {selectedBrick.type}
                    </CardTitle>
                    <CardDescription className="text-[10px]">
                      Intermediate values computed in real-time for the selected brick
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    {(() => {
                      const vol = brickVolume(selectedBrick);
                      const gsa = brickGSA(selectedBrick.cpsi, selectedBrick.wallThickness_mil);
                      const Q = system.exhaustFlow_kg_h / 3600 / 1.1;
                      const T_K = system.exhaustTemp_C + 273.15;
                      const ghsv = system.exhaustFlow_kg_h / 1.1 / vol;
                      const cellDensity = selectedBrick.cpsi / 6.4516e-4;
                      const wallM = selectedBrick.wallThickness_mil * 25.4e-6;
                      const pitch = 1 / Math.sqrt(cellDensity);
                      const channelSide = pitch - wallM;
                      const d_h = channelSide;
                      const A_frontal = Math.PI * (selectedBrick.diameter_mm / 2000) ** 2;
                      const ofs = (channelSide / pitch) ** 2;
                      const Re = Q / (A_frontal * ofs) * d_h / (1.8e-5);
                      const tau_ms = (vol * 1e-3) / Q * 1000;
                      const dp = (0.5 + ghsv / 100000 * 2.5) * (selectedBrick.length_mm / 152);

                      return (
                        <div className="space-y-2 text-[10px]">
                          <div className="font-semibold text-xs text-muted-foreground border-b pb-1">Geometry</div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <div className="flex justify-between"><span className="text-muted-foreground">Cell density</span><span className="font-mono">{(cellDensity / 1e4).toFixed(0)} cells/cm²</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Pitch</span><span className="font-mono">{(pitch * 1000).toFixed(3)} mm</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Channel width</span><span className="font-mono">{(channelSide * 1000).toFixed(3)} mm</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Wall thickness</span><span className="font-mono">{(wallM * 1e6).toFixed(1)} µm</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Hydraulic diameter</span><span className="font-mono">{(d_h * 1000).toFixed(3)} mm</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Open frontal area</span><span className="font-mono">{(ofs * 100).toFixed(1)}%</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Frontal area</span><span className="font-mono">{(A_frontal * 1e4).toFixed(1)} cm²</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">GSA</span><span className="font-mono">{gsa.toFixed(2)} m²/L</span></div>
                          </div>

                          <div className="font-semibold text-xs text-muted-foreground border-b pb-1 mt-3">Flow Conditions</div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <div className="flex justify-between"><span className="text-muted-foreground">Volume flow (Q)</span><span className="font-mono">{Q.toFixed(4)} m³/s</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">GHSV</span><span className="font-mono">{Math.round(ghsv).toLocaleString()} h⁻¹</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Residence time (τ)</span><span className="font-mono">{tau_ms.toFixed(2)} ms</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Re (channel)</span><span className="font-mono">{Math.round(Re)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Gas temp (T)</span><span className="font-mono">{system.exhaustTemp_C}°C = {T_K.toFixed(1)} K</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">ΔP estimate</span><span className="font-mono">{dp.toFixed(2)} kPa</span></div>
                          </div>

                          <div className="font-semibold text-xs text-muted-foreground border-b pb-1 mt-3">Inlet Concentrations</div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <div className="flex justify-between"><span className="text-muted-foreground">CO</span><span className="font-mono">{system.rawCO_ppm} ppm = {((system.rawCO_ppm / 1e6) * (101325 / (8.314 * T_K))).toFixed(4)} mol/m³</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">HC</span><span className="font-mono">{system.rawHC_ppm} ppm = {((system.rawHC_ppm / 1e6) * (101325 / (8.314 * T_K))).toFixed(4)} mol/m³</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">NOₓ</span><span className="font-mono">{system.rawNOx_ppm} ppm = {((system.rawNOx_ppm / 1e6) * (101325 / (8.314 * T_K))).toFixed(4)} mol/m³</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">O₂</span><span className="font-mono">10% = {(0.1 * (101325 / (8.314 * T_K))).toFixed(2)} mol/m³</span></div>
                          </div>

                          <div className="font-semibold text-xs text-muted-foreground border-b pb-1 mt-3">Conversion Method</div>
                          <div className="font-mono bg-background/50 p-2 rounded border text-[9px] leading-relaxed">
                            <div>Plug-flow reactor model: dX/dz = r(C,T) · a_cat / (F · C_0)</div>
                            <div>Discretized to {20} axial steps over L = {selectedBrick.length_mm} mm</div>
                            <div>Effectiveness factor η = 0.7 (Thiele modulus approx.)</div>
                            <div>Washcoat diffusion: δ = {selectedBrick.washcoatThickness_um} µm</div>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Section C — Deactivation Models */}
                <Card>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      Deactivation Models
                    </CardTitle>
                    <CardDescription className="text-[10px]">
                      Catalyst aging mechanisms — Bartholomew (2001)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="space-y-3 text-[10px]">
                      <div className="font-mono bg-background/50 p-2 rounded border text-[10px] leading-relaxed">
                        <div><span className="text-blue-400">Overall activity:</span> a_total = a_S · a_P · a_thermal · a_chemical</div>
                        <div className="mt-1.5"><span className="text-emerald-400">Sulfur poisoning:</span></div>
                        <div className="pl-2">θ_S(t) = S_max · (1 − exp(−k_ads · C_SO₂ · t))</div>
                        <div className="pl-2">a_S = 1 − σ · θ_S / S_max</div>
                        <div className="pl-2">Regeneration: k_des = A_des · exp(−Ea_des / RT)</div>
                        <div className="mt-1.5"><span className="text-amber-400">Thermal sintering:</span></div>
                        <div className="pl-2">d(t) = d₀ · (1 + α · t · exp(−Ea_sinter / RT))^(1/n)</div>
                        <div className="pl-2">a_thermal = (d₀ / d(t))²</div>
                        <div className="mt-1.5"><span className="text-rose-400">Phosphorus fouling:</span></div>
                        <div className="pl-2">P_load(t) = ṁ_oil · x_P · t / V_cat</div>
                        <div className="pl-2">a_P = 1 − (P_load / P_max)^n_P</div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-1.5 border rounded bg-background/30">
                          <div className="text-[9px] text-muted-foreground">Current aging</div>
                          <div className="font-mono font-semibold">{(agedLightOff.agingFactor * 100).toFixed(1)}% activity</div>
                        </div>
                        <div className="p-1.5 border rounded bg-background/30">
                          <div className="text-[9px] text-muted-foreground">ΔT₅₀ CO (aged)</div>
                          <div className="font-mono font-semibold">+{agedLightOff.t50Aged.CO - t50.CO}°C</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Section D — Pressure Drop & Heat Transfer Models */}
                <Card className="xl:col-span-2">
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-orange-400" />
                      Pressure Drop & Heat Transfer Models
                    </CardTitle>
                    <CardDescription className="text-[10px]">
                      Substrate-level flow resistance and thermal calculations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div className="font-mono bg-background/50 p-2 rounded border text-[10px] leading-relaxed">
                        <div className="font-sans text-[10px] font-semibold text-muted-foreground mb-1">Pressure Drop (Hagen–Poiseuille + corrections)</div>
                        <div><span className="text-blue-400">Flow-through:</span> ΔP = 32 · µ · L · v / d_h² + K_inlet · ½ρv²</div>
                        <div><span className="text-amber-400">Wall-flow (DPF):</span> ΔP = ΔP_channel + ΔP_wall + ΔP_soot</div>
                        <div className="pl-2">ΔP_wall = µ · v_w · t_w / κ_wall</div>
                        <div className="pl-2">ΔP_soot = µ · v_w · t_soot / κ_soot</div>
                        <div className="mt-1.5"><span className="text-emerald-400">Simplified estimate used:</span></div>
                        <div className="pl-2">ΔP ≈ (0.5 + GHSV/10⁵ · 2.5) · (L/152mm) kPa</div>
                      </div>
                      <div className="font-mono bg-background/50 p-2 rounded border text-[10px] leading-relaxed">
                        <div className="font-sans text-[10px] font-semibold text-muted-foreground mb-1">Heat Transfer & Exotherm</div>
                        <div><span className="text-blue-400">Energy balance:</span></div>
                        <div className="pl-2">ṁ · c_p · dT/dz = −ΔH_rxn · r(C,T) · a_cat</div>
                        <div className="mt-1"><span className="text-emerald-400">CO oxidation:</span> ΔH = −283 kJ/mol</div>
                        <div><span className="text-emerald-400">HC oxidation:</span> ΔH = −800 kJ/mol (avg C₃)</div>
                        <div className="mt-1"><span className="text-amber-400">Temperature rise (simplified):</span></div>
                        <div className="pl-2">ΔT_CO ≈ X_CO × 40°C</div>
                        <div className="pl-2">ΔT_HC ≈ X_HC × 60°C</div>
                        <div className="mt-1"><span className="text-rose-400">Thermal mass:</span></div>
                        <div className="pl-2">m_sub · c_sub · dT_s/dt = h · A_s · (T_gas − T_s) + Q_rxn</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
