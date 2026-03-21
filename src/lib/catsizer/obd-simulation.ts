/**
 * OBD simulation engine — rear-O2 signal modeling, P0420 threshold prediction,
 * and multi-cycle R103 verification.
 *
 * Models the oxygen storage/release dynamics that determine the rear-O2
 * sensor signal pattern, which is the basis for OBD catalyst monitoring.
 */

/* ================================================================== */
/*  Types                                                             */
/* ================================================================== */

export type ObdStrategy = "amplitude" | "delay" | "ratio";

export interface ObdCalibration {
  strategy: ObdStrategy;
  /** Platform-specific threshold (dimensionless ratio or seconds) */
  threshold: number;
  /** Typical OEM platforms using this strategy */
  platforms: string[];
}

export const OBD_CALIBRATIONS: Record<ObdStrategy, ObdCalibration> = {
  amplitude: {
    strategy: "amplitude",
    threshold: 0.65,
    platforms: ["VAG (EA211, EA888)", "BMW (B38, B48)", "Mercedes (M260, M264)"],
  },
  delay: {
    strategy: "delay",
    threshold: 0.40,
    platforms: ["PSA (EB2, EP6)", "Renault (H5Ft, TCe)", "Fiat (GSE)"],
  },
  ratio: {
    strategy: "ratio",
    threshold: 0.70,
    platforms: ["Toyota (M20A, G16E)", "Hyundai/Kia (Smartstream)", "Honda (L15B)"],
  },
};

/* ================================================================== */
/*  B1. Rear-O2 Signal Model                                          */
/* ================================================================== */

export interface RearO2Signal {
  /** Switching frequency in Hz (lower = better OSC) */
  switchingFreqHz: number;
  /** Peak-to-peak amplitude in volts (lower = better OSC) */
  amplitudeV: number;
  /** Delay vs front sensor in seconds (higher = better OSC) */
  delayS: number;
  /** Amplitude ratio rear/front (lower = better OSC) */
  amplitudeRatio: number;
  /** Time constant of OSC buffer in seconds */
  tauS: number;
  /** Simulated waveform points (time_s, voltage) for charting */
  waveform: { timeS: number; frontV: number; rearV: number }[];
}

/**
 * First-order oxygen storage/release model.
 *
 * The catalyst OSC acts as a low-pass filter on the front O2 oscillation.
 * tau = OSC_capacity / (exhaust_flow_rate * O2_concentration_swing)
 */
export function simulateRearO2(params: {
  /** Aged OSC capacity in µmol O2 per brick */
  oscCapacityUmolPerBrick: number;
  /** Exhaust mass flow at test point in kg/h */
  exhaustFlowKgPerH: number;
  /** Lambda oscillation amplitude (typically 0.02-0.05) */
  lambdaAmplitude?: number;
  /** Lambda oscillation frequency in Hz (typically 0.5-2.0) */
  lambdaFreqHz?: number;
  /** Simulation duration in seconds */
  durationS?: number;
}): RearO2Signal {
  const {
    oscCapacityUmolPerBrick,
    exhaustFlowKgPerH,
    lambdaAmplitude = 0.03,
    lambdaFreqHz = 1.0,
    durationS = 10,
  } = params;

  // Convert OSC to moles
  const oscMol = oscCapacityUmolPerBrick / 1e6;

  // Exhaust O2 swing: ~0.5% O2 per 0.01 lambda swing
  const o2SwingMolPerKg = (lambdaAmplitude / 0.01) * 0.0005 / 0.032; // mol O2 per kg exhaust
  const exhaustFlowKgPerS = exhaustFlowKgPerH / 3600;
  const o2FlowSwing = o2SwingMolPerKg * exhaustFlowKgPerS;

  // Time constant: how long the OSC can buffer the O2 swing
  const tau = oscMol / Math.max(o2FlowSwing, 1e-9);

  // Front sensor: square-ish wave between 0.1V (lean) and 0.9V (rich)
  const omega = 2 * Math.PI * lambdaFreqHz;

  // Rear sensor: filtered by OSC — amplitude attenuation and phase delay
  const attenuation = 1 / Math.sqrt(1 + (omega * tau) ** 2);
  const phaseDelay = Math.atan(omega * tau) / omega;

  const rearAmplitude = 0.4 * attenuation; // 0.4V = half of front swing
  const rearSwitchingFreq = lambdaFreqHz; // same frequency, just attenuated

  // Generate waveform for charting
  const dt = 0.05;
  const waveform: RearO2Signal["waveform"] = [];
  for (let t = 0; t <= durationS; t += dt) {
    const frontSin = Math.sin(omega * t);
    const frontV = 0.5 + 0.4 * (frontSin > 0 ? 1 : -1); // square wave
    const rearSin = Math.sin(omega * (t - phaseDelay));
    const rearV = 0.5 + rearAmplitude * rearSin;
    waveform.push({ timeS: +t.toFixed(2), frontV: +frontV.toFixed(3), rearV: +rearV.toFixed(3) });
  }

  return {
    switchingFreqHz: +rearSwitchingFreq.toFixed(2),
    amplitudeV: +(rearAmplitude * 2).toFixed(3),
    delayS: +phaseDelay.toFixed(3),
    amplitudeRatio: +attenuation.toFixed(3),
    tauS: +tau.toFixed(2),
    waveform,
  };
}

