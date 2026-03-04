-- AftermarketOS Foundation Schema
-- All tables use UUIDs, audit columns, soft deletes

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pg_trgm" with schema extensions;

-- ============================================================
-- ENUMS
-- ============================================================
create type public.user_role as enum (
  'admin',
  'ops_director',
  'catalog_manager',
  'sales_manager',
  'compliance_officer',
  'cfo',
  'warehouse_supervisor',
  'executive'
);

create type public.order_status as enum (
  'draft',
  'pending',
  'confirmed',
  'processing',
  'picking',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'backordered'
);

create type public.channel_type as enum (
  'wholesale',
  'direct',
  'ecommerce_amazon',
  'ecommerce_ebay',
  'ecommerce_shopify',
  'ecommerce_woocommerce',
  'edi',
  'phone'
);

create type public.facility_type as enum (
  'manufacturing_plant',
  'distribution_center',
  'warehouse',
  'cross_dock'
);

create type public.shipment_status as enum (
  'pending',
  'in_transit',
  'at_customs',
  'out_for_delivery',
  'delivered',
  'delayed',
  'exception'
);

create type public.alert_severity as enum (
  'info',
  'warning',
  'critical'
);

create type public.alert_category as enum (
  'inventory',
  'supply_chain',
  'order',
  'compliance',
  'warehouse',
  'system'
);

create type public.part_status as enum (
  'active',
  'discontinued',
  'pending_approval',
  'draft'
);

create type public.certification_status as enum (
  'active',
  'expiring_soon',
  'expired',
  'pending',
  'revoked'
);

create type public.integration_type as enum (
  'erp',
  'ecommerce',
  'edi',
  'accounting',
  'shipping',
  'custom'
);

create type public.sync_status as enum (
  'pending',
  'running',
  'completed',
  'failed',
  'partial'
);

create type public.kpi_category as enum (
  'revenue',
  'operations',
  'inventory',
  'fulfillment',
  'compliance',
  'finance',
  'warehouse'
);

create type public.currency_code as enum (
  'USD',
  'EUR',
  'GBP'
);

-- ============================================================
-- ORGANIZATIONS (multi-tenancy root)
-- ============================================================
create table public.organizations (
  id uuid primary key default extensions.uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  logo_url text,
  default_currency public.currency_code not null default 'USD',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.organization_members (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.user_role not null default 'admin',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(organization_id, user_id)
);

-- ============================================================
-- USER PROFILES
-- ============================================================
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  current_organization_id uuid references public.organizations(id),
  preferences jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ============================================================
-- F-01: CATALOG & FITMENT
-- ============================================================
create table public.part_categories (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  slug text not null,
  parent_id uuid references public.part_categories(id),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  unique(organization_id, slug)
);

create table public.parts (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id),
  part_number text not null,
  name text not null,
  description text,
  category_id uuid references public.part_categories(id),
  status public.part_status not null default 'active',
  weight_grams integer,
  length_mm integer,
  width_mm integer,
  height_mm integer,
  material text,
  is_direct_fit boolean not null default true,
  is_universal boolean not null default false,
  base_price_cents integer not null default 0,
  cost_price_cents integer not null default 0,
  currency public.currency_code not null default 'USD',
  image_url text,
  aces_data jsonb,
  pies_data jsonb,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  unique(organization_id, part_number)
);

create table public.vehicles (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id),
  year integer not null,
  make text not null,
  model text not null,
  engine text,
  trim text,
  body_type text,
  drive_type text,
  fuel_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz
);

create table public.fitments (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id),
  part_id uuid not null references public.parts(id),
  vehicle_id uuid not null references public.vehicles(id),
  position text,
  notes text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  unique(part_id, vehicle_id, position)
);

create table public.supersessions (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id),
  old_part_id uuid not null references public.parts(id),
  new_part_id uuid not null references public.parts(id),
  reason text,
  effective_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz
);

