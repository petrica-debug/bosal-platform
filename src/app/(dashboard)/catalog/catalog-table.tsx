"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Package, Car, ArrowRightLeft, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Category = {
  id: string;
  name: string;
  slug: string;
};

type CrossRef = {
  id: string;
  reference_type: string;
  reference_number: string;
  brand: string | null;
};

type Vehicle = {
  id: string;
  year: number;
  make: string;
  model: string;
  engine: string | null;
  trim: string | null;
};

type Fitment = {
  id: string;
  position: string | null;
  verified: boolean;
  vehicles: Vehicle | null;
};

type Part = {
  id: string;
  part_number: string;
  name: string;
  status: string;
  is_direct_fit: boolean;
  is_universal: boolean;
  base_price_cents: number;
  cost_price_cents: number;
  currency: string;
  part_categories: Category | null;
  cross_references: CrossRef[];
  fitments: Fitment[];
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function statusColor(status: string) {
  switch (status) {
    case "active":
      return "default";
    case "discontinued":
      return "destructive";
    case "pending":
      return "secondary";
    default:
      return "outline";
  }
}

function categoryLabel(slug: string) {
  const map: Record<string, string> = {
    "catalytic-converters": "Catalytic Converter",
    mufflers: "Muffler",
    "pipes-accessories": "Pipe / Accessory",
    "mounting-hardware": "Mounting Hardware",
  };
  return map[slug] ?? slug;
}

export function CatalogTable({
  parts,
  categories,
}: {
  parts: Part[];
  categories: Category[];
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);

  const filtered = useMemo(() => {
    return parts.filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        p.part_number.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.cross_references?.some((cr) =>
          cr.reference_number.toLowerCase().includes(q)
        ) ||
        p.fitments?.some((f) => {
          const v = f.vehicles;
          if (!v) return false;
          const vehicleStr =
            `${v.year} ${v.make} ${v.model} ${v.engine ?? ""} ${v.trim ?? ""}`.toLowerCase();
          return vehicleStr.includes(q);
        });

      const matchesCategory =
        categoryFilter === "all" ||
        p.part_categories?.id === categoryFilter;

      const matchesStatus =
        statusFilter === "all" || p.status === statusFilter;

      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "direct" && p.is_direct_fit && !p.is_universal) ||
        (typeFilter === "universal" && p.is_universal);

      return matchesSearch && matchesCategory && matchesStatus && matchesType;
    });
  }, [parts, search, categoryFilter, statusFilter, typeFilter]);

  const hasFilters =
    categoryFilter !== "all" ||
    statusFilter !== "all" ||
    typeFilter !== "all" ||
    search !== "";

  function clearFilters() {
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setTypeFilter("all");
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by part #, name, OEM #, or vehicle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="discontinued">Discontinued</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="direct">Direct Fit</SelectItem>
              <SelectItem value="universal">Universal</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-3 w-3" />
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filtered.length} of {parts.length} parts
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Part #</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[140px]">Category</TableHead>
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead className="w-[90px]">Status</TableHead>
              <TableHead className="w-[100px] text-right">Price</TableHead>
              <TableHead className="w-[60px] text-center">OEM</TableHead>
              <TableHead className="w-[60px] text-center">Fits</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  No parts found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((part) => (
                <TableRow
                  key={part.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedPart(part)}
                >
                  <TableCell className="font-mono font-medium">
                    {part.part_number}
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate">
                    {part.name}
                  </TableCell>
                  <TableCell>
                    {part.part_categories ? (
                      <Badge variant="outline">
                        {categoryLabel(part.part_categories.slug)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {part.is_universal ? (
                      <Badge variant="secondary">Universal</Badge>
                    ) : part.is_direct_fit ? (
                      <Badge variant="default">Direct Fit</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColor(part.status)}>
                      {part.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(part.base_price_cents)}
                  </TableCell>
                  <TableCell className="text-center">
                    {part.cross_references?.length || 0}
                  </TableCell>
                  <TableCell className="text-center">
                    {part.fitments?.length || 0}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!selectedPart}
        onOpenChange={(open) => !open && setSelectedPart(null)}
      >
        {selectedPart && (
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <span className="font-mono text-lg">
                  {selectedPart.part_number}
                </span>
                <Badge variant={statusColor(selectedPart.status)}>
                  {selectedPart.status}
                </Badge>
                {selectedPart.is_universal ? (
                  <Badge variant="secondary">Universal</Badge>
                ) : selectedPart.is_direct_fit ? (
                  <Badge>Direct Fit</Badge>
                ) : null}
              </DialogTitle>
            </DialogHeader>

            <p className="text-muted-foreground">{selectedPart.name}</p>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>List Price</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {formatCurrency(selectedPart.base_price_cents)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Cost Price</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {formatCurrency(selectedPart.cost_price_cents)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="fitments">
              <TabsList className="w-full">
                <TabsTrigger value="fitments" className="flex-1">
                  <Car className="mr-2 h-4 w-4" />
                  Fitments ({selectedPart.fitments?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="crossrefs" className="flex-1">
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  OEM Refs ({selectedPart.cross_references?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="details" className="flex-1">
                  <Package className="mr-2 h-4 w-4" />
                  Details
                </TabsTrigger>
              </TabsList>

              <TabsContent value="fitments" className="mt-4">
                {selectedPart.fitments?.length ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Year</TableHead>
                          <TableHead>Make</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead>Engine</TableHead>
                          <TableHead>Position</TableHead>
                          <TableHead>Verified</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedPart.fitments.map((f) => (
                          <TableRow key={f.id}>
                            <TableCell>{f.vehicles?.year}</TableCell>
                            <TableCell>{f.vehicles?.make}</TableCell>
                            <TableCell>
                              {f.vehicles?.model}
                              {f.vehicles?.trim
                                ? ` ${f.vehicles.trim}`
                                : ""}
                            </TableCell>
                            <TableCell>
                              {f.vehicles?.engine ?? "—"}
                            </TableCell>
                            <TableCell>
                              {f.position ? (
                                <Badge variant="outline">{f.position}</Badge>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell>
                              {f.verified ? (
                                <Badge variant="default">Verified</Badge>
                              ) : (
                                <Badge variant="secondary">Unverified</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="py-8 text-center text-muted-foreground">
                    No fitment data available for this part.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="crossrefs" className="mt-4">
                {selectedPart.cross_references?.length ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Reference #</TableHead>
                          <TableHead>Brand</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedPart.cross_references.map((cr) => (
                          <TableRow key={cr.id}>
                            <TableCell>
                              <Badge variant="outline">
                                {cr.reference_type.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono">
                              {cr.reference_number}
                            </TableCell>
                            <TableCell>{cr.brand ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="py-8 text-center text-muted-foreground">
                    No cross-references available for this part.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="details" className="mt-4">
                <Card>
                  <CardContent className="pt-6">
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Part Number</dt>
                        <dd className="font-mono font-medium">
                          {selectedPart.part_number}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Category</dt>
                        <dd>
                          {selectedPart.part_categories?.name ?? "Uncategorized"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Fit Type</dt>
                        <dd>
                          {selectedPart.is_universal
                            ? "Universal"
                            : selectedPart.is_direct_fit
                              ? "Direct Fit"
                              : "N/A"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Currency</dt>
                        <dd>{selectedPart.currency}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Margin</dt>
                        <dd>
                          {selectedPart.cost_price_cents > 0
                            ? `${(
                                ((selectedPart.base_price_cents -
                                  selectedPart.cost_price_cents) /
                                  selectedPart.base_price_cents) *
                                100
                              ).toFixed(1)}%`
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          Vehicle Coverage
                        </dt>
                        <dd>
                          {selectedPart.fitments?.length || 0} fitment
                          {(selectedPart.fitments?.length || 0) !== 1
                            ? "s"
                            : ""}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
