import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProductConfigPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Product Configuration</h1>
        <p className="text-sm text-muted-foreground">
          BOSAL substrate catalog, multi-brick configs, PGM &amp; washcoat loading, zone coating
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Substrate Selection &amp; Configuration</CardTitle>
          <CardDescription>
            Cordierite/metallic substrates, cpsi/wall thickness, D x L. Multi-brick configs
            (close-coupled + underfloor). Assign catalyst type per brick. Interactive PGM ratio,
            washcoat layers, zone coating simulation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="outline">Coming in Phase 4</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
