/**
 * SPRAY / MIXER / NH₃ UNIFORMITY MODEL
 *
 * Physics-based model for urea spray injection, evaporation, decomposition,
 * and NH₃ distribution at the SCR catalyst front face.
 *
 * Covers:
 * 1. Injector spray characteristics (SMD, cone angle, penetration)
 * 2. Droplet evaporation and urea decomposition in the mixing pipe
 * 3. NH₃ distribution at SCR face (uniformity index)
 * 4. Alpha (ANR) distribution across the face
 * 5. Wall wetting and deposit risk
 *
 * References:
 * - Birkhold et al. (2007), "Modeling and simulation of urea-SCR"
 * - Koebel et al. (2000), "Urea-SCR: a promising technique"
 * - Kuhnke (2004), spray-wall interaction model
 */

// ============================================================
// INJECTOR / SPRAY TYPES
// ============================================================

export interface InjectorSpec {
  type: "single_hole" | "multi_hole" | "air_assisted" | "pressure_swirl";
  nozzleCount: number;
  holesDiameter_mm: number;
  sprayAngle_deg: number;
  injectionPressure_bar: number;
  /** Sauter Mean Diameter of droplets [µm] */
  SMD_um: number;
  /** DEF flow rate capacity [mL/min] */
  maxFlowRate_mL_min: number;
  mountAngle_deg: number;
}

export const INJECTOR_PRESETS: Record<string, InjectorSpec> = {
  bosch_denoxtronic_6_5: {
    type: "multi_hole",
    nozzleCount: 3,
    holesDiameter_mm: 0.15,
    sprayAngle_deg: 12,
    injectionPressure_bar: 5,
    SMD_um: 70,
    maxFlowRate_mL_min: 100,
    mountAngle_deg: 30,
  },
  continental_aquablue: {
    type: "air_assisted",
    nozzleCount: 1,
    holesDiameter_mm: 0.5,
    sprayAngle_deg: 25,
    injectionPressure_bar: 3,
    SMD_um: 40,
    maxFlowRate_mL_min: 150,
    mountAngle_deg: 45,
  },
  grundfos_nxs: {
    type: "pressure_swirl",
    nozzleCount: 1,
    holesDiameter_mm: 0.3,
    sprayAngle_deg: 20,
    injectionPressure_bar: 8,
    SMD_um: 55,
    maxFlowRate_mL_min: 200,
    mountAngle_deg: 30,
  },
  generic_single_hole: {
    type: "single_hole",
    nozzleCount: 1,
    holesDiameter_mm: 0.4,
    sprayAngle_deg: 15,
    injectionPressure_bar: 5,
    SMD_um: 90,
    maxFlowRate_mL_min: 80,
    mountAngle_deg: 30,
  },
};

// ============================================================
// MIXING PIPE GEOMETRY
// ============================================================

export interface MixingPipeConfig {
  pipeDiameter_mm: number;
  pipeLength_mm: number;
  injectorToSCR_mm: number;
  hasStaticMixer: boolean;
  mixerType?: "blade" | "swirl" | "tab" | "none";
  mixerPosition_mm?: number;
  hasSwirlFlap: boolean;
  pipeAngle_deg: number;
}

// ============================================================
// SPRAY PENETRATION
// ============================================================

/**
 * Spray penetration distance [mm] using Hiroyasu & Arai correlation.
 *
 * Before breakup: L = 0.39 × √(2ΔP/ρ_l) × t
 * After breakup:  L = 2.95 × (ΔP/ρ_g)^0.25 × √(d_0 × t)
 *
 * Simplified for DEF spray in exhaust:
 */
export function sprayPenetration(
  injector: InjectorSpec,
  exhaustTemp_C: number,
  exhaustDensity_kg_m3: number,
  time_ms: number
): number {
  const dP = injector.injectionPressure_bar * 1e5; // Pa
  const rho_l = 1090; // DEF density kg/m³
  const rho_g = exhaustDensity_kg_m3;
  const d0 = injector.holesDiameter_mm / 1000; // m
  const t = time_ms / 1000; // s

  // Breakup time
  const t_break = 28.65 * d0 * Math.sqrt(rho_l / dP);

  let penetration_m: number;
  if (t < t_break) {
    penetration_m = 0.39 * Math.sqrt(2 * dP / rho_l) * t;
  } else {
    penetration_m = 2.95 * Math.pow(dP / rho_g, 0.25) * Math.sqrt(d0 * t);
  }

  return penetration_m * 1000; // mm
}

