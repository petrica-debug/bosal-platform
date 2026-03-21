import type { EcsComponentRecord } from "@/lib/catsizer/oem-database/types";
import type { FullAgingPrediction } from "@/lib/catsizer/catalyst-chemistry";
import type { MultiCycleResult, ObdStrategy } from "@/lib/catsizer/obd-simulation";
import type { SystemDesignResult, SystemArchitecture } from "@/lib/catsizer/system-design";
import type { FamilyExpansionResult, R103ScopeResult, EngineFamilyMember } from "@/lib/catsizer/family-expansion";
import type { ValidationResult } from "@/lib/catsizer/design-rules";
import type { TestPlanResult } from "@/lib/catsizer/test-plan-generator";
import type { BenchmarkResult } from "@/lib/catsizer/competitor-bench";
import type { TransientSimResult, WLTPEmissionStandard } from "@/lib/catsizer/wltp-transient-engine";

/* ------------------------------------------------------------------ */
/*  Step 1 — Vehicle & Scope                                          */
/* ------------------------------------------------------------------ */

export type ComponentScope =
  | "CC-TWC"
  | "UF-TWC"
  | "GPF"
  | "DOC"
  | "DPF"
  | "SCR";

export type TargetMarket =
  | "EU-West"
  | "EU-East"
  | "Turkey"
  | "MENA"
  | "Global";

export interface VehicleScopeInput {
  brand: string;
  engineSearch: string;
  emissionStandard: string;
  componentScope: ComponentScope[];
  targetMarket: TargetMarket;
  packagingConstraints: string;
  /** L3: selected system architecture */
  systemArchitecture: SystemArchitecture;
  /** Fuel type filter for OEM database matching */
  fuelType: "gasoline" | "diesel" | "hybrid" | "all";
}

/* ------------------------------------------------------------------ */
/*  Step 2 — OEM Reference                                            */
/* ------------------------------------------------------------------ */

export interface OemReferenceSelection {
  pinnedIndices: number[];
  aiBaselineSummary: string | null;
  baselineLoading: boolean;
}

/* ------------------------------------------------------------------ */
/*  Step 3 — System Design (NEW)                                      */
/* ------------------------------------------------------------------ */

export interface SystemDesignData {
  result: SystemDesignResult | null;
  /** Rated exhaust flow used for BP and SV calculations (kg/h) */
  exhaustFlowKgPerH: number;
  /** OEM system backpressure limit (kPa) */
  oemBackpressureKPa: number;
}

/* ------------------------------------------------------------------ */
/*  Step 4 — AM Design Variants (enhanced)                            */
/* ------------------------------------------------------------------ */

export type VariantTier = "performance" | "balanced" | "value";

export interface PgmSplit {
  pdGPerL: number;
  rhGPerL: number;
  ptGPerL: number;
  totalGPerL: number;
  totalGPerFt3: number;
  pdGPerBrick: number;
  rhGPerBrick: number;
  ptGPerBrick: number;
  pdRhRatio: number;
}

export interface SubstrateSpec {
  diameterMm: number;
  lengthMm: number;
  volumeL: number;
  cpsi: number;
  wallMil: number;
  material: "ceramic" | "metallic";
}

export type OBDRisk = "LOW" | "MEDIUM" | "HIGH";

export interface AmVariant {
  tier: VariantTier;
  label: string;
  pgmDeratingFactor: [number, number];
  oscDeratingFactor: [number, number];
  pgm: PgmSplit;
  oscTargetGPerL: number;
  oscRatio: number;
  substrate: SubstrateSpec;
  obdRisk: OBDRisk;
  obdNote: string;
  aiCommentary: string | null;
  /** L3: full aging prediction */
  agingPrediction: FullAgingPrediction | null;
}

export interface VariantSelection {
  variants: AmVariant[];
  selectedTier: VariantTier | null;
  aiLoading: boolean;
}

/* ------------------------------------------------------------------ */
/*  Step 5 — Chemistry & Washcoat (enhanced)                          */
/* ------------------------------------------------------------------ */

export interface WashcoatLayerSpec {
  aluminaGPerL: number;
  oscGPerL: number;
  oscCePercent: number;
  baoGPerL: number;
  la2o3GPerL: number;
  nd2o3GPerL: number;
  totalGPerL: number;
}

export interface ChemistrySpec {
  layer1: WashcoatLayerSpec;
  layer2: WashcoatLayerSpec;
  totalWashcoatGPerL: number;
  oscFormulation: string;
  aiChemistryNotes: string | null;
  chemistryLoading: boolean;
  /** L3: Ce:Zr slider value (Ce%) */
  cePercent: number;
}

/* ------------------------------------------------------------------ */
/*  Aging Parameters (user-adjustable)                                */
/* ------------------------------------------------------------------ */

export interface AgingParams {
  /** Aging protocol label */
  protocol: "RAT-A" | "ZDAKW" | "Bosal-bench" | "Custom";
  agingTempC: number;
  agingHours: number;
  /** Exhaust flow for light-off / SV calc */
  exhaustFlowKgPerH: number;
}

