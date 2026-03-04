/**
 * CATALYST DEACTIVATION & POISONING MODULE
 *
 * Models the mechanisms by which catalysts lose activity over their lifetime:
 *
 * 1. SULFUR POISONING — SO₂/SO₃ adsorbs on active sites (Pt, Pd, Cu-zeolite)
 * 2. PHOSPHORUS FOULING — P₂O₅ from lube oil forms glassy deposits
 * 3. THERMAL AGING (SINTERING) — PGM particle growth at high temperature
 * 4. CHEMICAL AGING — Zeolite dealumination, washcoat phase transformation
 * 5. MASKING — Ash, oil, zinc deposits blocking pore mouths
 *
 * Each mechanism is modeled as a deactivation function a(t) ∈ [0, 1]
 * where a = 1 is fresh and a = 0 is fully deactivated.
 *
 * The overall activity is: a_total = a_sulfur × a_phosphorus × a_thermal × a_chemical × a_masking
 *
 * References:
 * - Bartholomew (2001), "Mechanisms of catalyst deactivation"
 * - EPA IUCLID data for sulfur effects on PGM catalysts
 * - SAE 2010-01-1213 (phosphorus poisoning of SCR)
 */

// ============================================================
// SULFUR POISONING
// ============================================================

export interface SulfurPoisonParams {
  /** Sulfur sensitivity factor [0–1]: 1 = very sensitive (Pt), 0.3 = moderate (Cu-zeolite) */
  sensitivity: number;
  /** Sulfur adsorption rate constant [ppm⁻¹ · h⁻¹] */
  k_ads: number;
  /** Sulfur desorption activation energy [J/mol] — higher = harder to regenerate */
  Ea_des: number;
  /** Desorption pre-exponential [h⁻¹] */
  A_des: number;
  /** Maximum sulfur storage capacity [g_S / L_catalyst] */
  maxStorage_g_L: number;
  /** Regeneration temperature threshold [°C] */
  regenTemp_C: number;
}

export const SULFUR_PARAMS_DOC: SulfurPoisonParams = {
  sensitivity: 0.8,
  k_ads: 2.5e-4,
  Ea_des: 130000,
  A_des: 1e10,
  maxStorage_g_L: 5.0,
  regenTemp_C: 650,
};

export const SULFUR_PARAMS_SCR_CU: SulfurPoisonParams = {
  sensitivity: 0.5,
  k_ads: 1.0e-4,
  Ea_des: 100000,
  A_des: 5e8,
  maxStorage_g_L: 8.0,
  regenTemp_C: 550,
};

export const SULFUR_PARAMS_SCR_V: SulfurPoisonParams = {
  sensitivity: 0.2,
  k_ads: 5.0e-5,
  Ea_des: 80000,
  A_des: 1e7,
  maxStorage_g_L: 3.0,
  regenTemp_C: 400,
};

export const SULFUR_PARAMS_TWC: SulfurPoisonParams = {
  sensitivity: 0.7,
  k_ads: 2.0e-4,
  Ea_des: 120000,
  A_des: 5e9,
  maxStorage_g_L: 4.0,
  regenTemp_C: 600,
};

export const SULFUR_PARAMS_REFORMER: SulfurPoisonParams = {
  sensitivity: 1.0,
  k_ads: 1.0e-3,
  Ea_des: 200000,
  A_des: 1e15,
  maxStorage_g_L: 0.5,
  regenTemp_C: 900,
};

/**
 * Calculate sulfur poisoning deactivation.
 *
 * Sulfur accumulates on active sites following:
 * dθ_S/dt = k_ads × C_SO2 × (1 - θ_S) - k_des(T) × θ_S
 *
 * At steady state: θ_S = k_ads × C_SO2 / (k_ads × C_SO2 + k_des(T))
 *
 * Activity: a_S = 1 - sensitivity × θ_S
 */
export function sulfurDeactivation(
  SO2_ppm: number,
  T_C: number,
  exposureTime_h: number,
  params: SulfurPoisonParams
): { activity: number; sulfurLoading_g_L: number; isReversible: boolean } {
  const T_K = T_C + 273.15;
  const k_des = params.A_des * Math.exp(-params.Ea_des / (8.314 * T_K));

  // Sulfur coverage at quasi-steady state
  const k_ads_eff = params.k_ads * SO2_ppm;
  const theta_ss = k_ads_eff / (k_ads_eff + k_des + 1e-20);

  // Time-dependent approach to steady state
  const tau = 1 / (k_ads_eff + k_des + 1e-20);
  const theta = theta_ss * (1 - Math.exp(-exposureTime_h / tau));

  const activity = Math.max(0, 1 - params.sensitivity * theta);
  const sulfurLoading = theta * params.maxStorage_g_L;
  const isReversible = T_C >= params.regenTemp_C;

  return { activity, sulfurLoading_g_L: sulfurLoading, isReversible };
}

