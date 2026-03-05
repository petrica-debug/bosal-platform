"use client";

import { useState, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Calculator,
  Loader2,
  Flame,
  Thermometer,
  Gauge,
  Shield,
  Ruler,
  Weight,
  BarChart3,
  Activity,
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
  BarChart,
  Bar,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReformingInputs {
  fuelType: "NG" | "biogas";
  CH4_percent: number;
  flowRate_Nm3h: number;
  SC_ratio: number;
  inletT_C: number;
  outletT_C: number;
  pressure_kPa: number;
}

interface CombustionInputs {
  fuelType: "NG" | "H2" | "anode_offgas";
  flowRate_Nm3h: number;
  excessAirRatio: number;
  inletT_C: number;
}

interface GeometryInputs {
  tubeCount: number;
  tubeID_mm: number;
  tubeOD_mm: number;
  tubeLength_m: number;
  tubePitch_mm: number;
  shellID_mm: number;
  material: "inconel625" | "ss310" | "haynes230";
}

interface ThermalResult {
  heatDuty_kW: number;
  LMTD_C: number;
  U_overall: number;
  requiredArea_m2: number;
  actualArea_m2: number;
  designMargin_percent: number;
  h_process: number;
  h_combustion: number;
  Re_process: number;
  Re_combustion: number;
  Pr_process: number;
  Pr_combustion: number;
  Nu_process: number;
  Nu_combustion: number;
  wallResistance: number;
  k_wall: number;
  wallThickness_mm: number;
  dT1: number;
  dT2: number;
}

interface TempProfilePoint {
  position_m: number;
  processT_C: number;
  combustionT_C: number;
  wallT_C: number;
}

interface PressureDropResult {
  process_kPa: number;
  combustion_kPa: number;
  process_method: string;
  combustion_method: string;
  process_Re: number;
  combustion_Re: number;
  process_f: number;
  combustion_f: number;
}

interface MechanicalResult {
  minWallThickness_mm: number;
  actualWallThickness_mm: number;
  safetyFactor: number;
  thermalStress_MPa: number;
  allowableStress_MPa: number;
  yieldStrength_MPa: number;
  tensileStrength_MPa: number;
  thermalExpansion: number;
  k_material: number;
  density_kg_m3: number;
  creepLife_hours: number;
  maxOperatingT_C: number;
}

interface SizingSummary {
  totalWeight_kg: number;
  tubeWeight_kg: number;
  shellWeight_kg: number;
  totalLength_m: number;
  shellOD_mm: number;
  compactness_kW_m3: number;
  effectiveness: number;
}

interface HERResults {
  thermal: ThermalResult;
  tempProfile: TempProfilePoint[];
  pressureDrop: PressureDropResult;
  mechanical: MechanicalResult;
  sizing: SizingSummary;
}

// ─── Material Data ────────────────────────────────────────────────────────────

const MATERIALS: Record<string, {
  name: string;
  k: (T: number) => number;
  density: number;
  allowableStress: (T: number) => number;
  yieldStrength: (T: number) => number;
  tensileStrength: (T: number) => number;
  thermalExpansion: (T: number) => number;
  maxTemp: number;
  creepRuptureStress: (T: number) => number;
}> = {
  inconel625: {
    name: "Inconel 625",
    k: (T) => 10 + 0.015 * T,
    density: 8440,
    allowableStress: (T) => Math.max(50, 240 - 0.18 * T),
    yieldStrength: (T) => Math.max(150, 460 - 0.3 * T),
    tensileStrength: (T) => Math.max(400, 830 - 0.35 * T),
    thermalExpansion: (T) => 12.8e-6 + 2.5e-9 * T,
    maxTemp: 980,
    creepRuptureStress: (T) => Math.max(10, 350 * Math.exp(-0.003 * T)),
  },
  ss310: {
    name: "SS 310",
    k: (T) => 14 + 0.012 * T,
    density: 7900,
    allowableStress: (T) => Math.max(30, 170 - 0.15 * T),
    yieldStrength: (T) => Math.max(100, 310 - 0.25 * T),
    tensileStrength: (T) => Math.max(300, 650 - 0.3 * T),
    thermalExpansion: (T) => 15.9e-6 + 3.0e-9 * T,
    maxTemp: 1050,
    creepRuptureStress: (T) => Math.max(5, 250 * Math.exp(-0.0035 * T)),
  },
  haynes230: {
    name: "Haynes 230",
    k: (T) => 9 + 0.016 * T,
    density: 8970,
    allowableStress: (T) => Math.max(60, 260 - 0.19 * T),
    yieldStrength: (T) => Math.max(160, 480 - 0.32 * T),
    tensileStrength: (T) => Math.max(420, 860 - 0.36 * T),
    thermalExpansion: (T) => 12.7e-6 + 2.8e-9 * T,
    maxTemp: 1095,
    creepRuptureStress: (T) => Math.max(12, 400 * Math.exp(-0.0028 * T)),
  },
};

// ─── Combustion Fuel Properties ───────────────────────────────────────────────

const COMBUSTION_FUELS: Record<string, {
  name: string;
  LHV_kJ_Nm3: number;
  stoichAir_Nm3: number;
  adiabaticFlameT: (lambda: number) => number;
  Cp_flueGas: number;
}> = {
  NG: {
    name: "Natural Gas",
    LHV_kJ_Nm3: 35800,
    stoichAir_Nm3: 9.52,
    adiabaticFlameT: (lambda) => 2000 - 600 * (lambda - 1),
    Cp_flueGas: 1.15,
  },
  H2: {
    name: "Hydrogen",
    LHV_kJ_Nm3: 10800,
    stoichAir_Nm3: 2.38,
    adiabaticFlameT: (lambda) => 2100 - 700 * (lambda - 1),
    Cp_flueGas: 1.10,
  },
  anode_offgas: {
    name: "Anode Off-Gas",
    LHV_kJ_Nm3: 8500,
    stoichAir_Nm3: 3.5,
    adiabaticFlameT: (lambda) => 1600 - 500 * (lambda - 1),
    Cp_flueGas: 1.12,
  },
};

// ─── NumField Component ───────────────────────────────────────────────────────

function NumField({
  label,
  value,
  unit,
  onChange,
  step,
  min,
  max,
}: {
  label: string;
  value: number;
  unit?: string;
  onChange: (v: number) => void;
  step?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="w-36 shrink-0 text-sm">{label}</Label>
      <Input
        type="number"
        step={step ?? "any"}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="font-mono"
      />
      {unit && (
        <span className="w-16 shrink-0 text-xs text-muted-foreground">
          {unit}
        </span>
      )}
    </div>
  );
}

// ─── Calculation Engine ───────────────────────────────────────────────────────

function calculateHER(
  reforming: ReformingInputs,
  combustion: CombustionInputs,
  geometry: GeometryInputs
): HERResults {
  const mat = MATERIALS[geometry.material];
  const fuel = COMBUSTION_FUELS[combustion.fuelType];

  const tubeID = geometry.tubeID_mm / 1000;
  const tubeOD = geometry.tubeOD_mm / 1000;
  const wallThick = (tubeOD - tubeID) / 2;
  const tubeLength = geometry.tubeLength_m;
  const nTubes = geometry.tubeCount;

  // ─── Process side (reforming) gas properties at avg T ───
  const T_proc_avg = (reforming.inletT_C + reforming.outletT_C) / 2;
  const mu_proc = (1.5e-5 + 2.5e-8 * T_proc_avg);
  const k_proc = 0.025 + 5e-5 * T_proc_avg;
  const Cp_proc = 2200 + 0.5 * T_proc_avg;
  const rho_proc = (reforming.pressure_kPa * 1000 * 0.018) / (8.314 * (T_proc_avg + 273.15));

  const totalFlowProc_m3s = (reforming.flowRate_Nm3h * (1 + reforming.SC_ratio * reforming.CH4_percent / 100)) / 3600
    * ((T_proc_avg + 273.15) / 273.15) * (101.325 / reforming.pressure_kPa);
  const flowPerTube = totalFlowProc_m3s / nTubes;
  const A_tube_inner = Math.PI * tubeID * tubeID / 4;
  const v_proc = flowPerTube / A_tube_inner;

  const Re_proc = rho_proc * v_proc * tubeID / mu_proc;
  const Pr_proc = mu_proc * Cp_proc / k_proc;
  const Nu_proc = 0.023 * Math.pow(Math.max(Re_proc, 100), 0.8) * Math.pow(Math.max(Pr_proc, 0.1), 0.4);
  const h_proc = Nu_proc * k_proc / tubeID;

  // ─── Combustion side gas properties ───
  const combustionHeat_kW = combustion.flowRate_Nm3h * fuel.LHV_kJ_Nm3 / 3600;
  const T_flame = fuel.adiabaticFlameT(combustion.excessAirRatio);
  const totalAirFlow = combustion.flowRate_Nm3h * fuel.stoichAir_Nm3 * combustion.excessAirRatio;
  const totalFlueGas_Nm3h = combustion.flowRate_Nm3h + totalAirFlow;

  const T_comb_in = Math.min(T_flame, combustion.inletT_C > 500 ? combustion.inletT_C : T_flame * 0.85);

  const Q_duty = reforming.flowRate_Nm3h * reforming.CH4_percent / 100 * 206 * 1000 / (3600 * 22.4)
    * (reforming.outletT_C - reforming.inletT_C) / 500;
  const heatDuty_kW = Math.max(Q_duty, combustionHeat_kW * 0.6);

  const T_comb_out = T_comb_in - heatDuty_kW / (totalFlueGas_Nm3h / 3600 * 1.2 * fuel.Cp_flueGas * 1000 + 0.001);
  const T_comb_out_safe = Math.max(T_comb_out, reforming.inletT_C + 50);

  const T_comb_avg = (T_comb_in + T_comb_out_safe) / 2;
  const mu_comb = 2.0e-5 + 3.5e-8 * T_comb_avg;
  const k_comb = 0.03 + 6e-5 * T_comb_avg;
  const Cp_comb = fuel.Cp_flueGas * 1000;
  const rho_comb = 101325 * 0.029 / (8.314 * (T_comb_avg + 273.15));

  const shellID = geometry.shellID_mm / 1000;
  const A_shell = Math.PI * shellID * shellID / 4 - nTubes * Math.PI * tubeOD * tubeOD / 4;
  const D_h_shell = 4 * A_shell / (Math.PI * shellID + nTubes * Math.PI * tubeOD);

  const totalFlowComb_m3s = totalFlueGas_Nm3h / 3600
    * ((T_comb_avg + 273.15) / 273.15);
  const v_comb = totalFlowComb_m3s / Math.max(A_shell, 0.001);

  const Re_comb = rho_comb * v_comb * D_h_shell / mu_comb;
  const Pr_comb = mu_comb * Cp_comb / k_comb;

  // Gnielinski: Nu = (f/8)(Re-1000)Pr / [1 + 12.7(f/8)^0.5(Pr^(2/3)-1)]
  const f_comb = Math.pow(0.790 * Math.log(Math.max(Re_comb, 3000)) - 1.64, -2);
  const Nu_comb_raw = (f_comb / 8) * (Math.max(Re_comb, 3000) - 1000) * Pr_comb
    / (1 + 12.7 * Math.sqrt(f_comb / 8) * (Math.pow(Pr_comb, 2 / 3) - 1));
  const Nu_comb = Math.max(Nu_comb_raw, 3.66);
  const h_comb = Nu_comb * k_comb / D_h_shell;

  // ─── Wall resistance ───
  const T_wall_avg = (T_proc_avg + T_comb_avg) / 2;
  const k_wall = mat.k(T_wall_avg);
  const R_wall = wallThick / k_wall;

  // ─── Overall U ───
  const U_overall = 1 / (1 / h_proc + R_wall + 1 / h_comb);

  // ─── LMTD (counter-current) ───
  const dT1 = T_comb_in - reforming.outletT_C;
  const dT2 = T_comb_out_safe - reforming.inletT_C;
  const LMTD = Math.abs(dT1 - dT2) < 1
    ? (dT1 + dT2) / 2
    : (dT1 - dT2) / Math.log(dT1 / dT2);

  // ─── Area ───
  const requiredArea = heatDuty_kW * 1000 / (U_overall * LMTD);
  const actualArea = nTubes * Math.PI * tubeOD * tubeLength;
  const designMargin = ((actualArea - requiredArea) / requiredArea) * 100;

  // ─── Temperature profile (1D discretization, 20 steps) ───
  const nSteps = 20;
  const dx = tubeLength / nSteps;
  const tempProfile: TempProfilePoint[] = [];

  let T_proc_local = reforming.inletT_C;
  let T_comb_local = T_comb_out_safe;

  const m_dot_proc = rho_proc * flowPerTube * nTubes;
  const m_dot_comb = rho_comb * v_comb * A_shell;

  for (let i = 0; i <= nSteps; i++) {
    const pos = i * dx;
    const dA = nTubes * Math.PI * tubeOD * dx;

    const T_wall_local = (h_proc * T_proc_local + h_comb * T_comb_local) / (h_proc + h_comb);

    tempProfile.push({
      position_m: +pos.toFixed(3),
      processT_C: +T_proc_local.toFixed(1),
      combustionT_C: +T_comb_local.toFixed(1),
      wallT_C: +T_wall_local.toFixed(1),
    });

    if (i < nSteps) {
      const dQ = U_overall * dA * (T_comb_local - T_proc_local);
      T_proc_local += dQ / (Math.max(m_dot_proc, 0.001) * Cp_proc);
      T_comb_local -= dQ / (Math.max(m_dot_comb, 0.001) * Cp_comb);
    }
  }

  // ─── Pressure drop ───
  // Process side: Hagen-Poiseuille for channels
  const f_proc = Re_proc > 2300
    ? 0.316 * Math.pow(Re_proc, -0.25)
    : 64 / Math.max(Re_proc, 1);
  const dP_proc = f_proc * (tubeLength / tubeID) * 0.5 * rho_proc * v_proc * v_proc / 1000;

  // Combustion side: Darcy-Weisbach
  const f_comb_dw = Re_comb > 2300
    ? 0.316 * Math.pow(Re_comb, -0.25)
    : 64 / Math.max(Re_comb, 1);
  const dP_comb = f_comb_dw * (tubeLength / D_h_shell) * 0.5 * rho_comb * v_comb * v_comb / 1000;

  // ─── Mechanical ───
  const T_design = Math.max(reforming.outletT_C, T_comb_in) + 25;
  const P_design = Math.max(reforming.pressure_kPa, 101.325) / 1000; // MPa
  const S_allow = mat.allowableStress(T_design);
  const E_weld = 0.85;

  // ASME VIII Div.1: t = PR / (SE - 0.6P)
  const t_min_inner = (P_design * tubeID * 1000 / 2) / (S_allow * E_weld - 0.6 * P_design);
  const t_min = Math.max(t_min_inner, 0.5);

  const alpha = mat.thermalExpansion(T_design);
  const E_modulus = 200000 - 80 * T_design;
  const dT_wall = Math.abs(T_comb_avg - T_proc_avg) * wallThick * h_proc / (k_wall + wallThick * h_proc);
  const thermalStress = (alpha * E_modulus * dT_wall) / (2 * (1 - 0.3));

  const creepStress = mat.creepRuptureStress(T_design);
  const creepLife = creepStress > thermalStress
    ? 100000 * Math.pow(creepStress / Math.max(thermalStress, 1), 3)
    : 10000;

  const mechanical: MechanicalResult = {
    minWallThickness_mm: +t_min.toFixed(2),
    actualWallThickness_mm: +((tubeOD - tubeID) / 2 * 1000).toFixed(2),
    safetyFactor: +((wallThick * 1000) / t_min).toFixed(2),
    thermalStress_MPa: +thermalStress.toFixed(1),
    allowableStress_MPa: +S_allow.toFixed(1),
    yieldStrength_MPa: +mat.yieldStrength(T_design).toFixed(1),
    tensileStrength_MPa: +mat.tensileStrength(T_design).toFixed(1),
    thermalExpansion: +alpha.toExponential(2),
    k_material: +k_wall.toFixed(2),
    density_kg_m3: mat.density,
    creepLife_hours: +creepLife.toFixed(0),
    maxOperatingT_C: mat.maxTemp,
  };

  // ─── Sizing summary ───
  const tubeVolume = nTubes * Math.PI * ((tubeOD / 2) ** 2 - (tubeID / 2) ** 2) * tubeLength;
  const tubeWeight = tubeVolume * mat.density;
  const shellThick = 0.006;
  const shellOD = shellID + 2 * shellThick;
  const shellVolume = Math.PI * ((shellOD / 2) ** 2 - (shellID / 2) ** 2) * (tubeLength + 0.2);
  const shellWeight = shellVolume * mat.density;
  const totalVolume = Math.PI * (shellOD / 2) ** 2 * tubeLength;
  const compactness = heatDuty_kW / totalVolume;
  const effectiveness = heatDuty_kW / (Math.max(m_dot_proc * Cp_proc, m_dot_comb * Cp_comb) * (T_comb_in - reforming.inletT_C) / 1000 + 0.001);

  const sizing: SizingSummary = {
    totalWeight_kg: +(tubeWeight + shellWeight).toFixed(1),
    tubeWeight_kg: +tubeWeight.toFixed(1),
    shellWeight_kg: +shellWeight.toFixed(1),
    totalLength_m: +(tubeLength + 0.2).toFixed(2),
    shellOD_mm: +(shellOD * 1000).toFixed(0),
    compactness_kW_m3: +compactness.toFixed(1),
    effectiveness: +Math.min(effectiveness, 0.99).toFixed(3),
  };

  return {
    thermal: {
      heatDuty_kW: +heatDuty_kW.toFixed(2),
      LMTD_C: +LMTD.toFixed(1),
      U_overall: +U_overall.toFixed(1),
      requiredArea_m2: +requiredArea.toFixed(4),
      actualArea_m2: +actualArea.toFixed(4),
      designMargin_percent: +designMargin.toFixed(1),
      h_process: +h_proc.toFixed(1),
      h_combustion: +h_comb.toFixed(1),
      Re_process: +Re_proc.toFixed(0),
      Re_combustion: +Re_comb.toFixed(0),
      Pr_process: +Pr_proc.toFixed(3),
      Pr_combustion: +Pr_comb.toFixed(3),
      Nu_process: +Nu_proc.toFixed(1),
      Nu_combustion: +Nu_comb.toFixed(1),
      wallResistance: +R_wall.toExponential(3),
      k_wall: +k_wall.toFixed(2),
      wallThickness_mm: +(wallThick * 1000).toFixed(2),
      dT1: +dT1.toFixed(1),
      dT2: +dT2.toFixed(1),
    },
    tempProfile,
    pressureDrop: {
      process_kPa: +dP_proc.toFixed(3),
      combustion_kPa: +dP_comb.toFixed(3),
      process_method: Re_proc > 2300 ? "Blasius (turbulent)" : "Hagen-Poiseuille (laminar)",
      combustion_method: "Darcy-Weisbach",
      process_Re: +Re_proc.toFixed(0),
      combustion_Re: +Re_comb.toFixed(0),
      process_f: +f_proc.toExponential(3),
      combustion_f: +f_comb_dw.toExponential(3),
    },
    mechanical,
    sizing,
  };
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function HeatExchangerPage() {
  const [reforming, setReforming] = useState<ReformingInputs>({
    fuelType: "NG",
    CH4_percent: 93,
    flowRate_Nm3h: 10,
    SC_ratio: 3.0,
    inletT_C: 450,
    outletT_C: 800,
    pressure_kPa: 200,
  });

  const [combustion, setCombustion] = useState<CombustionInputs>({
    fuelType: "NG",
    flowRate_Nm3h: 5,
    excessAirRatio: 1.15,
    inletT_C: 900,
  });

  const [geometry, setGeometry] = useState<GeometryInputs>({
    tubeCount: 37,
    tubeID_mm: 20,
    tubeOD_mm: 25,
    tubeLength_m: 1.5,
    tubePitch_mm: 32,
    shellID_mm: 250,
    material: "inconel625",
  });

  const [results, setResults] = useState<HERResults | null>(null);
  const [calculating, setCalculating] = useState(false);

  const calculate = useCallback(() => {
    setCalculating(true);
    setTimeout(() => {
      const res = calculateHER(reforming, combustion, geometry);
      setResults(res);
      setCalculating(false);
    }, 200);
  }, [reforming, combustion, geometry]);

  const materialInfo = useMemo(() => MATERIALS[geometry.material], [geometry.material]);
  const combustionFuelInfo = useMemo(() => COMBUSTION_FUELS[combustion.fuelType], [combustion.fuelType]);

  const pressureDropChartData = useMemo(() => {
    if (!results) return [];
    return [
      { name: "Process Side", dP: results.pressureDrop.process_kPa, fill: "#3B82F6" },
      { name: "Combustion Side", dP: results.pressureDrop.combustion_kPa, fill: "#EF4444" },
    ];
  }, [results]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#7A0A1E] via-[#C8102E] to-[#E03050] p-8 text-white">
        <div className="absolute inset-0 opacity-[0.03]">
          <svg width="100%" height="100%">
            <pattern id="hex" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M25 0 L50 15 L50 35 L25 50 L0 35 L0 15 Z" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#hex)" />
          </svg>
        </div>
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-white/15 text-white border-white/20">Module 3</Badge>
            <Badge className="bg-white/10 text-white/70 border-white/10">HER</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Heat Exchange Reformer Calculator
          </h1>
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5">
            <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" /></span>
            <span className="text-[10px] font-medium tracking-wide text-white/80">AI Copilot — powered by BelgaLabs</span>
          </div>
          <p className="text-white/70 text-sm leading-relaxed max-w-2xl">
            Thermally couple endothermic reforming with exothermic combustion across a heat transfer surface.
            Counter-current LMTD sizing, Dittus-Boelter &amp; Gnielinski convection correlations,
            1D temperature profiles, ASME wall thickness, thermal stress &amp; creep life analysis.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {["LMTD", "Dittus-Boelter", "Gnielinski", "Darcy-Weisbach", "ASME VIII", "Creep"].map((tag) => (
              <span key={tag} className="rounded-md border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-mono font-bold">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Input Section — 3 cards in a row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Reforming Side */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" /> Reforming Side
            </CardTitle>
            <CardDescription>Endothermic process gas conditions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="w-36 shrink-0 text-sm">Fuel Type</Label>
              <Select
                value={reforming.fuelType}
                onValueChange={(v) => setReforming((p) => ({ ...p, fuelType: v as "NG" | "biogas" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NG">Natural Gas</SelectItem>
                  <SelectItem value="biogas">Biogas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <NumField label="CH₄ Content" value={reforming.CH4_percent} unit="mol%"
              onChange={(v) => setReforming((p) => ({ ...p, CH4_percent: v }))} />
            <NumField label="Flow Rate" value={reforming.flowRate_Nm3h} unit="Nm³/h"
              onChange={(v) => setReforming((p) => ({ ...p, flowRate_Nm3h: v }))} />
            <NumField label="S/C Ratio" value={reforming.SC_ratio} unit="mol/mol" step="0.1"
              onChange={(v) => setReforming((p) => ({ ...p, SC_ratio: v }))} />
            <NumField label="Inlet T" value={reforming.inletT_C} unit="°C"
              onChange={(v) => setReforming((p) => ({ ...p, inletT_C: v }))} />
            <NumField label="Outlet T" value={reforming.outletT_C} unit="°C"
              onChange={(v) => setReforming((p) => ({ ...p, outletT_C: v }))} />
            <NumField label="Pressure" value={reforming.pressure_kPa} unit="kPa"
              onChange={(v) => setReforming((p) => ({ ...p, pressure_kPa: v }))} />
          </CardContent>
        </Card>

        {/* Combustion Side */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-red-500" /> Combustion Side
            </CardTitle>
            <CardDescription>Exothermic heat source conditions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="w-36 shrink-0 text-sm">Fuel Type</Label>
              <Select
                value={combustion.fuelType}
                onValueChange={(v) => setCombustion((p) => ({ ...p, fuelType: v as "NG" | "H2" | "anode_offgas" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NG">Natural Gas</SelectItem>
                  <SelectItem value="H2">Hydrogen</SelectItem>
                  <SelectItem value="anode_offgas">Anode Off-Gas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <NumField label="Flow Rate" value={combustion.flowRate_Nm3h} unit="Nm³/h"
              onChange={(v) => setCombustion((p) => ({ ...p, flowRate_Nm3h: v }))} />
            <NumField label="Excess Air λ" value={combustion.excessAirRatio} unit="" step="0.05"
              min={1.05} max={1.5}
              onChange={(v) => setCombustion((p) => ({ ...p, excessAirRatio: v }))} />
            <NumField label="Inlet T" value={combustion.inletT_C} unit="°C"
              onChange={(v) => setCombustion((p) => ({ ...p, inletT_C: v }))} />

            <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1 mt-2">
              <p className="font-semibold">Combustion Summary</p>
              <div className="grid grid-cols-2 gap-x-4">
                <span className="text-muted-foreground">Fuel</span>
                <span className="font-mono">{combustionFuelInfo.name}</span>
                <span className="text-muted-foreground">LHV</span>
                <span className="font-mono">{combustionFuelInfo.LHV_kJ_Nm3.toLocaleString()} kJ/Nm³</span>
                <span className="text-muted-foreground">Thermal Input</span>
                <span className="font-mono">{(combustion.flowRate_Nm3h * combustionFuelInfo.LHV_kJ_Nm3 / 3600).toFixed(1)} kW</span>
                <span className="text-muted-foreground">Adiabatic Flame T</span>
                <span className="font-mono">{combustionFuelInfo.adiabaticFlameT(combustion.excessAirRatio).toFixed(0)} °C</span>
                <span className="text-muted-foreground">Stoich Air</span>
                <span className="font-mono">{combustionFuelInfo.stoichAir_Nm3} Nm³/Nm³</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Geometry & Material */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Ruler className="h-4 w-4 text-blue-500" /> Geometry &amp; Material
            </CardTitle>
            <CardDescription>Tube bundle and shell configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <NumField label="Tube Count" value={geometry.tubeCount} unit="tubes"
              onChange={(v) => setGeometry((p) => ({ ...p, tubeCount: Math.round(v) }))} step="1" />
            <NumField label="Tube ID" value={geometry.tubeID_mm} unit="mm"
              onChange={(v) => setGeometry((p) => ({ ...p, tubeID_mm: v }))} />
            <NumField label="Tube OD" value={geometry.tubeOD_mm} unit="mm"
              onChange={(v) => setGeometry((p) => ({ ...p, tubeOD_mm: v }))} />
            <NumField label="Tube Length" value={geometry.tubeLength_m} unit="m" step="0.1"
              onChange={(v) => setGeometry((p) => ({ ...p, tubeLength_m: v }))} />
            <NumField label="Tube Pitch" value={geometry.tubePitch_mm} unit="mm"
              onChange={(v) => setGeometry((p) => ({ ...p, tubePitch_mm: v }))} />
            <NumField label="Shell ID" value={geometry.shellID_mm} unit="mm"
              onChange={(v) => setGeometry((p) => ({ ...p, shellID_mm: v }))} />
            <div className="flex items-center gap-2">
              <Label className="w-36 shrink-0 text-sm">Material</Label>
              <Select
                value={geometry.material}
                onValueChange={(v) => setGeometry((p) => ({ ...p, material: v as GeometryInputs["material"] }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inconel625">Inconel 625</SelectItem>
                  <SelectItem value="ss310">SS 310</SelectItem>
                  <SelectItem value="haynes230">Haynes 230</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1 mt-2">
              <p className="font-semibold">{materialInfo.name} Properties</p>
              <div className="grid grid-cols-2 gap-x-4">
                <span className="text-muted-foreground">k @ 700°C</span>
                <span className="font-mono">{materialInfo.k(700).toFixed(1)} W/mK</span>
                <span className="text-muted-foreground">ρ</span>
                <span className="font-mono">{materialInfo.density} kg/m³</span>
                <span className="text-muted-foreground">Max T</span>
                <span className="font-mono">{materialInfo.maxTemp} °C</span>
                <span className="text-muted-foreground">σ_allow @ 700°C</span>
                <span className="font-mono">{materialInfo.allowableStress(700).toFixed(0)} MPa</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calculate Button */}
      <div className="flex justify-center">
        <Button
          size="lg"
          className="bg-[#C8102E] hover:bg-[#A00D25] text-white px-8"
          onClick={calculate}
          disabled={calculating}
        >
          {calculating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Calculator className="mr-2 h-4 w-4" />
          )}
          {calculating ? "Computing..." : "Calculate HER Design"}
        </Button>
      </div>

      {/* Results Section */}
      {results && (
        <Tabs defaultValue="thermal" className="mt-2">
          <TabsList className="flex-wrap">
            <TabsTrigger value="thermal">
              <Flame className="mr-1.5 h-3.5 w-3.5" /> Thermal Design
            </TabsTrigger>
            <TabsTrigger value="profiles">
              <Activity className="mr-1.5 h-3.5 w-3.5" /> Temperature Profiles
            </TabsTrigger>
            <TabsTrigger value="pressure">
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Pressure Drop
            </TabsTrigger>
            <TabsTrigger value="mechanical">
              <Shield className="mr-1.5 h-3.5 w-3.5" /> Mechanical
            </TabsTrigger>
            <TabsTrigger value="sizing">
              <Weight className="mr-1.5 h-3.5 w-3.5" /> Sizing Summary
            </TabsTrigger>
          </TabsList>

          {/* ─── Thermal Design Tab ─── */}
          <TabsContent value="thermal" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* KPI Cards */}
              <div className="md:col-span-2 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: "Heat Duty", value: `${results.thermal.heatDuty_kW.toFixed(1)} kW`, color: "text-red-600" },
                  { label: "LMTD", value: `${results.thermal.LMTD_C.toFixed(1)} °C`, color: "text-orange-600" },
                  { label: "U Overall", value: `${results.thermal.U_overall.toFixed(1)} W/m²K`, color: "text-blue-600" },
                  { label: "Required Area", value: `${results.thermal.requiredArea_m2.toFixed(3)} m²`, color: "text-purple-600" },
                  { label: "Actual Area", value: `${results.thermal.actualArea_m2.toFixed(3)} m²`, color: "text-emerald-600" },
                  { label: "Design Margin", value: `${results.thermal.designMargin_percent.toFixed(1)}%`, color: results.thermal.designMargin_percent > 0 ? "text-green-600" : "text-red-600" },
                ].map((kpi) => (
                  <Card key={kpi.label}>
                    <CardContent className="pt-4 pb-3">
                      <p className="text-xs text-muted-foreground">{kpi.label}</p>
                      <p className={`text-lg font-bold font-mono ${kpi.color}`}>{kpi.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* HTC Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Heat Transfer Coefficient Breakdown</CardTitle>
                  <CardDescription>U = 1 / (1/h_i + t_w/k_w + 1/h_o)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-semibold text-blue-600 mb-2">Process Side (Dittus-Boelter)</p>
                      <p className="text-xs text-muted-foreground mb-1">Nu = 0.023 · Re⁰·⁸ · Pr⁰·⁴</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <span className="text-muted-foreground">Re</span>
                        <span className="font-mono">{Number(results.thermal.Re_process).toLocaleString()}</span>
                        <span className="text-muted-foreground">Pr</span>
                        <span className="font-mono">{results.thermal.Pr_process}</span>
                        <span className="text-muted-foreground">Nu</span>
                        <span className="font-mono">{results.thermal.Nu_process}</span>
                        <span className="text-muted-foreground font-semibold">h_process</span>
                        <span className="font-mono font-semibold">{results.thermal.h_process} W/m²K</span>
                      </div>
                    </div>

                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-semibold text-red-600 mb-2">Combustion Side (Gnielinski)</p>
                      <p className="text-xs text-muted-foreground mb-1">Nu = (f/8)(Re−1000)Pr / [1 + 12.7√(f/8)(Pr²ᐟ³−1)]</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <span className="text-muted-foreground">Re</span>
                        <span className="font-mono">{Number(results.thermal.Re_combustion).toLocaleString()}</span>
                        <span className="text-muted-foreground">Pr</span>
                        <span className="font-mono">{results.thermal.Pr_combustion}</span>
                        <span className="text-muted-foreground">Nu</span>
                        <span className="font-mono">{results.thermal.Nu_combustion}</span>
                        <span className="text-muted-foreground font-semibold">h_combustion</span>
                        <span className="font-mono font-semibold">{results.thermal.h_combustion} W/m²K</span>
                      </div>
                    </div>

                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-semibold text-gray-600 mb-2">Wall Resistance</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <span className="text-muted-foreground">Material</span>
                        <span className="font-mono">{materialInfo.name}</span>
                        <span className="text-muted-foreground">k_wall</span>
                        <span className="font-mono">{results.thermal.k_wall} W/mK</span>
                        <span className="text-muted-foreground">Wall thickness</span>
                        <span className="font-mono">{results.thermal.wallThickness_mm} mm</span>
                        <span className="text-muted-foreground">R_wall</span>
                        <span className="font-mono">{results.thermal.wallResistance} m²K/W</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* LMTD Diagram */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Counter-Current LMTD</CardTitle>
                  <CardDescription>LMTD = (ΔT₁ − ΔT₂) / ln(ΔT₁/ΔT₂)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border-2 border-red-500/30 bg-red-500/5 p-3 text-center">
                        <p className="text-xs text-muted-foreground">ΔT₁ (hot end)</p>
                        <p className="text-2xl font-mono font-bold text-red-600">{results.thermal.dT1.toFixed(1)} °C</p>
                        <p className="text-[10px] text-muted-foreground">T_comb,in − T_proc,out</p>
                      </div>
                      <div className="rounded-lg border-2 border-blue-500/30 bg-blue-500/5 p-3 text-center">
                        <p className="text-xs text-muted-foreground">ΔT₂ (cold end)</p>
                        <p className="text-2xl font-mono font-bold text-blue-600">{results.thermal.dT2.toFixed(1)} °C</p>
                        <p className="text-[10px] text-muted-foreground">T_comb,out − T_proc,in</p>
                      </div>
                    </div>
                    <div className="rounded-lg border-2 border-orange-500/30 bg-orange-500/5 p-4 text-center">
                      <p className="text-xs text-muted-foreground">LMTD</p>
                      <p className="text-3xl font-mono font-bold text-orange-600">{results.thermal.LMTD_C.toFixed(1)} °C</p>
                    </div>

                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs font-semibold mb-2">Resistance Network</p>
                      <div className="flex items-center justify-between text-xs">
                        <div className="text-center flex-1">
                          <p className="text-muted-foreground">1/h_i</p>
                          <p className="font-mono font-bold">{(1 / results.thermal.h_process).toExponential(3)}</p>
                        </div>
                        <span className="text-muted-foreground">+</span>
                        <div className="text-center flex-1">
                          <p className="text-muted-foreground">t/k_w</p>
                          <p className="font-mono font-bold">{results.thermal.wallResistance}</p>
                        </div>
                        <span className="text-muted-foreground">+</span>
                        <div className="text-center flex-1">
                          <p className="text-muted-foreground">1/h_o</p>
                          <p className="font-mono font-bold">{(1 / results.thermal.h_combustion).toExponential(3)}</p>
                        </div>
                        <span className="text-muted-foreground">=</span>
                        <div className="text-center flex-1">
                          <p className="text-muted-foreground">1/U</p>
                          <p className="font-mono font-bold">{(1 / results.thermal.U_overall).toExponential(3)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─── Temperature Profiles Tab ─── */}
          <TabsContent value="profiles" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Temperature Profiles Along Tube Length</CardTitle>
                <CardDescription>
                  1D discretization ({results.tempProfile.length} nodes) — counter-current flow.
                  Process gas flows left→right, combustion gas flows right→left.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={420}>
                  <LineChart data={results.tempProfile}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                      dataKey="position_m"
                      label={{ value: "Position along tube [m]", position: "insideBottom", offset: -5 }}
                    />
                    <YAxis label={{ value: "Temperature [°C]", angle: -90, position: "insideLeft" }} />
                    <Tooltip
                      formatter={(v: number, name: string) => [`${v.toFixed(1)} °C`, name]}
                      labelFormatter={(l) => `Position: ${l} m`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="processT_C"
                      name="Process Gas T"
                      stroke="#3B82F6"
                      strokeWidth={2.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="combustionT_C"
                      name="Combustion Gas T"
                      stroke="#EF4444"
                      strokeWidth={2.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="wallT_C"
                      name="Tube Wall T"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>

                <div className="grid grid-cols-3 gap-4 mt-4">
                  {[
                    { label: "Process Gas", inlet: results.tempProfile[0].processT_C, outlet: results.tempProfile[results.tempProfile.length - 1].processT_C, color: "text-blue-600" },
                    { label: "Combustion Gas", inlet: results.tempProfile[results.tempProfile.length - 1].combustionT_C, outlet: results.tempProfile[0].combustionT_C, color: "text-red-600" },
                    { label: "Max Wall T", inlet: Math.max(...results.tempProfile.map((p) => p.wallT_C)), outlet: Math.min(...results.tempProfile.map((p) => p.wallT_C)), color: "text-amber-600" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border p-3 text-center">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className={`text-lg font-mono font-bold ${item.color}`}>
                        {item.inlet.toFixed(0)} → {item.outlet.toFixed(0)} °C
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Pressure Drop Tab ─── */}
          <TabsContent value="pressure" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pressure Drop Comparison</CardTitle>
                  <CardDescription>Process side vs combustion side</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={pressureDropChartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" />
                      <YAxis label={{ value: "ΔP [kPa]", angle: -90, position: "insideLeft" }} />
                      <Tooltip formatter={(v: number) => `${v.toFixed(3)} kPa`} />
                      <Bar dataKey="dP" name="ΔP [kPa]" radius={[4, 4, 0, 0]}>
                        {pressureDropChartData.map((entry, i) => (
                          <Bar key={i} dataKey="dP" fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pressure Drop Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-semibold text-blue-600 mb-2">Process Side</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <span className="text-muted-foreground">Method</span>
                        <span className="font-mono text-xs">{results.pressureDrop.process_method}</span>
                        <span className="text-muted-foreground">Re</span>
                        <span className="font-mono">{Number(results.pressureDrop.process_Re).toLocaleString()}</span>
                        <span className="text-muted-foreground">Friction factor</span>
                        <span className="font-mono">{results.pressureDrop.process_f}</span>
                        <span className="text-muted-foreground font-semibold">ΔP</span>
                        <span className="font-mono font-semibold">{results.pressureDrop.process_kPa.toFixed(3)} kPa</span>
                      </div>
                    </div>

                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-semibold text-red-600 mb-2">Combustion Side</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <span className="text-muted-foreground">Method</span>
                        <span className="font-mono text-xs">{results.pressureDrop.combustion_method}</span>
                        <span className="text-muted-foreground">Re</span>
                        <span className="font-mono">{Number(results.pressureDrop.combustion_Re).toLocaleString()}</span>
                        <span className="text-muted-foreground">Friction factor</span>
                        <span className="font-mono">{results.pressureDrop.combustion_f}</span>
                        <span className="text-muted-foreground font-semibold">ΔP</span>
                        <span className="font-mono font-semibold">{results.pressureDrop.combustion_kPa.toFixed(3)} kPa</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─── Mechanical Tab ─── */}
          <TabsContent value="mechanical" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">ASME Wall Thickness Calculation</CardTitle>
                  <CardDescription>ASME VIII Div.1: t = PR / (SE − 0.6P)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border-2 border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Min Required</p>
                        <p className="text-2xl font-mono font-bold text-emerald-600">{results.mechanical.minWallThickness_mm} mm</p>
                      </div>
                      <div className="rounded-lg border-2 border-blue-500/30 bg-blue-500/5 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Actual</p>
                        <p className="text-2xl font-mono font-bold text-blue-600">{results.mechanical.actualWallThickness_mm} mm</p>
                      </div>
                    </div>
                    <div className={`rounded-lg border-2 p-3 text-center ${
                      results.mechanical.safetyFactor >= 2 ? "border-green-500/30 bg-green-500/5" :
                      results.mechanical.safetyFactor >= 1 ? "border-amber-500/30 bg-amber-500/5" :
                      "border-red-500/30 bg-red-500/5"
                    }`}>
                      <p className="text-xs text-muted-foreground">Safety Factor</p>
                      <p className={`text-3xl font-mono font-bold ${
                        results.mechanical.safetyFactor >= 2 ? "text-green-600" :
                        results.mechanical.safetyFactor >= 1 ? "text-amber-600" : "text-red-600"
                      }`}>
                        {results.mechanical.safetyFactor}×
                      </p>
                      <Badge variant={results.mechanical.safetyFactor >= 1.5 ? "secondary" : "destructive"} className="mt-1">
                        {results.mechanical.safetyFactor >= 2 ? "Adequate" : results.mechanical.safetyFactor >= 1 ? "Marginal" : "INSUFFICIENT"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Thermal Stress &amp; Creep</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {[
                        ["Thermal Stress", `${results.mechanical.thermalStress_MPa} MPa`],
                        ["Allowable Stress", `${results.mechanical.allowableStress_MPa} MPa`],
                        ["Yield Strength", `${results.mechanical.yieldStrength_MPa} MPa`],
                        ["Tensile Strength", `${results.mechanical.tensileStrength_MPa} MPa`],
                        ["Thermal Expansion", `${results.mechanical.thermalExpansion} /°C`],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between rounded-lg border p-2">
                          <span className="text-muted-foreground">{k}</span>
                          <span className="font-mono font-medium">{v}</span>
                        </div>
                      ))}
                    </div>

                    <div className={`rounded-lg border-2 p-3 text-center ${
                      results.mechanical.creepLife_hours > 80000 ? "border-green-500/30 bg-green-500/5" :
                      results.mechanical.creepLife_hours > 40000 ? "border-amber-500/30 bg-amber-500/5" :
                      "border-red-500/30 bg-red-500/5"
                    }`}>
                      <p className="text-xs text-muted-foreground">Estimated Creep Life</p>
                      <p className={`text-2xl font-mono font-bold ${
                        results.mechanical.creepLife_hours > 80000 ? "text-green-600" :
                        results.mechanical.creepLife_hours > 40000 ? "text-amber-600" : "text-red-600"
                      }`}>
                        {(results.mechanical.creepLife_hours / 1000).toFixed(0)} kh
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        ≈ {(results.mechanical.creepLife_hours / 8760).toFixed(1)} years continuous
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Material Properties at Design Temperature</CardTitle>
                  <CardDescription>{materialInfo.name} — Max operating temperature: {results.mechanical.maxOperatingT_C}°C</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Property</TableHead>
                          <TableHead>@ 20°C</TableHead>
                          <TableHead>@ 400°C</TableHead>
                          <TableHead>@ 600°C</TableHead>
                          <TableHead>@ 800°C</TableHead>
                          <TableHead>@ 900°C</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">k [W/mK]</TableCell>
                          {[20, 400, 600, 800, 900].map((t) => (
                            <TableCell key={t} className="font-mono">{materialInfo.k(t).toFixed(1)}</TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">σ_allow [MPa]</TableCell>
                          {[20, 400, 600, 800, 900].map((t) => (
                            <TableCell key={t} className="font-mono">{materialInfo.allowableStress(t).toFixed(0)}</TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">σ_yield [MPa]</TableCell>
                          {[20, 400, 600, 800, 900].map((t) => (
                            <TableCell key={t} className="font-mono">{materialInfo.yieldStrength(t).toFixed(0)}</TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">σ_UTS [MPa]</TableCell>
                          {[20, 400, 600, 800, 900].map((t) => (
                            <TableCell key={t} className="font-mono">{materialInfo.tensileStrength(t).toFixed(0)}</TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">α [×10⁻⁶/°C]</TableCell>
                          {[20, 400, 600, 800, 900].map((t) => (
                            <TableCell key={t} className="font-mono">{(materialInfo.thermalExpansion(t) * 1e6).toFixed(2)}</TableCell>
                          ))}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─── Sizing Summary Tab ─── */}
          <TabsContent value="sizing" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-primary" /> Key Dimensions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Parameter</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Unit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[
                          ["Tube Count", geometry.tubeCount, "—"],
                          ["Tube ID", geometry.tubeID_mm, "mm"],
                          ["Tube OD", geometry.tubeOD_mm, "mm"],
                          ["Tube Length", geometry.tubeLength_m, "m"],
                          ["Tube Pitch", geometry.tubePitch_mm, "mm"],
                          ["Shell ID", geometry.shellID_mm, "mm"],
                          ["Shell OD", results.sizing.shellOD_mm, "mm"],
                          ["Total Length (incl. heads)", results.sizing.totalLength_m, "m"],
                          ["Material", materialInfo.name, "—"],
                        ].map(([param, val, unit]) => (
                          <TableRow key={param as string}>
                            <TableCell className="font-medium">{param}</TableCell>
                            <TableCell className="font-mono">{val}</TableCell>
                            <TableCell className="text-muted-foreground">{unit}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Weight className="h-4 w-4 text-primary" /> Weight &amp; Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border p-3 text-center">
                        <p className="text-xs text-muted-foreground">Total Weight</p>
                        <p className="text-2xl font-mono font-bold">{results.sizing.totalWeight_kg} kg</p>
                      </div>
                      <div className="rounded-lg border p-3 text-center">
                        <p className="text-xs text-muted-foreground">Compactness</p>
                        <p className="text-2xl font-mono font-bold">{results.sizing.compactness_kW_m3} kW/m³</p>
                      </div>
                    </div>

                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Metric</TableHead>
                            <TableHead>Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[
                            ["Tube Bundle Weight", `${results.sizing.tubeWeight_kg} kg`],
                            ["Shell Weight", `${results.sizing.shellWeight_kg} kg`],
                            ["Heat Duty", `${results.thermal.heatDuty_kW} kW`],
                            ["Heat Transfer Area", `${results.thermal.actualArea_m2.toFixed(3)} m²`],
                            ["Design Margin", `${results.thermal.designMargin_percent}%`],
                            ["Effectiveness (ε)", results.sizing.effectiveness],
                            ["Process ΔP", `${results.pressureDrop.process_kPa} kPa`],
                            ["Combustion ΔP", `${results.pressureDrop.combustion_kPa} kPa`],
                            ["Wall Safety Factor", `${results.mechanical.safetyFactor}×`],
                            ["Creep Life", `${(results.mechanical.creepLife_hours / 1000).toFixed(0)} kh`],
                          ].map(([k, v]) => (
                            <TableRow key={k as string}>
                              <TableCell className="font-medium">{k}</TableCell>
                              <TableCell className="font-mono">{v}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
