"use client";

import { useMemo } from "react";
import { Cell, Label, Pie, PieChart } from "recharts";

import { formatCompactCurrency } from "@/lib/formatters";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type CurrencyCode = "USD" | "EUR" | "GBP";

interface ChannelDatum {
  channel: string;
  value: number;
}

interface RevenueByChannelChartProps {
  data: ChannelDatum[];
  currency?: CurrencyCode;
}

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export function RevenueByChannelChart({
  data,
  currency = "EUR",
}: RevenueByChannelChartProps) {
  const total = useMemo(
    () => data.reduce((sum, d) => sum + d.value, 0),
    [data],
  );

  const chartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};
    data.forEach((d, i) => {
      config[d.channel] = {
        label: d.channel,
        color: CHART_COLORS[i % CHART_COLORS.length],
      };
    });
    return config;
  }, [data]);

  const pieData = useMemo(
    () =>
      data.map((d, i) => ({
        ...d,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [data],
  );

  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square w-full max-w-[360px]">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(v) => formatCompactCurrency(Number(v), currency)}
              nameKey="channel"
            />
          }
        />

        <Pie
          data={pieData}
          dataKey="value"
          nameKey="channel"
          innerRadius="55%"
          outerRadius="80%"
          strokeWidth={2}
          stroke="var(--background)"
        >
          {pieData.map((entry) => (
            <Cell key={entry.channel} fill={entry.fill} />
          ))}

          <Label
            content={({ viewBox }) => {
              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                return (
                  <text
                    x={viewBox.cx}
                    y={viewBox.cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) - 8}
                      className="fill-foreground text-xl font-bold"
                    >
                      {formatCompactCurrency(total, currency)}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) + 12}
                      className="fill-muted-foreground text-xs"
                    >
                      Total
                    </tspan>
                  </text>
                );
              }
              return null;
            }}
          />
        </Pie>

        <ChartLegend content={<ChartLegendContent nameKey="channel" />} />
      </PieChart>
    </ChartContainer>
  );
}
