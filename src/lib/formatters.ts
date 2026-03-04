import { format, formatDistanceToNow, parseISO } from 'date-fns';

type CurrencyCode = 'USD' | 'EUR' | 'GBP';

type DeltaDirection = 'up' | 'down' | 'flat';

export interface DeltaResult {
  value: string;
  direction: DeltaDirection;
  isPositive: boolean;
}

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

const CURRENCY_CONFIG: Record<CurrencyCode, { locale: string; currency: string }> = {
  USD: { locale: 'en-US', currency: 'USD' },
  EUR: { locale: 'de-DE', currency: 'EUR' },
  GBP: { locale: 'en-GB', currency: 'GBP' },
};

export function formatCurrency(cents: number, currency: CurrencyCode = 'USD'): string {
  const { locale, currency: code } = CURRENCY_CONFIG[currency];
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatCompactCurrency(cents: number, currency: CurrencyCode = 'USD'): string {
  const { locale, currency: code } = CURRENCY_CONFIG[currency];
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatCompactNumber(n: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

// ---------------------------------------------------------------------------
// Percentages
// ---------------------------------------------------------------------------

export function formatPercent(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

// ---------------------------------------------------------------------------
// Part Numbers
// ---------------------------------------------------------------------------

export function formatPartNumber(pn: string): string {
  return pn.trim().toUpperCase();
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

function toDate(date: string | Date): Date {
  return typeof date === 'string' ? parseISO(date) : date;
}

export function formatDate(date: string | Date, formatStr = 'MMM d, yyyy'): string {
  return format(toDate(date), formatStr);
}

export function formatRelativeTime(date: string | Date): string {
  return formatDistanceToNow(toDate(date), { addSuffix: true });
}

// ---------------------------------------------------------------------------
// Delta / Change Indicators
// ---------------------------------------------------------------------------

export function formatDelta(current: number, previous: number): DeltaResult {
  if (previous === 0) {
    return {
      value: current === 0 ? '0%' : '+100%',
      direction: current === 0 ? 'flat' : 'up',
      isPositive: current >= 0,
    };
  }

  const change = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.abs(change).toFixed(1);

  let direction: DeltaDirection;
  if (change > 0.05) {
    direction = 'up';
  } else if (change < -0.05) {
    direction = 'down';
  } else {
    direction = 'flat';
  }

  const sign = direction === 'up' ? '+' : direction === 'down' ? '-' : '';

  return {
    value: `${sign}${rounded}%`,
    direction,
    isPositive: change >= 0,
  };
}
