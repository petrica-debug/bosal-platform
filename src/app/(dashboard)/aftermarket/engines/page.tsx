"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Settings2,
  ExternalLink,
  Upload,
  BarChart3,
  ChevronRight,
  Database,
} from "lucide-react";

type Manufacturer =
  | "MAN"
  | "Scania"
  | "Volvo"
  | "Caterpillar"
  | "Cummins"
  | "John Deere"
  | "MTU"
  | "Deutz"
  | "Perkins"
  | "Yanmar";

type FuelType = "diesel" | "natural gas" | "dual fuel" | "biogas";

type EmissionStandard =
  | "Euro 3"
  | "Euro 4"
  | "Euro 5"
  | "Euro 6"
  | "Stage V"
  | "EPA Tier 4"
  | "TA Luft";

type Application = "on-road" | "off-road" | "genset" | "marine";

interface EngineFamily {
  id: string;
  manufacturer: Manufacturer;
  engineCode: string;
  displacementL: number;
  fuelType: FuelType;
  powerMin_kW: number;
  powerMax_kW: number;
  torque_Nm: number;
  emissionStandard: EmissionStandard;
  application: Application;
}

const DEMO_ENGINES: EngineFamily[] = [
  {
    id: "1",
    manufacturer: "MAN",
    engineCode: "D2676",
    displacementL: 12.4,
    fuelType: "diesel",
    powerMin_kW: 324,
    powerMax_kW: 353,
    torque_Nm: 2300,
    emissionStandard: "Euro 6",
    application: "on-road",
  },
  {
    id: "2",
    manufacturer: "Scania",
    engineCode: "DC13",
    displacementL: 12.7,
    fuelType: "diesel",
    powerMin_kW: 331,
    powerMax_kW: 373,
    torque_Nm: 2550,
    emissionStandard: "Euro 6",
    application: "on-road",
  },
  {
    id: "3",
    manufacturer: "Volvo",
    engineCode: "D13K",
    displacementL: 12.8,
    fuelType: "diesel",
    powerMin_kW: 350,
    powerMax_kW: 460,
    torque_Nm: 2700,
    emissionStandard: "Euro 6",
    application: "on-road",
  },
  {
    id: "4",
    manufacturer: "Caterpillar",
    engineCode: "C7.1",
    displacementL: 7.2,
    fuelType: "diesel",
    powerMin_kW: 129,
    powerMax_kW: 250,
    torque_Nm: 1000,
    emissionStandard: "Stage V",
    application: "genset",
  },
  {
    id: "5",
    manufacturer: "Cummins",
    engineCode: "QSB6.7",
    displacementL: 6.7,
    fuelType: "diesel",
    powerMin_kW: 130,
    powerMax_kW: 261,
    torque_Nm: 1000,
    emissionStandard: "EPA Tier 4",
    application: "off-road",
  },
  {
    id: "6",
    manufacturer: "John Deere",
    engineCode: "PowerTech PSS 6.8",
    displacementL: 6.8,
    fuelType: "diesel",
    powerMin_kW: 150,
    powerMax_kW: 235,
    torque_Nm: 1050,
    emissionStandard: "Stage V",
    application: "off-road",
  },
  {
    id: "7",
    manufacturer: "MTU",
    engineCode: "Series 1600",
    displacementL: 16.0,
    fuelType: "diesel",
    powerMin_kW: 520,
    powerMax_kW: 750,
    torque_Nm: 3200,
    emissionStandard: "Stage V",
    application: "marine",
  },
  {
    id: "8",
    manufacturer: "Deutz",
    engineCode: "TCD 3.6",
    displacementL: 3.6,
    fuelType: "diesel",
    powerMin_kW: 74,
    powerMax_kW: 129,
    torque_Nm: 550,
    emissionStandard: "Stage V",
    application: "off-road",
  },
  {
    id: "9",
    manufacturer: "Perkins",
    engineCode: "1206F-E70TA",
    displacementL: 7.0,
    fuelType: "diesel",
    powerMin_kW: 173,
    powerMax_kW: 205,
    torque_Nm: 950,
    emissionStandard: "Stage V",
    application: "genset",
  },
  {
    id: "10",
    manufacturer: "Yanmar",
    engineCode: "4TNV98C",
    displacementL: 3.3,
    fuelType: "diesel",
    powerMin_kW: 55,
    powerMax_kW: 74,
    torque_Nm: 280,
    emissionStandard: "Stage V",
    application: "off-road",
  },
  {
    id: "11",
    manufacturer: "Cummins",
    engineCode: "ISX15 G",
    displacementL: 15.0,
    fuelType: "natural gas",
    powerMin_kW: 350,
    powerMax_kW: 448,
    torque_Nm: 2237,
    emissionStandard: "EPA Tier 4",
    application: "on-road",
  },
  {
    id: "12",
    manufacturer: "Caterpillar",
    engineCode: "D8",
    displacementL: 15.2,
    fuelType: "diesel",
    powerMin_kW: 228,
    powerMax_kW: 261,
    torque_Nm: 1500,
    emissionStandard: "Stage V",
    application: "off-road",
  },
];

