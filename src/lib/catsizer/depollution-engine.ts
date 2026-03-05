import { UNITS, T_STP, P_STP, volumeFlowSTPtoActual } from "./units";
import {
  exhaustComposition,
  gasViscosity,
  gasDensity,
  mixtureMW,
} from "./gas-properties";
import {
  getDesignGHSV,
  LIGHT_OFF_TEMPS,
  TYPICAL_CONVERSIONS,
  WASHCOAT_DEFAULTS,
  SUBSTRATE_DENSITY,
  EMISSION_STANDARDS,
  AFR_STOICHIOMETRIC,
} from "./constants";
import type {
  EngineInputs,
  CatalystChainElement,
  CatalystSizingResult,
  ComplianceResult,
  DepollutionSizingResult,
  EmissionStandard,
  CatalystType,
} from "./types";

// ============================================================
// EXHAUST FLOW RATE CALCULATION
// ============================================================

export function calculateExhaustFlow(inputs: EngineInputs): {
  massFlow_kg_h: number;
  volumeFlow_Nm3_h: number;
  volumeFlow_actual_m3_h: number;
} {
  let massFlow_kg_h = inputs.exhaustFlowRate_kg_h;

  // If not directly provided, estimate from fuel consumption
  if (massFlow_kg_h <= 0 && inputs.fuelConsumption_kg_h) {
    const afr =
      AFR_STOICHIOMETRIC[inputs.engineType] ?? 14.6;
    // Actual AFR is higher than stoichiometric for lean engines
    const actualAFR = afr * (1 + inputs.O2_percent / 21);
    massFlow_kg_h = inputs.fuelConsumption_kg_h * (1 + actualAFR);
  }

  // If still zero, estimate from displacement
  if (massFlow_kg_h <= 0) {
    const volEff = 0.85; // Typical volumetric efficiency
    const Q_m3_h =
      (inputs.displacement_L / 1000) *
      (inputs.ratedSpeed_rpm / 2) *
      60 *
      volEff;
    const rho_STP = 1.293; // kg/Nm³
    massFlow_kg_h = Q_m3_h * rho_STP;
  }

  // Exhaust gas composition for MW calculation
  const comp = exhaustComposition(inputs);
  const mw = mixtureMW(comp);
  const rho_STP = (P_STP * 1000 * mw) / (8314.462 * T_STP); // kg/m³ at STP

  const volumeFlow_Nm3_h = massFlow_kg_h / rho_STP;

  const T_actual_K = UNITS.C_to_K(inputs.exhaustTemp_C);
  const volumeFlow_actual_m3_h = volumeFlowSTPtoActual(
    volumeFlow_Nm3_h,
    T_actual_K,
    inputs.exhaustPressure_kPa
  );

  return { massFlow_kg_h, volumeFlow_Nm3_h, volumeFlow_actual_m3_h };
}

// ============================================================
// MONOLITH SUBSTRATE GEOMETRY
// ============================================================

export function substrateGeometry(cellDensity_cpsi: number, wallThickness_mil: number) {
  const cellPitch_mm =
    25.4 / Math.sqrt(cellDensity_cpsi); // mm per cell
  const wallThickness_mm = wallThickness_mil * UNITS.mil_to_mm;
  const channelWidth_mm = cellPitch_mm - wallThickness_mm;

  const ofa =
    (channelWidth_mm / cellPitch_mm) ** 2;

  // GSA: geometric surface area [m²/L]
  // For square channels: GSA = 4 × OFA / d_h × 1000
  const hydraulicDiameter_mm = channelWidth_mm; // Square channel: d_h = side length
  const gsa = (4 * ofa) / (hydraulicDiameter_mm / 1000) / 1000;

  return {
    cellPitch_mm,
    channelWidth_mm,
    wallThickness_mm,
    openFrontalArea: ofa,
    geometricSurfaceArea_m2_L: gsa,
    hydraulicDiameter_mm,
  };
}

