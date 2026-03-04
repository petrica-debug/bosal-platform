import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, Globe, AlertTriangle, CheckCircle2, Clock, FileText } from "lucide-react";

const STANDARDS = [
  {
    id: "euro_vi_e",
    name: "Euro VI-E",
    region: "European Union",
    application: "Heavy-Duty On-Road",
    status: "active",
    effectiveDate: "2021-01-01",
    limits: { NOx: "0.40 g/kWh", PM: "0.01 g/kWh", CO: "1.5 g/kWh", HC: "0.13 g/kWh", NH3: "10 ppm" },
    testCycles: ["WHSC", "WHTC", "ISC"],
    notes: "Includes in-service conformity (ISC) with CF = 1.5",
  },
  {
    id: "euro_vii",
    name: "Euro VII",
    region: "European Union",
    application: "All Vehicles",
    status: "upcoming",
    effectiveDate: "2027-07-01",
    limits: { NOx: "0.09 g/kWh", PM: "0.005 g/kWh", CO: "1.5 g/kWh", HC: "0.13 g/kWh", NH3: "10 ppm", N2O: "0.16 g/kWh" },
    testCycles: ["WHSC", "WHTC", "ISC", "RDE"],
    notes: "Includes N₂O limit, brake/tire PM, real-driving emissions",
  },
  {
    id: "epa_tier4",
    name: "EPA Tier 4 Final",
    region: "United States",
    application: "Non-Road Diesel",
    status: "active",
    effectiveDate: "2014-01-01",
    limits: { NOx: "0.27 g/kWh", PM: "0.01 g/kWh", CO: "3.5 g/kWh", HC: "0.14 g/kWh" },
    testCycles: ["NRTC", "RMC"],
    notes: "Applies to engines >560 kW since 2015",
  },
  {
    id: "eu_stage_v",
    name: "EU Stage V (NRMM)",
    region: "European Union",
    application: "Non-Road Mobile Machinery",
    status: "active",
    effectiveDate: "2019-01-01",
    limits: { NOx: "0.40 g/kWh", PM: "0.015 g/kWh", CO: "3.5 g/kWh", HC: "0.19 g/kWh", PN: "1×10¹² #/kWh" },
    testCycles: ["NRSC", "NRTC"],
    notes: "First standard to include particle number (PN) limit for NRMM",
  },
  {
    id: "imo_tier_iii",
    name: "IMO Tier III",
    region: "International (ECA)",
    application: "Marine",
    status: "active",
    effectiveDate: "2016-01-01",
    limits: { NOx: "3.4 g/kWh (n<130rpm)", PM: "—", CO: "—", HC: "—" },
    testCycles: ["E2", "E3"],
    notes: "Applies in Emission Control Areas (ECA). ~80% NOₓ reduction vs Tier I",
  },
  {
    id: "ta_luft",
    name: "TA Luft 2021",
    region: "Germany",
    application: "Stationary Engines / Gensets",
    status: "active",
    effectiveDate: "2021-12-01",
    limits: { NOx: "0.10 g/Nm³", PM: "0.01 g/Nm³", CO: "0.10 g/Nm³", HC: "0.05 g/Nm³ (as C)" },
    testCycles: ["Steady-state at rated load"],
    notes: "Concentration-based limits (g/Nm³ at 5% O₂ reference)",
  },
  {
    id: "china_vi",
    name: "China VI-b",
    region: "China",
    application: "Heavy-Duty On-Road",
    status: "active",
    effectiveDate: "2023-07-01",
    limits: { NOx: "0.40 g/kWh", PM: "0.01 g/kWh", CO: "1.5 g/kWh", HC: "0.13 g/kWh", NH3: "10 ppm" },
    testCycles: ["WHSC", "WHTC", "PEMS"],
    notes: "Aligned with Euro VI-E, includes portable emission measurement (PEMS)",
  },
  {
    id: "carb_omnibus",
    name: "CARB Omnibus (HD)",
    region: "California, USA",
    application: "Heavy-Duty On-Road",
    status: "active",
    effectiveDate: "2024-01-01",
    limits: { NOx: "0.027 g/bhp-hr", PM: "0.005 g/bhp-hr", CO: "15.5 g/bhp-hr", HC: "0.14 g/bhp-hr" },
    testCycles: ["FTP", "RMC", "LLC", "SET"],
    notes: "Most stringent HD NOₓ standard globally. Includes low-load cycle (LLC)",
  },
];

const STATUS_CONFIG = {
  active: { label: "Active", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: CheckCircle2 },
  upcoming: { label: "Upcoming", color: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: Clock },
  superseded: { label: "Superseded", color: "bg-muted text-muted-foreground border-muted", icon: FileText },
};

export default function CompliancePage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F3652] via-[#1A4F6E] to-[#2D6A8A] p-6 text-white">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5" />
            <Badge className="bg-white/15 text-white border-white/20">Compliance</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Emission Standards & Regulatory Database
          </h1>
          <p className="text-white/60 mt-2 max-w-2xl text-sm">
            Comprehensive database of global emission regulations for automotive, off-highway,
            marine, and stationary engine applications. Used by the CatSizer module for compliance verification.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active Standards", value: STANDARDS.filter((s) => s.status === "active").length.toString(), icon: CheckCircle2, color: "text-emerald-600" },
          { label: "Upcoming", value: STANDARDS.filter((s) => s.status === "upcoming").length.toString(), icon: Clock, color: "text-amber-600" },
          { label: "Regions Covered", value: [...new Set(STANDARDS.map((s) => s.region))].length.toString(), icon: Globe, color: "text-[#1A4F6E]" },
          { label: "Most Stringent NOₓ", value: "0.02 g/bhp-hr", icon: AlertTriangle, color: "text-[#C44536]" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Standards Table */}
      <Card>
        <CardHeader>
          <CardTitle>Global Emission Standards</CardTitle>
          <CardDescription>
            All standards used by CatSizer for aftertreatment sizing and compliance verification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Standard</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Application</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>NOₓ</TableHead>
                  <TableHead>PM</TableHead>
                  <TableHead>CO</TableHead>
                  <TableHead>Test Cycles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {STANDARDS.map((std) => {
                  const statusCfg = STATUS_CONFIG[std.status as keyof typeof STATUS_CONFIG];
                  const StatusIcon = statusCfg.icon;
                  return (
                    <TableRow key={std.id}>
                      <TableCell>
                        <div>
                          <p className="font-semibold text-sm">{std.name}</p>
                          <p className="text-xs text-muted-foreground">Effective: {std.effectiveDate}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{std.region}</TableCell>
                      <TableCell className="text-sm">{std.application}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusCfg.color}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {statusCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{std.limits.NOx}</TableCell>
                      <TableCell className="font-mono text-sm">{std.limits.PM}</TableCell>
                      <TableCell className="font-mono text-sm">{std.limits.CO}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {std.testCycles.map((tc) => (
                            <Badge key={tc} variant="outline" className="text-[10px] px-1.5 py-0">
                              {tc}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <div className="grid gap-4 lg:grid-cols-2">
        {STANDARDS.map((std) => (
          <Card key={std.id} className="border-l-4" style={{ borderLeftColor: std.status === "upcoming" ? "#E6A23C" : "#2A9D8F" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {std.name}
                <Badge variant="outline" className="text-[10px]">{std.region}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{std.notes}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                {Object.entries(std.limits).map(([key, val]) => (
                  <div key={key} className="flex justify-between rounded border px-2 py-1">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="font-mono font-medium">{val}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
