import { UNITS, T_STP, P_STP, R_GAS, volumeFlowSTPtoActual } from "./units";
import {
  reformerFeedComposition,
  gasViscosity,
  gasDensity,
  mixtureCp,
  mixtureH,
} from "./gas-properties";
import {
  solveEquilibrium,
  checkCarbonFormation,
  smrEnthalpy,
  wgsEnthalpy,
} from "./thermodynamics";
import { REFORMER_GHSV, REFORMER_CATALYSTS } from "./constants";
import type {
  FuelInputs,
  CatalystBedResult,
  ReformateComposition,
  ReformerSizingResult,
  CarbonRisk,
} from "./types";

// ============================================================
// ERGUN EQUATION: PACKED BED PRESSURE DROP
// ============================================================

/**
 * ΔP/L = (150 × μ × u × (1-ε)²) / (d_p² × ε³) + (1.75 × ρ × u² × (1-ε)) / (d_p × ε³)
 */
function ergunPressureDrop(
  u_m_s: number,       // Superficial velocity [m/s]
  L_m: number,         // Bed length [m]
  d_p_m: number,       // Particle diameter [m]
  epsilon: number,     // Void fraction
  mu_Pa_s: number,     // Gas viscosity [Pa·s]
  rho_kg_m3: number    // Gas density [kg/m³]
): number {
  const term1 =
    (150 * mu_Pa_s * u_m_s * (1 - epsilon) ** 2) /
    (d_p_m ** 2 * epsilon ** 3);

  const term2 =
    (1.75 * rho_kg_m3 * u_m_s ** 2 * (1 - epsilon)) /
    (d_p_m * epsilon ** 3);

  return (term1 + term2) * L_m / 1000; // Pa → kPa
}

// ============================================================
// SINGLE CATALYST BED SIZING
// ============================================================

function sizeCatalystBed(
  stage: string,
  Q_feed_Nm3_h: number,
  T_inlet_K: number,
  T_outlet_K: number,
  P_kPa: number,
  composition: Record<string, number>,
  catalystKeyOverride?: string
): CatalystBedResult {
  const catKey = catalystKeyOverride ?? (stage === "main_reformer" ? "SMR_Ni" : stage);
  const catProps = REFORMER_CATALYSTS[catKey] ?? REFORMER_CATALYSTS.SMR_Ni;
  const ghsvRange = REFORMER_GHSV[catKey] ?? REFORMER_GHSV.SMR_Ni;

  const ghsv = ghsvRange.typical;
  const Q_L_h = Q_feed_Nm3_h * 1000;
  const volume_L = Q_L_h / ghsv;

  // Target L/D ratio of 3–5 for packed beds
  const targetLD = 4;
  const volume_m3 = volume_L / 1000;
  const diameter_m = Math.pow((4 * volume_m3) / (Math.PI * targetLD), 1 / 3);
  const diameter_mm = Math.ceil(diameter_m * 1000 / 10) * 10;
  const length_mm = Math.ceil(diameter_mm * targetLD / 10) * 10;

  // Actual volume
  const actualVolume_L =
    (Math.PI * (diameter_mm / 2000) ** 2 * (length_mm / 1000)) * 1000;

  const weight_kg = actualVolume_L * catProps.bulkDensity_kg_L;

  // Pressure drop via Ergun equation
  const T_avg_K = (T_inlet_K + T_outlet_K) / 2;
  const Q_actual_m3_h = volumeFlowSTPtoActual(Q_feed_Nm3_h, T_avg_K, P_kPa);
  const A_cross = Math.PI * (diameter_mm / 2000) ** 2;
  const u_superficial = Q_actual_m3_h / 3600 / A_cross;

  const mu = gasViscosity(T_avg_K, composition);
  const rho = gasDensity(T_avg_K, P_kPa, composition);

  const pressureDrop = ergunPressureDrop(
    u_superficial,
    length_mm / 1000,
    catProps.particleDiameter_mm / 1000,
    catProps.voidFraction,
    mu,
    rho
  );

  return {
    stage: stage as CatalystBedResult["stage"],
    catalystType: catProps.name,
    GHSV: ghsv,
    volume_L: actualVolume_L,
    diameter_mm,
    length_mm,
    weight_kg,
    bedVoidFraction: catProps.voidFraction,
    pressureDrop_kPa: pressureDrop,
    inletTemp_C: UNITS.K_to_C(T_inlet_K),
    outletTemp_C: UNITS.K_to_C(T_outlet_K),
  };
}

// ============================================================
// MAIN REFORMER SIZING FUNCTION
// ============================================================

export interface ReformerCatalystSelections {
  mainReformer?: string;
  preReformer?: string;
  htWGS?: string;
  ltWGS?: string;
}

