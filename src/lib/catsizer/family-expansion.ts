/**
 * Engine family expansion — auto-generate AM specs for all displacement/power
 * variants from one base design, and optimize R103 test scope.
 */

/* ================================================================== */
/*  Types                                                             */
/* ================================================================== */

export interface EngineFamilyMember {
  engineCode: string;
  displacementCc: number;
  powerKw: number;
  /** Max exhaust temperature at rated power in °C */
  maxExhaustTempC: number;
  /** Vehicle inertia class in kg */
  inertiaClassKg: number;
  vehicleModel?: string;
}

export interface FamilyVariantSpec {
  member: EngineFamilyMember;
  /** Scaled PGM loading in g/brick */
  pgmGPerBrick: number;
  /** Scaled substrate volume in L */
  substrateVolumeL: number;
  /** Whether this variant shares the base component or needs a unique one */
  sharedWithBase: boolean;
  /** Scaling factor applied to base PGM */
  pgmScaleFactor: number;
  /** Scaling factor applied to base volume */
  volumeScaleFactor: number;
  /** Additional thermal margin needed in °C */
  thermalMarginC: number;
  notes: string[];
}

export interface FamilyExpansionResult {
  baseDesign: EngineFamilyMember;
  basePgmGPerBrick: number;
  baseVolumeL: number;
  variants: FamilyVariantSpec[];
  /** Number of unique AM part numbers needed (MOPs) */
  uniquePartNumbers: number;
  /** Number of members sharing the base part number */
  sharedPartNumbers: number;
  /** Total MOTs (base + all variants) */
  totalMotCount: number;
  /**
   * Estimated R103 test cost saving vs. testing each MOT individually.
   * Assumes €6,500 per test avoided.
   */
  r103TestCostSavingEur: number;
  /**
   * Estimated engineering hours saved by part consolidation.
   * Assumes 40 h/part number avoided.
   */
  engineeringHoursSaved: number;
  /** Number of R103 tests required under family approach */
  r103TestsRequired: number;
  /** Number of R103 tests that would be required without family approach */
  r103TestsWithout: number;
}

/* ================================================================== */
/*  D1. Auto-Expand Engine Family                                     */
/* ================================================================== */

/**
 * Scale a base AM design to all engine family members.
 *
 * Scaling rules:
 * - PGM g/brick scales with displacement^0.7 (exhaust volume correlation)
 * - Substrate volume scales linearly with displacement
 * - Higher power variants need more thermal margin
 * - Variants within ±10% of base can share the same part number
 */
export function expandEngineFamily(params: {
  baseDesign: EngineFamilyMember;
  basePgmGPerBrick: number;
  baseVolumeL: number;
  familyMembers: EngineFamilyMember[];
}): FamilyExpansionResult {
  const { baseDesign, basePgmGPerBrick, baseVolumeL, familyMembers } = params;

  const variants: FamilyVariantSpec[] = familyMembers.map((member) => {
    const dispRatio = member.displacementCc / baseDesign.displacementCc;
    const powerRatio = member.powerKw / baseDesign.powerKw;

    // PGM scales with displacement^0.7 (empirical correlation from OEM data)
    const pgmScale = Math.pow(dispRatio, 0.7);
    const pgmGPerBrick = +(basePgmGPerBrick * pgmScale).toFixed(2);

    // Volume scales linearly with displacement
    const volumeScale = dispRatio;
    const substrateVolumeL = +(baseVolumeL * volumeScale).toFixed(3);

    // Thermal margin: higher power = higher exhaust temp
    const thermalMarginC = +(Math.max(0, (member.maxExhaustTempC - baseDesign.maxExhaustTempC))).toFixed(0);

    // Can share part number if within ±10% on both PGM and volume
    const sharedWithBase = Math.abs(pgmScale - 1) < 0.10 && Math.abs(volumeScale - 1) < 0.10;

    const notes: string[] = [];
    if (thermalMarginC > 30) {
      notes.push(`High exhaust temp (+${thermalMarginC}°C vs base) — consider higher Ce content for OSC stability`);
    }
    if (powerRatio > 1.3) {
      notes.push("Power >30% above base — verify backpressure at rated flow");
    }
    if (dispRatio < 0.75) {
      notes.push("Displacement <75% of base — substrate may be oversized, check packaging");
    }
    if (sharedWithBase && member.engineCode !== baseDesign.engineCode) {
      notes.push("Within ±10% of base — can share same AM part number");
    }

    return {
      member,
      pgmGPerBrick,
      substrateVolumeL,
      sharedWithBase,
      pgmScaleFactor: +pgmScale.toFixed(3),
      volumeScaleFactor: +volumeScale.toFixed(3),
      thermalMarginC: +thermalMarginC,
      notes,
    };
  });

  const uniquePartNumbers = variants.filter((v) => !v.sharedWithBase).length;
  const sharedPartNumbers = variants.filter((v) => v.sharedWithBase).length;
  const totalMotCount = 1 + variants.length; // base + all members

  // Economics: with family approach you need (1 + uniquePartNumbers) R103 tests
  // (one for the base MOP, one per unique additional MOP).
  // Without family approach you would need one test per MOT.
  const r103TestsRequired = 1 + uniquePartNumbers;
  const r103TestsWithout = totalMotCount;
  const testsSaved = r103TestsWithout - r103TestsRequired;
  const r103TestCostSavingEur = Math.max(0, testsSaved) * 6500;
  const engineeringHoursSaved = Math.max(0, testsSaved) * 40;

  return {
    baseDesign,
    basePgmGPerBrick,
    baseVolumeL,
    variants,
    uniquePartNumbers,
    sharedPartNumbers,
    totalMotCount,
    r103TestCostSavingEur,
    engineeringHoursSaved,
    r103TestsRequired,
    r103TestsWithout,
  };
}

