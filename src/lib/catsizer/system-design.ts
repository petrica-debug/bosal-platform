/**
 * Multi-brick system design — coordinated ECS architecture handling
 * and system-level backpressure budgeting.
 *
 * Handles CC-TWC + GPF, CC-TWC + UF-TWC (HEV), DOC + SDPF + SCR,
 * and single-brick configurations.
 */

/* ================================================================== */
/*  Types                                                             */
/* ================================================================== */

export type SystemArchitecture =
  | "CC-TWC-only"
  | "CC-TWC+GPF"
  | "CC-TWC+UF-TWC"
  | "DOC+SDPF+SCR"
  | "DOC+DPF+SCR";

export type BrickRole = "CC-TWC" | "UF-TWC" | "GPF" | "DOC" | "SDPF" | "DPF" | "SCR";

export interface BrickSpec {
  role: BrickRole;
  substrateType: "ceramic" | "metallic" | "wall-flow";
  diameterMm: number;
  lengthMm: number;
  volumeL: number;
  cellDensityCpsi: number;
  wallThicknessMil: number;
  /** PGM loading in g/L (0 for non-catalyzed bricks like bare GPF) */
  pgmGPerL: number;
  /** OSC loading in g/L */
  oscGPerL: number;
  /** Washcoat loading in g/L */
  washcoatGPerL: number;
  /** Backpressure at rated flow in kPa */
  backpressureKPa: number;
}

export interface SystemDesignResult {
  architecture: SystemArchitecture;
  bricks: BrickSpec[];
  totalBackpressureKPa: number;
  oemBackpressureKPa: number;
  backpressureMarginPct: number;
  /** Total system PGM in g */
  totalPgmG: number;
  /** Total system OSC in g */
  totalOscG: number;
  notes: string[];
}

/* ================================================================== */
/*  Architecture templates                                            */
/* ================================================================== */

const ARCHITECTURE_TEMPLATES: Record<SystemArchitecture, BrickRole[]> = {
  "CC-TWC-only": ["CC-TWC"],
  "CC-TWC+GPF": ["CC-TWC", "GPF"],
  "CC-TWC+UF-TWC": ["CC-TWC", "UF-TWC"],
  "DOC+SDPF+SCR": ["DOC", "SDPF", "SCR"],
  "DOC+DPF+SCR": ["DOC", "DPF", "SCR"],
};

/* ================================================================== */
/*  C1. System Architecture Handler                                   */
/* ================================================================== */

export interface SystemDesignInput {
  architecture: SystemArchitecture;
  /** Total system PGM budget in g/L (from OEM reference, derated) */
  totalPgmBudgetGPerL: number;
  /** Total system OSC budget in g/L */
  totalOscBudgetGPerL: number;
  /** Engine rated exhaust flow in kg/h */
  ratedExhaustFlowKgPerH: number;
  /** OEM system backpressure at rated flow in kPa */
  oemBackpressureKPa: number;
  /** Substrate specs per brick (optional overrides) */
  brickOverrides?: Partial<Record<BrickRole, Partial<BrickSpec>>>;
}

/**
 * Design a coordinated multi-brick system with internally consistent specs.
 *
 * PGM and OSC budgets are distributed across bricks according to architecture-
 * specific rules (e.g., GPF OSC contribution reduces CC-TWC OSC need).
 */
