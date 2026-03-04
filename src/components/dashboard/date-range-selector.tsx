"use client";

import { useCallback, useMemo } from "react";
import {
  startOfDay,
  subDays,
  startOfYear,
  format,
  parseISO,
} from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange as DayPickerRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangeValue {
  from: string;
  to: string;
}

interface DateRangeSelectorProps {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
}

interface Preset {
  label: string;
  days: number | "ytd";
}

const PRESETS: Preset[] = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "YTD", days: "ytd" },
];

function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function getPresetRange(preset: Preset): DateRangeValue {
  const today = startOfDay(new Date());
  const from =
    preset.days === "ytd"
      ? startOfYear(today)
      : subDays(today, preset.days);

  return {
    from: toISODate(from),
    to: toISODate(today),
  };
}

function matchesPreset(value: DateRangeValue, preset: Preset): boolean {
  const range = getPresetRange(preset);
  return range.from === value.from && range.to === value.to;
}

export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  const activePreset = useMemo(
    () => PRESETS.find((p) => matchesPreset(value, p))?.label ?? null,
    [value],
  );

  const handlePreset = useCallback(
    (preset: Preset) => {
      onChange(getPresetRange(preset));
    },
    [onChange],
  );

  const calendarValue: DayPickerRange = useMemo(
    () => ({
      from: parseISO(value.from),
      to: parseISO(value.to),
    }),
    [value],
  );

  const handleCalendarSelect = useCallback(
    (range: DayPickerRange | undefined) => {
      if (!range?.from) return;
      onChange({
        from: toISODate(range.from),
        to: toISODate(range.to ?? range.from),
      });
    },
    [onChange],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => (
        <Button
          key={preset.label}
          variant={activePreset === preset.label ? "default" : "outline"}
          size="sm"
          onClick={() => handlePreset(preset)}
        >
          {preset.label}
        </Button>
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={activePreset === null ? "default" : "outline"}
            size="sm"
            className={cn("gap-1.5")}
          >
            <CalendarIcon className="size-3.5" />
            {activePreset === null
              ? `${format(parseISO(value.from), "MMM d")} – ${format(parseISO(value.to), "MMM d")}`
              : "Custom"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={calendarValue}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
            disabled={{ after: new Date() }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
