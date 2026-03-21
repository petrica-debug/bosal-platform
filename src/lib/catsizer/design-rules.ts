/**
 * Design rules engine — hard constraints that block invalid AM catalyst specs,
 * plus warnings for borderline designs.
 *
 * Every constraint has a clear explanation so the wizard can display
 * actionable feedback to the engineer.
 */

/* ================================================================== */
/*  Types                                                             */
/* ================================================================== */

export type Severity = "BLOCK" | "WARN";

export interface Violation {
  id: string;
  field: string;
  value: number | string;
  limit: number | string;
  severity: Severity;
  explanation: string;
}

export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
  warnings: Violation[];
  /** Number of BLOCK violations */
  blockCount: number;
  /** Number of WARN violations */
  warnCount: number;
}

export interface DesignInput {
  /** PGM loadings in g/L */
  pdGPerL: number;
  rhGPerL: number;
  ptGPerL: number;
  /** Total PGM in g/L */
  totalPgmGPerL: number;
  /** OSC loading in g/L */
  oscGPerL: number;
  /** Washcoat loading in g/L */
  washcoatGPerL: number;
  /** Substrate diameter in mm */
  substrateDiameterMm: number;
  /** Substrate length in mm */
  substrateLengthMm: number;
  /** Substrate volume in L */
  substrateVolumeL: number;
  /** System backpressure in kPa */
  systemBackpressureKPa?: number;
  /** Predicted aged T50 CO in °C */
  predictedT50CoC?: number;
}

export interface BaselineInput {
  /** OEM fresh total PGM in g/L */
  oemFreshPgmGPerL: number;
  /** OEM fresh OSC in g/L */
  oemFreshOscGPerL: number;
  /** OEM system backpressure in kPa */
  oemBackpressureKPa?: number;
  /** OEM aged T50 CO in °C */
  oemAgedT50CoC?: number;
}

/* ================================================================== */
/*  Bosal tooling list (valid substrate diameters)                    */
/* ================================================================== */

export const BOSAL_TOOLING_DIAMETERS_MM = [
  88.9, 93.0, 101.6, 105.0, 108.0, 112.0, 118.4, 120.0,
  127.0, 129.0, 132.0, 140.0, 143.8, 150.0, 152.4, 160.0,
  170.0, 177.8, 190.5, 200.0, 220.0, 240.0, 267.0,
] as const;

/* ================================================================== */
/*  E2. Validation Engine                                             */
/* ================================================================== */

/**
 * Validate an AM catalyst design against all engineering constraints.
 * Returns BLOCK violations (prevent proceeding) and WARN violations (advisory).
 */
