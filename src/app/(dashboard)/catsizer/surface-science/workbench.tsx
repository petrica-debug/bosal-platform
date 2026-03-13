"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calculator,
  Beaker,
  Atom,
  Microscope,
  FlaskConical,
  Thermometer,
  Activity,
  Info,
  ChevronDown,
  ChevronRight,
  Eye,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  calculateDispersion,
  tofAtTemperature,
  generateActivityProfile,
  TOF_DATABASE,
  type ChemisorptionData,
  type DispersionResult,
  type ActivityPoint,
  type TOFEntry,
} from "@/lib/catsizer/surface-science";
import {
  CATALYST_PROFILES_DB,
  type DetailedCatalystProfile,
} from "@/lib/catsizer/catalyst-profiles";

function NumField({
  label,
  value,
  unit,
  onChange,
  step,
}: {
  label: string;
  value: number;
  unit?: string;
  onChange: (v: number) => void;
  step?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="w-44 shrink-0 text-sm">{label}</Label>
      <Input
        type="number"
        step={step ?? "any"}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="font-mono w-28"
      />
      {unit && (
        <span className="w-20 shrink-0 text-xs text-muted-foreground">{unit}</span>
      )}
    </div>
  );
}

const REACTION_CATEGORIES: Record<string, { label: string; match: (r: string) => boolean; color: string }> = {
  co_ox: {
    label: "CO Oxidation",
    match: (r) => r.includes("CO") && r.includes("½O₂") && r.includes("CO₂") && !r.includes("H₂O"),
    color: "#EF4444",
  },
  hc_ox: {
    label: "HC Oxidation",
    match: (r) => r.includes("C₃H₆") || r.includes("C₃H₈") || (r.includes("CH₄") && r.includes("O₂") && !r.includes("H₂O")),
    color: "#F59E0B",
  },
  no_ox: {
    label: "NO Oxidation",
    match: (r) => r.includes("NO") && r.includes("½O₂") && !r.includes("NH₃") && !r.includes("CO"),
    color: "#8B5CF6",
  },
  nox_red: {
    label: "NOₓ Reduction (TWC)",
    match: (r) => r.includes("NO") && r.includes("CO") && r.includes("N₂") && !r.includes("NH₃"),
    color: "#06B6D4",
  },
  scr: {
    label: "SCR DeNOx",
    match: (r) => r.includes("NH₃") || r.includes("4NO"),
    color: "#10B981",
  },
  wgs: {
    label: "Water-Gas Shift",
    match: (r) => r.includes("CO + H₂O") || r.includes("CO₂ + H₂"),
    color: "#3B82F6",
  },
  smr: {
    label: "Steam Methane Reforming",
    match: (r) => r.includes("CH₄ + H₂O") || (r.includes("CH₄") && r.includes("3H₂")),
    color: "#EC4899",
  },
};

