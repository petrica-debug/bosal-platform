import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Thermometer, ArrowRight } from "lucide-react";

export default function HeatExchangerPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#7A0A1E] via-[#C8102E] to-[#E03050] p-8 text-white">
        <div className="max-w-2xl">
          <Badge className="bg-white/20 text-white border-white/30 mb-3">Module 3</Badge>
          <h1 className="text-3xl font-bold mb-2">Heat Exchange Reformer</h1>
          <p className="text-white/80 text-sm leading-relaxed">
            Thermally couple endothermic reforming with exothermic combustion across a heat transfer surface.
            LMTD/NTU methods, Dittus-Boelter/Gnielinski convection, ASME wall thickness, thermal stress analysis.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { title: "Thermal Design", desc: "LMTD or ε-NTU heat exchanger sizing with U estimation", icon: "🔥" },
          { title: "Process Side", desc: "1D plug flow + radial heat transfer with reforming kinetics", icon: "⚗️" },
          { title: "Mechanical", desc: "ASME wall thickness, thermal stress, material selection (Inconel 625, SS310, Haynes 230)", icon: "🔧" },
        ].map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-xl">{item.icon}</span> {item.title}
              </CardTitle>
              <CardDescription>{item.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">Coming Soon</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
