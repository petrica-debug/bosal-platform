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
import {
  computeCost,
  computeMarket,
  computeOemBaseline,
  computeWashcoatSpec,
  generateVariants,
  type OemBaseline,
} from "./variant-engine";
import type {
  AmVariant,
  ChemistrySpec,
  ComponentScope,
  CostBreakdown,
  EconomicsData,
  MarketEstimate,
  OemReferenceSelection,
  PgmPrices,
  TargetMarket,
  VariantSelection,
  VariantTier,
  VehicleScopeInput,
  WizardState,
} from "./wizard-types";

const MAX_PINNED = 12;

function initialVehicleScope(): VehicleScopeInput {
  return {
    brand: "all",
    engineSearch: "",
    emissionStandard: "all",
    componentScope: ["CC-TWC"],
    targetMarket: "EU-West",
    packagingConstraints: "",
  };
}

function initialOemRef(): OemReferenceSelection {
  return { pinnedIndices: [], aiBaselineSummary: null, baselineLoading: false };
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
  };
}

function initialEconomics(): EconomicsData {
  return {
    pgmPrices: { ...DEFAULT_PGM_PRICES },
    variantCosts: {} as Record<VariantTier, CostBreakdown>,
    variantMarket: {} as Record<VariantTier, MarketEstimate>,
  };
}

export function useWizard() {
  const [step, setStep] = useState(0);
  const [vehicleScope, setVehicleScope] = useState<VehicleScopeInput>(initialVehicleScope);
  const [oemRef, setOemRef] = useState<OemReferenceSelection>(initialOemRef);
  const [variants, setVariants] = useState<VariantSelection>(initialVariants);
  const [chemistry, setChemistry] = useState<ChemistrySpec>(initialChemistry);
  const [economics, setEconomics] = useState<EconomicsData>(initialEconomics);

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
    setStep(Math.max(0, Math.min(5, s)));
  }, []);

  const next = useCallback(() => setStep((s) => Math.min(5, s + 1)), []);
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

  /* ---- Step 2 → 3: generate variants ---- */
  const generateAmVariants = useCallback(() => {
    const emStd = vehicleScope.emissionStandard === "all"
      ? pinnedRecords[0]?.emissionStandard ?? "Euro 6d"
      : vehicleScope.emissionStandard;
    const vs = generateVariants(oemBaseline, emStd);
    setVariants({ variants: vs, selectedTier: null, aiLoading: false });
    next();
  }, [oemBaseline, vehicleScope.emissionStandard, pinnedRecords, next]);

  /* ---- Step 3: AI commentary for variants ---- */
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

  /* ---- Step 3: select variant ---- */
  const selectVariant = useCallback((tier: VariantTier) => {
    setVariants((p) => ({ ...p, selectedTier: tier }));
  }, []);

  /* ---- Step 3 → 4: compute chemistry ---- */
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
    });
    next();
  }, [variants, oemBaseline, next]);

  /* ---- Step 4: AI chemistry notes ---- */
  const requestChemistryNotes = useCallback(async () => {
    setChemistry((p) => ({ ...p, chemistryLoading: true, aiChemistryNotes: null }));
    const selected = variants.variants.find((v) => v.tier === variants.selectedTier);
    try {
      const res = await fetch("/api/am-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `For the selected ${selected?.label ?? "balanced"} variant (PGM ${selected?.pgm.totalGPerL ?? 0} g/L, OSC ratio ${selected?.oscRatio ?? 0}), provide washcoat chemistry recommendations: L1/L2 layer roles, OSC formulation choice, PGM impregnation strategy, and comparison to OEM fresh vs aged. Include supplier options (BASF, JM, Umicore).`,
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
  }, [variants, oemRef.pinnedIndices]);

  /* ---- Step 4 → 5: compute economics ---- */
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
      setEconomics({
        pgmPrices: p,
        variantCosts: variantCosts as Record<VariantTier, CostBreakdown>,
        variantMarket: variantMarket as Record<VariantTier, MarketEstimate>,
      });
      next();
    },
    [variants.variants, oemBaseline, next],
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
      setEconomics({
        pgmPrices: prices,
        variantCosts: variantCosts as Record<VariantTier, CostBreakdown>,
        variantMarket: variantMarket as Record<VariantTier, MarketEstimate>,
      });
    },
    [variants.variants, oemBaseline],
  );

  /* ---- Reset ---- */
  const resetWizard = useCallback(() => {
    setStep(0);
    setVehicleScope(initialVehicleScope());
    setOemRef(initialOemRef());
    setVariants(initialVariants());
    setChemistry(initialChemistry());
    setEconomics(initialEconomics());
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
    variants,
    selectVariant,
    chemistry,
    setChemistry,
    economics,
    setEconomics,
    submitVehicleScope,
    requestBaselineSummary,
    generateAmVariants,
    requestVariantCommentary,
    proceedToChemistry,
    requestChemistryNotes,
    proceedToEconomics,
    recalcEconomics,
    resetWizard,
  };
}
