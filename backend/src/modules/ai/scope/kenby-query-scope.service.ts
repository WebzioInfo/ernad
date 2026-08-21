import { Injectable, Logger } from '@nestjs/common';
import { KenbyDateResolverService } from '../dates/kenby-date-resolver.service';
import { KenbyEntityResolverService } from '../kenby-entity-resolver.service';
import { QueryScope, ErpDomain } from './kenby-query-scope.interface';

@Injectable()
export class KenbyQueryScopeService {
  private readonly logger = new Logger(KenbyQueryScopeService.name);

  constructor(
    private readonly dateResolver: KenbyDateResolverService,
    private readonly entityResolver: KenbyEntityResolverService
  ) {}

  /**
   * Resolves the complete scope, explicit domains, entities, and execution modes for any query.
   * STRICT GUARANTEE: Never defaults an unknown/ambiguous query to stock.
   */
  async resolveScope(userQuestion: string, conversationContext?: any): Promise<QueryScope> {
    const rawQ = (userQuestion || '').trim();
    const qLower = rawQ.toLowerCase();

    // 1. Resolve Exact Date/Period
    const period = this.dateResolver.resolveDateBounds({ question: rawQ, ...conversationContext });

    // 2. Financial Safety Guardrail Detection
    if (
      qLower.includes('net profit') ||
      qLower.includes('balance sheet') ||
      qLower.includes('profit and loss') ||
      qLower.includes('ലാഭം') ||
      qLower.includes('നഷ്ടം')
    ) {
      return {
        intent: 'UNSUPPORTED_FINANCIAL',
        domains: [],
        entities: { products: [], customers: [], rawMaterials: [], vendors: [] },
        period,
        transactionTypes: [],
        answerMode: 'single_value',
        scopeExplicitness: 'specific',
        requiresMultiDomainExecution: false,
      };
    }

    // 3. BROAD / FULL ERP COMPOSITE SUMMARY DETECTION
    const isBroadAll =
      qLower.includes('total data') ||
      qLower.includes('all data') ||
      qLower.includes('complete data') ||
      qLower.includes('full details') ||
      qLower.includes('overall summary') ||
      qLower.includes('monthly summary') ||
      qLower.includes('company summary') ||
      qLower.includes('all activity') ||
      qLower.includes('full report') ||
      qLower.includes('total details') ||
      qLower.includes('മുഴുവൻ data') ||
      qLower.includes('എല്ലാ data') ||
      qLower.includes('മുഴുവൻ details');

    // If broad and NOT restricted to a single domain
    const hasSpecificDomainKeyword =
      qLower.includes('sales only') ||
      qLower.includes('production only') ||
      qLower.includes('stock only') ||
      qLower.includes('damage only');

    if (isBroadAll && !hasSpecificDomainKeyword) {
      return {
        intent: 'FULL_ERP_SUMMARY',
        domains: ['sales', 'returns', 'damage', 'production', 'inventory', 'raw_materials', 'customers'],
        entities: { products: [], customers: [], rawMaterials: [], vendors: [] },
        period,
        transactionTypes: ['SALES_DISPATCH', 'SALES_RETURN', 'DAMAGE'],
        answerMode: 'full_report',
        scopeExplicitness: 'broad',
        requiresMultiDomainExecution: true,
      };
    }

    // 4. Entity Extraction
    const resolvedEntities = await this.extractEntities(rawQ, conversationContext);

    // 5. Domain Keyword Matches
    const isHistory =
      qLower.includes('history') ||
      qLower.includes('transactions') ||
      qLower.includes('logs') ||
      qLower.includes('ഇടപാടുകൾ') ||
      qLower.includes('റെക്കോർഡുകൾ') ||
      qLower.includes('ഹിസ്റ്ററി') ||
      qLower.includes('ചരിത്രം') ||
      qLower.includes('വാങ്ങി');

    const isDamage =
      qLower.includes('damage') ||
      qLower.includes('ഡാമേജ്') ||
      qLower.includes('കേസ് ഡാമേജ്') ||
      qLower.includes('damaged') ||
      qLower.includes('കേടുപാടുകൾ');

    const isReturns =
      qLower.includes('return') ||
      qLower.includes('റിട്ടേൺ') ||
      qLower.includes('തിരിച്ചയക്കൽ');

    const isProduction =
      qLower.includes('production') ||
      qLower.includes('നിർമ്മാണം') ||
      qLower.includes('ഉത്പാദനം') ||
      qLower.includes('batch') ||
      qLower.includes('downtime');

    const isRawMaterial =
      qLower.includes('raw material') ||
      qLower.includes('റോ മെറ്റീരിയൽ') ||
      qLower.includes('cap') ||
      qLower.includes('green cap') ||
      qLower.includes('preform') ||
      qLower.includes('bottle (preform)') ||
      qLower.includes('label') ||
      resolvedEntities.rawMaterials.length > 0;

    const isStock =
      qLower.includes('stock') ||
      qLower.includes('സ്റ്റോക്ക്') ||
      qLower.includes('ഇരിപ്പ്') ||
      qLower.includes('ബാക്കി') ||
      qLower.includes('ലഭ്യം');

    const isSales =
      qLower.includes('sales') ||
      qLower.includes('dispatch') ||
      qLower.includes('സെയിൽസ്') ||
      qLower.includes('വിൽപ്പന') ||
      qLower.includes('വാങ്ങി');

    const isLedgerOrBalance =
      qLower.includes('balance') ||
      qLower.includes('outstanding') ||
      qLower.includes('കുടിശ്ശിക') ||
      qLower.includes('ledger') ||
      qLower.includes('കടം');

    const isCustomer =
      qLower.includes('customer') ||
      qLower.includes('കസ്റ്റമർ') ||
      resolvedEntities.customers.length > 0;

    const isProduct =
      qLower.includes('product') ||
      qLower.includes('ഉൽപ്പന്ന') ||
      resolvedEntities.products.length > 0;

    const isVendor =
      qLower.includes('vendor') ||
      qLower.includes('supplier') ||
      qLower.includes('സപ്ലയർ') ||
      resolvedEntities.vendors.length > 0;

    // 6. Intent and Domain Resolution with Strict Priority
    let intent: QueryScope['intent'] = 'UNKNOWN';
    let domains: ErpDomain[] = [];
    let answerMode: QueryScope['answerMode'] = 'summary';
    let requiresClarification = false;
    let clarificationMessage: { ml: string; en: string } | null = null;

    // ── DAMAGE INTENT (HIGHEST PRIORITY TO AVOID WRONG ROUTING) ──
    if (isDamage) {
      domains.push('damage');
      if (isHistory) {
        intent = 'TRANSACTION_HISTORY';
        answerMode = 'history';
      } else {
        intent = 'PERIOD_SUMMARY';
        answerMode = qLower.includes('detail') ? 'details' : 'summary';
      }
    }
    // ── RETURN INTENT ──
    else if (isReturns) {
      domains.push('returns');
      if (isHistory) {
        intent = 'TRANSACTION_HISTORY';
        answerMode = 'history';
      } else {
        intent = 'PERIOD_SUMMARY';
        answerMode = qLower.includes('detail') ? 'details' : 'summary';
      }
    }
    // ── RAW MATERIALS INTENT ──
    else if (isRawMaterial) {
      domains.push('raw_materials');
      if (isHistory) {
        intent = 'TRANSACTION_HISTORY';
        answerMode = 'history';
      } else if (resolvedEntities.rawMaterials.length > 0 || isStock) {
        intent = 'ENTITY_STOCK';
        answerMode = 'single_value';
      } else {
        intent = 'ENTITY_LIST';
        answerMode = 'list';
      }
    }
    // ── TRANSACTION HISTORY (SALES / CUSTOMER) ──
    else if (isHistory) {
      intent = 'TRANSACTION_HISTORY';
      domains.push('sales');
      if (isCustomer) domains.push('customers');
      answerMode = 'history';
    }
    // ── CUSTOMER BALANCE / OUTSTANDING ──
    else if (isCustomer && isLedgerOrBalance) {
      intent = 'ENTITY_DETAILS';
      domains.push('ledger', 'customers');
      answerMode = 'single_value';
    }
    // ── CUSTOMER LIST OR PROFILE ──
    else if (isCustomer && !isSales) {
      if (resolvedEntities.customers.length > 0) {
        intent = 'ENTITY_DETAILS';
        domains.push('customers');
        answerMode = 'details';
      } else {
        intent = 'ENTITY_LIST';
        domains.push('customers');
        answerMode = 'list';
      }
    }
    // ── PRODUCTION INTENT ──
    else if (isProduction) {
      intent = 'PERIOD_SUMMARY';
      domains.push('production');
      answerMode = qLower.includes('detail') ? 'details' : 'summary';
    }
    // ── SALES / DISPATCH INTENT ──
    else if (isSales) {
      intent = 'PERIOD_SUMMARY';
      domains.push('sales');
      if (isCustomer) domains.push('customers');
      answerMode = qLower.includes('detail') ? 'details' : 'summary';
    }
    // ── PRODUCT STOCK OR LIST ──
    else if (isProduct || isStock) {
      domains.push('inventory');
      if (resolvedEntities.products.length > 0 || isStock) {
        intent = 'ENTITY_STOCK';
        answerMode = 'single_value';
      } else {
        intent = 'ENTITY_LIST';
        answerMode = 'list';
      }
    }
    // ── VENDORS LIST ──
    else if (isVendor) {
      domains.push('vendors');
      intent = 'ENTITY_LIST';
      answerMode = 'list';
    }
    // ── STRICT SAFETY: UNKNOWN INTENT (NEVER DEFAULT TO STOCK!) ──
    else {
      intent = 'CLARIFICATION_REQUIRED';
      requiresClarification = true;
      clarificationMessage = {
        ml: 'ക്ഷമിക്കണം, താങ്കൾ ചോദിച്ച വിഷയം വ്യക്തമായില്ല. വിൽപ്പന, ഉത്പാദനം, സ്റ്റോക്ക്, ഡാമേജ്, റിട്ടേൺ അല്ലെങ്കിൽ കസ്റ്റമർ വിവരങ്ങളിൽ ഏതാണ് താങ്കൾക്ക് അറിയേണ്ടത്?',
        en: 'I did not quite understand your request. Could you please specify if you want information regarding Sales, Production, Stock, Damage, Returns, or Customers?',
      };
    }

    return {
      intent,
      domains,
      entities: resolvedEntities,
      period,
      transactionTypes: isDamage ? ['DAMAGE'] : isReturns ? ['SALES_RETURN'] : isSales ? ['SALES_DISPATCH'] : [],
      answerMode,
      scopeExplicitness: 'specific',
      requiresMultiDomainExecution: false,
      requiresClarification,
      clarificationMessage,
    };
  }

  private async extractEntities(text: string, context?: any) {
    const products = [];
    const customers = [];
    const rawMaterials = [];
    const vendors = [];

    const words = text.split(/\s+/).filter((w) => w.length >= 3);
    for (const w of words) {
      const res = await this.entityResolver.resolveEntity(w);
      if (res.entity) {
        if (res.entity.type === 'product') products.push(res.entity);
        else if (res.entity.type === 'customer') customers.push(res.entity);
        else if (res.entity.type === 'raw_material') rawMaterials.push(res.entity);
        else if (res.entity.type === 'vendor') vendors.push(res.entity);
      }
    }

    // Context inheritance only if current query does not specify a different explicit entity
    if (context?.customer && customers.length === 0 && !text.toLowerCase().includes('product') && !text.toLowerCase().includes('material')) {
      customers.push({ type: 'customer' as any, id: 'context-cust', name: context.customer, confidence: 0.9 });
    }
    if (context?.product && products.length === 0 && !text.toLowerCase().includes('customer') && !text.toLowerCase().includes('material')) {
      products.push({ type: 'product' as any, id: 'context-prod', name: context.product, confidence: 0.9 });
    }

    return { products, customers, rawMaterials, vendors };
  }
}
