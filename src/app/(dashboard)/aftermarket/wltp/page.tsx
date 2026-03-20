"use client";

import React, { useState, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  Play,
  Upload,
  Thermometer,
  Gauge,
  Beaker,
  CheckCircle2,
  XCircle,
  Loader2,
  RotateCcw,
  FlaskConical,
  TrendingUp,
  AlertTriangle,
  Zap,
  Shield,
  Microscope,
  Activity,
  Database,
  Info,
} from "lucide-react";
import {
  runPreDevSweep,
  generateConfigMatrix,
  getDefaultWallThickness,
  type PreDevInput,
  type PreDevResult,
  type WashcoatType,
  type SplitConfig,
  type RAGVerdict,
} from "@/lib/catsizer/predev-engine";
import type { EmissionStandard } from "@/lib/catsizer/types";
import { AreaChart, Area } from "recharts";
import {
  runTransientWLTPSim,
  LIGHT_DUTY_PRESETS,
  WLTP_EMISSION_LIMITS,
  type TransientSimResult,
  type TransientSimConfig,
  type TransientCatalystConfig,
  type WLTPEmissionStandard,
} from "@/lib/catsizer/wltp-transient-engine";
import {
  type SGBenchData,
  type SGBSpeciesData,
  buildProfileFromSGB,
  validateSGBData,
  EXAMPLE_SGB_DOC,
  EXAMPLE_SGB_TWC,
} from "@/lib/catsizer/sgb-data";
import { type DetailedCatalystProfile } from "@/lib/catsizer/catalyst-profiles";
import {
  getAIOptimizationAdvice,
} from "@/lib/ai/catalyst-advisor";
import type {
  AIAdvisorResponse,
  AIAdvisorRecommendation,
} from "@/lib/ai/types";
import { useSharedCatalyst } from "@/lib/catsizer/shared-catalyst-context";
import { LightOffCurveChart } from "@/app/(dashboard)/aftermarket/homologation-copilot/wizard-charts";

// ─── Euro 6d-ISC Limits (g/km) ───────────────────────────────────────────────
const EURO_LIMITS = {
  CO: 1.0,
  THC: 0.1,
  NOx: 0.06,
  PM: 0.005,
};

// ─── Built-in Drive Cycle Data ────────────────────────────────────────────────

interface CyclePoint {
  time: number;
  speed: number;
  phase?: string;
}

function interpolateCycle(keypoints: CyclePoint[], totalTime: number): CyclePoint[] {
  const result: CyclePoint[] = [];
  for (let t = 0; t <= totalTime; t++) {
    let i = 0;
    while (i < keypoints.length - 1 && keypoints[i + 1].time <= t) i++;
    if (i >= keypoints.length - 1) {
      result.push({ time: t, speed: keypoints[keypoints.length - 1].speed, phase: keypoints[keypoints.length - 1].phase });
      continue;
    }
    const t0 = keypoints[i].time;
    const t1 = keypoints[i + 1].time;
    const s0 = keypoints[i].speed;
    const s1 = keypoints[i + 1].speed;
    const frac = (t - t0) / (t1 - t0);
    const speed = s0 + frac * (s1 - s0);
    result.push({ time: t, speed: Math.max(0, speed), phase: keypoints[i].phase });
  }
  return result;
}

const WLTP_CLASS3_KEYPOINTS: CyclePoint[] = [
  // Low phase (0-589s)
  { time: 0, speed: 0, phase: "Low" },
  { time: 10, speed: 0, phase: "Low" },
  { time: 30, speed: 25, phase: "Low" },
  { time: 60, speed: 35, phase: "Low" },
  { time: 90, speed: 0, phase: "Low" },
  { time: 110, speed: 20, phase: "Low" },
  { time: 150, speed: 45, phase: "Low" },
  { time: 200, speed: 30, phase: "Low" },
  { time: 250, speed: 50, phase: "Low" },
  { time: 300, speed: 35, phase: "Low" },
  { time: 350, speed: 0, phase: "Low" },
  { time: 380, speed: 40, phase: "Low" },
  { time: 430, speed: 55, phase: "Low" },
  { time: 480, speed: 25, phase: "Low" },
  { time: 530, speed: 48, phase: "Low" },
  { time: 570, speed: 30, phase: "Low" },
  { time: 589, speed: 0, phase: "Low" },
  // Medium phase (589-1022s)
  { time: 590, speed: 0, phase: "Medium" },
  { time: 620, speed: 40, phase: "Medium" },
  { time: 660, speed: 60, phase: "Medium" },
  { time: 700, speed: 45, phase: "Medium" },
  { time: 740, speed: 70, phase: "Medium" },
  { time: 790, speed: 55, phase: "Medium" },
  { time: 840, speed: 75, phase: "Medium" },
  { time: 890, speed: 50, phase: "Medium" },
  { time: 940, speed: 65, phase: "Medium" },
  { time: 990, speed: 40, phase: "Medium" },
  { time: 1022, speed: 0, phase: "Medium" },
  // High phase (1022-1477s)
  { time: 1023, speed: 0, phase: "High" },
  { time: 1060, speed: 55, phase: "High" },
  { time: 1100, speed: 80, phase: "High" },
  { time: 1150, speed: 95, phase: "High" },
  { time: 1200, speed: 70, phase: "High" },
  { time: 1250, speed: 100, phase: "High" },
  { time: 1300, speed: 85, phase: "High" },
  { time: 1350, speed: 97, phase: "High" },
  { time: 1400, speed: 75, phase: "High" },
  { time: 1450, speed: 90, phase: "High" },
  { time: 1477, speed: 0, phase: "High" },
  // Extra High phase (1477-1800s)
  { time: 1478, speed: 0, phase: "Extra High" },
  { time: 1510, speed: 70, phase: "Extra High" },
  { time: 1550, speed: 110, phase: "Extra High" },
  { time: 1590, speed: 130, phase: "Extra High" },
  { time: 1630, speed: 120, phase: "Extra High" },
  { time: 1660, speed: 131, phase: "Extra High" },
  { time: 1700, speed: 110, phase: "Extra High" },
  { time: 1740, speed: 125, phase: "Extra High" },
  { time: 1770, speed: 100, phase: "Extra High" },
  { time: 1790, speed: 60, phase: "Extra High" },
  { time: 1800, speed: 0, phase: "Extra High" },
];

const NEDC_KEYPOINTS: CyclePoint[] = [
  // ECE-15 urban cycles (×4 repeats simplified)
  { time: 0, speed: 0, phase: "Urban" },
  { time: 15, speed: 0, phase: "Urban" },
  { time: 25, speed: 15, phase: "Urban" },
  { time: 40, speed: 15, phase: "Urban" },
  { time: 50, speed: 0, phase: "Urban" },
  { time: 75, speed: 0, phase: "Urban" },
  { time: 90, speed: 32, phase: "Urban" },
  { time: 115, speed: 32, phase: "Urban" },
  { time: 130, speed: 0, phase: "Urban" },
  { time: 155, speed: 0, phase: "Urban" },
  { time: 175, speed: 50, phase: "Urban" },
  { time: 195, speed: 50, phase: "Urban" },
  { time: 210, speed: 35, phase: "Urban" },
  { time: 225, speed: 35, phase: "Urban" },
  { time: 240, speed: 0, phase: "Urban" },
  // Repeat pattern (simplified)
  { time: 300, speed: 0, phase: "Urban" },
  { time: 330, speed: 32, phase: "Urban" },
  { time: 370, speed: 50, phase: "Urban" },
  { time: 410, speed: 35, phase: "Urban" },
  { time: 440, speed: 0, phase: "Urban" },
  { time: 500, speed: 0, phase: "Urban" },
  { time: 530, speed: 32, phase: "Urban" },
  { time: 570, speed: 50, phase: "Urban" },
  { time: 610, speed: 35, phase: "Urban" },
  { time: 640, speed: 0, phase: "Urban" },
  { time: 700, speed: 0, phase: "Urban" },
  { time: 730, speed: 32, phase: "Urban" },
  { time: 770, speed: 50, phase: "Urban" },
  { time: 780, speed: 0, phase: "Urban" },
  // EUDC extra-urban
  { time: 781, speed: 0, phase: "Extra-Urban" },
  { time: 820, speed: 70, phase: "Extra-Urban" },
  { time: 870, speed: 70, phase: "Extra-Urban" },
  { time: 910, speed: 50, phase: "Extra-Urban" },
  { time: 940, speed: 70, phase: "Extra-Urban" },
  { time: 980, speed: 100, phase: "Extra-Urban" },
  { time: 1020, speed: 100, phase: "Extra-Urban" },
  { time: 1060, speed: 120, phase: "Extra-Urban" },
  { time: 1100, speed: 120, phase: "Extra-Urban" },
  { time: 1140, speed: 80, phase: "Extra-Urban" },
  { time: 1160, speed: 50, phase: "Extra-Urban" },
  { time: 1180, speed: 0, phase: "Extra-Urban" },
];

const WLTP_CYCLE = interpolateCycle(WLTP_CLASS3_KEYPOINTS, 1800);
const NEDC_CYCLE = interpolateCycle(NEDC_KEYPOINTS, 1180);

// ─── Simulation Types ─────────────────────────────────────────────────────────

interface EngineConfig {
  displacement: number;
  power: number;
  fuelType: "gasoline" | "diesel";
}

interface CatalystConfig {
  type: "DOC+DPF+SCR" | "TWC";
  volume: number;
  pgmLoading: number;
  agingFactor: number;
}

interface SCRConfig {
  alpha: number;
  nh3Storage: number;
}

interface SimulationStep {
  time: number;
  speed: number;
  phase: string;
  exhaustTemp: number;
  catalystTemp: number;
  engineCO: number;
  engineHC: number;
  engineNOx: number;
  enginePM: number;
  convCO: number;
  convNOx: number;
  convHC: number;
  convPM: number;
  tailpipeCO: number;
  tailpipeHC: number;
  tailpipeNOx: number;
  tailpipePM: number;
  cumCO: number;
  cumHC: number;
  cumNOx: number;
  cumPM: number;
  cumDistance: number;
  cumCOgkm: number;
  cumHCgkm: number;
  cumNOxgkm: number;
  cumPMgkm: number;
}

interface PhaseResult {
  phase: string;
  distance: number;
  CO: number;
  HC: number;
  NOx: number;
  PM: number;
}

// ─── Simulation Engine ────────────────────────────────────────────────────────

function _runSimulation(
  cycle: CyclePoint[],
  engine: EngineConfig,
  catalyst: CatalystConfig,
  scr: SCRConfig,
): SimulationStep[] {
  const results: SimulationStep[] = [];
  const dt = 1;
  const tau = catalyst.type === "TWC" ? 15 : 22;

  // Light-off temperatures by pollutant (°C)
  const lightOffBase = {
    CO: catalyst.type === "TWC" ? 250 : 200,
    HC: catalyst.type === "TWC" ? 280 : 230,
    NOx: catalyst.type === "TWC" ? 300 : 220,
    PM: 300,
  };

  const maxEta = {
    CO: 0.99 * catalyst.agingFactor,
    HC: 0.97 * catalyst.agingFactor,
    NOx: catalyst.type === "DOC+DPF+SCR" ? 0.96 * catalyst.agingFactor * Math.min(scr.alpha, 1.05) : 0.98 * catalyst.agingFactor,
    PM: catalyst.type === "DOC+DPF+SCR" ? 0.995 * catalyst.agingFactor : 0.5 * catalyst.agingFactor,
  };

  // PGM loading effect: higher loading → lower light-off T
  const pgmFactor = Math.min(1, catalyst.pgmLoading / 3.0);
  const lightOff = {
    CO: lightOffBase.CO - pgmFactor * 30,
    HC: lightOffBase.HC - pgmFactor * 25,
    NOx: lightOffBase.NOx - pgmFactor * 20,
    PM: lightOffBase.PM - pgmFactor * 15,
  };

  // Volume effect on space velocity
  const svFactor = Math.max(0.7, Math.min(1.0, catalyst.volume / (engine.displacement * 1.2)));

  let catalystTemp = 25; // cold start
  let cumCO = 0, cumHC = 0, cumNOx = 0, cumPM = 0;
  let cumDistance = 0;

  // Seeded pseudo-random for reproducibility
  let seed = 42;
  function pseudoRandom() {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed / 2147483647) - 0.5;
  }

  for (let i = 0; i < cycle.length; i++) {
    const { time, speed, phase } = cycle[i];

    // Load estimation (simplified: proportional to speed² + idle)
    const load = speed > 0 ? 0.1 + (speed / 130) * 0.7 + (speed / 130) ** 2 * 0.2 : 0.05;
    const fuelFactor = engine.fuelType === "diesel" ? 1.15 : 1.0;
    const displacementFactor = engine.displacement / 2.0;

    // Exhaust gas temperature
    const noise = pseudoRandom() * 8;
    const exhaustTemp = Math.max(
      80,
      200 + speed * 0.8 + load * 150 * fuelFactor + noise - (speed === 0 ? 80 : 0)
    );

    // Catalyst thermal inertia: dT/dt = (T_gas - T_cat) / τ
    const dTdt = (exhaustTemp - catalystTemp) / tau;
    catalystTemp = catalystTemp + dTdt * dt;

    // Engine-out emissions (g/s)
    const baseCO = engine.fuelType === "gasoline"
      ? (0.015 + load * 0.08 + (load > 0.7 ? 0.05 : 0)) * displacementFactor
      : (0.005 + load * 0.03) * displacementFactor;

    const baseHC = engine.fuelType === "gasoline"
      ? (0.004 + load * 0.015) * displacementFactor
      : (0.002 + load * 0.008) * displacementFactor;

    const baseNOx = engine.fuelType === "diesel"
      ? (0.008 + load * 0.06 + (catalystTemp > 400 ? 0.02 : 0)) * displacementFactor
      : (0.003 + load * 0.025) * displacementFactor;

    const basePM = engine.fuelType === "diesel"
      ? (0.0003 + load * 0.002 + (load > 0.6 ? 0.001 : 0)) * displacementFactor
      : (0.00005 + load * 0.0002) * displacementFactor;

    const engineCO = baseCO * fuelFactor;
    const engineHC = baseHC * fuelFactor;
    const engineNOx = baseNOx * fuelFactor;
    const enginePM = basePM * fuelFactor;

    // Conversion efficiency: sigmoid light-off curve η = maxη / (1 + exp(-k*(T - T_lo)))
    const k = 0.04;
    const sigmoid = (T: number, Tlo: number, maxE: number) =>
      maxE / (1 + Math.exp(-k * (T - Tlo))) * svFactor;

    const convCO = sigmoid(catalystTemp, lightOff.CO, maxEta.CO);
    const convHC = sigmoid(catalystTemp, lightOff.HC, maxEta.HC);
    const convNOx = sigmoid(catalystTemp, lightOff.NOx, maxEta.NOx);
    const convPM = sigmoid(catalystTemp, lightOff.PM, maxEta.PM);

    // Tailpipe emissions (g/s)
    const tailpipeCO = engineCO * (1 - convCO);
    const tailpipeHC = engineHC * (1 - convHC);
    const tailpipeNOx = engineNOx * (1 - convNOx);
    const tailpipePM = enginePM * (1 - convPM);

    // Cumulative
    cumCO += tailpipeCO * dt;
    cumHC += tailpipeHC * dt;
    cumNOx += tailpipeNOx * dt;
    cumPM += tailpipePM * dt;
    cumDistance += (speed / 3600) * dt; // km

    const distKm = Math.max(cumDistance, 0.001);

    results.push({
      time,
      speed,
      phase: phase || "Unknown",
      exhaustTemp: Math.round(exhaustTemp * 10) / 10,
      catalystTemp: Math.round(catalystTemp * 10) / 10,
      engineCO,
      engineHC,
      engineNOx,
      enginePM,
      convCO: Math.round(convCO * 1000) / 10,
      convNOx: Math.round(convNOx * 1000) / 10,
      convHC: Math.round(convHC * 1000) / 10,
      convPM: Math.round(convPM * 1000) / 10,
      tailpipeCO,
      tailpipeHC,
      tailpipeNOx,
      tailpipePM,
      cumCO,
      cumHC,
      cumNOx,
      cumPM,
      cumDistance,
      cumCOgkm: Math.round((cumCO / distKm) * 10000) / 10000,
      cumHCgkm: Math.round((cumHC / distKm) * 10000) / 10000,
      cumNOxgkm: Math.round((cumNOx / distKm) * 10000) / 10000,
      cumPMgkm: Math.round((cumPM / distKm) * 10000) / 10000,
    });
  }

  return results;
}

