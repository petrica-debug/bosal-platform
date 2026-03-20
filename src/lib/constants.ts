import type { Database } from '@/types/database';

// ---------------------------------------------------------------------------
// User Roles
// ---------------------------------------------------------------------------

export const USER_ROLES = {
  admin: 'admin',
  ops_director: 'ops_director',
  catalog_manager: 'catalog_manager',
  sales_manager: 'sales_manager',
  compliance_officer: 'compliance_officer',
  cfo: 'cfo',
  warehouse_supervisor: 'warehouse_supervisor',
  executive: 'executive',
} as const;

export type UserRole = Database['public']['Enums']['user_role'];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  ops_director: 'Operations Director',
  catalog_manager: 'Catalog Manager',
  sales_manager: 'Sales Manager',
  compliance_officer: 'Compliance Officer',
  cfo: 'Chief Financial Officer',
  warehouse_supervisor: 'Warehouse Supervisor',
  executive: 'Executive',
};

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export const CHANNELS = {
  wholesale: 'wholesale',
  direct: 'direct',
  ecommerce_amazon: 'ecommerce_amazon',
  ecommerce_ebay: 'ecommerce_ebay',
  ecommerce_shopify: 'ecommerce_shopify',
  ecommerce_woocommerce: 'ecommerce_woocommerce',
  edi: 'edi',
  phone: 'phone',
} as const;

export type ChannelType = Database['public']['Enums']['channel_type'];

export const CHANNEL_LABELS: Record<ChannelType, string> = {
  wholesale: 'Wholesale',
  direct: 'Direct Sales',
  ecommerce_amazon: 'Amazon',
  ecommerce_ebay: 'eBay',
  ecommerce_shopify: 'Shopify',
  ecommerce_woocommerce: 'WooCommerce',
  edi: 'EDI',
  phone: 'Phone Orders',
};

// ---------------------------------------------------------------------------
// Facility Types
// ---------------------------------------------------------------------------

export const FACILITY_TYPES = {
  manufacturing_plant: 'manufacturing_plant',
  distribution_center: 'distribution_center',
  warehouse: 'warehouse',
  cross_dock: 'cross_dock',
} as const;

export type FacilityType = Database['public']['Enums']['facility_type'];

export const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  manufacturing_plant: 'Manufacturing Plant',
  distribution_center: 'Distribution Center',
  warehouse: 'Warehouse',
  cross_dock: 'Cross-Dock',
};

// ---------------------------------------------------------------------------
// KPI Categories
// ---------------------------------------------------------------------------

export const KPI_CATEGORIES = {
  revenue: 'revenue',
  operations: 'operations',
  inventory: 'inventory',
  fulfillment: 'fulfillment',
  compliance: 'compliance',
  finance: 'finance',
  warehouse: 'warehouse',
} as const;

export type KpiCategory = Database['public']['Enums']['kpi_category'];

export const KPI_CATEGORY_LABELS: Record<KpiCategory, string> = {
  revenue: 'Revenue',
  operations: 'Operations',
  inventory: 'Inventory',
  fulfillment: 'Fulfillment',
  compliance: 'Compliance',
  finance: 'Finance',
  warehouse: 'Warehouse',
};

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

export type Phase = 'P0' | 'P1' | 'P2';

export const PHASE_LABELS: Record<Phase, string> = {
  P0: 'Foundation',
  P1: 'Optimization',
  P2: 'Strategic',
};

// ---------------------------------------------------------------------------
// Navigation — BOSAL Chemistry Copilot
// ---------------------------------------------------------------------------

export interface NavItem {
  title: string;
  href: string;
  icon: string;
  phase: Phase;
  description: string;
  requiredRoles: readonly UserRole[];
  group: string;
  featureCode?: string;
}

const ALL_ROLES: readonly UserRole[] = [
  'admin',
  'ops_director',
  'catalog_manager',
  'sales_manager',
  'compliance_officer',
  'cfo',
  'warehouse_supervisor',
  'executive',
];

