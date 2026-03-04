import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { Flame, Fuel, ArrowRight } from "lucide-react";

export default function CatSizerPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          CatSizer — Catalyst Sizing Module
        </h1>
        <Badge variant="secondary">Engineering Tool</Badge>
      </div>
      <p className="text-muted-foreground max-w-3xl">
        Engineering calculation module for catalyst sizing across automotive
        depollution (DOC, DPF, SCR, ASC, TWC) and H₂ production for SOFC from
        CH₄ (SMR, POX, ATR). Enter engine or fuel parameters to get catalyst
        geometry, volume, mass, pressure drop, and conversion efficiency.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <Link href="/catsizer/depollution" className="group">
          <Card className="h-full transition-colors group-hover:border-primary">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                  <Flame className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Automotive Depollution
                    <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </CardTitle>
                  <CardDescription>
                    Heavy-Duty Diesel & Genset Aftertreatment
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Size DOC, DPF, SCR, ASC, and TWC catalysts for heavy-duty
                diesel/gas engines and generator sets. Includes compliance
                checking against Euro VI-E, EPA Tier 4, TA Luft, and more.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">DOC</Badge>
                <Badge variant="outline">DPF</Badge>
                <Badge variant="outline">SCR</Badge>
                <Badge variant="outline">ASC</Badge>
                <Badge variant="outline">TWC</Badge>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/catsizer/reformer" className="group">
          <Card className="h-full transition-colors group-hover:border-primary">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                  <Fuel className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    H₂ Production for SOFC
                    <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </CardTitle>
                  <CardDescription>
                    Steam Methane Reforming & Fuel Processing
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Size SMR, POX, and ATR catalyst beds for converting methane to
                hydrogen-rich syngas feeding Solid Oxide Fuel Cells. Includes
                equilibrium analysis, CH₄/CO ratio optimization, and carbon
                formation boundary checks.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">SMR</Badge>
                <Badge variant="outline">POX</Badge>
                <Badge variant="outline">ATR</Badge>
                <Badge variant="outline">WGS</Badge>
                <Badge variant="outline">SOFC</Badge>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