export function validateDesign(
  design: DesignInput,
  baseline: BaselineInput,
  overrides?: Partial<Record<string, { min?: number; max?: number }>>,
): ValidationResult {
  const violations: Violation[] = [];

  // --- PGM minimum: Rh >= 0.05 g/L ---
  const rhMin = overrides?.rhMin?.min ?? 0.05;
  if (design.rhGPerL < rhMin) {
    violations.push({
      id: "rh-min",
      field: "Rh loading",
      value: design.rhGPerL,
      limit: rhMin,
      severity: "BLOCK",
      explanation: `Rh loading ${design.rhGPerL} g/L is below minimum ${rhMin} g/L. Below this threshold, NOx conversion collapses — Rh is the only effective NOx reduction catalyst in TWC.`,
    });
  }

  // --- PGM upper cost advisory: total PGM > OEM fresh × 1.10 ---
  // There is no technical upper limit on AM PGM — higher loading improves durability and
  // OBD margin. A warning is issued only when cost exceeds OEM by >10%, as a commercial flag.
  // (The previous 0.85 cap inverted the causality: more PGM makes the OBD monitor happier.)
  const pgmCostLimit = baseline.oemFreshPgmGPerL * 1.10;
  if (pgmCostLimit > 0 && design.totalPgmGPerL > pgmCostLimit) {
    violations.push({
      id: "pgm-cost",
      field: "Total PGM",
      value: design.totalPgmGPerL,
      limit: +pgmCostLimit.toFixed(2),
      severity: "WARN",
      explanation: `Total PGM ${design.totalPgmGPerL} g/L is more than 10% above OEM fresh loading (${pgmCostLimit.toFixed(2)} g/L). Performance will be excellent but verify the cost target is met.`,
    });
  }

  // --- OSC window — validated against OEM FRESH g/L as a proxy for aged buffering.
  // The P0420 calibration is on the aged OE part; however, without the aged µmol/brick value
  // available here, fresh g/L is the practical field check for gross under/over-loading.
  // The aging simulation in the optimizer is the authoritative OBD check.
  const oscMin = baseline.oemFreshOscGPerL > 0 ? baseline.oemFreshOscGPerL * 0.55 : 0;
  const oscMax = baseline.oemFreshOscGPerL > 0 ? baseline.oemFreshOscGPerL * 0.85 : Infinity;
  if (oscMin > 0 && design.oscGPerL < oscMin) {
    violations.push({
      id: "osc-low",
      field: "OSC loading",
      value: design.oscGPerL,
      limit: +oscMin.toFixed(1),
      severity: "BLOCK",
      explanation: `OSC ${design.oscGPerL} g/L is below 55% of OEM fresh loading (${oscMin.toFixed(1)} g/L). After aging, buffering capacity will be critically low — P0420 failure highly probable.`,
    });
  }
  if (oscMax < Infinity && design.oscGPerL > oscMax) {
    violations.push({
      id: "osc-high",
      field: "OSC loading",
      value: design.oscGPerL,
      limit: +oscMax.toFixed(1),
      severity: "WARN",
      explanation: `OSC ${design.oscGPerL} g/L exceeds 85% of OEM fresh loading (${oscMax.toFixed(1)} g/L). Excess OSC adds cost; verify aged performance with the full aging simulation.`,
    });
  }

  // --- Substrate diameter must match Bosal tooling ---
  const closestTooling = BOSAL_TOOLING_DIAMETERS_MM.reduce((best, d) =>
    Math.abs(d - design.substrateDiameterMm) < Math.abs(best - design.substrateDiameterMm) ? d : best,
  );
  if (Math.abs(closestTooling - design.substrateDiameterMm) > 1.0) {
    violations.push({
      id: "tooling-diameter",
      field: "Substrate diameter",
      value: design.substrateDiameterMm,
      limit: `Bosal tooling: ${closestTooling} mm`,
      severity: "BLOCK",
      explanation: `Diameter ${design.substrateDiameterMm} mm does not match any Bosal canning tooling. Closest available: ${closestTooling} mm. Using non-standard diameter requires new tooling investment.`,
    });
  }

  // --- Substrate length: 50–305 mm ---
  if (design.substrateLengthMm < 50) {
    violations.push({
      id: "length-min",
      field: "Substrate length",
      value: design.substrateLengthMm,
      limit: 50,
      severity: "BLOCK",
      explanation: "Substrate length below 50 mm provides insufficient catalytic surface area for any emission standard.",
    });
  }
  if (design.substrateLengthMm > 305) {
    violations.push({
      id: "length-max",
      field: "Substrate length",
      value: design.substrateLengthMm,
      limit: 305,
      severity: "WARN",
      explanation: "Substrate length above 305 mm may cause packaging issues in most vehicle underfloor positions.",
    });
  }

  // --- Washcoat: 120–350 g/L ---
  if (design.washcoatGPerL < 120) {
    violations.push({
      id: "wc-min",
      field: "Washcoat loading",
      value: design.washcoatGPerL,
      limit: 120,
      severity: "WARN",
      explanation: "Washcoat below 120 g/L may result in incomplete substrate coverage, leading to uncoated channels and emission hot spots.",
    });
  }
  if (design.washcoatGPerL > 350) {
    violations.push({
      id: "wc-max",
      field: "Washcoat loading",
      value: design.washcoatGPerL,
      limit: 350,
      severity: "BLOCK",
      explanation: "Washcoat above 350 g/L causes coating quality issues: channel blockage, poor adhesion, and excessive backpressure from reduced open frontal area.",
    });
  }

  // --- Pd:Rh ratio: 4:1 to 20:1 ---
  if (design.rhGPerL > 0 && design.pdGPerL > 0) {
    const pdRhRatio = design.pdGPerL / design.rhGPerL;
    if (pdRhRatio < 4) {
      violations.push({
        id: "pd-rh-low",
        field: "Pd:Rh ratio",
        value: +pdRhRatio.toFixed(1),
        limit: "4:1 minimum",
        severity: "WARN",
        explanation: `Pd:Rh ratio ${pdRhRatio.toFixed(1)}:1 is below 4:1. Very high Rh fraction is cost-inefficient and may cause Rh-Pd alloy formation during aging, reducing both metals' effectiveness.`,
      });
    }
    if (pdRhRatio > 20) {
      violations.push({
        id: "pd-rh-high",
        field: "Pd:Rh ratio",
        value: +pdRhRatio.toFixed(1),
        limit: "20:1 maximum",
        severity: "BLOCK",
        explanation: `Pd:Rh ratio ${pdRhRatio.toFixed(1)}:1 exceeds 20:1. Insufficient Rh makes NOx conversion unreliable, especially at high space velocities during WLTP extra-high phase.`,
      });
    }
  }

  // --- T50 target: AM T50 <= OEM aged T50 + 20°C ---
  if (design.predictedT50CoC != null && baseline.oemAgedT50CoC != null) {
    const t50Limit = baseline.oemAgedT50CoC + 20;
    if (design.predictedT50CoC > t50Limit) {
      violations.push({
        id: "t50-high",
        field: "Predicted T50 CO",
        value: design.predictedT50CoC,
        limit: t50Limit,
        severity: design.predictedT50CoC > t50Limit + 10 ? "BLOCK" : "WARN",
        explanation: `Predicted aged T50 ${design.predictedT50CoC}°C exceeds OEM aged T50 + 20°C (${t50Limit}°C). The AM catalyst will light off too late, failing cold-start emission limits.`,
      });
    }
  }

  // --- Backpressure: system total <= OEM + 10% ---
  if (design.systemBackpressureKPa != null && baseline.oemBackpressureKPa != null) {
    const bpLimit = baseline.oemBackpressureKPa * 1.10;
    if (design.systemBackpressureKPa > bpLimit) {
      violations.push({
        id: "bp-high",
        field: "System backpressure",
        value: +design.systemBackpressureKPa.toFixed(2),
        limit: +bpLimit.toFixed(2),
        severity: "BLOCK",
        explanation: `System backpressure ${design.systemBackpressureKPa.toFixed(1)} kPa exceeds OEM+10% limit (${bpLimit.toFixed(1)} kPa). Excessive backpressure causes power loss, increased fuel consumption, and potential engine management fault codes.`,
      });
    }
  }

  const blocks = violations.filter((v) => v.severity === "BLOCK");
  const warns = violations.filter((v) => v.severity === "WARN");

  return {
    valid: blocks.length === 0,
    violations: blocks,
    warnings: warns,
    blockCount: blocks.length,
    warnCount: warns.length,
  };
}
