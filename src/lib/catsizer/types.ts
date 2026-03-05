// ============================================================
// DOMAIN 1: AUTOMOTIVE DEPOLLUTION
// ============================================================

export type EngineType = "diesel" | "gasoline" | "natural_gas" | "dual_fuel" | "biogas";
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

export interface WashcoatConfig {
  thickness_um: number;
  density_kg_m3: number;
  porosity: number;
  tortuosity: number;
  meanPoreDiameter_nm: number;
  BET_surfaceArea_m2_g: number;
  pgmLoading_g_ft3: number;
  pgmDispersion: number;
  pgmRatio?: { Pt: number; Pd: number; Rh: number };
}

export type SCRCatalystType = "Cu-CHA" | "Cu-BEA" | "Fe-ZSM5" | "V2O5-WO3/TiO2";

export interface CatalystChainElement {
  type: CatalystType;
  enabled: boolean;
  ghsvOverride?: number;
  substrate?: Partial<SubstrateParams>;
  washcoat?: Partial<WashcoatConfig>;
  scrCatalystType?: SCRCatalystType;
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
  | "desulfurizer"
  | "SMR"
  | "POX"
  | "ATR";

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
// WASHCOAT & KINETICS RESULTS
// ============================================================

export interface WashcoatAnalysis {
  effectiveDiffusivity_m2_s: number;
  thieleModulus: number;
  effectivenessFactor: number;
  regime: "kinetic" | "transitional" | "diffusion_limited";
  washcoatUtilization_percent: number;
}

export interface KineticsResult {
  CO_conversion_percent: number;
  HC_conversion_percent: number;
  NOx_conversion_percent: number;
  NH3_slip_ppm: number;
  NO2_NOx_outlet: number;
}

// ============================================================
// DEACTIVATION & AGING
// ============================================================

export interface AgingConfig {
  targetLife_hours: number;
  maxOperatingTemp_C: number;
  fuelSulfur_ppm: number;
  oilConsumption_g_kWh: number;
  oilPhosphorus_ppm: number;
  oilAsh_percent: number;
}

export interface AgingResult {
  overallActivity: number;
  sulfurActivity: number;
  phosphorusActivity: number;
  thermalActivity: number;
  chemicalActivity: number;
  endOfLife_hours: number;
  warrantyMargin_percent: number;
  agedConversion_percent: number;
  warnings: string[];
}

// ============================================================
// DPF ASSESSMENT
// ============================================================

export interface DPFConfig {
  material: "cordierite" | "silicon_carbide" | "aluminum_titanate";
  cellDensity_cpsi: number;
  wallThickness_mm: number;
  wallPorosity: number;
  meanPoreSize_um: number;
  hasCatalyticCoating: boolean;
  pgmLoading_g_ft3: number;
}

export interface DPFResult {
  sootLoading_g_L: number;
  filtrationEfficiency_percent: number;
  backpressure_kPa: number;
  passiveRegenRate_g_h: number;
  passiveRegenBalancePoint_C: number;
  activeRegenPeakTemp_C: number;
  activeRegenDuration_min: number;
  fuelPenalty_percent: number;
  thermalRunawayRisk: boolean;
  ashLoading_g_L: number;
  ashCapacityRemaining_percent: number;
  overallStatus: "normal" | "regen_needed" | "maintenance" | "critical";
  warnings: string[];
}

// ============================================================
// SCR SYSTEM
// ============================================================

export interface SCRConfig {
  catalystType: SCRCatalystType;
  targetDeNOx: number;
  maxNH3Slip_ppm: number;
  mixerLength_mm: number;
  pipeDiameter_mm: number;
  hasStaticMixer: boolean;
  hasSwirl: boolean;
  hasHydrolysisCatalyst: boolean;
}

export interface SCRResult {
  optimalANR: number;
  systemDeNOx_percent: number;
  NH3_slip_ppm: number;
  DEF_consumption_L_h: number;
  DEF_consumption_L_100km: number;
  specificDEF_percent_fuel: number;
  ureaDecomposition_percent: number;
  depositRisk: "low" | "moderate" | "high";
  nh3Storage_g_L: number;
  mixerUniformity: number;
  warnings: string[];
}

// ============================================================
// RFQ (Request for Quotation) OUTPUT
// ============================================================

export type TestCycle =
  | "WHTC"    // World Harmonized Transient Cycle
  | "WHSC"    // World Harmonized Stationary Cycle
  | "ESC"     // European Stationary Cycle
  | "ETC"     // European Transient Cycle
  | "FTP"     // Federal Test Procedure
  | "SET"     // Supplemental Emission Test
  | "NRTC"    // Non-Road Transient Cycle
  | "ISO_8178"; // ISO 8178 (gensets)

export interface SubstrateSpec {
  supplier: "Corning" | "NGK" | "Ibiden" | "Continental" | "Other";
  partNumber?: string;
  material: SubstrateMaterial;
  cellDensity_cpsi: number;
  wallThickness_mil: number;
  diameter_mm: number;
  length_mm: number;
  volume_L: number;
  OFA_percent: number;
  GSA_m2_L: number;
  hydraulicDiameter_mm: number;
  thermalShockResistance_C: number;
  maxOperatingTemp_C: number;
}

export interface WashcoatSpec {
  type: string;
  composition: string;
  loading_g_L: number;
  thickness_um: number;
  BET_m2_g: number;
  poreDiameter_nm: number;
  oxygenStorageCapacity_umol_g?: number;
}

export interface PGMSpec {
  totalLoading_g_ft3: number;
  totalLoading_g_L: number;
  Pt_g_ft3: number;
  Pd_g_ft3: number;
  Rh_g_ft3: number;
  Pt_Pd_ratio: string;
  dispersion_percent: number;
  estimatedCost_USD_per_unit: number;
}

export interface AgingSpec {
  protocol: string;
  temperature_C: number;
  duration_hours: number;
  equivalentMiles: number;
  equivalentHours: number;
  fuelSulfur_ppm: number;
  oilAsh_percent: number;
  agedConversionTarget_percent: number;
}

export interface WarrantySpec {
  warrantyPeriod_years: number;
  warrantyMiles: number;
  warrantyHours: number;
  fullUsefulLife_years: number;
  fullUsefulLife_miles: number;
  fullUsefulLife_hours: number;
  defectWarranty_years: number;
  performanceWarranty_years: number;
}

export interface TestCycleResult {
  cycle: TestCycle;
  NOx_g_kWh: number;
  PM_g_kWh: number;
  CO_g_kWh: number;
  HC_g_kWh: number;
  NH3_ppm: number;
  N2O_g_kWh: number;
  compliant: boolean;
}

export interface RFQCatalystItem {
  position: number;
  type: CatalystType;
  substrate: SubstrateSpec;
  washcoat: WashcoatSpec;
  pgm?: PGMSpec;
  canningDiameter_mm: number;
  canningLength_mm: number;
  canningMaterial: string;
  matMaterial: string;
  totalWeight_kg: number;
  GHSV_design_h: number;
  pressureDrop_kPa_clean: number;
  pressureDrop_kPa_aged: number;
  lightOffTemp_C_fresh: number;
  lightOffTemp_C_aged: number;
  freshConversion_percent: Record<string, number>;
  agedConversion_percent: Record<string, number>;
  washcoatAnalysis: WashcoatAnalysis;
}

export interface RFQOutput {
  projectInfo: {
    rfqNumber: string;
    date: string;
    customer: string;
    engineModel: string;
    application: Application;
    emissionStandard: EmissionStandard;
    annualVolume?: number;
  };

  engineData: EngineInputs;

  aftertreatmentSystem: {
    architecture: string;
    catalysts: RFQCatalystItem[];
    totalSystemLength_mm: number;
    totalSystemWeight_kg: number;
    totalPressureDrop_kPa: number;
    maxBackpressure_kPa: number;
  };

  dpfAssessment?: DPFResult;
  scrSystem?: SCRResult;

  aging: {
    protocol: AgingSpec;
    results: AgingResult;
  };

  compliance: {
    standard: EmissionStandard;
    testCycles: TestCycleResult[];
    overallCompliant: boolean;
  };

  warranty: WarrantySpec;

  costEstimate: {
    substrateCost_USD: number;
    washcoatCost_USD: number;
    pgmCost_USD: number;
    canningCost_USD: number;
    assemblyCost_USD: number;
    totalPerUnit_USD: number;
    pgmSensitivity: Array<{ pgmPrice_USD_oz: number; unitCost_USD: number }>;
  };

  recommendations: string[];
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
