"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FlaskConical,
  FolderOpen,
  HardDrive,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

import {
  loadLabData,
  saveLabData,
  type LabDataStore,
} from "@/lib/catsizer/data-provenance";

// ============================================================
// TYPES
// ============================================================

interface LightOffRow {
  temp_C: number;
  CO_in_ppm?: number;
  CO_out_ppm?: number;
  HC_in_ppm?: number;
  HC_out_ppm?: number;
  NOx_in_ppm?: number;
  NOx_out_ppm?: number;
  CO_conv?: number;
  HC_conv?: number;
  NOx_conv?: number;
}

interface ParsedLightOff {
  rows: LightOffRow[];
  T50_CO_C: number;
  T50_HC_C: number;
  T50_NOx_C: number;
  T90_CO_C: number;
  T90_HC_C: number;
  T90_NOx_C: number;
  maxConv_CO_pct: number;
  maxConv_HC_pct: number;
  maxConv_NOx_pct: number;
}

// ============================================================
// CSV PARSING UTILITIES
// ============================================================

function findT(rows: LightOffRow[], convKey: "CO_conv" | "HC_conv" | "NOx_conv", threshold: number): number {
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i][convKey] ?? 0;
    const b = rows[i + 1][convKey] ?? 0;
    if (a < threshold && b >= threshold) {
      const frac = (threshold - a) / (b - a + 1e-10);
      return Math.round(rows[i].temp_C + frac * (rows[i + 1].temp_C - rows[i].temp_C));
    }
  }
  return -1;
}

function parseLightOffCsv(csv: string): ParsedLightOff | { error: string } {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 3) return { error: "File must have a header and at least 2 data rows." };

  const header = lines[0].split(",").map(h => h.trim().toLowerCase());
  const reqd = ["temp_c"];
  for (const c of reqd) {
    if (!header.includes(c)) return { error: `Missing required column: ${c}` };
  }

  const idx = (name: string) => header.indexOf(name);

  const rows: LightOffRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",").map(p => p.trim());
    if (parts.length < 2) continue;
    const row: LightOffRow = { temp_C: parseFloat(parts[idx("temp_c")]) };
    if (idx("co_in_ppm") >= 0)  row.CO_in_ppm  = parseFloat(parts[idx("co_in_ppm")]);
    if (idx("co_out_ppm") >= 0) row.CO_out_ppm = parseFloat(parts[idx("co_out_ppm")]);
    if (idx("hc_in_ppm") >= 0)  row.HC_in_ppm  = parseFloat(parts[idx("hc_in_ppm")]);
    if (idx("hc_out_ppm") >= 0) row.HC_out_ppm = parseFloat(parts[idx("hc_out_ppm")]);
    if (idx("nox_in_ppm") >= 0)  row.NOx_in_ppm  = parseFloat(parts[idx("nox_in_ppm")]);
    if (idx("nox_out_ppm") >= 0) row.NOx_out_ppm = parseFloat(parts[idx("nox_out_ppm")]);
    // Pre-computed conversion columns
    if (idx("co_conv") >= 0)  row.CO_conv  = parseFloat(parts[idx("co_conv")]);
    if (idx("hc_conv") >= 0)  row.HC_conv  = parseFloat(parts[idx("hc_conv")]);
    if (idx("nox_conv") >= 0) row.NOx_conv = parseFloat(parts[idx("nox_conv")]);

    // Calculate from in/out if not provided
    if (row.CO_conv === undefined && row.CO_in_ppm && row.CO_out_ppm) {
      row.CO_conv = Math.max(0, Math.min(100, (1 - row.CO_out_ppm / row.CO_in_ppm) * 100));
    }
    if (row.HC_conv === undefined && row.HC_in_ppm && row.HC_out_ppm) {
      row.HC_conv = Math.max(0, Math.min(100, (1 - row.HC_out_ppm / row.HC_in_ppm) * 100));
    }
    if (row.NOx_conv === undefined && row.NOx_in_ppm && row.NOx_out_ppm) {
      row.NOx_conv = Math.max(0, Math.min(100, (1 - row.NOx_out_ppm / row.NOx_in_ppm) * 100));
    }

    if (!isNaN(row.temp_C)) rows.push(row);
  }

  if (rows.length < 2) return { error: "No valid data rows found." };

  rows.sort((a, b) => a.temp_C - b.temp_C);

  const maxCO  = Math.max(...rows.map(r => r.CO_conv  ?? 0));
  const maxHC  = Math.max(...rows.map(r => r.HC_conv  ?? 0));
  const maxNOx = Math.max(...rows.map(r => r.NOx_conv ?? 0));

  return {
    rows,
    T50_CO_C:  findT(rows, "CO_conv",  50),
    T50_HC_C:  findT(rows, "HC_conv",  50),
    T50_NOx_C: findT(rows, "NOx_conv", 50),
    T90_CO_C:  findT(rows, "CO_conv",  90),
    T90_HC_C:  findT(rows, "HC_conv",  90),
    T90_NOx_C: findT(rows, "NOx_conv", 90),
    maxConv_CO_pct:  maxCO,
    maxConv_HC_pct:  maxHC,
    maxConv_NOx_pct: maxNOx,
  };
}

