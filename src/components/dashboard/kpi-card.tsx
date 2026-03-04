"use client";

import { TrendingDown, TrendingUp, Minus } from "lucide-react";

import type { LatestKpi } from "@/lib/api-client";
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatDelta,
  formatPercent,
  formatDate,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type CurrencyCode = "USD" | "EUR" | "GBP";

interface KpiCardProps {
  kpi: LatestKpi;
  currency?: CurrencyCode;
}

function formatKpiValue(
  value: number,
  unit: string,
  currency: CurrencyCode,
): string {
  switch (unit) {
    case "currency":
      return formatCompactCurrency(value, currency);
    case "percent":
      return formatPercent(value);
    case "hours":
      return `${value.toFixed(1)}h`;
    default:
      return formatCompactNumber(value);
  }
}

export function KpiCard({ kpi, currency = "EUR" }: KpiCardProps) {
  const delta =
    kpi.previousValue !== null
      ? formatDelta(kpi.value, kpi.previousValue)
      : null;

  // When isHigherBetter is false, invert the color logic:
  // a decrease (direction=down) is actually good.
  const isGood = delta
    ? kpi.isHigherBetter
      ? delta.direction === "up"
      : delta.direction === "down"
    : null;

  const progressPercent =
    kpi.targetValue && kpi.targetValue !== 0
      ? Math.min(Math.round((kpi.value / kpi.targetValue) * 100), 100)
      : null;

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {kpi.kpiName}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-2">
        <div className="text-3xl font-bold tracking-tight">
          {formatKpiValue(kpi.value, kpi.unit, currency)}
        </div>

        <div className="flex items-center gap-2">
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-sm font-medium",
                isGood === true && "text-emerald-600 dark:text-emerald-400",
                isGood === false && "text-red-600 dark:text-red-400",
                isGood === null && "text-muted-foreground",
              )}
            >
              {delta.direction === "up" && <TrendingUp className="size-4" />}
              {delta.direction === "down" && (
                <TrendingDown className="size-4" />
              )}
              {delta.direction === "flat" && <Minus className="size-4" />}
              {delta.value}
            </span>
          )}

          <span className="text-xs text-muted-foreground">
            {formatDate(kpi.snapshotDate, "MMM d, yyyy")}
          </span>
        </div>

        {progressPercent !== null && (
          <div className="mt-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {progressPercent}% of target
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
