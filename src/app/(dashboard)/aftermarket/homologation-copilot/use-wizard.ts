"use client";

import { useCallback, useMemo, useState } from "react";
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
import { optimizeR103Scope, type EngineFamilyMember } from "@/lib/catsizer/family-expansion";
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
} from "./wizard-types";

const MAX_PINNED = 12;
const TOTAL_STEPS = 8;

function initialVehicleScope(): VehicleScopeInput {
  return {
    brand: "all",
    engineSearch: "",
    emissionStandard: "all",
    componentScope: ["CC-TWC"],
    targetMarket: "EU-West",
    packagingConstraints: "",
    systemArchitecture: "CC-TWC-only",
  };
}

function initialOemRef(): OemReferenceSelection {
  return { pinnedIndices: [], aiBaselineSummary: null, baselineLoading: false };
}

function initialSystemDesign(): SystemDesignData {
  return { result: null };
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

function initialObdValidation(): ObdValidationData {
  return { obdStrategy: "amplitude", multiCycleResult: null, designValidation: null, exhaustFlowKgPerH: 120 };
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
  return { testPlan: null, familyExpansion: null, r103Scope: null, familyMembers: [] };
}

export function useWizard() {
  const [step, setStep] = useState(0);
  const [vehicleScope, setVehicleScope] = useState<VehicleScopeInput>(initialVehicleScope);
  const [oemRef, setOemRef] = useState<OemReferenceSelection>(initialOemRef);
  const [systemDesign, setSystemDesign] = useState<SystemDesignData>(initialSystemDesign);
  const [variants, setVariants] = useState<VariantSelection>(initialVariants);
  const [chemistry, setChemistry] = useState<ChemistrySpec>(initialChemistry);
  const [obdValidation, setObdValidation] = useState<ObdValidationData>(initialObdValidation);
  const [economics, setEconomics] = useState<EconomicsData>(initialEconomics);
  const [specCardData, setSpecCardData] = useState<SpecCardData>(initialSpecCardData);
  const [agingParams, setAgingParamsState] = useState<AgingParams>(initialAgingParams);

  /* ---- Step 1: filter ECS rows ---- */
  const matchedRows: EcsFilteredRow[] = useMemo(
    () =>
      filterEcsWithGlobalIndices({
        search: vehicleScope.engineSearch,
        fuel: "all",
        emissionStandard: vehicleScope.emissionStandard,
        brand: vehicleScope.brand,
      }),
    [vehicleScope.engineSearch, vehicleScope.emissionStandard, vehicleScope.brand],
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
        fuel: "all",
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

  /* ---- Step 2 → 3: compute system design ---- */
  const proceedToSystemDesign = useCallback(() => {
    const arch = vehicleScope.systemArchitecture;
    const result = designSystem({
      architecture: arch,
      totalPgmBudgetGPerL: oemBaseline.totalPgmGPerL * 0.60,
      totalOscBudgetGPerL: oemBaseline.totalOscGPerL * 0.65,
      ratedExhaustFlowKgPerH: 120,
      oemBackpressureKPa: 8,
    });
    setSystemDesign({ result });
    next();
  }, [vehicleScope.systemArchitecture, oemBaseline, next]);

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
    },
    [],
  );

  /* ---- Step 6: update OBD strategy ---- */
  const updateObdStrategy = useCallback((strategy: ObdValidationData["obdStrategy"]) => {
    setObdValidation((prev) => ({ ...prev, obdStrategy: strategy }));
  }, []);

  /* ---- Step 6: update exhaust flow ---- */
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
    setChemistry((p) => ({ ...p, cePercent: ce }));
    setVariants((vPrev) => ({
      ...vPrev,
      variants: recomputeAllAging(vPrev.variants, ce, agingParams),
    }));
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

  /* ---- Step 5 → 6: OBD simulation & design validation ---- */
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

    setObdValidation({ obdStrategy: obdValidation.obdStrategy, multiCycleResult: mc, designValidation: dv, exhaustFlowKgPerH: obdValidation.exhaustFlowKgPerH });
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

      const familyMembers: EngineFamilyMember[] = pinnedRecords.slice(0, 5).map((r) => ({
        engineCode: String(r.engineCodes ?? r.engineFamily ?? "Unknown"),
        displacementCc: (parseFloat(String(r.displacementL ?? "1.0")) || 1.0) * 1000,
        powerKw: parseFloat(String(r.powerKw ?? "100")) || 100,
        maxExhaustTempC: 850,
        inertiaClassKg: 1500,
        vehicleModel: String(r.vehicleExamples ?? ""),
      }));

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
        agingProtocol: "RAT-A (EU standard)",
        agingTempC: 1050,
        agingHours: 12,
        targetMileageKm: 160_000,
        fuelType: "gasoline",
        type6Required: vehicleScope.componentScope.includes("CC-TWC"),
      });

      setSpecCardData({ testPlan, familyExpansion: null, r103Scope, familyMembers });
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

  /* ---- Reset ---- */
  const resetWizard = useCallback(() => {
    setStep(0);
    setVehicleScope(initialVehicleScope());
    setOemRef(initialOemRef());
    setSystemDesign(initialSystemDesign());
    setVariants(initialVariants());
    setChemistry(initialChemistry());
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
    obdValidation,
    updateObdStrategy,
    updateExhaustFlow,
    economics,
    setEconomics,
    specCardData,
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
