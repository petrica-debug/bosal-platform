"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ECS_COMPONENTS,
  filterEcsWithGlobalIndices,
  type EcsFilteredRow,
} from "@/lib/catsizer/oem-database";
import {
  DEFAULT_PGM_PRICES,
  DEFAULT_AM_PENETRATION_PCT,
} from "@/lib/catsizer/oem-database/homologation-workflow";
import { designSystem } from "@/lib/catsizer/system-design";
import { verifyObdMultiCycle } from "@/lib/catsizer/obd-simulation";
import { validateDesign } from "@/lib/catsizer/design-rules";
import { generateTestPlan } from "@/lib/catsizer/test-plan-generator";
import { benchmarkVsCompetitors } from "@/lib/catsizer/competitor-bench";
import { optimizeR103Scope, expandEngineFamily, type EngineFamilyMember } from "@/lib/catsizer/family-expansion";
import {
  runTransientWLTPSim,
  suggestPassingConfig,
  LIGHT_DUTY_PRESETS,
  type WLTPEmissionStandard,
} from "@/lib/catsizer/wltp-transient-engine";
import { WLTP_CYCLE } from "@/lib/catsizer/wltp-cycles";
import {
  computeCost,
  computeMarket,
  computeOemBaseline,
  computeWashcoatSpec,
  generateVariants,
  computeVariantAging,
  type OemBaseline,
} from "./variant-engine";
import type {
  AgingParams,
  AmVariant,
  ChemistrySpec,
  CostBreakdown,
  EconomicsData,
  MarketEstimate,
  ObdValidationData,
  OemReferenceSelection,
  PgmPrices,
  SpecCardData,
  SubstrateSpec,
  SystemDesignData,
  VariantSelection,
  VariantTier,
  VehicleScopeInput,
  WashcoatLayerSpec,
  WltpSimulationData,
} from "./wizard-types";

const MAX_PINNED = 12;
const TOTAL_STEPS = 7;

function initialVehicleScope(): VehicleScopeInput {
  return {
    brand: "all",
    engineSearch: "",
    emissionStandard: "all",
    componentScope: ["CC-TWC"],
    targetMarket: "EU-West",
    packagingConstraints: "",
    systemArchitecture: "CC-TWC-only",
    fuelType: "all",
  };
}

function initialOemRef(): OemReferenceSelection {
  return { pinnedIndices: [], aiBaselineSummary: null, baselineLoading: false };
}

function initialSystemDesign(): SystemDesignData {
  return { result: null, exhaustFlowKgPerH: 120, oemBackpressureKPa: 8 };
}

function initialVariants(): VariantSelection {
  return { variants: [], selectedTier: null, aiLoading: false };
}

function initialChemistry(): ChemistrySpec {
  return {
    layer1: { aluminaGPerL: 0, oscGPerL: 0, oscCePercent: 45, baoGPerL: 0, la2o3GPerL: 0, nd2o3GPerL: 0, totalGPerL: 0 },
    layer2: { aluminaGPerL: 0, oscGPerL: 0, oscCePercent: 40, baoGPerL: 0, la2o3GPerL: 0, nd2o3GPerL: 0, totalGPerL: 0 },
    totalWashcoatGPerL: 0,
    oscFormulation: "Ce₀.₄₅Zr₀.₄₅La₀.₀₅Nd₀.₀₅O₂",
    aiChemistryNotes: null,
    chemistryLoading: false,
    cePercent: 45,
  };
}

function initialWltpSim(): WltpSimulationData {
  return {
    result: null,
    isRunning: false,
    isStale: false,
    enginePresetIndex: 4,
    emissionStandard: "euro_6d_gasoline",
    fuelSulfurPpm: 10,
    ambientTempC: 23,
    lambdaFreqHz: 1.0,
    suggestion: null,
    isSuggesting: false,
  };
}

function initialObdValidation(): ObdValidationData {
  return { obdStrategy: "amplitude", multiCycleResult: null, designValidation: null, exhaustFlowKgPerH: 120, lambdaFreqHz: 1.0 };
}

function initialAgingParams(): AgingParams {
  return { protocol: "RAT-A", agingTempC: 1050, agingHours: 12, exhaustFlowKgPerH: 120 };
}

function initialEconomics(): EconomicsData {
  return {
    pgmPrices: { ...DEFAULT_PGM_PRICES },
    variantCosts: {} as Record<VariantTier, CostBreakdown>,
    variantMarket: {} as Record<VariantTier, MarketEstimate>,
    benchmark: null,
  };
}

function initialSpecCardData(): SpecCardData {
  return { testPlan: null, familyExpansion: null, r103Scope: null, familyMembers: [], familyExpansionLoading: false };
}

