/**
 * KENBY CENTRAL ERP CAPABILITY REGISTRY
 * Authoritative machine-readable registry of all real capabilities available across the ERP.
 * Strictly maps to verified database schema tables and backend services.
 */

export type ErpDomain =
  | 'customers'
  | 'products'
  | 'raw_materials'
  | 'warehouse'
  | 'production'
  | 'procurement'
  | 'sales'
  | 'incidents'
  | 'plant_operations'
  | 'finance';

export type ErpEntityType =
  | 'customer'
  | 'product'
  | 'raw_material'
  | 'vendor'
  | 'batch'
  | 'warehouse_location'
  | 'incident'
  | 'production_line';

export type ErpAction =
  | 'lookup'
  | 'list'
  | 'profile'
  | 'balance'
  | 'ledger'
  | 'payments'
  | 'stock'
  | 'movements'
  | 'sales'
  | 'returns'
  | 'damage'
  | 'production'
  | 'downtime'
  | 'bom'
  | 'status'
  | 'grn'
  | 'summary'
  | 'breakdown'
  | 'analysis';

export interface ErpCapability {
  id: string;
  domain: ErpDomain;
  entityTypes: ErpEntityType[];
  action: ErpAction;
  description: string;
  authoritativeSource: string;
  sourceTables: string[];
  readOnly: boolean;
  supportsPeriod: boolean;
  supportsNamedEntity: boolean;
  supportedIntents: string[];
  keywords: {
    en: string[];
    ml: string[];
  };
  exampleQuestions: {
    en: string[];
    ml: string[];
  };
}

