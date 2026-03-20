"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FullAgingPrediction } from "@/lib/catsizer/catalyst-chemistry";
import type { RearO2Signal } from "@/lib/catsizer/obd-simulation";
import type { AmVariant, CostBreakdown } from "./wizard-types";

/* ================================================================== */
/*  Aging Curves Chart                                                */
/* ================================================================== */

interface AgingCurvePoint {
  hours: number;
  oscRetention: number;
  pdDispersion: number;
  rhDispersion: number;
}

function generateAgingCurveData(prediction: FullAgingPrediction): AgingCurvePoint[] {
  const points: AgingCurvePoint[] = [];
  for (let h = 0; h <= 50; h += 2) {
    const frac = h / 12; // normalize to standard 12h protocol
    const oscRet = 100 * Math.exp(-frac * Math.log(100 / prediction.osc.retentionPct));
    const pdDisp = prediction.pgmPd.freshDispersionPct * Math.exp(-frac * Math.log(prediction.pgmPd.freshDispersionPct / Math.max(1, prediction.pgmPd.agedDispersionPct)));
    const rhDisp = prediction.pgmRh.freshDispersionPct * Math.exp(-frac * Math.log(prediction.pgmRh.freshDispersionPct / Math.max(1, prediction.pgmRh.agedDispersionPct)));
    points.push({
      hours: h,
      oscRetention: +oscRet.toFixed(1),
      pdDispersion: +pdDisp.toFixed(1),
      rhDispersion: +rhDisp.toFixed(1),
    });
  }
  return points;
}

export function AgingCurvesChart({ prediction }: { prediction: FullAgingPrediction }) {
  const data = generateAgingCurveData(prediction);
  return (
    <div className="w-full h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="hours" label={{ value: "Aging hours", position: "bottom", offset: -2 }} className="text-xs" />
          <YAxis domain={[0, 100]} label={{ value: "%", angle: -90, position: "insideLeft" }} className="text-xs" />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="oscRetention" name="OSC retention %" stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="pdDispersion" name="Pd dispersion %" stroke="#f59e0b" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="rhDispersion" name="Rh dispersion %" stroke="#10b981" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ================================================================== */
/*  OBD Rear-O2 Signal Chart                                          */
/* ================================================================== */

export function ObdSignalChart({ signal }: { signal: RearO2Signal }) {
  const data = signal.waveform.filter((_, i) => i % 2 === 0); // downsample for perf
  return (
    <div className="w-full h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="timeS" label={{ value: "Time (s)", position: "bottom", offset: -2 }} className="text-xs" />
          <YAxis domain={[0, 1]} label={{ value: "V", angle: -90, position: "insideLeft" }} className="text-xs" />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area type="stepAfter" dataKey="frontV" name="Front O₂" stroke="#ef4444" fill="#ef444420" strokeWidth={1.5} />
          <Area type="monotone" dataKey="rearV" name="Rear O₂" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ================================================================== */
/*  Variant Radar Chart                                               */
/* ================================================================== */

interface RadarPoint {
  axis: string;
  performance: number;
  balanced: number;
  value: number;
}

function buildRadarData(variants: AmVariant[]): RadarPoint[] {
  const perf = variants.find((v) => v.tier === "performance");
  const bal = variants.find((v) => v.tier === "balanced");
  const val = variants.find((v) => v.tier === "value");

  if (!perf || !bal || !val) return [];

  const maxPgm = Math.max(perf.pgm.totalGPerL, bal.pgm.totalGPerL, val.pgm.totalGPerL) || 1;
  const maxOsc = Math.max(perf.oscTargetGPerL, bal.oscTargetGPerL, val.oscTargetGPerL) || 1;

  const riskScore = (r: string) => r === "LOW" ? 90 : r === "MEDIUM" ? 50 : 20;

  const agingScore = (v: AmVariant) => {
    if (!v.agingPrediction) return 50;
    return Math.min(100, v.agingPrediction.osc.retentionPct * 1.5);
  };

  return [
    { axis: "PGM loading", performance: (perf.pgm.totalGPerL / maxPgm) * 100, balanced: (bal.pgm.totalGPerL / maxPgm) * 100, value: (val.pgm.totalGPerL / maxPgm) * 100 },
    { axis: "OSC capacity", performance: (perf.oscTargetGPerL / maxOsc) * 100, balanced: (bal.oscTargetGPerL / maxOsc) * 100, value: (val.oscTargetGPerL / maxOsc) * 100 },
    { axis: "OBD safety", performance: riskScore(perf.obdRisk), balanced: riskScore(bal.obdRisk), value: riskScore(val.obdRisk) },
    { axis: "Aging durability", performance: agingScore(perf), balanced: agingScore(bal), value: agingScore(val) },
    { axis: "Cost efficiency", performance: 60, balanced: 80, value: 100 },
  ];
}

export function VariantRadarChart({ variants }: { variants: AmVariant[] }) {
  const data = buildRadarData(variants);
  if (data.length === 0) return null;

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid className="stroke-muted" />
          <PolarAngleAxis dataKey="axis" className="text-xs" />
          <PolarRadiusAxis domain={[0, 100]} tick={false} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Radar name="Performance" dataKey="performance" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
          <Radar name="Balanced" dataKey="balanced" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
          <Radar name="Value" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.15} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ================================================================== */
/*  Cost Comparison Bar Chart                                         */
/* ================================================================== */

export function CostBarChart({ costs }: { costs: Record<string, CostBreakdown> }) {
  const data = Object.entries(costs).map(([tier, c]) => ({
    tier: tier.charAt(0).toUpperCase() + tier.slice(1),
    PGM: c.pgmCostPerBrick,
    Substrate: c.substrateCost,
    Washcoat: c.washcoatCost,
    Canning: c.canningCost,
  }));

  return (
    <div className="w-full h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="tier" className="text-xs" />
          <YAxis label={{ value: "€", angle: -90, position: "insideLeft" }} className="text-xs" />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="PGM" stackId="a" fill="#3b82f6" />
          <Bar dataKey="Substrate" stackId="a" fill="#f59e0b" />
          <Bar dataKey="Washcoat" stackId="a" fill="#10b981" />
          <Bar dataKey="Canning" stackId="a" fill="#8b5cf6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
