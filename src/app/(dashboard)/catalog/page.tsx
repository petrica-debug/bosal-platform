import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function CatalogPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          Intelligent SKU &amp; Catalog Engine
        </h1>
        <Badge>F-01</Badge>
        <Badge variant="default">P0</Badge>
      </div>
      <p className="text-muted-foreground max-w-2xl">
        Fitment database, supersession chains, cross-references, and
        AI-assisted gap detection for 50,000+ SKUs.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Intelligent SKU &amp; Catalog Engine</CardTitle>
          <CardDescription>
            This module is under active development.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">In Development</p>
            <p className="text-sm">
              This feature is being built in Phase 1 — Foundation.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
