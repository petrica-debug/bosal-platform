import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          Predictive Demand Analytics
        </h1>
        <Badge>F-11</Badge>
        <Badge variant="outline">P2</Badge>
      </div>
      <p className="text-muted-foreground max-w-2xl">
        ML models using vehicle registration data, regional demand heatmaps, and
        scenario planning.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Predictive Demand Analytics</CardTitle>
          <CardDescription>
            This module is planned for a future release.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">Coming Soon</p>
            <p className="text-sm">
              Coming in Phase 3 — Strategic.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
