"use client";

import { AlertCircle, AlertTriangle, Info } from "lucide-react";

import type { SupplyChainAlert } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface AlertsFeedProps {
  alerts: SupplyChainAlert[];
  onMarkRead?: (alertId: string) => void;
}

type Severity = SupplyChainAlert["severity"];

const SEVERITY_ICON: Record<Severity, typeof AlertTriangle> = {
  critical: AlertTriangle,
  warning: AlertCircle,
  info: Info,
};

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-blue-600 dark:text-blue-400",
};

const SEVERITY_BADGE_VARIANT: Record<
  Severity,
  "destructive" | "default" | "secondary"
> = {
  critical: "destructive",
  warning: "default",
  info: "secondary",
};

const SEVERITY_BORDER: Record<Severity, string> = {
  critical: "border-l-red-600 dark:border-l-red-400",
  warning: "border-l-amber-600 dark:border-l-amber-400",
  info: "border-l-blue-600 dark:border-l-blue-400",
};

export function AlertsFeed({ alerts, onMarkRead }: AlertsFeedProps) {
  if (alerts.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No alerts
      </div>
    );
  }

  return (
    <div className="max-h-[420px] space-y-1 overflow-y-auto">
      {alerts.map((alert) => {
        const Icon = SEVERITY_ICON[alert.severity];
        const isUnread = !alert.is_read;

        return (
          <button
            key={alert.id}
            type="button"
            className={cn(
              "flex w-full items-start gap-3 rounded-lg border-l-[3px] border-l-transparent px-3 py-3 text-left transition-colors hover:bg-muted/50",
              isUnread && SEVERITY_BORDER[alert.severity],
            )}
            onClick={() => onMarkRead?.(alert.id)}
          >
            <Icon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                SEVERITY_COLOR[alert.severity],
              )}
            />

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "truncate text-sm",
                    isUnread ? "font-semibold" : "font-medium",
                  )}
                >
                  {alert.title}
                </span>
                <Badge
                  variant={SEVERITY_BADGE_VARIANT[alert.severity]}
                  className="shrink-0 text-[10px] uppercase"
                >
                  {alert.severity}
                </Badge>
              </div>

              <p className="line-clamp-2 text-xs text-muted-foreground">
                {alert.message}
              </p>

              <p className="text-[11px] text-muted-foreground/70">
                {formatRelativeTime(alert.created_at)}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
