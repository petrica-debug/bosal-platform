import type { EcsComponentRecord } from "@/lib/catsizer/oem-database/types";

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
/*  Step 3 — AM Design Variants                                       */
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
}

export interface VariantSelection {
  variants: AmVariant[];
  selectedTier: VariantTier | null;
  aiLoading: boolean;
}

/* ------------------------------------------------------------------ */
/*  Step 4 — Chemistry & Washcoat                                     */
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
}

/* ------------------------------------------------------------------ */
/*  Step 5 — Economics & Market                                       */
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
}

/* ------------------------------------------------------------------ */
/*  Step 6 — Spec Card                                                */
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

/* ------------------------------------------------------------------ */
/*  Wizard State                                                      */
/* ------------------------------------------------------------------ */

export const WIZARD_STEPS = [
  { label: "Vehicle & scope", description: "Select target application" },
  { label: "OEM reference", description: "Review OEM baseline" },
  { label: "AM variants", description: "Compare design options" },
  { label: "Chemistry", description: "Washcoat specification" },
  { label: "Economics", description: "Cost & market sizing" },
  { label: "Spec card", description: "Export final specification" },
] as const;

export interface WizardState {
  step: number;
  vehicleScope: VehicleScopeInput;
  matchedRows: { record: EcsComponentRecord; globalIndex: number }[];
  oemRef: OemReferenceSelection;
  variants: VariantSelection;
  chemistry: ChemistrySpec;
  economics: EconomicsData;
}
