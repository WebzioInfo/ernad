import { ResolvedDateRange } from '../dates/kenby-date-resolver.service';
import { ResolvedEntity } from '../kenby-entity-resolver.service';

export type QueryIntent =
  | 'ENTITY_LIST'
  | 'ENTITY_STOCK'
  | 'ENTITY_DETAILS'
  | 'TRANSACTION_HISTORY'
  | 'TRANSACTION_TOTAL'
  | 'PERIOD_SUMMARY'
  | 'FULL_ERP_SUMMARY'
  | 'CONCEPTUAL'
  | 'HYBRID'
  | 'UNSUPPORTED_FINANCIAL'
  | 'CLARIFICATION'
  | 'CLARIFICATION_REQUIRED'
  | 'UNKNOWN';

export type ErpDomain =
  | 'sales'
  | 'sales_dispatch'
  | 'returns'
  | 'damage'
  | 'production'
  | 'inventory'
  | 'raw_materials'
  | 'customers'
  | 'vendors'
  | 'procurement'
  | 'ledger'
  | 'staff';

export interface QueryScope {
  intent: QueryIntent;
  domains: ErpDomain[];
  entities: {
    products: ResolvedEntity[];
    customers: ResolvedEntity[];
    rawMaterials: ResolvedEntity[];
    vendors: ResolvedEntity[];
  };
  period: ResolvedDateRange | null;
  transactionTypes: string[];
  answerMode: 'single_value' | 'summary' | 'details' | 'history' | 'full_report' | 'list';
  scopeExplicitness: 'specific' | 'broad';
  requiresMultiDomainExecution: boolean;
  requiresClarification?: boolean;
  clarificationMessage?: {
    ml: string;
    en: string;
  } | null;
}

export interface DomainExecutionResult {
  domain: ErpDomain;
  supported: boolean;
  queried: boolean;
  recordCount: number;
  data: any;
  summaryText?: string;
}

export interface FullErpSummaryData {
  period: ResolvedDateRange | null;
  sales: any;
  returns: any;
  damage: any;
  production: any;
  inventory: any;
  rawMaterials: any[];
  customers: any[];
}