/* ================================================================== */
/*  B2. P0420 Threshold Prediction                                    */
/* ================================================================== */

export interface P0420Result {
  pass: boolean;
  /** Measured metric value (depends on strategy) */
  metricValue: number;
  /** OBD threshold for this strategy */
  threshold: number;
  /** Margin: positive = passing, negative = failing */
  marginPct: number;
  strategy: ObdStrategy;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "FAIL";
  /** Recommended minimum OSC to guarantee pass */
  recommendedMinOscUmol: number;
  signal: RearO2Signal;
}

/**
 * Predict P0420 pass/fail for a given AM catalyst OSC against OEM OBD calibration.
 */
export function predictP0420(params: {
  /** AM catalyst aged OSC in µmol O2 per brick */
  amOscCapacityUmol: number;
  /** OEM aged OSC in µmol O2 per brick (from database) */
  oemAgedOscUmol: number;
  /** OBD calibration strategy */
  strategy?: ObdStrategy;
  /** Override threshold if known from platform data */
  thresholdOverride?: number;
  exhaustFlowKgPerH?: number;
}): P0420Result {
  const {
    amOscCapacityUmol,
    oemAgedOscUmol,
    strategy = "amplitude",
    thresholdOverride,
    exhaustFlowKgPerH = 60,
  } = params;

  const cal = OBD_CALIBRATIONS[strategy];
  const threshold = thresholdOverride ?? cal.threshold;

  const signal = simulateRearO2({ oscCapacityUmolPerBrick: amOscCapacityUmol, exhaustFlowKgPerH });

  let metricValue: number;
  switch (strategy) {
    case "amplitude":
      metricValue = signal.amplitudeRatio;
      break;
    case "delay":
      metricValue = signal.delayS;
      break;
    case "ratio":
      // Toyota/Honda/Hyundai ratio strategy: rear peak-to-peak / front peak-to-peak.
      // Front peak-to-peak = 0.8 V (fixed square wave ±0.4 V around 0.5 V).
      // Rear peak-to-peak = amplitudeV from signal. Scale to [0,1].
      metricValue = signal.amplitudeV / 0.8;
      break;
  }

  // For amplitude/ratio: lower metric = better (more attenuation). Pass if metric < threshold.
  // For delay: higher metric = better (more delay). Pass if metric > threshold.
  const pass = strategy === "delay"
    ? metricValue >= threshold
    : metricValue <= threshold;

  const marginPct = strategy === "delay"
    ? +((metricValue - threshold) / threshold * 100).toFixed(1)
    : +((threshold - metricValue) / threshold * 100).toFixed(1);

  let riskLevel: P0420Result["riskLevel"];
  if (!pass) riskLevel = "FAIL";
  else if (marginPct < 10) riskLevel = "HIGH";
  else if (marginPct < 25) riskLevel = "MEDIUM";
  else riskLevel = "LOW";

  // Back-calculate minimum OSC for guaranteed pass with 15% margin
  const targetMetric = strategy === "delay" ? threshold * 1.15 : threshold * 0.85;
  let targetTau: number;
  if (strategy === "delay") {
    // Phase delay of first-order filter: delay = atan(ω·τ) / ω → τ = tan(delay·ω) / ω
    // Maximum possible delay = π/(2ω). Cap the argument to avoid tan(≥π/2) → ±Infinity.
    const omega = 2 * Math.PI * 1.0; // lambdaFreqHz assumed 1.0 Hz for back-calc
    const maxDelay = (Math.PI / 2 - 0.01) / omega; // just below π/(2ω)
    const safeTarget = Math.min(targetMetric, maxDelay);
    targetTau = Math.tan(safeTarget * omega) / omega;
  } else {
    // amplitude/ratio: attenuation = 1/√(1+(ωτ)²) → τ = √(1/a²-1) / ω
    const omega = 2 * Math.PI * 1.0;
    const safeTarget = Math.max(targetMetric, 0.01); // prevent division by zero
    targetTau = Math.sqrt(Math.max(0, (1 / safeTarget) ** 2 - 1)) / omega;
  }
  const exhaustFlowKgPerS = exhaustFlowKgPerH / 3600;
  const o2FlowSwing = (0.03 / 0.01) * 0.0005 / 0.032 * exhaustFlowKgPerS;
  const recommendedMinOscUmol = Math.max(
    oemAgedOscUmol * 0.55,
    +(targetTau * o2FlowSwing * 1e6).toFixed(0),
  );

  return {
    pass,
    metricValue: +metricValue.toFixed(3),
    threshold,
    marginPct,
    strategy,
    riskLevel,
    recommendedMinOscUmol: +recommendedMinOscUmol.toFixed(0),
    signal,
  };
}