/* ------------------------------------------------------------------ */
/*  Step 6 — WLTP Simulation (NEW)                                    */
/* ------------------------------------------------------------------ */

export interface WltpSimulationData {
  result: TransientSimResult | null;
  isRunning: boolean;
  /** True when chemistry/variants changed after last run — triggers auto re-run */
  isStale: boolean;
  /** Index into LIGHT_DUTY_PRESETS */
  enginePresetIndex: number;
  emissionStandard: WLTPEmissionStandard;
  /** Fuel sulfur content (ppm). EU standard = 10. */
  fuelSulfurPpm: number;
  /** Ambient / cold-start temperature (°C). Standard = 23, medium = 14, cold = -7. */
  ambientTempC: number;
  /** Lambda oscillation frequency for OBD coupling (Hz) */
  lambdaFreqHz: number;
}

/* ------------------------------------------------------------------ */
/*  Step 7 — OBD & Validation                                         */
/* ------------------------------------------------------------------ */

export interface ObdValidationData {
  obdStrategy: ObdStrategy;
  multiCycleResult: MultiCycleResult | null;
  designValidation: ValidationResult | null;
  exhaustFlowKgPerH: number;
  /** Lambda oscillation frequency for OBD simulation (Hz) */
  lambdaFreqHz: number;
}

/* ------------------------------------------------------------------ */
/*  Step 7 — Economics & Market (enhanced)                            */
/* ------------------------------------------------------------------ */

export interface PgmPrices {
  pdEurPerG: number;
  rhEurPerG: number;
  ptEurPerG: number;
}

export interface CostBreakdown {
  pgmCostPerBrick: number;
  substrateCost: number;
  washcoatCost: number;
  canningCost: number;
  totalBom: number;
  targetRetail: number;
}

export interface MarketEstimate {
  euAnnualVolume: number;
  amPenetrationPct: number;
  amAnnualUnits: number;
  revenueEur: number;
}

export interface EconomicsData {
  pgmPrices: PgmPrices;
  variantCosts: Record<VariantTier, CostBreakdown>;
  variantMarket: Record<VariantTier, MarketEstimate>;
  /** L3: competitor benchmarking */
  benchmark: BenchmarkResult | null;
}

/* ------------------------------------------------------------------ */
/*  Step 8 — Spec Card & Test Plan (enhanced)                         */
/* ------------------------------------------------------------------ */

export interface SpecCard {
  partNumber: string;
  targetEngine: string;
  emissionStd: string;
  oemReference: string;
  substrate: SubstrateSpec;
  washcoatL1: WashcoatLayerSpec;
  washcoatL2: WashcoatLayerSpec;
  pgm: PgmSplit;
  t50CoCTarget: number;
  t50HcCTarget: number;
  oscGPerL: number;
  oscRatio: number;
  backpressureKpa: number | null;
  obdRisk: OBDRisk;
  obdNote: string;
  cost: CostBreakdown;
  testVehicle: string;
  r103Scope: string;
  agingProtocol: string;
}

export interface SpecCardData {
  /** L3: R103 test plan */
  testPlan: TestPlanResult | null;
  /** L3: engine family expansion result (wired from expandEngineFamily) */
  familyExpansion: FamilyExpansionResult | null;
  /** L3: R103 scope optimization */
  r103Scope: R103ScopeResult | null;
  /** L3: engine family members — user-editable MOT list */
  familyMembers: EngineFamilyMember[];
  /** True while expandEngineFamily is computing */
  familyExpansionLoading: boolean;
}

/* ------------------------------------------------------------------ */
/*  Wizard Steps & State                                              */
/* ------------------------------------------------------------------ */

export const WIZARD_STEPS = [
  { label: "Vehicle & scope", description: "Select target application" },
  { label: "OEM reference", description: "Review OEM baseline" },
  { label: "System design", description: "Multi-brick architecture" },
  { label: "AM variants", description: "Compare design options" },
  { label: "Chemistry", description: "Washcoat & aging" },
  { label: "WLTP simulation", description: "Transient cycle pass/fail" },
  { label: "OBD & validation", description: "OBD simulation & rules" },
  { label: "Economics", description: "Cost, market & competitors" },
  { label: "Spec & test plan", description: "Export & R103 plan" },
] as const;

export interface WizardState {
  step: number;
  vehicleScope: VehicleScopeInput;
  matchedRows: { record: EcsComponentRecord; globalIndex: number }[];
  oemRef: OemReferenceSelection;
  systemDesign: SystemDesignData;
  variants: VariantSelection;
  chemistry: ChemistrySpec;
  wltpSim: WltpSimulationData;
  obdValidation: ObdValidationData;
  economics: EconomicsData;
  specCardData: SpecCardData;
  /** User-adjustable aging protocol for live recalculation */
  agingParams: AgingParams;
}
