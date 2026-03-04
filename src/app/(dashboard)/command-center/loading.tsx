import { Skeleton } from '@/components/ui/skeleton';

export default function CommandCenterLoading() {
  return (
    <div className="space-y-6">
      {/* Header area */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-56" />
      </div>

      {/* Tab bar */}
      <Skeleton className="h-9 w-[480px]" />

      {/* Row 1: 4 KPI cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`kpi-top-${i}`} className="h-32 rounded-xl" />
        ))}
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Skeleton className="h-72 rounded-xl xl:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>

      {/* Row 3: 4 KPI cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`kpi-bottom-${i}`} className="h-32 rounded-xl" />
        ))}
      </div>

      {/* Row 4: Alerts */}
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
