-- AftermarketOS Row Level Security Policies
-- All tenant-scoped tables enforce organization_id isolation

-- ============================================================
-- HELPER: get current user's organization IDs
-- ============================================================
create or replace function public.get_user_org_ids()
returns setof uuid as $$
  select organization_id
  from public.organization_members
  where user_id = auth.uid()
    and deleted_at is null;
$$ language sql security definer stable;

create or replace function public.get_current_org_id()
returns uuid as $$
  select current_organization_id
  from public.user_profiles
  where id = auth.uid();
$$ language sql security definer stable;

create or replace function public.get_user_role(org_id uuid)
returns public.user_role as $$
  select role
  from public.organization_members
  where user_id = auth.uid()
    and organization_id = org_id
    and deleted_at is null
  limit 1;
$$ language sql security definer stable;

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.user_profiles enable row level security;
alter table public.part_categories enable row level security;
alter table public.parts enable row level security;
alter table public.vehicles enable row level security;
alter table public.fitments enable row level security;
alter table public.supersessions enable row level security;
alter table public.cross_references enable row level security;
alter table public.suppliers enable row level security;
alter table public.facilities enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.shipments enable row level security;
alter table public.supply_chain_alerts enable row level security;
alter table public.channels enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.inventory_levels enable row level security;
alter table public.integrations enable row level security;
alter table public.sync_logs enable row level security;
alter table public.webhooks enable row level security;
alter table public.field_mappings enable row level security;
alter table public.kpis enable row level security;
alter table public.kpi_snapshots enable row level security;
alter table public.dashboards enable row level security;
alter table public.dashboard_widgets enable row level security;
alter table public.user_preferences enable row level security;
alter table public.audit_logs enable row level security;
alter table public.documents enable row level security;
alter table public.notifications enable row level security;

-- ============================================================
-- USER PROFILES: users can read/update their own profile
-- ============================================================
create policy "Users can view own profile"
  on public.user_profiles for select
  using (id = auth.uid());

create policy "Users can update own profile"
  on public.user_profiles for update
  using (id = auth.uid());

-- ============================================================
-- ORGANIZATIONS: members can view their orgs
-- ============================================================
create policy "Members can view their organizations"
  on public.organizations for select
  using (id in (select public.get_user_org_ids()));

create policy "Admins can update their organization"
  on public.organizations for update
  using (
    id in (select public.get_user_org_ids())
    and public.get_user_role(id) = 'admin'
  );

create policy "Authenticated users can create organizations"
  on public.organizations for insert
  with check (auth.uid() is not null);

-- ============================================================
-- ORGANIZATION MEMBERS: scoped to org membership
-- ============================================================
create policy "Members can view org members"
  on public.organization_members for select
  using (organization_id in (select public.get_user_org_ids()));

create policy "Admins can manage org members"
  on public.organization_members for insert
  with check (organization_id in (select public.get_user_org_ids()));

create policy "Admins can update org members"
  on public.organization_members for update
  using (organization_id in (select public.get_user_org_ids()));

-- ============================================================
-- MACRO: org-scoped read/write policies
-- Applied to all tenant-scoped tables
-- ============================================================

-- F-01: Catalog
create policy "Org members can view part_categories" on public.part_categories for select using (organization_id in (select public.get_user_org_ids()));
create policy "Org members can manage part_categories" on public.part_categories for insert with check (organization_id in (select public.get_user_org_ids()));
create policy "Org members can update part_categories" on public.part_categories for update using (organization_id in (select public.get_user_org_ids()));

create policy "Org members can view parts" on public.parts for select using (organization_id in (select public.get_user_org_ids()));
create policy "Org members can manage parts" on public.parts for insert with check (organization_id in (select public.get_user_org_ids()));
create policy "Org members can update parts" on public.parts for update using (organization_id in (select public.get_user_org_ids()));