export function sizeReformerSystem(
  inputs: FuelInputs,
  catalystSelections?: ReformerCatalystSelections
): ReformerSizingResult {
  const warnings: string[] = [];

  // H₂S check
  if (inputs.H2S_ppm > 1) {
    warnings.push(
      `H₂S level (${inputs.H2S_ppm} ppm) exceeds 1 ppm threshold. A desulfurization bed (ZnO) is MANDATORY upstream of the reformer.`
    );
  }

  // Feed composition
  const feedComp = reformerFeedComposition({
    CH4_percent: inputs.CH4_percent,
    C2H6_percent: inputs.C2H6_percent,
    C3H8_percent: inputs.C3H8_percent,
    CO2_percent: inputs.CO2_percent,
    N2_percent: inputs.N2_percent,
    steamToCarbonRatio: inputs.steamToCarbonRatio,
    oxygenToCarbonRatio: inputs.oxygenToCarbonRatio,
  });

  // Reformer temperatures
  let reformerInletTemp_C: number;
  let reformerOutletTemp_C: number;

  switch (inputs.reformingStrategy) {
    case "SMR":
      reformerInletTemp_C = 500;
      reformerOutletTemp_C = 800;
      break;
    case "POX":
      reformerInletTemp_C = 300;
      reformerOutletTemp_C = 950;
      break;
    case "ATR":
      reformerInletTemp_C = 400;
      reformerOutletTemp_C = 850;
      break;
    default:
      reformerInletTemp_C = 600;
      reformerOutletTemp_C = 750;
  }

  const T_outlet_K = UNITS.C_to_K(reformerOutletTemp_C);

  // Solve equilibrium at reformer outlet
  const equilibrium = solveEquilibrium(
    T_outlet_K,
    inputs.fuelPressure_kPa,
    feedComp
  );

  // Carbon formation check
  const carbonCheck = checkCarbonFormation(
    T_outlet_K,
    inputs.fuelPressure_kPa,
    equilibrium.composition
  );

  if (carbonCheck.carbonForms) {
    warnings.push(
      `CARBON DEPOSITION PREDICTED at ${reformerOutletTemp_C}°C with S/C=${inputs.steamToCarbonRatio}. ` +
      `Minimum S/C ratio to avoid coking: ${carbonCheck.minimumSCRatio.toFixed(1)}. ` +
      `Increase S/C ratio or reformer temperature.`
    );
  }

  if (inputs.steamToCarbonRatio < carbonCheck.minimumSCRatio) {
    warnings.push(
      `S/C ratio (${inputs.steamToCarbonRatio}) is below the minimum safe value (${carbonCheck.minimumSCRatio.toFixed(1)}) for carbon-free operation.`
    );
  }

  // Total carbon atoms in fuel per Nm³
  const totalCarbonPerNm3 =
    inputs.CH4_percent / 100 +
    2 * (inputs.C2H6_percent / 100) +
    3 * (inputs.C3H8_percent / 100);

  // Total feed flow (fuel + steam + air)
  const steamFlow_Nm3_h =
    inputs.fuelFlowRate_Nm3_h * inputs.steamToCarbonRatio * totalCarbonPerNm3;
  const o2Flow_Nm3_h =
    inputs.fuelFlowRate_Nm3_h *
    (inputs.oxygenToCarbonRatio ?? 0) *
    totalCarbonPerNm3;
  const airFlow_Nm3_h = o2Flow_Nm3_h > 0 ? o2Flow_Nm3_h / 0.21 : 0;

  const totalFeedFlow_Nm3_h =
    inputs.fuelFlowRate_Nm3_h + steamFlow_Nm3_h + airFlow_Nm3_h;

  // Size catalyst beds
  const catalystBeds: CatalystBedResult[] = [];

  // Desulfurizer (if needed)
  if (inputs.H2S_ppm > 1) {
    catalystBeds.push(
      sizeCatalystBed(
        "desulfurizer",
        inputs.fuelFlowRate_Nm3_h,
        UNITS.C_to_K(300),
        UNITS.C_to_K(350),
        inputs.fuelPressure_kPa,
        { CH4: 0.9, CO2: 0.05, N2: 0.05 }
      )
    );
  }

  // Pre-reformer (for higher hydrocarbons)
  if (inputs.C2H6_percent + inputs.C3H8_percent > 1) {
    catalystBeds.push(
      sizeCatalystBed(
        "pre_reformer",
        totalFeedFlow_Nm3_h,
        UNITS.C_to_K(450),
        UNITS.C_to_K(500),
        inputs.fuelPressure_kPa,
        feedComp,
        catalystSelections?.preReformer
      )
    );
  }

  // Main reformer
  const mainReformerKey =
    inputs.reformingStrategy === "POX"
      ? "POX"
      : inputs.reformingStrategy === "ATR"
        ? "ATR"
        : "main_reformer";

  catalystBeds.push(
    sizeCatalystBed(
      mainReformerKey as CatalystBedResult["stage"],
      totalFeedFlow_Nm3_h,
      UNITS.C_to_K(reformerInletTemp_C),
      T_outlet_K,
      inputs.fuelPressure_kPa,
      feedComp,
      catalystSelections?.mainReformer
    )
  );

  // WGS stages (if not internal reforming)
  if (
    inputs.reformingStrategy !== "internal" &&
    inputs.reformingStrategy !== "indirect_internal"
  ) {
    // HT-WGS
    const wgsInletComp = equilibrium.composition;
    catalystBeds.push(
      sizeCatalystBed(
        "HT_WGS",
        totalFeedFlow_Nm3_h,
        UNITS.C_to_K(350),
        UNITS.C_to_K(420),
        inputs.fuelPressure_kPa,
        wgsInletComp,
        catalystSelections?.htWGS
      )
    );

    // LT-WGS (optional, for maximum H₂)
    if (
      !inputs.targetCH4_CO_ratio ||
      inputs.targetCH4_CO_ratio < 0.5
    ) {
      catalystBeds.push(
        sizeCatalystBed(
          "LT_WGS",
          totalFeedFlow_Nm3_h,
          UNITS.C_to_K(200),
          UNITS.C_to_K(250),
          inputs.fuelPressure_kPa,
          wgsInletComp,
          catalystSelections?.ltWGS
        )
      );
    }
  }

  // Heat duty calculations
  const T_in_K = UNITS.C_to_K(reformerInletTemp_C);
  const dH_smr = smrEnthalpy(T_outlet_K); // kJ/mol
  const dH_wgs = wgsEnthalpy(UNITS.C_to_K(400)); // kJ/mol

  // Moles of CH₄ converted per hour
  const ch4_moles_h =
    (inputs.fuelFlowRate_Nm3_h * 1000 * (inputs.CH4_percent / 100)) / 22.414;
  const ch4_converted_moles_h =
    ch4_moles_h * equilibrium.CH4_conversion;

  const reformerHeatDuty_kW =
    (ch4_converted_moles_h * dH_smr) / 3600; // kJ/h → kW

  // WGS is exothermic
  const co_converted_moles_h = ch4_converted_moles_h * 0.7; // ~70% CO shifts
  const wgsHeatRelease_kW =
    (co_converted_moles_h * Math.abs(dH_wgs)) / 3600;

  const netHeatDuty_kW = reformerHeatDuty_kW - wgsHeatRelease_kW;

  // H₂ production
  const h2_moles_h =
    ch4_converted_moles_h * equilibrium.H2_yield;
  const H2_production_Nm3_h = (h2_moles_h * 22.414) / 1000;

  // SOFC performance estimate
  // Faraday: I = 2F × n_H2 (2 electrons per H₂ molecule)
  // Power = V × I, V ≈ 0.7V per cell
  const F = 96485; // C/mol
  const cellVoltage = 0.7; // V (typical SOFC)
  const h2_for_sofc_moles_s =
    (h2_moles_h * inputs.SOFC_fuelUtilization) / 3600;
  const current_A = 2 * F * h2_for_sofc_moles_s;
  const SOFC_power_kW = (current_A * cellVoltage) / 1000;

  // System efficiency (LHV basis)
  // LHV of CH₄ = 802 kJ/mol
  const fuelEnergy_kW = (ch4_moles_h * 802) / 3600;
  const systemEfficiency =
    fuelEnergy_kW > 0 ? (SOFC_power_kW / fuelEnergy_kW) * 100 : 0;

  // Reformate composition (dry basis percentages)
  const eq = equilibrium.composition;
  const dryTotal =
    1 - (eq.H2O ?? 0);
  const reformateComposition: ReformateComposition = {
    H2_percent: dryTotal > 0 ? ((eq.H2 ?? 0) / dryTotal) * 100 : 0,
    CO_percent: dryTotal > 0 ? ((eq.CO ?? 0) / dryTotal) * 100 : 0,
    CO2_percent: dryTotal > 0 ? ((eq.CO2 ?? 0) / dryTotal) * 100 : 0,
    CH4_percent: dryTotal > 0 ? ((eq.CH4 ?? 0) / dryTotal) * 100 : 0,
    H2O_percent: (eq.H2O ?? 0) * 100,
    N2_percent: dryTotal > 0 ? ((eq.N2 ?? 0) / dryTotal) * 100 : 0,
  };

  return {
    reformingStrategy: inputs.reformingStrategy,
    steamToCarbonRatio: inputs.steamToCarbonRatio,
    oxygenToCarbonRatio: inputs.oxygenToCarbonRatio,
    reformerInletTemp_C,
    reformerOutletTemp_C,
    reformerPressure_kPa: inputs.fuelPressure_kPa,
    reformateComposition,
    CH4_CO_ratio: equilibrium.CH4_CO_ratio,
    H2_CO_ratio: equilibrium.H2_CO_ratio,
    CH4_conversion_percent: equilibrium.CH4_conversion * 100,
    catalystBeds,
    reformerHeatDuty_kW,
    WGS_heatRelease_kW: wgsHeatRelease_kW,
    netHeatDuty_kW,
    H2_production_Nm3_h,
    H2_yield_mol_per_mol_CH4: equilibrium.H2_yield,
    carbonFormationRisk: carbonCheck.risk,
    minimumSCRatio_noCarbon: carbonCheck.minimumSCRatio,
    SOFC_fuelFlow_Nm3_h: H2_production_Nm3_h * inputs.SOFC_fuelUtilization,
    SOFC_estimatedPower_kW: SOFC_power_kW,
    systemEfficiency_percent: systemEfficiency,
    warnings,
  };
}
