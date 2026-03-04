import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function CompliancePage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          Compliance &amp; Certification Tracker
        </h1>
        <Badge>F-05</Badge>
        <Badge variant="secondary">P1</Badge>
      </div>
      <p className="text-muted-foreground max-w-2xl">
        Digital certificate repository with expiration monitoring and regulatory
        change tracking.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Compliance &amp; Certification Tracker</CardTitle>
          <CardDescription>
            This module is planned for a future release.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">Coming Soon</p>
            <p className="text-sm">
              Coming in Phase 2 — Optimization.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