export function SurfaceScienceWorkbench() {
  // Chemisorption inputs
  const [probeGas, setProbeGas] = useState<"CO" | "H2">("CO");
  const [uptake, setUptake] = useState(45);
  const [pgmWt, setPgmWt] = useState(1.2);
  const [primaryMetal, setPrimaryMetal] = useState<"Pt" | "Pd" | "Rh" | "Ni" | "Cu" | "Fe">("Pt");
  const [measurementTemp, setMeasurementTemp] = useState(35);
  const [BET, setBET] = useState(150);

  // Sizing inputs
  const [pollutantFlow, setPollutantFlow] = useState(0.005);
  const [targetConversion, setTargetConversion] = useState(95);
  const [operatingTemp, setOperatingTemp] = useState(350);
  const [pgmLoading, setPgmLoading] = useState(80);
  const [washcoatLoading, setWashcoatLoading] = useState(120);
  const [washcoatThickness, setWashcoatThickness] = useState(30);
  const [catalystVolume, setCatalystVolume] = useState(5);

  // Selected profile
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // Selected TOF entry
  const [selectedTOFId, setSelectedTOFId] = useState<string>(TOF_DATABASE[0]?.id ?? "");

  // Active tab
  const [activeTab, setActiveTab] = useState("characterize");

  // Results
  const [dispResult, setDispResult] = useState<DispersionResult | null>(null);
  const [activityProfile, setActivityProfile] = useState<ActivityPoint[]>([]);

  const selectedTOF = useMemo(() => TOF_DATABASE.find((t) => t.id === selectedTOFId), [selectedTOFId]);

  const calculateDispersionResult = () => {
    const data: ChemisorptionData = {
      probeGas,
      uptake_umol_g: uptake,
      pgmLoading_wt_percent: pgmWt,
      primaryMetal,
      measurementTemp_C: measurementTemp,
    };
    const result = calculateDispersion(data);
    setDispResult(result);

    // Generate activity profile if TOF is selected
    if (selectedTOF) {
      const profile = generateActivityProfile(
        selectedTOF,
        result,
        catalystVolume,
        washcoatLoading,
        pollutantFlow,
        washcoatThickness,
        1e-6,
        [100, 650],
        50
      );
      setActivityProfile(profile);
    }
  };

  const generateMultiReactionProfiles = (
    profile: DetailedCatalystProfile,
    dispersionResult: DispersionResult,
  ) => {
    const profiles: Array<{ reactionName: string; tofEntry: TOFEntry; data: ActivityPoint[] }> = [];

    for (const rx of profile.activity.reactions) {
      const matchingTOF = TOF_DATABASE.find((t) =>
        t.catalystTypes.includes(profile.catalystType) &&
        Math.abs(t.TOF_ref - rx.TOF_ref) < 0.01 &&
        Math.abs(t.Ea_kJ_mol - rx.Ea_kJ_mol) < 1
      );

      const syntheticTOF: TOFEntry = matchingTOF ?? {
        id: `synthetic-${profile.id}-${rx.name.replace(/\s+/g, "-")}`,
        reaction: rx.name,
        catalyst: profile.name,
        metal: profile.composition.activePhase.split(/[\s-/(]+/)[0] ?? "Pt",
        TOF_ref: rx.TOF_ref,
        T_ref_C: rx.T_ref_C,
        Ea_kJ_mol: rx.Ea_kJ_mol,
        reactionOrder: 1,
        conditions: rx.conditions,
        reference: "Profile data",
        catalystTypes: [profile.catalystType],
      };

      const data = generateActivityProfile(
        syntheticTOF,
        dispersionResult,
        catalystVolume,
        profile.composition.washcoatLoading_g_L,
        pollutantFlow,
        profile.composition.washcoatThickness_um,
        1e-6,
        [100, 650],
        50
      );

      profiles.push({ reactionName: rx.name, tofEntry: syntheticTOF, data });
    }

    setMultiActivityProfiles(profiles);
  };

  const loadProfile = (id: string, switchToActivity = false) => {
    const p = CATALYST_PROFILES_DB.find((pr) => pr.id === id);
    if (!p) return;
    setSelectedProfileId(id);
    setProbeGas(p.chemisorption.probeGas);
    setUptake(p.chemisorption.uptake_umol_gCat);
    setPgmWt(p.composition.pgm_wt_percent);
    setBET(p.physical.BET_m2_g);
    setPgmLoading(p.composition.totalPGM_g_ft3);
    setWashcoatLoading(p.composition.washcoatLoading_g_L);
    setWashcoatThickness(p.composition.washcoatThickness_um);

    let metal: typeof primaryMetal = "Pt";
    const phase = p.composition.activePhase.toLowerCase();
    if (phase.includes("rh")) metal = "Rh";
    else if (phase.includes("pd")) metal = "Pd";
    else if (phase.includes("pt")) metal = "Pt";
    else if (phase.includes("ni")) metal = "Ni";
    else if (phase.includes("cu")) metal = "Cu";
    else if (phase.includes("fe")) metal = "Fe";
    setPrimaryMetal(metal);

    const applicableTOF = TOF_DATABASE.find((t) =>
      t.catalystTypes.includes(p.catalystType) &&
      t.metal === metal
    );
    if (applicableTOF) setSelectedTOFId(applicableTOF.id);

    const data: ChemisorptionData = {
      probeGas: p.chemisorption.probeGas,
      uptake_umol_g: p.chemisorption.uptake_umol_gCat,
      pgmLoading_wt_percent: p.composition.pgm_wt_percent,
      primaryMetal: metal,
      measurementTemp_C: p.chemisorption.measurementTemp_C,
    };
    const result = calculateDispersion(data);
    setDispResult(result);

    const tofEntry = applicableTOF ?? TOF_DATABASE.find((t) => t.catalystTypes.includes(p.catalystType));
    if (tofEntry) {
      const profile = generateActivityProfile(
        tofEntry, result, catalystVolume,
        p.composition.washcoatLoading_g_L,
        pollutantFlow, p.composition.washcoatThickness_um,
        1e-6, [100, 650], 50
      );
      setActivityProfile(profile);
    }

    generateMultiReactionProfiles(p, result);

    setActiveTab(switchToActivity ? "activity" : "characterize");
  };

  // Multi-reaction activity profiles (generated when loading a catalyst profile)
  const [multiActivityProfiles, setMultiActivityProfiles] = useState<
    Array<{ reactionName: string; tofEntry: TOFEntry; data: ActivityPoint[] }>
  >([]);

  // Collapsible state for "All Reactions" chart
  const [showAllReactionsChart, setShowAllReactionsChart] = useState(false);

  // TOF vs Temperature data for all entries
  const tofTempData = useMemo(() => {
    const temps = Array.from({ length: 50 }, (_, i) => 100 + i * 12);
    return temps.map((T) => {
      const row: Record<string, number> = { T };
      for (const entry of TOF_DATABASE) {
        row[entry.id] = tofAtTemperature(entry, T);
      }
      return row;
    });
  }, []);

  // Group TOF entries by reaction category
  const tofByReaction = useMemo(() => {
    const groups: Record<string, { label: string; color: string; entries: TOFEntry[] }> = {};
    for (const [key, cat] of Object.entries(REACTION_CATEGORIES)) {
      const matching = TOF_DATABASE.filter((e) => cat.match(e.reaction));
      if (matching.length > 0) {
        groups[key] = { label: cat.label, color: cat.color, entries: matching };
      }
    }
    return groups;
  }, []);

  // Per-reaction chart data
  const tofPerReactionData = useMemo(() => {
    const temps = Array.from({ length: 50 }, (_, i) => 100 + i * 12);
    const result: Record<string, Record<string, number>[]> = {};
    for (const [key, group] of Object.entries(tofByReaction)) {
      result[key] = temps.map((T) => {
        const row: Record<string, number> = { T };
        for (const entry of group.entries) {
          row[entry.id] = tofAtTemperature(entry, T);
        }
        return row;
      });
    }
    return result;
  }, [tofByReaction]);

  // Sizing result
  const sizingResult = useMemo(() => {
    if (!dispResult || !selectedTOF) return null;
    const tof_T = tofAtTemperature(selectedTOF, operatingTemp);
    const requiredRate = pollutantFlow * (targetConversion / 100);
    const AVOGADRO = 6.022e23;
    const requiredMolecules = requiredRate * AVOGADRO;
    const requiredSites = tof_T > 0 ? requiredMolecules / tof_T : Infinity;
    const requiredPGM_g = dispResult.surfaceSites_per_gPGM > 0 ? requiredSites / dispResult.surfaceSites_per_gPGM : 0;
    const pgm_g_per_L = pgmLoading / 28.317;
    const requiredVolume_L = pgm_g_per_L > 0 ? requiredPGM_g / pgm_g_per_L : 0;

    return {
      tof_T,
      requiredRate,
      requiredMolecules,
      requiredSites,
      requiredPGM_g: isFinite(requiredPGM_g) ? requiredPGM_g : 0,
      requiredVolume_L: isFinite(requiredVolume_L) ? requiredVolume_L : 0,
    };
  }, [dispResult, selectedTOF, operatingTemp, pollutantFlow, targetConversion, pgmLoading]);

  const COLORS = ["#E74C3C", "#3498DB", "#2ECC71", "#F39C12", "#9B59B6", "#1ABC9C", "#E67E22", "#34495E",
    "#C0392B", "#2980B9", "#27AE60", "#D35400", "#8E44AD", "#16A085", "#F1C40F", "#7F8C8D"];

  return (
    <div className="grid gap-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="characterize">Characterization</TabsTrigger>
          <TabsTrigger value="tof-db">TOF Database</TabsTrigger>
          <TabsTrigger value="profiles">Catalyst Profiles</TabsTrigger>
          <TabsTrigger value="sizing">TOF-Based Sizing</TabsTrigger>
          <TabsTrigger value="activity">Activity Profiles</TabsTrigger>
        </TabsList>

        {/* ---- CHARACTERIZATION TAB ---- */}
        <TabsContent value="characterize" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Input Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Microscope className="h-4 w-4 text-primary" />
                  Chemisorption Input
                </CardTitle>
                <CardDescription>
                  Enter lab characterization data or load from a preset profile
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Profile selector */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Load from Profile</Label>
                  <Select value={selectedProfileId ?? ""} onValueChange={loadProfile}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a catalyst profile..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CATALYST_PROFILES_DB.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          [{p.catalystType}] {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Label className="w-44 shrink-0 text-sm">Probe Gas</Label>
                    <Select value={probeGas} onValueChange={(v) => setProbeGas(v as "CO" | "H2")}>
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CO">CO</SelectItem>
                        <SelectItem value="H2">H₂</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <NumField label="Chemisorption Uptake" value={uptake} unit="µmol/g" onChange={setUptake} />
                  <div className="flex items-center gap-2">
                    <Label className="w-44 shrink-0 text-sm">Primary Metal</Label>
                    <Select value={primaryMetal} onValueChange={(v) => setPrimaryMetal(v as typeof primaryMetal)}>
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pt">Pt</SelectItem>
                        <SelectItem value="Pd">Pd</SelectItem>
                        <SelectItem value="Rh">Rh</SelectItem>
                        <SelectItem value="Ni">Ni</SelectItem>
                        <SelectItem value="Cu">Cu</SelectItem>
                        <SelectItem value="Fe">Fe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <NumField label="PGM Loading" value={pgmWt} unit="wt%" onChange={setPgmWt} step="0.1" />
                  <NumField label="Measurement Temp" value={measurementTemp} unit="°C" onChange={setMeasurementTemp} />
                  <NumField label="BET Surface Area" value={BET} unit="m²/g" onChange={setBET} />
                </div>

                <Button onClick={calculateDispersionResult} className="w-full mt-4">
                  <Calculator className="mr-2 h-4 w-4" /> Calculate Dispersion & Activity
                </Button>
              </CardContent>
            </Card>

            {/* Results Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Atom className="h-4 w-4 text-primary" />
                  Dispersion & Surface Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dispResult ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border p-3 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20">
                        <p className="text-xs text-muted-foreground">PGM Dispersion</p>
                        <p className="text-2xl font-mono font-bold text-purple-700 dark:text-purple-300">
                          {(dispResult.dispersion * 100).toFixed(1)}%
                        </p>
                        <p className="text-[10px] text-muted-foreground">fraction of atoms on surface</p>
                      </div>
                      <div className="rounded-lg border p-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20">
                        <p className="text-xs text-muted-foreground">Particle Size</p>
                        <p className="text-2xl font-mono font-bold text-blue-700 dark:text-blue-300">
                          {dispResult.particleSize_nm.toFixed(1)} nm
                        </p>
                        <p className="text-[10px] text-muted-foreground">from D = f/d approximation</p>
                      </div>
                      <div className="rounded-lg border p-3 bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950/30 dark:to-teal-900/20">
                        <p className="text-xs text-muted-foreground">Metallic SA</p>
                        <p className="text-2xl font-mono font-bold text-teal-700 dark:text-teal-300">
                          {dispResult.metallicSurfaceArea_m2_gPGM.toFixed(0)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">m²/g_PGM</p>
                      </div>
                      <div className="rounded-lg border p-3 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20">
                        <p className="text-xs text-muted-foreground">Surface Sites</p>
                        <p className="text-2xl font-mono font-bold text-orange-700 dark:text-orange-300">
                          {dispResult.surfaceSites_per_gCat.toExponential(2)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">sites / g_catalyst</p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4 bg-muted/30">
                      <h4 className="text-sm font-semibold mb-2">Detailed Results</h4>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                        <span className="text-muted-foreground">Metallic SA (per g_cat)</span>
                        <span className="font-mono">{dispResult.metallicSurfaceArea_m2_gCat.toExponential(3)} m²/g</span>
                        <span className="text-muted-foreground">Sites per g_PGM</span>
                        <span className="font-mono">{dispResult.surfaceSites_per_gPGM.toExponential(3)}</span>
                        <span className="text-muted-foreground">Sites per g_cat</span>
                        <span className="font-mono">{dispResult.surfaceSites_per_gCat.toExponential(3)}</span>
                      </div>
                    </div>

                    {/* Dispersion quality indicator */}
                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-semibold mb-2">Dispersion Quality Assessment</p>
                      <div className="relative h-6 rounded-full bg-gradient-to-r from-red-200 via-yellow-200 via-green-200 to-blue-200 dark:from-red-900 dark:via-yellow-900 dark:via-green-900 dark:to-blue-900">
                        <div
                          className="absolute top-0 h-6 w-1 bg-foreground rounded"
                          style={{ left: `${Math.min(100, dispResult.dispersion * 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                        <span>0% (bulk)</span>
                        <span>25% (typical)</span>
                        <span>50% (good)</span>
                        <span>75% (excellent)</span>
                        <span>100%</span>
                      </div>
                      <p className="text-xs mt-2 text-muted-foreground">
                        {dispResult.dispersion < 0.1 && "Low dispersion — large particles, poor PGM utilization. Consider re-impregnation or different support."}
                        {dispResult.dispersion >= 0.1 && dispResult.dispersion < 0.3 && "Moderate dispersion — typical for industrial catalysts. Adequate for most applications."}
                        {dispResult.dispersion >= 0.3 && dispResult.dispersion < 0.6 && "Good dispersion — well-prepared catalyst. Good balance of activity and stability."}
                        {dispResult.dispersion >= 0.6 && "Excellent dispersion — very small particles. High activity but may be susceptible to sintering under thermal stress."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <Atom className="h-12 w-12 mb-3 opacity-30" />
                    <p className="text-sm">Enter chemisorption data and calculate</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---- TOF DATABASE TAB ---- */}
        <TabsContent value="tof-db" className="mt-4">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-primary" />
                  Turnover Frequency Database
                </CardTitle>
                <CardDescription>
                  Literature TOF values for key catalytic reactions — curated from published kinetic studies on well-characterized catalysts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reaction</TableHead>
                        <TableHead>Catalyst</TableHead>
                        <TableHead>Metal</TableHead>
                        <TableHead>TOF [s⁻¹]</TableHead>
                        <TableHead>T_ref [°C]</TableHead>
                        <TableHead>Ea [kJ/mol]</TableHead>
                        <TableHead>Conditions</TableHead>
                        <TableHead>Reference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {TOF_DATABASE.map((entry) => (
                        <TableRow key={entry.id} className={entry.id === selectedTOFId ? "bg-primary/5" : ""}>
                          <TableCell className="text-xs font-medium">{entry.reaction}</TableCell>
                          <TableCell className="text-xs">{entry.catalyst}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{entry.metal}</Badge>
                          </TableCell>
                          <TableCell className="font-mono font-semibold">{entry.TOF_ref}</TableCell>
                          <TableCell className="font-mono">{entry.T_ref_C}</TableCell>
                          <TableCell className="font-mono">{entry.Ea_kJ_mol}</TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{entry.conditions}</TableCell>
                          <TableCell className="text-xs max-w-[180px] truncate text-muted-foreground">{entry.reference}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Per-Reaction TOF Charts */}
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(tofByReaction).map(([key, group]) => (
                <Card key={key}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: REACTION_CATEGORIES[key]?.color }} />
                      <CardTitle className="text-sm">{group.label}</CardTitle>
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        {group.entries.length} {group.entries.length === 1 ? "catalyst" : "catalysts"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={tofPerReactionData[key]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                        <XAxis
                          dataKey="T"
                          label={{ value: "Temperature [°C]", position: "insideBottom", offset: -5 }}
                          tick={{ fontSize: 10, fill: "#94A3B8" }}
                          tickFormatter={(v: number) => Math.round(v).toString()}
                        />
                        <YAxis
                          scale="log"
                          domain={[1e-6, 1e4]}
                          label={{ value: "TOF [s⁻¹]", angle: -90, position: "insideLeft" }}
                          tickFormatter={(v: number) => v >= 1 ? v.toFixed(0) : v.toExponential(0)}
                          tick={{ fontSize: 10, fill: "#94A3B8" }}
                        />
                        <Tooltip contentStyle={{ backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }} formatter={(v: number) => v.toFixed(4)} />
                        <Legend wrapperStyle={{ fontSize: "10px", color: "#CBD5E1" }} />
                        {group.entries.map((entry, i) => (
                          <Line
                            key={entry.id}
                            type="monotone"
                            dataKey={entry.id}
                            name={`${entry.metal}: ${entry.catalyst}`}
                            stroke={COLORS[i % COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Collapsible All Reactions Chart */}
            <Card>
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => setShowAllReactionsChart((v) => !v)}
              >
                <div className="flex items-center gap-2">
                  {showAllReactionsChart ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <CardTitle className="text-base">TOF vs Temperature — All Reactions</CardTitle>
                </div>
                <CardDescription>
                  Arrhenius-extrapolated turnover frequencies showing how catalytic activity varies with temperature
                </CardDescription>
              </CardHeader>
              {showAllReactionsChart && (
                <CardContent>
                  <ResponsiveContainer width="100%" height={450}>
                    <LineChart data={tofTempData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                      <XAxis dataKey="T" label={{ value: "Temperature [°C]", position: "insideBottom", offset: -5 }} tick={{ fill: "#94A3B8" }} tickFormatter={(v: number) => Math.round(v).toString()} />
                      <YAxis
                        scale="log"
                        domain={[1e-6, 1e4]}
                        label={{ value: "TOF [s⁻¹]", angle: -90, position: "insideLeft" }}
                        tickFormatter={(v: number) => v >= 1 ? v.toFixed(0) : v.toExponential(0)}
                        tick={{ fill: "#94A3B8" }}
                      />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }} formatter={(v: number) => v.toFixed(4)} />
                      <Legend wrapperStyle={{ fontSize: "10px", color: "#CBD5E1" }} />
                      {TOF_DATABASE.map((entry, i) => (
                        <Line
                          key={entry.id}
                          type="monotone"
                          dataKey={entry.id}
                          name={`${entry.metal}: ${entry.reaction}`}
                          stroke={COLORS[i % COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* ---- PROFILES TAB ---- */}
        <TabsContent value="profiles" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {CATALYST_PROFILES_DB.map((p) => {
              const typeColors: Record<string, string> = {
                DOC: "#1A4F6E", TWC: "#C44536", SCR: "#1A5E42", ASC: "#4E356E",
                SMR: "#B8860B", WGS: "#556B2F", POX: "#8B0000", ATR: "#4B0082",
              };
              return (
                <Card key={p.id} className="overflow-hidden">
                  <div className="h-1" style={{ backgroundColor: typeColors[p.catalystType] ?? "#666" }} />
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Badge style={{ backgroundColor: typeColors[p.catalystType] ?? "#666", color: "white" }}>
                        {p.catalystType}
                      </Badge>
                      <CardTitle className="text-sm">{p.name}</CardTitle>
                    </div>
                    <CardDescription className="text-xs">{p.supplier}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs space-y-3">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      <span className="text-muted-foreground">Support</span>
                      <span className="font-mono truncate">{p.composition.support}</span>
                      <span className="text-muted-foreground">Active Phase</span>
                      <span className="font-mono truncate">{p.composition.activePhase}</span>
                      <span className="text-muted-foreground">BET</span>
                      <span className="font-mono">{p.physical.BET_m2_g} m²/g</span>
                      <span className="text-muted-foreground">Dispersion</span>
                      <span className="font-mono">{p.chemisorption.dispersion_percent}%</span>
                      <span className="text-muted-foreground">Particle Size</span>
                      <span className="font-mono">{p.chemisorption.avgParticleSize_nm} nm</span>
                      {p.composition.totalPGM_g_ft3 > 0 && (
                        <>
                          <span className="text-muted-foreground">PGM</span>
                          <span className="font-mono">{p.composition.totalPGM_g_ft3} g/ft³</span>
                        </>
                      )}
                    </div>

                    {/* Activity summary */}
                    <div className="border-t pt-2">
                      {p.activity.reactions.map((rx, i) => (
                        <div key={i} className="flex justify-between items-center py-0.5">
                          <span className="text-muted-foreground truncate mr-2">{rx.name}</span>
                          <span className="font-mono text-[10px] whitespace-nowrap">
                            T₅₀={rx.T50_lightOff_C}°C | TOF={rx.TOF_ref} s⁻¹
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Thermal & poison */}
                    <div className="border-t pt-2 flex gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">
                        Max {p.thermalStability.maxOperatingTemp_C}°C
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        S tol: {p.poisonTolerance.sulfurTolerance}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        Cost: {p.costIndex.toFixed(1)}×
                      </Badge>
                    </div>

                    <p className="text-[10px] text-muted-foreground italic leading-tight">{p.notes}</p>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => loadProfile(p.id)}
                      >
                        Load into Workbench
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => loadProfile(p.id, true)}
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        View Activity Curves
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ---- TOF-BASED SIZING TAB ---- */}
        <TabsContent value="sizing" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-primary" />
                  Sizing Inputs
                </CardTitle>
                <CardDescription>
                  Define the reaction conditions and catalyst parameters for first-principles sizing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Select TOF Entry</Label>
                  <Select value={selectedTOFId} onValueChange={setSelectedTOFId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TOF_DATABASE.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.metal}: {t.reaction} (TOF={t.TOF_ref} @ {t.T_ref_C}°C)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <NumField label="Pollutant Molar Flow" value={pollutantFlow} unit="mol/s" onChange={setPollutantFlow} step="0.001" />
                  <NumField label="Target Conversion" value={targetConversion} unit="%" onChange={setTargetConversion} />
                  <NumField label="Operating Temperature" value={operatingTemp} unit="°C" onChange={setOperatingTemp} />
                  <NumField label="PGM Loading" value={pgmLoading} unit="g/ft³" onChange={setPgmLoading} />
                  <NumField label="Washcoat Loading" value={washcoatLoading} unit="g/L" onChange={setWashcoatLoading} />
                  <NumField label="Washcoat Thickness" value={washcoatThickness} unit="µm" onChange={setWashcoatThickness} />
                  <NumField label="Reference Volume" value={catalystVolume} unit="L" onChange={setCatalystVolume} />
                </div>

                <Button onClick={calculateDispersionResult} className="w-full">
                  <Beaker className="mr-2 h-4 w-4" /> Calculate from First Principles
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Sizing Result
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sizingResult && dispResult ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20">
                        <p className="text-xs text-muted-foreground">Required Volume</p>
                        <p className="text-2xl font-mono font-bold text-emerald-700 dark:text-emerald-300">
                          {sizingResult.requiredVolume_L.toFixed(2)} L
                        </p>
                        <p className="text-[10px] text-muted-foreground">from TOF first principles</p>
                      </div>
                      <div className="rounded-lg border p-3 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20">
                        <p className="text-xs text-muted-foreground">Required PGM</p>
                        <p className="text-2xl font-mono font-bold text-amber-700 dark:text-amber-300">
                          {sizingResult.requiredPGM_g.toFixed(3)} g
                        </p>
                        <p className="text-[10px] text-muted-foreground">precious metal mass</p>
                      </div>
                      <div className="rounded-lg border p-3 bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950/30 dark:to-rose-900/20">
                        <p className="text-xs text-muted-foreground">TOF @ {operatingTemp}°C</p>
                        <p className="text-2xl font-mono font-bold text-rose-700 dark:text-rose-300">
                          {sizingResult.tof_T.toFixed(3)} s⁻¹
                        </p>
                        <p className="text-[10px] text-muted-foreground">molecules / (site · s)</p>
                      </div>
                      <div className="rounded-lg border p-3 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/30 dark:to-indigo-900/20">
                        <p className="text-xs text-muted-foreground">Required Sites</p>
                        <p className="text-2xl font-mono font-bold text-indigo-700 dark:text-indigo-300">
                          {sizingResult.requiredSites.toExponential(2)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">active surface sites</p>
                      </div>
                    </div>

                    {/* Sizing chain visualization */}
                    <div className="rounded-lg border p-4 bg-muted/30">
                      <h4 className="text-sm font-semibold mb-3">Sizing Chain: Molecules → Sites → Volume</h4>
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <div className="rounded bg-background border p-2 text-center">
                          <p className="text-muted-foreground">Pollutant Flow</p>
                          <p className="font-mono font-semibold">{pollutantFlow.toExponential(2)} mol/s</p>
                        </div>
                        <span className="text-muted-foreground">×</span>
                        <div className="rounded bg-background border p-2 text-center">
                          <p className="text-muted-foreground">Conversion</p>
                          <p className="font-mono font-semibold">{targetConversion}%</p>
                        </div>
                        <span className="text-muted-foreground">→</span>
                        <div className="rounded bg-background border p-2 text-center">
                          <p className="text-muted-foreground">Required Rate</p>
                          <p className="font-mono font-semibold">{sizingResult.requiredRate.toExponential(2)} mol/s</p>
                        </div>
                        <span className="text-muted-foreground">÷ TOF →</span>
                        <div className="rounded bg-background border p-2 text-center">
                          <p className="text-muted-foreground">Sites Needed</p>
                          <p className="font-mono font-semibold">{sizingResult.requiredSites.toExponential(2)}</p>
                        </div>
                        <span className="text-muted-foreground">÷ D →</span>
                        <div className="rounded bg-primary/10 border-primary/30 border p-2 text-center">
                          <p className="text-muted-foreground">PGM Mass</p>
                          <p className="font-mono font-bold">{sizingResult.requiredPGM_g.toFixed(3)} g</p>
                        </div>
                        <span className="text-muted-foreground">÷ loading →</span>
                        <div className="rounded bg-primary/10 border-primary/30 border p-2 text-center">
                          <p className="text-muted-foreground">Volume</p>
                          <p className="font-mono font-bold">{sizingResult.requiredVolume_L.toFixed(2)} L</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Info className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>
                        Using {selectedTOF?.catalyst} — TOF = {selectedTOF?.TOF_ref} s⁻¹ at {selectedTOF?.T_ref_C}°C,
                        Ea = {selectedTOF?.Ea_kJ_mol} kJ/mol. Dispersion = {(dispResult.dispersion * 100).toFixed(1)}%,
                        particle size = {dispResult.particleSize_nm.toFixed(1)} nm.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <Calculator className="h-12 w-12 mb-3 opacity-30" />
                    <p className="text-sm">Calculate dispersion first, then sizing results will appear</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---- ACTIVITY PROFILES TAB ---- */}
        <TabsContent value="activity" className="mt-4">
          <div className="grid gap-6">
            {activityProfile.length > 0 || multiActivityProfiles.length > 0 ? (
              <>
                {/* Multi-reaction conversion overlay chart */}
                {multiActivityProfiles.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">All Reaction Light-Off Curves</CardTitle>
                      <CardDescription>
                        Conversion vs temperature for all reactions supported by the loaded catalyst profile
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart
                          data={multiActivityProfiles[0].data.map((pt, idx) => {
                            const row: Record<string, number> = { temperature_C: pt.temperature_C };
                            for (const mp of multiActivityProfiles) {
                              row[mp.reactionName] = mp.data[idx]?.conversion_percent ?? 0;
                            }
                            return row;
                          })}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                          <XAxis
                            dataKey="temperature_C"
                            label={{ value: "Temperature [°C]", position: "insideBottom", offset: -5 }}
                            tick={{ fill: "#94A3B8" }}
                            tickFormatter={(v: number) => Math.round(v).toString()}
                          />
                          <YAxis
                            domain={[0, 100]}
                            label={{ value: "Conversion [%]", angle: -90, position: "insideLeft" }}
                            tick={{ fill: "#94A3B8" }}
                          />
                          <Tooltip contentStyle={{ backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }} formatter={(v: number) => `${v.toFixed(1)}%`} />
                          <Legend wrapperStyle={{ color: "#CBD5E1" }} />
                          <ReferenceLine y={50} stroke="#999" strokeDasharray="4 4" label={{ value: "T₅₀", position: "right", fontSize: 10 }} />
                          <ReferenceLine y={90} stroke="#999" strokeDasharray="4 4" label={{ value: "T₉₀", position: "right", fontSize: 10 }} />
                          {multiActivityProfiles.map((mp, i) => (
                            <Line
                              key={mp.reactionName}
                              type="monotone"
                              dataKey={mp.reactionName}
                              name={mp.reactionName}
                              stroke={COLORS[i % COLORS.length]}
                              strokeWidth={2.5}
                              dot={false}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Per-reaction detail cards */}
                {multiActivityProfiles.length > 1 && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {multiActivityProfiles.map((mp, i) => (
                      <Card key={mp.reactionName}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <CardTitle className="text-sm">{mp.reactionName}</CardTitle>
                          </div>
                          <CardDescription className="text-xs">
                            TOF = {mp.tofEntry.TOF_ref} s⁻¹ @ {mp.tofEntry.T_ref_C}°C, Ea = {mp.tofEntry.Ea_kJ_mol} kJ/mol
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={mp.data}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                              <XAxis dataKey="temperature_C" tick={{ fontSize: 10, fill: "#94A3B8" }} tickFormatter={(v: number) => Math.round(v).toString()} />
                              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94A3B8" }} />
                              <Tooltip contentStyle={{ backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }} formatter={(v: number) => `${v.toFixed(1)}%`} />
                              <ReferenceLine y={50} stroke="#ccc" strokeDasharray="3 3" />
                              <Line
                                type="monotone"
                                dataKey="conversion_percent"
                                name="Conversion"
                                stroke={COLORS[i % COLORS.length]}
                                strokeWidth={2}
                                dot={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Single-reaction fallback (original behavior) */}
                {multiActivityProfiles.length === 0 && activityProfile.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Conversion vs Temperature (TOF-Based)</CardTitle>
                      <CardDescription>
                        Light-off curve generated from turnover frequency, dispersion, and Thiele modulus effectiveness factor
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={350}>
                        <LineChart data={activityProfile}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                          <XAxis dataKey="temperature_C" label={{ value: "Temperature [°C]", position: "insideBottom", offset: -5 }} tick={{ fill: "#94A3B8" }} tickFormatter={(v: number) => Math.round(v).toString()} />
                          <YAxis domain={[0, 100]} label={{ value: "Conversion [%]", angle: -90, position: "insideLeft" }} tick={{ fill: "#94A3B8" }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }}
                            formatter={(v: number, name: string) => {
                              if (name === "conversion_percent") return [`${v.toFixed(1)}%`, "Conversion"];
                              return [v.toFixed(4), name];
                            }}
                          />
                          <Legend wrapperStyle={{ color: "#CBD5E1" }} />
                          <Line type="monotone" dataKey="conversion_percent" name="Conversion" stroke="#E74C3C" strokeWidth={3} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">TOF vs Temperature</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={activityProfile.length > 0 ? activityProfile : (multiActivityProfiles[0]?.data ?? [])}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                          <XAxis dataKey="temperature_C" tick={{ fill: "#94A3B8" }} tickFormatter={(v: number) => Math.round(v).toString()} />
                          <YAxis scale="log" domain={["auto", "auto"]} tickFormatter={(v: number) => v >= 1 ? v.toFixed(0) : v.toExponential(0)} tick={{ fill: "#94A3B8" }} />
                          <Tooltip contentStyle={{ backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }} formatter={(v: number) => v.toFixed(4)} />
                          {multiActivityProfiles.length > 0 ? (
                            <>
                              <Legend wrapperStyle={{ color: "#CBD5E1" }} />
                              {multiActivityProfiles.map((mp, i) => (
                                <Line
                                  key={mp.reactionName}
                                  type="monotone"
                                  dataKey="TOF"
                                  data={mp.data}
                                  name={mp.reactionName}
                                  stroke={COLORS[i % COLORS.length]}
                                  strokeWidth={2}
                                  dot={false}
                                />
                              ))}
                            </>
                          ) : (
                            <Line type="monotone" dataKey="TOF" name="TOF [s⁻¹]" stroke="#3498DB" strokeWidth={2} dot={false} />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Reaction Rate vs Temperature</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={activityProfile.length > 0 ? activityProfile : (multiActivityProfiles[0]?.data ?? [])}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 30%)" strokeOpacity={0.6} />
                          <XAxis dataKey="temperature_C" tick={{ fill: "#94A3B8" }} tickFormatter={(v: number) => Math.round(v).toString()} />
                          <YAxis tickFormatter={(v: number) => v.toExponential(1)} tick={{ fill: "#94A3B8" }} />
                          <Tooltip contentStyle={{ backgroundColor: "hsl(220, 13%, 18%)", border: "1px solid hsl(220, 13%, 28%)", borderRadius: 8, color: "#E2E8F0" }} formatter={(v: number) => v.toExponential(3)} />
                          <Legend wrapperStyle={{ color: "#CBD5E1" }} />
                          <Line type="monotone" dataKey="rate_mol_gCat_s" name="Rate [mol/(g·s)]" stroke="#2ECC71" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="rate_mol_L_s" name="Rate [mol/(L·s)]" stroke="#F39C12" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* Regime map */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Kinetic Regime Map</CardTitle>
                    <CardDescription>Shows transition from kinetically-limited to diffusion-limited regime</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {multiActivityProfiles.length > 0 ? (
                      <div className="space-y-3">
                        {multiActivityProfiles.map((mp, i) => {
                          const regimeColors: Record<string, string> = {
                            kinetic: "#2ECC71",
                            transition: "#F39C12",
                            diffusion: "#E74C3C",
                            equilibrium: "#3498DB",
                          };
                          return (
                            <div key={mp.reactionName}>
                              <p className="text-xs font-medium mb-1" style={{ color: COLORS[i % COLORS.length] }}>
                                {mp.reactionName}
                              </p>
                              <div className="flex gap-0.5 h-5 rounded overflow-hidden">
                                {mp.data.map((pt, j) => (
                                  <div
                                    key={j}
                                    className="flex-1"
                                    style={{ backgroundColor: regimeColors[pt.regime] ?? "#999" }}
                                    title={`${pt.temperature_C.toFixed(0)}°C: ${pt.regime}`}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                          <span>{multiActivityProfiles[0].data[0]?.temperature_C.toFixed(0)}°C</span>
                          <span>{multiActivityProfiles[0].data[multiActivityProfiles[0].data.length - 1]?.temperature_C.toFixed(0)}°C</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-1 h-8 rounded overflow-hidden">
                          {activityProfile.map((pt, i) => {
                            const colors: Record<string, string> = {
                              kinetic: "#2ECC71",
                              transition: "#F39C12",
                              diffusion: "#E74C3C",
                              equilibrium: "#3498DB",
                            };
                            return (
                              <div
                                key={i}
                                className="flex-1"
                                style={{ backgroundColor: colors[pt.regime] ?? "#999" }}
                                title={`${pt.temperature_C.toFixed(0)}°C: ${pt.regime}`}
                              />
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                          <span>{activityProfile[0]?.temperature_C.toFixed(0)}°C</span>
                          <span>{activityProfile[activityProfile.length - 1]?.temperature_C.toFixed(0)}°C</span>
                        </div>
                      </>
                    )}
                    <div className="flex gap-4 mt-2 text-xs">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: "#2ECC71" }} /> Kinetic</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: "#F39C12" }} /> Transition</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: "#E74C3C" }} /> Diffusion</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: "#3498DB" }} /> Equilibrium</span>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <Thermometer className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">Run a characterization calculation or load a catalyst profile to generate activity profiles</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
