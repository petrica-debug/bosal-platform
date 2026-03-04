"use client";

import { useState, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  ChevronRight,
  ChevronLeft,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Shield,
  Droplets,
  Flame,
  Beaker,
  FileText,
  DollarSign,
  Clock,
  Thermometer,
  Activity,
  Info,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type {
  EngineInputs,
  CatalystChainElement,
  DepollutionSizingResult,
  EmissionStandard,
  CatalystType,
  AgingConfig,
  SCRConfig,
  RFQOutput,
} from "@/lib/catsizer/types";
import {
  ENGINE_PRESETS,
  EMISSION_STANDARDS,
} from "@/lib/catsizer/constants";
import { sizeDepollutionSystem } from "@/lib/catsizer/depollution-engine";
import { generateRFQ } from "@/lib/catsizer/rfq-generator";
import { washcoatThicknessSweep, WASHCOAT_DOC_DEFAULT } from "@/lib/catsizer/washcoat";

const STEPS = [
  "Engine Input",
  "Emission Target",
  "Catalyst Chain",
  "Aging & Durability",
  "Results & RFQ",
] as const;

const DEFAULT_ENGINE: EngineInputs = {
  engineType: "diesel",
  application: "heavy_duty_onroad",
  displacement_L: 6.7,
  ratedPower_kW: 250,
  ratedSpeed_rpm: 2500,
  peakTorque_Nm: 1100,
  numberOfCylinders: 6,
  exhaustFlowRate_kg_h: 900,
  exhaustTemp_C: 350,
  exhaustPressure_kPa: 105,
  ambientTemp_C: 25,
  altitude_m: 0,
  CO_ppm: 400,
  HC_ppm: 80,
  NOx_ppm: 800,
  NO2_fraction: 0.1,
  PM_mg_Nm3: 30,
  SO2_ppm: 5,
  O2_percent: 8,
  H2O_percent: 6,
  CO2_percent: 8,
};

const DEFAULT_CHAIN: CatalystChainElement[] = [
  { type: "DOC", enabled: true },
  { type: "DPF", enabled: true },
  { type: "SCR", enabled: true, scrCatalystType: "Cu-CHA" },
  { type: "ASC", enabled: true },
];

const DEFAULT_AGING: AgingConfig = {
  targetLife_hours: 15000,
  maxOperatingTemp_C: 650,
  fuelSulfur_ppm: 10,
  oilConsumption_g_kWh: 0.3,
  oilPhosphorus_ppm: 800,
  oilAsh_percent: 1.5,
};

const DEFAULT_SCR_CONFIG: SCRConfig = {
  catalystType: "Cu-CHA",
  targetDeNOx: 0.95,
  maxNH3Slip_ppm: 10,
  mixerLength_mm: 400,
  pipeDiameter_mm: 150,
  hasStaticMixer: true,
  hasSwirl: false,
  hasHydrolysisCatalyst: true,
};

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function NumField({
  label,
  value,
  unit,
  onChange,
  step,
}: {
  label: string;
  value: number;
  unit?: string;
  onChange: (v: number) => void;
  step?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="w-36 shrink-0 text-sm">{label}</Label>
      <Input
        type="number"
        step={step ?? "any"}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="font-mono"
      />
      {unit && (
        <span className="w-16 shrink-0 text-sm text-muted-foreground">{unit}</span>
      )}
    </div>
  );
}

export function DepollutionCalculator() {
  const [step, setStep] = useState(0);
  const [engineInputs, setEngineInputs] = useState<EngineInputs>(DEFAULT_ENGINE);
  const [standard, setStandard] = useState<EmissionStandard>("euro_vi_e");
  const [chain, setChain] = useState<CatalystChainElement[]>(DEFAULT_CHAIN);
  const [aging, setAging] = useState<AgingConfig>(DEFAULT_AGING);
  const [scrConfig, setScrConfig] = useState<SCRConfig>(DEFAULT_SCR_CONFIG);
  const [rfq, setRfq] = useState<RFQOutput | null>(null);
  const [baseResult, setBaseResult] = useState<DepollutionSizingResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  const { setValue } = useForm<EngineInputs>({ defaultValues: DEFAULT_ENGINE });

  const applyPreset = (index: number) => {
    const preset = ENGINE_PRESETS[index];
    const merged = { ...DEFAULT_ENGINE, ...preset.inputs } as EngineInputs;
    setEngineInputs(merged);
    for (const [key, val] of Object.entries(merged)) {
      setValue(key as keyof EngineInputs, val as never);
    }
  };

  const updateEngine = (field: keyof EngineInputs, value: string | number) => {
    setEngineInputs((prev) => ({ ...prev, [field]: value }));
  };

  const toggleCatalyst = (index: number) => {
    setChain((prev) =>
      prev.map((c, i) => (i === index ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const calculate = useCallback(() => {
    setCalculating(true);
    setTimeout(() => {
      const base = sizeDepollutionSystem(engineInputs, chain, standard);
      setBaseResult(base);
      const rfqResult = generateRFQ(engineInputs, chain, standard, aging, scrConfig);
      setRfq(rfqResult);
      setCalculating(false);
      setStep(4);
    }, 150);
  }, [engineInputs, chain, standard, aging, scrConfig]);

  const washcoatSweep = useMemo(() => {
    const T_K = engineInputs.exhaustTemp_C + 273.15;
    return washcoatThicknessSweep(T_K, 101.325, 28, 100, WASHCOAT_DOC_DEFAULT);
  }, [engineInputs.exhaustTemp_C]);

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => (i <= step ? setStep(i) : undefined)}
              className={`flex h-8 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                    ? "bg-primary/20 text-primary cursor-pointer"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}. {s}
            </button>
            {i < STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* ============================================================ */}
      {/* STEP 1: ENGINE INPUT */}
      {/* ============================================================ */}
      {step === 0 && (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Engine Presets</CardTitle>
              <CardDescription>Select a preset or enter custom values below</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {ENGINE_PRESETS.map((p, i) => (
                  <Button key={i} variant="outline" size="sm" onClick={() => applyPreset(i)}>
                    {p.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Engine Identity</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Engine Type</Label>
                    <Select value={engineInputs.engineType} onValueChange={(v) => updateEngine("engineType", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="diesel">Diesel</SelectItem>
                        <SelectItem value="natural_gas">Natural Gas</SelectItem>
                        <SelectItem value="dual_fuel">Dual Fuel</SelectItem>
                        <SelectItem value="biogas">Biogas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Application</Label>
                    <Select value={engineInputs.application} onValueChange={(v) => updateEngine("application", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="heavy_duty_onroad">HD On-Road</SelectItem>
                        <SelectItem value="heavy_duty_offroad">HD Off-Road</SelectItem>
                        <SelectItem value="genset">Genset</SelectItem>
                        <SelectItem value="marine">Marine</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {([
                  ["displacement_L", "Displacement", "L"],
                  ["ratedPower_kW", "Rated Power", "kW"],
                  ["ratedSpeed_rpm", "Rated Speed", "rpm"],
                  ["peakTorque_Nm", "Peak Torque", "Nm"],
                  ["numberOfCylinders", "Cylinders", ""],
                ] as const).map(([field, label, unit]) => (
                  <NumField
                    key={field}
                    label={label}
                    value={engineInputs[field] as number}
                    unit={unit}
                    onChange={(v) => updateEngine(field, v)}
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Operating Conditions</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                {([
                  ["exhaustFlowRate_kg_h", "Exhaust Flow", "kg/h"],
                  ["exhaustTemp_C", "Exhaust Temp", "°C"],
                  ["exhaustPressure_kPa", "Exhaust Pressure", "kPa"],
                  ["ambientTemp_C", "Ambient Temp", "°C"],
                  ["altitude_m", "Altitude", "m"],
                ] as const).map(([field, label, unit]) => (
                  <NumField
                    key={field}
                    label={label}
                    value={engineInputs[field] as number}
                    unit={unit}
                    onChange={(v) => updateEngine(field, v)}
                  />
                ))}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-base">Raw Exhaust Composition</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {([
                    ["CO_ppm", "CO", "ppm"],
                    ["HC_ppm", "HC (C1 eq.)", "ppm"],
                    ["NOx_ppm", "NOₓ", "ppm"],
                    ["NO2_fraction", "NO₂/NOₓ", "ratio"],
                    ["PM_mg_Nm3", "PM", "mg/Nm³"],
                    ["SO2_ppm", "SO₂", "ppm"],
                    ["O2_percent", "O₂", "vol%"],
                    ["H2O_percent", "H₂O", "vol%"],
                    ["CO2_percent", "CO₂", "vol%"],
                  ] as const).map(([field, label, unit]) => (
                    <NumField
                      key={field}
                      label={label}
                      value={engineInputs[field] as number}
                      unit={unit}
                      onChange={(v) => updateEngine(field, v)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setStep(1)}>
              Next: Emission Target <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 2: EMISSION STANDARD */}
      {/* ============================================================ */}
      {step === 1 && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.entries(EMISSION_STANDARDS) as [EmissionStandard, (typeof EMISSION_STANDARDS)[EmissionStandard]][]).map(
              ([key, limits]) => (
                <Card
                  key={key}
                  className={`cursor-pointer transition-colors ${
                    standard === key ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/50"
                  }`}
                  onClick={() => setStandard(key)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{key.replace(/_/g, " ").toUpperCase()}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-1 text-sm">
                      {limits.NOx_g_kWh != null && <span>NOₓ: {limits.NOx_g_kWh} g/kWh</span>}
                      {limits.PM_g_kWh != null && <span>PM: {limits.PM_g_kWh} g/kWh</span>}
                      {limits.CO_g_kWh != null && <span>CO: {limits.CO_g_kWh} g/kWh</span>}
                      {limits.HC_g_kWh != null && <span>HC: {limits.HC_g_kWh} g/kWh</span>}
                      {limits.NOx_g_Nm3 != null && <span>NOₓ: {limits.NOx_g_Nm3} g/Nm³</span>}
                      {limits.CO_g_Nm3 != null && <span>CO: {limits.CO_g_Nm3} g/Nm³</span>}
                    </div>
                  </CardContent>
                </Card>
              )
            )}
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(0)}>
              <ChevronLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button onClick={() => setStep(2)}>
              Next: Catalyst Chain <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 3: CATALYST CHAIN + SCR CONFIG */}
      {/* ============================================================ */}
      {step === 2 && (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Aftertreatment Chain Configuration</CardTitle>
              <CardDescription>Toggle catalysts on/off. Chain processes exhaust left to right.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-4">
                <div className="rounded-lg border border-dashed bg-muted/50 px-4 py-3 text-sm font-medium">Engine</div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                {chain.map((element, i) => (
                  <div key={element.type} className="flex items-center gap-4">
                    <button
                      onClick={() => toggleCatalyst(i)}
                      className={`rounded-lg border-2 px-6 py-3 text-sm font-bold transition-all ${
                        element.enabled
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-muted bg-muted/30 text-muted-foreground line-through"
                      }`}
                    >
                      {element.type}
                    </button>
                    {i < chain.length - 1 && <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                  </div>
                ))}
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                <div className="rounded-lg border border-dashed bg-muted/50 px-4 py-3 text-sm font-medium">Tailpipe</div>
              </div>
            </CardContent>
          </Card>

          {chain.some((c) => c.enabled && c.type === "SCR") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Droplets className="h-5 w-5" /> SCR System Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>SCR Catalyst Type</Label>
                  <Select
                    value={scrConfig.catalystType}
                    onValueChange={(v) => setScrConfig((p) => ({ ...p, catalystType: v as SCRConfig["catalystType"] }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cu-CHA">Cu-SSZ-13 (CHA) — Best hydrothermal stability</SelectItem>
                      <SelectItem value="Cu-BEA">Cu-Beta (BEA) — Good low-T performance</SelectItem>
                      <SelectItem value="Fe-ZSM5">Fe-ZSM-5 (MFI) — Best high-T performance</SelectItem>
                      <SelectItem value="V2O5-WO3/TiO2">V₂O₅-WO₃/TiO₂ — Low cost, SO₂ tolerant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <NumField label="Target DeNOₓ" value={scrConfig.targetDeNOx * 100} unit="%" onChange={(v) => setScrConfig((p) => ({ ...p, targetDeNOx: v / 100 }))} />
                <NumField label="Max NH₃ Slip" value={scrConfig.maxNH3Slip_ppm} unit="ppm" onChange={(v) => setScrConfig((p) => ({ ...p, maxNH3Slip_ppm: v }))} />
                <NumField label="Mixer Length" value={scrConfig.mixerLength_mm} unit="mm" onChange={(v) => setScrConfig((p) => ({ ...p, mixerLength_mm: v }))} />
                <NumField label="Pipe Diameter" value={scrConfig.pipeDiameter_mm} unit="mm" onChange={(v) => setScrConfig((p) => ({ ...p, pipeDiameter_mm: v }))} />
              </CardContent>
            </Card>
          )}

          {engineInputs.engineType === "natural_gas" && (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardContent className="flex items-center gap-3 pt-6">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <p className="text-sm">
                  For stoichiometric natural gas engines, consider using TWC instead of DOC+SCR.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setChain([
                      { type: "TWC", enabled: true },
                      { type: "DOC", enabled: false },
                      { type: "DPF", enabled: false },
                      { type: "SCR", enabled: false },
                    ])
                  }
                >
                  Switch to TWC
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button onClick={() => setStep(3)}>
              Next: Aging & Durability <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 4: AGING & DURABILITY */}
      {/* ============================================================ */}
      {step === 3 && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-5 w-5" /> Target Life & Thermal Exposure
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <NumField label="Target Life" value={aging.targetLife_hours} unit="hours" onChange={(v) => setAging((p) => ({ ...p, targetLife_hours: v }))} />
                <NumField label="Max Operating T" value={aging.maxOperatingTemp_C} unit="°C" onChange={(v) => setAging((p) => ({ ...p, maxOperatingTemp_C: v }))} />
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <Info className="h-4 w-4" /> Thermal Aging
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    PGM sintering accelerates exponentially above 700°C. Max temp directly controls
                    catalyst durability and end-of-life conversion.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Beaker className="h-5 w-5" /> Poison & Contaminant Exposure
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <NumField label="Fuel Sulfur" value={aging.fuelSulfur_ppm} unit="ppm" onChange={(v) => setAging((p) => ({ ...p, fuelSulfur_ppm: v }))} />
                <NumField label="Oil Consumption" value={aging.oilConsumption_g_kWh} unit="g/kWh" onChange={(v) => setAging((p) => ({ ...p, oilConsumption_g_kWh: v }))} />
                <NumField label="Oil Phosphorus" value={aging.oilPhosphorus_ppm} unit="ppm" onChange={(v) => setAging((p) => ({ ...p, oilPhosphorus_ppm: v }))} />
                <NumField label="Oil Ash Content" value={aging.oilAsh_percent} unit="%" onChange={(v) => setAging((p) => ({ ...p, oilAsh_percent: v }))} />
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4" /> Sulfur & Phosphorus
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    S poisons PGM and Cu-zeolite sites (reversible above 550–650°C).
                    P from ZDDP oil additive forms irreversible glassy deposits on washcoat.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ChevronLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button onClick={calculate} disabled={calculating}>
              {calculating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="mr-2 h-4 w-4" />
              )}
              Generate Full RFQ Analysis
            </Button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 5: RESULTS & RFQ */}
      {/* ============================================================ */}
      {step === 4 && rfq && baseResult && (
        <div className="flex flex-col gap-6">
          {/* Warnings */}
          {rfq.warnings.length > 0 && (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardContent className="pt-6">
                <div className="flex flex-col gap-2">
                  {rfq.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <p className="text-sm">{w}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* RFQ Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {rfq.projectInfo.rfqNumber}
                  </CardTitle>
                  <CardDescription>
                    {rfq.projectInfo.engineModel} — {rfq.projectInfo.application.replace(/_/g, " ")} — {rfq.projectInfo.emissionStandard.replace(/_/g, " ").toUpperCase()}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-base">
                  {rfq.aftertreatmentSystem.architecture}
                </Badge>
              </div>
            </CardHeader>
          </Card>

          {/* System summary */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Total ΔP", `${rfq.aftertreatmentSystem.totalPressureDrop_kPa.toFixed(2)} kPa`],
              ["Total Weight", `${rfq.aftertreatmentSystem.totalSystemWeight_kg.toFixed(1)} kg`],
              ["Total Length", `${rfq.aftertreatmentSystem.totalSystemLength_mm} mm`],
              ["Exhaust Flow", `${baseResult.exhaustFlowRate_Nm3_h.toFixed(0)} Nm³/h`],
              ["Est. Cost", `$${rfq.costEstimate.totalPerUnit_USD.toFixed(0)}`],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardHeader className="pb-2"><CardDescription>{label}</CardDescription></CardHeader>
                <CardContent><p className="text-2xl font-bold">{value}</p></CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="sizing">
            <TabsList className="flex-wrap">
              <TabsTrigger value="sizing">Catalyst Sizing</TabsTrigger>
              <TabsTrigger value="washcoat">Washcoat & Kinetics</TabsTrigger>
              <TabsTrigger value="aging">Aging & Durability</TabsTrigger>
              {rfq.dpfAssessment && <TabsTrigger value="dpf">DPF Regen</TabsTrigger>}
              {rfq.scrSystem && <TabsTrigger value="scr">SCR / DEF</TabsTrigger>}
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="cost">Cost & PGM</TabsTrigger>
              <TabsTrigger value="pressure">Pressure Drop</TabsTrigger>
            </TabsList>

            {/* ---- CATALYST SIZING TAB ---- */}
            <TabsContent value="sizing" className="mt-4">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Substrate</TableHead>
                      <TableHead>Volume [L]</TableHead>
                      <TableHead>Ø × L [mm]</TableHead>
                      <TableHead>Cell / Wall</TableHead>
                      <TableHead>GHSV [h⁻¹]</TableHead>
                      <TableHead>ΔP [kPa]</TableHead>
                      <TableHead>PGM [g/ft³]</TableHead>
                      <TableHead>Weight [kg]</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rfq.aftertreatmentSystem.catalysts.map((cat) => (
                      <TableRow key={cat.position}>
                        <TableCell className="font-mono">{cat.position}</TableCell>
                        <TableCell><Badge>{cat.type}</Badge></TableCell>
                        <TableCell className="text-sm">
                          {cat.substrate.supplier} {cat.substrate.material}
                        </TableCell>
                        <TableCell className="font-mono">{cat.substrate.volume_L.toFixed(1)}</TableCell>
                        <TableCell className="font-mono">
                          {cat.substrate.diameter_mm} × {cat.substrate.length_mm}
                        </TableCell>
                        <TableCell className="font-mono">
                          {cat.substrate.cellDensity_cpsi}/{cat.substrate.wallThickness_mil}
                        </TableCell>
                        <TableCell className="font-mono">{cat.GHSV_design_h.toLocaleString()}</TableCell>
                        <TableCell className="font-mono">{cat.pressureDrop_kPa_clean.toFixed(2)}</TableCell>
                        <TableCell className="font-mono">
                          {cat.pgm ? cat.pgm.totalLoading_g_ft3.toFixed(0) : "—"}
                        </TableCell>
                        <TableCell className="font-mono">{cat.totalWeight_kg.toFixed(1)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ---- WASHCOAT & KINETICS TAB ---- */}
            <TabsContent value="washcoat" className="mt-4">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Washcoat Analysis per Catalyst</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Catalyst</TableHead>
                            <TableHead>Thickness [µm]</TableHead>
                            <TableHead>Thiele (φ)</TableHead>
                            <TableHead>η (overall)</TableHead>
                            <TableHead>Regime</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rfq.aftertreatmentSystem.catalysts.map((cat) => (
                            <TableRow key={cat.position}>
                              <TableCell><Badge variant="outline">{cat.type}</Badge></TableCell>
                              <TableCell className="font-mono">{cat.washcoat.thickness_um}</TableCell>
                              <TableCell className="font-mono">{cat.washcoatAnalysis.thieleModulus.toFixed(2)}</TableCell>
                              <TableCell className="font-mono">{cat.washcoatAnalysis.effectivenessFactor.toFixed(3)}</TableCell>
                              <TableCell>
                                <Badge variant={
                                  cat.washcoatAnalysis.regime === "kinetic" ? "default" :
                                  cat.washcoatAnalysis.regime === "transitional" ? "secondary" : "destructive"
                                }>
                                  {cat.washcoatAnalysis.regime.replace("_", " ")}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="mt-4 rounded-lg bg-muted/50 p-3 text-sm">
                      <p className="font-medium">Interpretation</p>
                      <p className="mt-1 text-muted-foreground">
                        <strong>Kinetic</strong> (φ &lt; 0.3): Full washcoat utilized. Adding more washcoat improves performance.
                        <br /><strong>Transitional</strong> (0.3 &lt; φ &lt; 3): Partial diffusion limitation. Optimal thickness range.
                        <br /><strong>Diffusion-limited</strong> (φ &gt; 3): Only outer shell active. Thinner washcoat or higher cell density recommended.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Effectiveness Factor vs. Washcoat Thickness</CardTitle>
                    <CardDescription>DOC at {engineInputs.exhaustTemp_C}°C — shows onset of diffusion limitation</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={washcoatSweep.map((p) => ({ thickness: p.thickness_um, eta: p.eta, phi: p.phi }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="thickness" label={{ value: "Washcoat Thickness [µm]", position: "insideBottom", offset: -5 }} />
                        <YAxis domain={[0, 1]} label={{ value: "η", angle: -90, position: "insideLeft" }} />
                        <Tooltip formatter={(v: number) => v.toFixed(3)} />
                        <Line type="monotone" dataKey="eta" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Effectiveness Factor" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">Fresh vs. Aged Conversion</CardTitle>
                    <CardDescription>Kinetics-based conversion at operating temperature, before and after {aging.targetLife_hours.toLocaleString()} h aging</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Catalyst</TableHead>
                            <TableHead>Species</TableHead>
                            <TableHead>Fresh Conv. [%]</TableHead>
                            <TableHead>Aged Conv. [%]</TableHead>
                            <TableHead>Loss</TableHead>
                            <TableHead>Light-off Fresh [°C]</TableHead>
                            <TableHead>Light-off Aged [°C]</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rfq.aftertreatmentSystem.catalysts.map((cat) =>
                            Object.entries(cat.freshConversion_percent).map(([species, freshVal], si) => (
                              <TableRow key={`${cat.position}-${species}`}>
                                {si === 0 && (
                                  <TableCell rowSpan={Object.keys(cat.freshConversion_percent).length}>
                                    <Badge>{cat.type}</Badge>
                                  </TableCell>
                                )}
                                <TableCell className="font-medium">{species}</TableCell>
                                <TableCell className="font-mono">{freshVal.toFixed(1)}%</TableCell>
                                <TableCell className="font-mono">{(cat.agedConversion_percent[species] ?? 0).toFixed(1)}%</TableCell>
                                <TableCell className="font-mono text-destructive">
                                  -{(freshVal - (cat.agedConversion_percent[species] ?? 0)).toFixed(1)}%
                                </TableCell>
                                {si === 0 && (
                                  <>
                                    <TableCell rowSpan={Object.keys(cat.freshConversion_percent).length} className="font-mono">
                                      {cat.lightOffTemp_C_fresh}
                                    </TableCell>
                                    <TableCell rowSpan={Object.keys(cat.freshConversion_percent).length} className="font-mono">
                                      {cat.lightOffTemp_C_aged.toFixed(0)}
                                    </TableCell>
                                  </>
                                )}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ---- AGING & DURABILITY TAB ---- */}
            <TabsContent value="aging" className="mt-4">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-5 w-5" /> Deactivation Breakdown
                    </CardTitle>
                    <CardDescription>
                      Activity factors after {aging.targetLife_hours.toLocaleString()} hours
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3">
                      {[
                        ["Sulfur Poisoning", rfq.aging.results.sulfurActivity, "Reversible above desulfation temperature"],
                        ["Phosphorus Fouling", rfq.aging.results.phosphorusActivity, "Irreversible — from lube oil ZDDP"],
                        ["Thermal Sintering", rfq.aging.results.thermalActivity, "PGM particle growth at high temperature"],
                        ["Chemical Aging", rfq.aging.results.chemicalActivity, "Zeolite dealumination (SCR only)"],
                      ].map(([name, activity, desc]) => (
                        <div key={name as string} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{name as string}</span>
                            <span className={`font-mono font-bold ${(activity as number) < 0.7 ? "text-destructive" : (activity as number) < 0.85 ? "text-amber-500" : "text-green-500"}`}>
                              {((activity as number) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${(activity as number) < 0.7 ? "bg-destructive" : (activity as number) < 0.85 ? "bg-amber-500" : "bg-green-500"}`}
                              style={{ width: `${(activity as number) * 100}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{desc as string}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">Overall Activity</span>
                        <span className="text-2xl font-bold font-mono">
                          {(rfq.aging.results.overallActivity * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                        <span>End-of-life estimate: {rfq.aging.results.endOfLife_hours.toFixed(0)} h</span>
                        <span>Warranty margin: {rfq.aging.results.warrantyMargin_percent.toFixed(0)}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Aging Protocol (OEM Bench Aging)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableBody>
                          {[
                            ["Protocol", rfq.aging.protocol.protocol],
                            ["Temperature", `${rfq.aging.protocol.temperature_C}°C`],
                            ["Duration", `${rfq.aging.protocol.duration_hours.toLocaleString()} h`],
                            ["Equivalent Miles", rfq.aging.protocol.equivalentMiles.toLocaleString()],
                            ["Fuel Sulfur", `${rfq.aging.protocol.fuelSulfur_ppm} ppm`],
                            ["Oil Ash", `${rfq.aging.protocol.oilAsh_percent}%`],
                            ["Aged Target", `≥${rfq.aging.protocol.agedConversionTarget_percent}% conversion`],
                          ].map(([label, value]) => (
                            <TableRow key={label}>
                              <TableCell className="font-medium w-40">{label}</TableCell>
                              <TableCell className="font-mono">{value}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="mt-4">
                      <h4 className="font-medium text-sm mb-2">Warranty Terms</h4>
                      <div className="rounded-md border">
                        <Table>
                          <TableBody>
                            {[
                              ["Warranty Period", `${rfq.warranty.warrantyPeriod_years} years / ${rfq.warranty.warrantyMiles.toLocaleString()} miles / ${rfq.warranty.warrantyHours.toLocaleString()} h`],
                              ["Full Useful Life", `${rfq.warranty.fullUsefulLife_years} years / ${rfq.warranty.fullUsefulLife_miles.toLocaleString()} miles`],
                              ["Defect Warranty", `${rfq.warranty.defectWarranty_years} years`],
                              ["Performance Warranty", `${rfq.warranty.performanceWarranty_years} years`],
                            ].map(([label, value]) => (
                              <TableRow key={label}>
                                <TableCell className="font-medium w-40">{label}</TableCell>
                                <TableCell className="font-mono text-sm">{value}</TableCell>
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

            {/* ---- DPF REGEN TAB ---- */}
            {rfq.dpfAssessment && (
              <TabsContent value="dpf" className="mt-4">
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Flame className="h-5 w-5" /> DPF Soot & Regeneration
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3">
                        {[
                          ["Filtration Efficiency", `${rfq.dpfAssessment.filtrationEfficiency_percent.toFixed(1)}%`],
                          ["Soot Loading", `${rfq.dpfAssessment.sootLoading_g_L.toFixed(1)} g/L`],
                          ["Soot Backpressure", `${rfq.dpfAssessment.backpressure_kPa.toFixed(2)} kPa`],
                          ["Passive Regen Rate", `${rfq.dpfAssessment.passiveRegenRate_g_h.toFixed(2)} g/h`],
                          ["Balance Point", `${rfq.dpfAssessment.passiveRegenBalancePoint_C}°C`],
                        ].map(([label, value]) => (
                          <div key={label} className="flex items-center justify-between rounded-lg border p-3">
                            <span className="text-sm">{label}</span>
                            <span className="font-mono font-medium">{value}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Active Regeneration Assessment</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3">
                        {[
                          ["Peak Regen Temp", `${rfq.dpfAssessment.activeRegenPeakTemp_C.toFixed(0)}°C`, rfq.dpfAssessment.activeRegenPeakTemp_C > 1000 ? "destructive" : "default"],
                          ["Regen Duration", `${rfq.dpfAssessment.activeRegenDuration_min.toFixed(0)} min`, "default"],
                          ["Fuel Penalty", `${rfq.dpfAssessment.fuelPenalty_percent.toFixed(1)}%`, "default"],
                          ["Thermal Runaway", rfq.dpfAssessment.thermalRunawayRisk ? "RISK" : "Safe", rfq.dpfAssessment.thermalRunawayRisk ? "destructive" : "default"],
                        ].map(([label, value, variant]) => (
                          <div key={label as string} className="flex items-center justify-between rounded-lg border p-3">
                            <span className="text-sm">{label as string}</span>
                            <Badge variant={variant as "default" | "destructive"}>{value as string}</Badge>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4">
                        <h4 className="font-medium text-sm mb-2">Ash Accumulation</h4>
                        <div className="grid gap-2">
                          <div className="flex justify-between text-sm">
                            <span>Ash Loading</span>
                            <span className="font-mono">{rfq.dpfAssessment.ashLoading_g_L.toFixed(1)} g/L</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-amber-500"
                              style={{ width: `${100 - rfq.dpfAssessment.ashCapacityRemaining_percent}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Capacity remaining: {rfq.dpfAssessment.ashCapacityRemaining_percent.toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}

            {/* ---- SCR / DEF TAB ---- */}
            {rfq.scrSystem && (
              <TabsContent value="scr" className="mt-4">
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Droplets className="h-5 w-5" /> SCR Performance & DEF Consumption
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3">
                        {[
                          ["System DeNOₓ", `${rfq.scrSystem.systemDeNOx_percent.toFixed(1)}%`],
                          ["Optimal ANR", rfq.scrSystem.optimalANR.toFixed(3)],
                          ["NH₃ Slip", `${rfq.scrSystem.NH3_slip_ppm.toFixed(1)} ppm`],
                          ["DEF Rate", `${rfq.scrSystem.DEF_consumption_L_h.toFixed(2)} L/h`],
                          ["DEF / 100 km", `${rfq.scrSystem.DEF_consumption_L_100km.toFixed(2)} L`],
                          ["DEF % of Fuel", `${rfq.scrSystem.specificDEF_percent_fuel.toFixed(1)}%`],
                        ].map(([label, value]) => (
                          <div key={label} className="flex items-center justify-between rounded-lg border p-3">
                            <span className="text-sm">{label}</span>
                            <span className="font-mono font-medium">{value}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Urea Decomposition & Mixer</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3">
                        {[
                          ["Urea Decomposition", `${rfq.scrSystem.ureaDecomposition_percent.toFixed(1)}%`],
                          ["Deposit Risk", rfq.scrSystem.depositRisk],
                          ["NH₃ Storage", `${rfq.scrSystem.nh3Storage_g_L.toFixed(2)} g/L`],
                          ["Mixer Uniformity", `${(rfq.scrSystem.mixerUniformity * 100).toFixed(1)}%`],
                        ].map(([label, value]) => (
                          <div key={label} className="flex items-center justify-between rounded-lg border p-3">
                            <span className="text-sm">{label}</span>
                            <Badge variant={
                              value === "high" ? "destructive" : value === "moderate" ? "secondary" : "default"
                            }>
                              {value}
                            </Badge>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 rounded-lg bg-muted/50 p-3 text-sm">
                        <p className="font-medium">SCR Catalyst: {scrConfig.catalystType}</p>
                        <p className="mt-1 text-muted-foreground">
                          {scrConfig.catalystType === "Cu-CHA" && "Cu-SSZ-13 offers best hydrothermal stability up to 800°C and excellent low-T DeNOₓ."}
                          {scrConfig.catalystType === "Cu-BEA" && "Cu-Beta provides good low-temperature performance but lower hydrothermal stability than CHA."}
                          {scrConfig.catalystType === "Fe-ZSM5" && "Fe-ZSM-5 excels at high temperatures (>400°C) and has good N₂O selectivity."}
                          {scrConfig.catalystType === "V2O5-WO3/TiO2" && "Vanadia-based SCR is cost-effective and sulfur-tolerant but limited to <550°C."}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}

            {/* ---- COMPLIANCE TAB ---- */}
            <TabsContent value="compliance" className="mt-4">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Test Cycle Compliance — {standard.replace(/_/g, " ").toUpperCase()}
                    </CardTitle>
                    <CardDescription>Projected aged emissions on applicable test cycles</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cycle</TableHead>
                            <TableHead>NOₓ [g/kWh]</TableHead>
                            <TableHead>PM [g/kWh]</TableHead>
                            <TableHead>CO [g/kWh]</TableHead>
                            <TableHead>HC [g/kWh]</TableHead>
                            <TableHead>NH₃ [ppm]</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rfq.compliance.testCycles.map((tc) => (
                            <TableRow key={tc.cycle}>
                              <TableCell className="font-medium">{tc.cycle}</TableCell>
                              <TableCell className="font-mono">{tc.NOx_g_kWh.toFixed(3)}</TableCell>
                              <TableCell className="font-mono">{tc.PM_g_kWh.toFixed(4)}</TableCell>
                              <TableCell className="font-mono">{tc.CO_g_kWh.toFixed(3)}</TableCell>
                              <TableCell className="font-mono">{tc.HC_g_kWh.toFixed(3)}</TableCell>
                              <TableCell className="font-mono">{tc.NH3_ppm}</TableCell>
                              <TableCell>
                                {tc.compliant ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                                ) : (
                                  <XCircle className="h-5 w-5 text-red-500" />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Compliance Radar</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart
                        data={[
                          { pollutant: "NOₓ", actual: baseResult.compliance.tailpipeNOx_g_kWh, limit: EMISSION_STANDARDS[standard].NOx_g_kWh ?? 0 },
                          { pollutant: "PM", actual: baseResult.compliance.tailpipePM_g_kWh * 100, limit: (EMISSION_STANDARDS[standard].PM_g_kWh ?? 0) * 100 },
                          { pollutant: "CO", actual: baseResult.compliance.tailpipeCO_g_kWh, limit: EMISSION_STANDARDS[standard].CO_g_kWh ?? 0 },
                          { pollutant: "HC", actual: baseResult.compliance.tailpipeHC_g_kWh, limit: EMISSION_STANDARDS[standard].HC_g_kWh ?? 0 },
                        ]}
                      >
                        <PolarGrid />
                        <PolarAngleAxis dataKey="pollutant" />
                        <PolarRadiusAxis />
                        <Radar name="Limit" dataKey="limit" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.1} strokeDasharray="5 5" />
                        <Radar name="Actual" dataKey="actual" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ---- COST & PGM TAB ---- */}
            <TabsContent value="cost" className="mt-4">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="h-5 w-5" /> Cost Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Substrate", value: rfq.costEstimate.substrateCost_USD },
                            { name: "Washcoat", value: rfq.costEstimate.washcoatCost_USD },
                            { name: "PGM", value: rfq.costEstimate.pgmCost_USD },
                            { name: "Canning", value: rfq.costEstimate.canningCost_USD },
                            { name: "Assembly", value: rfq.costEstimate.assemblyCost_USD },
                          ]}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {[0, 1, 2, 3, 4].map((i) => (
                            <Cell key={i} fill={COLORS[i]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => `$${v.toFixed(0)}`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-2 text-center">
                      <p className="text-2xl font-bold">${rfq.costEstimate.totalPerUnit_USD.toFixed(0)}</p>
                      <p className="text-sm text-muted-foreground">Total per unit</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">PGM Price Sensitivity</CardTitle>
                    <CardDescription>Unit cost vs. PGM market price</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={rfq.costEstimate.pgmSensitivity}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="pgmPrice_USD_oz" label={{ value: "PGM Price [$/oz]", position: "insideBottom", offset: -5 }} />
                        <YAxis label={{ value: "Unit Cost [$]", angle: -90, position: "insideLeft" }} />
                        <Tooltip formatter={(v: number) => `$${v.toFixed(0)}`} />
                        <Bar dataKey="unitCost_USD" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Unit Cost" />
                      </BarChart>
                    </ResponsiveContainer>

                    {rfq.aftertreatmentSystem.catalysts.filter((c) => c.pgm).length > 0 && (
                      <div className="mt-4 rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Catalyst</TableHead>
                              <TableHead>Pt [g/ft³]</TableHead>
                              <TableHead>Pd [g/ft³]</TableHead>
                              <TableHead>Rh [g/ft³]</TableHead>
                              <TableHead>Pt:Pd</TableHead>
                              <TableHead>Cost</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rfq.aftertreatmentSystem.catalysts
                              .filter((c) => c.pgm)
                              .map((cat) => (
                                <TableRow key={cat.position}>
                                  <TableCell><Badge variant="outline">{cat.type}</Badge></TableCell>
                                  <TableCell className="font-mono">{cat.pgm!.Pt_g_ft3.toFixed(1)}</TableCell>
                                  <TableCell className="font-mono">{cat.pgm!.Pd_g_ft3.toFixed(1)}</TableCell>
                                  <TableCell className="font-mono">{cat.pgm!.Rh_g_ft3.toFixed(1)}</TableCell>
                                  <TableCell className="font-mono">{cat.pgm!.Pt_Pd_ratio}</TableCell>
                                  <TableCell className="font-mono">${cat.pgm!.estimatedCost_USD_per_unit.toFixed(0)}</TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ---- PRESSURE DROP TAB ---- */}
            <TabsContent value="pressure" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pressure Drop Waterfall (Clean vs. Aged)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart
                      data={rfq.aftertreatmentSystem.catalysts.map((c) => ({
                        name: c.type,
                        clean: parseFloat(c.pressureDrop_kPa_clean.toFixed(3)),
                        aged: parseFloat(c.pressureDrop_kPa_aged.toFixed(3)),
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis label={{ value: "ΔP [kPa]", angle: -90, position: "insideLeft" }} />
                      <Tooltip formatter={(v: number) => `${v} kPa`} />
                      <Legend />
                      <Bar dataKey="clean" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Clean" />
                      <Bar dataKey="aged" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Aged" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Recommendations */}
          {rfq.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Engineering Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {rfq.recommendations.map((r, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Activity className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <p className="text-sm">{r}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(3)}>
              <ChevronLeft className="mr-2 h-4 w-4" /> Modify Aging
            </Button>
            <Button variant="outline" onClick={() => setStep(0)}>
              Start Over
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