export const NAV_ITEMS: readonly NavItem[] = [
  // -- Engineering (primary modules) --
  {
    title: 'Dashboard',
    href: '/command-center',
    icon: 'LayoutDashboard',
    phase: 'P0',
    description: 'Overview dashboard with project status and KPIs',
    requiredRoles: ALL_ROLES,
    group: 'Overview',
  },
  {
    title: 'Catalyst Predictor',
    href: '/catsizer/predictor',
    icon: 'Activity',
    phase: 'P0',
    description: '1D reactor simulation — profiles, light-off, transient cycles, DOE',
    requiredRoles: ALL_ROLES,
    group: 'Engineering',
  },
  {
    title: 'OEM Sizing',
    href: '/catsizer/depollution',
    icon: 'FlaskConical',
    phase: 'P0',
    description: 'Automotive catalyst sizing — TWC, DOC, SCR, DPF, ASC, LNT',
    requiredRoles: ALL_ROLES,
    group: 'Engineering',
  },
  {
    title: 'Reformer / SOFC',
    href: '/catsizer/reformer',
    icon: 'Flame',
    phase: 'P0',
    description: 'Methane reformer and SOFC catalyst sizing',
    requiredRoles: ALL_ROLES,
    group: 'Engineering',
  },
  {
    title: 'Heat Exchanger',
    href: '/catsizer/heat-exchanger',
    icon: 'Thermometer',
    phase: 'P1',
    description: 'Heat exchange reformer — coupled reforming + combustion',
    requiredRoles: ALL_ROLES,
    group: 'Engineering',
  },
  {
    title: 'Surface Science',
    href: '/catsizer/surface-science',
    icon: 'Atom',
    phase: 'P0',
    description: 'TOF analysis, chemisorption, catalyst characterization',
    requiredRoles: ALL_ROLES,
    group: 'Engineering',
  },
  {
    title: 'Spray Simulation',
    href: '/catsizer/spray-sim',
    icon: 'Droplets',
    phase: 'P2',
    description: 'Urea spray visualization and NH₃ uniformity',
    requiredRoles: ALL_ROLES,
    group: 'Engineering',
  },

  // -- Aftermarket --
  {
    title: 'Engine DB',
    href: '/aftermarket/engines',
    icon: 'Database',
    phase: 'P1',
    description: 'Engine family database with exhaust maps',
    requiredRoles: ALL_ROLES,
    group: 'Aftermarket',
  },
  {
    title: 'Product Config',
    href: '/aftermarket/products',
    icon: 'Layers',
    phase: 'P1',
    description: 'Substrate selection, multi-brick configs, zone coating',
    requiredRoles: ALL_ROLES,
    group: 'Aftermarket',
  },
  {
    title: 'WLTP Simulation',
    href: '/aftermarket/wltp',
    icon: 'Activity',
    phase: 'P2',
    description: 'Transient cycle simulation with pass/fail prediction',
    requiredRoles: ALL_ROLES,
    group: 'Aftermarket',
  },
  {
    title: 'AM Homologation Copilot',
    href: '/aftermarket/homologation-copilot',
    icon: 'BookOpen',
    phase: 'P0',
    description:
      'OEM Catalyst Database V5 — reference data & AI copilot for AM homologation',
    requiredRoles: ALL_ROLES,
    group: 'Aftermarket',
  },

  // -- Commercial --
  {
    title: 'Pricing',
    href: '/pricing',
    icon: 'DollarSign',
    phase: 'P0',
    description: 'Component pricing, PGM cost, margin analysis',
    requiredRoles: ALL_ROLES,
    group: 'Commercial',
  },
  {
    title: 'RFQ Manager',
    href: '/rfq',
    icon: 'FileText',
    phase: 'P0',
    description: 'Upload RFQ documents, auto-extract specs, manage responses',
    requiredRoles: ALL_ROLES,
    group: 'Commercial',
  },
  {
    title: 'Catalog',
    href: '/catalog',
    icon: 'BookOpen',
    phase: 'P0',
    description: 'BOSAL product catalog with substrate and catalyst data',
    requiredRoles: ['admin', 'ops_director', 'catalog_manager'],
    group: 'Commercial',
  },

  // -- Settings --
  {
    title: 'Settings',
    href: '/settings',
    icon: 'Settings',
    phase: 'P0',
    description: 'Organization settings and user management',
    requiredRoles: ['admin'],
    group: 'Settings',
  },
];

export type NavGroup = 'Overview' | 'Engineering' | 'Aftermarket' | 'Commercial' | 'Settings';

export const NAV_GROUPS: readonly NavGroup[] = [
  'Overview',
  'Engineering',
  'Aftermarket',
  'Commercial',
  'Settings',
];

// ---------------------------------------------------------------------------
// AI Mode
// ---------------------------------------------------------------------------

export type AIMode = 'online' | 'offline' | 'off';

export const AI_MODE_LABELS: Record<AIMode, string> = {
  online: 'BelgaLabs AI (Cloud)',
  offline: 'BelgaLabs AI (Local)',
  off: 'Manual',
};

export const AI_MODE_COLORS: Record<AIMode, string> = {
  online: '#10B981',
  offline: '#F59E0B',
  off: '#6B7280',
};

// ---------------------------------------------------------------------------
// Demo / Seed
// ---------------------------------------------------------------------------

export const DEMO_ORG_ID = 'a0000000-0000-0000-0000-000000000001';