// ============================================================
// PHOSPHORUS FOULING
// ============================================================

export interface PhosphorusFoulingParams {
  /** P accumulation rate [mg_P / (L_cat · h)] at reference oil consumption */
  accumRate_mg_L_h: number;
  /** Critical P loading for significant deactivation [g_P / L_cat] */
  criticalLoading_g_L: number;
  /** Deactivation order (typically 0.5–1.0) */
  order: number;
  /** Whether P forms a surface layer (true) or penetrates washcoat (false) */
  surfaceOnly: boolean;
}

export const PHOSPHORUS_PARAMS_DEFAULT: PhosphorusFoulingParams = {
  accumRate_mg_L_h: 0.005,
  criticalLoading_g_L: 2.0,
  order: 0.7,
  surfaceOnly: true,
};

/**
 * Phosphorus fouling deactivation.
 *
 * P₂O₅ from engine oil (ZDDP additive) deposits on the catalyst front face
 * and penetrates into the washcoat pores, blocking active sites.
 *
 * Activity: a_P = 1 / (1 + (P_loading / P_critical)^n)
 */
export function phosphorusDeactivation(
  oilConsumption_g_kWh: number,
  P_content_ppm: number,
  power_kW: number,
  operatingHours: number,
  catalystVolume_L: number,
  params: PhosphorusFoulingParams = PHOSPHORUS_PARAMS_DEFAULT
): { activity: number; P_loading_g_L: number; penetrationDepth_um: number } {
  // P mass flow to catalyst [g/h]
  const P_flow_g_h = oilConsumption_g_kWh * power_kW * P_content_ppm * 1e-6;

  // Assume 30% of P in exhaust reaches the catalyst
  const captureEfficiency = 0.3;
  const P_loading = (P_flow_g_h * captureEfficiency * operatingHours) / catalystVolume_L / 1000;

  const activity = 1 / (1 + Math.pow(P_loading / params.criticalLoading_g_L, params.order));

  // Penetration depth: P diffuses ~0.5 µm per 1000 hours
  const penetrationDepth = Math.min(100, 0.5 * operatingHours / 1000);

  return { activity, P_loading_g_L: P_loading, penetrationDepth_um: penetrationDepth };
}

// ============================================================
// THERMAL AGING (SINTERING)
// ============================================================

export interface ThermalAgingParams {
  /** Sintering activation energy [J/mol] */
  Ea_sinter: number;
  /** Sintering rate constant at reference T [h⁻¹] */
  k_ref: number;
  /** Reference temperature [K] */
  T_ref_K: number;
  /** Sintering order (typically 2 for Ostwald ripening, 5–15 for particle migration) */
  sinteringOrder: number;
  /** Initial PGM particle size [nm] */
  initialParticleSize_nm: number;
  /** Maximum particle size [nm] (equilibrium) */
  maxParticleSize_nm: number;
}

export const THERMAL_AGING_PT: ThermalAgingParams = {
  Ea_sinter: 130000,
  k_ref: 1e-4,
  T_ref_K: 973,
  sinteringOrder: 8,
  initialParticleSize_nm: 2.5,
  maxParticleSize_nm: 50,
};

export const THERMAL_AGING_PD: ThermalAgingParams = {
  Ea_sinter: 140000,
  k_ref: 5e-5,
  T_ref_K: 973,
  sinteringOrder: 10,
  initialParticleSize_nm: 3.0,
  maxParticleSize_nm: 40,
};

export const THERMAL_AGING_RH: ThermalAgingParams = {
  Ea_sinter: 160000,
  k_ref: 2e-5,
  T_ref_K: 973,
  sinteringOrder: 12,
  initialParticleSize_nm: 1.5,
  maxParticleSize_nm: 20,
};

