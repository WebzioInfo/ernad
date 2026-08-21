/**
 * MACHINE-READABLE KENBY ERP TOOL & CAPABILITY REGISTRY
 * Exposes authoritative, parameterized, read-only ERP database query tools
 */

export interface ToolDefinition {
  name: string;
  description: string;
  module: string;
  requiredPermissions: string[];
  parametersSchema: Record<string, any>;
  returns: string;
}

export const KENBY_ERP_TOOLS: ToolDefinition[] = [
  // ── 0. FULL MULTI-DOMAIN ERP SUMMARY ──
  {
    name: 'get_full_erp_summary',
    description: 'Retrieves a comprehensive multi-domain ERP summary covering Sales, Returns, Damage, Production, Current Stock, Raw Materials, and Customers for a given period.',
    module: 'executive',
    requiredPermissions: ['sales:read', 'production:read', 'inventory:read'],
    parametersSchema: {
      period: { type: 'string', enum: ['today', 'yesterday', 'this_month', 'last_month', 'specific_month', 'specific_date', 'date_range'] },
      year: { type: 'number', description: 'e.g. 2026' },
      month: { type: 'number', description: '1 to 12' },
      date: { type: 'string', description: 'Exact date YYYY-MM-DD' },
      startDate: { type: 'string', description: 'Start date YYYY-MM-DD' },
      endDate: { type: 'string', description: 'End date YYYY-MM-DD' },
    },
    returns: 'FullErpSummaryData',
  },

  // ── 1. SALES & DISPATCH TOOLS ──
  {
    name: 'get_sales_summary',
    description: 'Retrieves authoritative sales dispatch metrics (total quantity, transaction count, product breakdown) for a given time period or filter.',
    module: 'sales',
    requiredPermissions: ['sales:read'],
    parametersSchema: {
      period: { type: 'string', enum: ['today', 'yesterday', 'this_month', 'last_month', 'specific_month', 'specific_date', 'date_range'] },
      year: { type: 'number', description: 'e.g. 2026' },
      month: { type: 'number', description: '1 to 12' },
      date: { type: 'string', description: 'Exact date YYYY-MM-DD' },
      startDate: { type: 'string', description: 'Start date YYYY-MM-DD for range' },
      endDate: { type: 'string', description: 'End date YYYY-MM-DD for range' },
      product: { type: 'string', description: 'Optional product name or code' },
      customer: { type: 'string', description: 'Optional customer name or code' },
    },
    returns: 'SalesDispatchSummary',
  },
  {
    name: 'get_sales_by_date',
    description: 'Retrieves sales dispatch records for a specific calendar date (e.g. 2026-08-02).',
    module: 'sales',
    requiredPermissions: ['sales:read'],
    parametersSchema: {
      date: { type: 'string', description: 'Exact date YYYY-MM-DD' },
      product: { type: 'string', description: 'Optional product name or code' },
    },
    returns: 'SalesDispatchSummary',
  },
  {
    name: 'get_sales_transactions',
    description: 'Retrieves detailed sales transaction logs (date, customer, product, quantity, unit price, type).',
    module: 'sales',
    requiredPermissions: ['sales:read'],
    parametersSchema: {
      date: { type: 'string', description: 'Optional date YYYY-MM-DD' },
      customer: { type: 'string', description: 'Optional customer filter' },
      product: { type: 'string', description: 'Optional product filter' },
      type: { type: 'string', enum: ['SALES_DISPATCH', 'SALES_RETURN', 'DAMAGE'], default: 'SALES_DISPATCH' },
      limit: { type: 'number', default: 10 },
    },
    returns: 'SalesTransactionRecord[]',
  },
  {
    name: 'get_dispatch_summary',
    description: 'Retrieves finished goods delivery and dispatch records for a given period.',
    module: 'sales',
    requiredPermissions: ['sales:read'],
    parametersSchema: {
      period: { type: 'string', enum: ['today', 'yesterday', 'this_month', 'last_month', 'specific_month', 'specific_date'] },
      date: { type: 'string', description: 'YYYY-MM-DD' },
      year: { type: 'number' },
      month: { type: 'number' },
    },
    returns: 'SalesDispatchSummary',
  },
  {
    name: 'get_return_summary',
    description: 'Retrieves sales return records and product breakdown for a given period.',
    module: 'sales',
    requiredPermissions: ['sales:read'],
    parametersSchema: {
      period: { type: 'string', enum: ['today', 'yesterday', 'this_month', 'last_month', 'specific_month', 'specific_date'] },
      year: { type: 'number' },
      month: { type: 'number' },
      product: { type: 'string' },
    },
    returns: 'ReturnBreakdownResult',
  },
  {
    name: 'get_damage_summary',
    description: 'Retrieves damaged finished goods records and reasons for a given period.',
    module: 'sales',
    requiredPermissions: ['sales:read'],
    parametersSchema: {
      period: { type: 'string', enum: ['today', 'yesterday', 'this_month', 'last_month', 'specific_month', 'specific_date'] },
      year: { type: 'number' },
      month: { type: 'number' },
      product: { type: 'string' },
    },
    returns: 'DamageBreakdownResult',
  },

  // ── 2. PRODUCT & FINISHED GOODS TOOLS ──
  {
    name: 'list_products',
    description: 'Retrieves the complete list of all registered finished products with specifications and current stock.',
    module: 'products',
    requiredPermissions: ['products:read'],
    parametersSchema: {},
    returns: 'ProductList[]',
  },
  {
    name: 'get_product_stock',
    description: 'Retrieves inventory stock levels for finished goods (overall or for a specific named product).',
    module: 'inventory',
    requiredPermissions: ['inventory:read'],
    parametersSchema: {
      product: { type: 'string', description: 'Product name, SKU, or search term' },
    },
    returns: 'ProductStockSummary',
  },
  {
    name: 'get_product_profile',
    description: 'Retrieves full product profile, packaging configuration, pricing, total produced, total dispatched, and returns.',
    module: 'products',
    requiredPermissions: ['products:read'],
    parametersSchema: {
      product: { type: 'string', description: 'Product name or code' },
    },
    returns: 'ProductFullProfileResult',
  },
  {
    name: 'get_product_bom',
    description: 'Retrieves Bill of Materials (BOM) components (preforms, caps, labels) required per unit of a product.',
    module: 'products',
    requiredPermissions: ['products:read'],
    parametersSchema: {
      product: { type: 'string', description: 'Product name or code' },
    },
    returns: 'ProductBomResult',
  },

  // ── 3. RAW MATERIALS & INVENTORY TOOLS ──
  {
    name: 'list_raw_materials',
    description: 'Retrieves the complete list of all raw materials (caps, preforms, labels, chemicals) with current stock and units.',
    module: 'raw_materials',
    requiredPermissions: ['raw_materials:read'],
    parametersSchema: {},
    returns: 'RawMaterialList[]',
  },
  {
    name: 'get_raw_material_stock',
    description: 'Retrieves stock balance, unit, and item details for a specific raw material.',
    module: 'raw_materials',
    requiredPermissions: ['raw_materials:read'],
    parametersSchema: {
      material: { type: 'string', description: 'Raw material name or item code' },
    },
    returns: 'RawMaterialStock',
  },
  {
    name: 'get_raw_material_movements',
    description: 'Retrieves stock ledger movements (inward, consumption, wastage, adjustment) for a raw material.',
    module: 'raw_materials',
    requiredPermissions: ['raw_materials:read'],
    parametersSchema: {
      material: { type: 'string', description: 'Raw material name or item code' },
      limit: { type: 'number', default: 10 },
    },
    returns: 'RawMaterialMovements[]',
  },
  {
    name: 'get_low_stock_items',
    description: 'Retrieves raw materials or finished products with negative balance or stock below minimum reorder threshold.',
    module: 'inventory',
    requiredPermissions: ['inventory:read'],
    parametersSchema: {},
    returns: 'LowStockItem[]',
  },
  {
    name: 'get_negative_stock_items',
    description: 'Retrieves materials or products with negative stock balances requiring inventory reconciliation.',
    module: 'inventory',
    requiredPermissions: ['inventory:read'],
    parametersSchema: {},
    returns: 'NegativeStockItem[]',
  },

  // ── 4. CUSTOMER INTELLIGENCE TOOLS ──
  {
    name: 'list_customers',
    description: 'Retrieves the list of all registered customers with contact info, status, and outstanding balance.',
    module: 'customers',
    requiredPermissions: ['customers:read'],
    parametersSchema: {
      limit: { type: 'number', default: 50 },
    },
    returns: 'CustomerList[]',
  },
  {
    name: 'get_customer_profile',
    description: 'Retrieves customer profile, credit terms, total sales history, and contact details.',
    module: 'customers',
    requiredPermissions: ['customers:read'],
    parametersSchema: {
      customer: { type: 'string', description: 'Customer name, code, or phone' },
    },
    returns: 'CustomerProfileResult',
  },
  {
    name: 'get_customer_balance',
    description: 'Retrieves live outstanding balance, credit limit, and overdue status for a customer.',
    module: 'customers',
    requiredPermissions: ['customers:read'],
    parametersSchema: {
      customer: { type: 'string', description: 'Customer name or code' },
    },
    returns: 'CustomerBalance',
  },
  {
    name: 'get_customer_payments',
    description: 'Retrieves payment records and collections for a customer.',
    module: 'customers',
    requiredPermissions: ['customers:read'],
    parametersSchema: {
      customer: { type: 'string', description: 'Customer name or code' },
      limit: { type: 'number', default: 10 },
    },
    returns: 'CustomerPayments',
  },
  {
    name: 'get_customer_ledger',
    description: 'Retrieves full debit/credit financial ledger statement for a customer.',
    module: 'customers',
    requiredPermissions: ['customers:read'],
    parametersSchema: {
      customer: { type: 'string', description: 'Customer name or code' },
    },
    returns: 'CustomerLedgerResult',
  },
  {
    name: 'get_customer_debt_ranking',
    description: 'Retrieves customers ranked by highest outstanding overdue balance.',
    module: 'customers',
    requiredPermissions: ['customers:read'],
    parametersSchema: {
      limit: { type: 'number', default: 5 },
    },
    returns: 'CustomerDebtRanking[]',
  },

  // ── 5. PROCUREMENT & VENDORS ──
  {
    name: 'list_vendors',
    description: 'Retrieves list of registered suppliers and vendors with contact details and categories.',
    module: 'procurement',
    requiredPermissions: ['procurement:read'],
    parametersSchema: {},
    returns: 'VendorList[]',
  },
  {
    name: 'get_goods_receipts',
    description: 'Retrieves Goods Receipt Notes (GRN) for raw material deliveries from suppliers.',
    module: 'procurement',
    requiredPermissions: ['procurement:read'],
    parametersSchema: {
      limit: { type: 'number', default: 10 },
    },
    returns: 'GoodsReceiptSummary',
  },

  // ── 6. PRODUCTION & PLANT OPERATIONS ──
  {
    name: 'get_production_summary',
    description: 'Retrieves factory production output metrics (cases produced, batches, wastage) for a period.',
    module: 'production',
    requiredPermissions: ['production:read'],
    parametersSchema: {
      period: { type: 'string', enum: ['today', 'yesterday', 'this_month', 'last_month', 'specific_month', 'specific_date'] },
      year: { type: 'number' },
      month: { type: 'number' },
      date: { type: 'string' },
      product: { type: 'string' },
    },
    returns: 'ProductionSummaryResult',
  },
  {
    name: 'get_production_batches',
    description: 'Retrieves active or recent production batches on factory lines.',
    module: 'production',
    requiredPermissions: ['production:read'],
    parametersSchema: {
      limit: { type: 'number', default: 10 },
    },
    returns: 'ProductionBatchesSummary',
  },
  {
    name: 'get_production_downtime',
    description: 'Retrieves machine breakdown and downtime incident records on production lines.',
    module: 'production',
    requiredPermissions: ['production:read'],
    parametersSchema: {
      limit: { type: 'number', default: 10 },
    },
    returns: 'DowntimeSummary',
  },
  {
    name: 'get_incident_summary',
    description: 'Retrieves factory breakdown and maintenance tickets (open or all).',
    module: 'incidents',
    requiredPermissions: ['incidents:read'],
    parametersSchema: {
      statusFilter: { type: 'string', enum: ['open', 'all'], default: 'open' },
    },
    returns: 'IncidentSummary',
  },

  // ── 7. EMPLOYEES & STAFF ──
  {
    name: 'list_employees',
    description: 'Retrieves list of active plant personnel, operators, and staff members.',
    module: 'users',
    requiredPermissions: ['users:read'],
    parametersSchema: {},
    returns: 'EmployeeList[]',
  },

  // ── 8. CONCEPTUAL RAG & SOPs ──
  {
    name: 'get_knowledge',
    description: 'Retrieves conceptual ERP documentation, SOPs, workflows, definitions, and business logic.',
    module: 'rag',
    requiredPermissions: [],
    parametersSchema: {
      topic: { type: 'string', description: 'Business topic or SOP keyword to look up' },
    },
    returns: 'KnowledgeChunk[]',
  },
];
