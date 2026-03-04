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
// Navigation
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
  // -- Operations --
  {
    title: 'Catalog',
    href: '/catalog',
    icon: 'BookOpen',
    phase: 'P0',
    description: 'Product catalog management with ACES/PIES data',
    requiredRoles: ['admin', 'ops_director', 'catalog_manager'],
    group: 'Operations',
    featureCode: 'F-01',
  },
  {
    title: 'Orders',
    href: '/orders',
    icon: 'ShoppingCart',
    phase: 'P0',
    description: 'Multi-channel order processing and tracking',
    requiredRoles: ['admin', 'ops_director', 'sales_manager', 'warehouse_supervisor'],
    group: 'Operations',
    featureCode: 'F-04',
  },
  {
    title: 'Inventory',
    href: '/inventory',
    icon: 'Package',
    phase: 'P0',
    description: 'Real-time inventory levels across facilities',
    requiredRoles: ['admin', 'ops_director', 'warehouse_supervisor', 'catalog_manager'],
    group: 'Operations',
    featureCode: 'F-02',
  },
  {
    title: 'Warehouse',
    href: '/warehouse',
    icon: 'Warehouse',
    phase: 'P1',
    description: 'Warehouse operations and location management',
    requiredRoles: ['admin', 'ops_director', 'warehouse_supervisor'],
    group: 'Operations',
    featureCode: 'F-08',
  },

  // -- Supply Chain --
  {
    title: 'Control Tower',
    href: '/control-tower',
    icon: 'Radar',
    phase: 'P0',
    description: 'Supply chain visibility and shipment tracking',
    requiredRoles: ['admin', 'ops_director', 'warehouse_supervisor', 'executive'],
    group: 'Supply Chain',
    featureCode: 'F-03',
  },

  // -- Compliance --
  {
    title: 'Certifications',
    href: '/certifications',
    icon: 'ShieldCheck',
    phase: 'P1',
    description: 'Regulatory certifications and compliance tracking',
    requiredRoles: ['admin', 'ops_director', 'compliance_officer'],
    group: 'Compliance',
    featureCode: 'F-05',
  },
  {
    title: 'Warranty',
    href: '/warranty',
    icon: 'FileCheck',
    phase: 'P1',
    description: 'Warranty claims management and tracking',
    requiredRoles: ['admin', 'ops_director', 'compliance_officer', 'sales_manager'],
    group: 'Compliance',
    featureCode: 'F-06',
  },

  // -- Analytics --
  {
    title: 'Command Center',
    href: '/command-center',
    icon: 'LayoutDashboard',
    phase: 'P0',
    description: 'Executive dashboard with KPIs and alerts',
    requiredRoles: ALL_ROLES,
    group: 'Analytics',
    featureCode: 'F-12',
  },
  {
    title: 'Pricing',
    href: '/pricing',
    icon: 'DollarSign',
    phase: 'P2',
    description: 'Dynamic pricing engine and margin analysis',
    requiredRoles: ['admin', 'ops_director', 'sales_manager', 'cfo'],
    group: 'Analytics',
    featureCode: 'F-10',
  },
  {
    title: 'Demand',
    href: '/demand',
    icon: 'TrendingUp',
    phase: 'P2',
    description: 'Demand forecasting and trend analysis',
    requiredRoles: ['admin', 'ops_director', 'sales_manager', 'cfo', 'executive'],
    group: 'Analytics',
    featureCode: 'F-11',
  },
  {
    title: 'Portfolio',
    href: '/portfolio',
    icon: 'PieChart',
    phase: 'P1',
    description: 'Product portfolio analysis and optimization',
    requiredRoles: ['admin', 'ops_director', 'catalog_manager', 'cfo', 'executive'],
    group: 'Analytics',
    featureCode: 'F-09',
  },

  // -- Engineering --
  {
    title: 'CatSizer',
    href: '/catsizer',
    icon: 'FlaskConical',
    phase: 'P0',
    description: 'Catalyst sizing for depollution & SOFC reformers',
    requiredRoles: ALL_ROLES,
    group: 'Engineering',
  },

  // -- Settings --
  {
    title: 'Integrations',
    href: '/integrations',
    icon: 'Plug',
    phase: 'P0',
    description: 'ERP, eCommerce, and EDI integration management',
    requiredRoles: ['admin', 'ops_director'],
    group: 'Settings',
    featureCode: 'F-07',
  },
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

export type NavGroup = 'Operations' | 'Supply Chain' | 'Compliance' | 'Analytics' | 'Engineering' | 'Settings';

export const NAV_GROUPS: readonly NavGroup[] = [
  'Operations',
  'Supply Chain',
  'Compliance',
  'Analytics',
  'Engineering',
  'Settings',
];

// ---------------------------------------------------------------------------
// Demo / Seed
// ---------------------------------------------------------------------------

export const DEMO_ORG_ID = 'a0000000-0000-0000-0000-000000000001';