export function designSystem(input: SystemDesignInput): SystemDesignResult {
  const { architecture, totalPgmBudgetGPerL, totalOscBudgetGPerL, ratedExhaustFlowKgPerH, oemBackpressureKPa, brickOverrides } = input;

  const roles = ARCHITECTURE_TEMPLATES[architecture];
  const notes: string[] = [];
  const bricks: BrickSpec[] = [];

  for (const role of roles) {
    const override = brickOverrides?.[role] ?? {};
    const brick = buildBrickSpec(role, totalPgmBudgetGPerL, totalOscBudgetGPerL, architecture, ratedExhaustFlowKgPerH, override);
    bricks.push(brick);
  }

  // Architecture-specific coordination
  if (architecture === "CC-TWC+GPF") {
    const gpf = bricks.find((b) => b.role === "GPF")!;
    const cc = bricks.find((b) => b.role === "CC-TWC")!;
    // GPF with catalyzed washcoat contributes 5-15 g/L OSC equivalent
    const gpfOscContribution = gpf.oscGPerL * gpf.volumeL;
    const ccOscReduction = Math.min(gpfOscContribution, cc.oscGPerL * cc.volumeL * 0.15);
    cc.oscGPerL = +((cc.oscGPerL * cc.volumeL - ccOscReduction) / cc.volumeL).toFixed(1);
    notes.push(`GPF OSC contribution reduces CC-TWC OSC need by ${ccOscReduction.toFixed(1)}g`);
  }

  if (architecture === "CC-TWC+UF-TWC") {
    const cc = bricks.find((b) => b.role === "CC-TWC")!;
    const uf = bricks.find((b) => b.role === "UF-TWC")!;
    // UF-TWC needs faster light-off: higher PGM density, lower thermal mass
    uf.pgmGPerL = +(totalPgmBudgetGPerL * 0.45).toFixed(2);
    cc.pgmGPerL = +(totalPgmBudgetGPerL * 0.55).toFixed(2);
    notes.push("UF-TWC gets 45% of PGM budget for faster light-off (HEV cold-start strategy)");
  }

  // Compute backpressure
  const totalBp = bricks.reduce((sum, b) => sum + b.backpressureKPa, 0);
  const bpMargin = +((oemBackpressureKPa * 1.1 - totalBp) / (oemBackpressureKPa * 1.1) * 100).toFixed(1);

  if (bpMargin < 0) {
    notes.push(`WARNING: System backpressure ${totalBp.toFixed(1)} kPa exceeds OEM+10% limit of ${(oemBackpressureKPa * 1.1).toFixed(1)} kPa`);
  }

  const totalPgmG = +bricks.reduce((sum, b) => sum + b.pgmGPerL * b.volumeL, 0).toFixed(2);
  const totalOscG = +bricks.reduce((sum, b) => sum + b.oscGPerL * b.volumeL, 0).toFixed(1);

  return {
    architecture,
    bricks,
    totalBackpressureKPa: +totalBp.toFixed(2),
    oemBackpressureKPa,
    backpressureMarginPct: bpMargin,
    totalPgmG,
    totalOscG,
    notes,
  };
}

/* ================================================================== */
/*  Brick spec builder                                                */
/* ================================================================== */

function buildBrickSpec(
  role: BrickRole,
  systemPgmGPerL: number,
  systemOscGPerL: number,
  arch: SystemArchitecture,
  exhaustFlowKgPerH: number,
  override: Partial<BrickSpec>,
): BrickSpec {
  const defaults = BRICK_DEFAULTS[role];
  const diam = override.diameterMm ?? defaults.diameterMm;
  const len = override.lengthMm ?? defaults.lengthMm;
  const vol = +(Math.PI * (diam / 2000) ** 2 * (len / 1000) * 1000).toFixed(3); // liters

  let pgm = 0;
  let osc = 0;
  let wc = 0;

  switch (role) {
    case "CC-TWC":
      pgm = systemPgmGPerL;
      osc = systemOscGPerL;
      wc = 200;
      break;
    case "UF-TWC":
      pgm = systemPgmGPerL * 0.45;
      osc = systemOscGPerL * 0.6;
      wc = 160;
      break;
    case "GPF":
      pgm = arch === "CC-TWC+GPF" ? systemPgmGPerL * 0.1 : 0;
      osc = arch === "CC-TWC+GPF" ? systemOscGPerL * 0.15 : 0;
      wc = arch === "CC-TWC+GPF" ? 40 : 0;
      break;
    case "DOC":
      pgm = systemPgmGPerL * 0.3;
      osc = 0;
      wc = 100;
      break;
    case "SDPF":
      pgm = 0;
      osc = 0;
      wc = 120; // Cu-zeolite
      break;
    case "DPF":
      pgm = 0;
      osc = 0;
      wc = 0;
      break;
    case "SCR":
      pgm = 0;
      osc = 0;
      wc = 150; // V or Cu-zeolite
      break;
  }

  const bp = computeBrickBackpressure(role, diam, len, defaults.cellDensityCpsi, defaults.wallThicknessMil, exhaustFlowKgPerH);

  return {
    role,
    substrateType: override.substrateType ?? defaults.substrateType,
    diameterMm: diam,
    lengthMm: len,
    volumeL: override.volumeL ?? vol,
    cellDensityCpsi: override.cellDensityCpsi ?? defaults.cellDensityCpsi,
    wallThicknessMil: override.wallThicknessMil ?? defaults.wallThicknessMil,
    pgmGPerL: +(override.pgmGPerL ?? pgm).toFixed(2),
    oscGPerL: +(override.oscGPerL ?? osc).toFixed(1),
    washcoatGPerL: +(override.washcoatGPerL ?? wc).toFixed(0),
    backpressureKPa: +bp.toFixed(2),
  };
}

