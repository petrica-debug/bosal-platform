'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { subDays, format } from 'date-fns';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { KpiChart } from '@/components/dashboard/kpi-chart';
import { RevenueByChannelChart } from '@/components/dashboard/revenue-by-channel-chart';
import { AlertsFeed } from '@/components/dashboard/alerts-feed';
import { DateRangeSelector } from '@/components/dashboard/date-range-selector';
import { useRealtimeAlerts } from '@/hooks/use-realtime';
import { createClient } from '@/lib/supabase/client';
import {
  fetchKpiSnapshots,
  type DateRange,
  type KpiSnapshotWithKpi,
  type LatestKpi,
  type SupplyChainAlert,
} from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandCenterDashboardProps {
  initialKpis: LatestKpi[];
  initialSnapshots: KpiSnapshotWithKpi[];
  initialAlerts: SupplyChainAlert[];
  orgId: string;
}

// ---------------------------------------------------------------------------
// KPI key groups per tab
// ---------------------------------------------------------------------------

const ALL_CHART_KEYS = [
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findKpi(kpis: LatestKpi[], key: string): LatestKpi | undefined {
  return kpis.find((k) => k.kpiKey === key);
}

function deriveChannelRevenue(kpis: LatestKpi[]): { channel: string; value: number }[] {
  const channels = [
    { key: 'revenue_wholesale', channel: 'Wholesale' },
    { key: 'revenue_ecommerce', channel: 'E-Commerce' },
    { key: 'revenue_direct', channel: 'Direct' },
  ];

  return channels
    .map(({ key, channel }) => {
      const kpi = findKpi(kpis, key);
      return { channel, value: kpi?.value ?? 0 };
    })
    .filter((c) => c.value > 0);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandCenterDashboard({
  initialKpis,
  initialSnapshots,
  initialAlerts,
  orgId,
}: CommandCenterDashboardProps) {
  const now = new Date();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: format(subDays(now, 30), 'yyyy-MM-dd'),
    to: format(now, 'yyyy-MM-dd'),
  });
  const [snapshots, setSnapshots] = useState<KpiSnapshotWithKpi[]>(initialSnapshots);
  const [isPending, startTransition] = useTransition();

  const { alerts: realtimeAlerts } = useRealtimeAlerts(orgId);
  const alerts = realtimeAlerts.length > 0 ? realtimeAlerts : initialAlerts;

  const supabase = useMemo(() => createClient(), []);

  const handleDateRangeChange = useCallback(
    (newRange: { from: string; to: string }) => {
      setDateRange(newRange);
      startTransition(async () => {
        try {
          const data = await fetchKpiSnapshots(
            supabase,
            orgId,
            [...ALL_CHART_KEYS],
            newRange,
          );
          setSnapshots(data);
        } catch {
          // Keep existing snapshots on error
        }
      });
    },
    [supabase, orgId],
  );

  const channelRevenue = useMemo(() => deriveChannelRevenue(initialKpis), [initialKpis]);

  const operationsAlerts = useMemo(
    () =>
      alerts.filter((a) =>
        ['order', 'supply_chain', 'warehouse'].includes(a.category),
      ),
    [alerts],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
          <p className="text-sm text-muted-foreground">
            Executive overview of operations, sales, and supply chain
          </p>
        </div>
        <DateRangeSelector value={dateRange} onChange={handleDateRangeChange} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="executive" className="space-y-6">
        <TabsList className="flex w-full sm:w-auto">
          <TabsTrigger value="executive">Executive</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
          <TabsTrigger value="warehouse">Warehouse</TabsTrigger>
        </TabsList>

        {/* ============================================================= */}
        {/* Executive Tab                                                  */}
        {/* ============================================================= */}
        <TabsContent value="executive" className="space-y-6">
          <KpiRow
            kpis={initialKpis}
            keys={['total_revenue', 'gross_margin', 'fill_rate', 'on_time_shipping']}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <KpiChart
                data={snapshots}
                kpiKey="total_revenue"
                title="Revenue Trend"
                unit="currency"
                currency="EUR"
              />
            </div>
            <RevenueByChannelChart data={channelRevenue} currency="EUR" />
          </div>

          <KpiRow
            kpis={initialKpis}
            keys={['orders_today', 'inventory_turns', 'active_skus', 'shipments_in_transit']}
          />

          <AlertsFeed alerts={alerts} />
        </TabsContent>

        {/* ============================================================= */}
        {/* Operations Tab                                                 */}
        {/* ============================================================= */}
        <TabsContent value="operations" className="space-y-6">
          <KpiRow
            kpis={initialKpis}
            keys={['orders_today', 'shipments_in_transit', 'backorder_count', 'dc_utilization']}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <KpiChart
              data={snapshots}
              kpiKey="orders_today"
              title="Orders Trend"
              unit="number"
            />
            <KpiChart
              data={snapshots}
              kpiKey="fill_rate"
              title="Fill Rate"
              unit="percent"
            />
          </div>

          <AlertsFeed alerts={operationsAlerts} />
        </TabsContent>

        {/* ============================================================= */}
        {/* Sales Tab                                                      */}
        {/* ============================================================= */}
        <TabsContent value="sales" className="space-y-6">
          <KpiRow
            kpis={initialKpis}
            keys={['total_revenue', 'revenue_wholesale', 'revenue_ecommerce', 'revenue_direct']}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <KpiChart
                data={snapshots}
                kpiKey="total_revenue"
                title="Revenue Trend"
                unit="currency"
                currency="EUR"
              />
            </div>
            <RevenueByChannelChart data={channelRevenue} currency="EUR" />
          </div>

          <KpiChart
            data={snapshots}
            kpiKey="gross_margin"
            title="Gross Margin Trend"
            unit="percent"
          />
        </TabsContent>

        {/* ============================================================= */}
        {/* Finance Tab                                                    */}
        {/* ============================================================= */}
        <TabsContent value="finance" className="space-y-6">
          <KpiRow
            kpis={initialKpis}
            keys={['gross_margin', 'net_profit_margin', 'warranty_reserve', 'raw_material_index']}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <KpiChart
              data={snapshots}
              kpiKey="net_profit_margin"
              title="Margin Trend"
              unit="percent"
            />
            <KpiChart
              data={snapshots}
              kpiKey="raw_material_index"
              title="Raw Material Index"
              unit="number"
            />
          </div>
        </TabsContent>

        {/* ============================================================= */}
        {/* Warehouse Tab                                                  */}
        {/* ============================================================= */}
        <TabsContent value="warehouse" className="space-y-6">
          <KpiRow
            kpis={initialKpis}
            keys={['picks_today', 'receiving_today', 'cycle_count_accuracy', 'worker_productivity']}
          />

          <KpiChart
            data={snapshots}
            kpiKey="picks_today"
            title="Picks Trend"
            unit="number"
          />
        </TabsContent>
      </Tabs>

      {isPending && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground shadow-lg">
          Updating charts…
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KpiRow – renders a responsive row of KPI cards
// ---------------------------------------------------------------------------

function KpiRow({ kpis, keys }: { kpis: LatestKpi[]; keys: string[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {keys.map((key) => {
        const kpi = findKpi(kpis, key);
        if (!kpi) return null;
        return <KpiCard key={key} kpi={kpi} currency="EUR" />;
      })}
    </div>
  );
}
