import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SpraySimPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#7A0A1E] via-[#C8102E] to-[#E03050] p-8 text-white">
        <div className="max-w-2xl">
          <Badge className="bg-white/20 text-white border-white/30 mb-3">Showcase Feature</Badge>
          <h1 className="text-3xl font-bold mb-2">Urea Spray Simulation</h1>
          <p className="text-white/80 text-sm leading-relaxed">
            Three.js/WebGL visualization of urea spray injection. Lagrangian droplet tracking,
            Rosin-Rammler distribution, evaporation, thermolysis, HNCO hydrolysis, wall impingement,
            and NH₃ uniformity index. Game-engine quality at 60fps.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3D Spray Visualization</CardTitle>
            <CardDescription>
              Semi-transparent exhaust pipe with particle-system spray cone.
              Droplets blown by exhaust like rain in wind. Color by state: liquid (blue),
              evaporating (cyan), NH₃ (green), deposit (red).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-muted/30 h-64 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-4xl mb-2">🌊</p>
                <Badge variant="outline">Three.js — Coming Soon</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Physics Engine</CardTitle>
            <CardDescription>
              Mundo-Sommerfeld wall impingement, deposit risk below 200°C,
              uniformity index γ calculation, interactive sliders for injection
              angle/pressure, flow rate/temp.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {[
                "Lagrangian droplet tracking",
                "Rosin-Rammler size distribution",
                "d² evaporation law with Spalding number",
                "Thermolysis: (NH₂)₂CO → NH₃ + HNCO",
                "Hydrolysis: HNCO + H₂O → NH₃ + CO₂",
                "Wall film model (Kuhnke 2004)",
                "Uniformity index at SCR face",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#C8102E]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
