"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Upload,
  Search,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  FileUp,
} from "lucide-react";

interface RFQItem {
  id: string;
  customer: string;
  title: string;
  status: "draft" | "parsing" | "review" | "responded" | "won" | "lost";
  receivedDate: string;
  dueDate: string;
  engineType?: string;
  emissionStandard?: string;
  catalystTypes?: string[];
  estimatedValue?: number;
}

const DEMO_RFQS: RFQItem[] = [
  {
    id: "RFQ-2026-001",
    customer: "MAN Truck & Bus",
    title: "Euro VI-E SCR system for D2676 engine",
    status: "review",
    receivedDate: "2026-02-28",
    dueDate: "2026-03-15",
    engineType: "12.4L diesel",
    emissionStandard: "Euro VI-E",
    catalystTypes: ["DOC", "DPF", "SCR", "ASC"],
    estimatedValue: 45000,
  },
  {
    id: "RFQ-2026-002",
    customer: "Caterpillar",
    title: "Stage V aftertreatment for C7.1 genset",
    status: "responded",
    receivedDate: "2026-02-15",
    dueDate: "2026-03-01",
    engineType: "7.1L diesel",
    emissionStandard: "EU Stage V",
    catalystTypes: ["DOC", "DPF", "SCR"],
    estimatedValue: 28000,
  },
  {
    id: "RFQ-2026-003",
    customer: "Bloom Energy",
    title: "SMR catalyst bed for 250kW SOFC system",
    status: "draft",
    receivedDate: "2026-03-02",
    dueDate: "2026-03-20",
    engineType: "CH₄ reformer",
    emissionStandard: "N/A",
    catalystTypes: ["SMR", "WGS"],
    estimatedValue: 18000,
  },
];

const STATUS_CONFIG: Record<RFQItem["status"], { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: "Draft", color: "bg-gray-500", icon: FileText },
  parsing: { label: "AI Parsing", color: "bg-blue-500", icon: Search },
  review: { label: "Under Review", color: "bg-amber-500", icon: Clock },
  responded: { label: "Responded", color: "bg-green-500", icon: CheckCircle },
  won: { label: "Won", color: "bg-emerald-600", icon: CheckCircle },
  lost: { label: "Lost", color: "bg-red-500", icon: AlertCircle },
};

export default function RFQPage() {
  const [rfqs] = useState<RFQItem[]>(DEMO_RFQS);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    // Future: handle file upload
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">RFQ Manager</h1>
          <p className="text-sm text-muted-foreground">
            Upload RFQ documents, auto-extract specs with AI, manage responses
          </p>
        </div>
        <Button className="bg-[#C8102E] hover:bg-[#A00D24]">
          <Plus className="mr-2 h-4 w-4" /> New RFQ
        </Button>
      </div>

      {/* Upload Zone */}
      <Card
        className={`border-2 border-dashed transition-colors ${dragActive ? "border-[#C8102E] bg-[#C8102E]/5" : "border-muted"}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-muted p-4 mb-4">
            <FileUp className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium mb-1">Drop RFQ documents here</p>
          <p className="text-xs text-muted-foreground mb-4">
            PDF, DOCX, or XLSX — AI will extract engine specs, emission standards, and catalyst requirements
          </p>
          <Button variant="outline" size="sm">
            <Upload className="mr-2 h-4 w-4" /> Browse Files
          </Button>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active RFQs</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{rfqs.filter((r) => r.status === "review" || r.status === "draft").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Responded</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{rfqs.filter((r) => r.status === "responded").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pipeline Value</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              &euro;{rfqs.reduce((s, r) => s + (r.estimatedValue ?? 0), 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Win Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">67%</p>
          </CardContent>
        </Card>
      </div>

      {/* RFQ Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent RFQs</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search RFQs..." className="pl-8 w-64" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RFQ ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Engine</TableHead>
                  <TableHead>Standard</TableHead>
                  <TableHead>Catalysts</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rfqs.map((rfq) => {
                  const statusCfg = STATUS_CONFIG[rfq.status];
                  return (
                    <TableRow key={rfq.id}>
                      <TableCell className="font-mono text-xs">{rfq.id}</TableCell>
                      <TableCell className="font-medium">{rfq.customer}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">{rfq.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.color}`} />
                          {statusCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{rfq.engineType}</TableCell>
                      <TableCell className="text-xs">{rfq.emissionStandard}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {rfq.catalystTypes?.map((ct) => (
                            <Badge key={ct} variant="secondary" className="text-[10px] px-1">
                              {ct}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{rfq.dueDate}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {rfq.estimatedValue ? `€${rfq.estimatedValue.toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
