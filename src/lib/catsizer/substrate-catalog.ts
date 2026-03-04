/**
 * COMMERCIAL SUBSTRATE CATALOG
 *
 * Real-world substrate options from major manufacturers:
 * - Corning (cordierite, FLORA®)
 * - NGK (SiC, cordierite)
 * - Ibiden (SiC)
 * - Continental/Emitec (metallic)
 *
 * Organized by application: DOC, DPF (wall-flow), SCR, TWC, ASC
 * Each entry has a standard diameter × length, cell density / wall thickness,
 * and derived geometric properties.
 */

import { UNITS } from "./units";

// ============================================================
// TYPES
// ============================================================

export interface SubstrateCatalogEntry {
  id: string;
  supplier: "Corning" | "NGK" | "Ibiden" | "Continental" | "Other";
  productLine: string;
  material: "cordierite" | "silicon_carbide" | "metallic" | "aluminum_titanate";
  application: ("DOC" | "DPF" | "SCR" | "ASC" | "TWC")[];
  /** Target vehicle/engine class */
  vehicleClass: ("light_duty" | "medium_duty" | "heavy_duty" | "genset" | "marine" | "off_highway")[];

  // Geometry
  diameter_mm: number;
  length_mm: number;
  cellDensity_cpsi: number;
  wallThickness_mil: number;

  // Derived (computed on load)
  volume_L: number;
  OFA: number;
  GSA_m2_L: number;
  hydraulicDiameter_mm: number;

  // Physical
  bulkDensity_kg_L: number;
  maxOperatingTemp_C: number;
  thermalShockResistance_C: number;

  // DPF-specific
  filterType?: "wall_flow" | "flow_through";
  porosity?: number;
  meanPoreSize_um?: number;
  permeability_m2?: number;

  // Metadata
  partNumber?: string;
  description: string;
}

// ============================================================
// GEOMETRY CALCULATOR
// ============================================================

function computeGeometry(cpsi: number, wallMil: number, diam_mm: number, len_mm: number) {
  const cellPitch = 25.4 / Math.sqrt(cpsi);
  const wallMM = wallMil * UNITS.mil_to_mm;
  const channelWidth = cellPitch - wallMM;
  const ofa = (channelWidth / cellPitch) ** 2;
  const dh = channelWidth;
  const gsa = (4 * ofa) / (dh / 1000) / 1000;
  const vol = Math.PI * (diam_mm / 2000) ** 2 * (len_mm / 1000) * 1000;
  return { volume_L: vol, OFA: ofa, GSA_m2_L: gsa, hydraulicDiameter_mm: dh };
}

function entry(
  id: string,
  supplier: SubstrateCatalogEntry["supplier"],
  productLine: string,
  material: SubstrateCatalogEntry["material"],
  application: SubstrateCatalogEntry["application"],
  vehicleClass: SubstrateCatalogEntry["vehicleClass"],
  diameter_mm: number,
  length_mm: number,
  cpsi: number,
  wallMil: number,
  bulkDensity: number,
  maxTemp: number,
  thermalShock: number,
  description: string,
  extra?: Partial<SubstrateCatalogEntry>
): SubstrateCatalogEntry {
  const geo = computeGeometry(cpsi, wallMil, diameter_mm, length_mm);
  return {
    id, supplier, productLine, material, application, vehicleClass,
    diameter_mm, length_mm, cellDensity_cpsi: cpsi, wallThickness_mil: wallMil,
    ...geo, bulkDensity_kg_L: bulkDensity, maxOperatingTemp_C: maxTemp,
    thermalShockResistance_C: thermalShock, description, ...extra,
  };
}

// ============================================================
// CATALOG
// ============================================================

