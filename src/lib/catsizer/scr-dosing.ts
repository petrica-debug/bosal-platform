/**
 * SCR UREA DOSING & NH₃ MANAGEMENT MODULE
 *
 * Models the complete SCR urea injection system:
 * 1. DEF (Diesel Exhaust Fluid) / AdBlue consumption
 * 2. Urea decomposition (thermolysis + hydrolysis)
 * 3. NH₃ storage on zeolite surface
 * 4. NH₃ slip control
 * 5. ANR (Ammonia-to-NOx Ratio) optimization
 * 6. Mixer efficiency and deposit risk
 *
 * DEF is 32.5% urea in deionized water (ISO 22241).
 * Urea decomposes: (NH₂)₂CO → NH₃ + HNCO → 2NH₃ + CO₂
 *
 * References:
 * - Koebel et al. (2000), "Urea-SCR: a promising technique"
 * - Birkhold et al. (2007), "Modeling and simulation of urea-SCR"
 * - SAE 2011-01-1317 (NH₃ slip control strategies)
 */

// ============================================================
// DEF / AdBlue PROPERTIES
// ============================================================

export const DEF_PROPERTIES = {
  ureaConcentration: 0.325,       // 32.5% by mass
  density_kg_L: 1.09,             // at 20°C
  freezingPoint_C: -11,
  boilingPoint_C: 133,
  NH3_per_urea_mol: 2,            // 1 mol urea → 2 mol NH₃
  urea_MW: 60.06,                 // g/mol
  NH3_MW: 17.031,                 // g/mol
};

// ============================================================
// UREA DECOMPOSITION
// ============================================================

export interface UreaDecompositionResult {
  thermolysisEfficiency: number;   // [0–1]
  hydrolysisEfficiency: number;    // [0–1]
  overallConversion: number;       // [0–1]
  NH3_yield: number;               // mol NH₃ per mol urea injected
  depositRisk: "low" | "moderate" | "high";
  HNCO_slip_ppm: number;          // Isocyanic acid slip
}

/**
 * Urea decomposition model.
 *
 * Step 1: Thermolysis — (NH₂)₂CO → NH₃ + HNCO (T > 160°C)
 * Step 2: Hydrolysis — HNCO + H₂O → NH₃ + CO₂ (T > 200°C, catalyzed)
 *
 * Below 200°C, incomplete decomposition leads to solid deposits
 * (biuret, cyanuric acid, melamine) that block the mixer and catalyst face.
 */
export function ureaDecomposition(
  T_C: number,
  mixerEfficiency: number = 0.90,
  hasHydrolysisCatalyst: boolean = true
): UreaDecompositionResult {
  // Thermolysis: sigmoid activation around 200°C
  const thermolysis = 1 / (1 + Math.exp(-(T_C - 200) / 20));

  // Hydrolysis: requires catalyst or high temperature
  const hydrolysis = hasHydrolysisCatalyst
    ? 1 / (1 + Math.exp(-(T_C - 220) / 15))
    : 1 / (1 + Math.exp(-(T_C - 350) / 30));

  const overallConversion = thermolysis * hydrolysis * mixerEfficiency;
  const NH3_yield = overallConversion * 2; // 2 mol NH₃ per mol urea

  // Deposit risk: high below 200°C, moderate 200–250°C, low above 250°C
  const depositRisk: "low" | "moderate" | "high" =
    T_C < 200 ? "high" : T_C < 250 ? "moderate" : "low";

  // HNCO slip: unreacted isocyanic acid passes through
  const HNCO_slip = (1 - hydrolysis) * thermolysis * 50; // ppm estimate

  return {
    thermolysisEfficiency: thermolysis,
    hydrolysisEfficiency: hydrolysis,
    overallConversion,
    NH3_yield,
    depositRisk,
    HNCO_slip_ppm: HNCO_slip,
  };
}

// ============================================================
// ANR (Ammonia-to-NOx Ratio) OPTIMIZATION
// ============================================================

export interface ANROptimizationResult {
  optimalANR: number;
  NOx_conversion_percent: number;
  NH3_slip_ppm: number;
  DEF_consumption_L_h: number;
  DEF_consumption_L_100km: number;
  specificDEF_percent_fuel: number;
  operatingWindow: {
    minANR: number;
    maxANR: number;
    description: string;
  };
}

