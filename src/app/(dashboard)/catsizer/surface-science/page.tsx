import { SurfaceScienceWorkbench } from "./workbench";
import { Atom, FlaskConical, Microscope } from "lucide-react";

export default function SurfaceSciencePage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#7A0A1E] via-[#C8102E] to-[#E03050] p-6 text-white">
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="hex-ss" x="0" y="0" width="30" height="26" patternUnits="userSpaceOnUse">
                <circle cx="15" cy="5" r="2" fill="currentColor" />
                <circle cx="5" cy="18" r="2" fill="currentColor" />
                <circle cx="25" cy="18" r="2" fill="currentColor" />
                <line x1="15" y1="5" x2="5" y2="18" stroke="currentColor" strokeWidth="0.5" />
                <line x1="15" y1="5" x2="25" y2="18" stroke="currentColor" strokeWidth="0.5" />
                <line x1="5" y1="18" x2="25" y2="18" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hex-ss)" />
          </svg>
        </div>
        <div className="relative z-10 flex flex-col lg:flex-row items-start gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Atom className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Surface Science Workbench</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Catalyst Characterization & Activity Prediction</h1>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5">
              <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" /></span>
              <span className="text-[10px] font-medium tracking-wide text-white/80">AI Copilot — powered by BelgaLabs</span>
            </div>
            <p className="text-sm text-white/80 max-w-2xl">
              First-principles catalyst sizing from chemisorption data. Enter your lab characterization
              results — CO/H₂ uptake, BET surface area, PGM loading — and compute dispersion,
              metallic surface area, turnover frequency, and required catalyst volume from molecular-level kinetics.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {["Chemisorption → Dispersion", "TOF Database", "Metallic Surface Area", "Activity Profiles", "First-Principles Sizing", "Reactor Profiles"].map((tag) => (
                <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <div className="rounded-xl bg-white/10 backdrop-blur p-3 text-center">
              <FlaskConical className="h-8 w-8 mx-auto mb-1 text-purple-200" />
              <p className="text-[10px] text-white/60">Profiles</p>
              <p className="text-lg font-bold">9</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur p-3 text-center">
              <Microscope className="h-8 w-8 mx-auto mb-1 text-purple-200" />
              <p className="text-[10px] text-white/60">TOF Entries</p>
              <p className="text-lg font-bold">16</p>
            </div>
          </div>
        </div>
      </div>
      <SurfaceScienceWorkbench />
    </div>
  );
}