export const SUBSTRATE_CATALOG: SubstrateCatalogEntry[] = [
  // ============================================================
  // LIGHT-DUTY DOC (round, small diameter)
  // ============================================================
  entry("LD-DOC-01", "Corning", "FLORA® 400/4", "cordierite", ["DOC"], ["light_duty"],
    118.4, 101.6, 400, 4, 0.42, 1000, 400, "4.66\" × 4\" — Light-duty DOC, passenger car / small SUV"),
  entry("LD-DOC-02", "Corning", "FLORA® 400/4", "cordierite", ["DOC"], ["light_duty"],
    118.4, 127, 400, 4, 0.42, 1000, 400, "4.66\" × 5\" — Light-duty DOC, mid-size sedan"),
  entry("LD-DOC-03", "Corning", "FLORA® 600/3", "cordierite", ["DOC"], ["light_duty"],
    118.4, 76.2, 600, 3, 0.42, 1000, 400, "4.66\" × 3\" — High cell density DOC for tight packaging"),
  entry("LD-DOC-04", "NGK", "HONEYCERAM® 400/4", "cordierite", ["DOC"], ["light_duty"],
    143, 127, 400, 4, 0.43, 1000, 400, "5.63\" × 5\" — Light-duty DOC, larger sedan / crossover"),

  // ============================================================
  // LIGHT-DUTY TWC
  // ============================================================
  entry("LD-TWC-01", "Corning", "FLORA® 600/3.5", "cordierite", ["TWC"], ["light_duty"],
    118.4, 101.6, 600, 3.5, 0.42, 1050, 400, "4.66\" × 4\" — Close-coupled TWC, gasoline"),
  entry("LD-TWC-02", "Corning", "FLORA® 900/2.5", "cordierite", ["TWC"], ["light_duty"],
    105, 76.2, 900, 2.5, 0.42, 1050, 400, "4.13\" × 3\" — Ultra-thin wall TWC, close-coupled"),
  entry("LD-TWC-03", "NGK", "HONEYCERAM® 600/3", "cordierite", ["TWC"], ["light_duty"],
    143, 127, 600, 3, 0.43, 1050, 400, "5.63\" × 5\" — Underfloor TWC, larger engines"),

  // ============================================================
  // LIGHT-DUTY DPF
  // ============================================================
  entry("LD-DPF-01", "NGK", "SiC DPF 200/8", "silicon_carbide", ["DPF"], ["light_duty"],
    143, 152.4, 200, 8, 0.55, 1200, 600, "5.63\" × 6\" — SiC DPF for light-duty diesel",
    { filterType: "wall_flow", porosity: 0.48, meanPoreSize_um: 12, permeability_m2: 1.8e-13 }),
  entry("LD-DPF-02", "Ibiden", "SiC DPF 200/8", "silicon_carbide", ["DPF"], ["light_duty"],
    118.4, 152.4, 200, 8, 0.55, 1200, 600, "4.66\" × 6\" — Compact SiC DPF for small diesel",
    { filterType: "wall_flow", porosity: 0.50, meanPoreSize_um: 14, permeability_m2: 2.0e-13 }),

  // ============================================================
  // LIGHT-DUTY SCR
  // ============================================================
  entry("LD-SCR-01", "Corning", "FLORA® 400/4", "cordierite", ["SCR"], ["light_duty"],
    143, 152.4, 400, 4, 0.42, 800, 400, "5.63\" × 6\" — Light-duty SCR, Cu-zeolite coated"),
  entry("LD-SCR-02", "Corning", "FLORA® 300/5", "cordierite", ["SCR"], ["light_duty"],
    143, 177.8, 300, 5, 0.42, 800, 400, "5.63\" × 7\" — Light-duty SCR, higher loading capacity"),

  // ============================================================
  // MEDIUM-DUTY / OFF-HIGHWAY DOC
  // ============================================================
  entry("MD-DOC-01", "Corning", "DuraTrap® 400/4", "cordierite", ["DOC"], ["medium_duty", "off_highway"],
    171, 152.4, 400, 4, 0.42, 1000, 400, "6.73\" × 6\" — Medium-duty DOC, construction equipment"),
  entry("MD-DOC-02", "NGK", "HONEYCERAM® 300/5", "cordierite", ["DOC"], ["medium_duty", "off_highway"],
    190.5, 152.4, 300, 5, 0.43, 1000, 400, "7.5\" × 6\" — Medium-duty DOC, agricultural tractor"),

  // ============================================================
  // HEAVY-DUTY DOC
  // ============================================================
  entry("HD-DOC-01", "Corning", "FLORA® 400/4", "cordierite", ["DOC"], ["heavy_duty"],
    267, 152.4, 400, 4, 0.42, 1000, 400, "10.5\" × 6\" — HD truck DOC, Class 8"),
  entry("HD-DOC-02", "Corning", "FLORA® 300/5", "cordierite", ["DOC"], ["heavy_duty"],
    267, 177.8, 300, 5, 0.42, 1000, 400, "10.5\" × 7\" — HD truck DOC, high flow"),
  entry("HD-DOC-03", "NGK", "HONEYCERAM® 400/4", "cordierite", ["DOC"], ["heavy_duty"],
    305, 152.4, 400, 4, 0.43, 1000, 400, "12\" × 6\" — HD truck DOC, large engine"),
  entry("HD-DOC-04", "Continental", "Metalit® 200/2", "metallic", ["DOC"], ["heavy_duty"],
    267, 101.6, 200, 2, 0.65, 900, 800, "10.5\" × 4\" — Metallic DOC, fast light-off, low ΔP"),

  // ============================================================
  // HEAVY-DUTY DPF
  // ============================================================
  entry("HD-DPF-01", "NGK", "SiC DPF 200/8", "silicon_carbide", ["DPF"], ["heavy_duty"],
    267, 254, 200, 8, 0.55, 1200, 600, "10.5\" × 10\" — HD SiC DPF, Class 8 truck",
    { filterType: "wall_flow", porosity: 0.48, meanPoreSize_um: 12, permeability_m2: 1.8e-13 }),
  entry("HD-DPF-02", "Ibiden", "SiC DPF 200/12", "silicon_carbide", ["DPF"], ["heavy_duty"],
    267, 305, 200, 12, 0.55, 1200, 600, "10.5\" × 12\" — HD SiC DPF, high ash capacity",
    { filterType: "wall_flow", porosity: 0.52, meanPoreSize_um: 15, permeability_m2: 2.5e-13 }),
  entry("HD-DPF-03", "Corning", "DuraTrap® AT 200/8", "aluminum_titanate", ["DPF"], ["heavy_duty"],
    267, 254, 200, 8, 0.50, 1100, 500, "10.5\" × 10\" — Aluminum titanate DPF, low cost",
    { filterType: "wall_flow", porosity: 0.55, meanPoreSize_um: 18, permeability_m2: 3.0e-13 }),
  entry("HD-DPF-04", "NGK", "SiC DPF 300/8", "silicon_carbide", ["DPF"], ["heavy_duty"],
    305, 305, 300, 8, 0.55, 1200, 600, "12\" × 12\" — HD SiC DPF, high cell density, large engine",
    { filterType: "wall_flow", porosity: 0.46, meanPoreSize_um: 10, permeability_m2: 1.5e-13 }),

  // ============================================================
  // HEAVY-DUTY SCR
  // ============================================================
  entry("HD-SCR-01", "Corning", "FLORA® 400/4", "cordierite", ["SCR"], ["heavy_duty"],
    267, 305, 400, 4, 0.42, 800, 400, "10.5\" × 12\" — HD SCR, Cu-SSZ-13 coated, Class 8"),
  entry("HD-SCR-02", "Corning", "FLORA® 300/5", "cordierite", ["SCR"], ["heavy_duty"],
    267, 381, 300, 5, 0.42, 800, 400, "10.5\" × 15\" — HD SCR, high volume for Euro VI-E"),
  entry("HD-SCR-03", "NGK", "HONEYCERAM® 400/6", "cordierite", ["SCR"], ["heavy_duty"],
    305, 305, 400, 6, 0.43, 800, 400, "12\" × 12\" — HD SCR, thicker walls for durability"),
  entry("HD-SCR-04", "Corning", "FLORA® 400/4", "cordierite", ["SCR"], ["heavy_duty"],
    305, 381, 400, 4, 0.42, 800, 400, "12\" × 15\" — HD SCR, maximum volume for very large engines"),

  // ============================================================
  // HEAVY-DUTY ASC
  // ============================================================
  entry("HD-ASC-01", "Corning", "FLORA® 400/4", "cordierite", ["ASC"], ["heavy_duty"],
    267, 76.2, 400, 4, 0.42, 800, 400, "10.5\" × 3\" — HD ASC, short brick behind SCR"),
  entry("HD-ASC-02", "NGK", "HONEYCERAM® 400/4", "cordierite", ["ASC"], ["heavy_duty"],
    267, 101.6, 400, 4, 0.43, 800, 400, "10.5\" × 4\" — HD ASC, slightly longer for lower slip"),

  // ============================================================
  // GENSET DOC
  // ============================================================
  entry("GS-DOC-01", "Corning", "FLORA® 300/5", "cordierite", ["DOC"], ["genset"],
    305, 152.4, 300, 5, 0.42, 1000, 400, "12\" × 6\" — Genset DOC, 200–500 kW"),
  entry("GS-DOC-02", "Corning", "FLORA® 200/6", "cordierite", ["DOC"], ["genset"],
    356, 177.8, 200, 6, 0.42, 1000, 400, "14\" × 7\" — Genset DOC, 500–1000 kW"),
  entry("GS-DOC-03", "NGK", "HONEYCERAM® 200/8", "cordierite", ["DOC"], ["genset", "marine"],
    381, 203.2, 200, 8, 0.43, 1000, 400, "15\" × 8\" — Large genset / marine DOC, >1 MW"),

  // ============================================================
  // GENSET SCR
  // ============================================================
  entry("GS-SCR-01", "Corning", "FLORA® 300/5", "cordierite", ["SCR"], ["genset"],
    305, 381, 300, 5, 0.42, 800, 400, "12\" × 15\" — Genset SCR, 200–500 kW"),
  entry("GS-SCR-02", "Corning", "FLORA® 200/6", "cordierite", ["SCR"], ["genset"],
    356, 381, 200, 6, 0.42, 800, 400, "14\" × 15\" — Genset SCR, 500–1000 kW"),
  entry("GS-SCR-03", "NGK", "HONEYCERAM® 200/8", "cordierite", ["SCR"], ["genset", "marine"],
    381, 457, 200, 8, 0.43, 800, 400, "15\" × 18\" — Large genset / marine SCR, >1 MW"),
  entry("GS-SCR-04", "Corning", "FLORA® 200/6", "cordierite", ["SCR"], ["genset", "marine"],
    432, 457, 200, 6, 0.42, 800, 400, "17\" × 18\" — Very large genset / marine SCR, >2 MW"),

  // ============================================================
  // GENSET DPF
  // ============================================================
  entry("GS-DPF-01", "NGK", "SiC DPF 200/12", "silicon_carbide", ["DPF"], ["genset"],
    305, 305, 200, 12, 0.55, 1200, 600, "12\" × 12\" — Genset SiC DPF, 200–500 kW",
    { filterType: "wall_flow", porosity: 0.52, meanPoreSize_um: 15, permeability_m2: 2.5e-13 }),
  entry("GS-DPF-02", "Ibiden", "SiC DPF 200/12", "silicon_carbide", ["DPF"], ["genset", "marine"],
    356, 356, 200, 12, 0.55, 1200, 600, "14\" × 14\" — Large genset SiC DPF, 500–1000 kW",
    { filterType: "wall_flow", porosity: 0.50, meanPoreSize_um: 14, permeability_m2: 2.2e-13 }),
];

