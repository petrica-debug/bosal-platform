import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import {
  Flame,
  Fuel,
  ArrowRight,
  Gauge,
  Thermometer,
  Beaker,
  Shield,
  Zap,
  Factory,
  Truck,
  Ship,
  Tractor,
  Car,
  Atom,
  Microscope,
  FlaskConical,
} from "lucide-react";
import { ExhaustSystemDiagram } from "@/components/diagrams/exhaust-system-diagram";
import { SOFCSystemDiagram } from "@/components/diagrams/sofc-system-diagram";

export default function CatSizerPage() {
  return (
    <div className="flex flex-col gap-8 p-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#7A0A1E] via-[#C8102E] to-[#E03050] p-8 text-white">
        <div className="absolute inset-0 opacity-5">
          <svg width="100%" height="100%">
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 backdrop-blur">
              <Beaker className="h-5 w-5" />
            </div>
            <Badge className="bg-white/15 text-white border-white/20 backdrop-blur">Engineering Module</Badge>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mt-3">
            CatSizer
          </h1>
          <p className="text-lg text-white/70 mt-1 font-light">
            Catalyst Sizing & System Engineering Platform
          </p>
          <p className="text-sm text-white/50 max-w-2xl mt-3 leading-relaxed">
            Professional-grade engineering calculations for automotive aftertreatment catalyst sizing
            and SOFC fuel processor design. Reaction kinetics, washcoat diffusion, deactivation modeling,
            and RFQ-grade output for OEM specifications.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            {["Thermodynamics", "Reaction Kinetics", "Mass Transfer", "Catalyst Aging", "Surface Science", "TOF Sizing", "RFQ Output"].map((tag) => (
              <span key={tag} className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/70">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Two Calculator Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Depollution Card */}
        <Link href="/catsizer/depollution" className="group">
          <Card className="h-full border-2 transition-all duration-300 group-hover:border-[#C44536] group-hover:shadow-lg group-hover:shadow-[#C44536]/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#C44536] to-[#772222] text-white shadow-md">
                  <Flame className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    Automotive Depollution
                    <ArrowRight className="h-4 w-4 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
                  </CardTitle>
                  <CardDescription>
                    Aftertreatment System Design & Compliance
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl bg-gradient-to-b from-muted/50 to-muted/20 p-3 mb-4 overflow-hidden">
                <ExhaustSystemDiagram className="w-full h-auto" />
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { icon: Gauge, label: "GHSV Sizing", desc: "DOC / DPF / SCR / ASC / TWC" },
                  { icon: Thermometer, label: "Kinetics", desc: "LH, Eley-Rideal, Xu-Froment" },
                  { icon: Shield, label: "Compliance", desc: "Euro VI-E, EPA T4, TA Luft" },
                  { icon: Beaker, label: "Washcoat", desc: "Thiele modulus, effectiveness" },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="rounded-lg border bg-card p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-3.5 w-3.5 text-[#C44536]" />
                      <span className="text-xs font-semibold">{label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">{desc}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-medium">Applications:</span>
                <div className="flex gap-2">
                  {[
                    { icon: Truck, label: "Heavy-Duty" },
                    { icon: Tractor, label: "Off-Highway" },
                    { icon: Factory, label: "Genset" },
                    { icon: Car, label: "Light-Duty" },
                    { icon: Ship, label: "Marine" },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-1">
                      <Icon className="h-3 w-3" />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* SOFC Card */}
        <Link href="/catsizer/reformer" className="group">
          <Card className="h-full border-2 transition-all duration-300 group-hover:border-[#2A9D8F] group-hover:shadow-lg group-hover:shadow-[#2A9D8F]/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#2A9D8F] to-[#0F5A50] text-white shadow-md">
                  <Fuel className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    H₂ Production for SOFC
                    <ArrowRight className="h-4 w-4 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
                  </CardTitle>
                  <CardDescription>
                    Fuel Processing & Reformer Design
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl bg-gradient-to-b from-muted/50 to-muted/20 p-3 mb-4 overflow-hidden">
                <SOFCSystemDiagram className="w-full h-auto" />
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { icon: Zap, label: "Equilibrium", desc: "Gibbs minimization, NASA polys" },
                  { icon: Thermometer, label: "Reforming", desc: "SMR / POX / ATR strategies" },
                  { icon: Gauge, label: "CH₄/CO Ratio", desc: "Internal reforming control" },
                  { icon: Shield, label: "Carbon Check", desc: "Boudouard boundary analysis" },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="rounded-lg border bg-card p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-3.5 w-3.5 text-[#2A9D8F]" />
                      <span className="text-xs font-semibold">{label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">{desc}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {["SMR", "POX", "ATR", "WGS", "SOFC", "Pre-Reformer", "Desulfurizer"].map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Surface Science Workbench Card */}
      <Link href="/catsizer/surface-science" className="group">
        <Card className="border-2 transition-all duration-300 group-hover:border-[#6B3FA0] group-hover:shadow-lg group-hover:shadow-[#6B3FA0]/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#6B3FA0] to-[#2C1654] text-white shadow-md shrink-0">
                <Atom className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold">Surface Science Workbench</h3>
                  <Badge className="bg-[#6B3FA0]/10 text-[#6B3FA0] border-[#6B3FA0]/20">New</Badge>
                  <ArrowRight className="h-4 w-4 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  First-principles catalyst sizing from chemisorption data. Connect lab characterization
                  (CO/H₂ uptake, BET, dispersion) to turnover frequency and required catalyst volume.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: Microscope, label: "Chemisorption", desc: "Dispersion, metallic SA, particle size" },
                    { icon: FlaskConical, label: "TOF Database", desc: "16 literature entries, Arrhenius extrapolation" },
                    { icon: Beaker, label: "Activity Profiles", desc: "Conversion vs T, regime maps, reactor profiles" },
                  ].map(({ icon: Icon, label, desc }) => (
                    <div key={label} className="rounded-lg border bg-card p-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-3.5 w-3.5 text-[#6B3FA0]" />
                        <span className="text-xs font-semibold">{label}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-tight">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* 3D System Visualizations */}
      <div>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <div className="h-1 w-6 rounded-full bg-gradient-to-r from-[#C44536] to-[#E6A23C]" />
          System Architecture
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/exhaust-system-3d.png"
                alt="Heavy-duty diesel aftertreatment system — isometric 3D cutaway"
                className="w-full h-auto"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                <p className="text-white text-sm font-semibold">Heavy-Duty Diesel Aftertreatment</p>
                <p className="text-white/60 text-xs">Engine → DOC → DPF → DEF Injection → SCR → ASC → Tailpipe</p>
              </div>
            </div>
          </Card>
          <Card className="overflow-hidden">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/sofc-system-3d.png"
                alt="SOFC fuel processing system with steam methane reformer"
                className="w-full h-auto"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                <p className="text-white text-sm font-semibold">SOFC Fuel Processing System</p>
                <p className="text-white/60 text-xs">CH₄ → Desulfurizer → Pre-Reformer → SMR → WGS → SOFC Stack → DC Power</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Capabilities Grid */}
      <div>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <div className="h-1 w-6 rounded-full bg-gradient-to-r from-[#1A4F6E] to-[#2A9D8F]" />
          Engineering Capabilities
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Reaction Kinetics",
              items: ["Langmuir-Hinshelwood (DOC, TWC)", "Eley-Rideal (SCR)", "Xu-Froment (Reforming)", "1D Plug-Flow Reactor"],
              color: "#1A4F6E",
            },
            {
              title: "Washcoat & Mass Transfer",
              items: ["Fuller / Knudsen diffusivity", "Thiele modulus analysis", "Internal effectiveness factor", "Thickness optimization"],
              color: "#2A9D8F",
            },
            {
              title: "Deactivation & Aging",
              items: ["Sulfur poisoning (reversible)", "Phosphorus fouling", "Thermal sintering (GPLE)", "Zeolite dealumination"],
              color: "#C44536",
            },
            {
              title: "System Integration",
              items: ["DPF regeneration model", "SCR urea dosing & NH₃ uniformity", "Commercial substrate catalog", "RFQ-grade output"],
              color: "#E6A23C",
            },
          ].map(({ title, items, color }) => (
            <Card key={title} className="border-l-4" style={{ borderLeftColor: color }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm" style={{ color }}>{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <div className="mt-1.5 h-1 w-1 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
