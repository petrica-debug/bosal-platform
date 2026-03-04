import { Badge } from "@/components/ui/badge";
import { ReformerCalculator } from "./calculator";

export default function ReformerPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          H₂ Production — SOFC Reformer Sizing
        </h1>
        <Badge variant="secondary">Reformer</Badge>
      </div>
      <p className="text-muted-foreground max-w-3xl">
        Configure fuel composition, SOFC parameters, and reforming strategy
        (SMR/POX/ATR) to calculate catalyst bed sizes, equilibrium composition,
        CH₄/CO ratio, heat balance, and carbon formation risk.
      </p>
      <ReformerCalculator />
    </div>
  );
}
