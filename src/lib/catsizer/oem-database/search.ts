import type { EcsComponentRecord } from "./types";
import { ECS_COMPONENTS } from "./data";

function norm(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s).toLowerCase();
}

/** Full-text search across key ECS fields (engine, OEM, substrate, PGM, standard). */
export function searchEcsComponents(
  query: string,
  records: EcsComponentRecord[] = ECS_COMPONENTS,
): EcsComponentRecord[] {
  const q = norm(query).trim();
  if (!q) return records;

  return records.filter((r) => {
    const hay = [
      r.oemGroup,
      r.brand,
      r.engineFamily,
      r.engineCodes,
      r.vehicleExamples,
      r.emissionStandard,
      r.componentType,
      r.position,
      r.substrate,
      r.substrateSupplier,
      r.l1Pgm,
      r.l2Pgm,
      r.source,
      r.years,
      r.fuel,
    ]
      .map(norm)
      .join(" ");
    return hay.includes(q) || q.split(/\s+/).every((w) => w.length > 0 && hay.includes(w));
  });
}

export function filterEcsByStandard(
  standard: string,
  records: EcsComponentRecord[] = ECS_COMPONENTS,
): EcsComponentRecord[] {
  const s = norm(standard);
  if (!s || s === "all") return records;
  return records.filter((r) => norm(r.emissionStandard).includes(s));
}

export function filterEcsByFuel(
  fuel: string,
  records: EcsComponentRecord[] = ECS_COMPONENTS,
): EcsComponentRecord[] {
  const f = norm(fuel);
  if (!f || f === "all") return records;
  return records.filter((r) => norm(r.fuel) === f);
}

export function filterEcsByBrand(
  brand: string,
  records: EcsComponentRecord[] = ECS_COMPONENTS,
): EcsComponentRecord[] {
  const b = norm(brand);
  if (!b || b === "all") return records;
  return records.filter((r) => norm(r.brand).includes(b) || norm(r.oemGroup).includes(b));
}

export function uniqueEmissionStandards(records: EcsComponentRecord[] = ECS_COMPONENTS): string[] {
  const set = new Set<string>();
  for (const r of records) {
    if (r.emissionStandard) set.add(String(r.emissionStandard));
  }
  return [...set].sort();
}

export function uniqueFuels(records: EcsComponentRecord[] = ECS_COMPONENTS): string[] {
  const set = new Set<string>();
  for (const r of records) {
    if (r.fuel) set.add(String(r.fuel));
  }
  return [...set].sort();
}

export function uniqueBrands(records: EcsComponentRecord[] = ECS_COMPONENTS): string[] {
  const set = new Set<string>();
  for (const r of records) {
    if (r.brand) set.add(String(r.brand));
  }
  return [...set].sort();
}

/** Stable fingerprint for table row selection / copilot context. */
export function ecsRecordKey(r: EcsComponentRecord, index: number): string {
  return `${norm(r.brand)}|${norm(r.engineFamily)}|${norm(r.engineCodes)}|${norm(r.componentNumber)}|${index}`;
}

export interface EcsFilteredRow {
  record: EcsComponentRecord;
  /** Index into `ECS_COMPONENTS` — stable for pinning and API */
  globalIndex: number;
}

/**
 * Single-pass filter with stable global indices (required for large catalogs, e.g. V5 500+ rows).
 */
export function filterEcsWithGlobalIndices(options: {
  search?: string;
  fuel?: string;
  emissionStandard?: string;
  brand?: string;
}): EcsFilteredRow[] {
  const search = options.search ?? "";
  const fuel = options.fuel ?? "all";
  const emissionStandard = options.emissionStandard ?? "all";
  const brand = options.brand ?? "all";

  const q = norm(search).trim();
  const f = norm(fuel);
  const es = norm(emissionStandard);
  const b = norm(brand);

  const out: EcsFilteredRow[] = [];
  for (let globalIndex = 0; globalIndex < ECS_COMPONENTS.length; globalIndex++) {
    const r = ECS_COMPONENTS[globalIndex];
    if (f && f !== "all" && norm(r.fuel) !== f) continue;
    if (es && es !== "all" && !norm(r.emissionStandard).includes(es)) continue;
    if (
      b &&
      b !== "all" &&
      !norm(r.brand).includes(b) &&
      !norm(r.oemGroup).includes(b)
    )
      continue;
    if (q) {
      const hay = [
        r.oemGroup,
        r.brand,
        r.engineFamily,
        r.engineCodes,
        r.vehicleExamples,
        r.emissionStandard,
        r.componentType,
        r.position,
        r.substrate,
        r.substrateSupplier,
        r.l1Pgm,
        r.l2Pgm,
        r.source,
        r.years,
        r.fuel,
      ]
        .map(norm)
        .join(" ");
      const words = q.split(/\s+/).filter((w) => w.length > 0);
      const matches =
        hay.includes(q) || words.every((w) => hay.includes(w));
      if (!matches) continue;
    }
    out.push({ record: r, globalIndex });
  }
  return out;
}
