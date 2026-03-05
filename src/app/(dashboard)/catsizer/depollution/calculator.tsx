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
import { sizeDepollutionSystem, calculateExhaustFlow } from "@/lib/catsizer/depollution-engine";
import { generateRFQ, PGM_PRICES_USD_OZ, calculatePGMCost } from "@/lib/catsizer/rfq-generator";
import { type EmissionUnit, EMISSION_UNIT_LABELS, toPpm, fromPpm } from "@/lib/catsizer/emission-units";
import { calculateSystemCost, type SystemCostBreakdown } from "@/lib/catsizer/system-cost-calculator";
import { washcoatThicknessSweep, WASHCOAT_DOC_DEFAULT } from "@/lib/catsizer/washcoat";
import { filterCatalog, STANDARD_CELL_CONFIGS, type SubstrateCatalogEntry } from "@/lib/catsizer/substrate-catalog";
import { INJECTOR_PRESETS, assessSpraySystem, type InjectorSpec, type MixingPipeConfig, type SpraySystemResult } from "@/lib/catsizer/spray-model";
import { generateDosingMap, determineAlphaStrategy, type DosingMap } from "@/lib/catsizer/adblue-dosing";
import { PGM_FORMULATIONS, recommendTechnology, conversionTemperatureSweep, findLightOff, type PGMFormulation, type TechnologyRecommendation, type ConversionPoint } from "@/lib/catsizer/catalyst-technology";
import { CATALYST_PROFILES_DB, type DetailedCatalystProfile } from "@/lib/catsizer/catalyst-profiles";
import { calculateExhaustMolarFlows, sizeCatalystSystemFromTOF, generateConversionProfile, generateReactorProfile, type TOFSystemSizingResult, type ConversionProfilePoint, type ReactorPositionPoint } from "@/lib/catsizer/tof-sizing-engine";
import { getOEMAdvisorAdvice } from "@/lib/ai/catalyst-advisor";
import type { OEMAdvisorResponse } from "@/lib/ai/types";

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