export const ERP_CAPABILITIES: ErpCapability[] = [
  // ==========================================
  // 1. CUSTOMERS DOMAIN
  // ==========================================
  {
    id: 'customer_list',
    domain: 'customers',
    entityTypes: ['customer'],
    action: 'list',
    description: 'List registered customers or return total customer count',
    authoritativeSource: 'SalesService.getCustomers',
    sourceTables: ['customers'],
    readOnly: true,
    supportsPeriod: false,
    supportsNamedEntity: false,
    supportedIntents: ['customer_list', 'customer_count'],
    keywords: {
      en: ['customers', 'all customers', 'customer list', 'customer count', 'how many customers'],
      ml: ['കസ്റ്റമേഴ്സ്', 'എല്ലാ കസ്റ്റമർ', 'കസ്റ്റമർ ലിസ്റ്റ്', 'എത്ര കസ്റ്റമർ'],
    },
    exampleQuestions: {
      en: ['Show all customers', 'How many active customers do we have?'],
      ml: ['എല്ലാ കസ്റ്റമേഴ്സിനെയും കാണിക്കൂ', 'ആകെ എത്ര കസ്റ്റമേഴ്സ് ഉണ്ട്?'],
    },
  },
  {
    id: 'customer_profile',
    domain: 'customers',
    entityTypes: ['customer'],
    action: 'profile',
    description: 'Full profile of a customer including contact, opening balance, and recent activity',
    authoritativeSource: 'SalesService.getCustomerSummary / KenbyErpRegistryService.getCustomerProfile',
    sourceTables: ['customers', 'sales_transactions', 'products', 'sales_orders'],
    readOnly: true,
    supportsPeriod: false,
    supportsNamedEntity: true,
    supportedIntents: ['customer_profile'],
    keywords: {
      en: ['details', 'profile', 'information', 'about customer', 'full details'],
      ml: ['വിശദാംശങ്ങൾ', 'പ്രൊഫൈൽ', 'വിവരങ്ങൾ', 'മുഴുവൻ വിവരങ്ങൾ'],
    },
    exampleQuestions: {
      en: ['Give me full details of ABC Traders', 'Show profile of Customer Sinan'],
      ml: ['ABC Traders-ന്റെ മുഴുവൻ വിവരങ്ങൾ തരൂ', 'കസ്റ്റമർ സിനാൻ പ്രൊഫൈൽ കാണിക്കൂ'],
    },
  },
  {
    id: 'customer_balance',
    domain: 'customers',
    entityTypes: ['customer'],
    action: 'balance',
    description: 'Current outstanding balance, opening balance, and credit limit of a customer',
    authoritativeSource: 'SalesService.getCustomerSummary',
    sourceTables: ['customers', 'sales_orders', 'sales_payments', 'sales_transactions'],
    readOnly: true,
    supportsPeriod: false,
    supportsNamedEntity: true,
    supportedIntents: ['customer_balance', 'customer_ranking_debt'],
    keywords: {
      en: ['balance', 'owe', 'outstanding', 'due', 'debt', 'credit'],
      ml: ['ബാക്കി', 'കടം', 'കൊടുക്കാനുണ്ട്', 'കുടിശ്ശിക', 'ബാലൻസ്'],
    },
    exampleQuestions: {
      en: ['How much does ABC Traders owe us?', 'Who owes the most?'],
      ml: ['ABC Traders എത്ര പൈസ തരാനുണ്ട്?', 'ഏറ്റവും കൂടുതൽ കടം ഉള്ള കസ്റ്റമർ ആര്?'],
    },
  },
  {
    id: 'customer_ledger',
    domain: 'customers',
    entityTypes: ['customer'],
    action: 'ledger',
    description: 'Running debit/credit ledger statement for a customer',
    authoritativeSource: 'SalesService.getCustomerLedger',
    sourceTables: ['customers', 'sales_orders', 'sales_payments', 'sales_transactions'],
    readOnly: true,
    supportsPeriod: true,
    supportsNamedEntity: true,
    supportedIntents: ['customer_ledger', 'customer_transactions'],
    keywords: {
      en: ['ledger', 'statement', 'transactions', 'transaction history', 'debit credit'],
      ml: ['ലെഡ്ജർ', 'സ്റ്റേറ്റ്‌മെന്റ്', 'ഇടപാട് ചരിത്രം', 'ട്രാൻസാക്ഷൻ ഹിസ്റ്ററി'],
    },
    exampleQuestions: {
      en: ['Show ledger of ABC Traders', 'Transaction history of customer Sinan'],
      ml: ['ABC Traders-ന്റെ ലെഡ്ജർ കാണിക്കൂ', 'സിനാന്റെ ഇടപാട് ചരിത്രം തരൂ'],
    },
  },
  {
    id: 'customer_payments',
    domain: 'finance',
    entityTypes: ['customer'],
    action: 'payments',
    description: 'Payment receipts collected from customer with payment mode, date, and reference',
    authoritativeSource: 'SalesService.getCustomerSummary / sales_payments',
    sourceTables: ['sales_payments', 'sales_orders', 'customers'],
    readOnly: true,
    supportsPeriod: true,
    supportsNamedEntity: true,
    supportedIntents: ['customer_payments'],
    keywords: {
      en: ['payments', 'paid', 'payment history', 'amount received', 'collections', 'cash paid'],
      ml: ['പേയ്‌മെന്റ്', 'പണം നൽകി', 'അടച്ചു', 'ലഭിച്ച പണം', 'വാങ്ങിയ തുക'],
    },
    exampleQuestions: {
      en: ['What payments did ABC Traders make?', 'How much cash has Sinan paid?'],
      ml: ['ABC Traders എത്ര രൂപ അടച്ചു?', 'സിനാൻ തന്ന പേയ്‌മെന്റുകൾ കാണിക്കൂ'],
    },
  },
  {
    id: 'customer_sales_history',
    domain: 'customers',
    entityTypes: ['customer'],
    action: 'sales',
    description: 'Purchase history / dispatches of a customer over a specific period',
    authoritativeSource: 'KenbyErpRegistryService.getCustomerTransactionsByPeriod',
    sourceTables: ['sales_transactions', 'products', 'customers'],
    readOnly: true,
    supportsPeriod: true,
    supportsNamedEntity: true,
    supportedIntents: ['customer_sales_period', 'customer_ranking_sales'],
    keywords: {
      en: ['bought', 'purchased', 'ordered', 'dispatch history', 'sales to customer'],
      ml: ['വാങ്ങി', 'വാങ്ങിയത്', 'പർച്ചേസ്', 'ഡിസ്പാച്ച്'],
    },
    exampleQuestions: {
      en: ['What did ABC Traders buy in July?', 'Which customer bought the most this month?'],
      ml: ['ജൂലൈയിൽ ABC Traders എന്തൊക്കെ വാങ്ങി?', 'ഈ മാസം ഏറ്റവും കൂടുതൽ വാങ്ങിയ കസ്റ്റമർ ആര്?'],
    },
  },

  // ==========================================
  // 2. PRODUCTS & FINISHED GOODS
  // ==========================================
  {
    id: 'product_list',
    domain: 'products',
    entityTypes: ['product'],
    action: 'list',
    description: 'List all finished goods products with SKUs and categories',
    authoritativeSource: 'KenbyErpRegistryService.listAllProducts',
    sourceTables: ['products', 'product_brands', 'production_stock'],
    readOnly: true,
    supportsPeriod: false,
    supportsNamedEntity: false,
    supportedIntents: ['product_list'],
    keywords: {
      en: ['products', 'all products', 'product list', 'items list', 'skus'],
      ml: ['പ്രോഡക്റ്റുകൾ', 'എല്ലാ പ്രോഡക്റ്റ്', 'പ്രോഡക്റ്റ് ലിസ്റ്റ്'],
    },
    exampleQuestions: {
      en: ['Show all products', 'List all available SKUs'],
      ml: ['എല്ലാ പ്രോഡക്റ്റുകളും കാണിക്കൂ', 'പ്രോഡക്റ്റ് ലിസ്റ്റ് തരൂ'],
    },
  },
  {
    id: 'product_stock',
    domain: 'products',
    entityTypes: ['product'],
    action: 'stock',
    description: 'Current available stock of finished products (cases/jars)',
    authoritativeSource: 'KenbyLiveDataService.getCurrentStock / KenbyErpRegistryService.getProductStockByName',
    sourceTables: ['production_stock', 'products'],
    readOnly: true,
    supportsPeriod: false,
    supportsNamedEntity: true,
    supportedIntents: ['stock_summary', 'product_stock_named', 'product_lowest_stock', 'product_highest_stock'],
    keywords: {
      en: ['product stock', 'finished stock', 'cases in stock', 'jars in stock', 'available product'],
      ml: ['പ്രോഡക്റ്റ് സ്റ്റോക്ക്', 'സ്റ്റോക്ക് എത്ര', 'സ്റ്റോക്ക് നില', 'ലഭ്യമായ സ്റ്റോക്ക്'],
    },
    exampleQuestions: {
      en: ['How much stock of 1L Bottle do we have?', 'Which product has the lowest stock?'],
      ml: ['1L Bottle സ്റ്റോക്ക് എത്രയുണ്ട്?', 'ഏറ്റവും കുറഞ്ഞ സ്റ്റോക്ക് ഉള്ള പ്രോഡക്റ്റ് ഏതാണ്?'],
    },
  },
  {
    id: 'product_profile',
    domain: 'products',
    entityTypes: ['product'],
    action: 'profile',
    description: 'Complete 360-degree profile of a finished product (stock, lifetime production, dispatches, returns)',
    authoritativeSource: 'KenbyErpRegistryService.getProductFullProfile',
    sourceTables: ['products', 'product_brands', 'production_stock', 'sales_transactions'],
    readOnly: true,
    supportsPeriod: false,
    supportsNamedEntity: true,
    supportedIntents: ['product_profile'],
    keywords: {
      en: ['product details', 'product profile', 'full product information', 'about product'],
      ml: ['പ്രോഡക്റ്റ് വിവരങ്ങൾ', 'പ്രോഡക്റ്റ് ഫുൾ പ്രൊഫൈൽ', 'വിശദാംശങ്ങൾ'],
    },
    exampleQuestions: {
      en: ['Give me full details of 20L Jar', 'Show profile of 500ml Bottle'],
      ml: ['20L Jar-ന്റെ മുഴുവൻ വിവരങ്ങൾ തരൂ', '500ml ബോട്ടിൽ പ്രൊഫൈൽ കാണിക്കൂ'],
    },
  },
  {
    id: 'product_sales',
    domain: 'sales',
    entityTypes: ['product'],
    action: 'sales',
    description: 'Sales performance and dispatch volume of a specific product',
    authoritativeSource: 'KenbyLiveDataService.getSalesBreakdown',
    sourceTables: ['sales_transactions', 'products'],
    readOnly: true,
    supportsPeriod: true,
    supportsNamedEntity: true,
    supportedIntents: ['sales_breakdown', 'product_best_selling'],
    keywords: {
      en: ['sales of', 'sold', 'dispatched', 'best selling product', 'top product'],
      ml: ['വിൽപ്പന', 'വിറ്റത്', 'ഏറ്റവും കൂടുതൽ വിറ്റ പ്രോഡക്റ്റ്'],
    },
    exampleQuestions: {
      en: ['How many 1L bottles were sold in July?', 'Which product sold the most this month?'],
      ml: ['ജൂലൈയിൽ എത്ര 1L ബോട്ടിലുകൾ വിറ്റു?', 'ഈ മാസം ഏറ്റവും കൂടുതൽ വിറ്റ പ്രോഡക്റ്റ് ഏതാണ്?'],
    },
  },
  {
    id: 'product_bom',
    domain: 'products',
    entityTypes: ['product'],
    action: 'bom',
    description: 'Bill of materials (raw materials required per unit/case of product)',
    authoritativeSource: 'BatchService / bill_of_materials',
    sourceTables: ['bill_of_materials', 'products', 'inventory_stock'],
    readOnly: true,
    supportsPeriod: false,
    supportsNamedEntity: true,
    supportedIntents: ['product_bom'],
    keywords: {
      en: ['bom', 'bill of materials', 'components', 'materials required', 'recipe'],
      ml: ['BOM', 'ആവശ്യമായ മെറ്റീരിയലുകൾ', 'ഘടകങ്ങൾ'],
    },
    exampleQuestions: {
      en: ['What is the BOM for 1L Bottle?', 'What raw materials are needed for 20L Jar?'],
      ml: ['1L Bottle-ന് എന്തൊക്കെ raw materials വേണം?', '20L Jar-ന്റെ BOM എന്താണ്?'],
    },
  },

  // ==========================================
  // 3. RAW MATERIALS & WAREHOUSE INVENTORY
  // ==========================================
  {
    id: 'raw_material_stock',
    domain: 'raw_materials',
    entityTypes: ['raw_material'],
    action: 'stock',
    description: 'Current inventory stock of raw materials (Preforms, Caps, Labels, Shrinks) with exact units',
    authoritativeSource: 'KenbyErpRegistryService.getRawMaterialStockSummary / KenbyErpRegistryService.getRawMaterialProfile',
    sourceTables: ['raw_materials', 'inventory_stock'],
    readOnly: true,
    supportsPeriod: false,
    supportsNamedEntity: true,
    supportedIntents: ['raw_material_summary', 'raw_material_item', 'raw_material_lowest'],
    keywords: {
      en: ['raw material', 'material stock', 'preform stock', 'cap stock', 'label stock', 'shrink stock'],
      ml: ['റോ മെറ്റീരിയൽ', 'മെറ്റീരിയൽ സ്റ്റോക്ക്', 'പ്രീഫോം സ്റ്റോക്ക്', 'ക്യാപ് സ്റ്റോക്ക്', 'ലേബൽ സ്റ്റോക്ക്'],
    },
    exampleQuestions: {
      en: ['How much Green Cap stock is there?', 'Which raw material is running low?'],
      ml: ['Green Cap സ്റ്റോക്ക് എത്രയുണ്ട്?', 'ഏറ്റവും കുറഞ്ഞ raw material ഏതാണ്?'],
    },
  },
  {
    id: 'raw_material_movements',
    domain: 'raw_materials',
    entityTypes: ['raw_material'],
    action: 'movements',
    description: 'Raw material inward, outward, and consumption transaction history',
    authoritativeSource: 'KenbyErpRegistryService.getRawMaterialProfile',
    sourceTables: ['raw_material_transactions', 'raw_materials'],
    readOnly: true,
    supportsPeriod: true,
    supportsNamedEntity: true,
    supportedIntents: ['raw_material_movements'],
    keywords: {
      en: ['material movements', 'raw material transactions', 'material consumed', 'material usage'],
      ml: ['മെറ്റീരിയൽ മൂവ്മെന്റ്', 'ഉപയോഗിച്ച മെറ്റീരിയൽ', 'ഇടപാടുകൾ'],
    },
    exampleQuestions: {
      en: ['Show Green Cap transaction history', 'Raw material movements this week'],
      ml: ['Green Cap ട്രാൻസാക്ഷൻ ഹിസ്റ്ററി കാണിക്കൂ', 'റോ മെറ്റീരിയൽ മൂവ്മെന്റ്സ് കാണിക്കൂ'],
    },
  },
  {
    id: 'warehouse_stock',
    domain: 'warehouse',
    entityTypes: ['warehouse_location'],
    action: 'stock',
    description: 'Physical warehouse inventory stock items grouped by warehouse location',
    authoritativeSource: 'InventoryService.getInventory / KenbyErpRegistryService.getInventoryStockSummary',
    sourceTables: ['inventory_stock', 'warehouse_locations'],
    readOnly: true,
    supportsPeriod: false,
    supportsNamedEntity: true,
    supportedIntents: ['inventory_stock_summary'],
    keywords: {
      en: ['warehouse stock', 'inventory stock', 'warehouse inventory', 'factory warehouse'],
      ml: ['വെയർഹൗസ് സ്റ്റോക്ക്', 'ഇൻവെന്ററി സ്റ്റോക്ക്', 'വെയർഹൗസ് നില'],
    },
    exampleQuestions: {
      en: ['Show warehouse inventory stock', 'What is in Raw Material Warehouse?'],
      ml: ['വെയർഹൗസ് ഇൻവെന്ററി സ്റ്റോക്ക് കാണിക്കൂ', 'വെയർഹൗസിൽ എന്തൊക്കെ സ്റ്റോക്കുണ്ട്?'],
    },
  },
  {
    id: 'warehouse_ledger',
    domain: 'warehouse',
    entityTypes: ['warehouse_location', 'raw_material'],
    action: 'ledger',
    description: 'Detailed material audit ledger tracking every inward, issue, and scrap event',
    authoritativeSource: 'InventoryService.getMaterialLedger',
    sourceTables: ['inventory_ledger', 'inventory_transactions'],
    readOnly: true,
    supportsPeriod: true,
    supportsNamedEntity: true,
    supportedIntents: ['warehouse_ledger'],
    keywords: {
      en: ['material ledger', 'inventory transactions', 'stock ledger', 'stock movements'],
      ml: ['ഇൻവെന്ററി ലെഡ്ജർ', 'സ്റ്റോക്ക് ലെഡ്ജർ'],
    },
    exampleQuestions: {
      en: ['Show material ledger for Preforms', 'Recent warehouse stock transactions'],
      ml: ['പ്രീഫോമിന്റെ മെറ്റീരിയൽ ലെഡ്ജർ കാണിക്കൂ'],
    },
  },

  // ==========================================
  // 4. PRODUCTION & PLANT OPERATIONS
  // ==========================================
  {
    id: 'production_summary',
    domain: 'production',
    entityTypes: ['product'],
    action: 'production',
    description: 'Production packing output (cases and bottles produced, scrap, and logs)',
    authoritativeSource: 'KenbyLiveDataService.getProductionSummary',
    sourceTables: ['production_logs', 'production_batches'],
    readOnly: true,
    supportsPeriod: true,
    supportsNamedEntity: false,
    supportedIntents: ['production_summary'],
    keywords: {
      en: ['production', 'produced', 'cases produced', 'bottles produced', 'packing output', 'plant output'],
      ml: ['പ്രൊഡക്ഷൻ', 'ഉൽപ്പാദനം', 'ഉൽപ്പാദിപ്പിച്ചത്', 'ഇന്നത്തെ പ്രൊഡക്ഷൻ'],
    },
    exampleQuestions: {
      en: ["Show today's production", 'How many cases were produced this month?'],
      ml: ['ഇന്നത്തെ പ്രൊഡക്ഷൻ എത്ര?', 'ഈ മാസം എത്ര കേസുകൾ ഉൽപ്പാദിപ്പിച്ചു?'],
    },
  },
  {
    id: 'production_breakdown',
    domain: 'production',
    entityTypes: ['product'],
    action: 'breakdown',
    description: 'Production packing output broken down product-wise',
    authoritativeSource: 'KenbyLiveDataService.getProductionBreakdown',
    sourceTables: ['production_logs', 'production_batches', 'products'],
    readOnly: true,
    supportsPeriod: true,
    supportsNamedEntity: true,
    supportedIntents: ['production_breakdown'],
    keywords: {
      en: ['production breakdown', 'production by product', 'product wise production'],
      ml: ['പ്രൊഡക്ഷൻ ബ്രേക്ക്ഡൗൺ', 'പ്രോഡക്റ്റ് തിരിച്ചുള്ള പ്രൊഡക്ഷൻ'],
    },
    exampleQuestions: {
      en: ['Show production breakdown for July', 'How many 1L and 500ml were produced today?'],
      ml: ['ജൂലൈയിലെ പ്രൊഡക്ഷൻ ബ്രേക്ക്ഡൗൺ കാണിക്കൂ', 'ഇന്ന് ഏതെല്ലാം പ്രോഡക്റ്റുകൾ ഉൽപ്പാദിപ്പിച്ചു?'],
    },
  },
  {
    id: 'production_batches',
    domain: 'production',
    entityTypes: ['batch'],
    action: 'status',
    description: 'Active/running production batches, target vs produced quantities, and line status',
    authoritativeSource: 'BatchService / KenbyErpRegistryService.getProductionBatchesSummary',
    sourceTables: ['production_batches', 'production_lines', 'products'],
    readOnly: true,
    supportsPeriod: false,
    supportsNamedEntity: true,
    supportedIntents: ['production_batches'],
    keywords: {
      en: ['batches', 'active batches', 'running batch', 'batch code', 'batch status'],
      ml: ['ബാച്ചുകൾ', 'റണ്ണിംഗ് ബാച്ച്', 'ആക്ടീവ് ബാച്ച്', 'ബാച്ച് കോഡ്'],
    },
    exampleQuestions: {
      en: ['Show active production batches', 'Details of batch B-2026-08'],
      ml: ['റണ്ണിംഗ് പ്രൊഡക്ഷൻ ബാച്ചുകൾ കാണിക്കൂ', 'ആക്ടീവ് ബാച്ച് ഏതാണ്?'],
    },
  },
  {
    id: 'production_downtime',
    domain: 'production',
    entityTypes: ['production_line'],
    action: 'downtime',
    description: 'Plant machine downtime logs, station breakdowns, and incident reasons',
    authoritativeSource: 'KenbyErpRegistryService.getDowntimeSummary',
    sourceTables: ['downtime_logs'],
    readOnly: true,
    supportsPeriod: false,
    supportsNamedEntity: false,
    supportedIntents: ['production_downtime'],
    keywords: {
      en: ['downtime', 'machine breakdown', 'breakdown reasons', 'stoppage', 'faults'],
      ml: ['ഡൗൺടൈം', 'മെഷീൻ തകരാർ', 'തകരാറുകൾ', 'ബ്രേക്ക്ഡൗൺ'],
    },
    exampleQuestions: {
      en: ['Show recent machine downtime reasons', 'Any machine breakdowns today?'],
      ml: ['മെഷീൻ തകരാറുകളുടെ കാരണങ്ങൾ എന്തൊക്കെ?', 'ഇന്ന് ഡൗൺടൈം ഉണ്ടായോ?'],
    },
  },

  // ==========================================
  // 5. SALES, RETURNS & DAMAGES
  // ==========================================
  {
    id: 'sales_summary',
    domain: 'sales',
    entityTypes: ['product'],
    action: 'summary',
    description: 'Sales dispatch totals, volume in cases, and transaction counts across time periods',
    authoritativeSource: 'KenbyLiveDataService.getSalesSummary',
    sourceTables: ['sales_transactions'],
    readOnly: true,
    supportsPeriod: true,
    supportsNamedEntity: false,
    supportedIntents: ['sales_summary'],
    keywords: {
      en: ['sales', 'dispatch', 'total sales', 'sales this month', 'how much sold'],
      ml: ['സെയിൽസ്', 'വിൽപ്പന', 'ഡിസ്പാച്ച്', 'ഈ മാസത്തെ സെയിൽസ്'],
    },
    exampleQuestions: {
      en: ['How many sales did we make this month?', 'Show July sales dispatches'],
      ml: ['ഈ മാസം എത്ര സെയിൽസ് നടന്നു?', 'ജൂലൈയിലെ സെയിൽസ് കാണിക്കൂ'],
    },
  },
  {
    id: 'sales_returns',
    domain: 'sales',
    entityTypes: ['product'],
    action: 'returns',
    description: 'Sales return quantities and product-wise return breakdowns',
    authoritativeSource: 'KenbyLiveDataService.getSalesReturnSummary',
    sourceTables: ['sales_transactions', 'products'],
    readOnly: true,
    supportsPeriod: true,
    supportsNamedEntity: true,
    supportedIntents: ['sales_return_summary', 'return_breakdown'],
    keywords: {
      en: ['returns', 'sales returns', 'returned products', 'customer returns'],
      ml: ['റിട്ടേൺ', 'സെയിൽസ് റിട്ടേൺ', 'തിരികെ വന്നത്'],
    },
    exampleQuestions: {
      en: ['Show sales returns this month', 'Which products had the most returns?'],
      ml: ['ഈ മാസത്തെ സെയിൽസ് റിട്ടേൺ എത്ര?', 'ഏറ്റവും കൂടുതൽ റിട്ടേൺ വന്ന പ്രോഡക്റ്റ് ഏതാണ്?'],
    },
  },
  {
    id: 'sales_damages',
    domain: 'sales',
    entityTypes: ['product'],
    action: 'damage',
    description: 'Damaged bottles/cases recorded during transit or dispatch',
    authoritativeSource: 'KenbyLiveDataService.getDamageSummary',
    sourceTables: ['sales_transactions', 'products'],
    readOnly: true,
    supportsPeriod: true,
    supportsNamedEntity: true,
    supportedIntents: ['damage_summary', 'damage_breakdown'],
    keywords: {
      en: ['damage', 'damaged bottles', 'transit damage', 'broken cases'],
      ml: ['ഡാമേജ്', 'കേടുപാടുകൾ', 'നഷ്ടപ്പെട്ടത്'],
    },
    exampleQuestions: {
      en: ['Show damage summary for this month', 'How much damage in July?'],
      ml: ['ഈ മാസത്തെ ഡാമേജ് എത്ര?', 'ജൂലൈയിൽ എത്ര ഡാമേജ് ഉണ്ടായി?'],
    },
  },
  {
    id: 'business_snapshot',
    domain: 'sales',
    entityTypes: [],
    action: 'summary',
    description: 'Comprehensive business health overview combining sales, production, stock, returns, and damages',
    authoritativeSource: 'KenbyLiveDataService.getBusinessSnapshot',
    sourceTables: ['sales_transactions', 'production_logs', 'production_stock'],
    readOnly: true,
    supportsPeriod: true,
    supportsNamedEntity: false,
    supportedIntents: ['business_snapshot'],
    keywords: {
      en: ['business overview', 'company snapshot', 'business health', 'monthly overview'],
      ml: ['ബിസിനസ് അവലോകനം', 'മൊത്തത്തിലുള്ള ബിസിനസ് നില', 'ഓവർവ്യൂ'],
    },
    exampleQuestions: {
      en: ['Give me a business snapshot for this month', 'Monthly company overview'],
      ml: ['ഈ മാസത്തെ ബിസിനസ് അവലോകനം തരൂ', 'കമ്പനി ഓവർവ്യൂ കാണിക്കൂ'],
    },
  },

  // ==========================================
  // 6. PROCUREMENT & VENDORS
  // ==========================================
  {
    id: 'vendor_list',
    domain: 'procurement',
    entityTypes: ['vendor'],
    action: 'list',
    description: 'Directory of registered vendors, suppliers, contact persons, and payment terms',
    authoritativeSource: 'ProcurementService.getVendors / KenbyErpRegistryService.listVendors',
    sourceTables: ['vendors'],
    readOnly: true,
    supportsPeriod: false,
    supportsNamedEntity: true,
    supportedIntents: ['vendor_list'],
    keywords: {
      en: ['vendors', 'suppliers', 'all vendors', 'vendor list', 'supplier details'],
      ml: ['വെണ്ടർമാർ', 'സപ്ലയർമാർ', 'വെണ്ടർ ലിസ്റ്റ്', 'സപ്ലയർ വിവരങ്ങൾ'],
    },
    exampleQuestions: {
      en: ['Show all registered vendors', 'List our suppliers'],
      ml: ['എല്ലാ വെണ്ടർമാരെയും കാണിക്കൂ', 'സപ്ലയർ ലിസ്റ്റ് തരൂ'],
    },
  },
  {
    id: 'purchase_orders',
    domain: 'procurement',
    entityTypes: ['vendor'],
    action: 'summary',
    description: 'Purchase orders summary and status tracking (Draft, Pending Approval, Received)',
    authoritativeSource: 'ProcurementService.getPurchaseOrders / KenbyErpRegistryService.getPurchaseOrdersSummary',
    sourceTables: ['purchase_orders', 'vendors'],
    readOnly: true,
    supportsPeriod: false,
    supportsNamedEntity: true,
    supportedIntents: ['purchase_orders_summary'],
    keywords: {
      en: ['purchase orders', 'po status', 'pending pos', 'open purchase orders'],
      ml: ['പർച്ചേസ് ഓർഡറുകൾ', 'PO സ്റ്റാറ്റസ്', 'പെൻഡിംഗ് PO'],
    },
    exampleQuestions: {
      en: ['Show purchase orders summary', 'Any open POs?'],
      ml: ['പർച്ചേസ് ഓർഡറുകളുടെ സ്റ്റാറ്റസ് കാണിക്കൂ', 'ഓപ്പൺ PO ഉണ്ടോ?'],
    },
  },
  {
    id: 'goods_receipts',
    domain: 'procurement',
    entityTypes: ['vendor'],
    action: 'grn',
    description: 'Goods receipt notes (GRN) for supplier materials received at the factory',
    authoritativeSource: 'ProcurementService.getGoodsReceipts',
    sourceTables: ['goods_receipts', 'goods_receipt_items', 'vendors'],
    readOnly: true,
    supportsPeriod: true,
    supportsNamedEntity: true,
    supportedIntents: ['goods_receipts'],
    keywords: {
      en: ['goods receipts', 'grn', 'material received', 'supplier deliveries'],
      ml: ['GRN', 'ലഭിച്ച സാധനങ്ങൾ', 'ഡെലിവറികൾ'],
    },
    exampleQuestions: {
      en: ['Show recent goods receipts', 'What materials were received from suppliers?'],
      ml: ['അടുത്തിടെ ലഭിച്ച GRN കാണിക്കൂ', 'സപ്ലയേഴ്സിൽ നിന്ന് സാധനങ്ങൾ എത്തിയോ?'],
    },
  },

  // ==========================================
  // 7. INCIDENTS & PLANT SAFETY
  // ==========================================
  {
    id: 'incident_summary',
    domain: 'incidents',
    entityTypes: ['incident'],
    action: 'summary',
    description: 'Factory breakdown incidents, open tickets, priorities, and SLA resolutions',
    authoritativeSource: 'IncidentsService / KenbyErpRegistryService.getIncidentsSummary',
    sourceTables: ['incidents', 'incident_types', 'production_lines'],
    readOnly: true,
    supportsPeriod: false,
    supportsNamedEntity: true,
    supportedIntents: ['incident_summary'],
    keywords: {
      en: ['incidents', 'breakdown tickets', 'open incidents', 'factory accidents', 'plant incidents'],
      ml: ['ഇൻസിഡന്റുകൾ', 'തകരാർ ടിക്കറ്റുകൾ', 'ഓപ്പൺ ഇൻസിഡന്റുകൾ', 'അപകടങ്ങൾ'],
    },
    exampleQuestions: {
      en: ['Show open factory incidents', 'Any unresolved incidents today?'],
      ml: ['ഓപ്പൺ ആയ ഇൻസിഡന്റുകൾ കാണിക്കൂ', 'ഇന്ന് എന്തെങ്കിലും ബ്രേക്ക്ഡൗൺ ഉണ്ടായോ?'],
    },
  },

  // ==========================================
  // 8. RAG KNOWLEDGE / BUSINESS DEFINITIONS
  // ==========================================
  {
    id: 'knowledge_definition',
    domain: 'plant_operations',
    entityTypes: [],
    action: 'summary',
    description: 'Static business definitions, SOPs, ERP process explanations, and knowledge docs',
    authoritativeSource: 'KenbyRagService.retrieveKnowledge',
    sourceTables: ['kenby_ai_documents'],
    readOnly: true,
    supportsPeriod: false,
    supportsNamedEntity: false,
    supportedIntents: ['knowledge', 'why_explanation'],
    keywords: {
      en: ['what is', 'explain', 'meaning of', 'definition', 'how it works', 'sop'],
      ml: ['എന്താണ്', 'വിശദീകരിക്കൂ', 'അർത്ഥം', 'എങ്ങനെ പ്രവർത്തിക്കുന്നു'],
    },
    exampleQuestions: {
      en: ['What is a sales dispatch?', 'Explain production workflow'],
      ml: ['സെയിൽസ് ഡിസ്പാച്ച് എന്നാൽ എന്താണ്?', 'പ്രൊഡക്ഷൻ എങ്ങനെയാണ് പ്രവർത്തിക്കുന്നത്?'],
    },
  },
];

/**
 * Capability Lookup Helper
 */
export function findCapabilityById(id: string): ErpCapability | undefined {
  return ERP_CAPABILITIES.find((c) => c.id === id);
}

export function findCapabilitiesByDomain(domain: ErpDomain): ErpCapability[] {
  return ERP_CAPABILITIES.filter((c) => c.domain === domain);
}

export function findCapabilitiesByEntityType(entityType: ErpEntityType): ErpCapability[] {
  return ERP_CAPABILITIES.filter((c) => c.entityTypes.includes(entityType));
}