// ============================================================
// PRESSURE DROP: HAGEN-POISEUILLE FOR MONOLITH
// ============================================================

function monolithPressureDrop(
  Q_actual_m3_s: number,
  length_m: number,
  diameter_m: number,
  cellDensity_cpsi: number,
  wallThickness_mil: number,
  T_K: number,
  P_kPa: number,
  composition: Record<string, number>,
  isWallFlow: boolean
): number {
  const geo = substrateGeometry(cellDensity_cpsi, wallThickness_mil);
  const A_frontal = Math.PI * (diameter_m / 2) ** 2;

  const cellsPerM2 = cellDensity_cpsi * UNITS.cpsi_to_cells_cm2 * 1e4;
  const nCells = cellsPerM2 * A_frontal;

  const A_cell = (geo.channelWidth_mm / 1000) ** 2; // m²
  const d_h = geo.hydraulicDiameter_mm / 1000; // m

  const mu = gasViscosity(T_K, composition);

  // Hagen-Poiseuille for laminar flow in square channels:
  // ΔP = 28.46 × μ × u × L / d_h²  where u = Q / (n × A_cell)
  // Combined: ΔP = 28.46 × μ × L × Q / (n × A_cell × d_h²)
  const dP_channel =
    (28.46 * mu * Q_actual_m3_s * length_m) /
    (nCells * A_cell * d_h * d_h);

  if (isWallFlow) {
    // Wall-flow DPF: half channels are inlet, half outlet.
    // Channel ΔP is already calculated for all channels — for wall-flow,
    // the effective channel length is doubled (inlet + outlet) but flow
    // splits, so the channel ΔP is roughly 2× the flow-through value.
    const dP_channel_wf = dP_channel * 2;

    // Wall resistance (Darcy's law through porous wall):
    // ΔP_wall = μ × Q × t_w / (A_filtration × κ)
    // A_filtration = n_inlet × perimeter × L = (nCells/2) × 4 × d_h × L
    const wallThickness_m = geo.wallThickness_mm / 1000;
    const permeability = 2e-13; // m² (typical clean SiC DPF)
    const nInlet = nCells / 2;
    const A_filtration = nInlet * 4 * d_h * length_m;
    const dP_wall =
      (mu * Q_actual_m3_s * wallThickness_m) /
      (A_filtration * permeability);

    // Contraction/expansion losses (~30% of channel loss for wall-flow)
    const dP_ce = dP_channel_wf * 0.3;

    return (dP_channel_wf + dP_wall + dP_ce) / 1000; // Pa → kPa
  }

  return dP_channel / 1000; // Pa → kPa
}

// ============================================================
// SINGLE CATALYST SIZING
// ============================================================