create table public.cross_references (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id),
  part_id uuid not null references public.parts(id),
  reference_type text not null, -- 'oe', 'competitor', 'interchange'
  reference_number text not null,
  brand text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz
);

-- ============================================================
-- F-03: SUPPLY CHAIN
-- ============================================================
create table public.suppliers (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  code text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  address jsonb,
  lead_time_days integer,
  rating numeric(3,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  unique(organization_id, code)
);

create table public.facilities (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  code text not null,
  facility_type public.facility_type not null,
  address jsonb,
  latitude numeric(10,7),
  longitude numeric(10,7),
  is_active boolean not null default true,
  capacity_sqft integer,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  unique(organization_id, code)
);

create table public.purchase_orders (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id),
  po_number text not null,
  supplier_id uuid not null references public.suppliers(id),
  facility_id uuid not null references public.facilities(id),
  status text not null default 'draft',
  total_amount_cents bigint not null default 0,
  currency public.currency_code not null default 'USD',
  expected_delivery_date date,
  actual_delivery_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  unique(organization_id, po_number)
);

create table public.purchase_order_lines (
  id uuid primary key default extensions.uuid_generate_v4(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  part_id uuid not null references public.parts(id),
  quantity_ordered integer not null,
  quantity_received integer not null default 0,
  unit_cost_cents integer not null,
  currency public.currency_code not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shipments (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id),
  tracking_number text,
  carrier text,
  status public.shipment_status not null default 'pending',
  origin_facility_id uuid references public.facilities(id),
  destination_facility_id uuid references public.facilities(id),
  purchase_order_id uuid references public.purchase_orders(id),
  order_id uuid, -- FK added after orders table
  estimated_arrival timestamptz,
  actual_arrival timestamptz,
  latitude numeric(10,7),
  longitude numeric(10,7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz
);

create table public.supply_chain_alerts (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id),
  severity public.alert_severity not null default 'info',
  category public.alert_category not null,
  title text not null,
  message text not null,
  source_type text,
  source_id uuid,
  is_read boolean not null default false,
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- F-04: ORDERS & INVENTORY
-- ============================================================
create table public.channels (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  channel_type public.channel_type not null,
  is_active boolean not null default true,
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(organization_id, name)
);

create table public.orders (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id),
  order_number text not null,
  channel_id uuid references public.channels(id),
  status public.order_status not null default 'pending',
  customer_name text,
  customer_email text,
  shipping_address jsonb,
  billing_address jsonb,
  subtotal_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  shipping_cents bigint not null default 0,
  total_cents bigint not null default 0,
  currency public.currency_code not null default 'USD',
  notes text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  facility_id uuid references public.facilities(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  unique(organization_id, order_number)
);

-- Add FK from shipments to orders
alter table public.shipments
  add constraint shipments_order_id_fkey
  foreign key (order_id) references public.orders(id);

create table public.order_lines (
  id uuid primary key default extensions.uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  part_id uuid not null references public.parts(id),
  quantity integer not null,
  unit_price_cents integer not null,
  total_cents bigint not null,
  currency public.currency_code not null default 'USD',
  status public.order_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_locations (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id),
  facility_id uuid not null references public.facilities(id),
  zone text,
  aisle text,
  rack text,
  shelf text,
  bin text,
  label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.inventory_levels (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id),
  part_id uuid not null references public.parts(id),
  facility_id uuid not null references public.facilities(id),
  location_id uuid references public.inventory_locations(id),
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  quantity_reserved integer not null default 0 check (quantity_reserved >= 0),
  quantity_on_order integer not null default 0,
  reorder_point integer not null default 0,
  reorder_quantity integer not null default 0,
  last_counted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(part_id, facility_id)
);

-- ============================================================
-- F-07: INTEGRATIONS
-- ============================================================
create table public.integrations (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  integration_type public.integration_type not null,
  provider text not null,
  config jsonb not null default '{}',
  credentials jsonb not null default '{}',
  is_active boolean not null default false,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz
);

create table public.sync_logs (
  id uuid primary key default extensions.uuid_generate_v4(),
  integration_id uuid not null references public.integrations(id),
  status public.sync_status not null default 'pending',
  direction text not null default 'inbound',
  records_processed integer not null default 0,
  records_failed integer not null default 0,
  error_details jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.webhooks (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  url text not null,
  events text[] not null default '{}',
  secret text,
  is_active boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.field_mappings (
  id uuid primary key default extensions.uuid_generate_v4(),
  integration_id uuid not null references public.integrations(id),
  source_field text not null,
  target_field text not null,
  transform_rule text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- F-12: DASHBOARDS & KPIs
-- ============================================================
create table public.kpis (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id),
  key text not null,
  name text not null,
  description text,
  category public.kpi_category not null,
  unit text not null default 'number',
  target_value numeric,
  warning_threshold numeric,
  critical_threshold numeric,
  is_higher_better boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, key)
);

create table public.kpi_snapshots (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id),
  kpi_id uuid not null references public.kpis(id),
  value numeric not null,
  previous_value numeric,
  snapshot_date date not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_kpi_snapshots_lookup
  on public.kpi_snapshots(kpi_id, snapshot_date desc);

create table public.dashboards (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  role public.user_role,
  layout jsonb not null default '[]',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz
);

create table public.dashboard_widgets (
  id uuid primary key default extensions.uuid_generate_v4(),
  dashboard_id uuid not null references public.dashboards(id) on delete cascade,
  widget_type text not null,
  title text not null,
  config jsonb not null default '{}',
  position_x integer not null default 0,
  position_y integer not null default 0,
  width integer not null default 1,
  height integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  default_dashboard_id uuid references public.dashboards(id),
  sidebar_collapsed boolean not null default false,
  theme text not null default 'system',
  date_format text not null default 'MM/dd/yyyy',
  timezone text not null default 'UTC',
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, organization_id)
);

-- ============================================================
-- SHARED: AUDIT, DOCUMENTS, NOTIFICATIONS
-- ============================================================
create table public.audit_logs (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_entity
  on public.audit_logs(entity_type, entity_id, created_at desc);

create table public.documents (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  file_path text not null,
  file_size integer,
  mime_type text,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  deleted_at timestamptz
);

create table public.notifications (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  title text not null,
  message text not null,
  link text,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_user
  on public.notifications(user_id, is_read, created_at desc);

-- ============================================================
-- INDEXES for performance
-- ============================================================
create index idx_parts_org on public.parts(organization_id) where deleted_at is null;
create index idx_parts_number on public.parts(organization_id, part_number) where deleted_at is null;
create index idx_parts_category on public.parts(category_id) where deleted_at is null;
create index idx_parts_status on public.parts(organization_id, status) where deleted_at is null;

create index idx_vehicles_ymm on public.vehicles(organization_id, year, make, model) where deleted_at is null;

create index idx_fitments_part on public.fitments(part_id) where deleted_at is null;
create index idx_fitments_vehicle on public.fitments(vehicle_id) where deleted_at is null;

create index idx_orders_org on public.orders(organization_id) where deleted_at is null;
create index idx_orders_status on public.orders(organization_id, status) where deleted_at is null;
create index idx_orders_date on public.orders(organization_id, created_at desc) where deleted_at is null;

create index idx_inventory_levels_part on public.inventory_levels(part_id, facility_id);
create index idx_inventory_levels_facility on public.inventory_levels(facility_id);

create index idx_supply_chain_alerts_org on public.supply_chain_alerts(organization_id, is_resolved, created_at desc);

create index idx_org_members_user on public.organization_members(user_id) where deleted_at is null;
create index idx_org_members_org on public.organization_members(organization_id) where deleted_at is null;

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply to all tables with updated_at
do $$
declare
  t text;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public'
      and column_name = 'updated_at'
      and table_name != 'kpi_snapshots'
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.handle_updated_at()',
      t
    );
  end loop;
end;
$$;

-- ============================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
