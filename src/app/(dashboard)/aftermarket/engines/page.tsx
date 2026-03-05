import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function EngineDBPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Engine Family Database</h1>
        <p className="text-sm text-muted-foreground">
          Expandable database of engine families with exhaust flow maps and raw emission data
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Engine Families</CardTitle>
          <CardDescription>
            Manufacturer, engine code, displacement, fuel type, power, torque, OEM emission standard.
            Maps: exhaust flow (RPM x load) and raw emissions (RPM x load → CO, HC, NOx, PM).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="outline">Coming in Phase 4</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