// ============================================================
// DROPLET EVAPORATION
// ============================================================

export interface EvaporationResult {
  evaporationTime_ms: number;
  evaporationDistance_mm: number;
  evaporationComplete: boolean;
  residualDropletSize_um: number;
  wallImpingementRisk: boolean;
}

/**
 * Droplet evaporation model using d² law with mixer effects.
 *
 * d²(t) = d₀² - K × t
 * K = (8 × λ_g × ln(1 + B_M)) / (ρ_l × Cp_g)
 *
 * Mixer effects:
 * - Swirl mixer: increases effective path length by 1.5–2.5× (helical path)
 * - Blade mixer: reduces SMD by 30–50% via droplet impact breakup, but creates deposit risk
 * - Tab mixer: moderate path extension + some breakup
 *
 * Urea decomposition: HNCO + H₂O → NH₃ + CO₂ (hydrolysis, rate-limited below 300°C)
 */
export function calculateEvaporation(
  injector: InjectorSpec,
  pipe: MixingPipeConfig,
  exhaustTemp_C: number,
  exhaustVelocity_m_s: number,
  _exhaustDensity_kg_m3: number
): EvaporationResult {
  const T_K = exhaustTemp_C + 273.15;

  // Effective SMD after mixer impact
  let effectiveSMD_um = injector.SMD_um;
  if (pipe.hasStaticMixer) {
    if (pipe.mixerType === "blade") effectiveSMD_um *= 0.55; // blade impact breakup
    else if (pipe.mixerType === "swirl") effectiveSMD_um *= 0.85; // mild breakup
    else if (pipe.mixerType === "tab") effectiveSMD_um *= 0.70;
  }

  const d0 = effectiveSMD_um * 1e-6; // m

  // DEF properties
  const rho_l = 1090; // kg/m³
  const T_boil = 373.15; // K (water boiling)
  const h_fg = 2.26e6; // J/kg (latent heat of water)

  // Gas properties (temperature-dependent)
  const lambda_g = 0.026 + 5e-5 * (T_K - 300); // W/(m·K)
  const Cp_g = 1050 + 0.15 * (T_K - 300); // J/(kg·K)

  // Spalding number
  const B_M = Cp_g * (T_K - T_boil) / h_fg;
  const B_M_eff = Math.max(0.01, B_M);

  // Evaporation constant K [m²/s]
  const K = (8 * lambda_g * Math.log(1 + B_M_eff)) / (rho_l * Cp_g);

  // Evaporation time [s]
  const t_evap = d0 * d0 / K;
  const t_evap_ms = t_evap * 1000;

  // Effective path length (mixer extends the path)
  let pathLengthFactor = 1.0;
  if (pipe.hasStaticMixer) {
    if (pipe.mixerType === "swirl") pathLengthFactor = 2.2; // helical flow path
    else if (pipe.mixerType === "blade") pathLengthFactor = 1.3;
    else if (pipe.mixerType === "tab") pathLengthFactor = 1.6;
  }
  if (pipe.hasSwirlFlap) pathLengthFactor *= 1.4;

  const effectiveDistance_mm = pipe.injectorToSCR_mm * pathLengthFactor;

  // Droplet velocity (slower than gas, affected by mixer)
  const dropletVelocity = exhaustVelocity_m_s * 0.6;
  const evapDistance_mm = dropletVelocity * t_evap * 1000;

  const residenceTime_ms = (effectiveDistance_mm / 1000 / dropletVelocity) * 1000;

  let residualSize_um = 0;
  if (residenceTime_ms < t_evap_ms) {
    const fraction_evaporated = residenceTime_ms / t_evap_ms;
    residualSize_um = effectiveSMD_um * Math.sqrt(1 - fraction_evaporated);
  }

  // Wall impingement
  const sprayRadius_mm = pipe.injectorToSCR_mm * Math.tan((injector.sprayAngle_deg / 2) * Math.PI / 180);
  const wallImpingement = sprayRadius_mm > pipe.pipeDiameter_mm / 2 * 0.8;

  return {
    evaporationTime_ms: t_evap_ms,
    evaporationDistance_mm: evapDistance_mm,
    evaporationComplete: residenceTime_ms >= t_evap_ms,
    residualDropletSize_um: residualSize_um,
    wallImpingementRisk: wallImpingement,
  };
}

