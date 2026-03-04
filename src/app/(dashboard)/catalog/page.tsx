import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { CatalogTable } from "./catalog-table";

export default async function CatalogPage() {
  const supabase = await createClient();

  const [partsRes, categoriesRes] = await Promise.all([
    supabase
      .from("parts")
      .select(
        `
        *,
        part_categories ( id, name, slug ),
        cross_references ( id, reference_type, reference_number, brand ),
        fitments ( id, position, verified, vehicles ( id, year, make, model, engine, trim ) )
      `
      )
      .is("deleted_at", null)
      .order("part_number", { ascending: true }),
    supabase
      .from("part_categories")
      .select("id, name, slug")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
  ]);

  const parts = partsRes.data ?? [];
  const categories = categoriesRes.data ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            Bosal Catalog
          </h1>
          <Badge>F-01</Badge>
          <Badge variant="secondary">{parts.length} parts</Badge>
        </div>
      </div>
      <p className="text-muted-foreground max-w-2xl">
        Real Bosal exhaust catalog with fitment data, OEM cross-references,
        and supersession chains across Volkswagen, Audi, Porsche, and
        Mercedes-Benz platforms.
      </p>
      <CatalogTable parts={parts} categories={categories} />
    </div>
  );
}
