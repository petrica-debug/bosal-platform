/**
 * DATA PROVENANCE SYSTEM
 *
 * Every number the copilot displays has one of three origins:
 *
 *  "measured"   — came from a real test uploaded by the user (light-off bench,
 *                 substrate datasheet, chassis dyno result).  These values override
 *                 model estimates and are shown with a green indicator.
 *
 *  "estimated"  — computed by the digital-twin model from user-provided inputs
 *                 (PGM loading, Ce%, substrate size, aging hours). The model is
 *                 calibrated to literature data and validated against Bosal bench
 *                 data; confidence band ≈ ±15%. Shown with amber indicator.
 *
 *  "literature" — sourced directly from the OEM database, published SAE papers,
 *                 or substrate supplier datasheets without local validation.
 *                 Uncertainty is higher; treat as guidance only. Grey indicator.
 *
 * ENGINEERING NOTE
 * ─────────────────
 * For a copilot to be a credible engineering tool — not a demo — every KPI it
 * presents must carry its provenance.  An engineer reading DF = 1.42 must know:
 *   • Is that measured on a Bosal sample or estimated by the model?
 *   • What is the uncertainty band?
 *   • Can the model be wrong in a way that would make the part fail type approval?
 *
 * This module provides the types and utility functions to answer those questions.
 */

export type DataTier = "measured" | "estimated" | "literature";

export interface SourcedValue {
  /** The numeric value */
  value: number;
  /** Origin: measured > estimated > literature */
  tier: DataTier;
  /** Human-readable description: "Bosal bench 2024-03", "TWC lambda model", "SAE 2019-01-0741" */
  source: string;
  /**
   * Model confidence: 0–100 (%).
   * For measured data this is typically null (exact measurement, within instrument calibration).
   * For estimated/literature, this is the ±1σ confidence interval expressed as a percentage.
   */
  confidencePct?: number;
  /** ISO date when value was last updated (YYYY-MM-DD) */
  updatedAt?: string;
}

// ============================================================
// STORAGE KEY UTILITIES
// ============================================================

export const PROVENANCE_STORAGE_KEY = "bosal_lab_provenance_v1";

export interface LabDataStore {
  /**
   * Light-off T50 values from bench measurement.
   * Key format: "<washcoatType>|<agingHours>" e.g. "ceria|160"
   */
  lightOff?: Record<string, {
    T50_CO_C: number;
    T50_HC_C: number;
    T50_NOx_C: number;
    T90_CO_C: number;
    T90_HC_C: number;
    T90_NOx_C: number;
    maxConv_CO_pct: number;
    maxConv_HC_pct: number;
    maxConv_NOx_pct: number;
    uploadedAt: string;
    notes: string;
  }>;
  /**
   * Substrate physical properties from supplier datasheet.
   * Key format: "<partNumber>" e.g. "NGK-400-66-152"
   */
  substrate?: Record<string, {
    diameter_mm: number;
    length_mm: number;
    cpsi: number;
    wallThickness_mil: number;
    OFA_pct: number;
    GSA_m2_L: number;
    material: string;
    supplier: string;
    uploadedAt: string;
  }>;
  /**
   * Chassis dyno DF measurement results.
   * Key format: "<partNumber>|<protocol>" e.g. "BAM-123|BOSAL-160h"
   */
  chassisDyno?: Record<string, {
    partNumber: string;
    agingProtocol: string;
    freshDate: string;
    agedDate: string;
    freshCO_g_km: number;
    agedCO_g_km: number;
    freshHC_g_km: number;
    agedHC_g_km: number;
    freshNOx_g_km: number;
    agedNOx_g_km: number;
    DF_CO: number;
    DF_HC: number;
    DF_NOx: number;
    uploadedAt: string;
    notes: string;
  }>;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Load the lab data store from localStorage.
 * Returns an empty store if nothing has been uploaded yet.
 */
export function loadLabData(): LabDataStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PROVENANCE_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as LabDataStore;
  } catch {
    return {};
  }
}

/**
 * Save the lab data store to localStorage.
 */
export function saveLabData(data: LabDataStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROVENANCE_STORAGE_KEY, JSON.stringify(data));
}

/**
 * Resolve a SourcedValue for a T50 measurement.
 * Returns the measured value if it exists in the lab store,
 * otherwise returns the model estimate.
 */
export function resolveT50(
  species: "CO" | "HC" | "NOx",
  washcoatType: string,
  agingHours: number,
  modelEstimate: number
): SourcedValue {
  const store = loadLabData();
  const key = `${washcoatType}|${agingHours}`;
  const entry = store.lightOff?.[key];

  if (entry) {
    const value =
      species === "CO" ? entry.T50_CO_C :
      species === "HC" ? entry.T50_HC_C :
                         entry.T50_NOx_C;
    return {
      value,
      tier: "measured",
      source: `Bosal bench (uploaded ${entry.uploadedAt})`,
      confidencePct: undefined,
      updatedAt: entry.uploadedAt,
    };
  }

  return {
    value: modelEstimate,
    tier: "estimated",
    source: "TWC lambda-OSC model + PGM dispersion",
    confidencePct: 15,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
}

/**
 * Resolve DF values, using chassis dyno data if available.
 */
export function resolveDF(
  species: "CO" | "HC" | "NOx",
  partNumber: string,
  agingProtocol: string,
  modelEstimate: number
): SourcedValue {
  const store = loadLabData();
  const key = `${partNumber}|${agingProtocol}`;
  const entry = store.chassisDyno?.[key];

  if (entry) {
    const value =
      species === "CO" ? entry.DF_CO :
      species === "HC" ? entry.DF_HC :
                         entry.DF_NOx;
    return {
      value,
      tier: "measured",
      source: `Chassis dyno ${partNumber} (${entry.agedDate})`,
      confidencePct: undefined,
      updatedAt: entry.uploadedAt,
    };
  }

  return {
    value: modelEstimate,
    tier: "estimated",
    source: "R103 DF model (fresh/aged simulation ratio)",
    confidencePct: 20,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
}

/**
 * Confidence band string for display (e.g. "±15%").
 */
export function confidenceLabel(sv: SourcedValue): string {
  if (sv.tier === "measured") return "Measured";
  if (sv.confidencePct != null) return `±${sv.confidencePct}%`;
  return "";
}
