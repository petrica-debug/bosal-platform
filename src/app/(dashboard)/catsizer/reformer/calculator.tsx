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
  Thermometer,
  Battery,
  Gauge,
  Droplets,
  Shield,
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
  Area,
  AreaChart,
  ComposedChart,
} from "recharts";
import type {
  FuelInputs,
  ReformerSizingResult,
} from "@/lib/catsizer/types";
import { FUEL_PRESETS, REFORMER_CATALYSTS, REFORMER_GHSV } from "@/lib/catsizer/constants";
import { sizeReformerSystem, type ReformerCatalystSelections } from "@/lib/catsizer/reformer-engine";
import { equilibriumSweep } from "@/lib/catsizer/thermodynamics";
import { reformerFeedComposition } from "@/lib/catsizer/gas-properties";
import { UNITS } from "@/lib/catsizer/units";
import {
  sizeSOFCStack,
  sofcParametricSweep,
  systemHeatIntegration,
  reformerReactorProfile,
  SOFC_MATERIALS_DEFAULT,
  type SOFCStackResult,
  type SOFCStackConfig,
  type HeatIntegrationResult,
  type ReactorProfilePoint,
  type SOFCMaterials,
} from "@/lib/catsizer/sofc-model";

const STEPS = [
  "Fuel Input",
  "Reformer Design",
  "SOFC Stack",
  "Calculate",
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

function NumField({ label, value, unit, onChange, step }: {
  label: string; value: number; unit?: string; onChange: (v: number) => void; step?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="w-40 shrink-0 text-sm">{label}</Label>
      <Input type="number" step={step ?? "any"} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="font-mono" />
      {unit && <span className="w-16 shrink-0 text-xs text-muted-foreground">{unit}</span>}
    </div>
  );
}

export function ReformerCalculator() {
  const [step, setStep] = useState(0);
  const [inputs, setInputs] = useState<FuelInputs>(DEFAULT_FUEL);
  const [result, setResult] = useState<ReformerSizingResult | null>(null);
  const [sofcResult, setSofcResult] = useState<SOFCStackResult | null>(null);
  const [heatResult, setHeatResult] = useState<HeatIntegrationResult | null>(null);
  const [reactorProfile, setReactorProfile] = useState<ReactorProfilePoint[]>([]);
  const [calculating, setCalculating] = useState(false);

  // Catalyst selections
  const [catalystSelections, setCatalystSelections] = useState<ReformerCatalystSelections>({
    mainReformer: "SMR_Ni",
    preReformer: "pre_reformer",
    htWGS: "HT_WGS",
    ltWGS: "LT_WGS",
  });

  // SOFC materials config
  const [sofcMaterials, setSofcMaterials] = useState<SOFCMaterials>(SOFC_MATERIALS_DEFAULT);
  const [cellArea, setCellArea] = useState(100);

  const fuelSum = useMemo(() =>
    inputs.CH4_percent + inputs.C2H6_percent + inputs.C3H8_percent +
    inputs.CO2_percent + inputs.N2_percent, [inputs]);

  const update = (field: keyof FuelInputs, value: string | number) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  const applyPreset = (index: number) => {
    const preset = FUEL_PRESETS[index];
    setInputs((prev) => ({ ...prev, ...preset.inputs }));
  };

  const calculate = useCallback(async () => {
    setCalculating(true);
    try {
      // 1. Reformer sizing
      const res = await sizeReformerSystem(inputs, catalystSelections);
      setResult(res);

      // 2. SOFC stack sizing
      const reformateComp: Record<string, number> = {
        H2: res.reformateComposition.H2_percent / 100,
        CO: res.reformateComposition.CO_percent / 100,
        CO2: res.reformateComposition.CO2_percent / 100,
        CH4: res.reformateComposition.CH4_percent / 100,
        H2O: res.reformateComposition.H2O_percent / 100,
        N2: res.reformateComposition.N2_percent / 100,
      };

      const stackConfig: SOFCStackConfig = {
        cellActiveArea_cm2: cellArea,
        operatingTemp_C: inputs.SOFC_operatingTemp_C,
        operatingPressure_atm: inputs.fuelPressure_kPa / 101.325,
        currentDensity_A_cm2: inputs.SOFC_currentDensity_A_cm2,
        fuelUtilization: inputs.SOFC_fuelUtilization,
        materials: sofcMaterials,
      };

      const sofc = sizeSOFCStack(inputs.SOFC_power_kW, reformateComp, stackConfig);
      setSofcResult(sofc);

      // 3. Heat integration
      const heat = systemHeatIntegration(
        res.reformerHeatDuty_kW, res.WGS_heatRelease_kW,
        sofc.heatGeneration_kW, sofc.targetPower_kW,
        res.reformerOutletTemp_C, inputs.SOFC_operatingTemp_C,
        inputs.fuelFlowRate_Nm3_h, inputs.steamToCarbonRatio
      );
      setHeatResult(heat);

      // 4. Reactor profile
      const mainBed = res.catalystBeds.find((b) =>
        b.stage === "main_reformer" || b.stage === "SMR" || b.stage === "ATR" || b.stage === "POX"
      );
      const ghsv = mainBed?.GHSV ?? 5000;
      const profile = reformerReactorProfile(
        res.reformerInletTemp_C, res.reformerOutletTemp_C,
        inputs.fuelPressure_kPa, inputs.steamToCarbonRatio, ghsv, 40
      );
      setReactorProfile(profile);

      setStep(4);
    } catch (e) {
      console.error(e);
    } finally {
      setCalculating(false);
    }
  }, [inputs, sofcMaterials, cellArea, catalystSelections]);

  // Equilibrium sweep data
  const [equilibriumData, setEquilibriumData] = useState<Record<string, number>[]>([]);

  // We must fetch equilibriumData asynchronously when result/inputs change
  useMemo(() => {
    if (!result) {
      setEquilibriumData([]);
      return;
    }
    const feed = reformerFeedComposition({
      CH4_percent: inputs.CH4_percent, C2H6_percent: inputs.C2H6_percent,
      C3H8_percent: inputs.C3H8_percent, CO2_percent: inputs.CO2_percent,
      N2_percent: inputs.N2_percent, steamToCarbonRatio: inputs.steamToCarbonRatio,
      oxygenToCarbonRatio: inputs.oxygenToCarbonRatio,
    });

    equilibriumSweep(UNITS.C_to_K(400), UNITS.C_to_K(1000), 40, inputs.fuelPressure_kPa, feed)
      .then(res => {
        setEquilibriumData(res.map((pt) => ({
          temp_C: Math.round(UNITS.K_to_C(pt.temperature_K)),
          H2: +((pt.composition.H2 ?? 0) * 100).toFixed(2),
          CO: +((pt.composition.CO ?? 0) * 100).toFixed(2),
          CO2: +((pt.composition.CO2 ?? 0) * 100).toFixed(2),
          CH4: +((pt.composition.CH4 ?? 0) * 100).toFixed(2),
          H2O: +((pt.composition.H2O ?? 0) * 100).toFixed(2),
          CH4_CO: +(pt.CH4_CO_ratio || 0).toFixed(3),
          conversion: +((pt.CH4_conversion || 0) * 100).toFixed(1),
        })));
      })
      .catch(console.error);
  }, [result, inputs]);

  // Carbon boundary
  const carbonBoundaryData = useMemo(() => {
    const points: { SC: number; temp_C: number; safe: number }[] = [];
    for (let sc = 0.5; sc <= 5.0; sc += 0.25) {
      for (let t = 400; t <= 1000; t += 25) {
        const minSC = Math.max(0.5, 3.0 - t / 400);
        points.push({ SC: sc, temp_C: t, safe: sc >= minSC ? 1 : 0 });
      }
    }
    return points;
  }, []);

  // S/C sensitivity sweep
  const [scSensitivity, setScSensitivity] = useState<Record<string, number | string>[]>([]);
  useMemo(() => {
    if (!result) {
      setScSensitivity([]);
      return;
    }
    const promises = [];
    for (let sc = 1.0; sc <= 5.0; sc += 0.25) {
      const tempInputs = { ...inputs, steamToCarbonRatio: sc };
      promises.push(sizeReformerSystem(tempInputs).then(r => ({
        SC: sc,
        conversion: r.CH4_conversion_percent,
        H2_yield: r.H2_yield_mol_per_mol_CH4,
        carbonRisk: r.carbonFormationRisk,
      })).catch(() => null));
    }
    Promise.all(promises).then(res => {
      setScSensitivity(res.filter(r => r !== null));
    });
  }, [result, inputs]);

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <button onClick={() => (i <= step ? setStep(i) : undefined)}
              className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors whitespace-nowrap ${i === step ? "bg-primary text-primary-foreground"
                  : i < step ? "bg-primary/20 text-primary cursor-pointer"
                    : "bg-muted text-muted-foreground"
                }`}>
              {i + 1}. {s}
            </button>
            {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
          </div>
        ))}
      </div>

      {/* ================================================================ */}
      {/* STEP 1: FUEL INPUT */}
      {/* ================================================================ */}
      {step === 0 && (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Droplets className="h-4 w-4 text-primary" /> Fuel Presets
              </CardTitle>
              <CardDescription>Select a fuel type or enter custom composition</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {FUEL_PRESETS.map((p, i) => (
                  <Button key={i} variant="outline" size="sm" onClick={() => applyPreset(i)}>{p.name}</Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fuel Composition [mol%]</CardTitle>
                <CardDescription>
                  Sum: <span className={Math.abs(fuelSum - 100) > 0.5 ? "text-red-500 font-bold" : "text-green-500"}>{fuelSum.toFixed(1)}%</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {([
                  ["CH4_percent", "CH₄ (Methane)", "%"],
                  ["C2H6_percent", "C₂H₆ (Ethane)", "%"],
                  ["C3H8_percent", "C₃H₈ (Propane)", "%"],
                  ["CO2_percent", "CO₂", "%"],
                  ["N2_percent", "N₂", "%"],
                  ["H2S_ppm", "H₂S", "ppm"],
                ] as const).map(([field, label, unit]) => (
                  <NumField key={field} label={label} value={inputs[field] as number} unit={unit}
                    onChange={(v) => update(field, v)} />
                ))}
                {inputs.H2S_ppm > 1 && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/5 p-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    <p className="text-xs">H₂S &gt; 1 ppm: ZnO desulfurization bed required upstream. Will be auto-sized.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Flow Conditions</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="w-40 shrink-0 text-sm">Fuel Type</Label>
                  <Select value={inputs.fuelType} onValueChange={(v) => update("fuelType", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pipeline_natural_gas">Pipeline Natural Gas</SelectItem>
                      <SelectItem value="biogas">Biogas</SelectItem>
                      <SelectItem value="landfill_gas">Landfill Gas</SelectItem>
                      <SelectItem value="pure_methane">Pure Methane</SelectItem>
                      <SelectItem value="associated_gas">Associated Gas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <NumField label="Fuel Flow Rate" value={inputs.fuelFlowRate_Nm3_h} unit="Nm³/h" onChange={(v) => update("fuelFlowRate_Nm3_h", v)} />
                <NumField label="Fuel Pressure" value={inputs.fuelPressure_kPa} unit="kPa" onChange={(v) => update("fuelPressure_kPa", v)} />
                <NumField label="Fuel Temperature" value={inputs.fuelTemp_C} unit="°C" onChange={(v) => update("fuelTemp_C", v)} />

                {/* Fuel energy summary */}
                <div className="rounded-lg border bg-muted/30 p-3 mt-2">
                  <p className="text-xs font-semibold mb-1">Fuel Energy (LHV)</p>
                  <div className="grid grid-cols-2 gap-x-4 text-xs">
                    <span className="text-muted-foreground">CH₄ flow</span>
                    <span className="font-mono">{(inputs.fuelFlowRate_Nm3_h * inputs.CH4_percent / 100).toFixed(2)} Nm³/h</span>
                    <span className="text-muted-foreground">LHV input</span>
                    <span className="font-mono">{(inputs.fuelFlowRate_Nm3_h * inputs.CH4_percent / 100 * 35.8).toFixed(0)} MJ/h</span>
                    <span className="text-muted-foreground">Thermal input</span>
                    <span className="font-mono">{(inputs.fuelFlowRate_Nm3_h * inputs.CH4_percent / 100 * 35.8 / 3.6).toFixed(1)} kW</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setStep(1)}>Next: Reformer Design <ChevronRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* STEP 2: REFORMER DESIGN */}
      {/* ================================================================ */}
      {step === 1 && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-500" /> Reforming Strategy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Label className="w-40 shrink-0 text-sm">Strategy</Label>
                  <Select value={inputs.reformingStrategy} onValueChange={(v) => update("reformingStrategy", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SMR">SMR — Steam Methane Reforming</SelectItem>
                      <SelectItem value="POX">POX — Partial Oxidation</SelectItem>
                      <SelectItem value="ATR">ATR — Autothermal Reforming</SelectItem>
                      <SelectItem value="internal">Internal Reforming (at SOFC)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <NumField label="S/C Ratio" value={inputs.steamToCarbonRatio} unit="mol/mol" onChange={(v) => update("steamToCarbonRatio", v)} step="0.1" />
                {(inputs.reformingStrategy === "POX" || inputs.reformingStrategy === "ATR") && (
                  <NumField label="O/C Ratio" value={inputs.oxygenToCarbonRatio ?? 0} unit="mol/mol" onChange={(v) => update("oxygenToCarbonRatio", v)} step="0.05" />
                )}
                <NumField label="Target CH₄/CO" value={inputs.targetCH4_CO_ratio ?? 0} unit="ratio" onChange={(v) => update("targetCH4_CO_ratio", v)} step="0.1" />

                {/* Strategy explanation */}
                <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-2">
                  {inputs.reformingStrategy === "SMR" && (
                    <>
                      <p className="font-semibold">CH₄ + H₂O ⇌ CO + 3H₂ &nbsp;&nbsp; ΔH° = +206 kJ/mol</p>
                      <p className="text-muted-foreground">Endothermic. Requires external heat (SOFC exhaust or burner). Highest H₂ yield (theoretical 4.0 mol H₂/mol CH₄ with WGS). Ni/Al₂O₃ catalyst, 700–900°C.</p>
                      <p className="text-muted-foreground">Typical GHSV: 2,000–10,000 h⁻¹ (Ni), 10,000–50,000 h⁻¹ (PGM).</p>
                    </>
                  )}
                  {inputs.reformingStrategy === "POX" && (
                    <>
                      <p className="font-semibold">CH₄ + ½O₂ → CO + 2H₂ &nbsp;&nbsp; ΔH° = −36 kJ/mol</p>
                      <p className="text-muted-foreground">Mildly exothermic. Self-heating, fast startup. Lower H₂ yield. Requires O/C = 0.5–0.6. Risk of hot spots.</p>
                    </>
                  )}
                  {inputs.reformingStrategy === "ATR" && (
                    <>
                      <p className="font-semibold">CH₄ + xO₂ + yH₂O → CO + zH₂ &nbsp;&nbsp; ΔH° ≈ 0</p>
                      <p className="text-muted-foreground">Combines SMR + POX for near-neutral heat balance. S/C = 1–2, O/C = 0.3–0.5. Good for mobile/APU applications.</p>
                    </>
                  )}
                  {inputs.reformingStrategy === "internal" && (
                    <>
                      <p className="font-semibold">Direct reforming on Ni-YSZ SOFC anode</p>
                      <p className="text-muted-foreground">Simplest system. Endothermic reforming absorbs SOFC waste heat. Risk: thermal gradients, carbon deposition on anode. Requires S/C ≥ 2.0.</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-red-500" /> Catalyst Selection
                </CardTitle>
                <CardDescription>Select a catalyst for each reactor stage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Main Reformer Catalyst */}
                <div>
                  <Label className="text-xs font-semibold mb-1.5 block">Main Reformer</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(inputs.reformingStrategy === "SMR" || inputs.reformingStrategy === "internal"
                      ? [
                        { key: "SMR_Ni", label: "Ni/α-Al₂O₃", desc: "Industrial standard", temp: "700–900°C", cost: "Low" },
                        { key: "SMR_PM", label: "Pd-Rh/CeO₂", desc: "Compact / mobile SOFC", temp: "600–850°C", cost: "High" },
                      ]
                      : inputs.reformingStrategy === "POX"
                        ? [
                          { key: "POX", label: "Rh/Al₂O₃", desc: "Partial oxidation", temp: "800–1100°C", cost: "High" },
                        ]
                        : [
                          { key: "ATR", label: "Ni-Rh/MgAl₂O₄", desc: "Autothermal reforming", temp: "700–1000°C", cost: "Medium" },
                        ]
                    ).map((c) => {
                      const ghsv = REFORMER_GHSV[c.key];
                      const cat = REFORMER_CATALYSTS[c.key];
                      const selected = catalystSelections.mainReformer === c.key;
                      return (
                        <button key={c.key} onClick={() => setCatalystSelections((p) => ({ ...p, mainReformer: c.key }))}
                          className={`rounded-lg border-2 p-2.5 text-left transition-all text-xs ${selected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/50"
                            }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold">{c.label}</span>
                            {selected && <Badge className="text-[10px] h-4 px-1.5">Selected</Badge>}
                          </div>
                          <p className="text-muted-foreground">{c.desc}</p>
                          <p className="text-muted-foreground">{c.temp}</p>
                          {ghsv && <p className="text-muted-foreground">GHSV: {ghsv.min.toLocaleString()}–{ghsv.max.toLocaleString()} h⁻¹ (typ. {ghsv.typical.toLocaleString()})</p>}
                          {cat && <p className="text-muted-foreground">ρ_bulk: {cat.bulkDensity_kg_L} kg/L | d_p: {cat.particleDiameter_mm} mm | ε: {cat.voidFraction}</p>}
                          <p className="text-muted-foreground">Cost: {c.cost}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pre-reformer */}
                {(inputs.C2H6_percent + inputs.C3H8_percent > 1) && (
                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block">Pre-Reformer (C₂+ cracking)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: "pre_reformer", label: "Ni/CaAl₂O₄", desc: "Adiabatic pre-reformer", temp: "400–550°C" },
                      ].map((c) => {
                        const ghsv = REFORMER_GHSV[c.key];
                        const cat = REFORMER_CATALYSTS[c.key];
                        const selected = catalystSelections.preReformer === c.key;
                        return (
                          <button key={c.key} onClick={() => setCatalystSelections((p) => ({ ...p, preReformer: c.key }))}
                            className={`rounded-lg border-2 p-2.5 text-left transition-all text-xs ${selected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/50"
                              }`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold">{c.label}</span>
                              {selected && <Badge className="text-[10px] h-4 px-1.5">Selected</Badge>}
                            </div>
                            <p className="text-muted-foreground">{c.desc} | {c.temp}</p>
                            {ghsv && <p className="text-muted-foreground">GHSV: {ghsv.min.toLocaleString()}–{ghsv.max.toLocaleString()} h⁻¹</p>}
                            {cat && <p className="text-muted-foreground">ρ: {cat.bulkDensity_kg_L} kg/L | d_p: {cat.particleDiameter_mm} mm</p>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* WGS Catalysts */}
                {inputs.reformingStrategy !== "internal" && (
                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block">Water-Gas Shift</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: "HT_WGS", label: "Fe₂O₃-Cr₂O₃", desc: "HT-WGS", temp: "320–500°C", field: "htWGS" as const },
                        { key: "LT_WGS", label: "CuO-ZnO/Al₂O₃", desc: "LT-WGS", temp: "180–300°C", field: "ltWGS" as const },
                      ].map((c) => {
                        const ghsv = REFORMER_GHSV[c.key];
                        const cat = REFORMER_CATALYSTS[c.key];
                        const selected = catalystSelections[c.field] === c.key;
                        return (
                          <button key={c.key} onClick={() => setCatalystSelections((p) => ({ ...p, [c.field]: c.key }))}
                            className={`rounded-lg border-2 p-2.5 text-left transition-all text-xs ${selected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/50"
                              }`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold">{c.label}</span>
                              {selected && <Badge className="text-[10px] h-4 px-1.5">Selected</Badge>}
                            </div>
                            <p className="text-muted-foreground">{c.desc} | {c.temp}</p>
                            {ghsv && <p className="text-muted-foreground">GHSV: {ghsv.min.toLocaleString()}–{ghsv.max.toLocaleString()} h⁻¹</p>}
                            {cat && <p className="text-muted-foreground">ρ: {cat.bulkDensity_kg_L} kg/L | d_p: {cat.particleDiameter_mm} mm | ε: {cat.voidFraction}</p>}
                            <p className="text-muted-foreground">S sensitivity: {c.key === "LT_WGS" ? "< 0.1 ppm" : "< 10 ppm"}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Desulfurizer info */}
                <div className={`rounded-lg border p-2.5 text-xs ${inputs.H2S_ppm > 1 ? "border-amber-500/50 bg-amber-500/5" : "bg-muted/30"}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Shield className="h-3 w-3" />
                    <span className="font-semibold">Desulfurizer — ZnO</span>
                    <Badge variant={inputs.H2S_ppm > 1 ? "destructive" : "secondary"} className="text-[10px] h-4 px-1.5 ml-auto">
                      {inputs.H2S_ppm > 1 ? "Required" : "Not needed"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    ZnO + H₂S → ZnS + H₂O | Capacity: ~20 wt% S | 300–400°C | Auto-sized when H₂S &gt; 1 ppm
                  </p>
                </div>

                {/* Selected summary */}
                <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs font-semibold mb-2">Selected Catalyst Chain</p>
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    {inputs.H2S_ppm > 1 && (
                      <><Badge variant="outline" className="bg-amber-500/10">ZnO Desulf.</Badge><ChevronRight className="h-3 w-3 text-muted-foreground" /></>
                    )}
                    {(inputs.C2H6_percent + inputs.C3H8_percent > 1) && (
                      <><Badge variant="outline">{REFORMER_CATALYSTS[catalystSelections.preReformer ?? "pre_reformer"]?.name ?? "Pre-ref"}</Badge><ChevronRight className="h-3 w-3 text-muted-foreground" /></>
                    )}
                    <Badge className="bg-primary/20 text-primary border-primary/30">{REFORMER_CATALYSTS[catalystSelections.mainReformer ?? "SMR_Ni"]?.name ?? "Main"}</Badge>
                    {inputs.reformingStrategy !== "internal" && (
                      <>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="outline">{REFORMER_CATALYSTS[catalystSelections.htWGS ?? "HT_WGS"]?.name ?? "HT-WGS"}</Badge>
                        {(!inputs.targetCH4_CO_ratio || inputs.targetCH4_CO_ratio < 0.5) && (
                          <>
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            <Badge variant="outline">{REFORMER_CATALYSTS[catalystSelections.ltWGS ?? "LT_WGS"]?.name ?? "LT-WGS"}</Badge>
                          </>
                        )}
                      </>
                    )}
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-500/30">SOFC Stack</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(0)}><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
            <Button onClick={() => setStep(2)}>Next: SOFC Stack <ChevronRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* STEP 3: SOFC STACK CONFIGURATION */}
      {/* ================================================================ */}
      {step === 2 && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Battery className="h-4 w-4 text-primary" /> SOFC Operating Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <NumField label="Target Power" value={inputs.SOFC_power_kW} unit="kW" onChange={(v) => update("SOFC_power_kW", v)} />
                <NumField label="Fuel Utilization (Uf)" value={inputs.SOFC_fuelUtilization} unit="(0–1)" onChange={(v) => update("SOFC_fuelUtilization", v)} step="0.05" />
                <NumField label="Stack Temperature" value={inputs.SOFC_operatingTemp_C} unit="°C" onChange={(v) => update("SOFC_operatingTemp_C", v)} />
                <NumField label="Current Density" value={inputs.SOFC_currentDensity_A_cm2} unit="A/cm²" onChange={(v) => update("SOFC_currentDensity_A_cm2", v)} step="0.05" />
                <NumField label="Cell Active Area" value={cellArea} unit="cm²" onChange={setCellArea} />

                <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                  <p className="font-semibold">Design Guidelines</p>
                  <p className="text-muted-foreground">Uf = 0.70–0.85 typical. Higher Uf → more power but risk of fuel starvation at anode.</p>
                  <p className="text-muted-foreground">j = 0.3–0.7 A/cm² typical. Higher j → more power density but lower voltage efficiency.</p>
                  <p className="text-muted-foreground">T = 700–850°C for anode-supported YSZ. Lower T possible with GDC/LSGM electrolytes.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-primary" /> Cell Materials
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="w-40 shrink-0 text-sm">Electrolyte</Label>
                  <Select value={sofcMaterials.electrolyte} onValueChange={(v) => setSofcMaterials((p) => ({ ...p, electrolyte: v as SOFCMaterials["electrolyte"] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YSZ">8YSZ (yttria-stabilized zirconia)</SelectItem>
                      <SelectItem value="ScSZ">ScSZ (scandia-stabilized zirconia)</SelectItem>
                      <SelectItem value="GDC">GDC (gadolinia-doped ceria)</SelectItem>
                      <SelectItem value="LSGM">LSGM (lanthanum gallate)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <NumField label="Electrolyte Thickness" value={sofcMaterials.electrolyteThickness_um} unit="µm"
                  onChange={(v) => setSofcMaterials((p) => ({ ...p, electrolyteThickness_um: v }))} />
                <div className="flex items-center gap-2">
                  <Label className="w-40 shrink-0 text-sm">Anode</Label>
                  <Select value={sofcMaterials.anode} onValueChange={(v) => setSofcMaterials((p) => ({ ...p, anode: v as SOFCMaterials["anode"] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ni-YSZ">Ni-YSZ cermet</SelectItem>
                      <SelectItem value="Ni-GDC">Ni-GDC cermet</SelectItem>
                      <SelectItem value="Ni-ScSZ">Ni-ScSZ cermet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-40 shrink-0 text-sm">Cathode</Label>
                  <Select value={sofcMaterials.cathode} onValueChange={(v) => setSofcMaterials((p) => ({ ...p, cathode: v as SOFCMaterials["cathode"] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LSM">LSM (La₀.₈Sr₀.₂MnO₃)</SelectItem>
                      <SelectItem value="LSCF">LSCF (La₀.₆Sr₀.₄Co₀.₂Fe₀.₈O₃)</SelectItem>
                      <SelectItem value="LSC">LSC (La₀.₆Sr₀.₄CoO₃)</SelectItem>
                      <SelectItem value="BSCF">BSCF (Ba₀.₅Sr₀.₅Co₀.₈Fe₀.₂O₃)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-40 shrink-0 text-sm">Interconnect</Label>
                  <Select value={sofcMaterials.interconnect} onValueChange={(v) => setSofcMaterials((p) => ({ ...p, interconnect: v as SOFCMaterials["interconnect"] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Crofer22APU">Crofer 22 APU (ferritic steel)</SelectItem>
                      <SelectItem value="SS441">SS 441 (ferritic steel)</SelectItem>
                      <SelectItem value="LaCrO3">LaCrO₃ (ceramic)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                  <p className="font-semibold mb-1">Material Notes</p>
                  <p className="text-muted-foreground">
                    {sofcMaterials.electrolyte === "YSZ" && "8YSZ: industry standard. σ_ionic peaks at 800–1000°C. Minimum ~5 µm for gas-tight layer."}
                    {sofcMaterials.electrolyte === "ScSZ" && "ScSZ: 40% higher conductivity than YSZ. Enables lower operating T (700°C). Higher cost."}
                    {sofcMaterials.electrolyte === "GDC" && "GDC: excellent conductivity at 500–700°C. Electronic conductivity at low pO₂ reduces OCV. Use with barrier layer."}
                    {sofcMaterials.electrolyte === "LSGM" && "LSGM: high conductivity at 600–800°C. Ga volatility issue. Incompatible with Ni — needs buffer layer."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
            <Button onClick={calculate} disabled={calculating}>
              {calculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
              Calculate Full System
            </Button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* STEP 4: RESULTS */}
      {/* ================================================================ */}
      {step === 4 && result && sofcResult && (
        <div className="flex flex-col gap-6">
          {/* Warnings */}
          {result.warnings.length > 0 && (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardContent className="pt-6">
                {result.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 mb-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <p className="text-sm">{w}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* KPI Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "SOFC Power", value: `${sofcResult.targetPower_kW.toFixed(1)} kW`, sub: `${sofcResult.numberOfCells} cells`, color: "text-emerald-600" },
              { label: "Cell Voltage", value: `${sofcResult.cellVoltage_V.toFixed(3)} V`, sub: `Nernst: ${sofcResult.nernstVoltage.toFixed(3)} V`, color: "text-blue-600" },
              { label: "Electrical η", value: `${(sofcResult.electricalEfficiency_LHV * 100).toFixed(1)}%`, sub: `CHP: ${(sofcResult.combinedEfficiency_CHP * 100).toFixed(1)}%`, color: "text-purple-600" },
              { label: "H₂ Production", value: `${result.H2_production_Nm3_h.toFixed(1)} Nm³/h`, sub: `Yield: ${result.H2_yield_mol_per_mol_CH4.toFixed(2)} mol/mol`, color: "text-orange-600" },
              { label: "Carbon Risk", value: result.carbonFormationRisk.toUpperCase(), sub: `Min S/C: ${result.minimumSCRatio_noCarbon.toFixed(1)}`, color: result.carbonFormationRisk === "low" ? "text-green-600" : "text-red-600" },
            ].map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className={`text-xl font-bold font-mono ${kpi.color}`}>{kpi.value}</p>
                  <p className="text-[10px] text-muted-foreground">{kpi.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="sofc">
            <TabsList className="flex-wrap">
              <TabsTrigger value="sofc">SOFC Electrochemistry</TabsTrigger>
              <TabsTrigger value="reformate">Reformate</TabsTrigger>
              <TabsTrigger value="equilibrium">Equilibrium</TabsTrigger>
              <TabsTrigger value="reactor">Reactor Profile</TabsTrigger>
              <TabsTrigger value="beds">Catalyst Beds</TabsTrigger>
              <TabsTrigger value="heat">Heat Integration</TabsTrigger>
              <TabsTrigger value="carbon">Carbon Boundary</TabsTrigger>
              <TabsTrigger value="sensitivity">Sensitivity</TabsTrigger>
            </TabsList>

            {/* ---- SOFC ELECTROCHEMISTRY ---- */}
            <TabsContent value="sofc" className="mt-4">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Polarization Curve */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">V-I Polarization Curve</CardTitle>
                    <CardDescription>Cell voltage and power density vs current density at {inputs.SOFC_operatingTemp_C}°C</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={320}>
                      <ComposedChart data={sofcResult.polarizationData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="j_A_cm2" label={{ value: "Current Density [A/cm²]", position: "insideBottom", offset: -5 }} />
                        <YAxis yAxisId="v" domain={[0, 1.2]} label={{ value: "Voltage [V]", angle: -90, position: "insideLeft" }} />
                        <YAxis yAxisId="p" orientation="right" label={{ value: "Power [W/cm²]", angle: 90, position: "insideRight" }} />
                        <Tooltip formatter={(v: number, name: string) => [v.toFixed(4), name]} />
                        <Legend />
                        <Line yAxisId="v" type="monotone" dataKey="V_cell" name="Cell Voltage [V]" stroke="#2563EB" strokeWidth={2.5} dot={false} />
                        <Line yAxisId="v" type="monotone" dataKey="E_nernst" name="Nernst OCV [V]" stroke="#94A3B8" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                        <Area yAxisId="p" type="monotone" dataKey="P_W_cm2" name="Power [W/cm²]" fill="#10B981" fillOpacity={0.15} stroke="#10B981" strokeWidth={2} dot={false} />
                        <ReferenceLine yAxisId="v" x={inputs.SOFC_currentDensity_A_cm2} stroke="#EF4444" strokeDasharray="3 3" label={{ value: "Design Point", position: "top" }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Voltage Loss Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Voltage Loss Breakdown</CardTitle>
                    <CardDescription>At j = {inputs.SOFC_currentDensity_A_cm2} A/cm², T = {inputs.SOFC_operatingTemp_C}°C</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={320}>
                      <AreaChart data={sofcResult.polarizationData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="j_A_cm2" label={{ value: "Current Density [A/cm²]", position: "insideBottom", offset: -5 }} />
                        <YAxis domain={[0, 1.2]} label={{ value: "Voltage [V]", angle: -90, position: "insideLeft" }} />
                        <Tooltip formatter={(v: number) => `${v.toFixed(4)} V`} />
                        <Legend />
                        <Area type="monotone" dataKey="eta_conc" name="Concentration Loss" stackId="1" fill="#EF4444" fillOpacity={0.6} stroke="#EF4444" />
                        <Area type="monotone" dataKey="eta_act_cathode" name="Cathode Activation" stackId="1" fill="#F59E0B" fillOpacity={0.6} stroke="#F59E0B" />
                        <Area type="monotone" dataKey="eta_act_anode" name="Anode Activation" stackId="1" fill="#8B5CF6" fillOpacity={0.6} stroke="#8B5CF6" />
                        <Area type="monotone" dataKey="eta_ohmic" name="Ohmic Loss" stackId="1" fill="#3B82F6" fillOpacity={0.6} stroke="#3B82F6" />
                        <Area type="monotone" dataKey="V_cell" name="Useful Voltage" stackId="1" fill="#10B981" fillOpacity={0.6} stroke="#10B981" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Stack Design Summary */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Stack Design</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      {[
                        ["Number of Cells", sofcResult.numberOfCells.toString()],
                        ["Cell Active Area", `${cellArea} cm²`],
                        ["Total Active Area", `${(sofcResult.totalActiveArea_cm2 / 1e4).toFixed(2)} m²`],
                        ["Stack Voltage", `${sofcResult.stackVoltage_V.toFixed(1)} V`],
                        ["Stack Current", `${sofcResult.stackCurrent_A.toFixed(1)} A`],
                        ["Cell Power", `${sofcResult.cellPower_W.toFixed(1)} W`],
                        ["Nernst OCV", `${sofcResult.nernstVoltage.toFixed(4)} V`],
                        ["Ohmic Loss", `${(sofcResult.ohmicLoss_V * 1000).toFixed(1)} mV`],
                        ["Activation Loss", `${(sofcResult.activationLoss_V * 1000).toFixed(1)} mV`],
                        ["Concentration Loss", `${(sofcResult.concentrationLoss_V * 1000).toFixed(1)} mV`],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-muted-foreground">{k}</span>
                          <span className="font-mono font-medium">{v}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Efficiency & Degradation */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Efficiency & Lifetime</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
                      {[
                        ["Voltage Efficiency", `${(sofcResult.voltageEfficiency * 100).toFixed(1)}%`],
                        ["Fuel Utilization", `${(sofcResult.fuelUtilization * 100).toFixed(0)}%`],
                        ["Electrical η (LHV)", `${(sofcResult.electricalEfficiency_LHV * 100).toFixed(1)}%`],
                        ["Thermal η", `${(sofcResult.thermalEfficiency * 100).toFixed(1)}%`],
                        ["Combined CHP η", `${(sofcResult.combinedEfficiency_CHP * 100).toFixed(1)}%`],
                        ["Heat Generation", `${sofcResult.heatGeneration_kW.toFixed(1)} kW`],
                        ["Air Flow Required", `${sofcResult.airFlowRequired_kg_h.toFixed(1)} kg/h`],
                        ["Degradation Rate", `${sofcResult.degradationRate_percent_per_kh.toFixed(2)} %/kh`],
                        ["Projected Lifetime", `${(sofcResult.projectedLifetime_h / 1000).toFixed(0)} kh`],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-muted-foreground">{k}</span>
                          <span className="font-mono font-medium">{v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Efficiency bar */}
                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-semibold mb-2">Energy Flow</p>
                      <div className="flex h-6 rounded overflow-hidden text-[10px] font-medium text-white">
                        <div style={{ width: `${sofcResult.electricalEfficiency_LHV * 100}%` }} className="bg-emerald-500 flex items-center justify-center">
                          {(sofcResult.electricalEfficiency_LHV * 100).toFixed(0)}% Elec
                        </div>
                        <div style={{ width: `${sofcResult.thermalEfficiency * 80}%` }} className="bg-orange-500 flex items-center justify-center">
                          {(sofcResult.thermalEfficiency * 100).toFixed(0)}% Heat
                        </div>
                        <div className="flex-1 bg-gray-400 flex items-center justify-center">
                          Losses
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ---- REFORMATE ---- */}
            <TabsContent value="reformate" className="mt-4">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Reformate Composition (dry basis)</CardTitle>
                    <CardDescription>At {result.reformerOutletTemp_C}°C, {result.reformerPressure_kPa} kPa | S/C = {inputs.steamToCarbonRatio}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {[
                      ["H₂", result.reformateComposition.H2_percent, "#3B82F6"],
                      ["CO", result.reformateComposition.CO_percent, "#EF4444"],
                      ["CO₂", result.reformateComposition.CO2_percent, "#F59E0B"],
                      ["CH₄", result.reformateComposition.CH4_percent, "#8B5CF6"],
                      ["N₂", result.reformateComposition.N2_percent, "#6B7280"],
                    ].map(([name, value, color]) => (
                      <div key={name as string} className="flex items-center gap-3 mb-2">
                        <span className="w-10 text-sm font-medium">{name as string}</span>
                        <div className="flex-1 h-5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, value as number)}%`, backgroundColor: color as string }} />
                        </div>
                        <span className="w-16 text-right font-mono text-sm">{(value as number).toFixed(1)}%</span>
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">CH₄/CO Ratio</p>
                        <p className="text-xl font-mono font-bold">{result.CH4_CO_ratio < 100 ? result.CH4_CO_ratio.toFixed(3) : "∞"}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">H₂/CO Ratio</p>
                        <p className="text-xl font-mono font-bold">{result.H2_CO_ratio < 100 ? result.H2_CO_ratio.toFixed(2) : "∞"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">System Summary</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {[
                        ["Strategy", result.reformingStrategy],
                        ["Reformer Inlet T", `${result.reformerInletTemp_C}°C`],
                        ["Reformer Outlet T", `${result.reformerOutletTemp_C}°C`],
                        ["CH₄ Conversion", `${result.CH4_conversion_percent.toFixed(1)}%`],
                        ["H₂ Production", `${result.H2_production_Nm3_h.toFixed(2)} Nm³/h`],
                        ["H₂ Yield", `${result.H2_yield_mol_per_mol_CH4.toFixed(2)} mol H₂/mol CH₄`],
                        ["Yield Efficiency", `${(result.H2_yield_mol_per_mol_CH4 / 4.0 * 100).toFixed(1)}% of theoretical max`],
                        ["SOFC Power", `${sofcResult.targetPower_kW.toFixed(1)} kW`],
                        ["System η (LHV)", `${result.systemEfficiency_percent.toFixed(1)}%`],
                        ["Total ΔP", `${result.catalystBeds.reduce((s, b) => s + b.pressureDrop_kPa, 0).toFixed(2)} kPa`],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between rounded-lg border p-2.5">
                          <span className="text-muted-foreground">{k}</span>
                          <span className="font-mono font-medium">{v}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ---- EQUILIBRIUM ---- */}
            <TabsContent value="equilibrium" className="mt-4">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Equilibrium Composition vs Temperature</CardTitle>
                    <CardDescription>Gibbs free energy minimization | S/C = {inputs.steamToCarbonRatio}, P = {inputs.fuelPressure_kPa} kPa</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={equilibriumData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="temp_C" label={{ value: "Temperature [°C]", position: "insideBottom", offset: -5 }} />
                        <YAxis label={{ value: "mol%", angle: -90, position: "insideLeft" }} />
                        <Tooltip formatter={(v: number) => `${v.toFixed(2)} mol%`} />
                        <Legend />
                        <Line type="monotone" dataKey="H2" name="H₂" stroke="#3B82F6" strokeWidth={2.5} dot={false} />
                        <Line type="monotone" dataKey="CO" name="CO" stroke="#EF4444" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="CO2" name="CO₂" stroke="#F59E0B" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="CH4" name="CH₄" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="H2O" name="H₂O" stroke="#6B7280" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
                        <ReferenceLine x={result.reformerOutletTemp_C} stroke="#EF4444" strokeDasharray="3 3" label={{ value: "Outlet", position: "top" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">CH₄ Conversion & CH₄/CO Ratio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <ComposedChart data={equilibriumData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="temp_C" label={{ value: "Temperature [°C]", position: "insideBottom", offset: -5 }} />
                        <YAxis yAxisId="conv" domain={[0, 100]} label={{ value: "Conversion [%]", angle: -90, position: "insideLeft" }} />
                        <YAxis yAxisId="ratio" orientation="right" scale="log" domain={[0.001, 100]} label={{ value: "CH₄/CO", angle: 90, position: "insideRight" }} />
                        <Tooltip />
                        <Legend />
                        <Line yAxisId="conv" type="monotone" dataKey="conversion" name="CH₄ Conversion [%]" stroke="#10B981" strokeWidth={2.5} dot={false} />
                        <Line yAxisId="ratio" type="monotone" dataKey="CH4_CO" name="CH₄/CO Ratio" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                        <ReferenceLine yAxisId="conv" x={result.reformerOutletTemp_C} stroke="#EF4444" strokeDasharray="3 3" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ---- REACTOR PROFILE ---- */}
            <TabsContent value="reactor" className="mt-4">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Species Profile Along Reformer</CardTitle>
                    <CardDescription>1D plug-flow model with Xu-Froment kinetics (Ni/Al₂O₃)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={reactorProfile}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="position_fraction" label={{ value: "Reactor Position (z/L)", position: "insideBottom", offset: -5 }} tickFormatter={(v: number) => v.toFixed(1)} />
                        <YAxis label={{ value: "mol%", angle: -90, position: "insideLeft" }} />
                        <Tooltip formatter={(v: number) => `${v.toFixed(2)} mol%`} />
                        <Legend />
                        <Line type="monotone" dataKey="H2_mol_percent" name="H₂" stroke="#3B82F6" strokeWidth={2.5} dot={false} />
                        <Line type="monotone" dataKey="CO_mol_percent" name="CO" stroke="#EF4444" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="CO2_mol_percent" name="CO₂" stroke="#F59E0B" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="CH4_mol_percent" name="CH₄" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="H2O_mol_percent" name="H₂O" stroke="#6B7280" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Temperature & Conversion Profile</CardTitle>
                    <CardDescription>Temperature gradient and CH₄ conversion along reactor length</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <ComposedChart data={reactorProfile}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="position_fraction" label={{ value: "Reactor Position (z/L)", position: "insideBottom", offset: -5 }} tickFormatter={(v: number) => v.toFixed(1)} />
                        <YAxis yAxisId="t" label={{ value: "Temperature [°C]", angle: -90, position: "insideLeft" }} />
                        <YAxis yAxisId="c" orientation="right" domain={[0, 100]} label={{ value: "Conversion [%]", angle: 90, position: "insideRight" }} />
                        <Tooltip />
                        <Legend />
                        <Line yAxisId="t" type="monotone" dataKey="temperature_C" name="Temperature [°C]" stroke="#EF4444" strokeWidth={2.5} dot={false} />
                        <Area yAxisId="c" type="monotone" dataKey="CH4_conversion" name="CH₄ Conversion [%]" fill="#10B981" fillOpacity={0.15} stroke="#10B981" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Reaction rate profile */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">Local Reaction Rate Along Reactor</CardTitle>
                    <CardDescription>Shows where most conversion occurs — front of bed is kinetically limited, rear approaches equilibrium</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={reactorProfile}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="position_fraction" tickFormatter={(v: number) => v.toFixed(1)} />
                        <YAxis tickFormatter={(v: number) => v.toExponential(0)} />
                        <Tooltip formatter={(v: number) => v.toExponential(3)} />
                        <Area type="monotone" dataKey="reactionRate_mol_m3_s" name="Rate [mol/(m³·s)]" fill="#8B5CF6" fillOpacity={0.3} stroke="#8B5CF6" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ---- CATALYST BEDS ---- */}
            <TabsContent value="beds" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Catalyst Bed Sizing (Ergun Equation)</CardTitle>
                  <CardDescription>Packed bed sizing with pressure drop via Ergun equation. L/D ≈ 4 for optimal flow distribution.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Stage</TableHead>
                          <TableHead>Catalyst</TableHead>
                          <TableHead>GHSV [h⁻¹]</TableHead>
                          <TableHead>Volume [L]</TableHead>
                          <TableHead>Ø [mm]</TableHead>
                          <TableHead>L [mm]</TableHead>
                          <TableHead>Weight [kg]</TableHead>
                          <TableHead>ΔP [kPa]</TableHead>
                          <TableHead>T_in [°C]</TableHead>
                          <TableHead>T_out [°C]</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.catalystBeds.map((bed, i) => (
                          <TableRow key={i}>
                            <TableCell><Badge variant="outline">{bed.stage}</Badge></TableCell>
                            <TableCell className="font-mono text-xs">{bed.catalystType}</TableCell>
                            <TableCell className="font-mono">{bed.GHSV.toLocaleString()}</TableCell>
                            <TableCell className="font-mono">{bed.volume_L.toFixed(1)}</TableCell>
                            <TableCell className="font-mono">{bed.diameter_mm}</TableCell>
                            <TableCell className="font-mono">{bed.length_mm}</TableCell>
                            <TableCell className="font-mono">{bed.weight_kg.toFixed(1)}</TableCell>
                            <TableCell className="font-mono">{bed.pressureDrop_kPa.toFixed(2)}</TableCell>
                            <TableCell className="font-mono">{bed.inletTemp_C}</TableCell>
                            <TableCell className="font-mono">{bed.outletTemp_C}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-semibold bg-muted/30">
                          <TableCell colSpan={3}>TOTAL</TableCell>
                          <TableCell className="font-mono">{result.catalystBeds.reduce((s, b) => s + b.volume_L, 0).toFixed(1)}</TableCell>
                          <TableCell colSpan={2} />
                          <TableCell className="font-mono">{result.catalystBeds.reduce((s, b) => s + b.weight_kg, 0).toFixed(1)}</TableCell>
                          <TableCell className="font-mono">{result.catalystBeds.reduce((s, b) => s + b.pressureDrop_kPa, 0).toFixed(2)}</TableCell>
                          <TableCell colSpan={2} />
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pressure drop waterfall */}
                  <div className="mt-4">
                    <p className="text-sm font-semibold mb-2">Pressure Drop Waterfall</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={result.catalystBeds.map((b) => ({ name: b.stage, dP: +b.pressureDrop_kPa.toFixed(3) }))}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis label={{ value: "ΔP [kPa]", angle: -90, position: "insideLeft" }} />
                        <Tooltip />
                        <Bar dataKey="dP" name="ΔP [kPa]" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---- HEAT INTEGRATION ---- */}
            <TabsContent value="heat" className="mt-4">
              {heatResult && (
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Flame className="h-4 w-4 text-red-500" /> Heat Sources (Exothermic)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {heatResult.sources.map((s, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border p-2.5 mb-2">
                          <div>
                            <p className="text-sm font-medium">{s.name}</p>
                            <p className="text-xs text-muted-foreground">{s.T_hot_C}°C → {s.T_cold_C}°C</p>
                          </div>
                          <span className="font-mono font-bold text-red-500">+{s.duty_kW.toFixed(1)} kW</span>
                        </div>
                      ))}
                      <div className="rounded-lg border-2 border-red-500/30 p-2.5 mt-2">
                        <div className="flex justify-between">
                          <span className="font-semibold">Total Sources</span>
                          <span className="font-mono font-bold text-red-500">+{heatResult.sources.reduce((s, x) => s + x.duty_kW, 0).toFixed(1)} kW</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Snowflake className="h-4 w-4 text-blue-500" /> Heat Sinks (Endothermic)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {heatResult.sinks.map((s, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border p-2.5 mb-2">
                          <div>
                            <p className="text-sm font-medium">{s.name}</p>
                            <p className="text-xs text-muted-foreground">{s.T_cold_C}°C → {s.T_hot_C}°C</p>
                          </div>
                          <span className="font-mono font-bold text-blue-500">−{s.duty_kW.toFixed(1)} kW</span>
                        </div>
                      ))}
                      <div className="rounded-lg border-2 border-blue-500/30 p-2.5 mt-2">
                        <div className="flex justify-between">
                          <span className="font-semibold">Total Sinks</span>
                          <span className="font-mono font-bold text-blue-500">−{heatResult.sinks.reduce((s, x) => s + x.duty_kW, 0).toFixed(1)} kW</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="md:col-span-2">
                    <CardHeader><CardTitle className="text-base">Heat Balance Summary</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: "Net Heat", value: `${heatResult.netHeat_kW > 0 ? "+" : ""}${heatResult.netHeat_kW.toFixed(1)} kW`, color: heatResult.netHeat_kW > 0 ? "text-red-500" : "text-blue-500" },
                          { label: "Steam Generation", value: `${heatResult.steamGeneration_kg_h.toFixed(1)} kg/h`, color: "text-foreground" },
                          { label: "Elec/Thermal Ratio", value: heatResult.electricToThermalRatio.toFixed(2), color: "text-foreground" },
                          { label: "Heat Recovery", value: `${heatResult.heatRecoveryEffectiveness.toFixed(0)}%`, color: "text-foreground" },
                        ].map((item) => (
                          <div key={item.label} className="rounded-lg border p-3">
                            <p className="text-xs text-muted-foreground">{item.label}</p>
                            <p className={`text-xl font-mono font-bold ${item.color}`}>{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* ---- CARBON BOUNDARY ---- */}
            <TabsContent value="carbon" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Carbon Formation Boundary</CardTitle>
                  <CardDescription>Green = safe (no carbon). Red = carbon deposition predicted. Operating point marked with star.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="temp_C" type="number" name="Temperature" unit="°C" domain={[400, 1000]} label={{ value: "Temperature [°C]", position: "insideBottom", offset: -5 }} />
                      <YAxis dataKey="SC" type="number" name="S/C Ratio" domain={[0.5, 5]} label={{ value: "S/C Ratio", angle: -90, position: "insideLeft" }} />
                      <ZAxis dataKey="safe" range={[20, 20]} />
                      <Tooltip />
                      <Scatter name="Safe" data={carbonBoundaryData.filter((d) => d.safe)} fill="#22C55E" opacity={0.3} />
                      <Scatter name="Carbon Risk" data={carbonBoundaryData.filter((d) => !d.safe)} fill="#EF4444" opacity={0.3} />
                      <Scatter name="Operating Point" data={[{ temp_C: result.reformerOutletTemp_C, SC: inputs.steamToCarbonRatio, safe: result.carbonFormationRisk === "low" ? 1 : 0 }]} fill="#2563EB" shape="star" />
                      <Legend />
                    </ScatterChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---- SENSITIVITY ---- */}
            <TabsContent value="sensitivity" className="mt-4">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">S/C Ratio Sensitivity</CardTitle>
                    <CardDescription>Effect of steam-to-carbon ratio on CH₄ conversion and H₂ yield</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={scSensitivity}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="SC" label={{ value: "S/C Ratio", position: "insideBottom", offset: -5 }} />
                        <YAxis yAxisId="c" domain={[0, 100]} label={{ value: "Conversion [%]", angle: -90, position: "insideLeft" }} />
                        <YAxis yAxisId="y" orientation="right" domain={[0, 4]} label={{ value: "H₂ Yield [mol/mol]", angle: 90, position: "insideRight" }} />
                        <Tooltip />
                        <Legend />
                        <Line yAxisId="c" type="monotone" dataKey="conversion" name="CH₄ Conversion [%]" stroke="#10B981" strokeWidth={2.5} dot={false} />
                        <Line yAxisId="y" type="monotone" dataKey="H2_yield" name="H₂ Yield [mol/mol]" stroke="#3B82F6" strokeWidth={2} dot={false} />
                        <ReferenceLine yAxisId="c" x={inputs.steamToCarbonRatio} stroke="#EF4444" strokeDasharray="3 3" label={{ value: "Design", position: "top" }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                    <div className="mt-2 flex gap-1">
                      {scSensitivity.map((pt, i) => (
                        <div key={i} className="flex-1 h-3 rounded-sm" style={{ backgroundColor: pt.carbonRisk === "low" ? "#22C55E" : pt.carbonRisk === "moderate" ? "#F59E0B" : "#EF4444" }}
                          title={`S/C=${pt.SC}: ${pt.carbonRisk}`} />
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Carbon risk: green = low, yellow = moderate, red = high</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">SOFC Temperature Sensitivity</CardTitle>
                    <CardDescription>Effect of operating temperature on cell voltage and efficiency</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const reformateComp: Record<string, number> = {
                        H2: result.reformateComposition.H2_percent / 100,
                        CO: result.reformateComposition.CO_percent / 100,
                        CO2: result.reformateComposition.CO2_percent / 100,
                        CH4: result.reformateComposition.CH4_percent / 100,
                        H2O: result.reformateComposition.H2O_percent / 100,
                        N2: result.reformateComposition.N2_percent / 100,
                      };
                      const sweep = sofcParametricSweep(
                        {
                          cellActiveArea_cm2: cellArea, operatingTemp_C: inputs.SOFC_operatingTemp_C,
                          operatingPressure_atm: inputs.fuelPressure_kPa / 101.325,
                          currentDensity_A_cm2: inputs.SOFC_currentDensity_A_cm2,
                          fuelUtilization: inputs.SOFC_fuelUtilization, materials: sofcMaterials
                        },
                        inputs.SOFC_power_kW, reformateComp, "temperature", [600, 950], 25
                      );
                      return (
                        <ResponsiveContainer width="100%" height={300}>
                          <ComposedChart data={sweep}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="value" label={{ value: "Temperature [°C]", position: "insideBottom", offset: -5 }} />
                            <YAxis yAxisId="v" domain={[0.4, 1.0]} label={{ value: "Cell Voltage [V]", angle: -90, position: "insideLeft" }} />
                            <YAxis yAxisId="n" orientation="right" label={{ value: "# Cells", angle: 90, position: "insideRight" }} />
                            <Tooltip />
                            <Legend />
                            <Line yAxisId="v" type="monotone" dataKey="cellVoltage" name="Cell Voltage [V]" stroke="#3B82F6" strokeWidth={2.5} dot={false} />
                            <Line yAxisId="v" type="monotone" dataKey="efficiency" name="Efficiency (LHV)" stroke="#10B981" strokeWidth={2} dot={false} />
                            <Bar yAxisId="n" dataKey="numberOfCells" name="# Cells" fill="#8B5CF6" fillOpacity={0.3} />
                            <ReferenceLine yAxisId="v" x={inputs.SOFC_operatingTemp_C} stroke="#EF4444" strokeDasharray="3 3" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}><ChevronLeft className="mr-2 h-4 w-4" /> Modify Parameters</Button>
            <Button variant="outline" onClick={() => setStep(0)}>Start Over</Button>
          </div>
        </div>
      )}
    </div>
  );
}