// ============================================================
// SECTION A — LIGHT-OFF TEST UPLOAD
// ============================================================

function SectionLightOff({ store, onSaved }: { store: LabDataStore; onSaved: (s: LabDataStore) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedLightOff | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [washcoatType, setWashcoatType] = useState("ceria");
  const [agingHours, setAgingHours] = useState(160);
  const [notes, setNotes] = useState("");

  const existingKeys = useMemo(
    () => Object.keys(store.lightOff ?? {}),
    [store.lightOff]
  );

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const csv = ev.target?.result as string;
      const result = parseLightOffCsv(csv);
      if ("error" in result) {
        setParseError(result.error);
        setParsed(null);
      } else {
        setParseError(null);
        setParsed(result);
      }
    };
    reader.readAsText(file);
  }

  function handleSave() {
    if (!parsed) return;
    const key = `${washcoatType}|${agingHours}`;
    const updated: LabDataStore = {
      ...store,
      lightOff: {
        ...store.lightOff,
        [key]: {
          T50_CO_C:  parsed.T50_CO_C,
          T50_HC_C:  parsed.T50_HC_C,
          T50_NOx_C: parsed.T50_NOx_C,
          T90_CO_C:  parsed.T90_CO_C,
          T90_HC_C:  parsed.T90_HC_C,
          T90_NOx_C: parsed.T90_NOx_C,
          maxConv_CO_pct:  parsed.maxConv_CO_pct,
          maxConv_HC_pct:  parsed.maxConv_HC_pct,
          maxConv_NOx_pct: parsed.maxConv_NOx_pct,
          uploadedAt: new Date().toISOString().slice(0, 10),
          notes,
        },
      },
    };
    saveLabData(updated);
    onSaved(updated);
    toast.success(`Light-off data saved for ${washcoatType} @ ${agingHours} h`);
    setParsed(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleDelete(key: string) {
    const updated = { ...store, lightOff: { ...store.lightOff } };
    delete updated.lightOff![key];
    saveLabData(updated);
    onSaved(updated);
    toast.success("Entry deleted");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-sm text-blue-700 dark:text-blue-300">
        <p className="font-semibold mb-1">Expected CSV format</p>
        <code className="text-xs block bg-blue-100 dark:bg-blue-900/40 rounded p-2">
          temp_C,CO_in_ppm,CO_out_ppm,HC_in_ppm,HC_out_ppm,NOx_in_ppm,NOx_out_ppm<br/>
          100,5000,4950,500,498,800,798<br/>
          150,5000,4800,500,490,800,790<br/>
          200,5000,3500,500,450,800,750<br/>
          ...<br/>
        </code>
        <p className="text-xs mt-2 opacity-80">Alternatively: include pre-calculated <code>co_conv</code>, <code>hc_conv</code>, <code>nox_conv</code> columns (% conversion 0–100).</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Washcoat type</Label>
          <Select value={washcoatType} onValueChange={setWashcoatType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ceria">Ceria (TWC)</SelectItem>
              <SelectItem value="oxidation">Oxidation (DOC)</SelectItem>
              <SelectItem value="alumina">Alumina</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Aging hours</Label>
          <Select value={String(agingHours)} onValueChange={v => setAgingHours(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[0, 50, 100, 160, 200, 300, 500].map(h => (
                <SelectItem key={h} value={String(h)}>{h === 0 ? "Fresh (0h)" : `${h} h`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Input placeholder="e.g. Bosal bench 2024-03, 2% H₂O" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <UploadCloud className="size-4 mr-2" /> Upload CSV
        </Button>
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
        {parsed && (
          <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <HardDrive className="size-4 mr-2" /> Save to Lab Store
          </Button>
        )}
      </div>

      {parseError && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="size-4" /> {parseError}
        </div>
      )}

      {parsed && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[
              { sp: "CO",  t50: parsed.T50_CO_C,  t90: parsed.T90_CO_C,  max: parsed.maxConv_CO_pct  },
              { sp: "HC",  t50: parsed.T50_HC_C,  t90: parsed.T90_HC_C,  max: parsed.maxConv_HC_pct  },
              { sp: "NOx", t50: parsed.T50_NOx_C, t90: parsed.T90_NOx_C, max: parsed.maxConv_NOx_pct },
            ].map(r => (
              <div key={r.sp} className="rounded-lg border p-3 space-y-1 text-sm">
                <p className="font-semibold text-xs text-muted-foreground">{r.sp}</p>
                <p>T50: <span className="font-mono font-semibold">{r.t50 > 0 ? `${r.t50}°C` : "—"}</span></p>
                <p>T90: <span className="font-mono font-semibold">{r.t90 > 0 ? `${r.t90}°C` : "—"}</span></p>
                <p>Max: <span className="font-mono font-semibold">{r.max.toFixed(1)}%</span></p>
              </div>
            ))}
          </div>

          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={parsed.rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="temp_C" label={{ value: "Temp (°C)", position: "insideBottomRight", offset: -8, fontSize: 10 }} tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} label={{ value: "Conv (%)", angle: -90, position: "insideLeft", fontSize: 10 }} tick={{ fontSize: 10 }} />
                <RechartTooltip formatter={(v: number) => `${v.toFixed(1)}%`} labelFormatter={(l: number) => `${l}°C`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="CO_conv"  name="CO"  stroke="#ef4444" dot={false} strokeWidth={1.5} connectNulls />
                <Line type="monotone" dataKey="HC_conv"  name="HC"  stroke="#f59e0b" dot={false} strokeWidth={1.5} connectNulls />
                <Line type="monotone" dataKey="NOx_conv" name="NOx" stroke="#3b82f6" dot={false} strokeWidth={1.5} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {existingKeys.length > 0 && (
        <div className="space-y-2">
          <Separator />
          <p className="text-sm font-medium">Saved light-off datasets</p>
          <div className="space-y-2">
            {existingKeys.map(key => {
              const entry = store.lightOff![key];
              const [wc, ah] = key.split("|");
              return (
                <div key={key} className="flex items-start justify-between rounded-lg border p-3 text-sm gap-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-xs">Measured</Badge>
                      <span className="font-semibold capitalize">{wc} @ {ah} h</span>
                      <span className="text-muted-foreground text-xs">{entry.uploadedAt}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      CO: T50={entry.T50_CO_C}°C T90={entry.T90_CO_C}°C |
                      HC: T50={entry.T50_HC_C}°C |
                      NOx: T50={entry.T50_NOx_C}°C
                    </p>
                    {entry.notes && <p className="text-xs text-muted-foreground italic">{entry.notes}</p>}
                  </div>
                  <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 shrink-0" onClick={() => handleDelete(key)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SECTION B — SUBSTRATE DATASHEET
// ============================================================

function SectionSubstrate({ store, onSaved }: { store: LabDataStore; onSaved: (s: LabDataStore) => void }) {
  const [form, setForm] = useState({
    partNumber: "",
    diameter_mm: 118,
    length_mm: 130,
    cpsi: 400,
    wallThickness_mil: 4,
    OFA_pct: 76.5,
    GSA_m2_L: 2.8,
    material: "Cordierite",
    supplier: "",
  });

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (!form.partNumber.trim()) {
      toast.error("Enter a part number");
      return;
    }
    const updated: LabDataStore = {
      ...store,
      substrate: {
        ...store.substrate,
        [form.partNumber]: {
          ...form,
          uploadedAt: new Date().toISOString().slice(0, 10),
        },
      },
    };
    saveLabData(updated);
    onSaved(updated);
    toast.success(`Substrate ${form.partNumber} saved`);
  }

  function handleDelete(key: string) {
    const updated = { ...store, substrate: { ...store.substrate } };
    delete updated.substrate![key];
    saveLabData(updated);
    onSaved(updated);
    toast.success("Entry deleted");
  }

  const existingKeys = Object.keys(store.substrate ?? {});

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-4 space-y-1.5">
          <Label>Part Number <span className="text-red-500">*</span></Label>
          <Input placeholder="e.g. NGK-400/66-152" value={form.partNumber} onChange={e => set("partNumber", e.target.value)} />
        </div>
        {[
          { label: "Diameter (mm)", key: "diameter_mm" as const, step: 1 },
          { label: "Length (mm)",   key: "length_mm"   as const, step: 1 },
          { label: "CPSI",          key: "cpsi"         as const, step: 100 },
          { label: "Wall (mil)",    key: "wallThickness_mil" as const, step: 1 },
          { label: "OFA (%)",       key: "OFA_pct"      as const, step: 0.1 },
          { label: "GSA (m²/L)",    key: "GSA_m2_L"     as const, step: 0.1 },
        ].map(({ label, key, step }) => (
          <div key={key} className="space-y-1.5">
            <Label>{label}</Label>
            <Input type="number" step={step} value={form[key] as number}
              onChange={e => set(key, parseFloat(e.target.value) || 0)} />
          </div>
        ))}
        <div className="space-y-1.5">
          <Label>Material</Label>
          <Select value={form.material} onValueChange={v => set("material", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Cordierite", "Mullite", "SiC", "Metal foil"].map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Supplier</Label>
          <Input placeholder="e.g. NGK, Corning, Denso" value={form.supplier} onChange={e => set("supplier", e.target.value)} />
        </div>
      </div>
      <Button onClick={handleSave}>
        <HardDrive className="size-4 mr-2" /> Save Substrate
      </Button>

      {existingKeys.length > 0 && (
        <div className="space-y-2">
          <Separator />
          <p className="text-sm font-medium">Saved substrates</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part #</TableHead>
                <TableHead>Dims (mm)</TableHead>
                <TableHead>CPSI / Wall</TableHead>
                <TableHead>GSA</TableHead>
                <TableHead>Material</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {existingKeys.map(key => {
                const e = store.substrate![key];
                return (
                  <TableRow key={key}>
                    <TableCell className="font-mono text-xs">{key}</TableCell>
                    <TableCell className="font-mono text-xs">⌀{e.diameter_mm}×{e.length_mm}</TableCell>
                    <TableCell className="font-mono text-xs">{e.cpsi} / {e.wallThickness_mil} mil</TableCell>
                    <TableCell className="font-mono text-xs">{e.GSA_m2_L} m²/L</TableCell>
                    <TableCell className="text-xs">{e.material}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(key)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SECTION C — CHASSIS DYNO RESULTS
// ============================================================

function SectionChassisDyno({ store, onSaved }: { store: LabDataStore; onSaved: (s: LabDataStore) => void }) {
  const [form, setForm] = useState({
    partNumber: "",
    agingProtocol: "BOSAL-160h",
    freshDate: "",
    agedDate: "",
    freshCO_g_km:  0.5,
    agedCO_g_km:   0.65,
    freshHC_g_km:  0.06,
    agedHC_g_km:   0.075,
    freshNOx_g_km: 0.08,
    agedNOx_g_km:  0.095,
    notes: "",
  });

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  const dfCO  = form.freshCO_g_km  > 0 ? form.agedCO_g_km  / form.freshCO_g_km  : 0;
  const dfHC  = form.freshHC_g_km  > 0 ? form.agedHC_g_km  / form.freshHC_g_km  : 0;
  const dfNOx = form.freshNOx_g_km > 0 ? form.agedNOx_g_km / form.freshNOx_g_km : 0;

  function handleSave() {
    if (!form.partNumber.trim()) {
      toast.error("Enter a part number");
      return;
    }
    const key = `${form.partNumber}|${form.agingProtocol}`;
    const updated: LabDataStore = {
      ...store,
      chassisDyno: {
        ...store.chassisDyno,
        [key]: {
          ...form,
          DF_CO: dfCO,
          DF_HC: dfHC,
          DF_NOx: dfNOx,
          uploadedAt: new Date().toISOString().slice(0, 10),
        },
      },
    };
    saveLabData(updated);
    onSaved(updated);
    toast.success(`Chassis dyno data saved for ${form.partNumber}`);
  }

  function handleDelete(key: string) {
    const updated = { ...store, chassisDyno: { ...store.chassisDyno } };
    delete updated.chassisDyno![key];
    saveLabData(updated);
    onSaved(updated);
    toast.success("Entry deleted");
  }

  const existingKeys = Object.keys(store.chassisDyno ?? {});

  const DF_OEM_REF = { CO: 1.35, HC: 1.25, NOx: 1.20 };
  const r103Limit = { CO: 1.15 * DF_OEM_REF.CO, HC: 1.15 * DF_OEM_REF.HC, NOx: 1.15 * DF_OEM_REF.NOx };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2 space-y-1.5">
          <Label>Part Number <span className="text-red-500">*</span></Label>
          <Input placeholder="e.g. BAM-123456" value={form.partNumber} onChange={e => set("partNumber", e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Aging protocol</Label>
          <Select value={form.agingProtocol} onValueChange={v => set("agingProtocol", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["BOSAL-160h", "BOSAL-100h", "AMA-80h", "R103-SBC", "Customer-specific"].map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Fresh test date</Label>
          <Input type="date" value={form.freshDate} onChange={e => set("freshDate", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Aged test date</Label>
          <Input type="date" value={form.agedDate} onChange={e => set("agedDate", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(["CO", "HC", "NOx"] as const).map(sp => (
          <div key={sp} className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">{sp}</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Fresh (g/km)</Label>
              <Input type="number" step={0.001} value={(form as Record<string, number | string>)[`fresh${sp}_g_km`]}
                onChange={e => set(`fresh${sp}_g_km` as keyof typeof form, parseFloat(e.target.value) || 0 as never)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Aged (g/km)</Label>
              <Input type="number" step={0.001} value={(form as Record<string, number | string>)[`aged${sp}_g_km`]}
                onChange={e => set(`aged${sp}_g_km` as keyof typeof form, parseFloat(e.target.value) || 0 as never)} />
            </div>
          </div>
        ))}
      </div>

      {/* Live DF preview */}
      <div className="rounded-lg bg-muted/40 border p-3">
        <p className="text-xs font-semibold mb-2">Calculated Deterioration Factors</p>
        <div className="grid grid-cols-3 gap-2 text-sm">
          {[
            { sp: "CO",  df: dfCO,  limit: r103Limit.CO  },
            { sp: "HC",  df: dfHC,  limit: r103Limit.HC  },
            { sp: "NOx", df: dfNOx, limit: r103Limit.NOx },
          ].map(r => (
            <div key={r.sp} className={`rounded border p-2 ${r.df <= r.limit && r.df > 0 ? "border-green-300 bg-green-50 dark:bg-green-950/20" : r.df > 0 ? "border-red-300 bg-red-50 dark:bg-red-950/20" : ""}`}>
              <p className="text-xs text-muted-foreground">{r.sp}</p>
              <p className="font-mono font-semibold text-base">{r.df > 0 ? r.df.toFixed(3) : "—"}</p>
              <p className="text-xs text-muted-foreground">≤ {r.limit.toFixed(2)}</p>
              {r.df > 0 && (
                <Badge variant="outline" className={`mt-1 text-xs ${r.df <= r.limit ? "text-green-700 border-green-300" : "text-red-700 border-red-300"}`}>
                  {r.df <= r.limit ? "PASS" : "FAIL"}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Input placeholder="e.g. Engine J14A, 3 WLTP hot runs averaged" value={form.notes} onChange={e => set("notes", e.target.value)} />
      </div>

      <Button onClick={handleSave}>
        <HardDrive className="size-4 mr-2" /> Save Chassis Dyno Results
      </Button>

      {existingKeys.length > 0 && (
        <div className="space-y-2">
          <Separator />
          <p className="text-sm font-medium">Saved chassis dyno results</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part # / Protocol</TableHead>
                <TableHead className="text-right">DF CO</TableHead>
                <TableHead className="text-right">DF HC</TableHead>
                <TableHead className="text-right">DF NOx</TableHead>
                <TableHead>Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {existingKeys.map(key => {
                const e = store.chassisDyno![key];
                const passAll = e.DF_CO <= r103Limit.CO && e.DF_HC <= r103Limit.HC && e.DF_NOx <= r103Limit.NOx;
                return (
                  <TableRow key={key}>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1.5">
                        {passAll
                          ? <CheckCircle2 className="size-3.5 text-green-500" />
                          : <AlertCircle className="size-3.5 text-red-500" />}
                        <span className="font-mono">{e.partNumber}</span>
                        <span className="text-muted-foreground">/ {e.agingProtocol}</span>
                      </div>
                    </TableCell>
                    <TableCell className={`text-right font-mono text-xs ${e.DF_CO <= r103Limit.CO ? "text-green-600" : "text-red-600"}`}>{e.DF_CO.toFixed(3)}</TableCell>
                    <TableCell className={`text-right font-mono text-xs ${e.DF_HC <= r103Limit.HC ? "text-green-600" : "text-red-600"}`}>{e.DF_HC.toFixed(3)}</TableCell>
                    <TableCell className={`text-right font-mono text-xs ${e.DF_NOx <= r103Limit.NOx ? "text-green-600" : "text-red-600"}`}>{e.DF_NOx.toFixed(3)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.agedDate || e.uploadedAt}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(key)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function LabDataPage() {
  const [store, setStore] = useState<LabDataStore>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setStore(loadLabData());
    setIsLoaded(true);
  }, []);

  const handleSaved = useCallback((updated: LabDataStore) => {
    setStore(updated);
  }, []);

  const totalEntries =
    Object.keys(store.lightOff ?? {}).length +
    Object.keys(store.substrate ?? {}).length +
    Object.keys(store.chassisDyno ?? {}).length;

  const tabData = [
    { value: "lightoff",   label: "Light-off Tests",    icon: FlaskConical, count: Object.keys(store.lightOff ?? {}).length },
    { value: "substrate",  label: "Substrate Datasheets", icon: FolderOpen,  count: Object.keys(store.substrate ?? {}).length },
    { value: "chassis",    label: "Chassis Dyno / DF",  icon: ChevronRight, count: Object.keys(store.chassisDyno ?? {}).length },
  ];

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin size-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <FlaskConical className="size-6 text-[#C8102E]" />
          <h1 className="text-2xl font-bold">Lab Data</h1>
          {totalEntries > 0 && (
            <Badge variant="secondary" className="text-xs">{totalEntries} dataset{totalEntries !== 1 ? "s" : ""} stored</Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm max-w-2xl">
          Upload real test data to calibrate the digital twin. Measured data overrides model estimates in
          the AM Product Development wizard — upgrading every number from{" "}
          <span className="text-amber-600 dark:text-amber-400 font-medium">Estimated</span> to{" "}
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Measured</span>.
          All data is stored locally in your browser.
        </p>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-700 dark:text-amber-300">
        <p className="font-semibold mb-1">Why this matters for R103 homologation</p>
        <p>
          The DF values computed by the model carry a ±20% uncertainty. For a catalyst near the R103 limit
          (DF ≤ 1.55 CO, ≤ 1.44 HC, ≤ 1.38 NOx), this uncertainty can be the difference between a PASS and
          a FAIL on the actual type-approval test. Upload chassis dyno results to replace the model estimate
          with a measured DF, and upload a light-off test to replace the estimated T50 with a measured value.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="lightoff">
        <TabsList className="w-full sm:w-auto">
          {tabData.map(t => (
            <TabsTrigger key={t.value} value={t.value} className="flex items-center gap-1.5">
              <t.icon className="size-3.5" />
              {t.label}
              {t.count > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">{t.count}</Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="lightoff" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FlaskConical className="size-4 text-[#C8102E]" />
                Light-off Test Data
              </CardTitle>
              <CardDescription>
                Upload a CSV from a bench light-off measurement.
                T50 and T90 per species will be extracted and used to calibrate the
                TWC lambda model in the WLTP simulation (Step 5 of the wizard).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SectionLightOff store={store} onSaved={handleSaved} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="substrate" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FolderOpen className="size-4 text-[#C8102E]" />
                Substrate Datasheet Entry
              </CardTitle>
              <CardDescription>
                Enter physical properties from a substrate supplier datasheet.
                Once saved, these replace estimated values in Step 3 (System Brief)
                of the wizard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SectionSubstrate store={store} onSaved={handleSaved} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chassis" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="size-4 text-[#C8102E]" />
                Chassis Dyno Results (DF Measurement)
              </CardTitle>
              <CardDescription>
                Enter fresh and aged emission results from chassis dyno tests.
                The calculated DF per species is compared against R103 limits and shown
                alongside the model prediction in Step 5.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SectionChassisDyno store={store} onSaved={handleSaved} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
