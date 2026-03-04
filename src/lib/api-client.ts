import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
} from '@/types/database';

// Re-export type aliases for convenience across the app
export type { Tables, TablesInsert, TablesUpdate };

export type TypedSupabaseClient = SupabaseClient<Database>;

export type KpiSnapshot = Tables<'kpi_snapshots'>;
export type Kpi = Tables<'kpis'>;
export type SupplyChainAlert = Tables<'supply_chain_alerts'>;

// ---------------------------------------------------------------------------
// KPI Snapshots
// ---------------------------------------------------------------------------

export interface KpiSnapshotWithKpi extends KpiSnapshot {
  kpis: Pick<Kpi, 'key' | 'name' | 'category' | 'unit' | 'is_higher_better' | 'target_value'> | null;
}

export interface DateRange {
  from: string;
  to: string;
}

export async function fetchKpiSnapshots(
  supabase: TypedSupabaseClient,
  orgId: string,
  kpiKeys: string[],
  dateRange: DateRange,
): Promise<KpiSnapshotWithKpi[]> {
  const { data, error } = await supabase
    .from('kpi_snapshots')
    .select(`
      *,
      kpis!inner (key, name, category, unit, is_higher_better, target_value)
    `)
    .eq('organization_id', orgId)
    .in('kpis.key', kpiKeys)
    .gte('snapshot_date', dateRange.from)
    .lte('snapshot_date', dateRange.to)
    .order('snapshot_date', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as KpiSnapshotWithKpi[];
}

// ---------------------------------------------------------------------------
// Latest KPI values (most recent snapshot per KPI key)
// ---------------------------------------------------------------------------

export interface LatestKpi {
  kpiKey: string;
  kpiName: string;
  category: string;
  unit: string;
  value: number;
  previousValue: number | null;
  snapshotDate: string;
  isHigherBetter: boolean;
  targetValue: number | null;
}

export async function fetchLatestKpis(
  supabase: TypedSupabaseClient,
  orgId: string,
  kpiKeys: string[],
): Promise<LatestKpi[]> {
  const { data, error } = await supabase
    .from('kpi_snapshots')
    .select(`
      value,
      previous_value,
      snapshot_date,
      kpis!inner (key, name, category, unit, is_higher_better, target_value)
    `)
    .eq('organization_id', orgId)
    .in('kpis.key', kpiKeys)
    .order('snapshot_date', { ascending: false });

  if (error) throw error;

  type RawRow = {
    value: number;
    previous_value: number | null;
    snapshot_date: string;
    kpis: Pick<Kpi, 'key' | 'name' | 'category' | 'unit' | 'is_higher_better' | 'target_value'>;
  };

  const rows = (data ?? []) as unknown as RawRow[];

  const seen = new Set<string>();
  const results: LatestKpi[] = [];

  for (const row of rows) {
    const key = row.kpis.key;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      kpiKey: key,
      kpiName: row.kpis.name,
      category: row.kpis.category,
      unit: row.kpis.unit,
      value: row.value,
      previousValue: row.previous_value,
      snapshotDate: row.snapshot_date,
      isHigherBetter: row.kpis.is_higher_better,
      targetValue: row.kpis.target_value,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export interface FetchAlertsOptions {
  unreadOnly?: boolean;
  limit?: number;
}

export async function fetchAlerts(
  supabase: TypedSupabaseClient,
  orgId: string,
  options: FetchAlertsOptions = {},
): Promise<SupplyChainAlert[]> {
  const { unreadOnly = false, limit = 50 } = options;

  let query = supabase
    .from('supply_chain_alerts')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_resolved', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.eq('is_read', false);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data ?? [];
}
