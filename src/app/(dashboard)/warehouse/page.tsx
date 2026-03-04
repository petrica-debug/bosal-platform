import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function WarehousePage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          Smart Warehouse Automation Suite
        </h1>
        <Badge>F-08</Badge>
        <Badge variant="secondary">P1</Badge>
      </div>
      <p className="text-muted-foreground max-w-2xl">
        Pick-path optimization, barcode/RFID scanning, dynamic slotting, and
        wave planning.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Smart Warehouse Automation Suite</CardTitle>
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
