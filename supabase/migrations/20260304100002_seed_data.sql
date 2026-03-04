-- AftermarketOS Seed Data
-- Realistic demo data for BOSAL-style aftermarket operations
-- This runs as a migration so the demo org exists for all environments

-- ============================================================
-- DEMO ORGANIZATION
-- ============================================================
insert into public.organizations (id, name, slug, default_currency, settings) values
  ('a0000000-0000-0000-0000-000000000001', 'Bosal Aftermarket', 'bosal', 'EUR', '{"plants": 34, "distribution_centers": 18, "vehicle_applications": 3200}');

-- ============================================================
-- PART CATEGORIES
-- ============================================================
insert into public.part_categories (id, organization_id, name, slug, sort_order) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Exhaust Systems', 'exhaust-systems', 1),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Catalytic Converters', 'catalytic-converters', 2),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Mufflers', 'mufflers', 3),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Exhaust Pipes', 'exhaust-pipes', 4),
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Mounting Kits', 'mounting-kits', 5),
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'EV Thermal Components', 'ev-thermal', 6),
  ('c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'DPF Filters', 'dpf-filters', 7);

-- ============================================================
-- FACILITIES (34 plants + 18 DCs from Bosal spec)
-- ============================================================
insert into public.facilities (id, organization_id, name, code, facility_type, latitude, longitude, is_active, capacity_sqft, timezone) values
  ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Lummen Plant', 'PLT-BE-01', 'manufacturing_plant', 50.9833, 5.2000, true, 250000, 'Europe/Brussels'),
  ('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Geel Distribution Center', 'DC-BE-01', 'distribution_center', 51.1622, 4.9897, true, 180000, 'Europe/Brussels'),
  ('f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Birmingham DC', 'DC-UK-01', 'distribution_center', 52.4862, -1.8904, true, 150000, 'Europe/London'),
  ('f0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Frankfurt DC', 'DC-DE-01', 'distribution_center', 50.1109, 8.6821, true, 200000, 'Europe/Berlin'),
  ('f0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Paris DC', 'DC-FR-01', 'distribution_center', 48.8566, 2.3522, true, 120000, 'Europe/Paris'),
  ('f0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Milan DC', 'DC-IT-01', 'distribution_center', 45.4642, 9.1900, true, 100000, 'Europe/Rome'),
  ('f0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'Warsaw Plant', 'PLT-PL-01', 'manufacturing_plant', 52.2297, 21.0122, true, 180000, 'Europe/Warsaw'),
  ('f0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'Madrid DC', 'DC-ES-01', 'distribution_center', 40.4168, -3.7038, true, 90000, 'Europe/Madrid');

-- ============================================================
-- SUPPLIERS
-- ============================================================
insert into public.suppliers (id, organization_id, name, code, contact_email, lead_time_days, rating, is_active) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'SteelWorks Europa', 'SUP-001', 'orders@steelworks.eu', 14, 4.5, true),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'PGM Refining Ltd', 'SUP-002', 'sales@pgmrefining.co.uk', 21, 4.2, true),
  ('50000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'AluCast GmbH', 'SUP-003', 'info@alucast.de', 10, 4.8, true),
  ('50000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'CeramTech Substrates', 'SUP-004', 'procurement@ceramtech.com', 28, 3.9, true);

-- ============================================================
-- CHANNELS
-- ============================================================
insert into public.channels (id, organization_id, name, channel_type, is_active) values
  ('c1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Wholesale', 'wholesale', true),
  ('c1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Direct Sales', 'direct', true),
  ('c1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Amazon EU', 'ecommerce_amazon', true),
  ('c1000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'eBay Motors', 'ecommerce_ebay', true),
  ('c1000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Bosal Direct Shop', 'ecommerce_shopify', true),
  ('c1000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'EDI Partners', 'edi', true);

-- ============================================================
-- KPI DEFINITIONS
-- ============================================================
insert into public.kpis (id, organization_id, key, name, description, category, unit, target_value, is_higher_better) values
  -- Revenue
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'total_revenue', 'Total Revenue', 'Total revenue across all channels', 'revenue', 'currency', 45000000, true),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'gross_margin', 'Gross Margin', 'Gross margin percentage', 'revenue', 'percent', 38, true),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'revenue_wholesale', 'Wholesale Revenue', 'Revenue from wholesale channel', 'revenue', 'currency', 27000000, true),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'revenue_ecommerce', 'E-Commerce Revenue', 'Revenue from all e-commerce channels', 'revenue', 'currency', 12000000, true),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'revenue_direct', 'Direct Sales Revenue', 'Revenue from direct sales', 'revenue', 'currency', 6000000, true),
  -- Operations
  ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'orders_today', 'Orders Today', 'Number of orders received today', 'operations', 'number', 350, true),
  ('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'shipments_in_transit', 'Shipments In Transit', 'Active shipments currently in transit', 'operations', 'number', null, false),
  ('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'backorder_count', 'Backorders', 'Number of backordered line items', 'operations', 'number', 0, false),
  ('b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', 'dc_utilization', 'DC Utilization', 'Average distribution center capacity utilization', 'operations', 'percent', 85, false),
  -- Fulfillment
  ('b0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000001', 'fill_rate', 'Fill Rate', 'Percentage of orders shipped complete from stock', 'fulfillment', 'percent', 96, true),
  ('b0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000001', 'on_time_shipping', 'On-Time Shipping', 'Percentage of orders shipped on time', 'fulfillment', 'percent', 98, true),
  ('b0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000001', 'avg_fulfillment_hours', 'Avg Fulfillment Time', 'Average hours from order to shipment', 'fulfillment', 'hours', 4, false),
  -- Inventory
  ('b0000000-0000-0000-0000-000000000030', 'a0000000-0000-0000-0000-000000000001', 'inventory_turns', 'Inventory Turns', 'Annual inventory turnover rate', 'inventory', 'number', 8, true),
  ('b0000000-0000-0000-0000-000000000031', 'a0000000-0000-0000-0000-000000000001', 'active_skus', 'Active SKUs', 'Number of active SKUs in catalog', 'inventory', 'number', null, false),
  ('b0000000-0000-0000-0000-000000000032', 'a0000000-0000-0000-0000-000000000001', 'stockout_rate', 'Stockout Rate', 'Percentage of SKUs currently out of stock', 'inventory', 'percent', 2, false),
  -- Finance
  ('b0000000-0000-0000-0000-000000000040', 'a0000000-0000-0000-0000-000000000001', 'net_profit_margin', 'Net Profit Margin', 'Net profit as percentage of revenue', 'finance', 'percent', 12, true),
  ('b0000000-0000-0000-0000-000000000041', 'a0000000-0000-0000-0000-000000000001', 'warranty_reserve', 'Warranty Reserve', 'Current warranty reserve balance', 'finance', 'currency', null, false),
  ('b0000000-0000-0000-0000-000000000042', 'a0000000-0000-0000-0000-000000000001', 'raw_material_index', 'Raw Material Cost Index', 'Composite index of steel/aluminum/PGM costs (base 100)', 'finance', 'number', null, false),
  -- Warehouse
  ('b0000000-0000-0000-0000-000000000050', 'a0000000-0000-0000-0000-000000000001', 'picks_today', 'Picks Today', 'Total picks completed today', 'warehouse', 'number', 2500, true),
  ('b0000000-0000-0000-0000-000000000051', 'a0000000-0000-0000-0000-000000000001', 'receiving_today', 'Items Received Today', 'Total items received into warehouse today', 'warehouse', 'number', null, false),
  ('b0000000-0000-0000-0000-000000000052', 'a0000000-0000-0000-0000-000000000001', 'cycle_count_accuracy', 'Cycle Count Accuracy', 'Percentage accuracy of cycle counts', 'warehouse', 'percent', 99, true),
  ('b0000000-0000-0000-0000-000000000053', 'a0000000-0000-0000-0000-000000000001', 'worker_productivity', 'Worker Productivity', 'Average picks per worker per hour', 'warehouse', 'number', 45, true);

-- ============================================================
-- KPI SNAPSHOTS (90 days of realistic data)
-- ============================================================
do $$
declare
  d date;
  day_num integer;
  base_revenue numeric;
  seasonal numeric;
  noise numeric;
begin
  for day_num in 0..89 loop
    d := current_date - day_num;
    seasonal := 1 + 0.15 * sin(2 * pi() * extract(doy from d) / 365);
    noise := 0.95 + random() * 0.10;

    -- Total Revenue (daily, ~€125K/day average = ~€45M/year)
    base_revenue := 125000 * seasonal * noise;
    insert into public.kpi_snapshots (organization_id, kpi_id, value, previous_value, snapshot_date)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', round(base_revenue), round(base_revenue * (0.97 + random() * 0.06)), d);

    -- Gross Margin (35-42%)
    insert into public.kpi_snapshots (organization_id, kpi_id, value, previous_value, snapshot_date)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', round((35 + random() * 7)::numeric, 1), round((35 + random() * 7)::numeric, 1), d);

    -- Wholesale Revenue (~60% of total)
    insert into public.kpi_snapshots (organization_id, kpi_id, value, previous_value, snapshot_date)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', round(base_revenue * 0.60), round(base_revenue * 0.60 * noise), d);

    -- E-Commerce Revenue (~27% of total)
    insert into public.kpi_snapshots (organization_id, kpi_id, value, previous_value, snapshot_date)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', round(base_revenue * 0.27), round(base_revenue * 0.27 * noise), d);

    -- Direct Revenue (~13% of total)
    insert into public.kpi_snapshots (organization_id, kpi_id, value, previous_value, snapshot_date)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000005', round(base_revenue * 0.13), round(base_revenue * 0.13 * noise), d);

    -- Orders Today (280-420)
    insert into public.kpi_snapshots (organization_id, kpi_id, value, previous_value, snapshot_date)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000010', round(350 * seasonal * noise), round(350 * seasonal * (0.95 + random() * 0.10)), d);

    -- Shipments In Transit (40-80)
    insert into public.kpi_snapshots (organization_id, kpi_id, value, previous_value, snapshot_date)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000011', round(60 + random() * 20), round(55 + random() * 25), d);

    -- Backorders (5-25)
    insert into public.kpi_snapshots (organization_id, kpi_id, value, previous_value, snapshot_date)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000012', round(15 + random() * 10), round(12 + random() * 13), d);

    -- DC Utilization (72-92%)
    insert into public.kpi_snapshots (organization_id, kpi_id, value, previous_value, snapshot_date)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000013', round((72 + random() * 20)::numeric, 1), round((72 + random() * 20)::numeric, 1), d);

    -- Fill Rate (92-98%)
    insert into public.kpi_snapshots (organization_id, kpi_id, value, previous_value, snapshot_date)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000020', round((92 + random() * 6)::numeric, 1), round((92 + random() * 6)::numeric, 1), d);

    -- On-Time Shipping (94-99%)
    insert into public.kpi_snapshots (organization_id, kpi_id, value, previous_value, snapshot_date)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000021', round((94 + random() * 5)::numeric, 1), round((94 + random() * 5)::numeric, 1), d);

    -- Avg Fulfillment Hours (2.5-6.0)
    insert into public.kpi_snapshots (organization_id, kpi_id, value, previous_value, snapshot_date)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000022', round((2.5 + random() * 3.5)::numeric, 1), round((2.5 + random() * 3.5)::numeric, 1), d);

    -- Inventory Turns (6-10)
    insert into public.kpi_snapshots (organization_id, kpi_id, value, previous_value, snapshot_date)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000030', round((6 + random() * 4)::numeric, 1), round((6 + random() * 4)::numeric, 1), d);

    -- Active SKUs (48000-52000)
    insert into public.kpi_snapshots (organization_id, kpi_id, value, previous_value, snapshot_date)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000031', round(50000 + random() * 2000), round(49500 + random() * 2000), d);

    -- Stockout Rate (1-4%)
    insert into public.kpi_snapshots (organization_id, kpi_id, value, previous_value, snapshot_date)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000032', round((1 + random() * 3)::numeric, 1), round((1 + random() * 3)::numeric, 1), d);

    -- Net Profit Margin (8-15%)
    insert into public.kpi_snapshots (organization_id, kpi_id, value, previous_value, snapshot_date)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000040', round((8 + random() * 7)::numeric, 1), round((8 + random() * 7)::numeric, 1), d);

    -- Warranty Reserve (€1.2M-€1.8M)
    insert into public.kpi_snapshots (organization_id, kpi_id, value, previous_value, snapshot_date)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000041', round(1200000 + random() * 600000), round(1200000 + random() * 600000), d);

    -- Raw Material Index (95-130)
    insert into public.kpi_snapshots (organization_id, kpi_id, value, previous_value, snapshot_date)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000042', round((95 + random() * 35)::numeric, 1), round((95 + random() * 35)::numeric, 1), d);

    -- Picks Today (2000-3200)
    insert into public.kpi_snapshots (organization_id, kpi_id, value, previous_value, snapshot_date)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000050', round(2600 * seasonal * noise), round(2600 * seasonal * (0.95 + random() * 0.10)), d);

    -- Items Received (800-1500)
    insert into public.kpi_snapshots (organization_id, kpi_id, value, previous_value, snapshot_date)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000051', round(1150 + random() * 350), round(1100 + random() * 400), d);

    -- Cycle Count Accuracy (97-99.5%)
    insert into public.kpi_snapshots (organization_id, kpi_id, value, previous_value, snapshot_date)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000052', round((97 + random() * 2.5)::numeric, 1), round((97 + random() * 2.5)::numeric, 1), d);

    -- Worker Productivity (35-55 picks/hour)
    insert into public.kpi_snapshots (organization_id, kpi_id, value, previous_value, snapshot_date)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000053', round((35 + random() * 20)::numeric, 1), round((35 + random() * 20)::numeric, 1), d);
  end loop;
end;
$$;

-- ============================================================
-- DEMO ALERTS
-- ============================================================
insert into public.supply_chain_alerts (organization_id, severity, category, title, message, is_read, is_resolved) values
  ('a0000000-0000-0000-0000-000000000001', 'critical', 'supply_chain', 'PGM Price Spike', 'Palladium spot price increased 12% in 24 hours. Catalytic converter costs impacted.', false, false),
  ('a0000000-0000-0000-0000-000000000001', 'warning', 'inventory', 'Low Stock: Muffler MF-2024-HC', 'SKU MF-2024-HC (Honda Civic 2020-2024 muffler) below reorder point at DC-BE-01. 3 units remaining.', false, false),
  ('a0000000-0000-0000-0000-000000000001', 'critical', 'compliance', 'Euro 7 Certification Expiring', '14 catalytic converter SKUs have type-approvals expiring within 30 days. Renewal required.', false, false),
  ('a0000000-0000-0000-0000-000000000001', 'warning', 'order', 'High Backorder Volume', '23 orders currently backordered. Primary shortages in DPF filter category.', false, false),
  ('a0000000-0000-0000-0000-000000000001', 'info', 'supply_chain', 'Shipment Delayed: PO-2024-0847', 'Container from SteelWorks Europa delayed 3 days at Rotterdam port. New ETA: March 8.', false, false),
  ('a0000000-0000-0000-0000-000000000001', 'warning', 'warehouse', 'Cycle Count Discrepancy', 'Bin A-14-03 at DC-DE-01: system shows 47 units, physical count shows 42. Investigation required.', false, false),
  ('a0000000-0000-0000-0000-000000000001', 'info', 'system', 'ECI M1 Sync Complete', 'Nightly ERP sync completed successfully. 12,847 records synchronized, 3 conflicts resolved.', true, true);