const DEFAULT_PIPE: MixingPipeConfig = {
  pipeDiameter_mm: 150,
  pipeLength_mm: 600,
  injectorToSCR_mm: 500,
  hasStaticMixer: true,
  mixerType: "blade",
  mixerPosition_mm: 200,
  hasSwirlFlap: false,
  pipeAngle_deg: 0,
};

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
  const [injector, setInjector] = useState<InjectorSpec>(INJECTOR_PRESETS.bosch_denoxtronic_6_5);
  const [pipe, setPipe] = useState<MixingPipeConfig>(DEFAULT_PIPE);
  const [sprayResult, setSprayResult] = useState<SpraySystemResult | null>(null);
  const [dosingMap, setDosingMap] = useState<DosingMap | null>(null);
  const [catalogFilter, setCatalogFilter] = useState<{ type: string; vehicleClass: string }>({ type: "all", vehicleClass: "all" });
  const [techRecs, setTechRecs] = useState<TechnologyRecommendation[]>([]);
  const [conversionCurves, setConversionCurves] = useState<Record<string, ConversionPoint[]>>({});
  const [selectedFormulations, setSelectedFormulations] = useState<Record<string, string>>({});
  const [tofSizingResults, setTofSizingResults] = useState<TOFSystemSizingResult[]>([]);
  const [conversionProfiles, setConversionProfiles] = useState<Record<string, ConversionProfilePoint[]>>({});
  const [reactorProfiles, setReactorProfiles] = useState<Record<string, ReactorPositionPoint[]>>({});
  const [oemAiAdvice, setOemAiAdvice] = useState<OEMAdvisorResponse | null>(null);
  const [oemAiLoading, setOemAiLoading] = useState(false);
  const [oemAiError, setOemAiError] = useState<string | null>(null);
  const [emissionUnit, setEmissionUnit] = useState<EmissionUnit>("ppm");
  const [emissionValues, setEmissionValues] = useState<Record<string, number>>({
    CO: 400, HC: 80, NOx: 800, PM: 30,
  });
  const [vehicleSpeed, setVehicleSpeed] = useState(80);
  const [systemCost, setSystemCost] = useState<SystemCostBreakdown | null>(null);


  const { setValue } = useForm<EngineInputs>({ defaultValues: DEFAULT_ENGINE });

  const applyPreset = (index: number) => {
    const preset = ENGINE_PRESETS[index];
    const merged = { ...DEFAULT_ENGINE, ...preset.inputs } as EngineInputs;
    setEngineInputs(merged);
    setEmissionUnit("ppm");
    setEmissionValues({
      CO: merged.CO_ppm,
      HC: merged.HC_ppm,
      NOx: merged.NOx_ppm,
      PM: merged.PM_mg_Nm3,
    });
    for (const [key, val] of Object.entries(merged)) {
      setValue(key as keyof EngineInputs, val as never);
    }
    if (merged.engineType === "gasoline") {
      setChain([
        { type: "TWC", enabled: true },
        { type: "DPF", enabled: false },
      ]);
    } else {
      setChain(DEFAULT_CHAIN);
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

  const handleEmissionUnitChange = useCallback((newUnit: EmissionUnit) => {
    const flow = calculateExhaustFlow(engineInputs);
    const Q = flow.volumeFlow_Nm3_h;
    const P = engineInputs.ratedPower_kW;

    const newValues: Record<string, number> = {};
    for (const pollutant of ["CO", "HC", "NOx", "PM"] as const) {
      const currentPpm = toPpm(
        { value: emissionValues[pollutant], unit: emissionUnit },
        pollutant, P, Q, vehicleSpeed,
      );
      newValues[pollutant] = parseFloat(fromPpm(currentPpm, newUnit, pollutant, P, Q, vehicleSpeed).toFixed(4));
    }
    setEmissionValues(newValues);
    setEmissionUnit(newUnit);
  }, [engineInputs, emissionUnit, emissionValues, vehicleSpeed]);

  const calculate = useCallback(() => {
    setCalculating(true);

    // Sync emission values to ppm before calculating
    const flow = calculateExhaustFlow(engineInputs);
    const Q = flow.volumeFlow_Nm3_h;
    const P = engineInputs.ratedPower_kW;
    const co_ppm = toPpm({ value: emissionValues.CO, unit: emissionUnit }, "CO", P, Q, vehicleSpeed);
    const hc_ppm = toPpm({ value: emissionValues.HC, unit: emissionUnit }, "HC", P, Q, vehicleSpeed);
    const nox_ppm = toPpm({ value: emissionValues.NOx, unit: emissionUnit }, "NOx", P, Q, vehicleSpeed);
    const pm_mg = emissionUnit === "ppm" ? emissionValues.PM
      : toPpm({ value: emissionValues.PM, unit: emissionUnit }, "PM", P, Q, vehicleSpeed);

    const syncedInputs: EngineInputs = {
      ...engineInputs,
      CO_ppm: Math.round(co_ppm),
      HC_ppm: Math.round(hc_ppm),
      NOx_ppm: Math.round(nox_ppm),
      PM_mg_Nm3: Math.round(pm_mg * 10) / 10,
    };
    setEngineInputs(syncedInputs);

    setTimeout(() => {
      const base = sizeDepollutionSystem(syncedInputs, chain, standard);
      setBaseResult(base);

      const hasSCR = chain.some((c) => c.enabled && c.type === "SCR");
      const costBreakdown = calculateSystemCost(base.catalysts, hasSCR);
      setSystemCost(costBreakdown);
      const rfqResult = generateRFQ(syncedInputs, chain, standard, aging, scrConfig);
      setRfq(rfqResult);

      // Technology recommendations and conversion curves
      const recs: TechnologyRecommendation[] = [];
      const curves: Record<string, ConversionPoint[]> = {};
      const enabledChain = chain.filter((c) => c.enabled);

      for (const element of enabledChain) {
        const rec = recommendTechnology(element.type, syncedInputs, standard);
        recs.push(rec);

        const formId = selectedFormulations[element.type];
        const formulation = formId
          ? PGM_FORMULATIONS.find((f) => f.id === formId) ?? rec.recommended
          : rec.recommended;

        const sized = base.catalysts.find((c) => c.type === element.type);
        if (sized && (element.type === "DOC" || element.type === "TWC" || element.type === "SCR" || element.type === "ASC")) {
          const T_K = syncedInputs.exhaustTemp_C + 273.15;
          const rho = 101325 / (287 * T_K);
          const Q_m3_s = (syncedInputs.exhaustFlowRate_kg_h / 3600) / rho;
          const composition: Record<string, number> = {
            CO: syncedInputs.CO_ppm * 1e-6,
            HC: syncedInputs.HC_ppm * 1e-6,
            NO: syncedInputs.NOx_ppm * (1 - syncedInputs.NO2_fraction) * 1e-6,
            NO2: syncedInputs.NOx_ppm * syncedInputs.NO2_fraction * 1e-6,
            O2: syncedInputs.O2_percent * 0.01,
            H2O: syncedInputs.H2O_percent * 0.01,
            NH3: element.type === "SCR" || element.type === "ASC" ? syncedInputs.NOx_ppm * 1e-6 * 1.0 : 0,
          };

          const sweep = conversionTemperatureSweep(
            element.type, sized.selectedVolume_L, 2.8, Q_m3_s,
            composition, formulation, [100, 550], 30
          );
          curves[element.type] = sweep;
        }
      }

      setTechRecs(recs);
      setConversionCurves(curves);

      // TOF-based surface science sizing
      const tofResults: TOFSystemSizingResult[] = [];
      const cProfiles: Record<string, ConversionProfilePoint[]> = {};
      const rProfiles: Record<string, ReactorPositionPoint[]> = {};

      for (const element of enabledChain) {
        const catType = element.type;
        const profiles = CATALYST_PROFILES_DB.filter((p) => p.catalystType === catType);
        if (profiles.length > 0) {
          try {
            const tofResult = sizeCatalystSystemFromTOF(catType, syncedInputs, profiles[0].id);
            tofResults.push(tofResult);

            const sized = base.catalysts.find((c) => c.type === catType);
            if (sized) {
              const flows = calculateExhaustMolarFlows(syncedInputs);
              cProfiles[catType] = generateConversionProfile(
                profiles[0], sized.selectedVolume_L, flows, [100, 650], 50
              );
              rProfiles[catType] = generateReactorProfile(
                profiles[0], sized.length_mm, sized.diameter_mm, flows, syncedInputs.exhaustTemp_C, 30
              );
            }
          } catch { /* profile not available for this type */ }
        }
      }
      setTofSizingResults(tofResults);
      setConversionProfiles(cProfiles);
      setReactorProfiles(rProfiles);

      // Spray & dosing analysis (if SCR is in chain)
      if (chain.some((c) => c.enabled && c.type === "SCR")) {
        const spray = assessSpraySystem(injector, pipe, syncedInputs.exhaustTemp_C, syncedInputs.exhaustFlowRate_kg_h, 1.0);
        setSprayResult(spray);
        const dm = generateDosingMap(syncedInputs.NOx_ppm, syncedInputs.exhaustFlowRate_kg_h, 1.0);
        setDosingMap(dm);
      }

      setCalculating(false);
      setStep(4);
    }, 150);
  }, [engineInputs, chain, standard, aging, scrConfig, injector, pipe, selectedFormulations, emissionUnit, emissionValues, vehicleSpeed]);

  const washcoatSweep = useMemo(() => {
    const T_K = engineInputs.exhaustTemp_C + 273.15;
    return washcoatThicknessSweep(T_K, 101.325, 28, 100, WASHCOAT_DOC_DEFAULT);
  }, [engineInputs.exhaustTemp_C]);

  const handleOEMAIAdvisor = useCallback(async () => {
    if (!rfq || !baseResult) return;
    setOemAiLoading(true);
    setOemAiError(null);
    try {
      const catalysts = rfq.aftertreatmentSystem.catalysts.map((c) => ({
        type: c.type,
        position: c.position,
        volume_L: c.substrate.volume_L,
        diameter_mm: c.substrate.diameter_mm,
        length_mm: c.substrate.length_mm,
        cpsi: c.substrate.cellDensity_cpsi,
        pgm: c.pgm,
        washcoat: c.washcoat,
      }));
      const systemDesc = `Engine: ${engineInputs.displacement_L}L ${engineInputs.engineType}, ${engineInputs.ratedPower_kW} kW, ${engineInputs.exhaustTemp_C}°C exhaust.
Architecture: ${rfq.aftertreatmentSystem.architecture}
Emission standard: ${standard.replace(/_/g, " ").toUpperCase()}
Total pressure drop: ${rfq.aftertreatmentSystem.totalPressureDrop_kPa.toFixed(2)} kPa
Total weight: ${rfq.aftertreatmentSystem.totalSystemWeight_kg.toFixed(1)} kg
Catalysts: ${JSON.stringify(catalysts, null, 2)}
Cost estimate: $${rfq.costEstimate.totalPerUnit_USD.toFixed(0)} per unit${systemCost ? `, Quoted: €${systemCost.quotedPrice_eur.toFixed(0)}` : ""}
Aging: ${(rfq.aging.results.overallActivity * 100).toFixed(0)}% activity after ${aging.targetLife_hours}h`;

      const context = {
        engineInputs,
        standard,
        exhaustFlow_Nm3_h: baseResult.exhaustFlowRate_Nm3_h,
        catalysts,
        aging: rfq.aging,
        cost: rfq.costEstimate,
        systemCost: systemCost ?? null,
      };

      const advice = await getOEMAdvisorAdvice(systemDesc, context);
      setOemAiAdvice(advice);
    } catch (err) {
      setOemAiError(err instanceof Error ? err.message : "AI request failed");
    } finally {
      setOemAiLoading(false);
    }
  }, [rfq, baseResult, engineInputs, standard, aging, systemCost]);

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
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Light-Duty Gasoline (&lt; 2L)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ENGINE_PRESETS.map((p, i) => p.inputs.engineType === "gasoline" ? (
                      <Button key={i} variant="outline" size="sm" className="text-xs border-amber-300 hover:bg-amber-50" onClick={() => applyPreset(i)}>
                        {p.name}
                      </Button>
                    ) : null)}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Light-Duty Diesel (&lt; 2L)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ENGINE_PRESETS.map((p, i) => p.inputs.engineType === "diesel" && (p.inputs.displacement_L ?? 99) < 2.1 ? (
                      <Button key={i} variant="outline" size="sm" className="text-xs border-blue-300 hover:bg-blue-50" onClick={() => applyPreset(i)}>
                        {p.name}
                      </Button>
                    ) : null)}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Medium / Heavy-Duty & Genset</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ENGINE_PRESETS.map((p, i) => p.inputs.engineType === "diesel" && (p.inputs.displacement_L ?? 0) >= 2.1 ? (
                      <Button key={i} variant="outline" size="sm" className="text-xs" onClick={() => applyPreset(i)}>
                        {p.name}
                      </Button>
                    ) : null)}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Natural Gas / Biogas / Dual Fuel</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ENGINE_PRESETS.map((p, i) => p.inputs.engineType && !["diesel", "gasoline"].includes(p.inputs.engineType) ? (
                      <Button key={i} variant="outline" size="sm" className="text-xs border-green-300 hover:bg-green-50" onClick={() => applyPreset(i)}>
                        {p.name}
                      </Button>
                    ) : null)}
                  </div>
                </div>
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
                        <SelectItem value="gasoline">Gasoline</SelectItem>
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
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Pollutant Emissions</CardTitle>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground">Input Unit:</Label>
                    <Select value={emissionUnit} onValueChange={(v) => handleEmissionUnitChange(v as EmissionUnit)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(EMISSION_UNIT_LABELS) as [EmissionUnit, string][]).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <CardDescription>
                  Enter pollutant levels in {EMISSION_UNIT_LABELS[emissionUnit]}. Values are automatically converted for internal calculations.
                  {emissionUnit === "g_km" && " Assumes vehicle speed for conversion."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(["CO", "HC", "NOx", "PM"] as const).map((pollutant) => {
                    const labels: Record<string, string> = { CO: "CO", HC: "HC (C1 eq.)", NOx: "NOₓ", PM: "PM" };
                    const unitLabel = pollutant === "PM" && emissionUnit === "ppm" ? "mg/Nm³" : EMISSION_UNIT_LABELS[emissionUnit];
                    return (
                      <NumField
                        key={pollutant}
                        label={labels[pollutant]}
                        value={emissionValues[pollutant]}
                        unit={unitLabel}
                        onChange={(v) => setEmissionValues((prev) => ({ ...prev, [pollutant]: v }))}
                      />
                    );
                  })}
                  {emissionUnit === "g_km" && (
                    <NumField
                      label="Vehicle Speed"
                      value={vehicleSpeed}
                      unit="km/h"
                      onChange={setVehicleSpeed}
                    />
                  )}
                </div>
                {emissionUnit !== "ppm" && (
                  <div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Converted to internal units (ppm / mg/Nm³):</p>
                    <div className="flex gap-4 font-mono">
                      <span>CO: {engineInputs.CO_ppm} ppm</span>
                      <span>HC: {engineInputs.HC_ppm} ppm</span>
                      <span>NOₓ: {engineInputs.NOx_ppm} ppm</span>
                      <span>PM: {engineInputs.PM_mg_Nm3} mg/Nm³</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-base">Exhaust Gas Composition</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {([
                    ["NO2_fraction", "NO₂/NOₓ", "ratio"],
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

          {/* Per-Catalyst Technology Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Beaker className="h-5 w-5" /> Catalyst Technology & PGM Configuration
              </CardTitle>
              <CardDescription>Select washcoat chemistry, PGM formulation, and loading per catalyst element</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {chain.filter((c) => c.enabled).map((element) => {
                  const candidates = PGM_FORMULATIONS.filter((f) => f.catalystTypes.includes(element.type));
                  const selected = selectedFormulations[element.type] ?? candidates[0]?.id ?? "";
                  const formulation = candidates.find((f) => f.id === selected) ?? candidates[0];

                  return (
                    <div key={element.type} className="rounded-lg border p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Badge className={
                          element.type === "DOC" ? "bg-[#1A4F6E] text-white" :
                          element.type === "DPF" ? "bg-[#5C4028] text-white" :
                          element.type === "SCR" ? "bg-[#1A5E42] text-white" :
                          element.type === "ASC" ? "bg-[#4E356E] text-white" :
                          "bg-[#C44536] text-white"
                        }>{element.type}</Badge>
                        <span className="text-sm font-medium">{formulation?.name ?? "Select formulation"}</span>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <Label className="text-xs">Formulation</Label>
                          <Select
                            value={selected}
                            onValueChange={(v) => setSelectedFormulations((p) => ({ ...p, [element.type]: v }))}
                          >
                            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {candidates.map((f) => (
                                <SelectItem key={f.id} value={f.id} className="text-xs">
                                  {f.name} — {f.totalPGM_g_ft3} g/ft³
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {formulation && (
                          <>
                            <div className="text-xs space-y-1">
                              <Label className="text-xs">PGM Loading</Label>
                              <div className="grid grid-cols-3 gap-1">
                                <div className="rounded border px-2 py-1 text-center">
                                  <p className="text-muted-foreground text-[10px]">Pt</p>
                                  <p className="font-mono font-bold">{formulation.metals.Pt_g_ft3}</p>
                                </div>
                                <div className="rounded border px-2 py-1 text-center">
                                  <p className="text-muted-foreground text-[10px]">Pd</p>
                                  <p className="font-mono font-bold">{formulation.metals.Pd_g_ft3}</p>
                                </div>
                                <div className="rounded border px-2 py-1 text-center">
                                  <p className="text-muted-foreground text-[10px]">Rh</p>
                                  <p className="font-mono font-bold">{formulation.metals.Rh_g_ft3}</p>
                                </div>
                              </div>
                            </div>

                            <div className="text-xs">
                              <Label className="text-xs">Washcoat</Label>
                              <p className="text-muted-foreground">{formulation.washcoatComposition}</p>
                              <p className="font-mono mt-1">{formulation.washcoatLoading_g_L} g/L — {formulation.washcoatThickness_um} µm</p>
                            </div>

                            <div className="text-xs">
                              <Label className="text-xs">Light-Off (T₅₀)</Label>
                              <div className="flex gap-3 mt-1">
                                {formulation.lightOff_CO_C > 0 && <span>CO: <span className="font-mono">{formulation.lightOff_CO_C}°C</span></span>}
                                {formulation.lightOff_HC_C > 0 && <span>HC: <span className="font-mono">{formulation.lightOff_HC_C}°C</span></span>}
                                {formulation.lightOff_NO_C > 0 && <span>NOₓ: <span className="font-mono">{formulation.lightOff_NO_C}°C</span></span>}
                              </div>
                              <div className="flex gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px]">S-tol: {formulation.sulfurTolerance}</Badge>
                                <Badge variant="outline" className="text-[10px]">Durability: {formulation.thermalDurability}</Badge>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      {formulation && (
                        <p className="text-xs text-muted-foreground mt-2 italic">{formulation.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Spray / Injector Configuration */}
          {chain.some((c) => c.enabled && c.type === "SCR") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Thermometer className="h-5 w-5" /> Spray Injector & Mixing Pipe
                </CardTitle>
                <CardDescription>Configure the DEF injector and mixing section geometry for NH₃ uniformity analysis</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Injector Preset</Label>
                  <Select
                    value={Object.entries(INJECTOR_PRESETS).find(([, v]) => v.SMD_um === injector.SMD_um && v.type === injector.type)?.[0] ?? "bosch_denoxtronic_6_5"}
                    onValueChange={(v) => setInjector(INJECTOR_PRESETS[v])}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bosch_denoxtronic_6_5">Bosch Denoxtronic 6.5 (multi-hole, 70 µm SMD)</SelectItem>
                      <SelectItem value="continental_aquablue">Continental AquaBlue (air-assisted, 40 µm SMD)</SelectItem>
                      <SelectItem value="grundfos_nxs">Grundfos NXS (pressure-swirl, 55 µm SMD)</SelectItem>
                      <SelectItem value="generic_single_hole">Generic Single-Hole (90 µm SMD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <NumField label="Spray Angle" value={injector.sprayAngle_deg} unit="°" onChange={(v) => setInjector((p) => ({ ...p, sprayAngle_deg: v }))} />
                <NumField label="Inj. Pressure" value={injector.injectionPressure_bar} unit="bar" onChange={(v) => setInjector((p) => ({ ...p, injectionPressure_bar: v }))} />
                <NumField label="Droplet SMD" value={injector.SMD_um} unit="µm" onChange={(v) => setInjector((p) => ({ ...p, SMD_um: v }))} />
                <NumField label="Inj → SCR dist." value={pipe.injectorToSCR_mm} unit="mm" onChange={(v) => setPipe((p) => ({ ...p, injectorToSCR_mm: v }))} />
                <NumField label="Pipe Diameter" value={pipe.pipeDiameter_mm} unit="mm" onChange={(v) => setPipe((p) => ({ ...p, pipeDiameter_mm: v }))} />
                <div>
                  <Label>Mixer Type</Label>
                  <Select value={pipe.mixerType ?? "blade"} onValueChange={(v) => setPipe((p) => ({ ...p, hasStaticMixer: v !== "none", mixerType: v as MixingPipeConfig["mixerType"] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blade">Blade Mixer</SelectItem>
                      <SelectItem value="swirl">Swirl Mixer</SelectItem>
                      <SelectItem value="tab">Tab Mixer</SelectItem>
                      <SelectItem value="none">No Mixer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <NumField label="Mount Angle" value={injector.mountAngle_deg} unit="°" onChange={(v) => setInjector((p) => ({ ...p, mountAngle_deg: v }))} />
              </CardContent>
            </Card>
          )}

          {/* Substrate Catalog Browser */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Commercial Substrate Catalog</CardTitle>
              <CardDescription>Browse available substrates from Corning, NGK, Ibiden, Continental</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 mb-4">
                <Select value={catalogFilter.type} onValueChange={(v) => setCatalogFilter((p) => ({ ...p, type: v }))}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="All types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="DOC">DOC</SelectItem>
                    <SelectItem value="DPF">DPF</SelectItem>
                    <SelectItem value="SCR">SCR</SelectItem>
                    <SelectItem value="TWC">TWC</SelectItem>
                    <SelectItem value="ASC">ASC</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={catalogFilter.vehicleClass} onValueChange={(v) => setCatalogFilter((p) => ({ ...p, vehicleClass: v }))}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="All classes" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    <SelectItem value="light_duty">Light-Duty</SelectItem>
                    <SelectItem value="medium_duty">Medium-Duty</SelectItem>
                    <SelectItem value="heavy_duty">Heavy-Duty</SelectItem>
                    <SelectItem value="genset">Genset</SelectItem>
                    <SelectItem value="marine">Marine</SelectItem>
                    <SelectItem value="off_highway">Off-Highway</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-md border max-h-72 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Ø × L [mm]</TableHead>
                      <TableHead>Cell/Wall</TableHead>
                      <TableHead>Vol [L]</TableHead>
                      <TableHead>OFA [%]</TableHead>
                      <TableHead>GSA [m²/L]</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterCatalog(
                      catalogFilter.type && catalogFilter.type !== "all" ? catalogFilter.type : undefined,
                      catalogFilter.vehicleClass && catalogFilter.vehicleClass !== "all" ? catalogFilter.vehicleClass : undefined
                    ).slice(0, 15).map((s) => (
                      <TableRow key={s.id} className="text-xs">
                        <TableCell className="font-mono">{s.id}</TableCell>
                        <TableCell>{s.supplier}</TableCell>
                        <TableCell>{s.application.join("/")}</TableCell>
                        <TableCell>{s.material}</TableCell>
                        <TableCell className="font-mono">{s.diameter_mm} × {s.length_mm}</TableCell>
                        <TableCell className="font-mono">{s.cellDensity_cpsi}/{s.wallThickness_mil}</TableCell>
                        <TableCell className="font-mono">{s.volume_L.toFixed(1)}</TableCell>
                        <TableCell className="font-mono">{(s.OFA * 100).toFixed(1)}</TableCell>
                        <TableCell className="font-mono">{s.GSA_m2_L.toFixed(1)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

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
              ["Quoted Price", systemCost ? `€${systemCost.quotedPrice_eur.toFixed(0)}` : `$${rfq.costEstimate.totalPerUnit_USD.toFixed(0)}`],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardHeader className="pb-2"><CardDescription>{label}</CardDescription></CardHeader>
                <CardContent><p className="text-2xl font-bold">{value}</p></CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="overview">
            <TabsList className="flex-wrap">
              <TabsTrigger value="overview" className="font-bold">Solution Overview</TabsTrigger>
              <TabsTrigger value="sizing">Catalyst Sizing</TabsTrigger>
              <TabsTrigger value="washcoat">Washcoat & Kinetics</TabsTrigger>
              <TabsTrigger value="aging">Aging & Durability</TabsTrigger>
              {rfq.dpfAssessment && <TabsTrigger value="dpf">DPF Regen</TabsTrigger>}
              {rfq.scrSystem && <TabsTrigger value="scr">SCR / DEF</TabsTrigger>}
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="cost">Cost & PGM</TabsTrigger>
              <TabsTrigger value="pressure">Pressure Drop</TabsTrigger>
              {dosingMap && <TabsTrigger value="adblue">AdBlue Dosing</TabsTrigger>}
              {sprayResult && <TabsTrigger value="spray">Spray & NH₃</TabsTrigger>}
              <TabsTrigger value="layout">System Layout</TabsTrigger>
              <TabsTrigger value="lightoff">Light-Off Curves</TabsTrigger>
              {techRecs.length > 0 && <TabsTrigger value="technology">Technology</TabsTrigger>}
              {tofSizingResults.length > 0 && <TabsTrigger value="surface">Surface Science</TabsTrigger>}
              <TabsTrigger value="ai_advisor">AI Advisor</TabsTrigger>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            </TabsList>

            {/* ---- SOLUTION OVERVIEW TAB ---- */}
            <TabsContent value="overview" className="mt-4">
              <div className="flex flex-col gap-6">
                {/* Architecture Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Beaker className="h-5 w-5" />
                      Aftertreatment Solution — {rfq.aftertreatmentSystem.architecture}
                    </CardTitle>
                    <CardDescription>
                      {engineInputs.displacement_L}L {engineInputs.engineType} — {engineInputs.ratedPower_kW} kW — {rfq.projectInfo.emissionStandard.replace(/_/g, " ").toUpperCase()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg border bg-primary/5 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Catalysts</p>
                        <p className="text-2xl font-bold">{baseResult.catalysts.length}</p>
                        <p className="text-xs text-muted-foreground">{baseResult.catalysts.map((c) => c.type).join(" → ")}</p>
                      </div>
                      <div className="rounded-lg border bg-primary/5 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Total Volume</p>
                        <p className="text-2xl font-bold font-mono">{baseResult.catalysts.reduce((s, c) => s + c.selectedVolume_L, 0).toFixed(1)} L</p>
                        <p className="text-xs text-muted-foreground">{baseResult.catalysts.map((c) => `${c.type}: ${c.selectedVolume_L.toFixed(1)}L`).join(", ")}</p>
                      </div>
                      <div className="rounded-lg border bg-primary/5 p-3 text-center">
                        <p className="text-xs text-muted-foreground">System Weight</p>
                        <p className="text-2xl font-bold font-mono">{baseResult.totalWeight_kg.toFixed(1)} kg</p>
                        <p className="text-xs text-muted-foreground">Total length: {baseResult.totalLength_mm} mm</p>
                      </div>
                      <div className="rounded-lg border bg-primary/5 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Backpressure</p>
                        <p className="text-2xl font-bold font-mono">{baseResult.totalPressureDrop_kPa.toFixed(2)} kPa</p>
                        <p className="text-xs text-muted-foreground">{(baseResult.totalPressureDrop_kPa * 10.197).toFixed(0)} mmH₂O</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Catalyst Details Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Catalyst Brick Details</CardTitle>
                    <CardDescription>Volume calculated via GHSV from exhaust flow rate at STP</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>GHSV [h⁻¹]</TableHead>
                            <TableHead>Req. Vol [L]</TableHead>
                            <TableHead>Sel. Vol [L]</TableHead>
                            <TableHead>Ø [mm]</TableHead>
                            <TableHead>L [mm]</TableHead>
                            <TableHead>Bricks</TableHead>
                            <TableHead>Cell/Wall</TableHead>
                            <TableHead>Material</TableHead>
                            <TableHead>PGM [g/ft³]</TableHead>
                            <TableHead>ΔP [kPa]</TableHead>
                            <TableHead>Weight [kg]</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {baseResult.catalysts.map((cat, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono">{idx + 1}</TableCell>
                              <TableCell><Badge>{cat.type}</Badge></TableCell>
                              <TableCell className="font-mono">{cat.GHSV_design.toLocaleString()}</TableCell>
                              <TableCell className="font-mono">{cat.requiredVolume_L.toFixed(2)}</TableCell>
                              <TableCell className="font-mono font-bold">{cat.selectedVolume_L.toFixed(1)}</TableCell>
                              <TableCell className="font-mono">{cat.diameter_mm}</TableCell>
                              <TableCell className="font-mono">{cat.length_mm}</TableCell>
                              <TableCell className="font-mono">{cat.numberOfSubstrates}</TableCell>
                              <TableCell className="font-mono">{cat.cellDensity_cpsi}/{cat.wallThickness_mil}</TableCell>
                              <TableCell className="capitalize">{cat.material.replace(/_/g, " ")}</TableCell>
                              <TableCell className="font-mono">{cat.preciousMetalLoading_g_ft3 || "—"}</TableCell>
                              <TableCell className="font-mono">{cat.pressureDrop_kPa.toFixed(3)}</TableCell>
                              <TableCell className="font-mono">{cat.weight_kg.toFixed(1)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/30 font-semibold">
                            <TableCell colSpan={3}>TOTAL</TableCell>
                            <TableCell className="font-mono">{baseResult.catalysts.reduce((s, c) => s + c.requiredVolume_L, 0).toFixed(2)}</TableCell>
                            <TableCell className="font-mono">{baseResult.catalysts.reduce((s, c) => s + c.selectedVolume_L, 0).toFixed(1)}</TableCell>
                            <TableCell colSpan={6} />
                            <TableCell className="font-mono">{baseResult.totalPressureDrop_kPa.toFixed(3)}</TableCell>
                            <TableCell className="font-mono">{baseResult.totalWeight_kg.toFixed(1)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    <div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                      <p><strong>Volume Sizing:</strong> V = Q_STP / GHSV, where Q_STP = {baseResult.exhaustFlowRate_Nm3_h.toFixed(0)} Nm³/h ({baseResult.exhaustFlowRate_actual_m3_h.toFixed(0)} m³/h actual at {engineInputs.exhaustTemp_C}°C)</p>
                    </div>
                  </CardContent>
                </Card>

                {/* SVG System Diagram */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">System Design</CardTitle>
                    <CardDescription>Schematic cross-section of the aftertreatment system</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <svg viewBox="0 0 1000 280" className="w-full min-w-[700px]" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <linearGradient id="pipeGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#94a3b8" />
                            <stop offset="100%" stopColor="#cbd5e1" />
                          </linearGradient>
                          <linearGradient id="hotGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#f97316" stopOpacity="0.05" />
                          </linearGradient>
                          <pattern id="honeycomb" width="8" height="8" patternUnits="userSpaceOnUse">
                            <rect width="8" height="8" fill="#e2e8f0" />
                            <circle cx="4" cy="4" r="1.5" fill="#94a3b8" />
                          </pattern>
                        </defs>

                        {/* Background */}
                        <rect x="0" y="0" width="1000" height="280" fill="none" />

                        {/* Engine block */}
                        <rect x="10" y="80" width="80" height="100" rx="6" fill="#374151" stroke="#1f2937" strokeWidth="2" />
                        <text x="50" y="120" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">ENGINE</text>
                        <text x="50" y="135" textAnchor="middle" fill="#9ca3af" fontSize="8">{engineInputs.displacement_L}L</text>
                        <text x="50" y="148" textAnchor="middle" fill="#9ca3af" fontSize="8">{engineInputs.ratedPower_kW} kW</text>
                        <text x="50" y="165" textAnchor="middle" fill="#fbbf24" fontSize="9" fontWeight="bold">{engineInputs.exhaustTemp_C}°C</text>

                        {/* Exhaust pipe from engine */}
                        <rect x="90" y="118" width="30" height="24" fill="url(#pipeGrad)" rx="2" />
                        <line x1="90" y1="118" x2="120" y2="118" stroke="#64748b" strokeWidth="1.5" />
                        <line x1="90" y1="142" x2="120" y2="142" stroke="#64748b" strokeWidth="1.5" />

                        {/* Flow arrow */}
                        <polygon points="115,125 125,130 115,135" fill="#3b82f6" />

                        {/* Catalyst elements */}
                        {(() => {
                          let xPos = 130;
                          let currentTemp = engineInputs.exhaustTemp_C;
                          const elements: React.ReactNode[] = [];
                          const catColors: Record<string, string> = {
                            DOC: "#dc2626", DPF: "#7c3aed", SCR: "#059669", ASC: "#d97706", TWC: "#2563eb",
                          };

                          baseResult.catalysts.forEach((cat, idx) => {
                            const catWidth = Math.max(80, Math.min(140, cat.selectedVolume_L * 12));
                            const catHeight = Math.max(60, Math.min(120, cat.canDiameter_mm / 3));
                            const yCenter = 130;
                            const yTop = yCenter - catHeight / 2;
                            const color = catColors[cat.type] ?? "#6b7280";

                            // Inlet cone
                            elements.push(
                              <polygon
                                key={`cone-in-${idx}`}
                                points={`${xPos},${yCenter - 12} ${xPos + 15},${yTop} ${xPos + 15},${yTop + catHeight} ${xPos},${yCenter + 12}`}
                                fill="#d1d5db"
                                stroke="#9ca3af"
                                strokeWidth="1"
                              />
                            );
                            xPos += 15;

                            // Catalyst body
                            elements.push(
                              <g key={`cat-${idx}`}>
                                <rect x={xPos} y={yTop} width={catWidth} height={catHeight} rx="3" fill="url(#honeycomb)" stroke={color} strokeWidth="2.5" />
                                <rect x={xPos} y={yTop} width={catWidth} height={catHeight} rx="3" fill={color} fillOpacity="0.12" />
                                <text x={xPos + catWidth / 2} y={yTop + 16} textAnchor="middle" fill={color} fontSize="13" fontWeight="bold">{cat.type}</text>
                                <text x={xPos + catWidth / 2} y={yTop + 30} textAnchor="middle" fill="#374151" fontSize="8">{cat.diameter_mm}×{cat.length_mm} mm</text>
                                <text x={xPos + catWidth / 2} y={yTop + 42} textAnchor="middle" fill="#374151" fontSize="8">{cat.selectedVolume_L.toFixed(1)} L — {cat.cellDensity_cpsi}/{cat.wallThickness_mil}</text>
                                <text x={xPos + catWidth / 2} y={yTop + 54} textAnchor="middle" fill="#374151" fontSize="8">GHSV: {(cat.GHSV_design / 1000).toFixed(0)}k h⁻¹</text>
                                {cat.preciousMetalLoading_g_ft3 > 0 && (
                                  <text x={xPos + catWidth / 2} y={yTop + 66} textAnchor="middle" fill="#374151" fontSize="8">PGM: {cat.preciousMetalLoading_g_ft3} g/ft³</text>
                                )}
                                {cat.numberOfSubstrates > 1 && (
                                  <text x={xPos + catWidth / 2} y={yTop + catHeight - 6} textAnchor="middle" fill="#6b7280" fontSize="7">×{cat.numberOfSubstrates} bricks</text>
                                )}
                              </g>
                            );
                            xPos += catWidth;

                            // Outlet cone
                            elements.push(
                              <polygon
                                key={`cone-out-${idx}`}
                                points={`${xPos},${yTop} ${xPos + 15},${yCenter - 12} ${xPos + 15},${yCenter + 12} ${xPos},${yTop + catHeight}`}
                                fill="#d1d5db"
                                stroke="#9ca3af"
                                strokeWidth="1"
                              />
                            );
                            xPos += 15;

                            // Temperature label below
                            const tempDelta = cat.type === "DOC" ? 30 : cat.type === "DPF" ? -10 : cat.type === "SCR" ? -5 : 0;
                            currentTemp += tempDelta;
                            elements.push(
                              <text key={`temp-${idx}`} x={xPos - catWidth / 2 - 15} y={yTop + catHeight + 18} textAnchor="middle" fill="#f59e0b" fontSize="9" fontWeight="bold">{currentTemp}°C</text>
                            );
                            elements.push(
                              <text key={`dp-${idx}`} x={xPos - catWidth / 2 - 15} y={yTop + catHeight + 30} textAnchor="middle" fill="#6b7280" fontSize="7">ΔP: {cat.pressureDrop_kPa.toFixed(2)} kPa</text>
                            );

                            // DEF injector before SCR
                            if (cat.type === "SCR") {
                              elements.push(
                                <g key={`def-${idx}`}>
                                  <line x1={xPos - catWidth - 30} y1={yTop - 15} x2={xPos - catWidth - 30} y2={yTop + 5} stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 2" />
                                  <circle cx={xPos - catWidth - 30} cy={yTop - 18} r="6" fill="#3b82f6" />
                                  <text x={xPos - catWidth - 30} y={yTop - 15} textAnchor="middle" fill="white" fontSize="6" fontWeight="bold">DEF</text>
                                  <text x={xPos - catWidth - 30} y={yTop - 28} textAnchor="middle" fill="#3b82f6" fontSize="7">AdBlue</text>
                                </g>
                              );
                            }

                            // Connecting pipe
                            if (idx < baseResult.catalysts.length - 1) {
                              elements.push(
                                <g key={`pipe-${idx}`}>
                                  <rect x={xPos} y={yCenter - 12} width="20" height="24" fill="url(#pipeGrad)" rx="2" />
                                  <polygon points={`${xPos + 14},${yCenter - 4} ${xPos + 20},${yCenter} ${xPos + 14},${yCenter + 4}`} fill="#3b82f6" />
                                </g>
                              );
                              xPos += 20;
                            }
                          });

                          // Tailpipe
                          elements.push(
                            <g key="tailpipe">
                              <rect x={xPos} y={118} width="30" height="24" fill="url(#pipeGrad)" rx="2" />
                              <polygon points={`${xPos + 24},125 ${xPos + 32},130 ${xPos + 24},135`} fill="#22c55e" />
                              <rect x={xPos + 30} y={100} width="60" height="60" rx="6" fill="#22c55e" fillOpacity="0.1" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="4 2" />
                              <text x={xPos + 60} y={120} textAnchor="middle" fill="#16a34a" fontSize="10" fontWeight="bold">TAILPIPE</text>
                              <text x={xPos + 60} y={134} textAnchor="middle" fill="#6b7280" fontSize="8">ΔP: {baseResult.totalPressureDrop_kPa.toFixed(2)} kPa</text>
                              <text x={xPos + 60} y={148} textAnchor="middle" fill="#6b7280" fontSize="8">{baseResult.totalWeight_kg.toFixed(1)} kg total</text>
                            </g>
                          );

                          return elements;
                        })()}

                        {/* Legend */}
                        <g transform="translate(10, 250)">
                          <text x="0" y="0" fill="#374151" fontSize="8" fontWeight="bold">Legend:</text>
                          {[["DOC", "#dc2626"], ["DPF", "#7c3aed"], ["SCR", "#059669"], ["ASC", "#d97706"], ["TWC", "#2563eb"]].map(([name, color], i) => (
                            <g key={name} transform={`translate(${55 + i * 65}, -4)`}>
                              <rect x="0" y="-6" width="10" height="10" rx="2" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1" />
                              <text x="14" y="2" fill="#374151" fontSize="8">{name}</text>
                            </g>
                          ))}
                        </g>
                      </svg>
                    </div>
                  </CardContent>
                </Card>

                {/* Integrator Cost Breakdown */}
                {systemCost && (
                  <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <DollarSign className="h-5 w-5" />
                          Integrator Cost Breakdown (EUR)
                        </CardTitle>
                        <CardDescription>Per-unit cost assuming BOSAL as system integrator</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="rounded-md border overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>#</TableHead>
                                <TableHead>Component</TableHead>
                                <TableHead className="text-right">Substrate</TableHead>
                                <TableHead className="text-right">Washcoat</TableHead>
                                <TableHead className="text-right">PGM</TableHead>
                                <TableHead className="text-right">Mat</TableHead>
                                <TableHead className="text-right">Shell</TableHead>
                                <TableHead className="text-right">Cones</TableHead>
                                <TableHead className="text-right">Welding</TableHead>
                                <TableHead className="text-right font-bold">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {systemCost.bricks.map((b) => (
                                <TableRow key={b.position}>
                                  <TableCell className="font-mono">{b.position}</TableCell>
                                  <TableCell><Badge>{b.type}</Badge></TableCell>
                                  <TableCell className="text-right font-mono">€{b.substrate_eur.toFixed(0)}</TableCell>
                                  <TableCell className="text-right font-mono">€{b.washcoat_eur.toFixed(0)}</TableCell>
                                  <TableCell className="text-right font-mono">€{b.pgm_eur.toFixed(0)}</TableCell>
                                  <TableCell className="text-right font-mono">€{b.mountingMat_eur.toFixed(0)}</TableCell>
                                  <TableCell className="text-right font-mono">€{b.shell_eur.toFixed(0)}</TableCell>
                                  <TableCell className="text-right font-mono">€{b.cones_eur.toFixed(0)}</TableCell>
                                  <TableCell className="text-right font-mono">€{b.welding_eur.toFixed(0)}</TableCell>
                                  <TableCell className="text-right font-mono font-bold">€{b.subtotal_eur.toFixed(0)}</TableCell>
                                </TableRow>
                              ))}
                              {systemCost.ureaSystem_eur > 0 && (
                                <TableRow>
                                  <TableCell />
                                  <TableCell><Badge variant="outline">Urea System</Badge></TableCell>
                                  <TableCell colSpan={7} className="text-right text-muted-foreground text-xs">Injector + pump + DCU + tank + sensors + mixer</TableCell>
                                  <TableCell className="text-right font-mono font-bold">€{systemCost.ureaSystem_eur.toFixed(0)}</TableCell>
                                </TableRow>
                              )}
                              <TableRow>
                                <TableCell />
                                <TableCell><Badge variant="outline">Piping & Connectors</Badge></TableCell>
                                <TableCell colSpan={7} />
                                <TableCell className="text-right font-mono">€{systemCost.pipingConnectors_eur.toFixed(0)}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell />
                                <TableCell><Badge variant="outline">Sensors</Badge></TableCell>
                                <TableCell colSpan={7} />
                                <TableCell className="text-right font-mono">€{systemCost.sensors_eur.toFixed(0)}</TableCell>
                              </TableRow>
                              <TableRow className="bg-muted/30 font-semibold border-t-2">
                                <TableCell colSpan={2}>Material Total</TableCell>
                                <TableCell className="text-right font-mono">€{systemCost.totalSubstrate_eur.toFixed(0)}</TableCell>
                                <TableCell className="text-right font-mono">€{systemCost.totalWashcoat_eur.toFixed(0)}</TableCell>
                                <TableCell className="text-right font-mono">€{systemCost.totalPGM_eur.toFixed(0)}</TableCell>
                                <TableCell colSpan={3} className="text-right font-mono">Canning: €{systemCost.totalCanning_eur.toFixed(0)}</TableCell>
                                <TableCell className="text-right font-mono">€{systemCost.totalWelding_eur.toFixed(0)}</TableCell>
                                <TableCell className="text-right font-mono font-bold text-primary">€{systemCost.materialTotal_eur.toFixed(0)}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>

                        {/* Manufacturing overhead */}
                        <div className="mt-4 space-y-2">
                          {[
                            ["Manufacturing", systemCost.manufacturing_eur],
                            ["Quality & Inspection", systemCost.qualityInspection_eur],
                            ["Packaging", systemCost.packaging_eur],
                            ["Logistics", systemCost.logistics_eur],
                            ["Overhead", systemCost.overhead_eur],
                            ["Warranty Reserve", systemCost.warrantyReserve_eur],
                          ].map(([label, value]) => (
                            <div key={label as string} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{label as string}</span>
                              <span className="font-mono">€{(value as number).toFixed(0)}</span>
                            </div>
                          ))}
                          <div className="border-t pt-2 flex items-center justify-between text-sm font-semibold">
                            <span>Cost Price</span>
                            <span className="font-mono">€{systemCost.costPrice_eur.toFixed(0)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Profit Margin</span>
                            <span className="font-mono">€{systemCost.profitMargin_eur.toFixed(0)}</span>
                          </div>
                          <div className="border-t-2 border-primary pt-2 flex items-center justify-between">
                            <span className="text-lg font-bold">Quoted Price</span>
                            <span className="text-2xl font-bold font-mono text-primary">€{systemCost.quotedPrice_eur.toFixed(0)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Cost Pie Chart + Welding/Canning Details */}
                    <div className="flex flex-col gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Cost Distribution</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                              <Pie
                                data={[
                                  { name: "Substrate", value: systemCost.totalSubstrate_eur },
                                  { name: "Washcoat", value: systemCost.totalWashcoat_eur },
                                  { name: "PGM", value: systemCost.totalPGM_eur },
                                  { name: "Canning", value: systemCost.totalCanning_eur },
                                  { name: "Welding", value: systemCost.totalWelding_eur },
                                  ...(systemCost.ureaSystem_eur > 0 ? [{ name: "Urea System", value: systemCost.ureaSystem_eur }] : []),
                                ]}
                                cx="50%"
                                cy="50%"
                                outerRadius={90}
                                innerRadius={40}
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              >
                                {["#3b82f6", "#8b5cf6", "#ef4444", "#f59e0b", "#10b981", "#06b6d4"].map((c, i) => (
                                  <Cell key={i} fill={c} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v: number) => `€${v.toFixed(0)}`} />
                            </PieChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Canning & Welding Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {systemCost.bricks.map((b) => (
                              <div key={b.position} className="rounded-lg border p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <Badge>{b.type}</Badge>
                                  <span className="text-xs text-muted-foreground">{b.shellMaterial}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                  <span className="text-muted-foreground">Shell weight:</span>
                                  <span className="font-mono text-right">{b.shellWeight_kg.toFixed(2)} kg</span>
                                  <span className="text-muted-foreground">Cone weight:</span>
                                  <span className="font-mono text-right">{b.coneWeight_kg.toFixed(2)} kg</span>
                                  <span className="text-muted-foreground">Mat area:</span>
                                  <span className="font-mono text-right">{b.matArea_m2.toFixed(3)} m²</span>
                                  <span className="text-muted-foreground">Weld length:</span>
                                  <span className="font-mono text-right">{b.weldLength_m.toFixed(2)} m</span>
                                  <span className="text-muted-foreground">Welding cost:</span>
                                  <span className="font-mono text-right font-semibold">€{b.welding_eur.toFixed(2)}</span>
                                  <span className="text-muted-foreground">Canning cost:</span>
                                  <span className="font-mono text-right font-semibold">€{(b.shell_eur + b.cones_eur + b.flanges_eur + b.mountingMat_eur + b.heatshield_eur).toFixed(2)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Compliance Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      {baseResult.compliance.NOx_compliant && baseResult.compliance.PM_compliant && baseResult.compliance.CO_compliant && baseResult.compliance.HC_compliant
                        ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                        : <XCircle className="h-5 w-5 text-destructive" />
                      }
                      Emission Compliance — {baseResult.compliance.standard.replace(/_/g, " ").toUpperCase()}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {([
                        ["NOₓ", baseResult.compliance.tailpipeNOx_g_kWh, EMISSION_STANDARDS[standard]?.NOx_g_kWh, baseResult.compliance.NOx_compliant],
                        ["PM", baseResult.compliance.tailpipePM_g_kWh, EMISSION_STANDARDS[standard]?.PM_g_kWh, baseResult.compliance.PM_compliant],
                        ["CO", baseResult.compliance.tailpipeCO_g_kWh, EMISSION_STANDARDS[standard]?.CO_g_kWh, baseResult.compliance.CO_compliant],
                        ["HC", baseResult.compliance.tailpipeHC_g_kWh, EMISSION_STANDARDS[standard]?.HC_g_kWh, baseResult.compliance.HC_compliant],
                      ] as const).map(([name, actual, limit, ok]) => (
                        <div key={name} className={`rounded-lg border p-3 ${ok ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{name}</span>
                            {ok ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                          </div>
                          <p className="font-mono text-lg font-bold mt-1">{(actual as number).toFixed(3)} g/kWh</p>
                          {limit != null && <p className="text-xs text-muted-foreground">Limit: {(limit as number)} g/kWh</p>}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

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

                    {/* Live PGM Market Prices */}
                    <div className="mt-4 rounded-lg border bg-gradient-to-r from-amber-500/5 to-amber-500/10 p-3">
                      <p className="text-xs font-semibold mb-2">PGM Market Prices (March 2026)</p>
                      <div className="flex gap-4 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="text-muted-foreground">Pt:</span>
                          <span className="font-mono font-bold">${PGM_PRICES_USD_OZ.Pt.toLocaleString()}/oz</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-muted-foreground">Pd:</span>
                          <span className="font-mono font-bold">${PGM_PRICES_USD_OZ.Pd.toLocaleString()}/oz</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          <span className="text-muted-foreground">Rh:</span>
                          <span className="font-mono font-bold">${PGM_PRICES_USD_OZ.Rh.toLocaleString()}/oz</span>
                        </div>
                      </div>
                    </div>

                    {rfq.aftertreatmentSystem.catalysts.filter((c) => c.pgm).length > 0 && (
                      <div className="mt-4 rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Catalyst</TableHead>
                              <TableHead>Pt [g/ft³]</TableHead>
                              <TableHead>Pd [g/ft³]</TableHead>
                              <TableHead>Rh [g/ft³]</TableHead>
                              <TableHead>Total [g/ft³]</TableHead>
                              <TableHead>PGM Mass [g]</TableHead>
                              <TableHead>Pt:Pd</TableHead>
                              <TableHead>PGM Cost</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rfq.aftertreatmentSystem.catalysts
                              .filter((c) => c.pgm)
                              .map((cat) => {
                                const vol_ft3 = cat.substrate.volume_L / 28.3168;
                                const ptMass = cat.pgm!.Pt_g_ft3 * vol_ft3;
                                const pdMass = cat.pgm!.Pd_g_ft3 * vol_ft3;
                                const rhMass = cat.pgm!.Rh_g_ft3 * vol_ft3;
                                const cost = calculatePGMCost(ptMass, pdMass, rhMass);
                                return (
                                  <TableRow key={cat.position}>
                                    <TableCell><Badge variant="outline">{cat.type}</Badge></TableCell>
                                    <TableCell className="font-mono">{cat.pgm!.Pt_g_ft3.toFixed(1)}</TableCell>
                                    <TableCell className="font-mono">{cat.pgm!.Pd_g_ft3.toFixed(1)}</TableCell>
                                    <TableCell className="font-mono">{cat.pgm!.Rh_g_ft3.toFixed(1)}</TableCell>
                                    <TableCell className="font-mono font-semibold">{cat.pgm!.totalLoading_g_ft3.toFixed(0)}</TableCell>
                                    <TableCell className="font-mono">{(ptMass + pdMass + rhMass).toFixed(2)}</TableCell>
                                    <TableCell className="font-mono">{cat.pgm!.Pt_Pd_ratio}</TableCell>
                                    <TableCell className="font-mono font-bold">${cost.total.toFixed(0)}</TableCell>
                                  </TableRow>
                                );
                              })}
                            <TableRow className="font-semibold bg-muted/30">
                              <TableCell colSpan={7}>Total PGM Cost</TableCell>
                              <TableCell className="font-mono font-bold">
                                ${rfq.aftertreatmentSystem.catalysts
                                  .filter((c) => c.pgm)
                                  .reduce((sum, cat) => {
                                    const vol_ft3 = cat.substrate.volume_L / 28.3168;
                                    const c = calculatePGMCost(
                                      cat.pgm!.Pt_g_ft3 * vol_ft3,
                                      cat.pgm!.Pd_g_ft3 * vol_ft3,
                                      cat.pgm!.Rh_g_ft3 * vol_ft3
                                    );
                                    return sum + c.total;
                                  }, 0).toFixed(0)}
                              </TableCell>
                            </TableRow>
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

            {/* ---- ADBLUE DOSING TAB ---- */}
            {dosingMap && (
              <TabsContent value="adblue" className="mt-4">
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Droplets className="h-5 w-5" /> DEF Dosing Rate vs. Temperature
                      </CardTitle>
                      <CardDescription>
                        AdBlue injection rate at {engineInputs.NOx_ppm} ppm NOₓ, {engineInputs.exhaustFlowRate_kg_h} kg/h exhaust flow
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={dosingMap.points.map((p) => ({
                          temp: p.temperature_C,
                          DEF: p.DEF_rate_mL_min,
                          DeNOx: p.expectedDeNOx_percent,
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="temp" label={{ value: "Exhaust Temp [°C]", position: "insideBottom", offset: -5 }} />
                          <YAxis yAxisId="left" label={{ value: "DEF [mL/min]", angle: -90, position: "insideLeft" }} />
                          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} label={{ value: "DeNOₓ [%]", angle: 90, position: "insideRight" }} />
                          <Tooltip />
                          <Legend />
                          <Line yAxisId="left" type="monotone" dataKey="DEF" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} name="DEF Rate [mL/min]" />
                          <Line yAxisId="right" type="monotone" dataKey="DeNOx" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} name="Expected DeNOₓ [%]" />
                        </LineChart>
                      </ResponsiveContainer>
                      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                        <div className="rounded-lg border p-2 text-center">
                          <p className="text-muted-foreground">Min Dosing Temp</p>
                          <p className="font-mono font-bold">{dosingMap.minDosingTemp_C}°C</p>
                        </div>
                        <div className="rounded-lg border p-2 text-center">
                          <p className="text-muted-foreground">Max Efficiency</p>
                          <p className="font-mono font-bold">{dosingMap.maxEfficiencyTemp_C}°C</p>
                        </div>
                        <div className="rounded-lg border p-2 text-center">
                          <p className="text-muted-foreground">DEF at Rated</p>
                          <p className="font-mono font-bold">{dosingMap.totalDEF_L_h_at_rated.toFixed(2)} L/h</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Alpha (ANR) Dosing Strategy</CardTitle>
                      <CardDescription>Temperature-dependent NH₃/NOₓ ratio map</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={(() => {
                          const pts = [];
                          for (let t = 150; t <= 550; t += 10) {
                            const s = determineAlphaStrategy(t, engineInputs.NOx_ppm);
                            pts.push({ temp: t, alpha: s.recommendedAlpha, mode: s.mode });
                          }
                          return pts;
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="temp" label={{ value: "Exhaust Temp [°C]", position: "insideBottom", offset: -5 }} />
                          <YAxis domain={[0, 1.2]} label={{ value: "Alpha (ANR)", angle: -90, position: "insideLeft" }} />
                          <Tooltip formatter={(v: number) => v.toFixed(3)} />
                          <Line type="monotone" dataKey="alpha" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Alpha" />
                        </LineChart>
                      </ResponsiveContainer>
                      <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm">
                        <p className="font-medium">Current Operating Point: {engineInputs.exhaustTemp_C}°C</p>
                        {(() => {
                          const s = determineAlphaStrategy(engineInputs.exhaustTemp_C, engineInputs.NOx_ppm);
                          return (
                            <div className="mt-1 text-muted-foreground">
                              <p>Mode: <Badge variant="outline">{s.mode}</Badge> — Alpha: <span className="font-mono">{s.recommendedAlpha.toFixed(3)}</span></p>
                              {s.inhibitReasons.length > 0 && (
                                <div className="mt-1 text-amber-600">{s.inhibitReasons.join("; ")}</div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}

            {/* ---- SPRAY & NH₃ UNIFORMITY TAB ---- */}
            {sprayResult && (
              <TabsContent value="spray" className="mt-4">
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Spray & Evaporation Assessment</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3">
                        {[
                          ["Spray Penetration", `${sprayResult.sprayPenetration_mm.toFixed(0)} mm`],
                          ["Evaporation Time", `${sprayResult.evaporation.evaporationTime_ms.toFixed(1)} ms`],
                          ["Evap. Distance", `${sprayResult.evaporation.evaporationDistance_mm.toFixed(0)} mm`],
                          ["Evap. Complete", sprayResult.evaporation.evaporationComplete ? "Yes" : `No (${sprayResult.evaporation.residualDropletSize_um.toFixed(0)} µm residual)`],
                          ["Residence Time", `${sprayResult.residenceTime_ms.toFixed(1)} ms`],
                          ["Wall Film Risk", sprayResult.wallFilmRisk],
                          ["Deposit Risk", sprayResult.depositFormationRisk],
                          ["Overall Rating", sprayResult.overallRating],
                        ].map(([label, value]) => (
                          <div key={label} className="flex items-center justify-between rounded-lg border p-3">
                            <span className="text-sm">{label}</span>
                            <Badge variant={
                              value === "high" || value === "poor" ? "destructive" :
                              value === "moderate" || value === "marginal" ? "secondary" : "default"
                            }>{value}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">NH₃ Uniformity at SCR Face</CardTitle>
                      <CardDescription>
                        UI = {(sprayResult.uniformity.uniformityIndex * 100).toFixed(1)}% — Injector → SCR: {pipe.injectorToSCR_mm} mm
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {/* Heatmap visualization */}
                      <div className="flex flex-col items-center gap-2">
                        <div
                          className="grid gap-px rounded-full overflow-hidden border-2 border-muted"
                          style={{
                            gridTemplateColumns: `repeat(${sprayResult.uniformity.concentrationMap.length}, 1fr)`,
                            width: 220,
                            height: 220,
                          }}
                        >
                          {sprayResult.uniformity.concentrationMap.flatMap((row, i) =>
                            row.map((v, j) => {
                              const r = Math.sqrt(
                                (i - row.length / 2) ** 2 + (j - row.length / 2) ** 2
                              );
                              const isInCircle = r < row.length / 2;
                              const intensity = Math.min(1, Math.max(0, v));
                              const hue = 200 - intensity * 160;
                              return (
                                <div
                                  key={`${i}-${j}`}
                                  style={{
                                    backgroundColor: isInCircle
                                      ? `hsl(${hue}, 80%, ${50 + (1 - intensity) * 30}%)`
                                      : "transparent",
                                  }}
                                />
                              );
                            })
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="h-3 w-3 rounded" style={{ backgroundColor: "hsl(200, 80%, 70%)" }} /> Low
                          <div className="h-3 w-3 rounded" style={{ backgroundColor: "hsl(120, 80%, 50%)" }} /> Medium
                          <div className="h-3 w-3 rounded" style={{ backgroundColor: "hsl(40, 80%, 50%)" }} /> High
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg border p-2 text-center">
                          <p className="text-muted-foreground">Peak/Mean</p>
                          <p className="font-mono font-bold">{sprayResult.uniformity.peakToMean.toFixed(2)}</p>
                        </div>
                        <div className="rounded-lg border p-2 text-center">
                          <p className="text-muted-foreground">Alpha Std Dev</p>
                          <p className="font-mono font-bold">{sprayResult.uniformity.alphaStdDev.toFixed(3)}</p>
                        </div>
                        <div className="rounded-lg border p-2 text-center">
                          <p className="text-muted-foreground">Min Local α</p>
                          <p className="font-mono font-bold">{sprayResult.uniformity.minLocalAlpha.toFixed(2)}</p>
                        </div>
                        <div className="rounded-lg border p-2 text-center">
                          <p className="text-muted-foreground">Max Local α</p>
                          <p className="font-mono font-bold">{sprayResult.uniformity.maxLocalAlpha.toFixed(2)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Urea Decomposition */}
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-base">Urea Decomposition Analysis</CardTitle>
                      <CardDescription>
                        (NH₂)₂CO → NH₃ + HNCO (thermolysis) → NH₃ + CO₂ (hydrolysis) at {engineInputs.exhaustTemp_C}°C
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="rounded-lg border p-3 text-center">
                          <p className="text-xs text-muted-foreground">Thermolysis</p>
                          <p className="text-2xl font-mono font-bold">{(sprayResult.ureaDecomposition.thermolysisFraction * 100).toFixed(0)}%</p>
                          <p className="text-[10px] text-muted-foreground">urea → HNCO + NH₃</p>
                        </div>
                        <div className="rounded-lg border p-3 text-center">
                          <p className="text-xs text-muted-foreground">Hydrolysis</p>
                          <p className="text-2xl font-mono font-bold">{(sprayResult.ureaDecomposition.hydrolysisFraction * 100).toFixed(0)}%</p>
                          <p className="text-[10px] text-muted-foreground">HNCO → NH₃ + CO₂</p>
                        </div>
                        <div className="rounded-lg border p-3 text-center">
                          <p className="text-xs text-muted-foreground">Overall Conversion</p>
                          <p className={`text-2xl font-mono font-bold ${sprayResult.ureaDecomposition.overallConversion > 0.9 ? "text-green-500" : sprayResult.ureaDecomposition.overallConversion > 0.7 ? "text-amber-500" : "text-red-500"}`}>
                            {(sprayResult.ureaDecomposition.overallConversion * 100).toFixed(0)}%
                          </p>
                          <p className="text-[10px] text-muted-foreground">urea → 2NH₃</p>
                        </div>
                        <div className="rounded-lg border p-3 text-center">
                          <p className="text-xs text-muted-foreground">Undecomposed</p>
                          <p className={`text-2xl font-mono font-bold ${sprayResult.ureaDecomposition.undecomposedUreaFraction < 0.05 ? "text-green-500" : "text-red-500"}`}>
                            {(sprayResult.ureaDecomposition.undecomposedUreaFraction * 100).toFixed(1)}%
                          </p>
                          <p className="text-[10px] text-muted-foreground">at SCR face</p>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-3">
                        <Badge variant={sprayResult.ureaDecomposition.depositRisk === "low" ? "default" : sprayResult.ureaDecomposition.depositRisk === "moderate" ? "secondary" : "destructive"}>
                          Deposit: {sprayResult.ureaDecomposition.depositRisk}
                        </Badge>
                        <Badge variant={sprayResult.ureaDecomposition.byproductRisk === "low" ? "default" : sprayResult.ureaDecomposition.byproductRisk === "moderate" ? "secondary" : "destructive"}>
                          Byproduct: {sprayResult.ureaDecomposition.byproductRisk}
                        </Badge>
                        <Badge variant="outline">
                          HNCO slip: {(sprayResult.ureaDecomposition.hncoSlipFraction * 100).toFixed(1)}%
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}

            {/* ---- SYSTEM LAYOUT TAB ---- */}
            <TabsContent value="layout" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Aftertreatment System Layout</CardTitle>
                  <CardDescription>Schematic view with dimensions, temperatures, and flow direction</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <div className="flex items-center gap-1 min-w-[700px] py-8">
                      {/* Engine */}
                      <div className="flex flex-col items-center">
                        <div className="rounded-lg border-2 border-dashed bg-muted/50 px-4 py-6 text-center">
                          <p className="text-xs font-bold">ENGINE</p>
                          <p className="text-xs text-muted-foreground">{engineInputs.displacement_L}L {engineInputs.engineType}</p>
                          <p className="text-xs text-muted-foreground">{engineInputs.ratedPower_kW} kW</p>
                        </div>
                        <p className="mt-1 text-xs font-mono text-amber-600">{engineInputs.exhaustTemp_C}°C</p>
                      </div>

                      {/* Flow arrow */}
                      <div className="flex items-center">
                        <div className="h-0.5 w-8 bg-muted-foreground" />
                        <ChevronRight className="h-4 w-4 -ml-1 text-muted-foreground" />
                      </div>

                      {/* Catalyst elements */}
                      {rfq.aftertreatmentSystem.catalysts.map((cat, idx) => {
                        const tempDrop = cat.type === "DOC" ? 30 : cat.type === "DPF" ? -10 : cat.type === "SCR" ? -5 : 0;
                        const cumTemp = engineInputs.exhaustTemp_C + rfq.aftertreatmentSystem.catalysts.slice(0, idx + 1).reduce((s, c) => {
                          return s + (c.type === "DOC" ? 30 : c.type === "DPF" ? -10 : c.type === "SCR" ? -5 : 0);
                        }, 0);
                        const widthScale = Math.max(60, Math.min(120, cat.substrate.diameter_mm / 3));
                        const heightScale = Math.max(50, Math.min(100, cat.substrate.length_mm / 3));

                        return (
                          <div key={cat.position} className="flex items-center">
                            {/* Mixing pipe (before SCR, show injector) */}
                            {cat.type === "SCR" && (
                              <div className="flex flex-col items-center mx-1">
                                <div className="text-xs text-blue-500 font-medium">DEF ↓</div>
                                <div className="h-8 w-0.5 bg-blue-400" />
                                <div className="h-0.5 w-12 bg-muted-foreground" />
                                <p className="text-xs text-muted-foreground">{pipe.injectorToSCR_mm}mm</p>
                              </div>
                            )}

                            <div className="flex flex-col items-center">
                              <div
                                className="rounded-md border-2 border-primary bg-primary/5 flex flex-col items-center justify-center text-center"
                                style={{ width: widthScale, minHeight: heightScale }}
                              >
                                <p className="text-xs font-bold">{cat.type}</p>
                                <p className="text-[10px] text-muted-foreground">{cat.substrate.diameter_mm}×{cat.substrate.length_mm}</p>
                                <p className="text-[10px] text-muted-foreground">{cat.substrate.cellDensity_cpsi}/{cat.substrate.wallThickness_mil}</p>
                                <p className="text-[10px] font-mono">{cat.substrate.volume_L.toFixed(1)}L</p>
                              </div>
                              <p className="mt-1 text-xs font-mono text-amber-600">{cumTemp}°C</p>
                              <p className="text-[10px] text-muted-foreground">ΔP {cat.pressureDrop_kPa_clean.toFixed(2)} kPa</p>
                            </div>

                            {idx < rfq.aftertreatmentSystem.catalysts.length - 1 && (
                              <div className="flex items-center">
                                <div className="h-0.5 w-6 bg-muted-foreground" />
                                <ChevronRight className="h-4 w-4 -ml-1 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Tailpipe */}
                      <div className="flex items-center">
                        <div className="h-0.5 w-8 bg-muted-foreground" />
                        <ChevronRight className="h-4 w-4 -ml-1 text-muted-foreground" />
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="rounded-lg border-2 border-dashed bg-green-500/10 px-4 py-6 text-center">
                          <p className="text-xs font-bold text-green-600">TAILPIPE</p>
                          <p className="text-xs text-muted-foreground">ΔP: {rfq.aftertreatmentSystem.totalPressureDrop_kPa.toFixed(2)} kPa</p>
                          <p className="text-xs text-muted-foreground">{rfq.aftertreatmentSystem.totalSystemWeight_kg.toFixed(1)} kg</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* System dimensions summary */}
                  <div className="mt-4 grid grid-cols-4 gap-3 text-sm">
                    <div className="rounded-lg border p-2 text-center">
                      <p className="text-muted-foreground">Total Length</p>
                      <p className="font-mono font-bold">{rfq.aftertreatmentSystem.totalSystemLength_mm} mm</p>
                    </div>
                    <div className="rounded-lg border p-2 text-center">
                      <p className="text-muted-foreground">Max Diameter</p>
                      <p className="font-mono font-bold">{rfq.aftertreatmentSystem.catalysts.length > 0 ? Math.max(...rfq.aftertreatmentSystem.catalysts.map((c) => c.canningDiameter_mm)) : 0} mm</p>
                    </div>
                    <div className="rounded-lg border p-2 text-center">
                      <p className="text-muted-foreground">Total Weight</p>
                      <p className="font-mono font-bold">{rfq.aftertreatmentSystem.totalSystemWeight_kg.toFixed(1)} kg</p>
                    </div>
                    <div className="rounded-lg border p-2 text-center">
                      <p className="text-muted-foreground">Architecture</p>
                      <p className="font-mono font-bold text-xs">{rfq.aftertreatmentSystem.architecture}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---- LIGHT-OFF CURVES TAB ---- */}
            <TabsContent value="lightoff" className="mt-4">
              <div className="grid gap-6">
                {Object.entries(conversionCurves).map(([catType, points]) => {
                  const formId = selectedFormulations[catType] ?? PGM_FORMULATIONS.find((f) => f.catalystTypes.includes(catType as CatalystType))?.id;
                  const formulation = PGM_FORMULATIONS.find((f) => f.id === formId);
                  const lightOffCO = findLightOff(points, "CO");
                  const lightOffHC = findLightOff(points, "HC");
                  const lightOffNOx = findLightOff(points, "NOx");

                  const colors: Record<string, string> = {
                    DOC: "#1A4F6E", SCR: "#1A5E42", TWC: "#C44536", ASC: "#4E356E",
                  };
                  const baseColor = colors[catType] ?? "#1A4F6E";

                  return (
                    <Card key={catType}>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Badge style={{ backgroundColor: baseColor, color: "white" }}>{catType}</Badge>
                          CO / HC / NOₓ Conversion vs. Temperature
                          {formulation && <span className="text-xs text-muted-foreground font-normal ml-2">— {formulation.name}</span>}
                        </CardTitle>
                        <CardDescription>
                          Kinetics-based light-off curves using {formulation?.washcoatType ?? "standard"} washcoat at {formulation?.totalPGM_g_ft3 ?? 0} g/ft³ PGM
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={320}>
                          <LineChart data={points}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="temperature_C" label={{ value: "Temperature [°C]", position: "insideBottom", offset: -5 }} />
                            <YAxis domain={[0, 100]} label={{ value: "Conversion [%]", angle: -90, position: "insideLeft" }} />
                            <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                            <Legend />
                            {catType !== "SCR" && catType !== "ASC" && (
                              <>
                                <Line type="monotone" dataKey="CO_conversion" stroke="#E63946" strokeWidth={2.5} dot={false} name="CO" />
                                <Line type="monotone" dataKey="HC_conversion" stroke="#E6A23C" strokeWidth={2.5} dot={false} name="HC" />
                              </>
                            )}
                            <Line type="monotone" dataKey="NOx_conversion" stroke="#2A9D8F" strokeWidth={2.5} dot={false} name="NOₓ" />
                            {catType === "DOC" && (
                              <Line type="monotone" dataKey="NO2_make" stroke="#6A4A8A" strokeWidth={1.5} dot={false} name="NO₂ Make" strokeDasharray="5 3" />
                            )}
                          </LineChart>
                        </ResponsiveContainer>

                        {/* Light-off temperatures */}
                        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                          {catType !== "SCR" && catType !== "ASC" && (
                            <>
                              <div className="rounded-lg border-l-4 border-l-[#E63946] p-3">
                                <p className="text-xs text-muted-foreground">CO Light-Off (T₅₀)</p>
                                <p className="font-mono font-bold text-lg">{lightOffCO.toFixed(0)}°C</p>
                              </div>
                              <div className="rounded-lg border-l-4 border-l-[#E6A23C] p-3">
                                <p className="text-xs text-muted-foreground">HC Light-Off (T₅₀)</p>
                                <p className="font-mono font-bold text-lg">{lightOffHC.toFixed(0)}°C</p>
                              </div>
                            </>
                          )}
                          <div className="rounded-lg border-l-4 border-l-[#2A9D8F] p-3">
                            <p className="text-xs text-muted-foreground">NOₓ Light-Off (T₅₀)</p>
                            <p className="font-mono font-bold text-lg">{lightOffNOx.toFixed(0)}°C</p>
                          </div>
                        </div>

                        {/* Operating point indicator */}
                        <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm">
                          <p className="font-medium">Operating Point: {engineInputs.exhaustTemp_C}°C</p>
                          <div className="flex gap-4 mt-1 text-muted-foreground">
                            {points.length > 0 && (() => {
                              const opPt = points.reduce((best, p) =>
                                Math.abs(p.temperature_C - engineInputs.exhaustTemp_C) < Math.abs(best.temperature_C - engineInputs.exhaustTemp_C) ? p : best
                              );
                              return (
                                <>
                                  {catType !== "SCR" && catType !== "ASC" && (
                                    <>
                                      <span>CO: <span className="font-mono font-bold">{opPt.CO_conversion.toFixed(1)}%</span></span>
                                      <span>HC: <span className="font-mono font-bold">{opPt.HC_conversion.toFixed(1)}%</span></span>
                                    </>
                                  )}
                                  <span>NOₓ: <span className="font-mono font-bold">{opPt.NOx_conversion.toFixed(1)}%</span></span>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {Object.keys(conversionCurves).length === 0 && (
                  <Card>
                    <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                      <p>No conversion data available. DPF filtration is not temperature-dependent in the same way.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* ---- TECHNOLOGY RECOMMENDATION TAB ---- */}
            {techRecs.length > 0 && (
              <TabsContent value="technology" className="mt-4">
                <div className="grid gap-6">
                  {techRecs.map((rec) => {
                    const colors: Record<string, string> = {
                      DOC: "#1A4F6E", DPF: "#5C4028", SCR: "#1A5E42", ASC: "#4E356E", TWC: "#C44536",
                    };
                    const color = colors[rec.catalystType] ?? "#1A4F6E";

                    return (
                      <Card key={rec.catalystType} className="border-l-4" style={{ borderLeftColor: color }}>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Badge style={{ backgroundColor: color, color: "white" }}>{rec.catalystType}</Badge>
                            Recommended: {rec.recommended.name}
                          </CardTitle>
                          <CardDescription>{rec.recommended.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-4 md:grid-cols-3">
                            {/* PGM Breakdown */}
                            <div className="rounded-lg border p-4">
                              <h4 className="text-sm font-semibold mb-2">PGM Formulation</h4>
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span>Pt</span>
                                  <span className="font-mono font-bold">{rec.recommended.metals.Pt_g_ft3} g/ft³</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Pd</span>
                                  <span className="font-mono font-bold">{rec.recommended.metals.Pd_g_ft3} g/ft³</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Rh</span>
                                  <span className="font-mono font-bold">{rec.recommended.metals.Rh_g_ft3} g/ft³</span>
                                </div>
                                <div className="border-t pt-2 flex justify-between text-sm font-bold">
                                  <span>Total</span>
                                  <span className="font-mono">{rec.recommended.totalPGM_g_ft3} g/ft³</span>
                                </div>
                                <p className="text-xs text-muted-foreground">Ratio: {rec.recommended.ratio} (Pt:Pd:Rh)</p>
                              </div>
                            </div>

                            {/* Washcoat */}
                            <div className="rounded-lg border p-4">
                              <h4 className="text-sm font-semibold mb-2">Washcoat Technology</h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span>Type</span>
                                  <span className="font-medium">{rec.recommended.washcoatType}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Loading</span>
                                  <span className="font-mono">{rec.recommended.washcoatLoading_g_L} g/L</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Thickness</span>
                                  <span className="font-mono">{rec.recommended.washcoatThickness_um} µm</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">{rec.recommended.washcoatComposition}</p>
                              </div>
                            </div>

                            {/* Performance */}
                            <div className="rounded-lg border p-4">
                              <h4 className="text-sm font-semibold mb-2">Performance</h4>
                              <div className="space-y-2 text-sm">
                                {rec.recommended.lightOff_CO_C > 0 && (
                                  <div className="flex justify-between">
                                    <span>CO T₅₀</span>
                                    <span className="font-mono">{rec.recommended.lightOff_CO_C}°C</span>
                                  </div>
                                )}
                                {rec.recommended.lightOff_HC_C > 0 && (
                                  <div className="flex justify-between">
                                    <span>HC T₅₀</span>
                                    <span className="font-mono">{rec.recommended.lightOff_HC_C}°C</span>
                                  </div>
                                )}
                                {rec.recommended.lightOff_NO_C > 0 && (
                                  <div className="flex justify-between">
                                    <span>NOₓ T₅₀</span>
                                    <span className="font-mono">{rec.recommended.lightOff_NO_C}°C</span>
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <span>Max Temp</span>
                                  <span className="font-mono">{rec.recommended.maxOperatingTemp_C}°C</span>
                                </div>
                                <div className="flex gap-2 mt-2">
                                  <Badge variant="outline" className="text-[10px]">S: {rec.recommended.sulfurTolerance}</Badge>
                                  <Badge variant="outline" className="text-[10px]">{rec.recommended.thermalDurability}</Badge>
                                  <Badge variant="outline" className="text-[10px]">Cost: {rec.recommended.costIndex}×</Badge>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Reasoning */}
                          <div className="mt-4 rounded-lg bg-muted/50 p-3">
                            <h4 className="text-sm font-semibold mb-1">Selection Reasoning</h4>
                            <ul className="space-y-1">
                              {rec.reasoning.map((r, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                                  <span className="mt-0.5">{r.startsWith("⚠") ? "⚠" : "•"}</span>
                                  <span>{r.replace(/^⚠\s*/, "")}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Alternatives */}
                          {rec.alternatives.length > 0 && (
                            <div className="mt-3">
                              <h4 className="text-xs font-semibold text-muted-foreground mb-2">Alternative Formulations</h4>
                              <div className="flex flex-wrap gap-2">
                                {rec.alternatives.map((alt) => (
                                  <Badge key={alt.id} variant="outline" className="text-xs cursor-pointer hover:bg-accent"
                                    onClick={() => setSelectedFormulations((p) => ({ ...p, [rec.catalystType]: alt.id }))}
                                  >
                                    {alt.name} ({alt.totalPGM_g_ft3} g/ft³)
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            )}

            {/* ---- SURFACE SCIENCE TAB ---- */}
            {tofSizingResults.length > 0 && (
              <TabsContent value="surface" className="mt-4">
                <div className="grid gap-6">
                  {/* Sizing Comparison: TOF vs GHSV */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Beaker className="h-4 w-4 text-primary" />
                        First-Principles Sizing: TOF vs Empirical GHSV
                      </CardTitle>
                      <CardDescription>
                        Catalyst volume derived from chemisorption data, dispersion, and turnover frequency — compared against the traditional GHSV method
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Catalyst</TableHead>
                              <TableHead>Profile</TableHead>
                              <TableHead>Dispersion</TableHead>
                              <TableHead>Particle Size</TableHead>
                              <TableHead>Metallic SA</TableHead>
                              <TableHead>Limiting Species</TableHead>
                              <TableHead>TOF @ T</TableHead>
                              <TableHead>V (TOF)</TableHead>
                              <TableHead>V (GHSV)</TableHead>
                              <TableHead>Ratio</TableHead>
                              <TableHead>Confidence</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tofSizingResults.map((r) => (
                              <TableRow key={r.catalystType}>
                                <TableCell className="font-semibold">{r.catalystType}</TableCell>
                                <TableCell className="text-xs max-w-[140px] truncate">{r.profile.name}</TableCell>
                                <TableCell className="font-mono">{(r.dispersion.dispersion * 100).toFixed(1)}%</TableCell>
                                <TableCell className="font-mono">{r.dispersion.particleSize_nm.toFixed(1)} nm</TableCell>
                                <TableCell className="font-mono">{r.dispersion.metallicSurfaceArea_m2_gPGM.toFixed(0)} m²/g</TableCell>
                                <TableCell>{r.limitingSpecies}</TableCell>
                                <TableCell className="font-mono">
                                  {r.speciesSizing.find((s) => s.species === r.limitingSpecies)?.TOF_at_T.toFixed(2) ?? "—"} s⁻¹
                                </TableCell>
                                <TableCell className="font-mono font-semibold">{r.requiredVolume_TOF_L.toFixed(2)} L</TableCell>
                                <TableCell className="font-mono">{r.requiredVolume_GHSV_L.toFixed(2)} L</TableCell>
                                <TableCell className="font-mono">{r.volumeRatio.toFixed(2)}×</TableCell>
                                <TableCell>
                                  <Badge variant={r.confidence === "high" ? "default" : r.confidence === "moderate" ? "secondary" : "destructive"}>
                                    {r.confidence}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Per-Species Molecular Analysis */}
                  {tofSizingResults.map((r) => (
                    <Card key={`species-${r.catalystType}`}>
                      <CardHeader>
                        <CardTitle className="text-base">{r.catalystType} — Molecular-Level Sizing</CardTitle>
                        <CardDescription>
                          Chemisorption: {r.profile.chemisorption.probeGas} uptake = {r.profile.chemisorption.uptake_umol_gCat} µmol/g | BET = {r.profile.physical.BET_m2_g} m²/g | Particle = {r.dispersion.particleSize_nm.toFixed(1)} nm
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
                          <div className="rounded-lg border p-3 bg-muted/30">
                            <p className="text-xs text-muted-foreground">Surface Sites / g_cat</p>
                            <p className="text-lg font-mono font-semibold">{r.dispersion.surfaceSites_per_gCat.toExponential(2)}</p>
                          </div>
                          <div className="rounded-lg border p-3 bg-muted/30">
                            <p className="text-xs text-muted-foreground">PGM Required</p>
                            <p className="text-lg font-mono font-semibold">{r.totalPGM_g.toFixed(2)} g</p>
                          </div>
                          <div className="rounded-lg border p-3 bg-muted/30">
                            <p className="text-xs text-muted-foreground">Site Utilization</p>
                            <p className="text-lg font-mono font-semibold">{r.siteUtilization_percent.toFixed(1)}%</p>
                          </div>
                          <div className="rounded-lg border p-3 bg-muted/30">
                            <p className="text-xs text-muted-foreground">Operating T</p>
                            <p className="text-lg font-mono font-semibold">{r.operatingTemp_C}°C</p>
                          </div>
                        </div>

                        <div className="rounded-md border overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Species</TableHead>
                                <TableHead>Inlet [ppm]</TableHead>
                                <TableHead>Flow [mol/s]</TableHead>
                                <TableHead>Target Conv.</TableHead>
                                <TableHead>TOF @ {r.operatingTemp_C}°C [s⁻¹]</TableHead>
                                <TableHead>Required Sites</TableHead>
                                <TableHead>Molecules/s</TableHead>
                                <TableHead>Required PGM [g]</TableHead>
                                <TableHead>Required Volume [L]</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {r.speciesSizing.map((s) => (
                                <TableRow key={s.species} className={s.species === r.limitingSpecies ? "bg-primary/5 font-semibold" : ""}>
                                  <TableCell>{s.species} {s.species === r.limitingSpecies && <Badge variant="outline" className="ml-1 text-[10px]">limiting</Badge>}</TableCell>
                                  <TableCell className="font-mono">{s.inletConcentration_ppm}</TableCell>
                                  <TableCell className="font-mono">{s.molarFlow_mol_s.toExponential(3)}</TableCell>
                                  <TableCell className="font-mono">{(s.targetConversion * 100).toFixed(0)}%</TableCell>
                                  <TableCell className="font-mono">{s.TOF_at_T.toFixed(3)}</TableCell>
                                  <TableCell className="font-mono">{s.requiredSites.toExponential(2)}</TableCell>
                                  <TableCell className="font-mono">{s.molecules_per_second.toExponential(2)}</TableCell>
                                  <TableCell className="font-mono">{s.requiredPGM_g.toFixed(3)}</TableCell>
                                  <TableCell className="font-mono">{s.requiredVolume_L.toFixed(3)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {r.notes.length > 0 && (
                          <div className="mt-3 flex flex-col gap-1">
                            {r.notes.map((n, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                                <span>{n}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  {/* Catalyst Characterization Profiles */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Catalyst Characterization Data</CardTitle>
                      <CardDescription>Laboratory characterization data from the profiles used in sizing</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        {tofSizingResults.map((r) => {
                          const p = r.profile;
                          return (
                            <div key={p.id} className="rounded-lg border p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Badge style={{ backgroundColor: ({ DOC: "#1A4F6E", TWC: "#C44536", SCR: "#1A5E42", ASC: "#4E356E", DPF: "#5C4028" } as Record<string, string>)[r.catalystType] ?? "#666", color: "white" }}>
                                  {r.catalystType}
                                </Badge>
                                <span className="font-semibold text-sm">{p.name}</span>
                              </div>

                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                <span className="text-muted-foreground">Support</span>
                                <span className="font-mono">{p.composition.support}</span>
                                <span className="text-muted-foreground">Active Phase</span>
                                <span className="font-mono">{p.composition.activePhase}</span>
                                <span className="text-muted-foreground">BET Surface Area</span>
                                <span className="font-mono">{p.physical.BET_m2_g} m²/g</span>
                                <span className="text-muted-foreground">Pore Volume</span>
                                <span className="font-mono">{p.physical.poreVolume_cm3_g} cm³/g</span>
                                <span className="text-muted-foreground">Avg Pore Size</span>
                                <span className="font-mono">{p.physical.avgPoreSize_nm} nm</span>
                                <span className="text-muted-foreground">Washcoat Loading</span>
                                <span className="font-mono">{p.composition.washcoatLoading_g_L} g/L</span>
                                <span className="text-muted-foreground">Washcoat Thickness</span>
                                <span className="font-mono">{p.composition.washcoatThickness_um} µm</span>
                                <span className="text-muted-foreground">{p.chemisorption.probeGas} Chemisorption</span>
                                <span className="font-mono">{p.chemisorption.uptake_umol_gCat} µmol/g</span>
                                <span className="text-muted-foreground">PGM Dispersion</span>
                                <span className="font-mono">{p.chemisorption.dispersion_percent}%</span>
                                <span className="text-muted-foreground">Metallic SA</span>
                                <span className="font-mono">{p.chemisorption.metallicSA_m2_gPGM} m²/g_PGM</span>
                                <span className="text-muted-foreground">Avg Particle Size</span>
                                <span className="font-mono">{p.chemisorption.avgParticleSize_nm} nm</span>
                                {p.composition.totalPGM_g_ft3 > 0 && (
                                  <>
                                    <span className="text-muted-foreground">Total PGM</span>
                                    <span className="font-mono">{p.composition.totalPGM_g_ft3} g/ft³</span>
                                    <span className="text-muted-foreground">Pt / Pd / Rh</span>
                                    <span className="font-mono">{p.composition.Pt_g_ft3} / {p.composition.Pd_g_ft3} / {p.composition.Rh_g_ft3}</span>
                                  </>
                                )}
                                {p.composition.OSC_umol_g && (
                                  <>
                                    <span className="text-muted-foreground">OSC</span>
                                    <span className="font-mono">{p.composition.OSC_umol_g} µmol O₂/g</span>
                                  </>
                                )}
                              </div>

                              {/* Activity data */}
                              <div className="mt-3 pt-3 border-t">
                                <p className="text-xs font-semibold mb-2">Activity Data (TOF)</p>
                                <div className="space-y-1">
                                  {p.activity.reactions.map((rx, i) => (
                                    <div key={i} className="grid grid-cols-2 gap-x-4 text-xs">
                                      <span className="text-muted-foreground">{rx.name}</span>
                                      <span className="font-mono">TOF = {rx.TOF_ref} s⁻¹ @ {rx.T_ref_C}°C (Ea = {rx.Ea_kJ_mol} kJ/mol)</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Thermal stability */}
                              <div className="mt-3 pt-3 border-t">
                                <p className="text-xs font-semibold mb-1">Thermal Stability</p>
                                <div className="grid grid-cols-2 gap-x-4 text-xs">
                                  <span className="text-muted-foreground">Max Operating T</span>
                                  <span className="font-mono">{p.thermalStability.maxOperatingTemp_C}°C</span>
                                  <span className="text-muted-foreground">Sintering Onset</span>
                                  <span className="font-mono">{p.thermalStability.sinteringOnsetTemp_C}°C</span>
                                  <span className="text-muted-foreground">Activity Retention (aged)</span>
                                  <span className="font-mono">{p.thermalStability.activityRetention_percent}%</span>
                                </div>
                              </div>

                              <p className="mt-3 text-xs text-muted-foreground italic">{p.notes}</p>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Conversion vs Temperature from TOF */}
                  {Object.keys(conversionProfiles).length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Conversion vs Temperature (TOF-Based Kinetics)</CardTitle>
                        <CardDescription>
                          Light-off curves generated from turnover frequency, dispersion, and effectiveness factor — not empirical correlations
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-6 md:grid-cols-2">
                          {Object.entries(conversionProfiles).map(([catType, points]) => {
                            const species = points.length > 0 ? Object.keys(points[0].species) : [];
                            const chartData = points.map((pt) => {
                              const row: Record<string, number> = { T: pt.temperature_C };
                              for (const sp of species) {
                                row[sp] = pt.species[sp]?.conversion_percent ?? 0;
                              }
                              return row;
                            });
                            const speciesColors: Record<string, string> = { CO: "#E74C3C", HC: "#F39C12", NOx: "#3498DB" };
                            return (
                              <div key={catType}>
                                <h4 className="text-sm font-semibold mb-2">{catType} — Conversion vs T</h4>
                                <ResponsiveContainer width="100%" height={280}>
                                  <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                    <XAxis dataKey="T" label={{ value: "Temperature [°C]", position: "insideBottom", offset: -5 }} />
                                    <YAxis domain={[0, 100]} label={{ value: "Conversion [%]", angle: -90, position: "insideLeft" }} />
                                    <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                                    <Legend />
                                    {species.map((sp) => (
                                      <Line key={sp} type="monotone" dataKey={sp} stroke={speciesColors[sp] ?? "#999"} strokeWidth={2} dot={false} />
                                    ))}
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Reactor Species Profiles */}
                  {Object.keys(reactorProfiles).length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Species Profiles Along Reactor</CardTitle>
                        <CardDescription>
                          Concentration decay along the catalyst length — shows where conversion happens and identifies diffusion-limited zones
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-6 md:grid-cols-2">
                          {Object.entries(reactorProfiles).map(([catType, points]) => {
                            const species = points.length > 0 ? Object.keys(points[0].species) : [];
                            const chartData = points.map((pt) => {
                              const row: Record<string, number> = { z: pt.position_mm, T: pt.temperature_C };
                              for (const sp of species) {
                                row[`${sp}_ppm`] = pt.species[sp]?.concentration_ppm ?? 0;
                                row[`${sp}_conv`] = pt.species[sp]?.conversion_percent ?? 0;
                              }
                              return row;
                            });
                            const speciesColors: Record<string, string> = { CO: "#E74C3C", HC: "#F39C12", NOx: "#3498DB" };
                            return (
                              <div key={catType}>
                                <h4 className="text-sm font-semibold mb-2">{catType} — Concentration Along Reactor</h4>
                                <ResponsiveContainer width="100%" height={280}>
                                  <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                    <XAxis dataKey="z" label={{ value: "Position [mm]", position: "insideBottom", offset: -5 }} />
                                    <YAxis label={{ value: "Concentration [ppm]", angle: -90, position: "insideLeft" }} />
                                    <Tooltip />
                                    <Legend />
                                    {species.map((sp) => (
                                      <Line key={sp} type="monotone" dataKey={`${sp}_ppm`} name={`${sp} [ppm]`} stroke={speciesColors[sp] ?? "#999"} strokeWidth={2} dot={false} />
                                    ))}
                                    <Line type="monotone" dataKey="T" name="Temperature [°C]" stroke="#999" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* TOF Temperature Dependence */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Turnover Frequency vs Temperature</CardTitle>
                      <CardDescription>
                        Arrhenius plot showing how TOF varies with temperature for each reaction — the fundamental measure of catalytic activity
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const allReactions: Array<{ label: string; catType: string; tofRef: number; tRefC: number; eaKJ: number }> = [];
                        for (const r of tofSizingResults) {
                          for (const rx of r.profile.activity.reactions) {
                            allReactions.push({
                              label: `${r.catalystType}: ${rx.name}`,
                              catType: r.catalystType,
                              tofRef: rx.TOF_ref,
                              tRefC: rx.T_ref_C,
                              eaKJ: rx.Ea_kJ_mol,
                            });
                          }
                        }
                        const temps = Array.from({ length: 40 }, (_, i) => 100 + i * 15);
                        const chartData = temps.map((T) => {
                          const row: Record<string, number> = { T };
                          for (const rx of allReactions) {
                            const T_K = T + 273.15;
                            const T_ref_K = rx.tRefC + 273.15;
                            const tof = rx.tofRef * Math.exp((-rx.eaKJ * 1000 / 8.314) * (1 / T_K - 1 / T_ref_K));
                            row[rx.label] = Math.max(1e-6, tof);
                          }
                          return row;
                        });
                        const colors = ["#E74C3C", "#3498DB", "#2ECC71", "#F39C12", "#9B59B6", "#1ABC9C", "#E67E22", "#34495E"];
                        return (
                          <ResponsiveContainer width="100%" height={350}>
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                              <XAxis dataKey="T" label={{ value: "Temperature [°C]", position: "insideBottom", offset: -5 }} />
                              <YAxis scale="log" domain={["auto", "auto"]} label={{ value: "TOF [s⁻¹]", angle: -90, position: "insideLeft" }} tickFormatter={(v: number) => v >= 1 ? v.toFixed(0) : v.toExponential(0)} />
                              <Tooltip formatter={(v: number) => v.toFixed(4)} />
                              <Legend wrapperStyle={{ fontSize: "11px" }} />
                              {allReactions.map((rx, i) => (
                                <Line key={rx.label} type="monotone" dataKey={rx.label} stroke={colors[i % colors.length]} strokeWidth={2} dot={false} />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}

            {/* ---- PROFESSIONAL DASHBOARD ---- */}
            <TabsContent value="dashboard" className="mt-4">
              <div className="grid gap-4">
                {/* Header banner */}
                <div className="rounded-xl bg-gradient-to-r from-[#003366] via-[#004080] to-[#003366] p-5 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-widest opacity-70">Aftertreatment System Report</p>
                      <p className="text-xl font-bold mt-1">{rfq.projectInfo.rfqNumber}</p>
                      <p className="text-sm opacity-80">{rfq.projectInfo.engineModel} | {rfq.projectInfo.emissionStandard.replace(/_/g, " ").toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold font-mono">{rfq.aftertreatmentSystem.architecture}</p>
                      <p className="text-xs opacity-70 mt-1">{rfq.aftertreatmentSystem.catalysts.length} elements</p>
                    </div>
                  </div>
                </div>

                {/* KPI Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {[
                    { label: "System ΔP", value: `${rfq.aftertreatmentSystem.totalPressureDrop_kPa.toFixed(1)}`, unit: "kPa", status: rfq.aftertreatmentSystem.totalPressureDrop_kPa < 20 ? "ok" : "warn" },
                    { label: "Total Mass", value: `${rfq.aftertreatmentSystem.totalSystemWeight_kg.toFixed(1)}`, unit: "kg", status: "ok" },
                    { label: "Total Length", value: `${rfq.aftertreatmentSystem.totalSystemLength_mm}`, unit: "mm", status: "ok" },
                    { label: "PGM Cost", value: `$${rfq.costEstimate.pgmCost_USD.toFixed(0)}`, unit: "", status: rfq.costEstimate.pgmCost_USD > rfq.costEstimate.totalPerUnit_USD * 0.6 ? "warn" : "ok" },
                    { label: "Unit Cost", value: `$${rfq.costEstimate.totalPerUnit_USD.toFixed(0)}`, unit: "", status: "ok" },
                    { label: "Exhaust Flow", value: `${baseResult.exhaustFlowRate_Nm3_h.toFixed(0)}`, unit: "Nm³/h", status: "ok" },
                  ].map((kpi) => (
                    <div key={kpi.label} className={`rounded-lg border-2 p-3 ${kpi.status === "warn" ? "border-amber-500/50 bg-amber-500/5" : "border-border"}`}>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{kpi.label}</p>
                      <p className="text-lg font-bold font-mono">{kpi.value}<span className="text-xs font-normal text-muted-foreground ml-1">{kpi.unit}</span></p>
                    </div>
                  ))}
                </div>

                {/* System schematic + compliance */}
                <div className="grid gap-4 md:grid-cols-3">
                  {/* Catalyst chain visual */}
                  <Card className="md:col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">System Architecture</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 py-4 overflow-x-auto">
                        <div className="rounded-lg border-2 border-dashed px-3 py-4 text-center shrink-0">
                          <p className="text-[10px] uppercase text-muted-foreground">Engine</p>
                          <p className="text-xs font-bold">{engineInputs.displacement_L}L</p>
                          <p className="text-[10px] text-muted-foreground">{engineInputs.ratedPower_kW} kW</p>
                        </div>
                        {rfq.aftertreatmentSystem.catalysts.map((cat, idx) => {
                          const typeColors: Record<string, string> = {
                            DOC: "#1A4F6E", DPF: "#5C4028", SCR: "#1A5E42", ASC: "#4E356E", TWC: "#8B2500",
                          };
                          const bg = typeColors[cat.type] ?? "#444";
                          return (
                            <div key={idx} className="flex items-center gap-2">
                              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="rounded-lg px-3 py-3 text-center text-white shrink-0" style={{ backgroundColor: bg, minWidth: 80 }}>
                                <p className="text-xs font-bold">{cat.type}</p>
                                <p className="text-[10px] opacity-80">{cat.substrate.volume_L.toFixed(1)} L</p>
                                <p className="text-[10px] opacity-80">{cat.substrate.diameter_mm}×{cat.substrate.length_mm} mm</p>
                                <p className="text-[10px] opacity-80">{cat.substrate.cellDensity_cpsi}/{cat.substrate.wallThickness_mil}</p>
                              </div>
                            </div>
                          );
                        })}
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="rounded-lg border-2 border-dashed px-3 py-4 text-center shrink-0">
                          <p className="text-[10px] uppercase text-muted-foreground">Tailpipe</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Compliance summary */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Compliance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {rfq.compliance.testCycles.map((tc, tci) => (
                          <div key={tci} className="flex items-center justify-between rounded-lg border p-2">
                            <span className="text-sm font-medium">{tc.cycle}</span>
                            <div className={`w-3 h-3 rounded-full ${tc.compliant ? "bg-green-500" : "bg-red-500"}`} />
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 text-center">
                        <Badge className={`text-sm ${rfq.compliance.overallCompliant ? "bg-green-600" : "bg-red-600"}`}>
                          {rfq.compliance.overallCompliant ? "COMPLIANT" : "NON-COMPLIANT"}
                        </Badge>
                        <p className="text-[10px] text-muted-foreground mt-1">{String(rfq.compliance.standard).replace(/_/g, " ").toUpperCase()}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Performance charts row */}
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Conversion by species */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Conversion Efficiency (Fresh vs Aged)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={rfq.aftertreatmentSystem.catalysts.flatMap((cat) =>
                          Object.entries(cat.freshConversion_percent).map(([species, fresh]) => ({
                            name: `${cat.type} ${species}`,
                            Fresh: fresh,
                            Aged: cat.agedConversion_percent[species] ?? fresh,
                          }))
                        )}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                          <YAxis domain={[0, 100]} />
                          <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                          <Legend />
                          <Bar dataKey="Fresh" fill="#10B981" radius={[2, 2, 0, 0]} />
                          <Bar dataKey="Aged" fill="#F59E0B" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Cost breakdown */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Cost Structure</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {[
                          { label: "Substrate", value: rfq.costEstimate.substrateCost_USD, color: "#3B82F6" },
                          { label: "Washcoat", value: rfq.costEstimate.washcoatCost_USD, color: "#10B981" },
                          { label: "PGM", value: rfq.costEstimate.pgmCost_USD, color: "#F59E0B" },
                          { label: "Canning", value: rfq.costEstimate.canningCost_USD, color: "#8B5CF6" },
                          { label: "Assembly", value: rfq.costEstimate.assemblyCost_USD, color: "#EF4444" },
                        ].map((item) => {
                          const pct = rfq.costEstimate.totalPerUnit_USD > 0 ? (item.value / rfq.costEstimate.totalPerUnit_USD) * 100 : 0;
                          return (
                            <div key={item.label} className="flex items-center gap-2">
                              <span className="w-16 text-xs text-muted-foreground">{item.label}</span>
                              <div className="flex-1 h-5 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                              </div>
                              <span className="w-16 text-right font-mono text-xs">${item.value.toFixed(0)}</span>
                              <span className="w-10 text-right text-[10px] text-muted-foreground">{pct.toFixed(0)}%</span>
                            </div>
                          );
                        })}
                        <div className="flex items-center justify-between border-t pt-2 mt-2">
                          <span className="font-semibold text-sm">Total</span>
                          <span className="font-mono font-bold text-lg">${rfq.costEstimate.totalPerUnit_USD.toFixed(0)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Pressure drop + weight breakdown */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Pressure Drop by Element</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={rfq.aftertreatmentSystem.catalysts.map((c) => ({
                          name: c.type,
                          Clean: c.pressureDrop_kPa_clean,
                          Aged: c.pressureDrop_kPa_aged,
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip formatter={(v: number) => `${v.toFixed(2)} kPa`} />
                          <Legend />
                          <Bar dataKey="Clean" fill="#3B82F6" radius={[2, 2, 0, 0]} />
                          <Bar dataKey="Aged" fill="#EF4444" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Element Specifications</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[10px]">Type</TableHead>
                              <TableHead className="text-[10px]">Vol [L]</TableHead>
                              <TableHead className="text-[10px]">GHSV</TableHead>
                              <TableHead className="text-[10px]">PGM</TableHead>
                              <TableHead className="text-[10px]">T₅₀ [°C]</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rfq.aftertreatmentSystem.catalysts.map((c, i) => (
                              <TableRow key={i}>
                                <TableCell><Badge variant="outline" className="text-[10px]">{c.type}</Badge></TableCell>
                                <TableCell className="font-mono text-xs">{c.substrate.volume_L.toFixed(1)}</TableCell>
                                <TableCell className="font-mono text-xs">{c.GHSV_design_h.toLocaleString()}</TableCell>
                                <TableCell className="font-mono text-xs">{c.pgm ? `${c.pgm.totalLoading_g_ft3}` : "—"}</TableCell>
                                <TableCell className="font-mono text-xs">{c.lightOffTemp_C_fresh}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Footer */}
                <div className="rounded-lg border bg-muted/30 p-3 text-center text-xs text-muted-foreground">
                  <p>AftermarketOS CatSizer — Confidential Engineering Report</p>
                  <p>Generated {new Date().toISOString().split("T")[0]} | {rfq.projectInfo.rfqNumber} | PGM prices as of March 2026</p>
                </div>
              </div>
            </TabsContent>

            {/* ---- AI ADVISOR TAB ---- */}
            <TabsContent value="ai_advisor" className="mt-4">
              <div className="grid gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      AI Technology Advisor — powered by BelgaLabs
                    </CardTitle>
                    <CardDescription>
                      AI analyzes your sized system and recommends optimizations for cost, performance, and packaging
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      onClick={handleOEMAIAdvisor}
                      disabled={oemAiLoading}
                      className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
                    >
                      {oemAiLoading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing System with AI…</>
                      ) : (
                        <><Activity className="mr-2 h-4 w-4" />Get AI Optimization Advice</>
                      )}
                    </Button>

                    {oemAiError && (
                      <div className="rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/20">
                        <p className="text-sm text-red-600 flex items-center gap-2">
                          <XCircle className="h-4 w-4" /> {oemAiError}
                        </p>
                      </div>
                    )}

                    {oemAiAdvice && (
                      <div className="space-y-4">
                        {/* System Review */}
                        <div className="rounded-lg border p-4">
                          <h4 className="text-sm font-semibold mb-2">System Review</h4>
                          <p className="text-sm text-muted-foreground">{oemAiAdvice.systemReview.summary}</p>
                          <div className="grid grid-cols-3 gap-4 mt-3">
                            <div>
                              <p className="text-xs font-medium text-emerald-600 mb-1">Strengths</p>
                              <ul className="text-xs text-muted-foreground space-y-0.5">
                                {oemAiAdvice.systemReview.strengths.map((s, i) => (
                                  <li key={i} className="flex items-start gap-1"><CheckCircle2 className="h-3 w-3 mt-0.5 text-emerald-500 shrink-0" />{s}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-red-600 mb-1">Weaknesses</p>
                              <ul className="text-xs text-muted-foreground space-y-0.5">
                                {oemAiAdvice.systemReview.weaknesses.map((w, i) => (
                                  <li key={i} className="flex items-start gap-1"><AlertTriangle className="h-3 w-3 mt-0.5 text-red-500 shrink-0" />{w}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-amber-600 mb-1">Cost Drivers</p>
                              <ul className="text-xs text-muted-foreground space-y-0.5">
                                {oemAiAdvice.systemReview.costDrivers.map((c, i) => (
                                  <li key={i} className="flex items-start gap-1"><DollarSign className="h-3 w-3 mt-0.5 text-amber-500 shrink-0" />{c}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>

                        {/* Recommendations */}
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Optimization Recommendations</h4>
                          <div className="space-y-2">
                            {oemAiAdvice.recommendations.map((rec, i) => (
                              <div key={i} className="rounded-lg border p-3 hover:bg-muted/20 transition-colors">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs">{rec.component}</Badge>
                                  <span className="text-sm font-medium">{rec.parameter}</span>
                                  <Badge className={`text-[10px] ml-auto ${rec.confidence === "high" ? "bg-emerald-500" : rec.confidence === "medium" ? "bg-amber-500" : "bg-red-500"}`}>
                                    {rec.confidence}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-mono">{rec.currentValue}</span> → <span className="font-mono font-bold">{rec.suggestedValue}</span>
                                </p>
                                <p className="text-xs text-emerald-600 mt-0.5">{rec.expectedBenefit}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{rec.rationale}</p>
                                {rec.costImpact && <p className="text-xs text-amber-600 mt-0.5">Cost: {rec.costImpact}</p>}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Alternative Architecture */}
                        {oemAiAdvice.alternativeArchitecture?.description && (
                          <div className="rounded-lg border border-dashed p-4">
                            <h4 className="text-sm font-semibold mb-1">Alternative Architecture</h4>
                            <p className="text-sm text-muted-foreground">{oemAiAdvice.alternativeArchitecture.description}</p>
                            {oemAiAdvice.alternativeArchitecture.components.length > 0 && (
                              <div className="flex gap-1 mt-2">
                                {oemAiAdvice.alternativeArchitecture.components.map((c, i) => (
                                  <Badge key={i} variant="outline">{c}</Badge>
                                ))}
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">{oemAiAdvice.alternativeArchitecture.rationale}</p>
                            {oemAiAdvice.alternativeArchitecture.estimatedCostSaving_pct > 0 && (
                              <Badge className="mt-1 bg-emerald-500">~{oemAiAdvice.alternativeArchitecture.estimatedCostSaving_pct}% cost saving</Badge>
                            )}
                          </div>
                        )}

                        {/* Overall Assessment */}
                        <div className={`rounded-lg border p-4 ${oemAiAdvice.overallAssessment.currentSystemAdequate ? "border-emerald-300 bg-emerald-50/20 dark:border-emerald-800" : "border-amber-300 bg-amber-50/20 dark:border-amber-800"}`}>
                          <h4 className="text-sm font-semibold mb-1">Overall Assessment</h4>
                          <p className="text-sm text-muted-foreground">{oemAiAdvice.overallAssessment.summary}</p>
                          <div className="flex gap-3 mt-2 text-xs">
                            <Badge variant="outline">System: {oemAiAdvice.overallAssessment.currentSystemAdequate ? "Adequate" : "Needs Optimization"}</Badge>
                            <Badge variant="outline">Optimization potential: {oemAiAdvice.overallAssessment.optimizationPotential}</Badge>
                          </div>
                        </div>

                        {oemAiAdvice.tokensUsed && (
                          <p className="text-[10px] text-muted-foreground text-right">AI tokens used: {oemAiAdvice.tokensUsed}</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
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
