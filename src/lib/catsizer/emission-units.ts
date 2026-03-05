/**
 * Emission Unit Conversion Module
 *
 * Converts between g/kWh, g/km, and ppm for pollutant inputs.
 * All internal calculations use ppm (volume basis at STP).
 */

export type EmissionUnit = "ppm" | "g_kWh" | "g_km" | "mg_Nm3";

export interface EmissionInput {
  value: number;
  unit: EmissionUnit;
}

export interface EmissionInputSet {
  CO: EmissionInput;
  HC: EmissionInput;
  NOx: EmissionInput;
  PM: EmissionInput;
}

/**
 * Molecular weights for emission conversion.
 * HC: Diesel regulations (Euro VI, EPA) use C₃H₆ equivalent (propylene, MW=42.08).
 *     For NG/biogas engines, C₁ (CH₄, MW=16.04) is used — but the standard
 *     RFQ input convention uses C₁ ppm, so we convert at C₃H₆ for g/kWh output
 *     per UNECE R49/R96 methodology.
 * NOx: Always expressed as NO₂ equivalent (MW=46.01) per regulation.
 */
const POLLUTANT_MW: Record<string, number> = {
  CO: 28.01,
  HC: 44.096, // C₃ equivalent (propane C₃H₈) — EU/EPA standard for diesel HC
  NOx: 46.006, // NO₂ equivalent per regulation
  PM: 0, // PM is mass-based, not gas-phase
};

/**
 * Convert g/kWh to ppm (volume) given exhaust conditions.
 *
 * ppm = (C_g_kWh × P_kW × 22.414) / (MW × Q_Nm3_h) × 1e6
 *
 * For PM: g/kWh → mg/Nm³ = (C_g_kWh × P_kW × 1000) / Q_Nm3_h
 */
export function gKWhToPpm(
  value_g_kWh: number,
  pollutant: string,
  power_kW: number,
  exhaustFlow_Nm3_h: number,
): number {
  if (pollutant === "PM") {
    return (value_g_kWh * power_kW * 1000) / exhaustFlow_Nm3_h;
  }
  const mw = POLLUTANT_MW[pollutant] ?? 28;
  return (value_g_kWh * power_kW * 22.414) / (mw * exhaustFlow_Nm3_h) * 1e6;
}

/**
 * Convert ppm to g/kWh.
 */
export function ppmToGKWh(
  value_ppm: number,
  pollutant: string,
  power_kW: number,
  exhaustFlow_Nm3_h: number,
): number {
  if (pollutant === "PM") return 0;
  const mw = POLLUTANT_MW[pollutant] ?? 28;
  return (value_ppm * 1e-6 * mw * exhaustFlow_Nm3_h) / (22.414 * power_kW);
}

/**
 * Convert g/km to ppm given vehicle speed and exhaust conditions.
 *
 * g/km → g/h = g/km × speed_km_h
 * g/h → g/kWh = g/h / P_kW
 * Then use g/kWh → ppm
 */
export function gKmToPpm(
  value_g_km: number,
  pollutant: string,
  power_kW: number,
  exhaustFlow_Nm3_h: number,
  speed_km_h: number = 80,
): number {
  const g_h = value_g_km * speed_km_h;
  const g_kWh = g_h / power_kW;
  return gKWhToPpm(g_kWh, pollutant, power_kW, exhaustFlow_Nm3_h);
}

/**
 * Convert mg/Nm³ to ppm.
 * ppm = (mg_Nm3 / 1000) × (22.414 / MW) × 1e6
 */
export function mgNm3ToPpm(
  value_mg_Nm3: number,
  pollutant: string,
): number {
  if (pollutant === "PM") return value_mg_Nm3; // PM stays as mg/Nm³
  const mw = POLLUTANT_MW[pollutant] ?? 28;
  return (value_mg_Nm3 / 1000) * (22414 / mw);
}

/**
 * Convert ppm to mg/Nm³.
 */
export function ppmToMgNm3(
  value_ppm: number,
  pollutant: string,
): number {
  if (pollutant === "PM") return value_ppm;
  const mw = POLLUTANT_MW[pollutant] ?? 28;
  return value_ppm * mw / 22.414;
}

/**
 * Universal converter: any unit → ppm.
 */
export function toPpm(
  input: EmissionInput,
  pollutant: string,
  power_kW: number,
  exhaustFlow_Nm3_h: number,
  speed_km_h: number = 80,
): number {
  switch (input.unit) {
    case "ppm":
      return input.value;
    case "g_kWh":
      return gKWhToPpm(input.value, pollutant, power_kW, exhaustFlow_Nm3_h);
    case "g_km":
      return gKmToPpm(input.value, pollutant, power_kW, exhaustFlow_Nm3_h, speed_km_h);
    case "mg_Nm3":
      return mgNm3ToPpm(input.value, pollutant);
    default:
      return input.value;
  }
}

/**
 * Universal converter: ppm → any unit.
 */
export function fromPpm(
  value_ppm: number,
  targetUnit: EmissionUnit,
  pollutant: string,
  power_kW: number,
  exhaustFlow_Nm3_h: number,
  speed_km_h: number = 80,
): number {
  switch (targetUnit) {
    case "ppm":
      return value_ppm;
    case "g_kWh":
      return ppmToGKWh(value_ppm, pollutant, power_kW, exhaustFlow_Nm3_h);
    case "g_km": {
      const g_kWh = ppmToGKWh(value_ppm, pollutant, power_kW, exhaustFlow_Nm3_h);
      return (g_kWh * power_kW) / speed_km_h;
    }
    case "mg_Nm3":
      return ppmToMgNm3(value_ppm, pollutant);
    default:
      return value_ppm;
  }
}

export const EMISSION_UNIT_LABELS: Record<EmissionUnit, string> = {
  ppm: "ppm",
  g_kWh: "g/kWh",
  g_km: "g/km",
  mg_Nm3: "mg/Nm³",
};
