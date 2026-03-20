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
