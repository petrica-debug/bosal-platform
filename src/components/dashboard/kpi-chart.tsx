"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { format, parseISO } from "date-fns";

import type { KpiSnapshotWithKpi } from "@/lib/api-client";
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatCurrency,
  formatNumber,
  formatPercent,
} from "@/lib/formatters";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type CurrencyCode = "USD" | "EUR" | "GBP";

interface KpiChartProps {
  data: KpiSnapshotWithKpi[];
  kpiKey: string;
  title: string;
  unit: string;
  currency?: CurrencyCode;
  height?: number;
}

interface ChartDatum {
  date: string;
  displayDate: string;
  value: number;
}

function formatAxisValue(value: number, unit: string, currency: CurrencyCode): string {
  switch (unit) {
    case "currency":
      return formatCompactCurrency(value, currency);
    case "percent":
      return formatPercent(value, 0);
    case "hours":
      return `${Math.round(value)}h`;
    default:
      return formatCompactNumber(value);
  }
}

function formatTooltipValue(value: number, unit: string, currency: CurrencyCode): string {
  switch (unit) {
    case "currency":
      return formatCurrency(value, currency);
    case "percent":
      return formatPercent(value);
    case "hours":
      return `${value.toFixed(1)}h`;
    default:
      return formatNumber(value);
  }
}

export function KpiChart({
  data,
  kpiKey,
  title,
  unit,
  currency = "EUR",
  height = 300,
}: KpiChartProps) {
  const chartData = useMemo<ChartDatum[]>(
    () =>
      data
        .filter((s) => s.kpis?.key === kpiKey)
        .map((s) => ({
          date: s.snapshot_date,
          displayDate: format(parseISO(s.snapshot_date), "MMM d"),
          value: s.value,
        })),
    [data, kpiKey],
  );

  const chartConfig: ChartConfig = {
    value: {
      label: title,
      color: "var(--chart-1)",
    },
  };

  return (
    <ChartContainer config={chartConfig} className="w-full" style={{ height }}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`fill-${kpiKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid vertical={false} strokeDasharray="3 3" />

        <XAxis
          dataKey="displayDate"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
        />

        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={56}
          tickFormatter={(v: number) => formatAxisValue(v, unit, currency)}
        />

        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(v) => formatTooltipValue(Number(v), unit, currency)}
              labelFormatter={(_, payload) => {
                const item = payload[0]?.payload as ChartDatum | undefined;
                return item?.displayDate ?? "";
              }}
            />
          }
        />

        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--color-value)"
          strokeWidth={2}
          fill={`url(#fill-${kpiKey})`}
        />
      </AreaChart>
    </ChartContainer>
  );
}