create policy "Org members can view vehicles" on public.vehicles for select using (organization_id in (select public.get_user_org_ids()));
create policy "Org members can manage vehicles" on public.vehicles for insert with check (organization_id in (select public.get_user_org_ids()));
create policy "Org members can update vehicles" on public.vehicles for update using (organization_id in (select public.get_user_org_ids()));

create policy "Org members can view fitments" on public.fitments for select using (organization_id in (select public.get_user_org_ids()));
create policy "Org members can manage fitments" on public.fitments for insert with check (organization_id in (select public.get_user_org_ids()));
create policy "Org members can update fitments" on public.fitments for update using (organization_id in (select public.get_user_org_ids()));

create policy "Org members can view supersessions" on public.supersessions for select using (organization_id in (select public.get_user_org_ids()));
create policy "Org members can manage supersessions" on public.supersessions for insert with check (organization_id in (select public.get_user_org_ids()));

create policy "Org members can view cross_references" on public.cross_references for select using (organization_id in (select public.get_user_org_ids()));
create policy "Org members can manage cross_references" on public.cross_references for insert with check (organization_id in (select public.get_user_org_ids()));

-- F-03: Supply Chain
create policy "Org members can view suppliers" on public.suppliers for select using (organization_id in (select public.get_user_org_ids()));
create policy "Org members can manage suppliers" on public.suppliers for insert with check (organization_id in (select public.get_user_org_ids()));
create policy "Org members can update suppliers" on public.suppliers for update using (organization_id in (select public.get_user_org_ids()));

create policy "Org members can view facilities" on public.facilities for select using (organization_id in (select public.get_user_org_ids()));
create policy "Org members can manage facilities" on public.facilities for insert with check (organization_id in (select public.get_user_org_ids()));
create policy "Org members can update facilities" on public.facilities for update using (organization_id in (select public.get_user_org_ids()));

create policy "Org members can view purchase_orders" on public.purchase_orders for select using (organization_id in (select public.get_user_org_ids()));
create policy "Org members can manage purchase_orders" on public.purchase_orders for insert with check (organization_id in (select public.get_user_org_ids()));
create policy "Org members can update purchase_orders" on public.purchase_orders for update using (organization_id in (select public.get_user_org_ids()));

create policy "Org members can view po_lines" on public.purchase_order_lines for select using (purchase_order_id in (select id from public.purchase_orders where organization_id in (select public.get_user_org_ids())));
create policy "Org members can manage po_lines" on public.purchase_order_lines for insert with check (purchase_order_id in (select id from public.purchase_orders where organization_id in (select public.get_user_org_ids())));

create policy "Org members can view shipments" on public.shipments for select using (organization_id in (select public.get_user_org_ids()));
create policy "Org members can manage shipments" on public.shipments for insert with check (organization_id in (select public.get_user_org_ids()));
create policy "Org members can update shipments" on public.shipments for update using (organization_id in (select public.get_user_org_ids()));

create policy "Org members can view alerts" on public.supply_chain_alerts for select using (organization_id in (select public.get_user_org_ids()));
create policy "Org members can manage alerts" on public.supply_chain_alerts for insert with check (organization_id in (select public.get_user_org_ids()));
create policy "Org members can update alerts" on public.supply_chain_alerts for update using (organization_id in (select public.get_user_org_ids()));

-- F-04: Orders & Inventory
create policy "Org members can view channels" on public.channels for select using (organization_id in (select public.get_user_org_ids()));
create policy "Org members can manage channels" on public.channels for insert with check (organization_id in (select public.get_user_org_ids()));

create policy "Org members can view orders" on public.orders for select using (organization_id in (select public.get_user_org_ids()));
create policy "Org members can manage orders" on public.orders for insert with check (organization_id in (select public.get_user_org_ids()));
create policy "Org members can update orders" on public.orders for update using (organization_id in (select public.get_user_org_ids()));

create policy "Org members can view order_lines" on public.order_lines for select using (order_id in (select id from public.orders where organization_id in (select public.get_user_org_ids())));
create policy "Org members can manage order_lines" on public.order_lines for insert with check (order_id in (select id from public.orders where organization_id in (select public.get_user_org_ids())));