// ============================================================
// CATALOG QUERY HELPERS
// ============================================================

export function filterCatalog(
  catalystType?: string,
  vehicleClass?: string,
  material?: string,
  minVolume_L?: number,
  maxVolume_L?: number
): SubstrateCatalogEntry[] {
  return SUBSTRATE_CATALOG.filter((s) => {
    if (catalystType && !s.application.includes(catalystType as never)) return false;
    if (vehicleClass && !s.vehicleClass.includes(vehicleClass as never)) return false;
    if (material && s.material !== material) return false;
    if (minVolume_L != null && s.volume_L < minVolume_L) return false;
    if (maxVolume_L != null && s.volume_L > maxVolume_L) return false;
    return true;
  });
}

export function getSubstrateById(id: string): SubstrateCatalogEntry | undefined {
  return SUBSTRATE_CATALOG.find((s) => s.id === id);
}

/** Standard diameters available in the catalog [mm] */
export const STANDARD_DIAMETERS = [...new Set(SUBSTRATE_CATALOG.map((s) => s.diameter_mm))].sort((a, b) => a - b);

/** Standard lengths available in the catalog [mm] */
export const STANDARD_LENGTHS = [...new Set(SUBSTRATE_CATALOG.map((s) => s.length_mm))].sort((a, b) => a - b);

/** Standard cell density / wall thickness combinations */
export const STANDARD_CELL_CONFIGS = [
  { cpsi: 100, wall_mil: 8, label: "100/8 — Low ΔP, marine/genset" },
  { cpsi: 200, wall_mil: 6, label: "200/6 — Standard genset" },
  { cpsi: 200, wall_mil: 8, label: "200/8 — Standard DPF" },
  { cpsi: 200, wall_mil: 12, label: "200/12 — HD DPF, high ash" },
  { cpsi: 300, wall_mil: 5, label: "300/5 — HD flow-through" },
  { cpsi: 300, wall_mil: 8, label: "300/8 — HD DPF, high cell" },
  { cpsi: 400, wall_mil: 4, label: "400/4 — Standard HD DOC/SCR" },
  { cpsi: 400, wall_mil: 6, label: "400/6 — HD thick wall" },
  { cpsi: 600, wall_mil: 3, label: "600/3 — LD high performance" },
  { cpsi: 600, wall_mil: 3.5, label: "600/3.5 — LD TWC" },
  { cpsi: 900, wall_mil: 2.5, label: "900/2.5 — Ultra-thin wall LD" },
];
