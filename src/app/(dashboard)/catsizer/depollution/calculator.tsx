"use client";

import { useState, useCallback } from "react";
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
} from "recharts";
import type {
  EngineInputs,
  CatalystChainElement,
  DepollutionSizingResult,
  EmissionStandard,
  CatalystType,
} from "@/lib/catsizer/types";
import {
  ENGINE_PRESETS,
  EMISSION_STANDARDS,
} from "@/lib/catsizer/constants";
import { sizeDepollutionSystem } from "@/lib/catsizer/depollution-engine";

const STEPS = [
  "Engine Input",
  "Emission Target",
  "Catalyst Chain",
  "Results",
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
  { type: "SCR", enabled: true },
  { type: "ASC", enabled: true },
];

export function DepollutionCalculator() {
  const [step, setStep] = useState(0);
  const [engineInputs, setEngineInputs] = useState<EngineInputs>(DEFAULT_ENGINE);
  const [standard, setStandard] = useState<EmissionStandard>("euro_vi_e");
  const [chain, setChain] = useState<CatalystChainElement[]>(DEFAULT_CHAIN);
  const [result, setResult] = useState<DepollutionSizingResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  const { register, setValue, watch } = useForm<EngineInputs>({
    defaultValues: DEFAULT_ENGINE,
  });

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
      prev.map((c, i) =>
        i === index ? { ...c, enabled: !c.enabled } : c
      )
    );
  };

  const calculate = useCallback(() => {
    setCalculating(true);
    setTimeout(() => {
      const res = sizeDepollutionSystem(engineInputs, chain, standard);
      setResult(res);
      setCalculating(false);
      setStep(3);
    }, 100);
  }, [engineInputs, chain, standard]);

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => i <= step ? setStep(i) : undefined}
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

      {/* Step 1: Engine Input */}
      {step === 0 && (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Engine Presets</CardTitle>
              <CardDescription>
                Select a preset or enter custom values below
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {ENGINE_PRESETS.map((p, i) => (
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
                <CardTitle className="text-base">Engine Identity</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Engine Type</Label>
                    <Select
                      value={engineInputs.engineType}
                      onValueChange={(v) => updateEngine("engineType", v)}
                    >
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
                    <Select
                      value={engineInputs.application}
                      onValueChange={(v) => updateEngine("application", v)}
                    >
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
                {[
                  ["displacement_L", "Displacement", "L"],
                  ["ratedPower_kW", "Rated Power", "kW"],
                  ["ratedSpeed_rpm", "Rated Speed", "rpm"],
                  ["peakTorque_Nm", "Peak Torque", "Nm"],
                  ["numberOfCylinders", "Cylinders", ""],
                ].map(([field, label, unit]) => (
                  <div key={field} className="flex items-center gap-2">
                    <Label className="w-36 shrink-0">{label}</Label>
                    <Input
                      type="number"
                      value={engineInputs[field as keyof EngineInputs] as number}
                      onChange={(e) =>
                        updateEngine(
                          field as keyof EngineInputs,
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                    {unit && (
                      <span className="w-12 text-sm text-muted-foreground">
                        {unit}
                      </span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Operating Conditions
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {[
                  ["exhaustFlowRate_kg_h", "Exhaust Flow", "kg/h"],
                  ["exhaustTemp_C", "Exhaust Temp", "°C"],
                  ["exhaustPressure_kPa", "Exhaust Pressure", "kPa"],
                  ["ambientTemp_C", "Ambient Temp", "°C"],
                  ["altitude_m", "Altitude", "m"],
                ].map(([field, label, unit]) => (
                  <div key={field} className="flex items-center gap-2">
                    <Label className="w-36 shrink-0">{label}</Label>
                    <Input
                      type="number"
                      value={engineInputs[field as keyof EngineInputs] as number}
                      onChange={(e) =>
                        updateEngine(
                          field as keyof EngineInputs,
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                    <span className="w-12 text-sm text-muted-foreground">
                      {unit}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">
                  Raw Exhaust Composition
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["CO_ppm", "CO", "ppm"],
                    ["HC_ppm", "HC (C1 eq.)", "ppm"],
                    ["NOx_ppm", "NOₓ", "ppm"],
                    ["NO2_fraction", "NO₂/NOₓ", "ratio"],
                    ["PM_mg_Nm3", "PM", "mg/Nm³"],
                    ["SO2_ppm", "SO₂", "ppm"],
                    ["O2_percent", "O₂", "vol%"],
                    ["H2O_percent", "H₂O", "vol%"],
                    ["CO2_percent", "CO₂", "vol%"],
                  ].map(([field, label, unit]) => (
                    <div key={field} className="flex items-center gap-2">
                      <Label className="w-28 shrink-0">{label}</Label>
                      <Input
                        type="number"
                        step="any"
                        value={engineInputs[field as keyof EngineInputs] as number}
                        onChange={(e) =>
                          updateEngine(
                            field as keyof EngineInputs,
                            parseFloat(e.target.value) || 0
                          )
                        }
                      />
                      <span className="w-16 text-sm text-muted-foreground">
                        {unit}
                      </span>
                    </div>
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

      {/* Step 2: Emission Standard */}
      {step === 1 && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(
              Object.entries(EMISSION_STANDARDS) as [
                EmissionStandard,
                (typeof EMISSION_STANDARDS)[EmissionStandard],
              ][]
            ).map(([key, limits]) => (
              <Card
                key={key}
                className={`cursor-pointer transition-colors ${
                  standard === key
                    ? "border-primary ring-2 ring-primary/20"
                    : "hover:border-primary/50"
                }`}
                onClick={() => setStandard(key)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {key.replace(/_/g, " ").toUpperCase()}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-1 text-sm">
                    {limits.NOx_g_kWh != null && (
                      <span>NOₓ: {limits.NOx_g_kWh} g/kWh</span>
                    )}
                    {limits.PM_g_kWh != null && (
                      <span>PM: {limits.PM_g_kWh} g/kWh</span>
                    )}
                    {limits.CO_g_kWh != null && (
                      <span>CO: {limits.CO_g_kWh} g/kWh</span>
                    )}
                    {limits.HC_g_kWh != null && (
                      <span>HC: {limits.HC_g_kWh} g/kWh</span>
                    )}
                    {limits.NOx_g_Nm3 != null && (
                      <span>NOₓ: {limits.NOx_g_Nm3} g/Nm³</span>
                    )}
                    {limits.CO_g_Nm3 != null && (
                      <span>CO: {limits.CO_g_Nm3} g/Nm³</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
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

      {/* Step 3: Catalyst Chain */}
      {step === 2 && (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Aftertreatment Chain Configuration</CardTitle>
              <CardDescription>
                Toggle catalysts on/off. The chain processes exhaust left to
                right.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="rounded-lg border border-dashed bg-muted/50 px-4 py-3 text-sm font-medium">
                  Engine
                </div>
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
                    {i < chain.length - 1 && (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                ))}
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                <div className="rounded-lg border border-dashed bg-muted/50 px-4 py-3 text-sm font-medium">
                  Tailpipe
                </div>
              </div>
            </CardContent>
          </Card>

          {engineInputs.engineType === "natural_gas" && (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardContent className="flex items-center gap-3 pt-6">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <p className="text-sm">
                  For stoichiometric natural gas engines, consider using TWC
                  instead of DOC+SCR. Toggle off DOC/DPF/SCR and enable TWC.
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

      {/* Step 4: Results */}
      {step === 3 && result && (
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

          {/* System summary */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Pressure Drop</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {result.totalPressureDrop_kPa.toFixed(2)} kPa
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Weight</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {result.totalWeight_kg.toFixed(1)} kg
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Length</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {result.totalLength_mm} mm
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Exhaust Flow (STP)</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {result.exhaustFlowRate_Nm3_h.toFixed(0)} Nm³/h
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="sizing">
            <TabsList>
              <TabsTrigger value="sizing">Catalyst Sizing</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="pressure">Pressure Drop</TabsTrigger>
            </TabsList>

            <TabsContent value="sizing" className="mt-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Catalyst</TableHead>
                      <TableHead>Volume [L]</TableHead>
                      <TableHead>Diameter [mm]</TableHead>
                      <TableHead>Length [mm]</TableHead>
                      <TableHead>Substrates</TableHead>
                      <TableHead>Cell Density</TableHead>
                      <TableHead>GHSV [h⁻¹]</TableHead>
                      <TableHead>ΔP [kPa]</TableHead>
                      <TableHead>Conv. [%]</TableHead>
                      <TableHead>Weight [kg]</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.catalysts.map((cat) => (
                      <TableRow key={cat.type}>
                        <TableCell>
                          <Badge>{cat.type}</Badge>
                        </TableCell>
                        <TableCell className="font-mono">
                          {cat.selectedVolume_L.toFixed(1)}
                        </TableCell>
                        <TableCell className="font-mono">
                          {cat.diameter_mm}
                        </TableCell>
                        <TableCell className="font-mono">
                          {cat.length_mm}
                        </TableCell>
                        <TableCell className="font-mono">
                          {cat.numberOfSubstrates}
                        </TableCell>
                        <TableCell className="font-mono">
                          {cat.cellDensity_cpsi} cpsi / {cat.wallThickness_mil} mil
                        </TableCell>
                        <TableCell className="font-mono">
                          {cat.GHSV_design.toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono">
                          {cat.pressureDrop_kPa.toFixed(2)}
                        </TableCell>
                        <TableCell className="font-mono">
                          {cat.expectedConversion_percent.toFixed(0)}%
                        </TableCell>
                        <TableCell className="font-mono">
                          {cat.weight_kg.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="compliance" className="mt-4">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Emission Compliance — {result.compliance.standard.replace(/_/g, " ").toUpperCase()}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3">
                      {[
                        ["NOₓ", result.compliance.NOx_compliant, result.compliance.tailpipeNOx_g_kWh, EMISSION_STANDARDS[standard].NOx_g_kWh],
                        ["PM", result.compliance.PM_compliant, result.compliance.tailpipePM_g_kWh, EMISSION_STANDARDS[standard].PM_g_kWh],
                        ["CO", result.compliance.CO_compliant, result.compliance.tailpipeCO_g_kWh, EMISSION_STANDARDS[standard].CO_g_kWh],
                        ["HC", result.compliance.HC_compliant, result.compliance.tailpipeHC_g_kWh, EMISSION_STANDARDS[standard].HC_g_kWh],
                      ].map(([name, compliant, actual, limit]) => (
                        <div
                          key={name as string}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div className="flex items-center gap-2">
                            {compliant ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                            <span className="font-medium">{name as string}</span>
                          </div>
                          <div className="text-right text-sm">
                            <span className="font-mono">
                              {(actual as number).toFixed(3)}
                            </span>
                            {limit != null && (
                              <span className="text-muted-foreground">
                                {" "}/ {(limit as number).toFixed(3)} g/kWh
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Compliance Radar
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart
                        data={[
                          {
                            pollutant: "NOₓ",
                            actual: result.compliance.tailpipeNOx_g_kWh,
                            limit: EMISSION_STANDARDS[standard].NOx_g_kWh ?? 0,
                          },
                          {
                            pollutant: "PM",
                            actual: result.compliance.tailpipePM_g_kWh * 100,
                            limit: (EMISSION_STANDARDS[standard].PM_g_kWh ?? 0) * 100,
                          },
                          {
                            pollutant: "CO",
                            actual: result.compliance.tailpipeCO_g_kWh,
                            limit: EMISSION_STANDARDS[standard].CO_g_kWh ?? 0,
                          },
                          {
                            pollutant: "HC",
                            actual: result.compliance.tailpipeHC_g_kWh,
                            limit: EMISSION_STANDARDS[standard].HC_g_kWh ?? 0,
                          },
                        ]}
                      >
                        <PolarGrid />
                        <PolarAngleAxis dataKey="pollutant" />
                        <PolarRadiusAxis />
                        <Radar
                          name="Limit"
                          dataKey="limit"
                          stroke="hsl(var(--destructive))"
                          fill="hsl(var(--destructive))"
                          fillOpacity={0.1}
                          strokeDasharray="5 5"
                        />
                        <Radar
                          name="Actual"
                          dataKey="actual"
                          stroke="hsl(var(--primary))"
                          fill="hsl(var(--primary))"
                          fillOpacity={0.3}
                        />
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="pressure" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Pressure Drop Waterfall
                  </CardTitle>
                  <CardDescription>
                    Contribution of each catalyst element to total system
                    backpressure
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart
                      data={result.catalysts.map((c) => ({
                        name: c.type,
                        pressureDrop: parseFloat(
                          c.pressureDrop_kPa.toFixed(3)
                        ),
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis
                        label={{
                          value: "ΔP [kPa]",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          `${value} kPa`,
                          "Pressure Drop",
                        ]}
                      />
                      <Bar
                        dataKey="pressureDrop"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ChevronLeft className="mr-2 h-4 w-4" /> Modify Chain
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