/**
 * Thermal aging via PGM sintering.
 *
 * Uses power-law sintering model (GPLE — Generalized Power Law Expression):
 * d(d)/dt = k_s × (d_max/d - 1) × d^(1-n)
 *
 * Simplified: dispersion loss follows
 * D(t)/D(0) = (1 + k_s × t)^(-1/n)
 *
 * Activity scales with dispersion: a_thermal = D(t)/D(0)
 */
export function thermalAging(
  T_C: number,
  exposureTime_h: number,
  params: ThermalAgingParams
): {
  activity: number;
  particleSize_nm: number;
  dispersionLoss_percent: number;
  equivalentAging_h_at_800C: number;
} {
  const T_K = T_C + 273.15;
  const k_s =
    params.k_ref *
    Math.exp((-params.Ea_sinter / 8.314) * (1 / T_K - 1 / params.T_ref_K));

  // Simplified GPLE: relative dispersion
  const n = params.sinteringOrder;
  const relativeDispersion = Math.pow(1 + k_s * exposureTime_h, -1 / n);

  const activity = Math.max(0.1, relativeDispersion);

  // Particle size growth
  const particleSize =
    params.initialParticleSize_nm / relativeDispersion;
  const clampedSize = Math.min(particleSize, params.maxParticleSize_nm);

  // Equivalent aging at 800°C (standard OEM aging reference)
  const k_800 =
    params.k_ref *
    Math.exp((-params.Ea_sinter / 8.314) * (1 / 1073.15 - 1 / params.T_ref_K));
  const equivalentHours = k_800 > 0 ? (k_s * exposureTime_h) / k_800 : 0;

  return {
    activity,
    particleSize_nm: clampedSize,
    dispersionLoss_percent: (1 - relativeDispersion) * 100,
    equivalentAging_h_at_800C: equivalentHours,
  };
}

// ============================================================
// CHEMICAL AGING (Zeolite dealumination for SCR)
// ============================================================

/**
 * Zeolite dealumination for Cu/Fe-zeolite SCR catalysts.
 *
 * At high temperatures (>700°C), the zeolite framework loses Al atoms,
 * destroying active Cu/Fe sites. This is irreversible.
 *
 * Modeled as: a_chem = exp(-k_deal × t)
 * where k_deal follows Arrhenius with very high Ea.
 */
export function zeoliteDealumination(
  T_C: number,
  exposureTime_h: number,
  zeoliteType: "CHA" | "BEA" | "MFI" = "CHA"
): { activity: number; frameworkIntegrity_percent: number } {
  const T_K = T_C + 273.15;

  const params: Record<string, { A: number; Ea: number }> = {
    CHA: { A: 1e8, Ea: 180000 },   // Cu-SSZ-13 (most hydrothermally stable)
    BEA: { A: 5e7, Ea: 150000 },   // Cu-Beta
    MFI: { A: 2e8, Ea: 160000 },   // Fe-ZSM-5
  };

  const p = params[zeoliteType];
  const k_deal = p.A * Math.exp(-p.Ea / (8.314 * T_K));
  const activity = Math.exp(-k_deal * exposureTime_h);
  const frameworkIntegrity = activity * 100;

  return { activity: Math.max(0.05, activity), frameworkIntegrity_percent: frameworkIntegrity };
}

// ============================================================
// COMBINED DEACTIVATION MODEL
// ============================================================

export interface DeactivationInputs {
  catalystType: "DOC" | "DPF" | "SCR" | "ASC" | "TWC";
  scrCatalystType?: "Cu-CHA" | "Cu-BEA" | "Fe-ZSM5" | "V2O5-WO3/TiO2";
  SO2_ppm: number;
  operatingTemp_C: number;
  maxTemp_C: number;
  operatingHours: number;
  oilConsumption_g_kWh: number;
  oilPhosphorus_ppm: number;
  power_kW: number;
  catalystVolume_L: number;
  fuelSulfur_ppm: number;
}

export interface DeactivationResult {
  overallActivity: number;
  sulfurActivity: number;
  phosphorusActivity: number;
  thermalActivity: number;
  chemicalActivity: number;
  sulfurLoading_g_L: number;
  phosphorusLoading_g_L: number;
  particleSize_nm: number;
  equivalentAging_h: number;
  endOfLife_hours: number;
  warrantyMargin_percent: number;
  warnings: string[];
}

/**
 * Combined catalyst deactivation assessment.
 *
 * Computes individual deactivation factors and combines them
 * multiplicatively to get overall remaining activity.
 */
