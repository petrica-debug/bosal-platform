import { Suspense } from 'react';
import { subDays, format } from 'date-fns';

import { createClient } from '@/lib/supabase/server';
import { DEMO_ORG_ID } from '@/lib/constants';
import {
  fetchLatestKpis,
  fetchKpiSnapshots,
  fetchAlerts,
} from '@/lib/api-client';
import { CommandCenterDashboard } from './dashboard';
import CommandCenterLoading from './loading';

// All KPI keys the dashboard needs
const ALL_KPI_KEYS = [
  // Revenue
  'total_revenue',
  'gross_margin',
  'revenue_wholesale',
  'revenue_ecommerce',
  'revenue_direct',
  // Operations
  'orders_today',
  'shipments_in_transit',
  'backorder_count',
  'dc_utilization',
  // Fulfillment
  'fill_rate',
  'on_time_shipping',
  'avg_fulfillment_hours',
  // Inventory
  'inventory_turns',
  'active_skus',
  'stockout_rate',
  // Finance
  'net_profit_margin',
  'warranty_reserve',
  'raw_material_index',
  // Warehouse
  'picks_today',
  'receiving_today',
  'cycle_count_accuracy',
  'worker_productivity',
] as const;

const CHART_KPI_KEYS = [
  'total_revenue',
  'gross_margin',
  'fill_rate',
  'on_time_shipping',
  'orders_today',
  'inventory_turns',
  'net_profit_margin',
  'raw_material_index',
  'picks_today',
] as const;

async function CommandCenterData() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let orgId = DEMO_ORG_ID;

  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('current_organization_id')
      .eq('id', user.id)
      .single();

    if (profile?.current_organization_id) {
      orgId = profile.current_organization_id;
    }
  }

  const now = new Date();
  const dateRange = {
    from: format(subDays(now, 30), 'yyyy-MM-dd'),
    to: format(now, 'yyyy-MM-dd'),
  };

  const [kpis, snapshots, alerts] = await Promise.all([
    fetchLatestKpis(supabase, orgId, [...ALL_KPI_KEYS]).catch(() => []),
    fetchKpiSnapshots(supabase, orgId, [...CHART_KPI_KEYS], dateRange).catch(
      () => [],
    ),
    fetchAlerts(supabase, orgId, { limit: 50 }).catch(() => []),
  ]);

  return (
    <CommandCenterDashboard
      initialKpis={kpis}
      initialSnapshots={snapshots}
      initialAlerts={alerts}
      orgId={orgId}
    />
  );
}

export default function CommandCenterPage() {
  return (
    <Suspense fallback={<CommandCenterLoading />}>
      <CommandCenterData />
    </Suspense>
  );
}