// ============================================================
// UREA DECOMPOSITION MODEL
// ============================================================

export interface SprayUreaDecompositionResult {
  /** Fraction of urea thermolyzed to HNCO + NH₃ [0–1] */
  thermolysisFraction: number;
  /** Fraction of HNCO hydrolyzed to NH₃ + CO₂ [0–1] */
  hydrolysisFraction: number;
  /** Overall urea-to-NH₃ conversion [0–1] */
  overallConversion: number;
  /** Fraction of undecomposed urea at SCR face [0–1] */
  undecomposedUreaFraction: number;
  /** HNCO slip at SCR face [fraction] */
  hncoSlipFraction: number;
  /** Deposit risk from incomplete decomposition */
  depositRisk: "low" | "moderate" | "high";
  /** Biuret/cyanuric acid formation risk */
  byproductRisk: "low" | "moderate" | "high";
}

/**
 * Model urea decomposition in the mixing section.
 *
 * Step 1: Thermolysis — (NH₂)₂CO → NH₃ + HNCO (starts ~150°C, fast above 250°C)
 * Step 2: Hydrolysis — HNCO + H₂O → NH₃ + CO₂ (needs catalyst or T > 350°C)
 *
 * Side reactions at low T: biuret, cyanuric acid, melamine (deposit precursors)
 */
export function calculateUreaDecomposition(
  exhaustTemp_C: number,
  residenceTime_ms: number,
  evaporationComplete: boolean,
  hasStaticMixer: boolean,
  mixerType?: string
): SprayUreaDecompositionResult {
  const T = exhaustTemp_C;

  // Thermolysis rate (Arrhenius-type, Ea ≈ 80 kJ/mol)
  const k_therm = 1e8 * Math.exp(-80000 / (8.314 * (T + 273.15)));
  const t_s = residenceTime_ms / 1000;
  const thermolysisFraction = Math.min(1, 1 - Math.exp(-k_therm * t_s));

  // Hydrolysis rate (slower, Ea ≈ 60 kJ/mol, enhanced by mixer surfaces)
  let k_hydro = 5e5 * Math.exp(-60000 / (8.314 * (T + 273.15)));
  if (hasStaticMixer) {
    // Mixer surfaces act as hydrolysis catalyst
    const surfaceFactor = mixerType === "blade" ? 2.0 : mixerType === "swirl" ? 1.5 : 1.3;
    k_hydro *= surfaceFactor;
  }
  const hydrolysisFraction = Math.min(1, 1 - Math.exp(-k_hydro * t_s));

  // Overall: thermolysis produces HNCO, hydrolysis converts HNCO to NH₃
  // First NH₃ from thermolysis (1 mol per mol urea) + second from hydrolysis
  const directNH3 = thermolysisFraction * 0.5; // 1 of 2 N atoms
  const hncoProduced = thermolysisFraction * 0.5;
  const hncoConverted = hncoProduced * hydrolysisFraction;
  const overallConversion = evaporationComplete ? directNH3 + hncoConverted : (directNH3 + hncoConverted) * 0.7;

  const undecomposed = 1 - thermolysisFraction;
  const hncoSlip = hncoProduced * (1 - hydrolysisFraction);

  // Deposit risk
  const depositRisk: "low" | "moderate" | "high" =
    T < 180 || (undecomposed > 0.3 && !evaporationComplete) ? "high" :
    T < 250 || undecomposed > 0.1 ? "moderate" : "low";

  // Byproduct risk (biuret forms at 190–250°C with incomplete evaporation)
  const byproductRisk: "low" | "moderate" | "high" =
    T >= 190 && T <= 280 && !evaporationComplete ? "high" :
    T >= 160 && T <= 300 && undecomposed > 0.05 ? "moderate" : "low";

  return {
    thermolysisFraction,
    hydrolysisFraction,
    overallConversion: Math.min(1, overallConversion),
    undecomposedUreaFraction: undecomposed,
    hncoSlipFraction: hncoSlip,
    depositRisk,
    byproductRisk,
  };
}