/**
 * Optimize ANR (Ammonia-to-NOx Ratio) for target DeNOx with minimum NH₃ slip.
 *
 * Stoichiometric ANR:
 * - Standard SCR: ANR = 1.0 (4NO + 4NH₃ + O₂ → 4N₂ + 6H₂O)
 * - Fast SCR:     ANR = 1.0 (NO + NO₂ + 2NH₃ → 2N₂ + 3H₂O)
 *
 * In practice, ANR = 0.9–1.1 is used.
 * Higher ANR → higher DeNOx but more NH₃ slip.
 *
 * @param targetDeNOx Target NOx conversion [0–1]
 * @param NO2_NOx_ratio NO₂/NOₓ ratio at SCR inlet [0–1]
 */
export function optimizeANR(
  T_C: number,
  NOx_ppm: number,
  NO2_NOx_ratio: number,
  Q_Nm3_h: number,
  targetDeNOx: number = 0.95,
  maxNH3_slip_ppm: number = 10,
  fuelConsumption_L_h: number = 0,
  speed_km_h: number = 0
): ANROptimizationResult {
  // Fast SCR fraction: depends on NO₂/NOₓ ratio
  // Optimal at NO₂/NOₓ = 0.5 (equimolar NO:NO₂)
  const fastSCR_fraction = Math.min(2 * NO2_NOx_ratio, 2 * (1 - NO2_NOx_ratio));

  // Temperature-dependent maximum achievable conversion
  const T_K = T_C + 273.15;
  const k_eff = 1e6 * Math.exp(-45000 / (8.314 * T_K));
  const maxConversion = Math.min(0.99, 1 - Math.exp(-k_eff * 0.001));

  // Optimal ANR: slightly above stoichiometric to ensure target DeNOx
  const baseANR = targetDeNOx / maxConversion;
  const optimalANR = Math.max(0.8, Math.min(1.2, baseANR * 1.02));

  // Actual NOx conversion at optimal ANR
  const actualDeNOx = Math.min(maxConversion, optimalANR * maxConversion * 0.98);

  // NH₃ slip: excess NH₃ that passes through
  const excessNH3_fraction = Math.max(0, optimalANR - actualDeNOx);
  const NH3_slip = excessNH3_fraction * NOx_ppm;

  // DEF consumption
  // NH₃ needed = NOx_ppm × Q_Nm3_h × ANR × 1e-6 [Nm³/h]
  // Convert to mol/h, then to urea mass, then to DEF volume
  const NH3_mol_h = NOx_ppm * 1e-6 * Q_Nm3_h * 1000 / 22.414 * optimalANR;
  const urea_mol_h = NH3_mol_h / 2;
  const urea_mass_h = urea_mol_h * DEF_PROPERTIES.urea_MW / 1000; // kg/h
  const DEF_mass_h = urea_mass_h / DEF_PROPERTIES.ureaConcentration; // kg/h
  const DEF_L_h = DEF_mass_h / DEF_PROPERTIES.density_kg_L;

  // DEF per 100 km
  const DEF_L_100km = speed_km_h > 0 ? (DEF_L_h / speed_km_h) * 100 : 0;

  // DEF as % of fuel consumption
  const specificDEF = fuelConsumption_L_h > 0 ? (DEF_L_h / fuelConsumption_L_h) * 100 : 0;

  return {
    optimalANR,
    NOx_conversion_percent: actualDeNOx * 100,
    NH3_slip_ppm: Math.min(maxNH3_slip_ppm * 2, NH3_slip),
    DEF_consumption_L_h: DEF_L_h,
    DEF_consumption_L_100km: DEF_L_100km,
    specificDEF_percent_fuel: specificDEF,
    operatingWindow: {
      minANR: optimalANR * 0.85,
      maxANR: optimalANR * 1.10,
      description:
        NO2_NOx_ratio > 0.4 && NO2_NOx_ratio < 0.6
          ? "Optimal NO₂/NOₓ ratio for fast SCR. High DeNOx achievable."
          : NO2_NOx_ratio < 0.2
          ? "Low NO₂/NOₓ — standard SCR dominant. Consider DOC optimization for more NO₂."
          : "High NO₂/NOₓ — NO₂-SCR pathway active. Watch for ammonium nitrate formation below 200°C.",
    },
  };
}

// ============================================================
// NH₃ STORAGE MODEL (Zeolite surface)
// ============================================================

export interface NH3StorageResult {
  storedNH3_g_L: number;
  surfaceCoverage: number;        // θ [0–1]
  maxStorage_g_L: number;
  storageEfficiency_percent: number;
  coldStartReserve_seconds: number;
  desorptionTemp_C: number;
}

