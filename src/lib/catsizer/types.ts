// ============================================================
// DOMAIN 1: AUTOMOTIVE DEPOLLUTION
// ============================================================

export type EngineType = "diesel" | "natural_gas" | "dual_fuel" | "biogas";
export type Application =
  | "heavy_duty_onroad"
  | "heavy_duty_offroad"
  | "genset"
  | "marine";
export type LoadProfile = "constant" | "variable" | "peaking" | "standby";

export interface EngineInputs {
  engineType: EngineType;
  application: Application;
  displacement_L: number;
  ratedPower_kW: number;
  ratedSpeed_rpm: number;
  peakTorque_Nm: number;
  numberOfCylinders: number;
  exhaustFlowRate_kg_h: number;
  exhaustTemp_C: number;
  exhaustPressure_kPa: number;
  ambientTemp_C: number;
  altitude_m: number;
  CO_ppm: number;
  HC_ppm: number;
  NOx_ppm: number;
  NO2_fraction: number;
  PM_mg_Nm3: number;
  SO2_ppm: number;
  O2_percent: number;
  H2O_percent: number;
  CO2_percent: number;
  loadProfile?: LoadProfile;
  fuelConsumption_kg_h?: number;
}

export type CatalystType = "DOC" | "DPF" | "SCR" | "ASC" | "TWC";
export type SubstrateMaterial = "cordierite" | "silicon_carbide" | "metallic";
export type FilterType = "wall_flow" | "flow_through";

export interface SubstrateParams {
  material: SubstrateMaterial;
  cellDensity_cpsi: number;
  wallThickness_mil: number;
  openFrontalArea_fraction: number;
  geometricSurfaceArea_m2_L: number;
  hydraulicDiameter_mm: number;
  diameter_mm: number;
  length_mm: number;
  filterType?: FilterType;
  porosity?: number;
  meanPoreSize_um?: number;
}

export type EmissionStandard =
  | "euro_vi_e"
  | "epa_tier4_final"
  | "eu_stage_v"
  | "imo_tier_iii"
  | "ta_luft"
  | "custom";

export interface EmissionLimits {
  standard: EmissionStandard;
  NOx_g_kWh?: number;
  PM_g_kWh?: number;
  CO_g_kWh?: number;
  HC_g_kWh?: number;
  NOx_g_Nm3?: number;
  PM_g_Nm3?: number;
  CO_g_Nm3?: number;
  HC_g_Nm3?: number;
}

export interface CatalystChainElement {
  type: CatalystType;
  enabled: boolean;
  ghsvOverride?: number;
  substrate?: Partial<SubstrateParams>;
}

export interface CatalystSizingResult {
  type: CatalystType;
  requiredVolume_L: number;
  selectedVolume_L: number;
  diameter_mm: number;
  length_mm: number;
  numberOfSubstrates: number;
  cellDensity_cpsi: number;
  wallThickness_mil: number;
  material: string;
  GHSV_design: number;
  pressureDrop_kPa: number;
  expectedConversion_percent: number;
  lightOffTemp_C: number;
  washcoatLoading_g_L: number;
  preciousMetalLoading_g_ft3: number;
  weight_kg: number;
  canDiameter_mm: number;
  canLength_mm: number;
}

export interface ComplianceResult {
  standard: string;
  NOx_compliant: boolean;
  PM_compliant: boolean;
  CO_compliant: boolean;
  HC_compliant: boolean;
  tailpipeNOx_g_kWh: number;
  tailpipePM_g_kWh: number;
  tailpipeCO_g_kWh: number;
  tailpipeHC_g_kWh: number;
}

export interface DepollutionSizingResult {
  catalysts: CatalystSizingResult[];
  totalPressureDrop_kPa: number;
  totalWeight_kg: number;
  totalLength_mm: number;
  maxDiameter_mm: number;
  compliance: ComplianceResult;
  exhaustFlowRate_Nm3_h: number;
  exhaustFlowRate_actual_m3_h: number;
  warnings: string[];
}

// ============================================================
// DOMAIN 2: H₂ PRODUCTION FOR SOFC
// ============================================================

export type FuelType =
  | "pipeline_natural_gas"
  | "biogas"
  | "landfill_gas"
  | "pure_methane"
  | "associated_gas";

export type ReformingStrategy =
  | "SMR"
  | "POX"
  | "ATR"
  | "internal"
  | "indirect_internal";

export interface FuelInputs {
  fuelType: FuelType;
  CH4_percent: number;
  C2H6_percent: number;
  C3H8_percent: number;
  CO2_percent: number;
  N2_percent: number;
  H2S_ppm: number;
  siloxanes_ppm?: number;
  fuelFlowRate_Nm3_h: number;
  fuelPressure_kPa: number;
  fuelTemp_C: number;
  SOFC_power_kW: number;
  SOFC_fuelUtilization: number;
  SOFC_operatingTemp_C: number;
  SOFC_currentDensity_A_cm2: number;
  reformingStrategy: ReformingStrategy;
  steamToCarbonRatio: number;
  oxygenToCarbonRatio?: number;
  targetCH4_CO_ratio?: number;
}

export type CatalystBedStage =
  | "pre_reformer"
  | "main_reformer"
  | "HT_WGS"
  | "LT_WGS"
  | "desulfurizer";

export interface CatalystBedResult {
  stage: CatalystBedStage;
  catalystType: string;
  GHSV: number;
  volume_L: number;
  diameter_mm: number;
  length_mm: number;
  weight_kg: number;
  bedVoidFraction: number;
  pressureDrop_kPa: number;
  inletTemp_C: number;
  outletTemp_C: number;
}

export interface ReformateComposition {
  H2_percent: number;
  CO_percent: number;
  CO2_percent: number;
  CH4_percent: number;
  H2O_percent: number;
  N2_percent: number;
}

export type CarbonRisk = "low" | "moderate" | "high";

export interface ReformerSizingResult {
  reformingStrategy: string;
  steamToCarbonRatio: number;
  oxygenToCarbonRatio?: number;
  reformerInletTemp_C: number;
  reformerOutletTemp_C: number;
  reformerPressure_kPa: number;
  reformateComposition: ReformateComposition;
  CH4_CO_ratio: number;
  H2_CO_ratio: number;
  CH4_conversion_percent: number;
  catalystBeds: CatalystBedResult[];
  reformerHeatDuty_kW: number;
  WGS_heatRelease_kW: number;
  netHeatDuty_kW: number;
  H2_production_Nm3_h: number;
  H2_yield_mol_per_mol_CH4: number;
  carbonFormationRisk: CarbonRisk;
  minimumSCRatio_noCarbon: number;
  SOFC_fuelFlow_Nm3_h: number;
  SOFC_estimatedPower_kW: number;
  systemEfficiency_percent: number;
  warnings: string[];
}

// ============================================================
// SENSITIVITY ANALYSIS
// ============================================================

export interface SensitivityPoint {
  parameterValue: number;
  outputValues: Record<string, number>;
}

export interface SensitivityResult {
  parameterName: string;
  parameterUnit: string;
  points: SensitivityPoint[];
  baselineIndex: number;
}