function sizeSingleCatalyst(
  type: CatalystType,
  Q_Nm3_h: number,
  Q_actual_m3_h: number,
  T_K: number,
  P_kPa: number,
  composition: Record<string, number>,
  application: string,
  ghsvOverride?: number,
  substrateOverride?: {
    cellDensity_cpsi?: number;
    wallThickness_mil?: number;
    material?: string;
    diameter_mm?: number;
  }
): CatalystSizingResult {
  const warnings: string[] = [];

  // GHSV
  const ghsv = ghsvOverride ?? getDesignGHSV(type, application);

  // Required volume: V = Q_STP / GHSV (GHSV is always at STP)
  const Q_L_h = Q_Nm3_h * 1000; // Nm³/h → L/h (STP)
  const requiredVolume_L = Q_L_h / ghsv;

  // Substrate parameters
  const cellDensity = substrateOverride?.cellDensity_cpsi ?? (type === "DPF" ? 200 : 400);
  const wallThickness = substrateOverride?.wallThickness_mil ?? (type === "DPF" ? 8 : 4);
  const material = (substrateOverride?.material ?? (type === "DPF" ? "silicon_carbide" : "cordierite")) as
    | "cordierite"
    | "silicon_carbide"
    | "metallic";

  // Select standard diameter (round up to nearest standard)
  const standardDiameters = [143, 171, 229, 267, 305, 356, 381, 432]; // mm
  let diameter_mm = substrateOverride?.diameter_mm ?? 0;
  if (diameter_mm <= 0) {
    // Target L/D ratio: flow-through ~1.0–1.5, DPF ~1.0–1.3 (wide & short for soot distribution)
    const targetLD = type === "DPF" ? 1.1 : type === "SCR" ? 1.0 : 1.2;
    const targetD_mm =
      Math.pow((4 * requiredVolume_L * 1e6) / (Math.PI * targetLD), 1 / 3);
    diameter_mm =
      standardDiameters.find((d) => d >= targetD_mm) ??
      standardDiameters[standardDiameters.length - 1];
  }

  // Calculate length from volume and diameter
  const A_cross = Math.PI * (diameter_mm / 2000) ** 2; // m²
  let length_mm = (requiredVolume_L * 1e-3) / A_cross * 1000;

  // Round up to nearest 10mm
  length_mm = Math.ceil(length_mm / 10) * 10;

  // Check if we need multiple substrates in series
  let numberOfSubstrates = 1;
  if (length_mm > 400) {
    numberOfSubstrates = Math.ceil(length_mm / 300);
    length_mm = Math.ceil(length_mm / numberOfSubstrates / 10) * 10;
  }

  // Actual selected volume (per brick × number of bricks)
  const singleBrickVolume_L = A_cross * (length_mm / 1000) * 1e6 / 1000;
  const selectedVolume_L = singleBrickVolume_L * numberOfSubstrates;

  // Pressure drop
  const Q_actual_m3_s = Q_actual_m3_h / 3600;
  const pressureDrop = monolithPressureDrop(
    Q_actual_m3_s / numberOfSubstrates,
    length_mm / 1000,
    diameter_mm / 1000,
    cellDensity,
    wallThickness,
    T_K,
    P_kPa,
    composition,
    type === "DPF"
  );

  // Light-off check
  const lightOff = LIGHT_OFF_TEMPS[type];
  const T_C = T_K - 273.15;
  const expectedConversion =
    T_C >= lightOff
      ? Object.values(TYPICAL_CONVERSIONS[type])[0] ?? 90
      : Math.max(0, ((T_C - (lightOff - 100)) / 100) * 50);

  // Washcoat and PGM
  const wc = WASHCOAT_DEFAULTS[type];

  // Weight (selectedVolume_L already includes all bricks)
  const substrateDensity = SUBSTRATE_DENSITY[material];
  const substrateWeight = selectedVolume_L * substrateDensity;
  const washcoatWeight = (selectedVolume_L * wc.washcoatLoading_g_L) / 1000;

  // Can dimensions: substrate + mounting mat (~5mm) + shell (~1.5mm) each side
  const canDiameter_mm = diameter_mm + 2 * 5 + 2 * 1.5; // mat + shell each side = +13mm
  const coneHeight_mm = Math.max(60, Math.min(120, canDiameter_mm * 0.3));
  const canLength_mm = length_mm * numberOfSubstrates + 2 * coneHeight_mm;

  // Shell weight: cylindrical body + 2 frustum cones
  const shellThick_m = 0.0015; // 1.5mm
  const shellOD_m = canDiameter_mm / 1000;
  const bodyLength_m = (length_mm * numberOfSubstrates) / 1000;
  const shellBodyWeight = Math.PI * shellOD_m * bodyLength_m * shellThick_m * 7800;
  const R_big = shellOD_m / 2;
  const R_small = R_big * 0.45;
  const coneSlant = Math.sqrt((coneHeight_mm / 1000) ** 2 + (R_big - R_small) ** 2);
  const singleConeWeight = Math.PI * (R_big + R_small) * coneSlant * (shellThick_m + 0.0005) * 7800;
  const canWeight = shellBodyWeight + 2 * singleConeWeight;
  const matWeight = Math.PI * (diameter_mm / 1000) * bodyLength_m * 4.0; // ~4 kg/m²
  const totalWeight = substrateWeight + washcoatWeight + canWeight + matWeight;

  return {
    type,
    requiredVolume_L,
    selectedVolume_L,
    diameter_mm,
    length_mm,
    numberOfSubstrates,
    cellDensity_cpsi: cellDensity,
    wallThickness_mil: wallThickness,
    material,
    GHSV_design: ghsv,
    pressureDrop_kPa: pressureDrop * numberOfSubstrates,
    expectedConversion_percent: expectedConversion,
    lightOffTemp_C: lightOff,
    washcoatLoading_g_L: wc.washcoatLoading_g_L,
    preciousMetalLoading_g_ft3: wc.pgmLoading_g_ft3,
    weight_kg: totalWeight,
    canDiameter_mm,
    canLength_mm,
  };
}

