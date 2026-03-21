"use client";

import { type DataTier, type SourcedValue, confidenceLabel } from "@/lib/catsizer/data-provenance";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProvenanceBadgeProps {
  /** The sourced value — tier, source string, confidence */
  sv: SourcedValue;
  /** Whether to show the confidence band inline (default: false — only in tooltip) */
  showConfidence?: boolean;
  className?: string;
}

const TIER_STYLES: Record<DataTier, { dot: string; label: string; border: string }> = {
  measured:   { dot: "bg-emerald-500",  label: "text-emerald-600 dark:text-emerald-400",  border: "border-emerald-300 dark:border-emerald-700" },
  estimated:  { dot: "bg-amber-400",    label: "text-amber-600  dark:text-amber-400",    border: "border-amber-300  dark:border-amber-700"   },
  literature: { dot: "bg-slate-400",    label: "text-slate-500  dark:text-slate-400",    border: "border-slate-300  dark:border-slate-600"   },
};

const TIER_TOOLTIP: Record<DataTier, string> = {
  measured:   "Measured — from uploaded test data.  Highest confidence.",
  estimated:  "Estimated — computed by the digital-twin model.  ±15% typical.",
  literature: "Literature — from OEM database / published data.  Treat as guidance.",
};

/**
 * Inline provenance indicator shown next to engineering numbers.
 *
 * Usage:
 *   <ProvenanceBadge sv={{ value: 235, tier: "estimated", source: "TWC model", confidencePct: 15 }} />
 *
 * Renders as a coloured dot with a label and a tooltip explaining the source.
 */
export function ProvenanceBadge({ sv, showConfidence = false, className }: ProvenanceBadgeProps) {
  const styles = TIER_STYLES[sv.tier];
  const badge = (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${className ?? ""}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${styles.dot}`} />
      <span className={styles.label}>
        {sv.tier.charAt(0).toUpperCase() + sv.tier.slice(1)}
        {showConfidence && sv.tier !== "measured" && sv.confidencePct != null && (
          <span className="opacity-75 ml-0.5">({confidenceLabel(sv)})</span>
        )}
      </span>
    </span>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`rounded px-1 py-0.5 border ${styles.border} cursor-help leading-none`}
            onClick={(e) => e.stopPropagation()}
          >
            {badge}
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs space-y-1" side="top">
          <p className="font-semibold">{TIER_TOOLTIP[sv.tier]}</p>
          <p className="text-muted-foreground">Source: {sv.source}</p>
          {sv.confidencePct != null && sv.tier !== "measured" && (
            <p className="text-muted-foreground">Uncertainty: ±{sv.confidencePct}%</p>
          )}
          {sv.updatedAt && (
            <p className="text-muted-foreground">Updated: {sv.updatedAt}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