// ============================================================
// NH₃ UNIFORMITY AT SCR FACE
// ============================================================

export interface UniformityResult {
  /** Uniformity Index [0–1], target > 0.95 */
  uniformityIndex: number;
  /** NH₃ concentration map (normalized) on a grid */
  concentrationMap: number[][];
  /** Peak-to-mean ratio */
  peakToMean: number;
  /** Minimum local alpha (ANR) */
  minLocalAlpha: number;
  /** Maximum local alpha (ANR) */
  maxLocalAlpha: number;
  /** Standard deviation of alpha across face */
  alphaStdDev: number;
  /** Recommendations */
  recommendations: string[];
}

/**
 * Calculate NH₃ uniformity index at the SCR catalyst front face.
 *
 * Uses a Gaussian plume model for the spray distribution, modified by:
 * 1. Spray cone geometry
 * 2. Swirl/mixer-induced spreading
 * 3. Turbulent diffusion
 * 4. Pipe geometry effects
 *
 * The uniformity index (UI) is defined as:
 * UI = 1 - (1/2n) × Σ|c_i - c_mean| / c_mean
 *
 * where c_i is the local NH₃ concentration at cell i.
 *
 * @param gridSize Number of cells across the face (gridSize × gridSize)
 */
export function calculateNH3Uniformity(
  injector: InjectorSpec,
  pipe: MixingPipeConfig,
  exhaustTemp_C: number,
  exhaustMassFlow_kg_h: number,
  targetAlpha: number,
  gridSize: number = 15
): UniformityResult {
  const recommendations: string[] = [];

  // Exhaust properties
  const T_K = exhaustTemp_C + 273.15;
  const rho_g = 101325 / (287 * T_K);
  const pipeArea = Math.PI * (pipe.pipeDiameter_mm / 2000) ** 2;
  const velocity = (exhaustMassFlow_kg_h / 3600) / (rho_g * pipeArea);

  // Turbulent diffusion coefficient [m²/s]
  const Re = velocity * (pipe.pipeDiameter_mm / 1000) / (2e-5 / rho_g);
  const D_turb = 0.01 * velocity * (pipe.pipeDiameter_mm / 1000) * Math.pow(Re, -0.125);

  // Spray spreading
  const L = pipe.injectorToSCR_mm / 1000; // m
  const sprayHalfAngle = (injector.sprayAngle_deg / 2) * Math.PI / 180;
  const sprayRadius = L * Math.tan(sprayHalfAngle);

  // Effective spreading (spray + turbulent diffusion + mixer)
  const diffusionSpread = Math.sqrt(2 * D_turb * L / velocity);
  let mixerFactor = 1.0;
  if (pipe.hasStaticMixer) {
    mixerFactor = pipe.mixerType === "swirl" ? 2.5 :
                  pipe.mixerType === "blade" ? 2.0 :
                  pipe.mixerType === "tab" ? 1.8 : 1.5;
  }
  if (pipe.hasSwirlFlap) mixerFactor *= 1.3;

  const sigma = (sprayRadius + diffusionSpread) * mixerFactor;
  const pipeRadius = pipe.pipeDiameter_mm / 2000;

  // Injection point offset from center
  const mountAngleRad = injector.mountAngle_deg * Math.PI / 180;
  const injectionOffset = pipeRadius * 0.7 * Math.sin(mountAngleRad);

  // Generate concentration map using 2D Gaussian
  const map: number[][] = [];
  const dx = (2 * pipeRadius) / gridSize;

  for (let i = 0; i < gridSize; i++) {
    const row: number[] = [];
    for (let j = 0; j < gridSize; j++) {
      const x = -pipeRadius + (i + 0.5) * dx;
      const y = -pipeRadius + (j + 0.5) * dx;

      // Check if point is inside circular pipe
      const r = Math.sqrt(x * x + y * y);
      if (r > pipeRadius) {
        row.push(0);
        continue;
      }

      // Multi-hole injector: sum contributions from each hole
      let c = 0;
      for (let h = 0; h < injector.nozzleCount; h++) {
        const angle = (2 * Math.PI * h) / injector.nozzleCount;
        const holeOffset = sprayRadius * 0.3;
        const cx = injectionOffset + holeOffset * Math.cos(angle);
        const cy = holeOffset * Math.sin(angle);

        const dist2 = (x - cx) ** 2 + (y - cy) ** 2;
        c += Math.exp(-dist2 / (2 * sigma * sigma));
      }

      row.push(c);
    }
    map.push(row);
  }

  // Normalize and compute statistics
  let sum = 0;
  let count = 0;
  let max = 0;
  for (const row of map) {
    for (const v of row) {
      if (v > 0) {
        sum += v;
        count++;
        if (v > max) max = v;
      }
    }
  }
  const mean = count > 0 ? sum / count : 1;

  // Normalize map
  for (let i = 0; i < map.length; i++) {
    for (let j = 0; j < map[i].length; j++) {
      if (map[i][j] > 0) map[i][j] /= mean;
    }
  }

  // Uniformity Index
  let sumDev = 0;
  const alphaValues: number[] = [];
  for (const row of map) {
    for (const v of row) {
      if (v > 0) {
        sumDev += Math.abs(v - 1);
        alphaValues.push(v * targetAlpha);
      }
    }
  }
  const UI = Math.max(0, 1 - sumDev / (2 * count));

  const peakToMean = max / mean;
  const minAlpha = Math.min(...alphaValues.filter((a) => a > 0));
  const maxAlpha = Math.max(...alphaValues);
  const meanAlpha = alphaValues.reduce((s, v) => s + v, 0) / alphaValues.length;
  const variance = alphaValues.reduce((s, v) => s + (v - meanAlpha) ** 2, 0) / alphaValues.length;
  const stdDev = Math.sqrt(variance);

  // Recommendations
  if (UI < 0.90) {
    recommendations.push(`Uniformity Index (${(UI * 100).toFixed(1)}%) is below 90%. Consider adding a static mixer or increasing mixing length.`);
  }
  if (UI < 0.95 && !pipe.hasStaticMixer) {
    recommendations.push("Add a static mixer element (blade or swirl type) to improve NH₃ distribution.");
  }
  if (peakToMean > 2.0) {
    recommendations.push(`Peak/mean ratio (${peakToMean.toFixed(1)}) is high — risk of local over-dosing and NH₃ slip in center channels.`);
  }
  if (pipe.injectorToSCR_mm < 300) {
    recommendations.push("Mixing distance < 300 mm — insufficient for droplet evaporation and NH₃ spreading. Minimum 400 mm recommended.");
  }
  if (minAlpha < targetAlpha * 0.5) {
    recommendations.push(`Minimum local alpha (${minAlpha.toFixed(2)}) is less than 50% of target — peripheral channels will have poor DeNOₓ.`);
  }

  return {
    uniformityIndex: UI,
    concentrationMap: map,
    peakToMean,
    minLocalAlpha: minAlpha,
    maxLocalAlpha: maxAlpha,
    alphaStdDev: stdDev,
    recommendations,
  };
}