// ============================================================
// COMPLIANCE CHECK
// ============================================================

function checkCompliance(
  inputs: EngineInputs,
  catalysts: CatalystSizingResult[],
  standard: EmissionStandard
): ComplianceResult {
  const limits = EMISSION_STANDARDS[standard];

  // Calculate tailpipe emissions based on raw emissions and catalyst conversions
  let remainingCO_ppm = inputs.CO_ppm;
  let remainingHC_ppm = inputs.HC_ppm;
  let remainingNOx_ppm = inputs.NOx_ppm;
  let remainingPM_mg_Nm3 = inputs.PM_mg_Nm3;

  for (const cat of catalysts) {
    const conv = cat.expectedConversion_percent / 100;
    switch (cat.type) {
      case "DOC":
        remainingCO_ppm *= 1 - conv;
        remainingHC_ppm *= 1 - conv * 0.9; // HC conversion slightly less than CO
        break;
      case "DPF":
        remainingPM_mg_Nm3 *= 1 - conv;
        break;
      case "SCR":
        remainingNOx_ppm *= 1 - conv;
        break;
      case "TWC":
        remainingCO_ppm *= 1 - conv;
        remainingHC_ppm *= 1 - conv;
        remainingNOx_ppm *= 1 - conv;
        break;
      case "ASC":
        // ASC doesn't reduce primary pollutants significantly
        break;
    }
  }

  // Convert ppm/mg to g/kWh per UNECE R49 methodology:
  // g/kWh = (ppm × 1e-6) × (MW / V_mol) × Q_Nm3_h / P_kW
  // where V_mol = 22.414 L/mol at STP, Q in Nm³/h, so:
  // g/kWh = ppm × 1e-6 × MW × Q_Nm3_h × 1000 / (22.414 × P_kW)
  const flow = calculateExhaustFlow(inputs);
  const Q = flow.volumeFlow_Nm3_h;
  const P = inputs.ratedPower_kW;

  const ppmToGkWh = (ppm: number, mw: number) =>
    (ppm * 1e-6 * mw * Q * 1000) / (22.414 * P);

  const tailpipeNOx = ppmToGkWh(remainingNOx_ppm, 46.006); // NO₂ equivalent per regulation
  const tailpipeCO = ppmToGkWh(remainingCO_ppm, 28.01);
  const tailpipeHC = ppmToGkWh(remainingHC_ppm, 44.096); // C₃H₈ equivalent per EU/EPA diesel HC standard
  const tailpipePM = (remainingPM_mg_Nm3 * Q) / (P * 1000);

  return {
    standard: limits.standard,
    NOx_compliant: limits.NOx_g_kWh ? tailpipeNOx <= limits.NOx_g_kWh : true,
    PM_compliant: limits.PM_g_kWh ? tailpipePM <= limits.PM_g_kWh : true,
    CO_compliant: limits.CO_g_kWh ? tailpipeCO <= limits.CO_g_kWh : true,
    HC_compliant: limits.HC_g_kWh ? tailpipeHC <= limits.HC_g_kWh : true,
    tailpipeNOx_g_kWh: tailpipeNOx,
    tailpipePM_g_kWh: tailpipePM,
    tailpipeCO_g_kWh: tailpipeCO,
    tailpipeHC_g_kWh: tailpipeHC,
  };
}