/* ================================================================== */
/*  D2. R103 Scope Optimization                                       */
/* ================================================================== */

export interface R103ScopeResult {
  /** Recommended test vehicle (worst-case) */
  testVehicle: EngineFamilyMember;
  /** Justification for selection */
  selectionReason: string;
  /** R103 scope declaration text */
  scopeDeclaration: string;
  /** Risk assessment per family member */
  memberRisks: {
    member: EngineFamilyMember;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    riskFactors: string[];
  }[];
  /** Minimum number of test vehicles needed */
  minTestVehicles: number;
}

/**
 * Select the worst-case test vehicle for R103 scope coverage.
 *
 * R103 allows one test vehicle to cover the engine family if:
 * - Same engine family (shared block, head, ECS architecture)
 * - Test vehicle is worst-case (heaviest, highest inertia, most demanding)
 */
export function optimizeR103Scope(params: {
  familyMembers: EngineFamilyMember[];
  emissionStandard: string;
  amComponentList: string[];
}): R103ScopeResult {
  const { familyMembers, emissionStandard, amComponentList } = params;

  if (familyMembers.length === 0) {
    throw new Error("At least one family member required");
  }

  // Score each member: higher = more demanding = better test candidate
  const scored = familyMembers.map((m) => {
    let score = 0;
    score += m.inertiaClassKg / 100; // heavier = harder
    score += m.displacementCc / 500; // larger displacement = more exhaust
    score += m.maxExhaustTempC / 100; // hotter = more aging stress
    score -= m.powerKw / 50; // lower power = lower exhaust flow = harder for catalyst
    return { member: m, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const testVehicle = scored[0].member;

  // Check if any members are too different to be covered by one test
  const maxDispRatio = Math.max(...familyMembers.map((m) => m.displacementCc)) /
    Math.min(...familyMembers.map((m) => m.displacementCc));

  const minTestVehicles = maxDispRatio > 1.6 ? 2 : 1;

  const selectionReason = [
    `Highest inertia class (${testVehicle.inertiaClassKg} kg)`,
    `Exhaust temp ${testVehicle.maxExhaustTempC}°C`,
    testVehicle.vehicleModel ? `Vehicle: ${testVehicle.vehicleModel}` : "",
  ].filter(Boolean).join(", ");

  const scopeDeclaration = [
    `R103 Type Approval Scope Declaration`,
    `Emission Standard: ${emissionStandard}`,
    `Engine Family: ${familyMembers.map((m) => m.engineCode).join(", ")}`,
    `Displacement Range: ${Math.min(...familyMembers.map((m) => m.displacementCc))}–${Math.max(...familyMembers.map((m) => m.displacementCc))} cc`,
    `Power Range: ${Math.min(...familyMembers.map((m) => m.powerKw))}–${Math.max(...familyMembers.map((m) => m.powerKw))} kW`,
    `AM Components: ${amComponentList.join(", ")}`,
    `Test Vehicle: ${testVehicle.engineCode}${testVehicle.vehicleModel ? ` (${testVehicle.vehicleModel})` : ""}`,
    `Number of Test Vehicles: ${minTestVehicles}`,
  ].join("\n");

  const memberRisks = familyMembers.map((m) => {
    const riskFactors: string[] = [];
    const dispRatio = m.displacementCc / testVehicle.displacementCc;

    if (dispRatio < 0.7) riskFactors.push("Displacement significantly below test vehicle — catalyst may be oversized");
    if (m.maxExhaustTempC > testVehicle.maxExhaustTempC + 20) riskFactors.push("Higher exhaust temp than test vehicle");
    if (m.inertiaClassKg > testVehicle.inertiaClassKg) riskFactors.push("Higher inertia class than test vehicle");

    const riskLevel: "LOW" | "MEDIUM" | "HIGH" =
      riskFactors.length === 0 ? "LOW" :
      riskFactors.length === 1 ? "MEDIUM" : "HIGH";

    return { member: m, riskLevel, riskFactors };
  });

  return {
    testVehicle,
    selectionReason,
    scopeDeclaration,
    memberRisks,
    minTestVehicles,
  };
}