function computePhaseBreakdown(results: SimulationStep[]): PhaseResult[] {
  const phases = new Map<string, { startIdx: number; endIdx: number }>();
  for (let i = 0; i < results.length; i++) {
    const p = results[i].phase;
    if (!phases.has(p)) phases.set(p, { startIdx: i, endIdx: i });
    else phases.get(p)!.endIdx = i;
  }

  const breakdown: PhaseResult[] = [];
  for (const [phase, { startIdx, endIdx }] of phases) {
    const startDist = startIdx > 0 ? results[startIdx - 1].cumDistance : 0;
    const endDist = results[endIdx].cumDistance;
    const dist = Math.max(endDist - startDist, 0.001);

    const startCO = startIdx > 0 ? results[startIdx - 1].cumCO : 0;
    const startHC = startIdx > 0 ? results[startIdx - 1].cumHC : 0;
    const startNOx = startIdx > 0 ? results[startIdx - 1].cumNOx : 0;
    const startPM = startIdx > 0 ? results[startIdx - 1].cumPM : 0;

    breakdown.push({
      phase,
      distance: Math.round(dist * 100) / 100,
      CO: Math.round(((results[endIdx].cumCO - startCO) / dist) * 10000) / 10000,
      HC: Math.round(((results[endIdx].cumHC - startHC) / dist) * 10000) / 10000,
      NOx: Math.round(((results[endIdx].cumNOx - startNOx) / dist) * 10000) / 10000,
      PM: Math.round(((results[endIdx].cumPM - startPM) / dist) * 10000) / 10000,
    });
  }
  return breakdown;
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCSVCycle(text: string): CyclePoint[] | null {
  try {
    const lines = text.trim().split("\n");
    const points: CyclePoint[] = [];
    const startIdx = lines[0].match(/^[\d.]+/) ? 0 : 1;
    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(/[,;\t]+/).map((s) => s.trim());
      if (parts.length >= 2) {
        const time = parseFloat(parts[0]);
        const speed = parseFloat(parts[1]);
        const phase = parts[2] || "Custom";
        if (!isNaN(time) && !isNaN(speed)) {
          points.push({ time: Math.round(time), speed: Math.max(0, speed), phase });
        }
      }
    }
    if (points.length < 5) return null;
    const totalTime = points[points.length - 1].time;
    return interpolateCycle(points, totalTime);
  } catch {
    return null;
  }
}

// ─── Chart Downsampling ───────────────────────────────────────────────────────

