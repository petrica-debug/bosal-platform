import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Layers } from "lucide-react";

export default function PortfolioPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Layers className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            EV & ICE Dual Portfolio Manager
          </h1>
          <p className="text-sm text-muted-foreground">
            Parallel product lifecycle management for EV thermal/acoustic and ICE
            exhaust components.
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Badge>F-09</Badge>
          <Badge variant="outline">P2</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Layers className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-semibold">Coming Soon</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Phase 3 — Strategic
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
              "Parallel product lifecycle management",
              "EV thermal/acoustic component tracking",
              "ICE-to-EV transition planning",
              "Market demand correlation analysis",
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
