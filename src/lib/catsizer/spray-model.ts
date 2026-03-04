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
 * Droplet evaporation model using d² law.
 *
 * d²(t) = d₀² - K × t
 * K = (8 × λ_g × ln(1 + B_M)) / (ρ_l × Cp_g)
 *
 * where B_M is the Spalding mass transfer number.
 */
export function calculateEvaporation(
  injector: InjectorSpec,
  pipe: MixingPipeConfig,
  exhaustTemp_C: number,
  exhaustVelocity_m_s: number,
  exhaustDensity_kg_m3: number
): EvaporationResult {
  const T_K = exhaustTemp_C + 273.15;
  const d0 = injector.SMD_um * 1e-6; // m

  // DEF properties
  const rho_l = 1090; // kg/m³
  const T_boil = 373.15; // K (water boiling)
  const h_fg = 2.26e6; // J/kg (latent heat of water)

  // Gas properties
  const lambda_g = 0.04; // W/(m·K) exhaust thermal conductivity
  const Cp_g = 1100; // J/(kg·K)

  // Spalding number
  const B_M = Cp_g * (T_K - T_boil) / h_fg;
  const B_M_eff = Math.max(0.01, B_M);

  // Evaporation constant K [m²/s]
  const K = (8 * lambda_g * Math.log(1 + B_M_eff)) / (rho_l * Cp_g);

  // Evaporation time [s]
  const t_evap = d0 * d0 / K;
  const t_evap_ms = t_evap * 1000;

  // Distance traveled during evaporation
  const dropletVelocity = exhaustVelocity_m_s * 0.6; // droplets slower than gas
  const evapDistance_mm = dropletVelocity * t_evap * 1000;

  // Check if evaporation completes before reaching SCR face
  const availableDistance = pipe.injectorToSCR_mm;
  const residenceTime_ms = (availableDistance / 1000 / dropletVelocity) * 1000;

  let residualSize_um = 0;
  if (residenceTime_ms < t_evap_ms) {
    const fraction_evaporated = residenceTime_ms / t_evap_ms;
    residualSize_um = injector.SMD_um * Math.sqrt(1 - fraction_evaporated);
  }

  // Wall impingement: spray reaches pipe wall before evaporating
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

  return {
    evaporation,
    uniformity,
    sprayPenetration_mm: penetration,
    residenceTime_ms: residenceTime,
    wallFilmRisk,
    depositFormationRisk: depositRisk,
    overallRating,
    warnings,
  };
}
