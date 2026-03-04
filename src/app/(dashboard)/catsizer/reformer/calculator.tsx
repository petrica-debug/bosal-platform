"use client";

import { useState, useCallback, useMemo } from "react";
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
  Loader2,
  Flame,
  Snowflake,
  ShieldAlert,
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
  ReferenceLine,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import type {
  FuelInputs,
  ReformerSizingResult,
} from "@/lib/catsizer/types";
import { FUEL_PRESETS } from "@/lib/catsizer/constants";
import { sizeReformerSystem } from "@/lib/catsizer/reformer-engine";
import { equilibriumSweep } from "@/lib/catsizer/thermodynamics";
import { reformerFeedComposition } from "@/lib/catsizer/gas-properties";
import { UNITS } from "@/lib/catsizer/units";

const STEPS = [
  "Fuel Input",
  "SOFC & Reformer",
  "Results",
] as const;

const DEFAULT_FUEL: FuelInputs = {
  fuelType: "pipeline_natural_gas",
  CH4_percent: 93,
  C2H6_percent: 3.5,
  C3H8_percent: 0.8,
  CO2_percent: 1.2,
  N2_percent: 1.5,
  H2S_ppm: 4,
  fuelFlowRate_Nm3_h: 10,
  fuelPressure_kPa: 200,
  fuelTemp_C: 25,
  SOFC_power_kW: 50,
  SOFC_fuelUtilization: 0.8,
  SOFC_operatingTemp_C: 800,
  SOFC_currentDensity_A_cm2: 0.5,
  reformingStrategy: "SMR",
  steamToCarbonRatio: 3.0,
  oxygenToCarbonRatio: 0,
};

