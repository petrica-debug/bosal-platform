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
} from "lucide-react";

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

function runSimulation(
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

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">WLTP Cycle Simulation</h1>
          <p className="text-sm text-muted-foreground">
            Transient emission simulation over WLTP, NEDC, or custom drive cycles
          </p>
        </div>
        <div className="flex items-center gap-2">
          {results && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Reset
            </Button>
          )}
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
        </div>
      </div>

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
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis
                          dataKey="time"
                          tick={{ fontSize: 10 }}
                          label={{ value: "Time (s)", position: "insideBottom", offset: -2, fontSize: 10 }}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          label={{ value: "km/h", angle: -90, position: "insideLeft", fontSize: 10 }}
                        />
                        <Tooltip
                          contentStyle={{ fontSize: 11 }}
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
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis
                          dataKey="time"
                          tick={{ fontSize: 10 }}
                          label={{ value: "Time (s)", position: "insideBottom", offset: -2, fontSize: 10 }}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          label={{ value: "°C", angle: -90, position: "insideLeft", fontSize: 10 }}
                        />
                        <Tooltip
                          contentStyle={{ fontSize: 11 }}
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
                          wrapperStyle={{ fontSize: 11 }}
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
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis
                          dataKey="time"
                          tick={{ fontSize: 10 }}
                          label={{ value: "Time (s)", position: "insideBottom", offset: -2, fontSize: 10 }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 10 }}
                          label={{ value: "%", angle: -90, position: "insideLeft", fontSize: 10 }}
                        />
                        <Tooltip
                          contentStyle={{ fontSize: 11 }}
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
                          wrapperStyle={{ fontSize: 11 }}
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
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis
                          dataKey="time"
                          tick={{ fontSize: 10 }}
                          label={{ value: "Time (s)", position: "insideBottom", offset: -2, fontSize: 10 }}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          label={{ value: "g/km", angle: -90, position: "insideLeft", fontSize: 10 }}
                          scale="log"
                          domain={[0.0001, 10]}
                          allowDataOverflow
                        />
                        <Tooltip
                          contentStyle={{ fontSize: 11 }}
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
                          wrapperStyle={{ fontSize: 11 }}
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
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="phase" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => `${v.toFixed(4)} g/km`} />
                            <Bar dataKey="CO" fill="#C8102E" name="CO" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="HC" fill="#22c55e" name="THC" radius={[3, 3, 0, 0]} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
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
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="phase" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => `${v.toFixed(4)} g/km`} />
                            <Bar dataKey="NOx" fill="#3b82f6" name="NOx" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="PM" fill="#a855f7" name="PM" radius={[3, 3, 0, 0]} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
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
    </div>
  );
}