const MANUFACTURERS: Manufacturer[] = [
  "MAN",
  "Scania",
  "Volvo",
  "Caterpillar",
  "Cummins",
  "John Deere",
  "MTU",
  "Deutz",
  "Perkins",
  "Yanmar",
];

const FUEL_TYPES: FuelType[] = ["diesel", "natural gas", "dual fuel", "biogas"];

const EMISSION_STANDARDS: EmissionStandard[] = [
  "Euro 3",
  "Euro 4",
  "Euro 5",
  "Euro 6",
  "Stage V",
  "EPA Tier 4",
  "TA Luft",
];

const APPLICATIONS: Application[] = ["on-road", "off-road", "genset", "marine"];

function formatFuelType(t: FuelType): string {
  return t
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatApplication(a: Application): string {
  return a === "on-road"
    ? "On-Road"
    : a === "off-road"
      ? "Off-Road"
      : a.charAt(0).toUpperCase() + a.slice(1);
}

export default function EngineDBPage() {
  const [search, setSearch] = useState("");
  const [manufacturer, setManufacturer] = useState<string>("all");
  const [fuelType, setFuelType] = useState<string>("all");
  const [emission, setEmission] = useState<string>("all");
  const [application, setApplication] = useState<string>("all");
  const [selectedEngine, setSelectedEngine] = useState<EngineFamily | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filteredEngines = useMemo(() => {
    return DEMO_ENGINES.filter((e) => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        e.engineCode.toLowerCase().includes(searchLower) ||
        e.manufacturer.toLowerCase().includes(searchLower);
      const matchesManufacturer =
        manufacturer === "all" || e.manufacturer === manufacturer;
      const matchesFuel = fuelType === "all" || e.fuelType === fuelType;
      const matchesEmission =
        emission === "all" || e.emissionStandard === emission;
      const matchesApplication =
        application === "all" || e.application === application;
      return (
        matchesSearch &&
        matchesManufacturer &&
        matchesFuel &&
        matchesEmission &&
        matchesApplication
      );
    });
  }, [search, manufacturer, fuelType, emission, application]);

  const handleRowClick = (engine: EngineFamily) => {
    setSelectedEngine(engine);
    setSheetOpen(true);
  };

  const handleUseInSizing = () => {
    setSheetOpen(false);
    setSelectedEngine(null);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Engine Family Database</h1>
        <p className="text-sm text-muted-foreground">
          Searchable database of engine families with exhaust flow maps and raw
          emission data. Click a row to view details and use in OEM sizing.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-primary" />
            Engine Families
          </CardTitle>
          <CardDescription>
            Manufacturer, engine code, displacement, fuel type, power range,
            torque, OEM emission standard. Maps: exhaust flow (RPM × load) and
            raw emissions (RPM × load → CO, HC, NOx, PM).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search engine code or manufacturer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={manufacturer} onValueChange={setManufacturer}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Manufacturer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All manufacturers</SelectItem>
                {MANUFACTURERS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fuelType} onValueChange={setFuelType}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Fuel type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All fuel types</SelectItem>
                {FUEL_TYPES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {formatFuelType(f)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={emission} onValueChange={setEmission}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Emission" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All standards</SelectItem>
                {EMISSION_STANDARDS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={application} onValueChange={setApplication}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Application" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All applications</SelectItem>
                {APPLICATIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {formatApplication(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>Engine code</TableHead>
                  <TableHead>Displ. (L)</TableHead>
                  <TableHead>Fuel</TableHead>
                  <TableHead>Power (kW)</TableHead>
                  <TableHead>Torque (Nm)</TableHead>
                  <TableHead>Emission</TableHead>
                  <TableHead>Application</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEngines.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No engines match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEngines.map((engine) => (
                    <TableRow
                      key={engine.id}
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => handleRowClick(engine)}
                    >
                      <TableCell className="font-medium">
                        {engine.manufacturer}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {engine.engineCode}
                      </TableCell>
                      <TableCell>{engine.displacementL}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {formatFuelType(engine.fuelType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {engine.powerMin_kW}–{engine.powerMax_kW}
                      </TableCell>
                      <TableCell>{engine.torque_Nm.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {engine.emissionStandard}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatApplication(engine.application)}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground">
            Showing {filteredEngines.length} of {DEMO_ENGINES.length} engine
            families. Click a row to view details.
          </p>
        </CardContent>
      </Card>

      {/* Engine detail sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          className="sm:max-w-xl overflow-y-auto"
          side="right"
        >
          {selectedEngine && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-primary" />
                  {selectedEngine.manufacturer} {selectedEngine.engineCode}
                </SheetTitle>
                <SheetDescription>
                  Engine family specifications and map placeholders
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Engine specs table */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold">
                    Engine specifications
                  </h3>
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="text-muted-foreground font-medium w-40">
                          Manufacturer
                        </TableCell>
                        <TableCell>{selectedEngine.manufacturer}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-muted-foreground font-medium">
                          Engine code
                        </TableCell>
                        <TableCell className="font-mono">
                          {selectedEngine.engineCode}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-muted-foreground font-medium">
                          Displacement
                        </TableCell>
                        <TableCell>
                          {selectedEngine.displacementL} L
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-muted-foreground font-medium">
                          Fuel type
                        </TableCell>
                        <TableCell>
                          {formatFuelType(selectedEngine.fuelType)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-muted-foreground font-medium">
                          Power range
                        </TableCell>
                        <TableCell>
                          {selectedEngine.powerMin_kW}–{selectedEngine.powerMax_kW} kW
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-muted-foreground font-medium">
                          Torque
                        </TableCell>
                        <TableCell>
                          {selectedEngine.torque_Nm.toLocaleString()} Nm
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-muted-foreground font-medium">
                          OEM emission standard
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {selectedEngine.emissionStandard}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-muted-foreground font-medium">
                          Application
                        </TableCell>
                        <TableCell>
                          {formatApplication(selectedEngine.application)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Exhaust flow map placeholder */}
                <Card className="border-dashed">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      Exhaust flow map (RPM × load → flow, T)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Upload exhaust map CSV to visualize volumetric flow and
                      temperature vs. RPM and load. Expected format: RPM, load
                      (%), flow (m³/h), temperature (°C).
                    </p>
                  </CardContent>
                </Card>

                {/* Raw emissions map placeholder */}
                <Card className="border-dashed">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      Raw emissions map (RPM × load → CO, HC, NOx, PM)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Upload raw emissions map CSV. Expected format: RPM, load
                      (%), CO (g/kWh), HC (g/kWh), NOx (g/kWh), PM (g/kWh).
                    </p>
                  </CardContent>
                </Card>

                {/* Use in OEM Sizing button */}
                <Link href="/catsizer/depollution" onClick={handleUseInSizing}>
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Use in OEM Sizing
                  </Button>
                </Link>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
