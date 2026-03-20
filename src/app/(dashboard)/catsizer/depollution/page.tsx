import { Badge } from "@/components/ui/badge";
import { ExhaustSystemDiagram } from "@/components/diagrams/exhaust-system-diagram";
import { DepollutionCalculator } from "./calculator";

export default function DepollutionPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header with diagram */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#7A0A1E] via-[#C8102E] to-[#E03050] p-6 text-white">
        <div className="absolute inset-0 opacity-[0.03]">
          <svg width="100%" height="100%">
            <pattern id="hex" width="28" height="49" patternUnits="userSpaceOnUse" patternTransform="scale(2)">
              <path d="M14 0 L28 8.66 L28 25.98 L14 34.64 L0 25.98 L0 8.66Z" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#hex)" />
          </svg>
        </div>
        <div className="relative z-10 flex flex-col lg:flex-row gap-6 items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-white/15 text-white border-white/20">Depollution</Badge>
              <Badge className="bg-white/10 text-white/70 border-white/10">v2.0</Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Aftertreatment Catalyst Sizing
            </h1>
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5">
              <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" /></span>
              <span className="text-[10px] font-medium tracking-wide text-white/80">AI Copilot — powered by BelgaLabs</span>
            </div>
            <p className="text-white/60 mt-2 max-w-xl text-sm leading-relaxed">
              Configure engine parameters, select your aftertreatment architecture, and generate
              RFQ-grade catalyst specifications with reaction kinetics, washcoat analysis,
              deactivation modeling, and emission compliance verification.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {["DOC", "DPF", "SCR", "ASC", "TWC"].map((cat) => (
                <span key={cat} className="rounded-md border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-mono font-bold">
                  {cat}
                </span>
              ))}
            </div>
          </div>
          <div className="w-full lg:w-[480px] rounded-xl bg-white/5 backdrop-blur p-2 border border-white/10">
            <ExhaustSystemDiagram className="w-full h-auto rounded-lg" />
          </div>
        </div>
      </div>

      <DepollutionCalculator />
    </div>
  );
}