// ============================================================
// COMPLETE SPRAY SYSTEM ASSESSMENT
// ============================================================

export interface SpraySystemResult {
  evaporation: EvaporationResult;
  uniformity: UniformityResult;
  ureaDecomposition: SprayUreaDecompositionResult;
  sprayPenetration_mm: number;
  residenceTime_ms: number;
  wallFilmRisk: "low" | "moderate" | "high";
  depositFormationRisk: "low" | "moderate" | "high";
  overallRating: "excellent" | "good" | "marginal" | "poor";
  warnings: string[];
}

export function assessSpraySystem(
  injector: InjectorSpec,
  pipe: MixingPipeConfig,
  exhaustTemp_C: number,
  exhaustMassFlow_kg_h: number,
  targetAlpha: number
): SpraySystemResult {
  const warnings: string[] = [];

  const T_K = exhaustTemp_C + 273.15;
  const rho_g = 101325 / (287 * T_K);
  const pipeArea = Math.PI * (pipe.pipeDiameter_mm / 2000) ** 2;
  const velocity = (exhaustMassFlow_kg_h / 3600) / (rho_g * pipeArea);

  const penetration = sprayPenetration(injector, exhaustTemp_C, rho_g, 5);
  const evaporation = calculateEvaporation(injector, pipe, exhaustTemp_C, velocity, rho_g);
  const uniformity = calculateNH3Uniformity(injector, pipe, exhaustTemp_C, exhaustMassFlow_kg_h, targetAlpha);

  const residenceTime = (pipe.injectorToSCR_mm / 1000 / velocity) * 1000;

  const ureaDecomp = calculateUreaDecomposition(
    exhaustTemp_C, residenceTime, evaporation.evaporationComplete,
    pipe.hasStaticMixer, pipe.mixerType
  );

  // Wall film risk
  const wallFilmRisk: "low" | "moderate" | "high" =
    evaporation.wallImpingementRisk && exhaustTemp_C < 250 ? "high" :
    evaporation.wallImpingementRisk || exhaustTemp_C < 200 ? "moderate" : "low";

  // Deposit risk
  const depositRisk: "low" | "moderate" | "high" =
    exhaustTemp_C < 180 || (wallFilmRisk === "high" && !evaporation.evaporationComplete) ? "high" :
    exhaustTemp_C < 220 || wallFilmRisk === "moderate" ? "moderate" : "low";

  // Overall rating
  const score =
    (uniformity.uniformityIndex > 0.95 ? 3 : uniformity.uniformityIndex > 0.90 ? 2 : uniformity.uniformityIndex > 0.85 ? 1 : 0) +
    (evaporation.evaporationComplete ? 2 : evaporation.residualDropletSize_um < 20 ? 1 : 0) +
    (wallFilmRisk === "low" ? 2 : wallFilmRisk === "moderate" ? 1 : 0) +
    (depositRisk === "low" ? 1 : 0);

  const overallRating: SpraySystemResult["overallRating"] =
    score >= 7 ? "excellent" : score >= 5 ? "good" : score >= 3 ? "marginal" : "poor";

  if (wallFilmRisk === "high") {
    warnings.push("High wall film risk — urea spray reaches pipe wall before evaporating. Reduce spray angle or increase pipe diameter.");
  }
  if (depositRisk === "high") {
    warnings.push("High deposit formation risk — exhaust temperature too low for complete urea decomposition.");
  }
  if (!evaporation.evaporationComplete) {
    warnings.push(`Droplet evaporation incomplete — residual droplet size ${evaporation.residualDropletSize_um.toFixed(0)} µm at SCR face.`);
  }

  warnings.push(...uniformity.recommendations);

  if (ureaDecomp.undecomposedUreaFraction > 0.1) {
    warnings.push(`${(ureaDecomp.undecomposedUreaFraction * 100).toFixed(0)}% undecomposed urea at SCR face — risk of catalyst fouling and reduced DeNOₓ.`);
  }
  if (ureaDecomp.hncoSlipFraction > 0.05) {
    warnings.push(`HNCO slip: ${(ureaDecomp.hncoSlipFraction * 100).toFixed(1)}% — incomplete hydrolysis. Increase mixing length or temperature.`);
  }
  if (ureaDecomp.byproductRisk === "high") {
    warnings.push("High biuret/cyanuric acid formation risk — temperature in 190–280°C range with incomplete evaporation.");
  }

  return {
    evaporation,
    uniformity,
    ureaDecomposition: ureaDecomp,
    sprayPenetration_mm: penetration,
    residenceTime_ms: residenceTime,
    wallFilmRisk,
    depositFormationRisk: depositRisk,
    overallRating,
    warnings,
  };
}