export function assessDeactivation(
  inputs: DeactivationInputs
): DeactivationResult {
  const warnings: string[] = [];

  // Sulfur poisoning
  const sulfurParams =
    inputs.catalystType === "DOC" ? SULFUR_PARAMS_DOC :
    inputs.catalystType === "SCR" ? SULFUR_PARAMS_SCR_CU :
    inputs.catalystType === "TWC" ? SULFUR_PARAMS_TWC :
    SULFUR_PARAMS_DOC;

  const sulfur = sulfurDeactivation(
    inputs.SO2_ppm,
    inputs.operatingTemp_C,
    inputs.operatingHours,
    sulfurParams
  );

  if (sulfur.activity < 0.7) {
    warnings.push(
      `Significant sulfur poisoning detected (activity: ${(sulfur.activity * 100).toFixed(0)}%). ` +
      `Consider low-sulfur fuel (<10 ppm S) or periodic desulfation at >${sulfurParams.regenTemp_C}°C.`
    );
  }

  // Phosphorus fouling
  const phosphorus = phosphorusDeactivation(
    inputs.oilConsumption_g_kWh,
    inputs.oilPhosphorus_ppm,
    inputs.power_kW,
    inputs.operatingHours,
    inputs.catalystVolume_L
  );

  if (phosphorus.P_loading_g_L > 1.0) {
    warnings.push(
      `Phosphorus loading (${phosphorus.P_loading_g_L.toFixed(2)} g/L) approaching critical level. ` +
      `Reduce oil consumption or use low-P oil.`
    );
  }

  // Thermal aging
  const thermalParams =
    inputs.catalystType === "DOC" ? THERMAL_AGING_PT :
    inputs.catalystType === "TWC" ? THERMAL_AGING_PD :
    THERMAL_AGING_PT;

  const thermal = thermalAging(
    inputs.maxTemp_C,
    inputs.operatingHours,
    thermalParams
  );

  if (thermal.activity < 0.6) {
    warnings.push(
      `Severe thermal aging (${thermal.dispersionLoss_percent.toFixed(0)}% dispersion loss). ` +
      `PGM particle size grown to ${thermal.particleSize_nm.toFixed(1)} nm. ` +
      `Equivalent to ${thermal.equivalentAging_h_at_800C.toFixed(0)} h at 800°C.`
    );
  }

  // Chemical aging (SCR only)
  let chemicalActivity = 1.0;
  if (inputs.catalystType === "SCR" && inputs.scrCatalystType) {
    const zeoliteMap: Record<string, "CHA" | "BEA" | "MFI"> = {
      "Cu-CHA": "CHA",
      "Cu-BEA": "BEA",
      "Fe-ZSM5": "MFI",
    };
    const zt = zeoliteMap[inputs.scrCatalystType];
    if (zt) {
      const chem = zeoliteDealumination(inputs.maxTemp_C, inputs.operatingHours, zt);
      chemicalActivity = chem.activity;
      if (chem.frameworkIntegrity_percent < 70) {
        warnings.push(
          `Zeolite framework integrity at ${chem.frameworkIntegrity_percent.toFixed(0)}%. ` +
          `Dealumination is irreversible. Consider more thermally stable zeolite (CHA > BEA > MFI).`
        );
      }
    }
  }

  const overallActivity =
    sulfur.activity * phosphorus.activity * thermal.activity * chemicalActivity;

  // End-of-life estimate (when activity drops below 0.5)
  const decayRate = (1 - overallActivity) / Math.max(inputs.operatingHours, 1);
  const endOfLife = decayRate > 0 ? 0.5 / decayRate : 100000;

  // Warranty margin: how much activity remains vs. minimum required (50%)
  const warrantyMargin = ((overallActivity - 0.5) / 0.5) * 100;

  return {
    overallActivity,
    sulfurActivity: sulfur.activity,
    phosphorusActivity: phosphorus.activity,
    thermalActivity: thermal.activity,
    chemicalActivity,
    sulfurLoading_g_L: sulfur.sulfurLoading_g_L,
    phosphorusLoading_g_L: phosphorus.P_loading_g_L,
    particleSize_nm: thermal.particleSize_nm,
    equivalentAging_h: thermal.equivalentAging_h_at_800C,
    endOfLife_hours: endOfLife,
    warrantyMargin_percent: warrantyMargin,
    warnings,
  };
}