// ============================================================
// MAIN DEPOLLUTION SIZING FUNCTION
// ============================================================

export function sizeDepollutionSystem(
  inputs: EngineInputs,
  chain: CatalystChainElement[],
  standard: EmissionStandard
): DepollutionSizingResult {
  const warnings: string[] = [];

  // Calculate exhaust flow
  const flow = calculateExhaustFlow(inputs);
  const T_K = UNITS.C_to_K(inputs.exhaustTemp_C);
  const composition = exhaustComposition(inputs);

  // Light-off warning
  const enabledTypes = chain.filter((c) => c.enabled).map((c) => c.type);
  for (const type of enabledTypes) {
    if (inputs.exhaustTemp_C < LIGHT_OFF_TEMPS[type]) {
      warnings.push(
        `${type}: Exhaust temperature (${inputs.exhaustTemp_C}°C) is below light-off temperature (${LIGHT_OFF_TEMPS[type]}°C). Conversion will be severely limited.`
      );
    }
  }

  // SO₂ warning
  if (inputs.SO2_ppm > 10) {
    warnings.push(
      `High SO₂ (${inputs.SO2_ppm} ppm) may poison DOC/SCR catalysts. Consider low-sulfur fuel.`
    );
  }

  // Size each catalyst
  const catalysts: CatalystSizingResult[] = [];
  let currentTemp_C = inputs.exhaustTemp_C;

  for (const element of chain) {
    if (!element.enabled) continue;

    const T_current_K = UNITS.C_to_K(currentTemp_C);

    const result = sizeSingleCatalyst(
      element.type,
      flow.volumeFlow_Nm3_h,
      flow.volumeFlow_actual_m3_h,
      T_current_K,
      inputs.exhaustPressure_kPa,
      composition,
      inputs.application,
      element.ghsvOverride,
      element.substrate
    );

    catalysts.push(result);

    // DOC is mildly exothermic (+20–50°C), DPF during regen is very exothermic
    if (element.type === "DOC") currentTemp_C += 30;
    if (element.type === "DPF") currentTemp_C -= 10; // Slight cooling in normal operation
    if (element.type === "SCR") currentTemp_C -= 5;
  }

  // System totals
  const totalPressureDrop = catalysts.reduce(
    (sum, c) => sum + c.pressureDrop_kPa,
    0
  );
  const totalWeight = catalysts.reduce((sum, c) => sum + c.weight_kg, 0);
  const totalLength = catalysts.reduce((sum, c) => sum + c.canLength_mm, 0);
  const maxDiameter = Math.max(...catalysts.map((c) => c.canDiameter_mm), 0);

  // Backpressure warning
  const maxBackpressure =
    inputs.application === "genset" || inputs.application === "marine"
      ? 10
      : 20;
  if (totalPressureDrop > maxBackpressure) {
    warnings.push(
      `Total backpressure (${totalPressureDrop.toFixed(1)} kPa) exceeds recommended maximum (${maxBackpressure} kPa).`
    );
  }

  // Compliance check
  const compliance = checkCompliance(inputs, catalysts, standard);

  return {
    catalysts,
    totalPressureDrop_kPa: totalPressureDrop,
    totalWeight_kg: totalWeight,
    totalLength_mm: totalLength,
    maxDiameter_mm: maxDiameter,
    compliance,
    exhaustFlowRate_Nm3_h: flow.volumeFlow_Nm3_h,
    exhaustFlowRate_actual_m3_h: flow.volumeFlow_actual_m3_h,
    warnings,
  };
}