/**
 * NH₃ storage on SCR catalyst surface.
 *
 * Cu-zeolite and Fe-zeolite catalysts store NH₃ on acid sites.
 * This stored NH₃ provides a buffer during transient operation
 * (e.g., tip-in acceleration where NOx spikes before DEF can respond).
 *
 * Storage capacity depends on temperature:
 * - Low T (150°C): high capacity (~5 g/L)
 * - High T (450°C): low capacity (~0.5 g/L)
 */
export function calculateNH3Storage(
  T_C: number,
  ANR: number,
  catalystVolume_L: number,
  scrType: "Cu-CHA" | "Cu-BEA" | "Fe-ZSM5" | "V2O5-WO3/TiO2" = "Cu-CHA"
): NH3StorageResult {
  // Maximum storage capacity [g_NH3/L_cat] — temperature dependent
  const storageCapacity: Record<string, { a: number; b: number; c: number }> = {
    "Cu-CHA":          { a: 6.0, b: 0.012, c: 200 },
    "Cu-BEA":          { a: 5.0, b: 0.010, c: 180 },
    "Fe-ZSM5":         { a: 4.5, b: 0.011, c: 190 },
    "V2O5-WO3/TiO2":  { a: 3.0, b: 0.015, c: 160 },
  };

  const p = storageCapacity[scrType];
  const maxStorage = p.a * Math.exp(-p.b * Math.max(0, T_C - p.c));

  // Surface coverage depends on ANR and temperature
  const theta = Math.min(1, ANR * 0.8 * Math.exp(-0.005 * Math.max(0, T_C - 200)));

  const storedNH3 = theta * maxStorage;

  // Cold start reserve: how many seconds of NOx reduction from stored NH₃
  // Assuming 500 ppm NOx, 1000 Nm³/h exhaust
  const coldStartReserve = (storedNH3 * catalystVolume_L) / (0.5 * 17.031 / 22414 * 1000) * 3600;

  // Desorption temperature: T at which stored NH₃ starts releasing
  const desorptionTemp = 300 + (1 - theta) * 200;

  return {
    storedNH3_g_L: storedNH3,
    surfaceCoverage: theta,
    maxStorage_g_L: maxStorage,
    storageEfficiency_percent: theta * 100,
    coldStartReserve_seconds: Math.max(0, coldStartReserve),
    desorptionTemp_C: desorptionTemp,
  };
}

// ============================================================
// MIXER DESIGN ASSESSMENT
// ============================================================

export interface MixerAssessment {
  uniformityIndex: number;         // UI [0–1], target > 0.95
  dropletEvaporation_percent: number;
  wallWetting_percent: number;
  depositRisk: "low" | "moderate" | "high";
  recommendedMixerLength_mm: number;
  recommendations: string[];
}

/**
 * Assess urea mixer design adequacy.
 *
 * The mixer must:
 * 1. Atomize DEF spray into fine droplets (<50 µm SMD)
 * 2. Evaporate water and decompose urea before reaching catalyst face
 * 3. Distribute NH₃ uniformly across the catalyst cross-section
 * 4. Prevent wall wetting (leads to solid deposits)
 */
