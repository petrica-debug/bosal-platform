"use client";

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
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
  Droplets,
  Gauge,
  Thermometer,
  Wind,
  Ruler,
  Target,
  Eye,
  EyeOff,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Timer,
  Layers,
} from "lucide-react";
import type { SimParams, SimMetrics } from "./spray-scene";

const SprayCanvas = dynamic(() => import("./spray-scene"), { ssr: false });

// ─── Slider Row ──────────────────────────────────────────────────────────────

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  icon: Icon,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-muted-foreground" />
          <span className="text-[11px] font-medium text-foreground/80">
            {label}
          </span>
        </div>
        <span className="text-[11px] font-mono font-semibold tabular-nums text-[#C8102E]">
          {value}
          <span className="text-muted-foreground font-normal ml-0.5">
            {unit}
          </span>
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="[&_[data-slot=slider-range]]:bg-[#C8102E] [&_[data-slot=slider-thumb]]:border-[#C8102E]"
      />
    </div>
  );
}

// ─── Risk Badge ──────────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: "Low" | "Medium" | "High" }) {
  const config = {
    Low: { bg: "bg-emerald-500/15", text: "text-emerald-400", icon: CheckCircle2 },
    Medium: { bg: "bg-amber-500/15", text: "text-amber-400", icon: AlertTriangle },
    High: { bg: "bg-red-500/15", text: "text-red-400", icon: AlertTriangle },
  }[level];
  const RiskIcon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${config.bg} ${config.text}`}
    >
      <RiskIcon className="h-2.5 w-2.5" />
      {level}
    </span>
  );
}

// ─── Toggle Button ───────────────────────────────────────────────────────────

function ToggleButton({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
        active
          ? "bg-[#C8102E]/15 text-[#C8102E] border border-[#C8102E]/30"
          : "bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted"
      }`}
    >
      {active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      {label}
    </button>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SpraySimPage() {
  const [params, setParams] = useState<SimParams>({
    injectionAngle: 15,
    injectionPressure: 5,
    exhaustFlowRate: 400,
    exhaustTemp: 350,
    pipeDiameter: 200,
    injectorToSCR: 500,
    mixerType: "swirl",
    showPipe: true,
    showStreamlines: false,
  });

  const [metrics, setMetrics] = useState<SimMetrics>({
    uniformityIndex: 0.95,
    evaporationPct: 85,
    wallRisk: "Low",
    depositRisk: "Low",
    residenceTime: 120,
  });

  const handleMetrics = useCallback((m: SimMetrics) => {
    setMetrics(m);
  }, []);

  const updateParam = useCallback(
    <K extends keyof SimParams>(key: K, value: SimParams[K]) => {
      setParams((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const uiColor = useMemo(() => {
    if (metrics.uniformityIndex >= 0.95) return "text-emerald-400";
    if (metrics.uniformityIndex >= 0.85) return "text-amber-400";
    return "text-red-400";
  }, [metrics.uniformityIndex]);

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#7A0A1E] via-[#C8102E] to-[#E03050] px-6 py-5 text-white">
        <div className="absolute inset-0 opacity-5">
          <svg width="100%" height="100%">
            <pattern
              id="grid-spray"
              width="30"
              height="30"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 30 0 L 0 0 0 30"
                fill="none"
                stroke="white"
                strokeWidth="0.5"
              />
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid-spray)" />
          </svg>
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-white/20 text-white border-white/30 text-[10px]">
                Showcase Feature
              </Badge>
              <Badge className="bg-white/10 text-white/70 border-white/20 text-[10px]">
                WebGL 60fps
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Urea Spray Simulation
            </h1>
            <p className="text-white/60 text-xs mt-0.5 max-w-xl">
              Lagrangian droplet tracking with d² evaporation, thermolysis, and
              NH₃ uniformity index — real-time 3D visualization
            </p>
          </div>
          <div className="hidden md:flex items-center gap-3">
            {[
              { label: "Liquid", color: "#3B82F6" },
              { label: "Evaporating", color: "#06B6D4" },
              { label: "NH₃ Gas", color: "#10B981" },
              { label: "Deposit", color: "#EF4444" },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[10px] text-white/70">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content: Canvas + Sidebar */}
      <div className="flex flex-1 min-h-0">
        {/* 3D Canvas */}
        <div className="flex-1 relative min-h-[600px]">
          <SprayCanvas params={params} onMetrics={handleMetrics} />

          {/* Live Metrics Overlay */}
          <div className="absolute top-3 left-3 flex flex-col gap-2 pointer-events-none">
            <div className="rounded-lg bg-black/60 backdrop-blur-md border border-white/10 px-3 py-2.5 pointer-events-auto">
              <div className="flex items-center gap-1.5 mb-2">
                <Activity className="h-3 w-3 text-emerald-400" />
                <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wider">
                  Live Metrics
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <div>
                  <div className="text-[9px] text-white/40 uppercase">
                    Uniformity γ
                  </div>
                  <div className={`text-sm font-bold font-mono tabular-nums ${uiColor}`}>
                    {metrics.uniformityIndex.toFixed(3)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-white/40 uppercase">
                    Evaporation
                  </div>
                  <div className="text-sm font-bold font-mono tabular-nums text-cyan-400">
                    {metrics.evaporationPct.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-white/40 uppercase">
                    Wall Risk
                  </div>
                  <RiskBadge level={metrics.wallRisk} />
                </div>
                <div>
                  <div className="text-[9px] text-white/40 uppercase">
                    Deposit Risk
                  </div>
                  <RiskBadge level={metrics.depositRisk} />
                </div>
                <div className="col-span-2 pt-1 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Timer className="h-2.5 w-2.5 text-white/40" />
                      <span className="text-[9px] text-white/40 uppercase">
                        Residence
                      </span>
                    </div>
                    <span className="text-xs font-bold font-mono tabular-nums text-white/90">
                      {metrics.residenceTime} ms
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Particle count indicator */}
          <div className="absolute bottom-3 left-3 rounded-md bg-black/50 backdrop-blur-sm border border-white/10 px-2 py-1">
            <span className="text-[9px] text-white/50 font-mono">
              {PARTICLE_COUNT} particles @ 60fps
            </span>
          </div>

          {/* Controls hint */}
          <div className="absolute bottom-3 right-3 rounded-md bg-black/50 backdrop-blur-sm border border-white/10 px-2 py-1">
            <span className="text-[9px] text-white/50">
              Drag to orbit · Scroll to zoom
            </span>
          </div>
        </div>

        {/* Control Sidebar */}
        <div className="w-72 border-l bg-card/50 backdrop-blur overflow-y-auto">
          <div className="p-4 space-y-5">
            {/* Injection Controls */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <Droplets className="h-3.5 w-3.5 text-[#C8102E]" />
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
                  Injection
                </span>
              </div>
              <div className="space-y-3">
                <SliderControl
                  label="Spray Angle"
                  value={params.injectionAngle}
                  min={5}
                  max={45}
                  step={1}
                  unit="°"
                  icon={Target}
                  onChange={(v) => updateParam("injectionAngle", v)}
                />
                <SliderControl
                  label="Pressure"
                  value={params.injectionPressure}
                  min={3}
                  max={10}
                  step={0.5}
                  unit="bar"
                  icon={Gauge}
                  onChange={(v) => updateParam("injectionPressure", v)}
                />
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Exhaust Controls */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <Wind className="h-3.5 w-3.5 text-[#C8102E]" />
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
                  Exhaust
                </span>
              </div>
              <div className="space-y-3">
                <SliderControl
                  label="Flow Rate"
                  value={params.exhaustFlowRate}
                  min={100}
                  max={1000}
                  step={10}
                  unit="kg/h"
                  icon={Wind}
                  onChange={(v) => updateParam("exhaustFlowRate", v)}
                />
                <SliderControl
                  label="Temperature"
                  value={params.exhaustTemp}
                  min={150}
                  max={500}
                  step={5}
                  unit="°C"
                  icon={Thermometer}
                  onChange={(v) => updateParam("exhaustTemp", v)}
                />
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Geometry Controls */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <Ruler className="h-3.5 w-3.5 text-[#C8102E]" />
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
                  Geometry
                </span>
              </div>
              <div className="space-y-3">
                <SliderControl
                  label="Pipe Diameter"
                  value={params.pipeDiameter}
                  min={100}
                  max={300}
                  step={5}
                  unit="mm"
                  icon={Ruler}
                  onChange={(v) => updateParam("pipeDiameter", v)}
                />
                <SliderControl
                  label="Injector → SCR"
                  value={params.injectorToSCR}
                  min={200}
                  max={800}
                  step={10}
                  unit="mm"
                  icon={Ruler}
                  onChange={(v) => updateParam("injectorToSCR", v)}
                />
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Mixer Selection */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <Layers className="h-3.5 w-3.5 text-[#C8102E]" />
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
                  Mixer
                </span>
              </div>
              <Select
                value={params.mixerType}
                onValueChange={(v) =>
                  updateParam("mixerType", v as SimParams["mixerType"])
                }
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="blade">Blade Mixer</SelectItem>
                  <SelectItem value="swirl">Swirl Mixer</SelectItem>
                  <SelectItem value="tab">Tab Mixer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="h-px bg-border" />

            {/* Visibility Toggles */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <Eye className="h-3.5 w-3.5 text-[#C8102E]" />
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
                  Layers
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <ToggleButton
                  label="Pipe"
                  active={params.showPipe}
                  onToggle={() => updateParam("showPipe", !params.showPipe)}
                />
                <ToggleButton
                  label="Streamlines"
                  active={params.showStreamlines}
                  onToggle={() =>
                    updateParam("showStreamlines", !params.showStreamlines)
                  }
                />
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Physics Info */}
            <div className="rounded-lg bg-muted/30 border p-3">
              <div className="text-[10px] font-semibold text-foreground/60 uppercase tracking-wider mb-2">
                Physics Models
              </div>
              <div className="space-y-1">
                {[
                  "Lagrangian droplet tracking",
                  "d² evaporation law",
                  "Thermolysis: (NH₂)₂CO → NH₃ + HNCO",
                  "Mundo-Sommerfeld wall model",
                  "Uniformity index γ at SCR face",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-1.5 text-[10px] text-muted-foreground"
                  >
                    <span className="mt-1 h-1 w-1 rounded-full bg-[#C8102E] shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const PARTICLE_COUNT = 400;