export function useWizard() {
  const [step, setStep] = useState(0);
  const [vehicleScope, setVehicleScope] = useState<VehicleScopeInput>(initialVehicleScope);
  const [oemRef, setOemRef] = useState<OemReferenceSelection>(initialOemRef);
  const [systemDesign, setSystemDesign] = useState<SystemDesignData>(initialSystemDesign);
  const [variants, setVariants] = useState<VariantSelection>(initialVariants);
  const [chemistry, setChemistry] = useState<ChemistrySpec>(initialChemistry);
  const [wltpSim, setWltpSim] = useState<WltpSimulationData>(initialWltpSim);
  const [obdValidation, setObdValidation] = useState<ObdValidationData>(initialObdValidation);
  const [economics, setEconomics] = useState<EconomicsData>(initialEconomics);
  const [specCardData, setSpecCardData] = useState<SpecCardData>(initialSpecCardData);
  const [agingParams, setAgingParamsState] = useState<AgingParams>(initialAgingParams);

  /* ---- Step 1: filter ECS rows ---- */
  const matchedRows: EcsFilteredRow[] = useMemo(
    () =>
      filterEcsWithGlobalIndices({
        search: vehicleScope.engineSearch,
        fuel: vehicleScope.fuelType === "hybrid" ? "all" : vehicleScope.fuelType,
        emissionStandard: vehicleScope.emissionStandard,
        brand: vehicleScope.brand,
      }),
    [vehicleScope.engineSearch, vehicleScope.emissionStandard, vehicleScope.brand, vehicleScope.fuelType],
  );

  /* ---- OEM baseline from pinned rows ---- */
  const pinnedRecords = useMemo(
    () => oemRef.pinnedIndices.map((i) => ECS_COMPONENTS[i]),
    [oemRef.pinnedIndices],
  );
  const oemBaseline: OemBaseline = useMemo(
    () => computeOemBaseline(pinnedRecords),
    [pinnedRecords],
  );

  /* ---- Pin toggling ---- */
  const togglePin = useCallback((gi: number) => {
    setOemRef((prev) => {
      if (prev.pinnedIndices.includes(gi)) {
        return { ...prev, pinnedIndices: prev.pinnedIndices.filter((i) => i !== gi) };
      }
      if (prev.pinnedIndices.length >= MAX_PINNED) {
        toast.message(`Maximum ${MAX_PINNED} reference rows`);
        return prev;
      }
      return { ...prev, pinnedIndices: [...prev.pinnedIndices, gi] };
    });
  }, []);

  /* ---- Step navigation ---- */
  const goTo = useCallback((s: number) => {
    setStep(Math.max(0, Math.min(TOTAL_STEPS - 1, s)));
  }, []);

  const next = useCallback(() => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1)), []);
  const prev = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  /* ---- Step 1 → 2 transition ---- */
  const submitVehicleScope = useCallback(
    (scope: VehicleScopeInput) => {
      setVehicleScope(scope);
      const rows = filterEcsWithGlobalIndices({
        search: scope.engineSearch,
        fuel: scope.fuelType === "hybrid" ? "all" : scope.fuelType,
        emissionStandard: scope.emissionStandard,
        brand: scope.brand,
      });
      const autoPin = rows.slice(0, Math.min(6, rows.length)).map((r) => r.globalIndex);
      setOemRef({ pinnedIndices: autoPin, aiBaselineSummary: null, baselineLoading: false });
      next();
    },
    [next],
  );

  /* ---- Step 2: AI baseline summary ---- */
  const requestBaselineSummary = useCallback(async () => {
    if (oemRef.pinnedIndices.length === 0) {
      toast.error("Pin at least one OEM reference row");
      return;
    }
    setOemRef((p) => ({ ...p, baselineLoading: true, aiBaselineSummary: null }));
    try {
      const res = await fetch("/api/am-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message:
            "Produce a structured OEM baseline summary for the pinned reference rows. Include: engine family, emission standard, ECS architecture, substrate geometry, PGM loading (g/ft³ and g/L), OSC, washcoat, confidence tier. Flag any data gaps.",
          selectedIndices: oemRef.pinnedIndices,
          includeFullWashcoat: true,
          answerFocus: "evidence",
          wizardStep: "oem-baseline",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setOemRef((p) => ({ ...p, aiBaselineSummary: data.content ?? "", baselineLoading: false }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to get baseline summary");
      setOemRef((p) => ({ ...p, baselineLoading: false }));
    }
  }, [oemRef.pinnedIndices]);

  /* ---- Step 3: update a system design parameter (exhaust flow, OEM BP) ---- */
  const setSystemDesignParam = useCallback(
    (field: "exhaustFlowKgPerH" | "oemBackpressureKPa", value: number) => {
      setSystemDesign((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  /* ---- Step 2 → 3: compute system design (reads exhaust flow + OEM BP from state) ---- */
  const proceedToSystemDesign = useCallback(() => {
    const arch = vehicleScope.systemArchitecture;
    const result = designSystem({
      architecture: arch,
      totalPgmBudgetGPerL: oemBaseline.totalPgmGPerL * 0.60,
      totalOscBudgetGPerL: oemBaseline.totalOscGPerL * 0.65,
      ratedExhaustFlowKgPerH: systemDesign.exhaustFlowKgPerH,
      oemBackpressureKPa: systemDesign.oemBackpressureKPa,
    });
    setSystemDesign((prev) => ({ ...prev, result }));
    next();
  }, [vehicleScope.systemArchitecture, oemBaseline, systemDesign.exhaustFlowKgPerH, systemDesign.oemBackpressureKPa, next]);

  /* ---- Step 3 → 4: generate variants ---- */
  const generateAmVariants = useCallback(() => {
    const emStd = vehicleScope.emissionStandard === "all"
      ? pinnedRecords[0]?.emissionStandard ?? "Euro 6d"
      : vehicleScope.emissionStandard;
    const vs = generateVariants(oemBaseline, emStd, chemistry.cePercent);
    setVariants({ variants: vs, selectedTier: null, aiLoading: false });
    next();
  }, [oemBaseline, vehicleScope.emissionStandard, pinnedRecords, next, chemistry.cePercent]);

  /* ---- Step 4: AI commentary for variants ---- */
  const requestVariantCommentary = useCallback(async () => {
    if (variants.variants.length === 0) return;
    setVariants((p) => ({ ...p, aiLoading: true }));
    try {
      const res = await fetch("/api/am-copilot/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedIndices: oemRef.pinnedIndices,
          emissionStandard: vehicleScope.emissionStandard,
          componentScope: vehicleScope.componentScope,
          variants: variants.variants.map((v) => ({
            tier: v.tier,
            pgmTotalGPerL: v.pgm.totalGPerL,
            oscTargetGPerL: v.oscTargetGPerL,
            oscRatio: v.oscRatio,
            obdRisk: v.obdRisk,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      const commentaries: Record<string, string> = data.commentaries ?? {};
      setVariants((p) => ({
        ...p,
        aiLoading: false,
        variants: p.variants.map((v) => ({
          ...v,
          aiCommentary: commentaries[v.tier] ?? null,
        })),
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to get AI commentary");
      setVariants((p) => ({ ...p, aiLoading: false }));
    }
  }, [variants.variants, oemRef.pinnedIndices, vehicleScope.emissionStandard, vehicleScope.componentScope]);

  /* ---- Helper: re-compute aging for all variants ---- */
  const recomputeAllAging = useCallback(
    (vs: AmVariant[], ce: number, ap: AgingParams) => {
      return vs.map((v) => ({
        ...v,
        agingPrediction: computeVariantAging(v.pgm, v.oscTargetGPerL, v.substrate, ce, ap.agingTempC, ap.agingHours, ap.exhaustFlowKgPerH),
      }));
    },
    [],
  );

  /* ---- Step 4: select variant ---- */
  const selectVariant = useCallback((tier: VariantTier) => {
    setVariants((p) => ({ ...p, selectedTier: tier }));
  }, []);

  /* ---- Step 4: update PGM field for a tier (live recalc aging) ---- */
  const updateVariantPgm = useCallback(
    (tier: VariantTier, field: "pdGPerL" | "rhGPerL" | "ptGPerL", value: number) => {
      setVariants((prev) => {
        const G_PER_FT3 = 0.0353147;
        const updated = prev.variants.map((v) => {
          if (v.tier !== tier) return v;
          const newPgm = { ...v.pgm, [field]: value };
          const total = +(newPgm.pdGPerL + newPgm.rhGPerL + newPgm.ptGPerL).toFixed(3);
          const vol = v.substrate.volumeL || 1;
          newPgm.totalGPerL = total;
          newPgm.totalGPerFt3 = +(total / G_PER_FT3).toFixed(1);
          newPgm.pdGPerBrick = +(newPgm.pdGPerL * vol).toFixed(3);
          newPgm.rhGPerBrick = +(newPgm.rhGPerL * vol).toFixed(3);
          newPgm.ptGPerBrick = +(newPgm.ptGPerL * vol).toFixed(3);
          newPgm.pdRhRatio = newPgm.rhGPerL > 0 ? +((newPgm.pdGPerL / newPgm.rhGPerL).toFixed(1)) : 0;
          const aging = computeVariantAging(newPgm, v.oscTargetGPerL, v.substrate, chemistry.cePercent, agingParams.agingTempC, agingParams.agingHours, agingParams.exhaustFlowKgPerH);
          return { ...v, pgm: newPgm, agingPrediction: aging };
        });
        return { ...prev, variants: updated };
      });
      setWltpSim((p) => ({ ...p, isStale: true }));
    },
    [chemistry.cePercent, agingParams],
  );

  /* ---- Step 4: update OSC target for a tier ---- */
  const updateVariantOsc = useCallback(
    (tier: VariantTier, oscGPerL: number) => {
      setVariants((prev) => {
        const updated = prev.variants.map((v) => {
          if (v.tier !== tier) return v;
          const newOscRatio = oemBaseline.totalOscGPerL > 0 ? +(oscGPerL / oemBaseline.totalOscGPerL).toFixed(3) : v.oscRatio;
          const aging = computeVariantAging(v.pgm, oscGPerL, v.substrate, chemistry.cePercent, agingParams.agingTempC, agingParams.agingHours, agingParams.exhaustFlowKgPerH);
          return { ...v, oscTargetGPerL: oscGPerL, oscRatio: newOscRatio, agingPrediction: aging };
        });
        return { ...prev, variants: updated };
      });
      setWltpSim((p) => ({ ...p, isStale: true }));
    },
    [oemBaseline.totalOscGPerL, chemistry.cePercent, agingParams],
  );

  /* ---- Step 4: update substrate for a tier ---- */
  const updateVariantSubstrate = useCallback(
    (tier: VariantTier, field: keyof SubstrateSpec, value: number | string) => {
      setVariants((prev) => {
        const updated = prev.variants.map((v) => {
          if (v.tier !== tier) return v;
          const newSub = { ...v.substrate, [field]: value };
          if (field === "diameterMm" || field === "lengthMm") {
            const d = field === "diameterMm" ? (value as number) : newSub.diameterMm;
            const l = field === "lengthMm" ? (value as number) : newSub.lengthMm;
            newSub.volumeL = +((Math.PI * (d / 2) ** 2 * l) / 1e6).toFixed(3);
          }
          const aging = computeVariantAging(v.pgm, v.oscTargetGPerL, newSub, chemistry.cePercent, agingParams.agingTempC, agingParams.agingHours, agingParams.exhaustFlowKgPerH);
          return { ...v, substrate: newSub, agingPrediction: aging };
        });
        return { ...prev, variants: updated };
      });
      setWltpSim((p) => ({ ...p, isStale: true }));
    },
    [chemistry.cePercent, agingParams],
  );

  /* ---- Step 4/5: update aging protocol, re-run all variants ---- */
  const updateAgingParams = useCallback(
    (updates: Partial<AgingParams>) => {
      setAgingParamsState((prev) => {
        const next = { ...prev, ...updates };
        setVariants((vPrev) => ({
          ...vPrev,
          variants: recomputeAllAging(vPrev.variants, chemistry.cePercent, next),
        }));
        return next;
      });
    },
    [chemistry.cePercent, recomputeAllAging],
  );

  /* ---- Step 5: update a washcoat layer field inline ---- */
  const updateChemistryLayer = useCallback(
    (layer: "layer1" | "layer2", field: keyof WashcoatLayerSpec, value: number) => {
      setChemistry((prev) => {
        const updated = { ...prev[layer], [field]: value };
        updated.totalGPerL = +(
          updated.aluminaGPerL + updated.oscGPerL + updated.baoGPerL + updated.la2o3GPerL + updated.nd2o3GPerL
        ).toFixed(1);
        const newChem = { ...prev, [layer]: updated };
        newChem.totalWashcoatGPerL = +(newChem.layer1.totalGPerL + newChem.layer2.totalGPerL).toFixed(1);
        if (field === "oscCePercent") {
          const avgCe = Math.round((newChem.layer1.oscCePercent + newChem.layer2.oscCePercent) / 2);
          newChem.cePercent = avgCe;
        }
        return newChem;
      });
      // Chemistry change invalidates any existing WLTP result
      setWltpSim((p) => ({ ...p, isStale: true }));
    },
    [],
  );

  /* ---- Step 6: WLTP engine preset selector ---- */
  const setWltpEnginePreset = useCallback((idx: number) => {
    setWltpSim((prev) => ({ ...prev, enginePresetIndex: idx, result: null }));
  }, []);

  /* ---- Step 6: WLTP emission standard selector ---- */
  const setWltpEmissionStandard = useCallback((std: WLTPEmissionStandard) => {
    setWltpSim((prev) => ({ ...prev, emissionStandard: std, result: null }));
  }, []);

  /* ---- Step 6: run WLTP transient simulation ---- */
  const runWltpSim = useCallback(() => {
    const selected =
      variants.variants.find((v) => v.tier === variants.selectedTier) ??
      variants.variants[0];
    if (!selected) {
      toast.error("Select an AM variant first (Step 4)");
      return;
    }
    const preset = LIGHT_DUTY_PRESETS[wltpSim.enginePresetIndex] ?? LIGHT_DUTY_PRESETS[0];
    const isGasoline =
      vehicleScope.componentScope.includes("CC-TWC") ||
      vehicleScope.componentScope.includes("UF-TWC");

    setWltpSim((prev) => ({ ...prev, isRunning: true, isStale: false }));

    setTimeout(() => {
      try {
        // Inject chemistry-derived aged T50 from Step 4 when available.
        // This couples Ce%, OSC, and PGM dispersion directly to the WLTP cold-start result.
        const t50Override = selected.agingPrediction
          ? {
              CO:  selected.agingPrediction.predictedT50CoC,
              HC:  selected.agingPrediction.predictedT50HcC,
              // NOx T50 typically lags CO T50 by ~15°C
              NOx: selected.agingPrediction.predictedT50CoC + 15,
            }
          : undefined;

        const simConfig = {
          engine: {
            displacement_L: preset.displacement_L,
            ratedPower_kW: preset.power_kW,
            fuelType: preset.fuelType,
            numberOfCylinders: preset.cylinders,
            rawCO_ppm: preset.rawCO_ppm,
            rawHC_ppm: preset.rawHC_ppm,
            rawNOx_ppm: preset.rawNOx_ppm,
            rawPM_mg_Nm3: preset.rawPM_mg_Nm3,
          },
          catalyst: {
            cpsi: selected.substrate.cpsi,
            wallThickness_mil: selected.substrate.wallMil,
            washcoatType: isGasoline
              ? ("ceria" as const)
              : ("oxidation" as const),
            pgmLoading_g_ft3: selected.pgm.totalGPerFt3,
            diameter_mm: selected.substrate.diameterMm,
            length_mm: selected.substrate.lengthMm,
            splitConfig: "single" as const,
          },
          emissionStandard: wltpSim.emissionStandard,
          agingHours: agingParams.agingHours,
          maxTemp_C: agingParams.agingTempC,
          fuelSulfur_ppm: wltpSim.fuelSulfurPpm,
          t50Override_C: t50Override,
        };
        const cycle = WLTP_CYCLE.map((p) => ({
          time: p.time,
          speed: p.speed,
          phase: p.phase ?? "Low",
        }));
        const result = runTransientWLTPSim(cycle, simConfig);
        setWltpSim((prev) => ({ ...prev, result, isRunning: false, isStale: false }));
      } catch (e) {
        toast.error("Simulation error: " + (e instanceof Error ? e.message : String(e)));
        setWltpSim((prev) => ({ ...prev, isRunning: false }));
      }
    }, 80);
  }, [variants, vehicleScope, wltpSim.enginePresetIndex, wltpSim.emissionStandard, wltpSim.fuelSulfurPpm, agingParams]);

  /* ---- Step 6: WLTP fuel sulfur ppm ---- */
  const setWltpFuelSulfur = useCallback((ppm: number) => {
    setWltpSim((prev) => ({ ...prev, fuelSulfurPpm: ppm, isStale: prev.result !== null }));
  }, []);

  /* ---- Step 6: WLTP ambient temperature ---- */
  const setWltpAmbientTemp = useCallback((tempC: number) => {
    setWltpSim((prev) => ({ ...prev, ambientTempC: tempC, isStale: prev.result !== null }));
  }, []);

  /* ---- Debounced auto-run: when WLTP result is stale and we already have a result ---- */
  const autoRunTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!wltpSim.isStale || wltpSim.isRunning || wltpSim.result === null) return;
    if (variants.selectedTier === null) return;
    if (autoRunTimerRef.current) clearTimeout(autoRunTimerRef.current);
    autoRunTimerRef.current = setTimeout(() => {
      runWltpSim();
    }, 600);
    return () => {
      if (autoRunTimerRef.current) clearTimeout(autoRunTimerRef.current);
    };
  }, [wltpSim.isStale, wltpSim.isRunning, wltpSim.result, variants.selectedTier, runWltpSim]);

  /* ---- Step 6: suggest a passing configuration when WLTP fails ---- */
  const suggestWltpFix = useCallback(() => {
    const selected =
      variants.variants.find((v) => v.tier === variants.selectedTier) ??
      variants.variants[0];
    if (!selected) return;
    const preset = LIGHT_DUTY_PRESETS[wltpSim.enginePresetIndex] ?? LIGHT_DUTY_PRESETS[0];
    const isGasoline =
      vehicleScope.componentScope.includes("CC-TWC") ||
      vehicleScope.componentScope.includes("UF-TWC");

    setWltpSim((prev) => ({ ...prev, isSuggesting: true, suggestion: null }));

    setTimeout(() => {
      try {
        const baseConfig = {
          engine: {
            displacement_L: preset.displacement_L,
            ratedPower_kW: preset.power_kW,
            fuelType: preset.fuelType,
            numberOfCylinders: preset.cylinders,
            rawCO_ppm: preset.rawCO_ppm,
            rawHC_ppm: preset.rawHC_ppm,
            rawNOx_ppm: preset.rawNOx_ppm,
            rawPM_mg_Nm3: preset.rawPM_mg_Nm3,
          },
          catalyst: {
            cpsi: selected.substrate.cpsi,
            wallThickness_mil: selected.substrate.wallMil,
            washcoatType: isGasoline ? ("ceria" as const) : ("oxidation" as const),
            pgmLoading_g_ft3: selected.pgm.totalGPerFt3,
            diameter_mm: selected.substrate.diameterMm,
            length_mm: selected.substrate.lengthMm,
            splitConfig: "single" as const,
          },
          emissionStandard: wltpSim.emissionStandard,
          agingHours: agingParams.agingHours,
          maxTemp_C: agingParams.agingTempC,
          fuelSulfur_ppm: wltpSim.fuelSulfurPpm,
        };
        const cycle = WLTP_CYCLE.map((p) => ({
          time: p.time,
          speed: p.speed,
          phase: p.phase ?? "Low",
        }));
        // OEM baseline PGM in g/ft3 for the search ceiling
        const oemPgm = oemBaseline.totalPgmGPerL > 0
          ? oemBaseline.totalPgmGPerL / 0.0353147
          : selected.pgm.totalGPerFt3 * 2;
        const suggestion = suggestPassingConfig(cycle, baseConfig, oemPgm);
        setWltpSim((prev) => ({ ...prev, suggestion, isSuggesting: false }));
      } catch (e) {
        toast.error("Suggestion search failed: " + (e instanceof Error ? e.message : String(e)));
        setWltpSim((prev) => ({ ...prev, isSuggesting: false }));
      }
    }, 50);
  }, [variants, vehicleScope, wltpSim.enginePresetIndex, wltpSim.emissionStandard, wltpSim.fuelSulfurPpm, agingParams, oemBaseline]);

  /* ---- Step 6: apply the suggestion back to the selected variant ---- */
  const applySuggestion = useCallback(() => {
    const suggestion = wltpSim.suggestion;
    if (!suggestion?.found) return;
    const tier = variants.selectedTier ?? variants.variants[0]?.tier;
    if (!tier) return;

    // Convert suggested g/ft3 back to g/L for the variant PGM split
    const G_PER_FT3 = 0.0353147;
    const newTotalGPerL = +(suggestion.pgmLoading_g_ft3 * G_PER_FT3).toFixed(3);

    setVariants((prev) => {
      const updated = prev.variants.map((v) => {
        if (v.tier !== tier) return v;
        // Scale each PGM metal proportionally
        const oldTotal = v.pgm.totalGPerL || 1;
        const scale = newTotalGPerL / oldTotal;
        const newPgm = {
          ...v.pgm,
          pdGPerL: +(v.pgm.pdGPerL * scale).toFixed(3),
          rhGPerL: +(v.pgm.rhGPerL * scale).toFixed(3),
          ptGPerL: +(v.pgm.ptGPerL * scale).toFixed(3),
          totalGPerL: newTotalGPerL,
          totalGPerFt3: +suggestion.pgmLoading_g_ft3.toFixed(1),
        };
        const vol = v.substrate.volumeL || 1;
        newPgm.pdGPerBrick = +(newPgm.pdGPerL * vol).toFixed(3);
        newPgm.rhGPerBrick = +(newPgm.rhGPerL * vol).toFixed(3);
        newPgm.ptGPerBrick = +(newPgm.ptGPerL * vol).toFixed(3);
        newPgm.pdRhRatio = newPgm.rhGPerL > 0 ? +((newPgm.pdGPerL / newPgm.rhGPerL).toFixed(1)) : 0;

        const newSub = { ...v.substrate };
        if (suggestion.diameter_mm !== v.substrate.diameterMm || suggestion.length_mm !== v.substrate.lengthMm) {
          newSub.diameterMm = suggestion.diameter_mm;
          newSub.lengthMm = suggestion.length_mm;
          newSub.volumeL = +((Math.PI * (suggestion.diameter_mm / 2) ** 2 * suggestion.length_mm) / 1e6).toFixed(3);
          // Recalc per-brick with new volume
          const nv = newSub.volumeL;
          newPgm.pdGPerBrick = +(newPgm.pdGPerL * nv).toFixed(3);
          newPgm.rhGPerBrick = +(newPgm.rhGPerL * nv).toFixed(3);
          newPgm.ptGPerBrick = +(newPgm.ptGPerL * nv).toFixed(3);
        }

        const aging = computeVariantAging(newPgm, v.oscTargetGPerL, newSub, chemistry.cePercent, agingParams.agingTempC, agingParams.agingHours, agingParams.exhaustFlowKgPerH);
        return { ...v, pgm: newPgm, substrate: newSub, agingPrediction: aging };
      });
      return { ...prev, variants: updated };
    });

    // Clear suggestion and mark stale so auto-run fires
    setWltpSim((prev) => ({ ...prev, suggestion: null, isStale: true }));
    toast.success("Applied suggested configuration — WLTP will re-run automatically");
  }, [wltpSim.suggestion, variants, chemistry.cePercent, agingParams]);

  /* ---- Step 7: update OBD strategy ---- */
  const updateObdStrategy = useCallback((strategy: ObdValidationData["obdStrategy"]) => {
    setObdValidation((prev) => ({ ...prev, obdStrategy: strategy }));
  }, []);

  /* ---- Step 7: update lambda oscillation frequency ---- */
  const updateLambdaFreq = useCallback((hz: number) => {
    setObdValidation((prev) => ({ ...prev, lambdaFreqHz: hz }));
    // Also keep wltp lambdaFreqHz in sync for the OBD coupling display
    setWltpSim((prev) => ({ ...prev, lambdaFreqHz: hz }));
  }, []);

  /* ---- Step 7: update exhaust flow ---- */
  const updateExhaustFlow = useCallback(
    (kgPerH: number) => {
      setObdValidation((prev) => ({ ...prev, exhaustFlowKgPerH: kgPerH }));
      updateAgingParams({ exhaustFlowKgPerH: kgPerH });
    },
    [updateAgingParams],
  );

  /* ---- Step 4 → 5: compute chemistry ---- */
  const proceedToChemistry = useCallback(() => {
    const selected = variants.variants.find((v) => v.tier === variants.selectedTier);
    if (!selected) {
      toast.error("Select a variant first");
      return;
    }
    const oscFactor = selected.oscRatio;
    const wc = computeWashcoatSpec(oemBaseline, oscFactor);
    setChemistry({
      layer1: wc.layer1,
      layer2: wc.layer2,
      totalWashcoatGPerL: wc.totalWashcoatGPerL,
      oscFormulation: oscFactor >= 0.70 ? "Ce₀.₄₅Zr₀.₄₅La₀.₀₅Nd₀.₀₅O₂" : "Ce₀.₃₅Zr₀.₅₅La₀.₀₅Nd₀.₀₅O₂",
      aiChemistryNotes: null,
      chemistryLoading: false,
      cePercent: chemistry.cePercent,
    });
    next();
  }, [variants, oemBaseline, next, chemistry.cePercent]);

  /* ---- Step 5: Ce% slider ---- */
  const setCePercent = useCallback((ce: number) => {
    setChemistry((p) => {
      // Propagate slider value to both layer oscCePercent fields.
      // L1 (inner, higher OSC) matches the slider; L2 (outer, Rh-rich) is ~5% lower.
      const l1Ce = ce;
      const l2Ce = Math.max(20, ce - 5);
      const l1 = {
        ...p.layer1,
        oscCePercent: l1Ce,
        totalGPerL: +(p.layer1.aluminaGPerL + p.layer1.oscGPerL + p.layer1.baoGPerL + p.layer1.la2o3GPerL + p.layer1.nd2o3GPerL).toFixed(1),
      };
      const l2 = {
        ...p.layer2,
        oscCePercent: l2Ce,
        totalGPerL: +(p.layer2.aluminaGPerL + p.layer2.oscGPerL + p.layer2.baoGPerL + p.layer2.la2o3GPerL + p.layer2.nd2o3GPerL).toFixed(1),
      };
      return {
        ...p,
        cePercent: ce,
        layer1: l1,
        layer2: l2,
        totalWashcoatGPerL: +(l1.totalGPerL + l2.totalGPerL).toFixed(1),
      };
    });
    setVariants((vPrev) => ({
      ...vPrev,
      variants: recomputeAllAging(vPrev.variants, ce, agingParams),
    }));
    // Ce% change affects OSC capacity → invalidate WLTP result
    setWltpSim((p) => ({ ...p, isStale: true }));
  }, [agingParams, recomputeAllAging]);

  /* ---- Step 5: AI chemistry notes ---- */
  const requestChemistryNotes = useCallback(async () => {
    setChemistry((p) => ({ ...p, chemistryLoading: true, aiChemistryNotes: null }));
    const selected = variants.variants.find((v) => v.tier === variants.selectedTier);
    try {
      const res = await fetch("/api/am-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `For the selected ${selected?.label ?? "balanced"} variant (PGM ${selected?.pgm.totalGPerL ?? 0} g/L, OSC ratio ${selected?.oscRatio ?? 0}, Ce ${chemistry.cePercent}%), provide washcoat chemistry recommendations: L1/L2 layer roles, OSC formulation choice (Ce:Zr ratio impact on aging), PGM impregnation strategy, poison resistance, and comparison to OEM fresh vs aged. Include supplier options (BASF, JM, Umicore).`,
          selectedIndices: oemRef.pinnedIndices,
          includeFullWashcoat: true,
          answerFocus: "pgm",
          wizardStep: "chemistry",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setChemistry((p) => ({ ...p, aiChemistryNotes: data.content ?? "", chemistryLoading: false }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to get chemistry notes");
      setChemistry((p) => ({ ...p, chemistryLoading: false }));
    }
  }, [variants, oemRef.pinnedIndices, chemistry.cePercent]);

  /* ---- Step 6 → 7: OBD simulation & design validation ---- */
  const proceedToObdValidation = useCallback(() => {
    const selected = variants.variants.find((v) => v.tier === variants.selectedTier);
    if (!selected || !selected.agingPrediction) {
      toast.error("No variant or aging data available");
      return;
    }

    const amOscUmol = selected.agingPrediction.osc.agedUmolO2PerBrick;
    const oemOscUmol = selected.agingPrediction.osc.freshUmolO2PerBrick * 0.4; // OEM aged ~40% of fresh

    const mc = verifyObdMultiCycle({
      amOscCapacityUmol: amOscUmol,
      oemAgedOscUmol: oemOscUmol,
      strategy: obdValidation.obdStrategy,
      exhaustFlowKgPerH: obdValidation.exhaustFlowKgPerH,
    });

    const dv = validateDesign(
      {
        pdGPerL: selected.pgm.pdGPerL,
        rhGPerL: selected.pgm.rhGPerL,
        ptGPerL: selected.pgm.ptGPerL,
        totalPgmGPerL: selected.pgm.totalGPerL,
        oscGPerL: selected.oscTargetGPerL,
        washcoatGPerL: chemistry.totalWashcoatGPerL,
        substrateDiameterMm: selected.substrate.diameterMm,
        substrateLengthMm: selected.substrate.lengthMm,
        substrateVolumeL: selected.substrate.volumeL,
        predictedT50CoC: selected.agingPrediction.predictedT50CoC,
      },
      {
        oemFreshPgmGPerL: oemBaseline.totalPgmGPerL,
        oemFreshOscGPerL: oemBaseline.totalOscGPerL,
        oemAgedT50CoC: 300, // typical OEM aged T50
      },
    );

    setObdValidation({ obdStrategy: obdValidation.obdStrategy, multiCycleResult: mc, designValidation: dv, exhaustFlowKgPerH: obdValidation.exhaustFlowKgPerH, lambdaFreqHz: obdValidation.lambdaFreqHz });
    next();
  }, [variants, oemBaseline, chemistry.totalWashcoatGPerL, obdValidation.obdStrategy, obdValidation.exhaustFlowKgPerH, next]);

  /* ---- Step 6 → 7: compute economics + competitor benchmark ---- */
  const proceedToEconomics = useCallback(
    (prices?: PgmPrices) => {
      const p = prices ?? { ...DEFAULT_PGM_PRICES };
      const pen = DEFAULT_AM_PENETRATION_PCT;
      const variantCosts: Record<string, CostBreakdown> = {};
      const variantMarket: Record<string, MarketEstimate> = {};
      for (const v of variants.variants) {
        const wc = computeWashcoatSpec(oemBaseline, v.oscRatio);
        const cost = computeCost(v.pgm, v.substrate, wc.totalWashcoatGPerL, p);
        variantCosts[v.tier] = cost;
        variantMarket[v.tier] = computeMarket(oemBaseline.productionVolumeEu, cost.targetRetail, pen);
      }

      // Competitor benchmarking for selected variant
      const selected = variants.variants.find((v) => v.tier === variants.selectedTier);
      const selectedCost = selected ? variantCosts[selected.tier] : null;
      const benchmark = selected && selectedCost
        ? benchmarkVsCompetitors({
            bosalPgmGPerL: selected.pgm.totalGPerL,
            oemFreshPgmGPerL: oemBaseline.totalPgmGPerL,
            bosalEstimatedRetailEur: selectedCost.targetRetail,
          })
        : null;

      setEconomics({
        pgmPrices: p,
        variantCosts: variantCosts as Record<VariantTier, CostBreakdown>,
        variantMarket: variantMarket as Record<VariantTier, MarketEstimate>,
        benchmark,
      });

      // Generate test plan and R103 scope
      const ref = pinnedRecords[0];
      const emStd = vehicleScope.emissionStandard === "all"
        ? ref?.emissionStandard ?? "Euro 6d"
        : vehicleScope.emissionStandard;

      const fuelType = vehicleScope.fuelType === "all" || vehicleScope.fuelType === "hybrid"
        ? "gasoline"
        : vehicleScope.fuelType;

      const familyMembers: EngineFamilyMember[] = pinnedRecords.slice(0, 5).map((r) => {
        const disp = (parseFloat(String(r.displacementL ?? "1.0")) || 1.0) * 1000;
        const power = parseFloat(String(r.powerKw ?? "100")) || 100;
        // Estimate exhaust temp from displacement and power density
        const powerDensity = power / Math.max(disp / 1000, 0.5); // kW/L
        const estExhaustTemp = Math.min(1050, 750 + powerDensity * 3);
        // Estimate inertia class from vehicle examples text (light hatch vs SUV)
        const modelStr = String(r.vehicleExamples ?? "").toLowerCase();
        const isHeavy = modelStr.includes("suv") || modelStr.includes("mpv") || modelStr.includes("van");
        const estInertia = isHeavy ? 1700 : 1360;
        return {
          engineCode: String(r.engineCodes ?? r.engineFamily ?? "Unknown"),
          displacementCc: disp,
          powerKw: power,
          maxExhaustTempC: Math.round(estExhaustTemp),
          inertiaClassKg: estInertia,
          vehicleModel: String(r.vehicleExamples ?? ""),
        };
      });

      let r103Scope = null;
      if (familyMembers.length > 0) {
        try {
          r103Scope = optimizeR103Scope({
            familyMembers,
            emissionStandard: emStd,
            amComponentList: vehicleScope.componentScope,
          });
        } catch { /* ignore if fails */ }
      }

      const testPlan = generateTestPlan({
        emissionStandard: emStd,
        engineFamilyCodes: familyMembers.map((m) => m.engineCode),
        displacementRange: [
          Math.min(...familyMembers.map((m) => m.displacementCc)),
          Math.max(...familyMembers.map((m) => m.displacementCc)),
        ],
        powerRange: [
          Math.min(...familyMembers.map((m) => m.powerKw)),
          Math.max(...familyMembers.map((m) => m.powerKw)),
        ],
        amComponents: vehicleScope.componentScope,
        testVehicleModel: r103Scope?.testVehicle.vehicleModel ?? familyMembers[0]?.vehicleModel ?? "TBD",
        testVehicleEngineCode: r103Scope?.testVehicle.engineCode ?? familyMembers[0]?.engineCode ?? "TBD",
        testVehicleInertiaKg: r103Scope?.testVehicle.inertiaClassKg ?? 1500,
        agingProtocol: agingParams.protocol === "Custom" ? "Custom" : `${agingParams.protocol} (${agingParams.agingTempC}°C, ${agingParams.agingHours}h)`,
        agingTempC: agingParams.agingTempC,
        agingHours: agingParams.agingHours,
        targetMileageKm: 160_000,
        fuelType: fuelType as "gasoline" | "diesel",
        type6Required: vehicleScope.componentScope.includes("CC-TWC"),
      });

      setSpecCardData({ testPlan, familyExpansion: null, r103Scope, familyMembers, familyExpansionLoading: false });
      next();
    },
    [variants.variants, variants.selectedTier, oemBaseline, pinnedRecords, vehicleScope, next],
  );

  /* ---- Recalculate economics with new prices ---- */
  const recalcEconomics = useCallback(
    (prices: PgmPrices, penetration: number) => {
      const variantCosts: Record<string, CostBreakdown> = {};
      const variantMarket: Record<string, MarketEstimate> = {};
      for (const v of variants.variants) {
        const wc = computeWashcoatSpec(oemBaseline, v.oscRatio);
        const cost = computeCost(v.pgm, v.substrate, wc.totalWashcoatGPerL, prices);
        variantCosts[v.tier] = cost;
        variantMarket[v.tier] = computeMarket(oemBaseline.productionVolumeEu, cost.targetRetail, penetration);
      }

      const selected = variants.variants.find((v) => v.tier === variants.selectedTier);
      const selectedCost = selected ? variantCosts[selected.tier] : null;
      const benchmark = selected && selectedCost
        ? benchmarkVsCompetitors({
            bosalPgmGPerL: selected.pgm.totalGPerL,
            oemFreshPgmGPerL: oemBaseline.totalPgmGPerL,
            bosalEstimatedRetailEur: selectedCost.targetRetail,
          })
        : null;

      setEconomics({
        pgmPrices: prices,
        variantCosts: variantCosts as Record<VariantTier, CostBreakdown>,
        variantMarket: variantMarket as Record<VariantTier, MarketEstimate>,
        benchmark,
      });
    },
    [variants.variants, variants.selectedTier, oemBaseline],
  );

  /* ---- Step 9: MOT/MOP — add a family member ---- */
  const addFamilyMember = useCallback((member: EngineFamilyMember) => {
    setSpecCardData((prev) => ({
      ...prev,
      familyMembers: [...prev.familyMembers, member],
      familyExpansion: null, // invalidate previous result
    }));
  }, []);

  /* ---- Step 9: MOT/MOP — remove a family member ---- */
  const removeFamilyMember = useCallback((engineCode: string) => {
    setSpecCardData((prev) => ({
      ...prev,
      familyMembers: prev.familyMembers.filter((m) => m.engineCode !== engineCode),
      familyExpansion: null,
    }));
  }, []);

  /* ---- Step 9: MOT/MOP — edit a family member field ---- */
  const updateFamilyMember = useCallback(
    (engineCode: string, field: keyof EngineFamilyMember, value: string | number) => {
      setSpecCardData((prev) => ({
        ...prev,
        familyMembers: prev.familyMembers.map((m) =>
          m.engineCode === engineCode ? { ...m, [field]: value } : m,
        ),
        familyExpansion: null,
      }));
    },
    [],
  );

  /* ---- Step 9: MOT/MOP — run expandEngineFamily ---- */
  const runFamilyExpansion = useCallback(() => {
    const { familyMembers } = specCardData;
    if (familyMembers.length < 2) {
      toast.error("Add at least 2 MOTs to run family expansion");
      return;
    }
    const selected = variants.variants.find((v) => v.tier === variants.selectedTier);
    if (!selected) {
      toast.error("Select a variant first");
      return;
    }
    setSpecCardData((prev) => ({ ...prev, familyExpansionLoading: true }));
    const [baseDesign, ...rest] = familyMembers;
    try {
      const result = expandEngineFamily({
        baseDesign,
        basePgmGPerBrick: selected.pgm.pdGPerBrick + selected.pgm.rhGPerBrick + selected.pgm.ptGPerBrick,
        baseVolumeL: selected.substrate.volumeL,
        familyMembers: rest,
      });
      setSpecCardData((prev) => ({ ...prev, familyExpansion: result, familyExpansionLoading: false }));
    } catch (e) {
      toast.error("Family expansion failed: " + (e instanceof Error ? e.message : String(e)));
      setSpecCardData((prev) => ({ ...prev, familyExpansionLoading: false }));
    }
  }, [specCardData, variants]);

  /* ---- Reset ---- */
  const resetWizard = useCallback(() => {
    setStep(0);
    setVehicleScope(initialVehicleScope());
    setOemRef(initialOemRef());
    setSystemDesign(initialSystemDesign());
    setVariants(initialVariants());
    setChemistry(initialChemistry());
    setWltpSim(initialWltpSim());
    setObdValidation(initialObdValidation());
    setEconomics(initialEconomics());
    setSpecCardData(initialSpecCardData());
    setAgingParamsState(initialAgingParams());
  }, []);

  return {
    step,
    goTo,
    next,
    prev,
    vehicleScope,
    setVehicleScope,
    matchedRows,
    oemRef,
    setOemRef,
    togglePin,
    pinnedRecords,
    oemBaseline,
    systemDesign,
    setSystemDesignParam,
    variants,
    selectVariant,
    updateVariantPgm,
    updateVariantOsc,
    updateVariantSubstrate,
    chemistry,
    setChemistry,
    setCePercent,
    updateChemistryLayer,
    agingParams,
    updateAgingParams,
    wltpSim,
    runWltpSim,
    setWltpEnginePreset,
    setWltpEmissionStandard,
    setWltpFuelSulfur,
    setWltpAmbientTemp,
    suggestWltpFix,
    applySuggestion,
    obdValidation,
    updateObdStrategy,
    updateExhaustFlow,
    updateLambdaFreq,
    economics,
    setEconomics,
    specCardData,
    addFamilyMember,
    removeFamilyMember,
    updateFamilyMember,
    runFamilyExpansion,
    submitVehicleScope,
    requestBaselineSummary,
    proceedToSystemDesign,
    generateAmVariants,
    requestVariantCommentary,
    proceedToChemistry,
    requestChemistryNotes,
    proceedToObdValidation,
    proceedToEconomics,
    recalcEconomics,
    resetWizard,
  };
}
