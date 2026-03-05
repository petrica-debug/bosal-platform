import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function WLTPPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">WLTP Cycle Simulation</h1>
        <p className="text-sm text-muted-foreground">
          Transient emission simulation over WLTP, NEDC, or custom drive cycles
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Drive Cycle Simulation Engine</CardTitle>
          <CardDescription>
            Built-in WLTP (Low/Med/High/ExHigh), NEDC, custom CSV upload. Transient Δt=0.1-1s:
            speed → engine point → engine-out emissions → catalyst T (thermal inertia) → brick T (1D axial)
            → η(T,SV,aging) → tailpipe. SCR NH₃ storage, DPF soot model, AI prediction when kinetic data unavailable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="outline">Coming in Phase 4</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