export function assessMixer(
  exhaustTemp_C: number,
  exhaustFlow_kg_h: number,
  pipeDiameter_mm: number,
  mixerLength_mm: number,
  DEF_rate_L_h: number,
  hasStaticMixer: boolean = true,
  hasSwirl: boolean = false
): MixerAssessment {
  const recommendations: string[] = [];

  // Droplet evaporation: depends on temperature and residence time
  const pipeArea = Math.PI * (pipeDiameter_mm / 2000) ** 2;
  const exhaustDensity = 101325 / (287 * (exhaustTemp_C + 273.15));
  const velocity = (exhaustFlow_kg_h / 3600) / (exhaustDensity * pipeArea);
  const residenceTime_ms = (mixerLength_mm / 1000 / velocity) * 1000;

  // Evaporation: needs ~50ms at 350°C, ~20ms at 500°C
  const evapTime_ms = 100 * Math.exp(-0.005 * exhaustTemp_C);
  const evaporation = Math.min(1, residenceTime_ms / evapTime_ms);

  // Uniformity index: depends on mixer design
  let UI = 0.80; // baseline without mixer
  if (hasStaticMixer) UI += 0.10;
  if (hasSwirl) UI += 0.05;
  if (residenceTime_ms > 50) UI += 0.03;
  UI = Math.min(0.99, UI);

  // Wall wetting: risk increases with high DEF rate and low temperature
  const wallWetting = Math.max(0, (DEF_rate_L_h * 100 / (exhaustFlow_kg_h + 1)) - 0.1) * (1 - evaporation) * 100;

  // Deposit risk
  const depositRisk: "low" | "moderate" | "high" =
    exhaustTemp_C < 200 || wallWetting > 10 ? "high" :
    exhaustTemp_C < 250 || wallWetting > 5 ? "moderate" : "low";

  // Recommended mixer length
  const recommendedLength = evapTime_ms * velocity * 1000 * 1.5;

  if (UI < 0.93) {
    recommendations.push("Uniformity index below 0.93 — consider adding a static mixer element.");
  }
  if (wallWetting > 5) {
    recommendations.push("Wall wetting risk detected — increase mixer length or add anti-wetting coating.");
  }
  if (evaporation < 0.9) {
    recommendations.push("Incomplete droplet evaporation — increase mixing length or use finer spray nozzle.");
  }
  if (depositRisk === "high") {
    recommendations.push("High deposit risk — exhaust temperature too low for reliable urea decomposition.");
  }

  return {
    uniformityIndex: UI,
    dropletEvaporation_percent: evaporation * 100,
    wallWetting_percent: wallWetting,
    depositRisk,
    recommendedMixerLength_mm: Math.max(mixerLength_mm, recommendedLength),
    recommendations,
  };
}

// ============================================================
// COMPLETE SCR SYSTEM ASSESSMENT
// ============================================================

export interface SCRSystemResult {
  anr: ANROptimizationResult;
  decomposition: UreaDecompositionResult;
  nh3Storage: NH3StorageResult;
  mixer: MixerAssessment;
  systemDeNOx_percent: number;
  tailpipeNH3_ppm: number;
  tailpipeNOx_ppm: number;
  warnings: string[];
}

export function assessSCRSystem(
  T_C: number,
  NOx_ppm: number,
  NO2_NOx_ratio: number,
  Q_Nm3_h: number,
  exhaustFlow_kg_h: number,
  catalystVolume_L: number,
  pipeDiameter_mm: number,
  mixerLength_mm: number,
  scrType: "Cu-CHA" | "Cu-BEA" | "Fe-ZSM5" | "V2O5-WO3/TiO2" = "Cu-CHA",
  targetDeNOx: number = 0.95,
  fuelConsumption_L_h: number = 0,
  speed_km_h: number = 0
): SCRSystemResult {
  const warnings: string[] = [];

  const anr = optimizeANR(T_C, NOx_ppm, NO2_NOx_ratio, Q_Nm3_h, targetDeNOx, 10, fuelConsumption_L_h, speed_km_h);
  const decomposition = ureaDecomposition(T_C);
  const nh3Storage = calculateNH3Storage(T_C, anr.optimalANR, catalystVolume_L, scrType);
  const mixer = assessMixer(T_C, exhaustFlow_kg_h, pipeDiameter_mm, mixerLength_mm, anr.DEF_consumption_L_h);

  // System-level DeNOx: accounts for decomposition efficiency and mixer uniformity
  const systemDeNOx = (anr.NOx_conversion_percent / 100) * decomposition.overallConversion * mixer.uniformityIndex;
  const tailpipeNOx = NOx_ppm * (1 - systemDeNOx);
  const tailpipeNH3 = anr.NH3_slip_ppm * decomposition.overallConversion;

  if (T_C < 200) {
    warnings.push("Exhaust temperature below 200°C — SCR inactive. Consider exhaust heating strategy.");
  }
  if (decomposition.depositRisk === "high") {
    warnings.push("High urea deposit risk — reduce DEF injection or increase exhaust temperature.");
  }
  if (tailpipeNH3 > 10) {
    warnings.push(`NH₃ slip (${tailpipeNH3.toFixed(1)} ppm) exceeds 10 ppm limit. Add or upsize ASC.`);
  }
  if (NO2_NOx_ratio < 0.2) {
    warnings.push("Low NO₂/NOₓ ratio — DOC may be undersized or sulfur-poisoned. Fast SCR pathway underutilized.");
  }

  return {
    anr,
    decomposition,
    nh3Storage,
    mixer,
    systemDeNOx_percent: systemDeNOx * 100,
    tailpipeNH3_ppm: tailpipeNH3,
    tailpipeNOx_ppm: tailpipeNOx,
    warnings,
  };
}