export function ReformerCalculator() {
  const [step, setStep] = useState(0);
  const [inputs, setInputs] = useState<FuelInputs>(DEFAULT_FUEL);
  const [result, setResult] = useState<ReformerSizingResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  const fuelSum = useMemo(
    () =>
      inputs.CH4_percent +
      inputs.C2H6_percent +
      inputs.C3H8_percent +
      inputs.CO2_percent +
      inputs.N2_percent,
    [inputs]
  );

  const applyPreset = (index: number) => {
    const preset = FUEL_PRESETS[index];
    setInputs((prev) => ({ ...prev, ...preset.inputs }));
  };

  const update = (field: keyof FuelInputs, value: string | number) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  const calculate = useCallback(() => {
    setCalculating(true);
    setTimeout(() => {
      const res = sizeReformerSystem(inputs);
      setResult(res);
      setCalculating(false);
      setStep(2);
    }, 100);
  }, [inputs]);

  const equilibriumData = useMemo(() => {
    if (!result) return [];
    const feed = reformerFeedComposition({
      CH4_percent: inputs.CH4_percent,
      C2H6_percent: inputs.C2H6_percent,
      C3H8_percent: inputs.C3H8_percent,
      CO2_percent: inputs.CO2_percent,
      N2_percent: inputs.N2_percent,
      steamToCarbonRatio: inputs.steamToCarbonRatio,
      oxygenToCarbonRatio: inputs.oxygenToCarbonRatio,
    });

    const sweep = equilibriumSweep(
      UNITS.C_to_K(400),
      UNITS.C_to_K(1000),
      30,
      inputs.fuelPressure_kPa,
      feed
    );

    return sweep.map((pt) => ({
      temp_C: Math.round(UNITS.K_to_C(pt.temperature_K)),
      H2: parseFloat(((pt.composition.H2 ?? 0) * 100).toFixed(2)),
      CO: parseFloat(((pt.composition.CO ?? 0) * 100).toFixed(2)),
      CO2: parseFloat(((pt.composition.CO2 ?? 0) * 100).toFixed(2)),
      CH4: parseFloat(((pt.composition.CH4 ?? 0) * 100).toFixed(2)),
      H2O: parseFloat(((pt.composition.H2O ?? 0) * 100).toFixed(2)),
      CH4_CO: parseFloat(pt.CH4_CO_ratio.toFixed(3)),
      conversion: parseFloat((pt.CH4_conversion * 100).toFixed(1)),
    }));
  }, [result, inputs]);

  const carbonBoundaryData = useMemo(() => {
    const points: { SC: number; temp_C: number; safe: number }[] = [];
    for (let sc = 0.5; sc <= 5.0; sc += 0.25) {
      for (let t = 400; t <= 1000; t += 25) {
        const minSC = Math.max(0.5, 3.0 - t / 400);
        points.push({
          SC: sc,
          temp_C: t,
          safe: sc >= minSC ? 1 : 0,
        });
      }
    }
    return points;
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
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

      {/* Step 1: Fuel Input */}
      {step === 0 && (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Fuel Presets</CardTitle>
              <CardDescription>
                Select a fuel type or enter custom composition below
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {FUEL_PRESETS.map((p, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(i)}
                  >
                    {p.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Fuel Composition [mol%]
                </CardTitle>
                <CardDescription>
                  Sum:{" "}
                  <span
                    className={
                      Math.abs(fuelSum - 100) > 0.5
                        ? "text-red-500 font-bold"
                        : "text-green-500"
                    }
                  >
                    {fuelSum.toFixed(1)}%
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {[
                  ["CH4_percent", "CH₄ (Methane)", "%"],
                  ["C2H6_percent", "C₂H₆ (Ethane)", "%"],
                  ["C3H8_percent", "C₃H₈ (Propane)", "%"],
                  ["CO2_percent", "CO₂", "%"],
                  ["N2_percent", "N₂", "%"],
                  ["H2S_ppm", "H₂S", "ppm"],
                ].map(([field, label, unit]) => (
                  <div key={field} className="flex items-center gap-2">
                    <Label className="w-32 shrink-0">{label}</Label>
                    <Input
                      type="number"
                      step="any"
                      value={inputs[field as keyof FuelInputs] as number}
                      onChange={(e) =>
                        update(
                          field as keyof FuelInputs,
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                    <span className="w-12 text-sm text-muted-foreground">
                      {unit}
                    </span>
                  </div>
                ))}
                {inputs.H2S_ppm > 1 && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/5 p-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    <p className="text-sm">
                      H₂S &gt; 1 ppm: desulfurization bed (ZnO) required
                      upstream. Will be auto-sized.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Flow Conditions
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div>
                  <Label>Fuel Type</Label>
                  <Select
                    value={inputs.fuelType}
                    onValueChange={(v) => update("fuelType", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pipeline_natural_gas">
                        Pipeline Natural Gas
                      </SelectItem>
                      <SelectItem value="biogas">Biogas</SelectItem>
                      <SelectItem value="landfill_gas">
                        Landfill Gas
                      </SelectItem>
                      <SelectItem value="pure_methane">
                        Pure Methane
                      </SelectItem>
                      <SelectItem value="associated_gas">
                        Associated Gas
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {[
                  ["fuelFlowRate_Nm3_h", "Fuel Flow Rate", "Nm³/h"],
                  ["fuelPressure_kPa", "Fuel Pressure", "kPa"],
                  ["fuelTemp_C", "Fuel Temperature", "°C"],
                ].map(([field, label, unit]) => (
                  <div key={field} className="flex items-center gap-2">
                    <Label className="w-32 shrink-0">{label}</Label>
                    <Input
                      type="number"
                      step="any"
                      value={inputs[field as keyof FuelInputs] as number}
                      onChange={(e) =>
                        update(
                          field as keyof FuelInputs,
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                    <span className="w-14 text-sm text-muted-foreground">
                      {unit}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setStep(1)}>
              Next: SOFC & Reformer <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: SOFC & Reformer Config */}
      {step === 1 && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  SOFC Target Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {[
                  ["SOFC_power_kW", "Target Power", "kW"],
                  ["SOFC_fuelUtilization", "Fuel Utilization", "(0–1)"],
                  ["SOFC_operatingTemp_C", "Stack Temperature", "°C"],
                  ["SOFC_currentDensity_A_cm2", "Current Density", "A/cm²"],
                ].map(([field, label, unit]) => (
                  <div key={field} className="flex items-center gap-2">
                    <Label className="w-36 shrink-0">{label}</Label>
                    <Input
                      type="number"
                      step="any"
                      value={inputs[field as keyof FuelInputs] as number}
                      onChange={(e) =>
                        update(
                          field as keyof FuelInputs,
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                    <span className="w-14 text-sm text-muted-foreground">
                      {unit}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Reforming Strategy
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div>
                  <Label>Strategy</Label>
                  <Select
                    value={inputs.reformingStrategy}
                    onValueChange={(v) => update("reformingStrategy", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SMR">
                        SMR — Steam Methane Reforming
                      </SelectItem>
                      <SelectItem value="POX">
                        POX — Partial Oxidation
                      </SelectItem>
                      <SelectItem value="ATR">
                        ATR — Autothermal Reforming
                      </SelectItem>
                      <SelectItem value="internal">
                        Internal Reforming (at SOFC)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-36 shrink-0">S/C Ratio</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={inputs.steamToCarbonRatio}
                    onChange={(e) =>
                      update(
                        "steamToCarbonRatio",
                        parseFloat(e.target.value) || 0
                      )
                    }
                  />
                  <span className="w-14 text-sm text-muted-foreground">
                    mol/mol
                  </span>
                </div>
                {(inputs.reformingStrategy === "POX" ||
                  inputs.reformingStrategy === "ATR") && (
                  <div className="flex items-center gap-2">
                    <Label className="w-36 shrink-0">O/C Ratio</Label>
                    <Input
                      type="number"
                      step="0.05"
                      value={inputs.oxygenToCarbonRatio ?? 0}
                      onChange={(e) =>
                        update(
                          "oxygenToCarbonRatio",
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                    <span className="w-14 text-sm text-muted-foreground">
                      mol/mol
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Label className="w-36 shrink-0">Target CH₄/CO</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={inputs.targetCH4_CO_ratio ?? ""}
                    placeholder="Auto"
                    onChange={(e) =>
                      update(
                        "targetCH4_CO_ratio",
                        e.target.value ? parseFloat(e.target.value) : 0
                      )
                    }
                  />
                  <span className="w-14 text-sm text-muted-foreground">
                    ratio
                  </span>
                </div>

                <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                  {inputs.reformingStrategy === "SMR" && (
                    <p>
                      <strong>SMR:</strong> CH₄ + H₂O ⇌ CO + 3H₂ (endothermic,
                      +206 kJ/mol). Requires external heat. Highest H₂ yield.
                    </p>
                  )}
                  {inputs.reformingStrategy === "POX" && (
                    <p>
                      <strong>POX:</strong> CH₄ + ½O₂ → CO + 2H₂ (exothermic,
                      −36 kJ/mol). Self-heating but lower H₂ yield. Requires O/C
                      ratio 0.5–0.6.
                    </p>
                  )}
                  {inputs.reformingStrategy === "ATR" && (
                    <p>
                      <strong>ATR:</strong> Combines SMR + POX for near-neutral
                      heat balance. S/C=1–2, O/C=0.3–0.5.
                    </p>
                  )}
                  {inputs.reformingStrategy === "internal" && (
                    <p>
                      <strong>Internal:</strong> Reforming occurs directly on the
                      SOFC Ni-YSZ anode. Simplest system but risk of thermal
                      gradients and carbon deposition.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(0)}>
              <ChevronLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button onClick={calculate} disabled={calculating}>
              {calculating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="mr-2 h-4 w-4" />
              )}
              Calculate Sizing
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 2 && result && (
        <div className="flex flex-col gap-6">
          {/* Warnings */}
          {result.warnings.length > 0 && (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardContent className="pt-6">
                <div className="flex flex-col gap-2">
                  {result.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <p className="text-sm">{w}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Key metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>CH₄/CO Ratio</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-mono">
                  {result.CH4_CO_ratio < 100
                    ? result.CH4_CO_ratio.toFixed(3)
                    : "∞"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>H₂/CO Ratio</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-mono">
                  {result.H2_CO_ratio < 100
                    ? result.H2_CO_ratio.toFixed(2)
                    : "∞"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>CH₄ Conversion</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-mono">
                  {result.CH4_conversion_percent.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>H₂ Production</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-mono">
                  {result.H2_production_Nm3_h.toFixed(1)} Nm³/h
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Carbon Risk</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge
                  variant={
                    result.carbonFormationRisk === "low"
                      ? "default"
                      : result.carbonFormationRisk === "moderate"
                        ? "secondary"
                        : "destructive"
                  }
                  className="text-base"
                >
                  {result.carbonFormationRisk === "low" && "Low"}
                  {result.carbonFormationRisk === "moderate" && "Moderate"}
                  {result.carbonFormationRisk === "high" && "HIGH"}
                </Badge>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="composition">
            <TabsList>
              <TabsTrigger value="composition">Reformate</TabsTrigger>
              <TabsTrigger value="equilibrium">Equilibrium</TabsTrigger>
              <TabsTrigger value="beds">Catalyst Beds</TabsTrigger>
              <TabsTrigger value="heat">Heat Balance</TabsTrigger>
              <TabsTrigger value="carbon">Carbon Boundary</TabsTrigger>
              <TabsTrigger value="conversion">CO/CH₄ Conversion</TabsTrigger>
              <TabsTrigger value="h2prod">H₂ Production</TabsTrigger>
            </TabsList>

            {/* Reformate composition */}
            <TabsContent value="composition" className="mt-4">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Reformate Composition (dry basis)
                    </CardTitle>
                    <CardDescription>
                      At reformer outlet: {result.reformerOutletTemp_C}°C,{" "}
                      {result.reformerPressure_kPa} kPa
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3">
                      {[
                        ["H₂", result.reformateComposition.H2_percent, "hsl(var(--chart-1))"],
                        ["CO", result.reformateComposition.CO_percent, "hsl(var(--chart-2))"],
                        ["CO₂", result.reformateComposition.CO2_percent, "hsl(var(--chart-3))"],
                        ["CH₄", result.reformateComposition.CH4_percent, "hsl(var(--chart-4))"],
                        ["N₂", result.reformateComposition.N2_percent, "hsl(var(--chart-5))"],
                      ].map(([name, value, color]) => (
                        <div key={name as string} className="flex items-center gap-3">
                          <span className="w-10 text-sm font-medium">
                            {name as string}
                          </span>
                          <div className="flex-1 h-6 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, value as number)}%`,
                                backgroundColor: color as string,
                              }}
                            />
                          </div>
                          <span className="w-16 text-right font-mono text-sm">
                            {(value as number).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      SOFC Feed Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <dt className="text-muted-foreground">
                          SOFC Fuel Flow
                        </dt>
                        <dd className="font-mono font-medium">
                          {result.SOFC_fuelFlow_Nm3_h.toFixed(2)} Nm³/h
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          Est. SOFC Power
                        </dt>
                        <dd className="font-mono font-medium">
                          {result.SOFC_estimatedPower_kW.toFixed(1)} kW
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          System Efficiency
                        </dt>
                        <dd className="font-mono font-medium">
                          {result.systemEfficiency_percent.toFixed(1)}% (LHV)
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          H₂ Yield
                        </dt>
                        <dd className="font-mono font-medium">
                          {result.H2_yield_mol_per_mol_CH4.toFixed(2)}{" "}
                          mol H₂/mol CH₄
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          Min S/C (no carbon)
                        </dt>
                        <dd className="font-mono font-medium">
                          {result.minimumSCRatio_noCarbon.toFixed(1)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Strategy</dt>
                        <dd className="font-mono font-medium">
                          {result.reformingStrategy}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Equilibrium diagram */}
            <TabsContent value="equilibrium" className="mt-4">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Equilibrium Composition vs Temperature
                    </CardTitle>
                    <CardDescription>
                      S/C = {inputs.steamToCarbonRatio}, P ={" "}
                      {inputs.fuelPressure_kPa} kPa
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={equilibriumData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="temp_C"
                          label={{
                            value: "Temperature [°C]",
                            position: "insideBottom",
                            offset: -5,
                          }}
                        />
                        <YAxis
                          label={{
                            value: "mol%",
                            angle: -90,
                            position: "insideLeft",
                          }}
                        />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="H2"
                          name="H₂"
                          stroke="hsl(var(--chart-1))"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="CO"
                          name="CO"
                          stroke="hsl(var(--chart-2))"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="CO2"
                          name="CO₂"
                          stroke="hsl(var(--chart-3))"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="CH4"
                          name="CH₄"
                          stroke="hsl(var(--chart-4))"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="H2O"
                          name="H₂O"
                          stroke="hsl(var(--chart-5))"
                          strokeWidth={2}
                          dot={false}
                          strokeDasharray="5 5"
                        />
                        <ReferenceLine
                          x={result.reformerOutletTemp_C}
                          stroke="red"
                          strokeDasharray="3 3"
                          label="Outlet"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      CH₄/CO Ratio vs Temperature
                    </CardTitle>
                    <CardDescription>
                      Shows how reformer outlet temperature controls the
                      CH₄/CO ratio
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={equilibriumData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="temp_C"
                          label={{
                            value: "Temperature [°C]",
                            position: "insideBottom",
                            offset: -5,
                          }}
                        />
                        <YAxis
                          scale="log"
                          domain={[0.001, 100]}
                          label={{
                            value: "CH₄/CO ratio",
                            angle: -90,
                            position: "insideLeft",
                          }}
                        />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="CH4_CO"
                          name="CH₄/CO"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={false}
                        />
                        <ReferenceLine
                          x={result.reformerOutletTemp_C}
                          stroke="red"
                          strokeDasharray="3 3"
                          label="Outlet"
                        />
                        <ReferenceLine
                          y={1.0}
                          stroke="hsl(var(--muted-foreground))"
                          strokeDasharray="5 5"
                          label="CH₄/CO = 1"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Catalyst beds */}
            <TabsContent value="beds" className="mt-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stage</TableHead>
                      <TableHead>Catalyst</TableHead>
                      <TableHead>GHSV [h⁻¹]</TableHead>
                      <TableHead>Volume [L]</TableHead>
                      <TableHead>Diameter [mm]</TableHead>
                      <TableHead>Length [mm]</TableHead>
                      <TableHead>Weight [kg]</TableHead>
                      <TableHead>ΔP [kPa]</TableHead>
                      <TableHead>T_in [°C]</TableHead>
                      <TableHead>T_out [°C]</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.catalystBeds.map((bed, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Badge variant="outline">{bed.stage}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {bed.catalystType}
                        </TableCell>
                        <TableCell className="font-mono">
                          {bed.GHSV.toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono">
                          {bed.volume_L.toFixed(1)}
                        </TableCell>
                        <TableCell className="font-mono">
                          {bed.diameter_mm}
                        </TableCell>
                        <TableCell className="font-mono">
                          {bed.length_mm}
                        </TableCell>
                        <TableCell className="font-mono">
                          {bed.weight_kg.toFixed(1)}
                        </TableCell>
                        <TableCell className="font-mono">
                          {bed.pressureDrop_kPa.toFixed(2)}
                        </TableCell>
                        <TableCell className="font-mono">
                          {bed.inletTemp_C}
                        </TableCell>
                        <TableCell className="font-mono">
                          {bed.outletTemp_C}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Heat balance */}
            <TabsContent value="heat" className="mt-4">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Heat Balance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={[
                          {
                            name: "Reformer",
                            value: result.reformerHeatDuty_kW,
                            fill:
                              result.reformerHeatDuty_kW > 0
                                ? "hsl(var(--destructive))"
                                : "hsl(var(--chart-1))",
                          },
                          {
                            name: "WGS",
                            value: -result.WGS_heatRelease_kW,
                            fill: "hsl(var(--chart-1))",
                          },
                          {
                            name: "Net",
                            value: result.netHeatDuty_kW,
                            fill:
                              result.netHeatDuty_kW > 0
                                ? "hsl(var(--destructive))"
                                : "hsl(var(--chart-1))",
                          },
                        ]}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          label={{
                            value: "Heat Duty [kW]",
                            position: "insideBottom",
                            offset: -5,
                          }}
                        />
                        <YAxis type="category" dataKey="name" width={80} />
                        <Tooltip
                          formatter={(value: number) => [
                            `${value.toFixed(1)} kW`,
                            value > 0 ? "Heat Required" : "Heat Released",
                          ]}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                        <ReferenceLine x={0} stroke="hsl(var(--foreground))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Heat Duty Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid gap-4 text-sm">
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                          <Flame className="h-4 w-4 text-red-500" />
                          <span>Reformer Heat Duty</span>
                        </div>
                        <span className="font-mono font-bold">
                          {result.reformerHeatDuty_kW > 0 ? "+" : ""}
                          {result.reformerHeatDuty_kW.toFixed(1)} kW
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                          <Snowflake className="h-4 w-4 text-blue-500" />
                          <span>WGS Heat Release</span>
                        </div>
                        <span className="font-mono font-bold">
                          −{result.WGS_heatRelease_kW.toFixed(1)} kW
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border-2 border-primary p-3">
                        <span className="font-medium">Net Heat Duty</span>
                        <span className="font-mono font-bold text-lg">
                          {result.netHeatDuty_kW > 0 ? "+" : ""}
                          {result.netHeatDuty_kW.toFixed(1)} kW
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs mt-2">
                        {result.netHeatDuty_kW > 0
                          ? "Positive = endothermic system, external heat required (e.g., SOFC exhaust heat, burner)"
                          : "Negative = exothermic system, excess heat available for steam generation or SOFC preheating"}
                      </p>
                    </dl>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Carbon boundary */}
            <TabsContent value="carbon" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Carbon Formation Boundary
                  </CardTitle>
                  <CardDescription>
                    Green = safe operating region (no carbon deposition). Red =
                    carbon formation predicted. Your operating point is marked.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="temp_C"
                        type="number"
                        name="Temperature"
                        unit="°C"
                        domain={[400, 1000]}
                        label={{
                          value: "Temperature [°C]",
                          position: "insideBottom",
                          offset: -5,
                        }}
                      />
                      <YAxis
                        dataKey="SC"
                        type="number"
                        name="S/C Ratio"
                        domain={[0.5, 5]}
                        label={{
                          value: "S/C Ratio",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <ZAxis dataKey="safe" range={[20, 20]} />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === "safe")
                            return [value ? "Safe" : "Carbon!", "Status"];
                          return [value, name];
                        }}
                      />
                      <Scatter
                        name="Safe"
                        data={carbonBoundaryData.filter((d) => d.safe)}
                        fill="hsl(142, 76%, 36%)"
                        opacity={0.3}
                      />
                      <Scatter
                        name="Carbon Risk"
                        data={carbonBoundaryData.filter((d) => !d.safe)}
                        fill="hsl(0, 84%, 60%)"
                        opacity={0.3}
                      />
                      <Scatter
                        name="Operating Point"
                        data={[
                          {
                            temp_C: result.reformerOutletTemp_C,
                            SC: inputs.steamToCarbonRatio,
                            safe: result.carbonFormationRisk === "low" ? 1 : 0,
                          },
                        ]}
                        fill="hsl(var(--primary))"
                        shape="star"
                      />
                      <Legend />
                    </ScatterChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* CO/CH₄ Conversion vs Temperature */}
            <TabsContent value="conversion" className="mt-4">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">CH₄ Conversion vs. Temperature</CardTitle>
                    <CardDescription>
                      Equilibrium CH₄ conversion at S/C = {inputs.steamToCarbonRatio}, P = {inputs.fuelPressure_kPa} kPa
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={equilibriumData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="temp_C" label={{ value: "Temperature [°C]", position: "insideBottom", offset: -5 }} />
                        <YAxis domain={[0, 100]} label={{ value: "CH₄ Conversion [%]", angle: -90, position: "insideLeft" }} />
                        <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                        <Line type="monotone" dataKey="conversion" stroke="hsl(var(--chart-1))" strokeWidth={2.5} dot={false} name="CH₄ Conversion" />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm">
                      <p>At reformer outlet ({result.reformerOutletTemp_C}°C): <span className="font-mono font-bold">{result.CH4_conversion_percent.toFixed(1)}%</span> CH₄ conversion</p>
                      <p className="text-muted-foreground mt-1">Higher temperature → higher conversion (endothermic SMR). Above 800°C, conversion exceeds 95% at S/C ≥ 2.5.</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">CO vs. CO₂ Selectivity</CardTitle>
                    <CardDescription>WGS equilibrium shifts CO/CO₂ ratio with temperature</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={equilibriumData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="temp_C" label={{ value: "Temperature [°C]", position: "insideBottom", offset: -5 }} />
                        <YAxis label={{ value: "mol%", angle: -90, position: "insideLeft" }} />
                        <Tooltip formatter={(v: number) => `${v.toFixed(2)} mol%`} />
                        <Legend />
                        <Line type="monotone" dataKey="CO" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} name="CO" />
                        <Line type="monotone" dataKey="CO2" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} name="CO₂" />
                        <Line type="monotone" dataKey="CH4" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} name="CH₄ (residual)" />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm">
                      <p className="text-muted-foreground">
                        At low T: WGS favors CO₂ + H₂ (more H₂, less CO).
                        At high T: WGS reverses, more CO in reformate.
                        CH₄/CO ratio = <span className="font-mono font-bold">{result.CH4_CO_ratio.toFixed(2)}</span> at outlet.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* H₂ Production */}
            <TabsContent value="h2prod" className="mt-4">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">H₂ Production vs. Temperature</CardTitle>
                    <CardDescription>Equilibrium H₂ yield across temperature range</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={equilibriumData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="temp_C" label={{ value: "Temperature [°C]", position: "insideBottom", offset: -5 }} />
                        <YAxis label={{ value: "H₂ [mol%]", angle: -90, position: "insideLeft" }} />
                        <Tooltip formatter={(v: number) => `${v.toFixed(2)} mol%`} />
                        <Line type="monotone" dataKey="H2" stroke="hsl(var(--chart-1))" strokeWidth={2.5} dot={false} name="H₂" />
                        <Line type="monotone" dataKey="H2O" stroke="hsl(var(--chart-5))" strokeWidth={1.5} dot={false} name="H₂O" strokeDasharray="5 5" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">H₂ Production Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3">
                      {[
                        ["H₂ Production Rate", `${result.H2_production_Nm3_h.toFixed(2)} Nm³/h`],
                        ["H₂ Yield", `${result.H2_yield_mol_per_mol_CH4.toFixed(2)} mol H₂ / mol CH₄`],
                        ["Theoretical Max (SMR+WGS)", "4.0 mol H₂ / mol CH₄"],
                        ["Yield Efficiency", `${(result.H2_yield_mol_per_mol_CH4 / 4.0 * 100).toFixed(1)}%`],
                        ["H₂/CO Ratio", result.H2_CO_ratio.toFixed(2)],
                        ["CH₄ Conversion", `${result.CH4_conversion_percent.toFixed(1)}%`],
                        ["SOFC Estimated Power", `${result.SOFC_estimatedPower_kW.toFixed(1)} kW`],
                        ["System Efficiency (LHV)", `${result.systemEfficiency_percent.toFixed(1)}%`],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between rounded-lg border p-3">
                          <span className="text-sm">{label}</span>
                          <span className="font-mono font-medium">{value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">Net H₂ to SOFC</span>
                        <span className="text-2xl font-bold font-mono">{result.H2_production_Nm3_h.toFixed(2)} Nm³/h</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(100, result.H2_yield_mol_per_mol_CH4 / 4.0 * 100)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {(result.H2_yield_mol_per_mol_CH4 / 4.0 * 100).toFixed(0)}% of theoretical maximum yield
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="mr-2 h-4 w-4" /> Modify Parameters
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
