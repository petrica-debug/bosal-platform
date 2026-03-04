import { Badge } from "@/components/ui/badge";
import { DepollutionCalculator } from "./calculator";

export default function DepollutionPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          Aftertreatment Catalyst Sizing
        </h1>
        <Badge variant="secondary">Depollution</Badge>
      </div>
      <p className="text-muted-foreground max-w-3xl">
        Configure engine parameters, select your aftertreatment chain
        (DOC → DPF → SCR → ASC), and calculate catalyst volumes, pressure
        drops, and emission compliance.
      </p>
      <DepollutionCalculator />
    </div>
  );
}
