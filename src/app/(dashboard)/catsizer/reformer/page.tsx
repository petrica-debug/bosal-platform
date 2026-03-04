import { Badge } from "@/components/ui/badge";
import { SOFCSystemDiagram } from "@/components/diagrams/sofc-system-diagram";
import { ReformerCalculator } from "./calculator";

export default function ReformerPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header with diagram */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F5A50] via-[#1A7A6E] to-[#2A9D8F] p-6 text-white">
        <div className="absolute inset-0 opacity-[0.03]">
          <svg width="100%" height="100%">
            <pattern id="circuit" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 0 20 L 15 20 L 20 15 L 20 0" fill="none" stroke="white" strokeWidth="0.5" />
              <path d="M 20 40 L 20 25 L 25 20 L 40 20" fill="none" stroke="white" strokeWidth="0.5" />
              <circle cx="20" cy="20" r="2" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#circuit)" />
          </svg>
        </div>
        <div className="relative z-10 flex flex-col lg:flex-row gap-6 items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-white/15 text-white border-white/20">Reformer</Badge>
              <Badge className="bg-white/10 text-white/70 border-white/10">SOFC</Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              H₂ Production — SOFC Reformer Sizing
            </h1>
            <p className="text-white/60 mt-2 max-w-xl text-sm leading-relaxed">
              Configure fuel composition, SOFC operating parameters, and reforming strategy
              to calculate catalyst bed sizes, thermodynamic equilibrium, CH₄/CO ratio optimization,
              heat balance, and carbon formation boundary analysis.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {["SMR", "POX", "ATR", "WGS", "Pre-Reformer", "Desulfurizer"].map((stage) => (
                <span key={stage} className="rounded-md border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-mono font-bold">
                  {stage}
                </span>
              ))}
            </div>
          </div>
          <div className="w-full lg:w-[480px] rounded-xl bg-white/5 backdrop-blur p-2 border border-white/10">
            <SOFCSystemDiagram className="w-full h-auto [&_text]:!fill-white/80 [&_line]:!stroke-white/20" />
          </div>
        </div>
      </div>

      <ReformerCalculator />
    </div>
  );
}