function downsample<T>(data: T[], maxPoints: number): T[] {
  if (data.length <= maxPoints) return data;
  const step = Math.ceil(data.length / maxPoints);
  const result: T[] = [];
  for (let i = 0; i < data.length; i += step) result.push(data[i]);
  if (result[result.length - 1] !== data[data.length - 1]) result.push(data[data.length - 1]);
  return result;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WLTPPage() {
  const { sharedDesign, clearSharedDesign } = useSharedCatalyst();
  const [sharedDismissed, setSharedDismissed] = useState(false);

  // Cycle selection
  const [cycleType, setCycleType] = useState<"wltp" | "nedc" | "custom">("wltp");
  const [customCycle, setCustomCycle] = useState<CyclePoint[] | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Engine config
  const [engine, setEngine] = useState<EngineConfig>({
    displacement: 2.0,
    power: 110,
    fuelType: "gasoline",
  });

  // Catalyst config
  const [catalyst, setCatalyst] = useState<CatalystConfig>({
    type: "TWC",
    volume: 1.2,
    pgmLoading: 2.5,
    agingFactor: 0.95,
  });

  // SCR config
  const [scr, setSCR] = useState<SCRConfig>({
    alpha: 1.0,
    nh3Storage: 2.5,
  });

  // Simulation state
  const [results, setResults] = useState<SimulationStep[] | null>(null);
  const [phaseBreakdown, setPhaseBreakdown] = useState<PhaseResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultTab, setResultTab] = useState("time-resolved");

  // Top-level tab
  const [mainTab, setMainTab] = useState<"simulation" | "predev">("simulation");

  // Pre-Development workbench state
  const [predevCpsi, setPredevCpsi] = useState<number[]>([400, 600]);
  const [predevWashcoats, setPredevWashcoats] = useState<WashcoatType[]>(["oxidation"]);
  const [predevSplits, setPredevSplits] = useState<SplitConfig[]>(["single"]);
  const [predevPgmMin, setPredevPgmMin] = useState(40);
  const [predevPgmMax, setPredevPgmMax] = useState(120);
  const [predevPgmStep, setPredevPgmStep] = useState(20);
  const [predevDiameter, setPredevDiameter] = useState(267);
  const [predevLength, setPredevLength] = useState(254);
  const [predevExhaustFlow, _setPredevExhaustFlow] = useState(900);
  const [predevExhaustTemp, _setPredevExhaustTemp] = useState(350);
  const [predevPower, setPredevPower] = useState(250);
  const [predevRawNOx, setPredevRawNOx] = useState(800);
  const [predevRawCO, setPredevRawCO] = useState(400);
  const [predevRawHC, setPredevRawHC] = useState(120);
  const [predevOemNOx, _setPredevOemNOx] = useState(0);
  const [predevEmissionStd, _setPredevEmissionStd] = useState<EmissionStandard>("euro_vi_e");
  const [wltpEmissionStd, setWltpEmissionStd] = useState<WLTPEmissionStandard>("euro_6d_diesel");
  const [selectedPresetIdx, setSelectedPresetIdx] = useState<number | null>(null);
  const [predevDisplacement, setPredevDisplacement] = useState(1.6);
  const [predevCylinders, setPredevCylinders] = useState(4);
  const [predevFuelType, setPredevFuelType] = useState<"diesel" | "gasoline">("diesel");
  const [predevPM, setPredevPM] = useState(22);
  const [predevAgingHours, setPredevAgingHours] = useState(5000);
  const [predevMaxTemp, setPredevMaxTemp] = useState(700);
  const [predevFuelSulfur, setPredevFuelSulfur] = useState(10);
  const [predevO2, setPredevO2] = useState(10);
  const [predevH2O, setPredevH2O] = useState(8);
  const [predevCO2, setPredevCO2] = useState(7);
  const [predevSO2, _setPredevSO2] = useState(5);
  const [predevResults, setPredevResults] = useState<PreDevResult[]>([]);
  const [predevRunning, setPredevRunning] = useState(false);
  const [predevSelectedIdx, setPredevSelectedIdx] = useState<number | null>(null);
  const [predevDetailTab, setPredevDetailTab] = useState<"transient" | "parametric" | "deactivation" | "sgb_advisor">("transient");

  // Transient WLTP simulation state
  const [transientResult, setTransientResult] = useState<TransientSimResult | null>(null);

  // SGB & AI Advisor state
  const [sgbData, setSgbData] = useState<SGBenchData>(EXAMPLE_SGB_DOC);
  const [sgbProfile, setSgbProfile] = useState<DetailedCatalystProfile | null>(null);
  const [sgbSimResult, setSgbSimResult] = useState<TransientSimResult | null>(null);
  const [sgbSimRunning, setSgbSimRunning] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<AIAdvisorResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [iterationHistory, setIterationHistory] = useState<Array<{
    iteration: number;
    config: Partial<SGBenchData>;
    result: TransientSimResult;
    advice: AIAdvisorResponse | null;
    verdict: string;
  }>>([]);
  const [sgbJsonMode, setSgbJsonMode] = useState(false);
  const [sgbJsonText, setSgbJsonText] = useState("");
  const [transientRunning, setTransientRunning] = useState(false);

  const activeCycle = cycleType === "wltp" ? WLTP_CYCLE : cycleType === "nedc" ? NEDC_CYCLE : customCycle;

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSVCycle(text);
      if (parsed) {
        setCustomCycle(parsed);
        setCsvError(null);
      } else {
        setCsvError("Invalid CSV. Expected columns: time(s), speed(km/h), [phase]");
        setCustomCycle(null);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleRunSimulation = useCallback(() => {
    if (!activeCycle) return;
    const cycle = activeCycle;

    setIsRunning(true);
    setProgress(0);
    setResults(null);

    const totalSteps = cycle.length;
    const chunkSize = Math.max(1, Math.floor(totalSteps / 20));
    let currentStep = 0;

    // Simulate in chunks via setTimeout for UI responsiveness
    const simResults: SimulationStep[] = [];
    const dt = 1;
    const tau = catalyst.type === "TWC" ? 15 : 22;

    const lightOffBase = {
      CO: catalyst.type === "TWC" ? 250 : 200,
      HC: catalyst.type === "TWC" ? 280 : 230,
      NOx: catalyst.type === "TWC" ? 300 : 220,
      PM: 300,
    };
    const maxEta = {
      CO: 0.99 * catalyst.agingFactor,
      HC: 0.97 * catalyst.agingFactor,
      NOx: catalyst.type === "DOC+DPF+SCR" ? 0.96 * catalyst.agingFactor * Math.min(scr.alpha, 1.05) : 0.98 * catalyst.agingFactor,
      PM: catalyst.type === "DOC+DPF+SCR" ? 0.995 * catalyst.agingFactor : 0.5 * catalyst.agingFactor,
    };
    const pgmFactor = Math.min(1, catalyst.pgmLoading / 3.0);
    const lightOff = {
      CO: lightOffBase.CO - pgmFactor * 30,
      HC: lightOffBase.HC - pgmFactor * 25,
      NOx: lightOffBase.NOx - pgmFactor * 20,
      PM: lightOffBase.PM - pgmFactor * 15,
    };
    const svFactor = Math.max(0.7, Math.min(1.0, catalyst.volume / (engine.displacement * 1.2)));

    let catalystTemp = 25;
    let cumCO = 0, cumHC = 0, cumNOx = 0, cumPM = 0, cumDistance = 0;
    let seed = 42;
    function pseudoRandom() {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed / 2147483647) - 0.5;
    }

    function processChunk() {
      const end = Math.min(currentStep + chunkSize, totalSteps);
      for (let i = currentStep; i < end; i++) {
        const { time, speed, phase } = cycle[i];
        const load = speed > 0 ? 0.1 + (speed / 130) * 0.7 + (speed / 130) ** 2 * 0.2 : 0.05;
        const fuelFactor = engine.fuelType === "diesel" ? 1.15 : 1.0;
        const displacementFactor = engine.displacement / 2.0;

        const noise = pseudoRandom() * 8;
        const exhaustTemp = Math.max(80, 200 + speed * 0.8 + load * 150 * fuelFactor + noise - (speed === 0 ? 80 : 0));

        const dTdt = (exhaustTemp - catalystTemp) / tau;
        catalystTemp = catalystTemp + dTdt * dt;

        const baseCO = engine.fuelType === "gasoline"
          ? (0.015 + load * 0.08 + (load > 0.7 ? 0.05 : 0)) * displacementFactor
          : (0.005 + load * 0.03) * displacementFactor;
        const baseHC = engine.fuelType === "gasoline"
          ? (0.004 + load * 0.015) * displacementFactor
          : (0.002 + load * 0.008) * displacementFactor;
        const baseNOx = engine.fuelType === "diesel"
          ? (0.008 + load * 0.06 + (catalystTemp > 400 ? 0.02 : 0)) * displacementFactor
          : (0.003 + load * 0.025) * displacementFactor;
        const basePM = engine.fuelType === "diesel"
          ? (0.0003 + load * 0.002 + (load > 0.6 ? 0.001 : 0)) * displacementFactor
          : (0.00005 + load * 0.0002) * displacementFactor;

        const engineCO = baseCO * fuelFactor;
        const engineHC = baseHC * fuelFactor;
        const engineNOx = baseNOx * fuelFactor;
        const enginePM = basePM * fuelFactor;

        const k = 0.04;
        const sigmoid = (T: number, Tlo: number, maxE: number) =>
          maxE / (1 + Math.exp(-k * (T - Tlo))) * svFactor;

        const convCO = sigmoid(catalystTemp, lightOff.CO, maxEta.CO);
        const convHC = sigmoid(catalystTemp, lightOff.HC, maxEta.HC);
        const convNOx = sigmoid(catalystTemp, lightOff.NOx, maxEta.NOx);
        const convPM = sigmoid(catalystTemp, lightOff.PM, maxEta.PM);

        const tailpipeCO = engineCO * (1 - convCO);
        const tailpipeHC = engineHC * (1 - convHC);
        const tailpipeNOx = engineNOx * (1 - convNOx);
        const tailpipePM = enginePM * (1 - convPM);

        cumCO += tailpipeCO * dt;
        cumHC += tailpipeHC * dt;
        cumNOx += tailpipeNOx * dt;
        cumPM += tailpipePM * dt;
        cumDistance += (speed / 3600) * dt;

        const distKm = Math.max(cumDistance, 0.001);

        simResults.push({
          time,
          speed,
          phase: phase || "Unknown",
          exhaustTemp: Math.round(exhaustTemp * 10) / 10,
          catalystTemp: Math.round(catalystTemp * 10) / 10,
          engineCO, engineHC, engineNOx, enginePM,
          convCO: Math.round(convCO * 1000) / 10,
          convNOx: Math.round(convNOx * 1000) / 10,
          convHC: Math.round(convHC * 1000) / 10,
          convPM: Math.round(convPM * 1000) / 10,
          tailpipeCO, tailpipeHC, tailpipeNOx, tailpipePM,
          cumCO, cumHC, cumNOx, cumPM, cumDistance,
          cumCOgkm: Math.round((cumCO / distKm) * 10000) / 10000,
          cumHCgkm: Math.round((cumHC / distKm) * 10000) / 10000,
          cumNOxgkm: Math.round((cumNOx / distKm) * 10000) / 10000,
          cumPMgkm: Math.round((cumPM / distKm) * 10000) / 10000,
        });
      }

      currentStep = end;
      setProgress(Math.round((currentStep / totalSteps) * 100));

      if (currentStep < totalSteps) {
        setTimeout(processChunk, 0);
      } else {
        setResults(simResults);
        setPhaseBreakdown(computePhaseBreakdown(simResults));
        setIsRunning(false);
        setProgress(100);
      }
    }

    setTimeout(processChunk, 50);
  }, [activeCycle, engine, catalyst, scr]);

  const handleReset = useCallback(() => {
    setResults(null);
    setPhaseBreakdown([]);
    setProgress(0);
  }, []);

  const chartData = results ? downsample(results, 400) : [];
  const finalResult = results ? results[results.length - 1] : null;

  const passFailResults = finalResult
    ? {
        CO: { value: finalResult.cumCOgkm, limit: EURO_LIMITS.CO, pass: finalResult.cumCOgkm <= EURO_LIMITS.CO },
        THC: { value: finalResult.cumHCgkm, limit: EURO_LIMITS.THC, pass: finalResult.cumHCgkm <= EURO_LIMITS.THC },
        NOx: { value: finalResult.cumNOxgkm, limit: EURO_LIMITS.NOx, pass: finalResult.cumNOxgkm <= EURO_LIMITS.NOx },
        PM: { value: finalResult.cumPMgkm, limit: EURO_LIMITS.PM, pass: finalResult.cumPMgkm <= EURO_LIMITS.PM },
      }
    : null;

  const applyLightDutyPreset = useCallback((idx: number) => {
    const preset = LIGHT_DUTY_PRESETS[idx];
    if (!preset) return;
    setSelectedPresetIdx(idx);
    setPredevDisplacement(preset.displacement_L);
    setPredevPower(preset.power_kW);
    setPredevFuelType(preset.fuelType);
    setPredevCylinders(preset.cylinders);
    setPredevRawCO(preset.rawCO_ppm);
    setPredevRawHC(preset.rawHC_ppm);
    setPredevRawNOx(preset.rawNOx_ppm);
    setPredevPM(preset.rawPM_mg_Nm3);
    // Auto-select matching emission standard
    setWltpEmissionStd(preset.fuelType === "diesel" ? "euro_6d_diesel" : "euro_6d_gasoline");
  }, []);

  // Transient WLTP simulation handler
  const handleRunTransient = useCallback(() => {
    setTransientRunning(true);
    setTransientResult(null);

    setTimeout(() => {
      const simConfig: TransientSimConfig = {
        engine: {
          displacement_L: predevDisplacement,
          ratedPower_kW: predevPower,
          fuelType: predevFuelType,
          numberOfCylinders: predevCylinders,
          rawCO_ppm: predevRawCO,
          rawHC_ppm: predevRawHC,
          rawNOx_ppm: predevRawNOx,
          rawPM_mg_Nm3: predevPM,
        },
        catalyst: {
          cpsi: predevCpsi[0] || 400,
          wallThickness_mil: getDefaultWallThickness(predevCpsi[0] || 400),
          washcoatType: predevWashcoats[0] || "oxidation",
          pgmLoading_g_ft3: predevPgmMin,
          diameter_mm: predevDiameter,
          length_mm: predevLength,
          splitConfig: predevSplits[0] || "single",
        },
        emissionStandard: wltpEmissionStd,
        agingHours: predevAgingHours,
        maxTemp_C: predevMaxTemp,
        fuelSulfur_ppm: predevFuelSulfur,
      };

      const wltpCycle = WLTP_CYCLE.map((p) => ({ time: p.time, speed: p.speed, phase: p.phase }));
      const result = runTransientWLTPSim(wltpCycle, simConfig);
      setTransientResult(result);
      setTransientRunning(false);
    }, 100);
  }, [predevCpsi, predevWashcoats, predevPgmMin, predevSplits, predevDiameter, predevLength, predevRawNOx, predevRawCO, predevRawHC, predevPower, predevDisplacement, predevFuelType, predevCylinders, predevPM, wltpEmissionStd, predevAgingHours, predevMaxTemp, predevFuelSulfur]);

  // Pre-Development sweep handler
  const handleRunPredev = useCallback(() => {
    setPredevRunning(true);
    setPredevResults([]);
    setPredevSelectedIdx(null);

    setTimeout(() => {
      const configs = generateConfigMatrix(
        predevCpsi, predevWashcoats, predevPgmMin, predevPgmMax, predevPgmStep,
        predevSplits, "DOC", predevDiameter, predevLength
      );

      const input: PreDevInput = {
        rawNOx_ppm: predevRawNOx,
        rawCO_ppm: predevRawCO,
        rawHC_ppm: predevRawHC,
        oemNOx_ppm: predevOemNOx,
        exhaustFlow_kg_h: predevExhaustFlow,
        exhaustTemp_C: predevExhaustTemp,
        power_kW: predevPower,
        O2_percent: predevO2,
        H2O_percent: predevH2O,
        CO2_percent: predevCO2,
        SO2_ppm: predevSO2,
        emissionStandard: predevEmissionStd,
        agingHours: predevAgingHours,
        maxTemp_C: predevMaxTemp,
        fuelSulfur_ppm: predevFuelSulfur,
      };

      const res = runPreDevSweep(input, configs);
      setPredevResults(res);
      setPredevRunning(false);
    }, 100);
  }, [predevCpsi, predevWashcoats, predevPgmMin, predevPgmMax, predevPgmStep, predevSplits, predevDiameter, predevLength, predevRawNOx, predevRawCO, predevRawHC, predevOemNOx, predevExhaustFlow, predevExhaustTemp, predevPower, predevO2, predevH2O, predevCO2, predevSO2, predevEmissionStd, predevAgingHours, predevMaxTemp, predevFuelSulfur]);

  const predevConfigCount = predevCpsi.length * predevWashcoats.length * predevSplits.length * Math.max(1, Math.floor((predevPgmMax - predevPgmMin) / predevPgmStep) + 1);

  // ── SGB Handlers ──
  const handleSGBFieldChange = useCallback(<K extends keyof SGBenchData>(field: K, value: SGBenchData[K]) => {
    setSgbData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSGBSpeciesChange = useCallback((idx: number, field: keyof SGBSpeciesData, value: number | string) => {
    setSgbData((prev) => {
      const species = [...prev.species];
      species[idx] = { ...species[idx], [field]: value };
      return { ...prev, species };
    });
  }, []);

  const handleLoadSGBExample = useCallback((example: SGBenchData) => {
    setSgbData(example);
    setSgbProfile(null);
    setSgbSimResult(null);
    setAiAdvice(null);
    setIterationHistory([]);
  }, []);

  const handleParseSGBJson = useCallback(() => {
    try {
      const parsed = JSON.parse(sgbJsonText) as SGBenchData;
      setSgbData(parsed);
      setSgbJsonMode(false);
    } catch {
      setAiError("Invalid JSON. Please check the format.");
    }
  }, [sgbJsonText]);

  const handleBuildAndSimulate = useCallback(() => {
    const errors = validateSGBData(sgbData);
    if (errors.length > 0) {
      setAiError(`Validation errors: ${errors.map((e) => e.message).join("; ")}`);
      return;
    }
    setAiError(null);
    setSgbSimRunning(true);
    setSgbSimResult(null);
    setAiAdvice(null);

    setTimeout(() => {
      const profile = buildProfileFromSGB(sgbData);
      setSgbProfile(profile);

      const simConfig: TransientSimConfig = {
        engine: {
          displacement_L: predevDisplacement,
          ratedPower_kW: predevPower,
          fuelType: predevFuelType,
          numberOfCylinders: predevCylinders,
          rawCO_ppm: predevRawCO,
          rawHC_ppm: predevRawHC,
          rawNOx_ppm: predevRawNOx,
          rawPM_mg_Nm3: predevPM,
        },
        catalyst: {
          cpsi: predevCpsi[0] || 400,
          wallThickness_mil: getDefaultWallThickness(predevCpsi[0] || 400),
          washcoatType: predevWashcoats[0] || "oxidation",
          pgmLoading_g_ft3: sgbData.pgmLoading_g_ft3,
          diameter_mm: predevDiameter,
          length_mm: predevLength,
          splitConfig: predevSplits[0] || "single",
        },
        emissionStandard: wltpEmissionStd,
        agingHours: predevAgingHours,
        maxTemp_C: predevMaxTemp,
        fuelSulfur_ppm: predevFuelSulfur,
      };

      const wltpCycle = WLTP_CYCLE.map((p) => ({ time: p.time, speed: p.speed, phase: p.phase }));
      const result = runTransientWLTPSim(wltpCycle, simConfig);
      setSgbSimResult(result);

      setIterationHistory((prev) => [
        ...prev,
        {
          iteration: prev.length + 1,
          config: { ...sgbData },
          result,
          advice: null,
          verdict: result.homologation.some((h) => h.verdict === "red") ? "FAIL" : result.homologation.some((h) => h.verdict === "amber") ? "MARGINAL" : "PASS",
        },
      ]);

      setSgbSimRunning(false);
    }, 100);
  }, [sgbData, predevDisplacement, predevPower, predevFuelType, predevCylinders, predevRawCO, predevRawHC, predevRawNOx, predevPM, predevCpsi, predevWashcoats, predevSplits, predevDiameter, predevLength, wltpEmissionStd, predevAgingHours, predevMaxTemp, predevFuelSulfur]);

  const handleAskAI = useCallback(async () => {
    if (!sgbSimResult) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const catalyst: TransientCatalystConfig = {
        cpsi: predevCpsi[0] || 400,
        wallThickness_mil: getDefaultWallThickness(predevCpsi[0] || 400),
        washcoatType: predevWashcoats[0] || "oxidation",
        pgmLoading_g_ft3: sgbData.pgmLoading_g_ft3,
        diameter_mm: predevDiameter,
        length_mm: predevLength,
        splitConfig: predevSplits[0] || "single",
      };
      const advice = await getAIOptimizationAdvice(sgbData, sgbSimResult, wltpEmissionStd, catalyst);
      setAiAdvice(advice);
      setIterationHistory((prev) => {
        const updated = [...prev];
        if (updated.length > 0) {
          updated[updated.length - 1] = { ...updated[updated.length - 1], advice };
        }
        return updated;
      });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI request failed");
    } finally {
      setAiLoading(false);
    }
  }, [sgbSimResult, sgbData, predevCpsi, predevWashcoats, predevDiameter, predevLength, predevSplits, wltpEmissionStd]);

  const handleApplyRecommendation = useCallback((rec: AIAdvisorRecommendation) => {
    setSgbData((prev) => {
      const updated = { ...prev };
      switch (rec.parameter) {
        case "pgmLoading_g_ft3":
          updated.pgmLoading_g_ft3 = parseFloat(rec.suggestedValue) || prev.pgmLoading_g_ft3;
          break;
        case "washcoatThickness_um":
          updated.washcoatThickness_um = parseFloat(rec.suggestedValue) || prev.washcoatThickness_um;
          break;
        case "washcoatLoading_g_L":
          updated.washcoatLoading_g_L = parseFloat(rec.suggestedValue) || prev.washcoatLoading_g_L;
          break;
        default:
          break;
      }
      return updated;
    });
    if (rec.parameter === "cpsi") {
      const val = parseInt(rec.suggestedValue);
      if ([300, 400, 600, 900].includes(val)) setPredevCpsi([val]);
    }
    if (rec.parameter === "splitConfig") {
      const val = rec.suggestedValue as SplitConfig;
      if (["single", "2in_1in_2in", "2in_2in_2in"].includes(val)) setPredevSplits([val]);
    }
    if (rec.parameter === "diameter_mm") {
      setPredevDiameter(parseFloat(rec.suggestedValue) || predevDiameter);
    }
    if (rec.parameter === "length_mm") {
      setPredevLength(parseFloat(rec.suggestedValue) || predevLength);
    }
  }, [predevDiameter, predevLength]);

  const VERDICT_COLORS: Record<RAGVerdict, string> = {
    green: "#22c55e",
    amber: "#f59e0b",
    red: "#ef4444",
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">WLTP Simulation & Pre-Development</h1>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#C8102E]/10 px-2.5 py-0.5 mt-1">
            <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C8102E] opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#C8102E]" /></span>
            <span className="text-[10px] font-medium tracking-wide text-[#C8102E]/80">AI Copilot — powered by BelgaLabs</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Aftermarket transient cycle simulation and parametric catalyst optimization
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mainTab === "simulation" && results && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Reset
            </Button>
          )}
          {mainTab === "simulation" && (
            <Button
              size="sm"
              onClick={handleRunSimulation}
              disabled={isRunning || (cycleType === "custom" && !customCycle)}
              className="bg-[#C8102E] hover:bg-[#A00D24] text-white"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Simulating… {progress}%
                </>
              ) : (
                <>
                  <Play className="mr-1.5 h-4 w-4" />
                  Run Simulation
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Top-Level Tabs */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "simulation" | "predev")}>
        <TabsList className="w-full max-w-md">
          <TabsTrigger value="simulation" className="flex-1 gap-1.5">
            <Gauge className="h-4 w-4" />
            Cycle Simulation
          </TabsTrigger>
          <TabsTrigger value="predev" className="flex-1 gap-1.5">
            <FlaskConical className="h-4 w-4" />
            Pre-Development
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════ SIMULATION TAB ═══════════════════ */}
        <TabsContent value="simulation" className="mt-4 space-y-6">

      {/* Progress bar */}
      {isRunning && (
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-[#C8102E] transition-all duration-200 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Configuration Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cycle Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Gauge className="h-4 w-4 text-[#C8102E]" />
              Drive Cycle
            </CardTitle>
            <CardDescription className="text-xs">Select or upload a drive cycle</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Tabs value={cycleType} onValueChange={(v) => setCycleType(v as "wltp" | "nedc" | "custom")}>
              <TabsList className="w-full">
                <TabsTrigger value="wltp" className="flex-1 text-xs">WLTP Class 3</TabsTrigger>
                <TabsTrigger value="nedc" className="flex-1 text-xs">NEDC</TabsTrigger>
                <TabsTrigger value="custom" className="flex-1 text-xs">Custom</TabsTrigger>
              </TabsList>
              <TabsContent value="wltp" className="mt-3">
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">WLTP Class 3 — 1800s</p>
                  <p>4 phases: Low · Medium · High · Extra High</p>
                  <p>Max speed: 131 km/h</p>
                  <p>Distance: ~23.3 km</p>
                </div>
              </TabsContent>
              <TabsContent value="nedc" className="mt-3">
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">NEDC — 1180s</p>
                  <p>2 phases: Urban (ECE-15) · Extra-Urban (EUDC)</p>
                  <p>Max speed: 120 km/h</p>
                  <p>Distance: ~11 km</p>
                </div>
              </TabsContent>
              <TabsContent value="custom" className="mt-3">
                <div
                  className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-[#C8102E]/50 hover:bg-accent/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs font-medium">
                    {csvFileName || "Drop CSV or click to upload"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Columns: time(s), speed(km/h), [phase]
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
                {csvError && <p className="text-xs text-destructive mt-2">{csvError}</p>}
                {customCycle && (
                  <p className="text-xs text-emerald-600 mt-2">
                    Loaded {customCycle.length} points ({customCycle[customCycle.length - 1].time}s)
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Engine Config */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-[#C8102E]" />
              Engine Configuration
            </CardTitle>
            <CardDescription className="text-xs">Engine parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Displacement (L)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="6.0"
                  value={engine.displacement}
                  onChange={(e) => setEngine({ ...engine, displacement: parseFloat(e.target.value) || 2.0 })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Power (kW)</Label>
                <Input
                  type="number"
                  step="5"
                  min="40"
                  max="400"
                  value={engine.power}
                  onChange={(e) => setEngine({ ...engine, power: parseFloat(e.target.value) || 110 })}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fuel Type</Label>
              <Select
                value={engine.fuelType}
                onValueChange={(v) => {
                  setEngine({ ...engine, fuelType: v as "gasoline" | "diesel" });
                  if (v === "diesel" && catalyst.type === "TWC") {
                    setCatalyst({ ...catalyst, type: "DOC+DPF+SCR" });
                  }
                  if (v === "gasoline" && catalyst.type === "DOC+DPF+SCR") {
                    setCatalyst({ ...catalyst, type: "TWC" });
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gasoline">Gasoline (SI)</SelectItem>
                  <SelectItem value="diesel">Diesel (CI)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Shared Design Banner */}
        {sharedDesign && !sharedDismissed && (
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="size-4 text-primary" />
                AM Copilot design available
              </CardTitle>
              <CardDescription className="text-xs">
                <strong>{sharedDesign.label}</strong> — {sharedDesign.engineFamily ?? "—"} · {sharedDesign.emissionStandard ?? "—"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-4 text-xs">
                <div className="rounded border bg-background p-2">
                  <p className="text-muted-foreground">Volume</p>
                  <p className="font-mono font-semibold">{sharedDesign.substrateVolumeL} L</p>
                </div>
                <div className="rounded border bg-background p-2">
                  <p className="text-muted-foreground">PGM loading</p>
                  <p className="font-mono font-semibold">{sharedDesign.pgmLoadingGPerFt3} g/ft³</p>
                </div>
                <div className="rounded border bg-background p-2">
                  <p className="text-muted-foreground">Aging factor</p>
                  <p className="font-mono font-semibold">{sharedDesign.agingFactor}</p>
                </div>
                <div className="rounded border bg-background p-2">
                  <p className="text-muted-foreground">OSC</p>
                  <p className="font-mono font-semibold">{sharedDesign.oscGPerL} g/L (Ce {sharedDesign.cePercent}%)</p>
                </div>
              </div>
              {sharedDesign.agingPrediction?.lightOffCurve && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Light-off curve from chemistry engine (solid = fresh, dashed = aged after {sharedDesign.agingHours}h @ {sharedDesign.agingTempC}°C)
                  </p>
                  <LightOffCurveChart curve={sharedDesign.agingPrediction.lightOffCurve} />
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => {
                    setCatalyst((prev) => ({
                      ...prev,
                      volume: sharedDesign.substrateVolumeL,
                      pgmLoading: sharedDesign.pgmLoadingGPerFt3,
                      agingFactor: sharedDesign.agingFactor,
                    }));
                  }}
                >
                  Load into catalyst config
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => setSharedDismissed(true)}
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-destructive"
                  onClick={() => { clearSharedDesign(); setSharedDismissed(true); }}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Catalyst Config */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Beaker className="h-4 w-4 text-[#C8102E]" />
              Catalyst Configuration
            </CardTitle>
            <CardDescription className="text-xs">Aftertreatment system parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">System Type</Label>
              <Select
                value={catalyst.type}
                onValueChange={(v) => setCatalyst({ ...catalyst, type: v as CatalystConfig["type"] })}
              >
                <SelectTrigger className="h-8 text-xs w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TWC">TWC (Three-Way Catalyst)</SelectItem>
                  <SelectItem value="DOC+DPF+SCR">DOC + DPF + SCR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Volume (L)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.3"
                  max="5.0"
                  value={catalyst.volume}
                  onChange={(e) => setCatalyst({ ...catalyst, volume: parseFloat(e.target.value) || 1.2 })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">PGM (g/ft³)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="10"
                  value={catalyst.pgmLoading}
                  onChange={(e) => setCatalyst({ ...catalyst, pgmLoading: parseFloat(e.target.value) || 2.5 })}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Aging Factor</Label>
                <span className="text-xs font-mono text-muted-foreground">{catalyst.agingFactor.toFixed(2)}</span>
              </div>
              <Slider
                min={80}
                max={100}
                step={1}
                value={[catalyst.agingFactor * 100]}
                onValueChange={([v]) => setCatalyst({ ...catalyst, agingFactor: v / 100 })}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0.80 (aged)</span>
                <span>1.00 (fresh)</span>
              </div>
            </div>
            {catalyst.type === "DOC+DPF+SCR" && (
              <div className="border-t pt-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">SCR Parameters</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">α (ANR)</Label>
                    <Input
                      type="number"
                      step="0.05"
                      min="0.5"
                      max="1.5"
                      value={scr.alpha}
                      onChange={(e) => setSCR({ ...scr, alpha: parseFloat(e.target.value) || 1.0 })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">NH₃ Storage (g/L)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="10"
                      value={scr.nh3Storage}
                      onChange={(e) => setSCR({ ...scr, nh3Storage: parseFloat(e.target.value) || 2.5 })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Results Section */}
      {results && finalResult && passFailResults && (
        <>
          {/* Quick Summary Badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(Object.entries(passFailResults) as [string, { value: number; limit: number; pass: boolean }][]).map(
              ([pollutant, data]) => (
                <Card key={pollutant} className={data.pass ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30" : "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30"}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">{pollutant}</span>
                      {data.pass ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <p className="text-lg font-bold font-mono">
                      {data.value < 0.001 ? data.value.toExponential(2) : data.value.toFixed(4)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Limit: {data.limit} g/km · {Math.round((data.value / data.limit) * 100)}%
                    </p>
                  </CardContent>
                </Card>
              )
            )}
          </div>

          {/* Results Tabs */}
          <Tabs value={resultTab} onValueChange={setResultTab}>
            <TabsList>
              <TabsTrigger value="time-resolved">Time-Resolved</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="phase-breakdown">Phase Breakdown</TabsTrigger>
            </TabsList>

            {/* Time-Resolved Charts */}
            <TabsContent value="time-resolved" className="space-y-4 mt-4">
              {/* Speed Profile */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Speed Profile</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                        <XAxis
                          dataKey="time"
                          tick={{ fontSize: 10, fill: "#94A3B8" }}
                          label={{ value: "Time (s)", position: "insideBottom", offset: -2, fontSize: 10 }}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "#94A3B8" }}
                          label={{ value: "km/h", angle: -90, position: "insideLeft", fontSize: 10 }}
                        />
                        <Tooltip
                          contentStyle={{ fontSize: 11, backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }}
                          formatter={(value: number) => [`${value.toFixed(1)} km/h`, "Speed"]}
                          labelFormatter={(label) => `t = ${label}s`}
                        />
                        <Line
                          type="monotone"
                          dataKey="speed"
                          stroke="#C8102E"
                          strokeWidth={1.5}
                          dot={false}
                          name="Speed"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Catalyst Temperature */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Catalyst Temperature</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                        <XAxis
                          dataKey="time"
                          tick={{ fontSize: 10, fill: "#94A3B8" }}
                          label={{ value: "Time (s)", position: "insideBottom", offset: -2, fontSize: 10 }}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "#94A3B8" }}
                          label={{ value: "°C", angle: -90, position: "insideLeft", fontSize: 10 }}
                        />
                        <Tooltip
                          contentStyle={{ fontSize: 11, backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }}
                          formatter={(value: number, name: string) => [
                            `${value.toFixed(1)} °C`,
                            name === "exhaustTemp" ? "Exhaust Gas" : "Catalyst",
                          ]}
                          labelFormatter={(label) => `t = ${label}s`}
                        />
                        <ReferenceLine
                          y={catalyst.type === "TWC" ? 250 : 200}
                          stroke="#f59e0b"
                          strokeDasharray="6 3"
                          label={{ value: "Light-off T", position: "right", fontSize: 10, fill: "#f59e0b" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="exhaustTemp"
                          stroke="#94a3b8"
                          strokeWidth={1}
                          dot={false}
                          name="exhaustTemp"
                          strokeDasharray="4 2"
                        />
                        <Line
                          type="monotone"
                          dataKey="catalystTemp"
                          stroke="#C8102E"
                          strokeWidth={1.5}
                          dot={false}
                          name="catalystTemp"
                        />
                        <Legend
                          formatter={(value) =>
                            value === "exhaustTemp" ? "Exhaust Gas" : "Catalyst Brick"
                          }
                          wrapperStyle={{ fontSize: 11, color: "#CBD5E1" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Conversion Efficiency */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Instantaneous Conversion Efficiency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                        <XAxis
                          dataKey="time"
                          tick={{ fontSize: 10, fill: "#94A3B8" }}
                          label={{ value: "Time (s)", position: "insideBottom", offset: -2, fontSize: 10 }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 10, fill: "#94A3B8" }}
                          label={{ value: "%", angle: -90, position: "insideLeft", fontSize: 10 }}
                        />
                        <Tooltip
                          contentStyle={{ fontSize: 11, backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }}
                          formatter={(value: number, name: string) => {
                            const labels: Record<string, string> = { convCO: "CO", convNOx: "NOx", convHC: "HC", convPM: "PM" };
                            return [`${value.toFixed(1)}%`, labels[name] || name];
                          }}
                          labelFormatter={(label) => `t = ${label}s`}
                        />
                        <Line type="monotone" dataKey="convCO" stroke="#C8102E" strokeWidth={1.5} dot={false} name="convCO" />
                        <Line type="monotone" dataKey="convNOx" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="convNOx" />
                        <Line type="monotone" dataKey="convHC" stroke="#22c55e" strokeWidth={1.5} dot={false} name="convHC" />
                        <Line type="monotone" dataKey="convPM" stroke="#a855f7" strokeWidth={1} dot={false} name="convPM" strokeDasharray="4 2" />
                        <Legend
                          formatter={(value) => {
                            const labels: Record<string, string> = { convCO: "CO", convNOx: "NOx", convHC: "HC", convPM: "PM" };
                            return labels[value] || value;
                          }}
                          wrapperStyle={{ fontSize: 11, color: "#CBD5E1" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Cumulative Tailpipe Emissions */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Cumulative Tailpipe Emissions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                        <XAxis
                          dataKey="time"
                          tick={{ fontSize: 10, fill: "#94A3B8" }}
                          label={{ value: "Time (s)", position: "insideBottom", offset: -2, fontSize: 10 }}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "#94A3B8" }}
                          label={{ value: "g/km", angle: -90, position: "insideLeft", fontSize: 10 }}
                          scale="log"
                          domain={[0.0001, 10]}
                          allowDataOverflow
                        />
                        <Tooltip
                          contentStyle={{ fontSize: 11, backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }}
                          formatter={(value: number, name: string) => {
                            const labels: Record<string, string> = {
                              cumCOgkm: "CO",
                              cumHCgkm: "THC",
                              cumNOxgkm: "NOx",
                              cumPMgkm: "PM",
                            };
                            return [`${value.toFixed(4)} g/km`, labels[name] || name];
                          }}
                          labelFormatter={(label) => `t = ${label}s`}
                        />
                        <ReferenceLine y={EURO_LIMITS.CO} stroke="#C8102E" strokeDasharray="6 3" />
                        <ReferenceLine y={EURO_LIMITS.NOx} stroke="#3b82f6" strokeDasharray="6 3" />
                        <ReferenceLine y={EURO_LIMITS.THC} stroke="#22c55e" strokeDasharray="6 3" />
                        <ReferenceLine y={EURO_LIMITS.PM} stroke="#a855f7" strokeDasharray="6 3" />
                        <Line type="monotone" dataKey="cumCOgkm" stroke="#C8102E" strokeWidth={1.5} dot={false} name="cumCOgkm" />
                        <Line type="monotone" dataKey="cumNOxgkm" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="cumNOxgkm" />
                        <Line type="monotone" dataKey="cumHCgkm" stroke="#22c55e" strokeWidth={1.5} dot={false} name="cumHCgkm" />
                        <Line type="monotone" dataKey="cumPMgkm" stroke="#a855f7" strokeWidth={1} dot={false} name="cumPMgkm" strokeDasharray="4 2" />
                        <Legend
                          formatter={(value) => {
                            const labels: Record<string, string> = {
                              cumCOgkm: "CO",
                              cumHCgkm: "THC",
                              cumNOxgkm: "NOx",
                              cumPMgkm: "PM",
                            };
                            return labels[value] || value;
                          }}
                          wrapperStyle={{ fontSize: 11, color: "#CBD5E1" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Summary Table */}
            <TabsContent value="summary" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Euro 6d-ISC Compliance Summary</CardTitle>
                  <CardDescription className="text-xs">
                    Cycle: {cycleType.toUpperCase()} · Distance: {finalResult.cumDistance.toFixed(2)} km · Duration: {results.length}s
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Pollutant</TableHead>
                        <TableHead className="text-xs text-right">Result (g/km)</TableHead>
                        <TableHead className="text-xs text-right">Euro 6d Limit</TableHead>
                        <TableHead className="text-xs text-right">Margin</TableHead>
                        <TableHead className="text-xs text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(Object.entries(passFailResults) as [string, { value: number; limit: number; pass: boolean }][]).map(
                        ([pollutant, data]) => {
                          const margin = ((data.limit - data.value) / data.limit) * 100;
                          return (
                            <TableRow key={pollutant}>
                              <TableCell className="font-medium text-sm">{pollutant}</TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {data.value < 0.001 ? data.value.toExponential(3) : data.value.toFixed(4)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                {data.limit}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                <span className={margin >= 0 ? "text-emerald-600" : "text-red-600"}>
                                  {margin >= 0 ? "+" : ""}{margin.toFixed(1)}%
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                {data.pass ? (
                                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-xs">
                                    PASS
                                  </Badge>
                                ) : (
                                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs">
                                    FAIL
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        }
                      )}
                    </TableBody>
                  </Table>

                  <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Total Distance</p>
                      <p className="text-sm font-mono font-medium">{finalResult.cumDistance.toFixed(2)} km</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Peak Catalyst T</p>
                      <p className="text-sm font-mono font-medium">
                        {Math.max(...results.map((r) => r.catalystTemp)).toFixed(0)} °C
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Avg CO Conversion</p>
                      <p className="text-sm font-mono font-medium">
                        {(results.reduce((s, r) => s + r.convCO, 0) / results.length).toFixed(1)}%
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Avg NOx Conversion</p>
                      <p className="text-sm font-mono font-medium">
                        {(results.reduce((s, r) => s + r.convNOx, 0) / results.length).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Phase Breakdown */}
            <TabsContent value="phase-breakdown" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Per-Phase Emissions Breakdown</CardTitle>
                  <CardDescription className="text-xs">
                    Emissions (g/km) for each drive cycle phase
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Bar Charts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* CO + HC */}
                    <div>
                      <p className="text-xs font-medium mb-2 text-muted-foreground">CO & THC (g/km)</p>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={phaseBreakdown} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                            <XAxis dataKey="phase" tick={{ fontSize: 10, fill: "#94A3B8" }} />
                            <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} />
                            <Tooltip contentStyle={{ fontSize: 11, backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }} formatter={(v: number) => `${v.toFixed(4)} g/km`} />
                            <Bar dataKey="CO" fill="#C8102E" name="CO" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="HC" fill="#22c55e" name="THC" radius={[3, 3, 0, 0]} />
                            <Legend wrapperStyle={{ fontSize: 11, color: "#CBD5E1" }} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    {/* NOx + PM */}
                    <div>
                      <p className="text-xs font-medium mb-2 text-muted-foreground">NOx & PM (g/km)</p>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={phaseBreakdown} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                            <XAxis dataKey="phase" tick={{ fontSize: 10, fill: "#94A3B8" }} />
                            <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} />
                            <Tooltip contentStyle={{ fontSize: 11, backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }} formatter={(v: number) => `${v.toFixed(4)} g/km`} />
                            <Bar dataKey="NOx" fill="#3b82f6" name="NOx" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="PM" fill="#a855f7" name="PM" radius={[3, 3, 0, 0]} />
                            <Legend wrapperStyle={{ fontSize: 11, color: "#CBD5E1" }} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Phase Table */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Phase</TableHead>
                        <TableHead className="text-xs text-right">Distance (km)</TableHead>
                        <TableHead className="text-xs text-right">CO (g/km)</TableHead>
                        <TableHead className="text-xs text-right">THC (g/km)</TableHead>
                        <TableHead className="text-xs text-right">NOx (g/km)</TableHead>
                        <TableHead className="text-xs text-right">PM (g/km)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {phaseBreakdown.map((phase) => (
                        <TableRow key={phase.phase}>
                          <TableCell className="font-medium text-sm">{phase.phase}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{phase.distance.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{phase.CO.toFixed(4)}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{phase.HC.toFixed(4)}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{phase.NOx.toFixed(4)}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{phase.PM.toFixed(6)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Empty State */}
      {!results && !isRunning && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Gauge className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No simulation results yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Configure the engine and catalyst parameters, then click &quot;Run Simulation&quot;
            </p>
          </CardContent>
        </Card>
      )}
        </TabsContent>

        {/* ═══════════════════ PRE-DEVELOPMENT TAB ═══════════════════ */}
        <TabsContent value="predev" className="mt-4 space-y-6">

          {/* Sub-tabs: Transient Simulation | Parametric Sweep */}
          <Tabs value={predevDetailTab} onValueChange={(v) => setPredevDetailTab(v as typeof predevDetailTab)}>
            <TabsList className="w-full max-w-2xl">
              <TabsTrigger value="transient" className="flex-1 gap-1.5 text-xs">
                <Activity className="h-3.5 w-3.5" />
                WLTP Transient Sim
              </TabsTrigger>
              <TabsTrigger value="sgb_advisor" className="flex-1 gap-1.5 text-xs">
                <Zap className="h-3.5 w-3.5" />
                SGB & AI Advisor
              </TabsTrigger>
              <TabsTrigger value="parametric" className="flex-1 gap-1.5 text-xs">
                <TrendingUp className="h-3.5 w-3.5" />
                Parametric Sweep
              </TabsTrigger>
              <TabsTrigger value="deactivation" className="flex-1 gap-1.5 text-xs">
                <Shield className="h-3.5 w-3.5" />
                Aging Analysis
              </TabsTrigger>
            </TabsList>

            {/* ──────── TRANSIENT WLTP SIMULATION ──────── */}
            <TabsContent value="transient" className="mt-4 space-y-4">
              {/* Engine Preset + Catalyst Config */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Engine Preset */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Database className="h-4 w-4 text-[#C8102E]" />
                      Engine Preset
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Select onValueChange={(v) => applyLightDutyPreset(parseInt(v))}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select light-duty engine..." />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Diesel</div>
                        {LIGHT_DUTY_PRESETS.filter(p => p.fuelType === "diesel").map((p) => {
                          const globalIdx = LIGHT_DUTY_PRESETS.indexOf(p);
                          return <SelectItem key={globalIdx} value={String(globalIdx)} className="text-xs">{p.name}</SelectItem>;
                        })}
                        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-t mt-1 pt-1">Gasoline</div>
                        {LIGHT_DUTY_PRESETS.filter(p => p.fuelType === "gasoline").map((p) => {
                          const globalIdx = LIGHT_DUTY_PRESETS.indexOf(p);
                          return <SelectItem key={globalIdx} value={String(globalIdx)} className="text-xs">{p.name}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                    {selectedPresetIdx !== null && (
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] h-5">
                          {LIGHT_DUTY_PRESETS[selectedPresetIdx].fuelType === "diesel" ? "🟡 Diesel" : "🔴 Gasoline"}
                        </Badge>
                        <span>{LIGHT_DUTY_PRESETS[selectedPresetIdx].displacement_L}L / {LIGHT_DUTY_PRESETS[selectedPresetIdx].power_kW} kW</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Displacement (L)</Label>
                        <Input type="number" value={predevDisplacement} onChange={(e) => setPredevDisplacement(+e.target.value || 0)} className="h-7 text-xs" step="0.1" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Power (kW)</Label>
                        <Input type="number" value={predevPower} onChange={(e) => setPredevPower(+e.target.value || 0)} className="h-7 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Fuel Type</Label>
                        <Select value={predevFuelType} onValueChange={(v) => {
                          setPredevFuelType(v as "diesel" | "gasoline");
                          setWltpEmissionStd(v === "diesel" ? "euro_6d_diesel" : "euro_6d_gasoline");
                        }}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="diesel" className="text-xs">Diesel</SelectItem>
                            <SelectItem value="gasoline" className="text-xs">Gasoline</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Fuel S (ppm)</Label>
                        <Input type="number" value={predevFuelSulfur} onChange={(e) => setPredevFuelSulfur(+e.target.value || 0)} className="h-7 text-xs" />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">CO (ppm)</Label>
                        <Input type="number" value={predevRawCO} onChange={(e) => setPredevRawCO(+e.target.value || 0)} className="h-7 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">HC (ppm)</Label>
                        <Input type="number" value={predevRawHC} onChange={(e) => setPredevRawHC(+e.target.value || 0)} className="h-7 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">NOx (ppm)</Label>
                        <Input type="number" value={predevRawNOx} onChange={(e) => setPredevRawNOx(+e.target.value || 0)} className="h-7 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">PM (mg/Nm³)</Label>
                        <Input type="number" value={predevPM} onChange={(e) => setPredevPM(+e.target.value || 0)} className="h-7 text-xs" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Catalyst Config */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-[#C8102E]" />
                      Catalyst Design
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">CPSI</Label>
                        <Select value={String(predevCpsi[0] || 400)} onValueChange={(v) => setPredevCpsi([parseInt(v)])}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[300, 400, 600, 900].map((c) => (
                              <SelectItem key={c} value={String(c)} className="text-xs">{c} cpsi</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">PGM (g/ft³)</Label>
                        <Input type="number" value={predevPgmMin} onChange={(e) => setPredevPgmMin(+e.target.value || 0)} className="h-7 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Ø Diameter (mm)</Label>
                        <Input type="number" value={predevDiameter} onChange={(e) => setPredevDiameter(+e.target.value || 0)} className="h-7 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Length (mm)</Label>
                        <Input type="number" value={predevLength} onChange={(e) => setPredevLength(+e.target.value || 0)} className="h-7 text-xs" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Washcoat</Label>
                      <Select value={predevWashcoats[0] || "oxidation"} onValueChange={(v) => setPredevWashcoats([v as WashcoatType])}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="oxidation" className="text-xs">Oxidation (Pt-Pd/Al₂O₃)</SelectItem>
                          <SelectItem value="ceria" className="text-xs">Ceria (Pd-Rh/CeZrO₂)</SelectItem>
                          <SelectItem value="alumina" className="text-xs">Alumina (Pt/Al₂O₃)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Split Config</Label>
                      <Select value={predevSplits[0] || "single"} onValueChange={(v) => setPredevSplits([v as SplitConfig])}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single" className="text-xs">Single Brick</SelectItem>
                          <SelectItem value="2in_1in_2in" className="text-xs">2&quot; + 1&quot; gap + 2&quot;</SelectItem>
                          <SelectItem value="2in_2in_2in" className="text-xs">2&quot; + 2&quot; gap + 2&quot;</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Aging & Standard */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4 text-[#C8102E]" />
                      Aging & Standard
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Emission Standard (UNECE R83)</Label>
                      <Select value={wltpEmissionStd} onValueChange={(v) => setWltpEmissionStd(v as WLTPEmissionStandard)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(WLTP_EMISSION_LIMITS)
                            .filter(([key]) => key.endsWith(predevFuelType))
                            .map(([key, lim]) => (
                              <SelectItem key={key} value={key} className="text-xs">{lim.label}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2 text-[10px] text-muted-foreground space-y-0.5">
                      <div className="font-medium text-foreground">Limits (g/km):</div>
                      {(() => {
                        const lim = WLTP_EMISSION_LIMITS[wltpEmissionStd];
                        return lim ? (
                          <div className="grid grid-cols-4 gap-1">
                            <span>CO: {lim.CO}</span>
                            <span>HC: {lim.HC}</span>
                            <span>NOx: {lim.NOx}</span>
                            <span>PM: {lim.PM < 100 ? lim.PM : "n/a"}</span>
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Aging (hours)</Label>
                        <Input type="number" value={predevAgingHours} onChange={(e) => setPredevAgingHours(+e.target.value || 0)} className="h-7 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Max Temp (°C)</Label>
                        <Input type="number" value={predevMaxTemp} onChange={(e) => setPredevMaxTemp(+e.target.value || 0)} className="h-7 text-xs" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">O₂ %</Label>
                        <Input type="number" value={predevO2} onChange={(e) => setPredevO2(+e.target.value || 0)} className="h-7 text-xs" step="0.5" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">H₂O %</Label>
                        <Input type="number" value={predevH2O} onChange={(e) => setPredevH2O(+e.target.value || 0)} className="h-7 text-xs" step="0.5" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">CO₂ %</Label>
                        <Input type="number" value={predevCO2} onChange={(e) => setPredevCO2(+e.target.value || 0)} className="h-7 text-xs" step="0.5" />
                      </div>
                    </div>
                    <Button
                      onClick={handleRunTransient}
                      disabled={transientRunning}
                      className="w-full bg-[#C8102E] hover:bg-[#A00D24] text-white h-9"
                    >
                      {transientRunning ? (
                        <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Simulating WLTP…</>
                      ) : (
                        <><Play className="mr-1.5 h-4 w-4" />Run WLTP Homologation Sim</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Transient Results */}
              {transientResult && (() => {
                const tr = transientResult;
                const chartData = tr.steps.filter((_, i) => i % 3 === 0); // downsample
                return (
                  <>
                    {/* Homologation Verdict */}
                    <Card className={tr.overallVerdict === "green" ? "border-emerald-300 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/20" : tr.overallVerdict === "red" ? "border-red-300 bg-red-50/30 dark:border-red-800 dark:bg-red-950/20" : "border-amber-300 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/20"}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          {tr.overallVerdict === "green" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : tr.overallVerdict === "red" ? <XCircle className="h-5 w-5 text-red-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
                          Homologation Verdict: {tr.overallVerdict === "green" ? "PASS" : tr.overallVerdict === "red" ? "FAIL" : "MARGINAL"}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {WLTP_EMISSION_LIMITS[wltpEmissionStd]?.label ?? wltpEmissionStd} · {tr.totalDistance_km.toFixed(1)} km · {tr.totalDuration_s}s · Aging: {(tr.agingFactor * 100).toFixed(0)}% · Light-off: {tr.lightOffTime_s}s · Vol: {tr.catalystVolume_L.toFixed(1)}L
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-4 gap-3">
                          {tr.homologation.map((h) => (
                            <div key={h.species} className="flex items-center gap-3 p-2 rounded-lg border bg-background">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: VERDICT_COLORS[h.verdict] }}>
                                <span className="text-white text-[10px] font-bold">{h.species}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold font-mono">{h.cumulative_g_km < 0.001 ? h.cumulative_g_km.toExponential(2) : h.cumulative_g_km.toFixed(4)}</p>
                                <p className="text-[9px] text-muted-foreground">Limit: {h.limit_g_km} · Margin: {h.margin_percent.toFixed(0)}%</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="outline" className="text-[10px]">GHSV peak: {Math.round(tr.peakGHSV_h).toLocaleString()} h⁻¹</Badge>
                          <Badge variant="outline" className="text-[10px]">GHSV avg: {Math.round(tr.avgGHSV_h).toLocaleString()} h⁻¹</Badge>
                          <Badge variant="outline" className="text-[10px]">T50 CO: {tr.T50_reached_s.CO}s</Badge>
                          <Badge variant="outline" className="text-[10px]">T50 HC: {tr.T50_reached_s.HC}s</Badge>
                          <Badge variant="outline" className="text-[10px]">T50 NOx: {tr.T50_reached_s.NOx}s</Badge>
                          <Badge variant="outline" className="text-[10px]">Cold start CO: {tr.coldStartPenalty_g_km.CO.toFixed(0)}%</Badge>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Temperature & Conversion Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-medium">Catalyst Temperature & Exhaust Flow</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-52">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                                <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#94A3B8" }} label={{ value: "Time (s)", position: "insideBottomRight", offset: -5, fontSize: 9 }} />
                                <YAxis yAxisId="temp" tick={{ fontSize: 9, fill: "#94A3B8" }} label={{ value: "°C", angle: -90, position: "insideLeft", fontSize: 9 }} />
                                <YAxis yAxisId="flow" orientation="right" tick={{ fontSize: 9, fill: "#94A3B8" }} label={{ value: "kg/h", angle: 90, position: "insideRight", fontSize: 9 }} />
                                <Tooltip contentStyle={{ fontSize: 10, backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }} />
                                <Line yAxisId="temp" type="monotone" dataKey="exhaustTemp_C" stroke="#f59e0b" dot={false} strokeWidth={1} name="Exhaust T" />
                                <Line yAxisId="temp" type="monotone" dataKey="catalystTemp_C" stroke="#ef4444" dot={false} strokeWidth={1.5} name="Catalyst T" />
                                <Line yAxisId="flow" type="monotone" dataKey="exhaustFlow_kg_h" stroke="#3b82f6" dot={false} strokeWidth={1} strokeDasharray="3 3" name="Flow" />
                                <Legend wrapperStyle={{ fontSize: 9, color: "#CBD5E1" }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-medium">Conversion Efficiency (Aged)</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-52">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                                <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#94A3B8" }} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#94A3B8" }} label={{ value: "%", angle: -90, position: "insideLeft", fontSize: 9 }} />
                                <Tooltip contentStyle={{ fontSize: 10, backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }} formatter={(v: number) => `${v.toFixed(1)}%`} />
                                <Area type="monotone" dataKey="convCO_aged" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} dot={false} strokeWidth={1.5} name="CO" />
                                <Area type="monotone" dataKey="convHC_aged" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} dot={false} strokeWidth={1.5} name="HC" />
                                <Area type="monotone" dataKey="convNOx_aged" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} dot={false} strokeWidth={1.5} name="NOx" />
                                <ReferenceLine y={50} stroke="#888" strokeDasharray="3 3" strokeWidth={0.5} label={{ value: "T50", fontSize: 8, fill: "#888" }} />
                                <Legend wrapperStyle={{ fontSize: 9, color: "#CBD5E1" }} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Cumulative g/km with limits */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium">Cumulative Emissions (g/km) vs Homologation Limits</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="h-52">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                                <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#94A3B8" }} label={{ value: "Time (s)", position: "insideBottomRight", offset: -5, fontSize: 9 }} />
                                <YAxis tick={{ fontSize: 9, fill: "#94A3B8" }} label={{ value: "g/km", angle: -90, position: "insideLeft", fontSize: 9 }} />
                                <Tooltip contentStyle={{ fontSize: 10, backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }} formatter={(v: number) => `${v.toFixed(4)} g/km`} />
                                <Line type="monotone" dataKey="cumCO_g_km" stroke="#ef4444" dot={false} strokeWidth={1.5} name="CO" />
                                <Line type="monotone" dataKey="cumHC_g_km" stroke="#f59e0b" dot={false} strokeWidth={1.5} name="HC" />
                                {tr.homologation.find((h) => h.species === "CO") && (
                                  <ReferenceLine y={tr.homologation.find((h) => h.species === "CO")!.limit_g_km} stroke="#ef4444" strokeDasharray="5 5" strokeWidth={1} label={{ value: `CO limit`, fontSize: 8, fill: "#ef4444" }} />
                                )}
                                {tr.homologation.find((h) => h.species === "HC") && (
                                  <ReferenceLine y={tr.homologation.find((h) => h.species === "HC")!.limit_g_km} stroke="#f59e0b" strokeDasharray="5 5" strokeWidth={1} label={{ value: `HC limit`, fontSize: 8, fill: "#f59e0b" }} />
                                )}
                                <Legend wrapperStyle={{ fontSize: 9, color: "#CBD5E1" }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="h-52">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                                <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#94A3B8" }} />
                                <YAxis tick={{ fontSize: 9, fill: "#94A3B8" }} label={{ value: "g/km", angle: -90, position: "insideLeft", fontSize: 9 }} />
                                <Tooltip contentStyle={{ fontSize: 10, backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }} formatter={(v: number) => `${v.toFixed(4)} g/km`} />
                                <Line type="monotone" dataKey="cumNOx_g_km" stroke="#3b82f6" dot={false} strokeWidth={1.5} name="NOx" />
                                <Line type="monotone" dataKey="cumPM_g_km" stroke="#a855f7" dot={false} strokeWidth={1.5} name="PM" />
                                {tr.homologation.find((h) => h.species === "NOx") && (
                                  <ReferenceLine y={tr.homologation.find((h) => h.species === "NOx")!.limit_g_km} stroke="#3b82f6" strokeDasharray="5 5" strokeWidth={1} label={{ value: `NOx limit`, fontSize: 8, fill: "#3b82f6" }} />
                                )}
                                {tr.homologation.find((h) => h.species === "PM") && (
                                  <ReferenceLine y={tr.homologation.find((h) => h.species === "PM")!.limit_g_km} stroke="#a855f7" strokeDasharray="5 5" strokeWidth={1} label={{ value: `PM limit`, fontSize: 8, fill: "#a855f7" }} />
                                )}
                                <Legend wrapperStyle={{ fontSize: 9, color: "#CBD5E1" }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Phase Breakdown */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium">Phase Breakdown</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[10px]">Phase</TableHead>
                              <TableHead className="text-[10px] text-right">Duration</TableHead>
                              <TableHead className="text-[10px] text-right">Distance</TableHead>
                              <TableHead className="text-[10px] text-right">Avg Cat T</TableHead>
                              <TableHead className="text-[10px] text-right">Avg η CO</TableHead>
                              <TableHead className="text-[10px] text-right">Avg η HC</TableHead>
                              <TableHead className="text-[10px] text-right">Avg η NOx</TableHead>
                              <TableHead className="text-[10px] text-right">CO g/km</TableHead>
                              <TableHead className="text-[10px] text-right">NOx g/km</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tr.phases.map((p) => (
                              <TableRow key={p.phase}>
                                <TableCell className="text-xs font-medium">{p.phase}</TableCell>
                                <TableCell className="text-xs text-right font-mono">{p.duration_s}s</TableCell>
                                <TableCell className="text-xs text-right font-mono">{p.distance_km.toFixed(2)} km</TableCell>
                                <TableCell className="text-xs text-right font-mono">{p.avgCatalystTemp_C.toFixed(0)}°C</TableCell>
                                <TableCell className="text-xs text-right font-mono">{p.avgConvCO.toFixed(1)}%</TableCell>
                                <TableCell className="text-xs text-right font-mono">{p.avgConvHC.toFixed(1)}%</TableCell>
                                <TableCell className="text-xs text-right font-mono">{p.avgConvNOx.toFixed(1)}%</TableCell>
                                <TableCell className="text-xs text-right font-mono">{p.CO_g_km.toFixed(4)}</TableCell>
                                <TableCell className="text-xs text-right font-mono">{p.NOx_g_km.toFixed(4)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </>
                );
              })()}

              {/* Empty state */}
              {!transientResult && !transientRunning && (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Activity className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">No transient simulation results</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Select an engine preset, configure the catalyst, and run the WLTP homologation simulation
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ──────── SGB & AI ADVISOR ──────── */}
            <TabsContent value="sgb_advisor" className="mt-4 space-y-4">
              {/* Mode toggle + Example loader */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleLoadSGBExample(EXAMPLE_SGB_DOC)}>
                  Load DOC Example
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleLoadSGBExample(EXAMPLE_SGB_TWC)}>
                  Load TWC Example
                </Button>
                <Button variant={sgbJsonMode ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setSgbJsonMode(!sgbJsonMode)}>
                  {sgbJsonMode ? "Switch to Form" : "Paste JSON"}
                </Button>
                {sgbProfile && (
                  <Badge variant="outline" className="text-[10px] h-5 ml-auto">
                    Profile: {sgbProfile.name}
                  </Badge>
                )}
              </div>

              {sgbJsonMode ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Paste SGB Bench Report (JSON)</CardTitle>
                    <CardDescription className="text-xs">Paste the structured JSON from your lab system or SGB report</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <textarea
                      className="w-full h-48 text-xs font-mono p-3 rounded-md border bg-muted/30 resize-y"
                      value={sgbJsonText}
                      onChange={(e) => setSgbJsonText(e.target.value)}
                      placeholder='{"supplierName": "...", "sampleId": "...", ...}'
                    />
                    <Button onClick={handleParseSGBJson} className="bg-[#C8102E] hover:bg-[#A00D24] text-white h-8 text-xs">
                      Parse & Load
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* SGB Metadata */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Database className="h-4 w-4 text-[#C8102E]" />
                        Sample Info
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Supplier Name</Label>
                        <Input value={sgbData.supplierName} onChange={(e) => handleSGBFieldChange("supplierName", e.target.value)} className="h-7 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Sample ID</Label>
                        <Input value={sgbData.sampleId} onChange={(e) => handleSGBFieldChange("sampleId", e.target.value)} className="h-7 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Catalyst Type</Label>
                        <Select value={sgbData.catalystType} onValueChange={(v) => handleSGBFieldChange("catalystType", v as SGBenchData["catalystType"])}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DOC" className="text-xs">DOC</SelectItem>
                            <SelectItem value="TWC" className="text-xs">TWC</SelectItem>
                            <SelectItem value="SCR" className="text-xs">SCR</SelectItem>
                            <SelectItem value="ASC" className="text-xs">ASC</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">PGM (g/ft³)</Label>
                          <Input type="number" value={sgbData.pgmLoading_g_ft3} onChange={(e) => handleSGBFieldChange("pgmLoading_g_ft3", +e.target.value || 0)} className="h-7 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Bench GHSV</Label>
                          <Input type="number" value={sgbData.GHSV_bench} onChange={(e) => handleSGBFieldChange("GHSV_bench", +e.target.value || 0)} className="h-7 text-xs" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Pt %</Label>
                          <Input type="number" value={sgbData.pgm_ratio.Pt} onChange={(e) => handleSGBFieldChange("pgm_ratio", { ...sgbData.pgm_ratio, Pt: +e.target.value || 0 })} className="h-7 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Pd %</Label>
                          <Input type="number" value={sgbData.pgm_ratio.Pd} onChange={(e) => handleSGBFieldChange("pgm_ratio", { ...sgbData.pgm_ratio, Pd: +e.target.value || 0 })} className="h-7 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Rh %</Label>
                          <Input type="number" value={sgbData.pgm_ratio.Rh} onChange={(e) => handleSGBFieldChange("pgm_ratio", { ...sgbData.pgm_ratio, Rh: +e.target.value || 0 })} className="h-7 text-xs" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Species Kinetics */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 text-[#C8102E]" />
                        Species Kinetics (SGB Measured)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {sgbData.species.map((sp, idx) => (
                        <div key={sp.name} className="p-2 rounded-lg border space-y-1.5">
                          <p className="text-xs font-semibold text-[#C8102E]">{sp.name}</p>
                          <div className="grid grid-cols-3 gap-1.5">
                            <div className="space-y-0.5">
                              <Label className="text-[9px] text-muted-foreground">Ea (kJ/mol)</Label>
                              <Input type="number" value={sp.Ea_kJ_mol} onChange={(e) => handleSGBSpeciesChange(idx, "Ea_kJ_mol", +e.target.value || 0)} className="h-6 text-[10px]" />
                            </div>
                            <div className="space-y-0.5">
                              <Label className="text-[9px] text-muted-foreground">TOF (s⁻¹)</Label>
                              <Input type="number" value={sp.TOF_s1} onChange={(e) => handleSGBSpeciesChange(idx, "TOF_s1", +e.target.value || 0)} className="h-6 text-[10px]" step="0.1" />
                            </div>
                            <div className="space-y-0.5">
                              <Label className="text-[9px] text-muted-foreground">T_ref (°C)</Label>
                              <Input type="number" value={sp.T_ref_C} onChange={(e) => handleSGBSpeciesChange(idx, "T_ref_C", +e.target.value || 0)} className="h-6 text-[10px]" />
                            </div>
                            <div className="space-y-0.5">
                              <Label className="text-[9px] text-muted-foreground">T50 (°C)</Label>
                              <Input type="number" value={sp.T50_C} onChange={(e) => handleSGBSpeciesChange(idx, "T50_C", +e.target.value || 0)} className="h-6 text-[10px]" />
                            </div>
                            <div className="space-y-0.5">
                              <Label className="text-[9px] text-muted-foreground">T90 (°C)</Label>
                              <Input type="number" value={sp.T90_C} onChange={(e) => handleSGBSpeciesChange(idx, "T90_C", +e.target.value || 0)} className="h-6 text-[10px]" />
                            </div>
                            <div className="space-y-0.5">
                              <Label className="text-[9px] text-muted-foreground">Max Conv %</Label>
                              <Input type="number" value={sp.maxConversion_pct} onChange={(e) => handleSGBSpeciesChange(idx, "maxConversion_pct", +e.target.value || 0)} className="h-6 text-[10px]" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Chemisorption & Washcoat */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Microscope className="h-4 w-4 text-[#C8102E]" />
                        Chemisorption & Washcoat
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Dispersion (%)</Label>
                          <Input type="number" value={sgbData.dispersion_pct} onChange={(e) => handleSGBFieldChange("dispersion_pct", +e.target.value || 0)} className="h-7 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Metallic SA (m²/gPGM)</Label>
                          <Input type="number" value={sgbData.metallicSA_m2_gPGM} onChange={(e) => handleSGBFieldChange("metallicSA_m2_gPGM", +e.target.value || 0)} className="h-7 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Particle Size (nm)</Label>
                          <Input type="number" value={sgbData.avgParticleSize_nm} onChange={(e) => handleSGBFieldChange("avgParticleSize_nm", +e.target.value || 0)} className="h-7 text-xs" step="0.1" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">BET (m²/g)</Label>
                          <Input type="number" value={sgbData.BET_m2_g} onChange={(e) => handleSGBFieldChange("BET_m2_g", +e.target.value || 0)} className="h-7 text-xs" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">WC Loading (g/L)</Label>
                          <Input type="number" value={sgbData.washcoatLoading_g_L} onChange={(e) => handleSGBFieldChange("washcoatLoading_g_L", +e.target.value || 0)} className="h-7 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">WC Thickness (µm)</Label>
                          <Input type="number" value={sgbData.washcoatThickness_um} onChange={(e) => handleSGBFieldChange("washcoatThickness_um", +e.target.value || 0)} className="h-7 text-xs" />
                        </div>
                      </div>
                      <p className="text-[10px] font-medium mt-2">Gas Composition</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[9px] text-muted-foreground">O₂ %</Label>
                          <Input type="number" value={sgbData.gasComposition.O2_pct} onChange={(e) => handleSGBFieldChange("gasComposition", { ...sgbData.gasComposition, O2_pct: +e.target.value || 0 })} className="h-6 text-[10px]" step="0.5" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] text-muted-foreground">H₂O %</Label>
                          <Input type="number" value={sgbData.gasComposition.H2O_pct} onChange={(e) => handleSGBFieldChange("gasComposition", { ...sgbData.gasComposition, H2O_pct: +e.target.value || 0 })} className="h-6 text-[10px]" step="0.5" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] text-muted-foreground">CO₂ %</Label>
                          <Input type="number" value={sgbData.gasComposition.CO2_pct} onChange={(e) => handleSGBFieldChange("gasComposition", { ...sgbData.gasComposition, CO2_pct: +e.target.value || 0 })} className="h-6 text-[10px]" step="0.5" />
                        </div>
                      </div>

                      <div className="pt-2 border-t mt-3">
                        <Button
                          onClick={handleBuildAndSimulate}
                          disabled={sgbSimRunning}
                          className="w-full bg-[#C8102E] hover:bg-[#A00D24] text-white h-9"
                        >
                          {sgbSimRunning ? (
                            <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Building Profile & Simulating…</>
                          ) : (
                            <><Play className="mr-1.5 h-4 w-4" />Build Profile & Run WLTP Sim</>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Error display */}
              {aiError && (
                <Card className="border-red-300 bg-red-50/30 dark:border-red-800 dark:bg-red-950/20">
                  <CardContent className="py-3">
                    <p className="text-xs text-red-600 flex items-center gap-2">
                      <XCircle className="h-4 w-4" /> {aiError}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Simulation Results + AI Advisor */}
              {sgbSimResult && (
                <>
                  {/* Verdict Banner */}
                  <Card className={sgbSimResult.homologation.some((h) => h.verdict === "red") ? "border-red-300 bg-red-50/30 dark:border-red-800 dark:bg-red-950/20" : sgbSimResult.homologation.some((h) => h.verdict === "amber") ? "border-amber-300 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/20" : "border-emerald-300 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/20"}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        {sgbSimResult.homologation.some((h) => h.verdict === "red") ? <XCircle className="h-5 w-5 text-red-600" /> : sgbSimResult.homologation.some((h) => h.verdict === "amber") ? <AlertTriangle className="h-5 w-5 text-amber-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                        SGB Catalyst Homologation: {sgbSimResult.homologation.some((h) => h.verdict === "red") ? "FAIL" : sgbSimResult.homologation.some((h) => h.verdict === "amber") ? "MARGINAL" : "PASS"}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {sgbData.supplierName} / {sgbData.sampleId} — {WLTP_EMISSION_LIMITS[wltpEmissionStd]?.label} — Light-off: {sgbSimResult.lightOffTime_s}s — Aging: {(sgbSimResult.agingFactor * 100).toFixed(0)}%
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-3">
                        {sgbSimResult.homologation.map((h) => (
                          <div key={h.species} className="flex items-center gap-3 p-2 rounded-lg border bg-background">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: VERDICT_COLORS[h.verdict] }}>
                              <span className="text-[10px] font-bold text-white">{h.species}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold font-mono">{h.cumulative_g_km < 0.001 ? h.cumulative_g_km.toExponential(2) : h.cumulative_g_km.toFixed(4)}</p>
                              <p className="text-[9px] text-muted-foreground">Limit: {h.limit_g_km} · Margin: {h.margin_percent.toFixed(0)}%</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-4 gap-3 mt-3 text-[10px]">
                        <div><span className="text-muted-foreground">Peak GHSV:</span> <span className="font-mono">{sgbSimResult.peakGHSV_h.toFixed(0)} h⁻¹</span></div>
                        <div><span className="text-muted-foreground">Avg GHSV:</span> <span className="font-mono">{sgbSimResult.avgGHSV_h.toFixed(0)} h⁻¹</span></div>
                        <div><span className="text-muted-foreground">Cat Volume:</span> <span className="font-mono">{sgbSimResult.catalystVolume_L.toFixed(2)} L</span></div>
                        <div><span className="text-muted-foreground">Distance:</span> <span className="font-mono">{sgbSimResult.totalDistance_km.toFixed(1)} km</span></div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* AI Advisor Button */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Zap className="h-4 w-4 text-[#C8102E]" />
                        AI Catalyst Advisor — powered by BelgaLabs
                      </CardTitle>
                      <CardDescription className="text-xs">
                        AI analyzes the simulation gap and recommends specific catalyst modifications to achieve homologation
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={handleAskAI}
                          disabled={aiLoading}
                          className="bg-gradient-to-r from-[#C8102E] to-[#8B0000] hover:from-[#A00D24] hover:to-[#6B0000] text-white h-9"
                        >
                          {aiLoading ? (
                            <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Analyzing with AI…</>
                          ) : (
                            <><Zap className="mr-1.5 h-4 w-4" />Ask AI for Optimization Guidance</>
                          )}
                        </Button>
                        {aiAdvice?.tokensUsed && (
                          <Badge variant="outline" className="text-[10px] h-5">{aiAdvice.tokensUsed} tokens</Badge>
                        )}
                      </div>

                      {/* AI Response */}
                      {aiAdvice && (
                        <div className="space-y-4">
                          {/* Diagnosis */}
                          <div className="p-3 rounded-lg border bg-muted/30">
                            <p className="text-xs font-semibold mb-1 flex items-center gap-1.5">
                              <Info className="h-3.5 w-3.5 text-blue-500" />
                              Diagnosis: <Badge variant="outline" className="text-[10px]">{aiAdvice.diagnosis.primaryLimitation.replace("_", " ")}</Badge>
                            </p>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{aiAdvice.diagnosis.summary}</p>
                            {aiAdvice.diagnosis.failingSpecies.length > 0 && (
                              <div className="flex gap-1 mt-1.5">
                                {aiAdvice.diagnosis.failingSpecies.map((sp) => (
                                  <Badge key={sp} variant="destructive" className="text-[9px] h-4">{sp}</Badge>
                                ))}
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
                              <div><span className="text-muted-foreground">Kinetic:</span> {aiAdvice.diagnosis.detailedAnalysis.kinetic.slice(0, 100)}</div>
                              <div><span className="text-muted-foreground">Mass Transfer:</span> {aiAdvice.diagnosis.detailedAnalysis.massTransfer.slice(0, 100)}</div>
                              <div><span className="text-muted-foreground">Thermal:</span> {aiAdvice.diagnosis.detailedAnalysis.thermal.slice(0, 100)}</div>
                              <div><span className="text-muted-foreground">Aging:</span> {aiAdvice.diagnosis.detailedAnalysis.aging.slice(0, 100)}</div>
                            </div>
                          </div>

                          {/* Recommendations */}
                          <div>
                            <p className="text-xs font-semibold mb-2">Recommendations (ranked by impact)</p>
                            <div className="space-y-2">
                              {aiAdvice.recommendations.map((rec, i) => (
                                <div key={i} className="p-3 rounded-lg border bg-background hover:bg-muted/20 transition-colors">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Badge className="text-[9px] h-4 bg-[#C8102E]">#{rec.priority}</Badge>
                                        <span className="text-xs font-medium">{rec.parameter}</span>
                                        <Badge variant="outline" className={`text-[9px] h-4 ${rec.confidence === "high" ? "border-emerald-500 text-emerald-600" : rec.confidence === "medium" ? "border-amber-500 text-amber-600" : "border-red-500 text-red-600"}`}>
                                          {rec.confidence}
                                        </Badge>
                                      </div>
                                      <p className="text-[10px] text-muted-foreground">
                                        <span className="font-mono">{rec.currentValue}</span> → <span className="font-mono font-bold text-foreground">{rec.suggestedValue}</span>
                                      </p>
                                      <p className="text-[10px] text-emerald-600 mt-0.5">{rec.expectedImprovement}</p>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">{rec.rationale}</p>
                                      {rec.tradeoffs && <p className="text-[10px] text-amber-600 mt-0.5">Tradeoffs: {rec.tradeoffs}</p>}
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-[10px] shrink-0"
                                      onClick={() => {
                                        handleApplyRecommendation(rec);
                                      }}
                                    >
                                      Apply & Re-sim
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Alternative Formulation */}
                          {aiAdvice.alternativeFormulation && (
                            <div className="p-3 rounded-lg border border-dashed">
                              <p className="text-xs font-semibold mb-1">Alternative Formulation</p>
                              <p className="text-[10px] text-muted-foreground">{aiAdvice.alternativeFormulation.description}</p>
                              <div className="flex gap-3 mt-1 text-[10px]">
                                <span>Pt:{aiAdvice.alternativeFormulation.pgm_ratio.Pt}% Pd:{aiAdvice.alternativeFormulation.pgm_ratio.Pd}% Rh:{aiAdvice.alternativeFormulation.pgm_ratio.Rh}%</span>
                                <span>PGM: {aiAdvice.alternativeFormulation.pgmLoading_g_ft3} g/ft³</span>
                                <span>WC: {aiAdvice.alternativeFormulation.washcoatType}</span>
                              </div>
                            </div>
                          )}

                          {/* Overall Assessment */}
                          <div className={`p-3 rounded-lg border ${aiAdvice.overallAssessment.canPassWithModifications ? "border-emerald-300 bg-emerald-50/20" : "border-red-300 bg-red-50/20"}`}>
                            <p className="text-xs font-semibold mb-1">
                              {aiAdvice.overallAssessment.canPassWithModifications ? "✓ Can pass with modifications" : "✗ Fundamental reformulation needed"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{aiAdvice.overallAssessment.summary}</p>
                            <div className="flex gap-3 mt-1 text-[10px]">
                              <span>Est. iterations: {aiAdvice.overallAssessment.estimatedIterations}</span>
                              <span>Cost impact: {aiAdvice.overallAssessment.costImpact}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Iteration History */}
                  {iterationHistory.length > 1 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <RotateCcw className="h-4 w-4 text-[#C8102E]" />
                          Iteration History ({iterationHistory.length} runs)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[10px] w-12">#</TableHead>
                              <TableHead className="text-[10px]">Verdict</TableHead>
                              <TableHead className="text-[10px]">CO (g/km)</TableHead>
                              <TableHead className="text-[10px]">HC (g/km)</TableHead>
                              <TableHead className="text-[10px]">NOx (g/km)</TableHead>
                              <TableHead className="text-[10px]">PGM (g/ft³)</TableHead>
                              <TableHead className="text-[10px]">Light-off (s)</TableHead>
                              <TableHead className="text-[10px]">AI Diagnosis</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {iterationHistory.map((it) => {
                              const co = it.result.homologation.find((h) => h.species === "CO");
                              const hc = it.result.homologation.find((h) => h.species === "HC");
                              const nox = it.result.homologation.find((h) => h.species === "NOx");
                              return (
                                <TableRow key={it.iteration}>
                                  <TableCell className="text-[10px] font-mono">{it.iteration}</TableCell>
                                  <TableCell>
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: it.verdict === "PASS" ? "#22c55e" : it.verdict === "FAIL" ? "#ef4444" : "#f59e0b" }} />
                                  </TableCell>
                                  <TableCell className="text-[10px] font-mono">{co?.cumulative_g_km.toFixed(4)}</TableCell>
                                  <TableCell className="text-[10px] font-mono">{hc?.cumulative_g_km.toFixed(4)}</TableCell>
                                  <TableCell className="text-[10px] font-mono">{nox?.cumulative_g_km.toFixed(4)}</TableCell>
                                  <TableCell className="text-[10px] font-mono">{(it.config as SGBenchData).pgmLoading_g_ft3}</TableCell>
                                  <TableCell className="text-[10px] font-mono">{it.result.lightOffTime_s}s</TableCell>
                                  <TableCell className="text-[10px]">{it.advice?.diagnosis.primaryLimitation ?? "—"}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {/* Empty state */}
              {!sgbSimResult && !sgbSimRunning && (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FlaskConical className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">Enter SGB bench data and click &quot;Build Profile & Run WLTP Sim&quot;</p>
                    <p className="text-xs text-muted-foreground mt-1">The AI advisor will analyze results and guide you toward homologation</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ──────── PARAMETRIC SWEEP ──────── */}
            <TabsContent value="parametric" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-[#C8102E]" />
                    Parametric Sweep Configuration
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Sweep CPSI, washcoat, PGM loading, and split to find optimal catalyst design
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <p className="text-[10px] font-semibold mb-1.5 text-muted-foreground uppercase">CPSI</p>
                      <div className="flex flex-wrap gap-1">
                        {[300, 400, 600, 900].map((c) => (
                          <button key={c} onClick={() => setPredevCpsi((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])}
                            className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${predevCpsi.includes(c) ? "bg-[#C8102E] text-white border-[#C8102E]" : "bg-background border-border hover:border-[#C8102E]/50"}`}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold mb-1.5 text-muted-foreground uppercase">Washcoat</p>
                      <div className="flex flex-wrap gap-1">
                        {([{ key: "oxidation" as WashcoatType, label: "Ox" }, { key: "ceria" as WashcoatType, label: "Ce" }, { key: "alumina" as WashcoatType, label: "Al" }]).map(({ key, label }) => (
                          <button key={key} onClick={() => setPredevWashcoats((prev) => prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key])}
                            className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${predevWashcoats.includes(key) ? "bg-[#C8102E] text-white border-[#C8102E]" : "bg-background border-border hover:border-[#C8102E]/50"}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold mb-1.5 text-muted-foreground uppercase">PGM (g/ft³)</p>
                      <div className="flex gap-1">
                        <Input type="number" value={predevPgmMin} onChange={(e) => setPredevPgmMin(+e.target.value || 0)} className="h-6 text-[10px] w-14" placeholder="Min" />
                        <Input type="number" value={predevPgmMax} onChange={(e) => setPredevPgmMax(+e.target.value || 0)} className="h-6 text-[10px] w-14" placeholder="Max" />
                        <Input type="number" value={predevPgmStep} onChange={(e) => setPredevPgmStep(+e.target.value || 1)} className="h-6 text-[10px] w-12" placeholder="Step" />
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold mb-1.5 text-muted-foreground uppercase">Split</p>
                      <div className="flex flex-wrap gap-1">
                        {([{ key: "single" as SplitConfig, label: "1×" }, { key: "2in_1in_2in" as SplitConfig, label: "2+1+2" }, { key: "2in_2in_2in" as SplitConfig, label: "2+2+2" }]).map(({ key, label }) => (
                          <button key={key} onClick={() => setPredevSplits((prev) => prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key])}
                            className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${predevSplits.includes(key) ? "bg-[#C8102E] text-white border-[#C8102E]" : "bg-background border-border hover:border-[#C8102E]/50"}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button onClick={handleRunPredev} disabled={predevRunning || predevCpsi.length === 0 || predevWashcoats.length === 0} className="bg-[#C8102E] hover:bg-[#A00D24] text-white h-8 text-xs">
                      {predevRunning ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Running…</> : <><TrendingUp className="mr-1 h-3.5 w-3.5" />Sweep ({predevConfigCount} configs)</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Parametric Results */}
              {predevResults.length > 0 && (() => {
                const best = predevResults[0];
                const selected = predevSelectedIdx !== null ? predevResults[predevSelectedIdx] : best;
                return (
                  <>
                    {/* Traffic Light */}
                    <div className="grid grid-cols-3 gap-3">
                      {best.species.map((sp) => (
                        <div key={sp.species} className="flex items-center gap-3 p-3 rounded-lg border">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: VERDICT_COLORS[sp.verdict] }}>
                            <span className="text-white text-[10px] font-bold">{sp.species}</span>
                          </div>
                          <div>
                            <p className="text-xs font-bold font-mono">{sp.agedConversion_percent.toFixed(1)}%</p>
                            <p className="text-[9px] text-muted-foreground">{sp.tailpipeAged_g_kWh.toFixed(3)} / {sp.limit_g_kWh.toFixed(1)} g/kWh</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Results Table */}
                    <Card>
                      <CardContent className="pt-4">
                        <div className="max-h-[300px] overflow-auto border rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-[10px] sticky top-0 bg-background">#</TableHead>
                                <TableHead className="text-[10px] sticky top-0 bg-background">CPSI</TableHead>
                                <TableHead className="text-[10px] sticky top-0 bg-background">WC</TableHead>
                                <TableHead className="text-[10px] sticky top-0 bg-background">PGM</TableHead>
                                <TableHead className="text-[10px] sticky top-0 bg-background">Split</TableHead>
                                <TableHead className="text-[10px] sticky top-0 bg-background text-right">CO%</TableHead>
                                <TableHead className="text-[10px] sticky top-0 bg-background text-right">HC%</TableHead>
                                <TableHead className="text-[10px] sticky top-0 bg-background text-right">NOx%</TableHead>
                                <TableHead className="text-[10px] sticky top-0 bg-background text-center">V</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {predevResults.map((r, idx) => {
                                const co = r.species.find((s) => s.species === "CO");
                                const hc = r.species.find((s) => s.species === "HC");
                                const nox = r.species.find((s) => s.species === "NOx");
                                return (
                                  <TableRow key={idx} className={`cursor-pointer hover:bg-accent/50 ${predevSelectedIdx === idx ? "bg-accent" : ""}`} onClick={() => setPredevSelectedIdx(idx)}>
                                    <TableCell className="text-[10px] font-mono">{idx + 1}</TableCell>
                                    <TableCell className="text-[10px] font-mono">{r.config.cpsi}</TableCell>
                                    <TableCell className="text-[10px]">{r.config.washcoatType.slice(0, 2).toUpperCase()}</TableCell>
                                    <TableCell className="text-[10px] font-mono">{r.config.pgmLoading_g_ft3}</TableCell>
                                    <TableCell className="text-[10px]">{r.config.splitConfig === "single" ? "—" : r.config.splitConfig.replace(/_/g, "+").replace(/in/g, '"')}</TableCell>
                                    <TableCell className="text-[10px] font-mono text-right">{co?.agedConversion_percent.toFixed(1)}</TableCell>
                                    <TableCell className="text-[10px] font-mono text-right">{hc?.agedConversion_percent.toFixed(1)}</TableCell>
                                    <TableCell className="text-[10px] font-mono text-right">{nox?.agedConversion_percent.toFixed(1)}</TableCell>
                                    <TableCell className="text-center"><div className="w-3.5 h-3.5 rounded-full mx-auto" style={{ backgroundColor: VERDICT_COLORS[r.overallVerdict] }} /></TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Light-Off Curves */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium">Light-Off Curves — {selected.configLabel}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-3">
                          {(["CO", "HC", "NOx"] as const).map((sp) => {
                            const freshKey = `${sp}_conversion_fresh` as keyof typeof selected.lightOffCurve[0];
                            const agedKey = `${sp}_conversion_aged` as keyof typeof selected.lightOffCurve[0];
                            const color = sp === "CO" ? "#ef4444" : sp === "HC" ? "#f59e0b" : "#3b82f6";
                            return (
                              <div key={sp} className="h-44">
                                <p className="text-[10px] font-medium text-center mb-1">{sp}</p>
                                <ResponsiveContainer width="100%" height="90%">
                                  <LineChart data={selected.lightOffCurve} margin={{ top: 2, right: 5, bottom: 2, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                                    <XAxis dataKey="temperature_C" tick={{ fontSize: 8, fill: "#94A3B8" }} tickFormatter={(v: number) => Math.round(v).toString()} />
                                    <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: "#94A3B8" }} />
                                    <Tooltip contentStyle={{ fontSize: 9, backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }} formatter={(v: number) => `${v.toFixed(1)}%`} />
                                    <Line type="monotone" dataKey={freshKey} stroke={color} strokeDasharray="4 4" dot={false} strokeWidth={1} name="Fresh" />
                                    <Line type="monotone" dataKey={agedKey} stroke={color} dot={false} strokeWidth={1.5} name="Aged" />
                                    <ReferenceLine y={50} stroke="#888" strokeDasharray="3 3" strokeWidth={0.5} />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </TabsContent>

            {/* ──────── AGING ANALYSIS ──────── */}
            <TabsContent value="deactivation" className="mt-4 space-y-4">
              {predevResults.length > 0 && (() => {
                const selected = predevSelectedIdx !== null ? predevResults[predevSelectedIdx] : predevResults[0];
                const d = selected.deactivation;
                return (
                  <>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Shield className="h-4 w-4 text-[#C8102E]" />
                          Deactivation Mechanism Breakdown — {selected.configLabel}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                          {[
                            { label: "Overall", value: d.overallActivity, color: d.overallActivity > 0.85 ? "#22c55e" : d.overallActivity > 0.7 ? "#f59e0b" : "#ef4444" },
                            { label: "Sulfur", value: d.sulfurActivity, color: "#f59e0b" },
                            { label: "Phosphorus", value: d.phosphorusActivity, color: "#a855f7" },
                            { label: "Thermal", value: d.thermalActivity, color: "#ef4444" },
                            { label: "Chemical", value: d.chemicalActivity, color: "#3b82f6" },
                          ].map((m) => (
                            <div key={m.label} className="text-center p-3 rounded-lg border">
                              <p className="text-[10px] text-muted-foreground mb-1">{m.label}</p>
                              <p className="text-lg font-bold font-mono" style={{ color: m.color }}>{(m.value * 100).toFixed(1)}%</p>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs"><span className="text-muted-foreground">S loading</span><span className="font-mono">{d.sulfurLoading_g_L.toFixed(2)} g/L</span></div>
                            <div className="flex justify-between text-xs"><span className="text-muted-foreground">P loading</span><span className="font-mono">{d.phosphorusLoading_g_L.toFixed(2)} g/L</span></div>
                            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Particle size</span><span className="font-mono">{d.particleSize_nm.toFixed(1)} nm</span></div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Equiv. aging</span><span className="font-mono">{d.equivalentAging_h.toFixed(0)} h @800°C</span></div>
                            <div className="flex justify-between text-xs"><span className="text-muted-foreground">End of life</span><span className="font-mono">{d.endOfLife_hours.toFixed(0)} h</span></div>
                            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Warranty margin</span><span className="font-mono">{d.warrantyMargin_percent.toFixed(0)}%</span></div>
                          </div>
                        </div>
                        {d.warnings.length > 0 && (
                          <div className="mt-3 p-2 rounded border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
                            {d.warnings.map((w, i) => (
                              <p key={i} className="text-[10px] text-amber-700 dark:text-amber-400">⚠ {w}</p>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Washcoat Analysis */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Microscope className="h-4 w-4 text-[#C8102E]" />
                          Washcoat Mass Transfer Analysis
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          {selected.washcoatAnalysis.map((wa) => (
                            <div key={wa.species} className="p-3 rounded-lg border">
                              <p className="text-xs font-medium mb-2">{wa.species}</p>
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Thiele φ</span><span className="font-mono">{wa.phi.toFixed(2)}</span></div>
                                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">η internal</span><span className="font-mono">{(wa.eta_internal * 100).toFixed(1)}%</span></div>
                                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">η overall</span><span className="font-mono">{(wa.eta_overall * 100).toFixed(1)}%</span></div>
                                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Regime</span>
                                  <Badge variant="outline" className={`text-[9px] ${wa.regime === "kinetic" ? "border-emerald-500 text-emerald-600" : wa.regime === "diffusion_limited" ? "border-red-500 text-red-600" : "border-amber-500 text-amber-600"}`}>
                                    {wa.regime.replace("_", " ")}
                                  </Badge>
                                </div>
                                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">D_eff</span><span className="font-mono">{wa.D_eff_m2_s.toExponential(2)} m²/s</span></div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Washcoat thickness sweep */}
                        <div className="h-44">
                          <p className="text-[10px] font-medium text-center mb-1">Effectiveness Factor vs Washcoat Thickness</p>
                          <ResponsiveContainer width="100%" height="90%">
                            <LineChart data={selected.washcoatSweep} margin={{ top: 2, right: 10, bottom: 2, left: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                              <XAxis dataKey="thickness_um" tick={{ fontSize: 8, fill: "#94A3B8" }} label={{ value: "µm", position: "insideBottomRight", offset: -5, fontSize: 8 }} tickFormatter={(v: number) => Math.round(v).toString()} />
                              <YAxis domain={[0, 1]} tick={{ fontSize: 8, fill: "#94A3B8" }} label={{ value: "η", angle: -90, position: "insideLeft", fontSize: 8 }} />
                              <Tooltip contentStyle={{ fontSize: 9, backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }} formatter={(v: number) => v.toFixed(3)} />
                              <Line type="monotone" dataKey="eta" stroke="#C8102E" dot={false} strokeWidth={1.5} name="η" />
                              <ReferenceLine y={0.5} stroke="#888" strokeDasharray="3 3" strokeWidth={0.5} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
              {predevResults.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Shield className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">Run a parametric sweep first to see aging analysis</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