const BRICK_DEFAULTS: Record<BrickRole, {
  substrateType: BrickSpec["substrateType"];
  diameterMm: number;
  lengthMm: number;
  cellDensityCpsi: number;
  wallThicknessMil: number;
}> = {
  "CC-TWC": { substrateType: "ceramic", diameterMm: 118.4, lengthMm: 127, cellDensityCpsi: 600, wallThicknessMil: 3.5 },
  "UF-TWC": { substrateType: "ceramic", diameterMm: 105, lengthMm: 90, cellDensityCpsi: 600, wallThicknessMil: 3.0 },
  "GPF": { substrateType: "wall-flow", diameterMm: 132, lengthMm: 127, cellDensityCpsi: 300, wallThicknessMil: 8 },
  "DOC": { substrateType: "ceramic", diameterMm: 143.8, lengthMm: 76.2, cellDensityCpsi: 400, wallThicknessMil: 4 },
  "SDPF": { substrateType: "wall-flow", diameterMm: 190.5, lengthMm: 254, cellDensityCpsi: 300, wallThicknessMil: 12 },
  "DPF": { substrateType: "wall-flow", diameterMm: 190.5, lengthMm: 254, cellDensityCpsi: 200, wallThicknessMil: 12 },
  "SCR": { substrateType: "ceramic", diameterMm: 190.5, lengthMm: 152.4, cellDensityCpsi: 400, wallThicknessMil: 4 },
};

/* ================================================================== */
/*  C2. Backpressure Budget                                           */
/* ================================================================== */

/**
 * Per-brick backpressure estimate.
 * Flow-through: Hagen-Poiseuille (laminar channel flow)
 * Wall-flow: Darcy (porous wall + channel friction)
 */
function computeBrickBackpressure(
  role: BrickRole,
  diameterMm: number,
  lengthMm: number,
  cpsi: number,
  wallMil: number,
  exhaustFlowKgPerH: number,
): number {
  const areaM2 = Math.PI * (diameterMm / 2000) ** 2;
  const lengthM = lengthMm / 1000;
  const wallM = wallMil * 25.4e-6; // mil to meters

  // Cell hydraulic diameter
  const cellPitchM = 25.4e-3 / Math.sqrt(cpsi); // approximate pitch
  const channelM = cellPitchM - wallM;
  const openFrontalArea = (channelM / cellPitchM) ** 2;

  // Exhaust properties at ~500°C
  const rho = 0.45; // kg/m³
  const mu = 3.5e-5; // Pa·s

  const volumeFlowM3PerS = (exhaustFlowKgPerH / 3600) / rho;
  const velocity = volumeFlowM3PerS / (areaM2 * openFrontalArea);

  const isWallFlow = role === "GPF" || role === "SDPF" || role === "DPF";

  if (isWallFlow) {
    // Darcy: ΔP_wall = (mu * v * L_wall) / permeability + channel friction
    const permeability = 1e-13; // m² — typical SiC wall
    const wallDp = (mu * velocity * wallM * 2) / permeability; // through 2 walls
    const channelDp = (32 * mu * velocity * lengthM) / (channelM ** 2);
    return (wallDp + channelDp) / 1000; // Pa to kPa
  }

  // Flow-through: Hagen-Poiseuille
  const dh = channelM; // hydraulic diameter ≈ channel width for square cells
  const dp = (32 * mu * velocity * lengthM) / (dh ** 2);
  return dp / 1000;
}

/**
 * Compute total system backpressure from an array of brick specs.
 */
export function computeSystemBackpressure(bricks: BrickSpec[]): {
  perBrick: { role: BrickRole; kPa: number }[];
  totalKPa: number;
} {
  const perBrick = bricks.map((b) => ({ role: b.role, kPa: b.backpressureKPa }));
  const totalKPa = +perBrick.reduce((sum, b) => sum + b.kPa, 0).toFixed(2);
  return { perBrick, totalKPa };
}
