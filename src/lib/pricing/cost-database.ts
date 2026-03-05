/**
 * BOSAL Integrator Cost Database
 *
 * Editable cost inputs for all manufacturing and material costs.
 * Stored in localStorage for admin persistence. Defaults are realistic
 * industry values for a European catalyst integrator.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WeldingCosts {
  mig_per_meter_eur: number;
  tig_per_meter_eur: number;
  laser_per_meter_eur: number;
  robot_per_meter_eur: number;
  spot_per_point_eur: number;
}

export interface CanningCosts {
  shell_ss409_per_kg_eur: number;
  shell_ss441_per_kg_eur: number;
  shell_ss304_per_kg_eur: number;
  cone_per_kg_eur: number;
  flange_vband_eur: number;
  flange_bolted_eur: number;
  mounting_mat_per_m2_eur: number;
  mounting_mat_interam_per_pc_eur: number;
  heatshield_per_kg_eur: number;
}

export interface SubstrateCosts {
  cordierite_per_liter_eur: number;
  sic_per_liter_eur: number;
  metallic_per_liter_eur: number;
  gpf_cordierite_per_liter_eur: number;
}

export interface CoatingCosts {
  alumina_per_kg_eur: number;
  cezr_per_kg_eur: number;
  zeolite_cu_per_kg_eur: number;
  zeolite_fe_per_kg_eur: number;
  titania_per_kg_eur: number;
  binder_per_kg_eur: number;
  coating_labor_per_brick_eur: number;
}

export interface PGMCosts {
  pt_per_troy_oz_usd: number;
  pd_per_troy_oz_usd: number;
  rh_per_troy_oz_usd: number;
  ir_per_troy_oz_usd: number;
  ru_per_troy_oz_usd: number;
  eur_usd_rate: number;
}

export interface UreaSystemCosts {
  injector_eur: number;
  pump_module_eur: number;
  tank_20l_eur: number;
  tank_40l_eur: number;
  dcu_eur: number;
  nox_sensor_eur: number;
  temp_sensor_eur: number;
  mixer_blade_eur: number;
  mixer_swirl_eur: number;
  def_line_per_meter_eur: number;
}

export interface HeatExchangerCosts {
  inconel625_tube_per_kg_eur: number;
  ss310_tube_per_kg_eur: number;
  haynes230_tube_per_kg_eur: number;
  shell_per_kg_eur: number;
  tubesheet_per_kg_eur: number;
  baffle_per_pc_eur: number;
  insulation_per_m2_eur: number;
  plate_ss316_per_kg_eur: number;
}

export interface ManufacturingOverhead {
  manufacturing_pct: number;
  quality_inspection_pct: number;
  packaging_per_unit_eur: number;
  logistics_pct: number;
  overhead_pct: number;
  profit_margin_pct: number;
  warranty_reserve_pct: number;
}

export interface CostDatabase {
  welding: WeldingCosts;
  canning: CanningCosts;
  substrate: SubstrateCosts;
  coating: CoatingCosts;
  pgm: PGMCosts;
  urea: UreaSystemCosts;
  heatExchanger: HeatExchangerCosts;
  manufacturing: ManufacturingOverhead;
  lastUpdated: string;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

export const DEFAULT_COST_DB: CostDatabase = {
  welding: {
    mig_per_meter_eur: 8.50,
    tig_per_meter_eur: 14.00,
    laser_per_meter_eur: 22.00,
    robot_per_meter_eur: 5.50,
    spot_per_point_eur: 0.35,
  },
  canning: {
    shell_ss409_per_kg_eur: 3.80,
    shell_ss441_per_kg_eur: 5.20,
    shell_ss304_per_kg_eur: 6.50,
    cone_per_kg_eur: 4.50,
    flange_vband_eur: 8.00,
    flange_bolted_eur: 5.50,
    mounting_mat_per_m2_eur: 45.00,
    mounting_mat_interam_per_pc_eur: 8.00,
    heatshield_per_kg_eur: 7.50,
  },
  substrate: {
    cordierite_per_liter_eur: 12.00,
    sic_per_liter_eur: 28.00,
    metallic_per_liter_eur: 18.00,
    gpf_cordierite_per_liter_eur: 22.00,
  },
  coating: {
    alumina_per_kg_eur: 12.00,
    cezr_per_kg_eur: 45.00,
    zeolite_cu_per_kg_eur: 85.00,
    zeolite_fe_per_kg_eur: 65.00,
    titania_per_kg_eur: 8.00,
    binder_per_kg_eur: 25.00,
    coating_labor_per_brick_eur: 15.00,
  },
  pgm: {
    pt_per_troy_oz_usd: 2148,
    pd_per_troy_oz_usd: 1671,
    rh_per_troy_oz_usd: 11350,
    ir_per_troy_oz_usd: 4800,
    ru_per_troy_oz_usd: 650,
    eur_usd_rate: 1.08,
  },
  urea: {
    injector_eur: 180,
    pump_module_eur: 120,
    tank_20l_eur: 45,
    tank_40l_eur: 72,
    dcu_eur: 250,
    nox_sensor_eur: 95,
    temp_sensor_eur: 15,
    mixer_blade_eur: 35,
    mixer_swirl_eur: 55,
    def_line_per_meter_eur: 8,
  },
  heatExchanger: {
    inconel625_tube_per_kg_eur: 85,
    ss310_tube_per_kg_eur: 28,
    haynes230_tube_per_kg_eur: 120,
    shell_per_kg_eur: 12,
    tubesheet_per_kg_eur: 18,
    baffle_per_pc_eur: 15,
    insulation_per_m2_eur: 35,
    plate_ss316_per_kg_eur: 22,
  },
  manufacturing: {
    manufacturing_pct: 15,
    quality_inspection_pct: 3,
    packaging_per_unit_eur: 12,
    logistics_pct: 5,
    overhead_pct: 8,
    profit_margin_pct: 25,
    warranty_reserve_pct: 2,
  },
  lastUpdated: new Date().toISOString(),
};

// ─── Persistence ────────────────────────────────────────────────────────────

const STORAGE_KEY = "bosal-cost-database";

export function loadCostDB(): CostDatabase {
  if (typeof window === "undefined") return DEFAULT_COST_DB;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COST_DB;
    return { ...DEFAULT_COST_DB, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_COST_DB;
  }
}

export function saveCostDB(db: CostDatabase): void {
  if (typeof window === "undefined") return;
  db.lastUpdated = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

export function resetCostDB(): CostDatabase {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
  return DEFAULT_COST_DB;
}

// ─── Integrator Pricing Calculator ──────────────────────────────────────────

export interface CatalystBrickCost {
  name: string;
  type: string;
  substrate_eur: number;
  coating_eur: number;
  pgm_eur: number;
  mat_eur: number;
  canning_shell_eur: number;
  canning_cone_eur: number;
  welding_eur: number;
  subtotal_eur: number;
}

export interface SystemPricingResult {
  bricks: CatalystBrickCost[];
  ureaSystem_eur: number;
  materialTotal_eur: number;
  manufacturing_eur: number;
  qualityInspection_eur: number;
  packaging_eur: number;
  logistics_eur: number;
  overhead_eur: number;
  warrantyReserve_eur: number;
  costPrice_eur: number;
  profitMargin_eur: number;
  quotedPrice_eur: number;
}

const TROY_OZ_G = 31.1035;

export function calculateBrickCost(
  db: CostDatabase,
  brick: {
    name: string;
    type: string;
    volume_L: number;
    diameter_mm: number;
    length_mm: number;
    substrateMaterial: "cordierite" | "sic" | "metallic" | "gpf";
    washcoatType: string;
    washcoatLoading_g_L: number;
    pgm_Pt_g_ft3: number;
    pgm_Pd_g_ft3: number;
    pgm_Rh_g_ft3: number;
    shellMaterial: "ss409" | "ss441" | "ss304";
    hasCones: boolean;
  },
): CatalystBrickCost {
  // Substrate
  const subCostPerL = brick.substrateMaterial === "sic" ? db.substrate.sic_per_liter_eur
    : brick.substrateMaterial === "metallic" ? db.substrate.metallic_per_liter_eur
    : brick.substrateMaterial === "gpf" ? db.substrate.gpf_cordierite_per_liter_eur
    : db.substrate.cordierite_per_liter_eur;
  const substrate_eur = brick.volume_L * subCostPerL;

  // Coating
  const wcMass_kg = (brick.washcoatLoading_g_L * brick.volume_L) / 1000;
  const wcCostPerKg = brick.washcoatType.includes("zeolite_cu") ? db.coating.zeolite_cu_per_kg_eur
    : brick.washcoatType.includes("zeolite_fe") ? db.coating.zeolite_fe_per_kg_eur
    : brick.washcoatType.includes("cezr") ? db.coating.cezr_per_kg_eur
    : brick.washcoatType.includes("titania") ? db.coating.titania_per_kg_eur
    : db.coating.alumina_per_kg_eur;
  const coating_eur = wcMass_kg * wcCostPerKg + db.coating.coating_labor_per_brick_eur;

  // PGM
  const vol_ft3 = brick.volume_L / 28.3168;
  const ptMass_g = brick.pgm_Pt_g_ft3 * vol_ft3;
  const pdMass_g = brick.pgm_Pd_g_ft3 * vol_ft3;
  const rhMass_g = brick.pgm_Rh_g_ft3 * vol_ft3;
  const pgm_usd = (ptMass_g / TROY_OZ_G) * db.pgm.pt_per_troy_oz_usd
    + (pdMass_g / TROY_OZ_G) * db.pgm.pd_per_troy_oz_usd
    + (rhMass_g / TROY_OZ_G) * db.pgm.rh_per_troy_oz_usd;
  const pgm_eur = pgm_usd / db.pgm.eur_usd_rate;

  // Mounting mat
  const circumference_m = Math.PI * (brick.diameter_mm / 1000);
  const matArea_m2 = circumference_m * (brick.length_mm / 1000);
  const mat_eur = matArea_m2 * db.canning.mounting_mat_per_m2_eur;

  // Canning shell
  const shellThickness_mm = 1.5;
  const shellOD_mm = brick.diameter_mm + 2 * 5 + 2 * shellThickness_mm; // mat + shell
  const shellMass_kg = Math.PI * (shellOD_mm / 1000) * (brick.length_mm / 1000) * (shellThickness_mm / 1000) * 7800;
  const shellCostPerKg = brick.shellMaterial === "ss441" ? db.canning.shell_ss441_per_kg_eur
    : brick.shellMaterial === "ss304" ? db.canning.shell_ss304_per_kg_eur
    : db.canning.shell_ss409_per_kg_eur;
  const canning_shell_eur = shellMass_kg * shellCostPerKg;

  // Cones
  const coneMass_kg = brick.hasCones ? 0.3 * 2 : 0; // ~0.3 kg per cone
  const canning_cone_eur = coneMass_kg * db.canning.cone_per_kg_eur;

  // Welding (2 circumferential welds per brick + cone welds)
  const weldLength_m = circumference_m * (brick.hasCones ? 4 : 2);
  const welding_eur = weldLength_m * db.welding.robot_per_meter_eur;

  const subtotal = substrate_eur + coating_eur + pgm_eur + mat_eur + canning_shell_eur + canning_cone_eur + welding_eur;

  return {
    name: brick.name,
    type: brick.type,
    substrate_eur,
    coating_eur,
    pgm_eur,
    mat_eur,
    canning_shell_eur,
    canning_cone_eur,
    welding_eur,
    subtotal_eur: subtotal,
  };
}

export function calculateSystemPricing(
  db: CostDatabase,
  brickCosts: CatalystBrickCost[],
  includeUrea: boolean,
  ureaConfig?: { hasMixer: boolean; mixerType?: "blade" | "swirl"; tankSize?: "20l" | "40l" },
): SystemPricingResult {
  const brickTotal = brickCosts.reduce((s, b) => s + b.subtotal_eur, 0);

  let ureaSystem_eur = 0;
  if (includeUrea) {
    ureaSystem_eur = db.urea.injector_eur + db.urea.pump_module_eur + db.urea.dcu_eur
      + (ureaConfig?.tankSize === "40l" ? db.urea.tank_40l_eur : db.urea.tank_20l_eur)
      + db.urea.nox_sensor_eur * 2 + db.urea.temp_sensor_eur * 3
      + db.urea.def_line_per_meter_eur * 2;
    if (ureaConfig?.hasMixer) {
      ureaSystem_eur += ureaConfig.mixerType === "swirl" ? db.urea.mixer_swirl_eur : db.urea.mixer_blade_eur;
    }
  }

  const materialTotal = brickTotal + ureaSystem_eur;
  const manufacturing = materialTotal * (db.manufacturing.manufacturing_pct / 100);
  const qualityInspection = materialTotal * (db.manufacturing.quality_inspection_pct / 100);
  const packaging = db.manufacturing.packaging_per_unit_eur;
  const logistics = materialTotal * (db.manufacturing.logistics_pct / 100);
  const overhead = materialTotal * (db.manufacturing.overhead_pct / 100);
  const warrantyReserve = materialTotal * (db.manufacturing.warranty_reserve_pct / 100);

  const costPrice = materialTotal + manufacturing + qualityInspection + packaging + logistics + overhead + warrantyReserve;
  const profitMargin = costPrice * (db.manufacturing.profit_margin_pct / 100);
  const quotedPrice = costPrice + profitMargin;

  return {
    bricks: brickCosts,
    ureaSystem_eur: ureaSystem_eur,
    materialTotal_eur: materialTotal,
    manufacturing_eur: manufacturing,
    qualityInspection_eur: qualityInspection,
    packaging_eur: packaging,
    logistics_eur: logistics,
    overhead_eur: overhead,
    warrantyReserve_eur: warrantyReserve,
    costPrice_eur: costPrice,
    profitMargin_eur: profitMargin,
    quotedPrice_eur: quotedPrice,
  };
}
