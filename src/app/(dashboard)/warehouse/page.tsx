import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Warehouse } from "lucide-react";

export default function WarehousePage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Warehouse className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Smart Warehouse Automation Suite
          </h1>
          <p className="text-sm text-muted-foreground">
            Pick-path optimization, barcode/RFID integration, dynamic slotting,
            and worker productivity analytics.
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Badge>F-08</Badge>
          <Badge variant="secondary">P1</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Warehouse className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-semibold">Coming Soon</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Phase 2 — Optimization
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Planned Features</CardTitle>
          <CardDescription>
            Capabilities coming in this module
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              "Pick-path optimization algorithms",
              "Barcode/RFID scanning integration",
              "Dynamic slotting and wave planning",
              "Worker productivity analytics",
            ].map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {feature}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