/* ================================================================== */
/*  B3. Multi-Cycle Verification (R103: 3× Type 1)                   */
/* ================================================================== */

export interface CycleResult {
  cycleNumber: number;
  oscVariationPct: number;
  effectiveOscUmol: number;
  p0420: P0420Result;
  milStatus: "OFF" | "PENDING" | "ON";
}

export interface MultiCycleResult {
  cycles: CycleResult[];
  overallPass: boolean;
  worstMarginPct: number;
  /** OBD counter state: increments on fail, decrements on pass */
  obdCounterFinal: number;
}

/**
 * Simulate 3 consecutive Type 1 WLTP cycles with cycle-to-cycle variation.
 * R103 requires no MIL illumination over 3 consecutive cycles.
 */
export function verifyObdMultiCycle(params: {
  amOscCapacityUmol: number;
  oemAgedOscUmol: number;
  strategy?: ObdStrategy;
  exhaustFlowKgPerH?: number;
  /** Cycle-to-cycle OSC variation as fraction (default 0.05 = ±5%) */
  cycleVariation?: number;
  numCycles?: number;
}): MultiCycleResult {
  const {
    amOscCapacityUmol,
    oemAgedOscUmol,
    strategy = "amplitude",
    exhaustFlowKgPerH = 60,
    cycleVariation = 0.05,
    numCycles = 3,
  } = params;

  const cycles: CycleResult[] = [];
  let obdCounter = 0;

  // Deterministic variation pattern: -var, 0, +var for reproducibility
  const variations = [-cycleVariation, 0, cycleVariation];

  for (let i = 0; i < numCycles; i++) {
    const variation = variations[i % variations.length];
    const effectiveOsc = +(amOscCapacityUmol * (1 + variation)).toFixed(0);

    const p0420 = predictP0420({
      amOscCapacityUmol: effectiveOsc,
      oemAgedOscUmol,
      strategy,
      exhaustFlowKgPerH,
    });

    if (p0420.pass) {
      obdCounter = Math.max(0, obdCounter - 1);
    } else {
      obdCounter += 1;
    }

    let milStatus: CycleResult["milStatus"] = "OFF";
    if (obdCounter >= 3) milStatus = "ON";
    else if (obdCounter >= 1) milStatus = "PENDING";

    cycles.push({
      cycleNumber: i + 1,
      oscVariationPct: +(variation * 100).toFixed(1),
      effectiveOscUmol: effectiveOsc,
      p0420,
      milStatus,
    });
  }

  const overallPass = cycles.every((c) => c.milStatus !== "ON");
  const worstMarginPct = Math.min(...cycles.map((c) => c.p0420.marginPct));

  return { cycles, overallPass, worstMarginPct, obdCounterFinal: obdCounter };
}
