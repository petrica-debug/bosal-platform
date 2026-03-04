"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TrendingUp,
  Calculator,
  Flame,
  Fuel,
  Clock,
  BarChart3,
  Layers,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

const MONTHLY_CALCS = [
  { month: "Sep", depollution: 12, reformer: 5 },
  { month: "Oct", depollution: 18, reformer: 8 },
  { month: "Nov", depollution: 24, reformer: 11 },
  { month: "Dec", depollution: 15, reformer: 7 },
  { month: "Jan", depollution: 28, reformer: 14 },
  { month: "Feb", depollution: 35, reformer: 18 },
  { month: "Mar", depollution: 42, reformer: 22 },
];

const CATALYST_USAGE = [
  { name: "DOC", value: 38, color: "#1A4F6E" },
  { name: "SCR", value: 32, color: "#2A9D8F" },
  { name: "DPF", value: 18, color: "#C44536" },
  { name: "TWC", value: 8, color: "#E6A23C" },
  { name: "ASC", value: 4, color: "#6A4A8A" },
];

const ENGINE_TYPES = [
  { name: "HD Diesel", value: 45, color: "#1A4F6E" },
  { name: "NG Genset", value: 22, color: "#2A9D8F" },
  { name: "Off-Highway", value: 15, color: "#E6A23C" },
  { name: "Light-Duty", value: 10, color: "#6A4A8A" },
  { name: "Marine", value: 8, color: "#C44536" },
];

const COMPLIANCE_TREND = [
  { month: "Sep", passRate: 78 },
  { month: "Oct", passRate: 82 },
  { month: "Nov", passRate: 85 },
  { month: "Dec", passRate: 83 },
  { month: "Jan", passRate: 88 },
  { month: "Feb", passRate: 91 },
  { month: "Mar", passRate: 94 },
];

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1A4F6E] to-[#2A9D8F] p-6 text-white">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5" />
            <Badge className="bg-white/15 text-white border-white/20">Analytics</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Engineering Analytics</h1>
          <p className="text-white/60 mt-2 max-w-2xl text-sm">
            Track calculation usage, catalyst sizing trends, compliance pass rates,
            and engineering productivity across your organization.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Calculations", value: "247", change: "+18%", icon: Calculator, color: "text-[#1A4F6E]" },
          { label: "Depollution Sizings", value: "172", change: "+22%", icon: Flame, color: "text-[#C44536]" },
          { label: "Reformer Sizings", value: "75", change: "+12%", icon: Fuel, color: "text-[#2A9D8F]" },
          { label: "Avg. Calc Time", value: "0.8s", change: "-15%", icon: Clock, color: "text-[#E6A23C]" },
        ].map(({ label, value, change, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono">{value}</p>
                <div className="flex items-center gap-1">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/20">{change}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#1A4F6E]" /> Monthly Calculations
            </CardTitle>
            <CardDescription>Depollution vs. Reformer calculations per month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={MONTHLY_CALCS}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="depollution" fill="#C44536" radius={[4, 4, 0, 0]} name="Depollution" />
                <Bar dataKey="reformer" fill="#2A9D8F" radius={[4, 4, 0, 0]} name="Reformer" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#2A9D8F]" /> Compliance Pass Rate Trend
            </CardTitle>
            <CardDescription>First-pass compliance rate across all calculations</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={COMPLIANCE_TREND}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis domain={[70, 100]} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Line type="monotone" dataKey="passRate" stroke="#2A9D8F" strokeWidth={2.5} dot={{ r: 4 }} name="Pass Rate %" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#E6A23C]" /> Catalyst Type Distribution
            </CardTitle>
            <CardDescription>Most frequently sized catalyst types</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={220}>
                <PieChart>
                  <Pie data={CATALYST_USAGE} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {CATALYST_USAGE.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {CATALYST_USAGE.map((cat) => (
                  <div key={cat.name} className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm flex-1">{cat.name}</span>
                    <span className="font-mono text-sm font-medium">{cat.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Engine / Application Breakdown</CardTitle>
            <CardDescription>Distribution by engine type and application</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={220}>
                <PieChart>
                  <Pie data={ENGINE_TYPES} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {ENGINE_TYPES.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {ENGINE_TYPES.map((eng) => (
                  <div key={eng.name} className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: eng.color }} />
                    <span className="text-sm flex-1">{eng.name}</span>
                    <span className="font-mono text-sm font-medium">{eng.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Calculations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Calculations</CardTitle>
          <CardDescription>Last 5 engineering calculations performed</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { type: "Depollution", engine: "13L MAN D2676 — Euro VI-E", result: "DOC+DPF+SCR+ASC — Compliant", time: "2 min ago", status: "pass" },
              { type: "Reformer", engine: "Pipeline NG — 50 kW SOFC", result: "SMR S/C=3.0 — 97.2% CH₄ conv.", time: "15 min ago", status: "pass" },
              { type: "Depollution", engine: "6.7L Cummins ISB — EPA T4", result: "DOC+DPF+SCR — NOₓ marginal", time: "1 hr ago", status: "warn" },
              { type: "Depollution", engine: "500 kW NG Genset — TA Luft", result: "TWC — CO compliant, HC marginal", time: "3 hrs ago", status: "warn" },
              { type: "Reformer", engine: "Biogas 60% CH₄ — 25 kW SOFC", result: "ATR O/C=0.4 — Carbon risk LOW", time: "5 hrs ago", status: "pass" },
            ].map((calc, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${calc.type === "Depollution" ? "bg-[#C44536]/10 text-[#C44536]" : "bg-[#2A9D8F]/10 text-[#2A9D8F]"}`}>
                    {calc.type === "Depollution" ? <Flame className="h-4 w-4" /> : <Fuel className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{calc.engine}</p>
                    <p className="text-xs text-muted-foreground">{calc.result}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={calc.status === "pass" ? "text-emerald-600 border-emerald-500/20" : "text-amber-600 border-amber-500/20"}>
                    {calc.status === "pass" ? "Compliant" : "Marginal"}
                  </Badge>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{calc.time}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