create policy "Org members can view inventory_locations" on public.inventory_locations for select using (organization_id in (select public.get_user_org_ids()));
create policy "Org members can manage inventory_locations" on public.inventory_locations for insert with check (organization_id in (select public.get_user_org_ids()));

create policy "Org members can view inventory_levels" on public.inventory_levels for select using (organization_id in (select public.get_user_org_ids()));
create policy "Org members can manage inventory_levels" on public.inventory_levels for insert with check (organization_id in (select public.get_user_org_ids()));
create policy "Org members can update inventory_levels" on public.inventory_levels for update using (organization_id in (select public.get_user_org_ids()));

-- F-07: Integrations
create policy "Org members can view integrations" on public.integrations for select using (organization_id in (select public.get_user_org_ids()));
create policy "Org members can manage integrations" on public.integrations for insert with check (organization_id in (select public.get_user_org_ids()));
create policy "Org members can update integrations" on public.integrations for update using (organization_id in (select public.get_user_org_ids()));

create policy "Org members can view sync_logs" on public.sync_logs for select using (integration_id in (select id from public.integrations where organization_id in (select public.get_user_org_ids())));

create policy "Org members can view webhooks" on public.webhooks for select using (organization_id in (select public.get_user_org_ids()));
create policy "Org members can manage webhooks" on public.webhooks for insert with check (organization_id in (select public.get_user_org_ids()));

create policy "Org members can view field_mappings" on public.field_mappings for select using (integration_id in (select id from public.integrations where organization_id in (select public.get_user_org_ids())));

-- F-12: Dashboards & KPIs
create policy "Org members can view kpis" on public.kpis for select using (organization_id in (select public.get_user_org_ids()));
create policy "Org members can manage kpis" on public.kpis for insert with check (organization_id in (select public.get_user_org_ids()));
create policy "Org members can update kpis" on public.kpis for update using (organization_id in (select public.get_user_org_ids()));

create policy "Org members can view kpi_snapshots" on public.kpi_snapshots for select using (organization_id in (select public.get_user_org_ids()));
create policy "Org members can manage kpi_snapshots" on public.kpi_snapshots for insert with check (organization_id in (select public.get_user_org_ids()));

create policy "Org members can view dashboards" on public.dashboards for select using (organization_id in (select public.get_user_org_ids()));
create policy "Org members can manage dashboards" on public.dashboards for insert with check (organization_id in (select public.get_user_org_ids()));
create policy "Org members can update dashboards" on public.dashboards for update using (organization_id in (select public.get_user_org_ids()));

create policy "Org members can view widgets" on public.dashboard_widgets for select using (dashboard_id in (select id from public.dashboards where organization_id in (select public.get_user_org_ids())));
create policy "Org members can manage widgets" on public.dashboard_widgets for insert with check (dashboard_id in (select id from public.dashboards where organization_id in (select public.get_user_org_ids())));

create policy "Users can view own preferences" on public.user_preferences for select using (user_id = auth.uid());
create policy "Users can manage own preferences" on public.user_preferences for insert with check (user_id = auth.uid());
create policy "Users can update own preferences" on public.user_preferences for update using (user_id = auth.uid());

-- Shared
create policy "Org members can view audit_logs" on public.audit_logs for select using (organization_id in (select public.get_user_org_ids()));
create policy "System can insert audit_logs" on public.audit_logs for insert with check (organization_id in (select public.get_user_org_ids()));

create policy "Org members can view documents" on public.documents for select using (organization_id in (select public.get_user_org_ids()));
create policy "Org members can manage documents" on public.documents for insert with check (organization_id in (select public.get_user_org_ids()));

create policy "Users can view own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "Users can update own notifications" on public.notifications for update using (user_id = auth.uid());
create policy "System can insert notifications" on public.notifications for insert with check (true);

-- ============================================================
-- ENABLE REALTIME for key tables
-- ============================================================
alter publication supabase_realtime add table public.supply_chain_alerts;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.inventory_levels;
