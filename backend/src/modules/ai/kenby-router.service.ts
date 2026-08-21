import { Injectable, Logger } from '@nestjs/common';
import { SalesSummaryPeriodInput } from './kenby-live-data.service';
import { KenbyEntityResolverService, ResolvedEntity } from './kenby-entity-resolver.service';
import { KenbyCapabilityResolverService } from './kenby-capability-resolver.service';
import * as https from 'https';

export type KenbyIntentType =
  | 'knowledge'
  | 'sales_summary'
  | 'production_summary'
  | 'stock_summary'
  | 'stock_breakdown'
  | 'sales_return_summary'
  | 'damage_summary'
  | 'business_snapshot'
  | 'why_explanation'
  | 'sales_breakdown'
  | 'return_breakdown'
  | 'damage_breakdown'
  | 'production_breakdown'
  | 'business_analysis'
  | 'customer_count'
  | 'customer_list'
  | 'customer_profile'
  | 'customer_balance'
  | 'customer_ranking_debt'
  | 'customer_ranking_sales'
  | 'customer_transactions'
  | 'customer_sales_period'
  | 'customer_payments'
  | 'customer_ledger'
  | 'raw_material_summary'
  | 'raw_material_item'
  | 'raw_material_lowest'
  | 'raw_material_movements'
  | 'product_profile'
  | 'product_list'
  | 'product_stock_named'
  | 'product_lowest_stock'
  | 'product_highest_stock'
  | 'product_best_selling'
  | 'product_bom'
  | 'inventory_stock_summary'
  | 'vendor_list'
  | 'purchase_orders_summary'
  | 'goods_receipts'
  | 'production_batches'
  | 'production_downtime'
  | 'incident_summary'
  | 'hybrid'
  | 'context_correction'
  | 'clarification_prompt'
  | 'greeting'
  | 'unknown';

export interface KenbyConversationContext {
  activeTopic?: 'sales' | 'production' | 'stock' | 'returns' | 'damage' | 'business' | 'knowledge' | 'customers' | 'raw_materials' | 'procurement' | 'finance' | 'plant_operations' | 'incidents' | 'warehouse' | null;
  primaryPeriod?: SalesSummaryPeriodInput | any | null;
  comparisonPeriod?: SalesSummaryPeriodInput | any | null;
  metric?: string | null;
  product?: string | null;
  customer?: string | null;
  rawMaterial?: string | null;
  lastMeaningfulEntity?: { type: 'product' | 'comparison' | 'metric' | 'customer' | 'raw_material'; value: any } | null;
  lastEntity?: {
    type: string;
    id: string;
    name: string;
  } | null;
  lastAnswer?: any | null;
  lastIntent?: KenbyIntentType | null;
  pendingAmbiguity?: { metric: string; options: SalesSummaryPeriodInput[] } | null;
  language?: 'ml' | 'en';
  entities?: Record<string, any>;

  // Backward Compatibility Properties
  lastMetric?: 'sales' | 'production' | 'stock' | 'returns' | 'damage' | 'business' | 'knowledge' | 'customers' | 'raw_materials' | 'procurement' | 'finance' | 'plant_operations' | 'incidents' | 'warehouse' | null;
  lastPeriod?: SalesSummaryPeriodInput | any | null;
  lastProduct?: string | null;
  lastCustomer?: string | null;
}

export type KenbyIntent =
  | {
      type: 'knowledge';
      query: string;
      topic?: string;
    }
  | {
      type: 'sales_summary';
      input: SalesSummaryPeriodInput;
      productFilter?: string;
    }
  | {
      type: 'production_summary';
      input: SalesSummaryPeriodInput;
      productFilter?: string;
    }
  | {
      type: 'stock_summary';
      productFilter?: string;
    }
  | {
      type: 'stock_breakdown';
      productFilter?: string;
    }
  | {
      type: 'sales_return_summary';
      input: SalesSummaryPeriodInput;
      productFilter?: string;
    }
  | {
      type: 'damage_summary';
      input: SalesSummaryPeriodInput;
      productFilter?: string;
    }
  | {
      type: 'sales_breakdown';
      input: SalesSummaryPeriodInput;
      productFilter?: string;
    }
  | {
      type: 'return_breakdown';
      input: SalesSummaryPeriodInput;
      productFilter?: string;
    }
  | {
      type: 'damage_breakdown';
      input: SalesSummaryPeriodInput;
      productFilter?: string;
    }
  | {
      type: 'production_breakdown';
      input: SalesSummaryPeriodInput;
      productFilter?: string;
    }
  | {
      type: 'business_analysis';
      input: SalesSummaryPeriodInput;
      metrics: string[];
      queryMode: 'multi_metric' | 'top_product_stock' | 'difference' | 'all_metrics' | 'comparison';
      productFilter?: string;
      comparisonPeriodInput?: SalesSummaryPeriodInput;
    }
  | {
      type: 'customer_count';
      statusFilter?: string;
    }
  | {
      type: 'customer_list';
      statusFilter?: string;
    }
  | {
      type: 'customer_profile';
      customerQuery: string;
    }
  | {
      type: 'customer_balance';
      customerQuery?: string;
    }
  | {
      type: 'customer_ranking_debt';
      limit?: number;
    }
  | {
      type: 'customer_ranking_sales';
      input?: SalesSummaryPeriodInput;
      limit?: number;
    }
  | {
      type: 'raw_material_summary';
      typeFilter?: string;
    }
  | {
      type: 'raw_material_item';
      materialQuery: string;
    }
  | {
      type: 'raw_material_lowest';
    }
  | {
      type: 'raw_material_movements';
      materialQuery?: string;
    }
  | {
      type: 'product_profile';
      productQuery: string;
    }
  | {
      type: 'product_list';
    }
  | {
      type: 'product_stock_named';
      productQuery: string;
    }
  | {
      type: 'product_lowest_stock';
    }
  | {
      type: 'product_highest_stock';
    }
  | {
      type: 'product_best_selling';
      input?: SalesSummaryPeriodInput;
    }
  | {
      type: 'inventory_stock_summary';
    }
  | {
      type: 'customer_transactions';
      customerQuery: string;
      input?: SalesSummaryPeriodInput;
    }
  | {
      type: 'customer_payments';
      customerQuery: string;
      input?: SalesSummaryPeriodInput;
    }
  | {
      type: 'customer_ledger';
      customerQuery: string;
      input?: SalesSummaryPeriodInput;
    }
  | {
      type: 'product_bom';
      productQuery: string;
    }
  | {
      type: 'customer_sales_period';
      customerQuery: string;
      input: SalesSummaryPeriodInput;
    }
  | {
      type: 'vendor_list';
    }
  | {
      type: 'purchase_orders_summary';
    }
  | {
      type: 'goods_receipts';
    }
  | {
      type: 'production_batches';
    }
  | {
      type: 'production_downtime';
    }
  | {
      type: 'incident_summary';
      statusFilter?: string;
    }
  | {
      type: 'hybrid';
      query: string;
      liveIntent: 'sales_summary' | 'production_summary' | 'stock_summary';
      input: SalesSummaryPeriodInput;
      productFilter?: string;
    }
  | {
      type: 'business_snapshot';
      input?: SalesSummaryPeriodInput;
    }
  | {
      type: 'why_explanation';
      topic?: string;
    }
  | {
      type: 'context_correction';
      correctedDimension: 'period' | 'metric' | 'product' | 'multiple';
      targetIntent: KenbyIntent;
      originalCorrectionText: string;
    }
  | {
      type: 'clarification_prompt';
      metric: string;
      options: SalesSummaryPeriodInput[];
      promptMl: string;
      promptEn: string;
    }
  | {
      type: 'greeting';
      message?: string;
    }
  | {
      type: 'unknown';
      query: string;
    };

@Injectable()
export class KenbyRouterService {
  private readonly logger = new Logger(KenbyRouterService.name);
  private readonly entityResolver: KenbyEntityResolverService;
  private readonly capabilityResolver: KenbyCapabilityResolverService;

  constructor(
    entityResolver?: KenbyEntityResolverService,
    capabilityResolver?: KenbyCapabilityResolverService,
  ) {
    this.entityResolver = entityResolver || new KenbyEntityResolverService();
    this.capabilityResolver = capabilityResolver || new KenbyCapabilityResolverService();
  }

  /**
   * Conversational Question Intent Router: Classifies user questions and resolves
   * natural follow-up questions using true semantic conversation state.
   */
  async routeQuestion(question: string, context?: KenbyConversationContext): Promise<KenbyIntent> {
    const rawQ = (question || '').trim();
    const qLower = rawQ.toLowerCase();

    this.logger.log(`[KENBY_ROUTER] Question: "${rawQ}" | Context: ${JSON.stringify(context || {})}`);

    // 1. GREETING INTENT (Always independent, resets conversation context)
    if (
      qLower === 'hi' ||
      qLower === 'hello' ||
      qLower === 'kenby' ||
      qLower === 'hey' ||
      qLower.includes('hello kenby') ||
      qLower.includes('hi kenby') ||
      qLower.includes('ഹലോ') ||
      qLower.includes('ഹായ്') ||
      qLower.includes('നമസ്കാരം') ||
      qLower.includes('സുഖമാണോ')
    ) {
      const intent: KenbyIntent = { type: 'greeting', message: rawQ };
      this.logger.log(`[KENBY_ROUTER] Intent: greeting`);
      return intent;
    }

    // 2. PERIOD EXTRACTION
    const periodInput = this.extractPeriodInput(qLower);

    // 3. PRONOUN RESOLUTION (അതിന്റെ / its / their / his / her) against lastEntity
    const isPronounQuery =
      qLower.includes('അതിന്റെ') ||
      qLower.includes('അവരുടെ') ||
      qLower.includes('ഇയാളുടെ') ||
      qLower.includes('its') ||
      qLower.includes('their') ||
      qLower.includes('his') ||
      qLower.includes('her');

    if (isPronounQuery && context?.lastEntity) {
      const pronounCap = this.capabilityResolver.resolveCapability(
        rawQ,
        {
          type: context.lastEntity.type as any,
          id: context.lastEntity.id,
          name: context.lastEntity.name,
          confidence: 1.0,
        },
        periodInput
      );

      if (pronounCap.status === 'matched' && pronounCap.plan) {
        const intent = this.mapPlanToIntent(pronounCap.plan, rawQ);
        if (intent) {
          this.logger.log(`[KENBY_ROUTER] Pronoun resolved to lastEntity: ${context.lastEntity.name} (${context.lastEntity.type}) -> intent: ${intent.type}`);
          return intent;
        }
      }
    }

    // 4. ENTITY-FIRST RESOLUTION
    const candidateEntity = this.extractCandidateEntityPhrase(rawQ);
    if (candidateEntity && !qLower.includes('how many') && !qLower.includes('all customer') && !qLower.includes('all product') && !qLower.includes('all raw material')) {
      const entityRes = await this.entityResolver.resolveEntity(candidateEntity);

      if (entityRes.matchStatus === 'ambiguous' && entityRes.clarificationPrompt) {
        this.logger.log(`[KENBY_ROUTER] Ambiguous Entity: "${candidateEntity}"`);
        return {
          type: 'clarification_prompt',
          metric: candidateEntity,
          options: [],
          promptMl: entityRes.clarificationPrompt.ml,
          promptEn: entityRes.clarificationPrompt.en,
        };
      }

      if (entityRes.matchStatus === 'exact' || entityRes.matchStatus === 'partial') {
        const capRes = this.capabilityResolver.resolveCapability(rawQ, entityRes.entity, periodInput);
        if (capRes.status === 'matched' && capRes.plan) {
          const intent = this.mapPlanToIntent(capRes.plan, rawQ);
          if (intent) {
            this.logger.log(`[KENBY_ROUTER] Entity-First Matched: ${entityRes.entity?.name} (${entityRes.entity?.type}) -> intent: ${intent.type}`);
            return intent;
          }
        }
      }
    }

    // 5. SEMANTIC FOLLOW-UP CONTEXT RESOLUTION (Priority for short/conversational follow-ups)
    const contextResolvedIntent = this.resolveFollowUpContext(rawQ, qLower, context);
    if (contextResolvedIntent) {
      this.logger.log(`[KENBY_ROUTER] Resolved Follow-Up Intent: ${contextResolvedIntent.type}`);
      return contextResolvedIntent;
    }

    // Product Filter Extraction
    let productFilter: string | undefined = undefined;
    if (qLower.includes('kenby 1') || qLower.includes('കെൻബി 1')) {
      productFilter = 'Kenby 1';
    } else if (qLower.includes('20l') || qLower.includes('20 l')) {
      productFilter = '20L';
    } else if (qLower.includes('500ml') || qLower.includes('500 ml')) {
      productFilter = '500ml';
    } else if (qLower.includes('1l') || qLower.includes('1 l') || qLower.includes('1 litre')) {
      productFilter = '1L';
    } else if (qLower.includes('2l') || qLower.includes('2 l')) {
      productFilter = '2L';
    } else {
      const prodMatch = rawQ.match(/([a-zA-Z0-9_]+)(?:-ന്റെ|-ഉടെ|\s+sales|\s+production|\s+stock)/i);
      if (prodMatch) {
        const candidate = prodMatch[1].trim().toLowerCase();
        const reserved = [
          'august', 'july', 'june', 'january', 'february', 'march', 'april', 'may', 'september', 'october', 'november', 'december',
          'today', 'yesterday', 'this', 'last', 'product', 'products', 'wise', 'in', 'of', 'for', 'each', 'all', 'the', 'my', 'our',
          'current', 'new', 'total', 'details', 'and', 'or', 'to', 'from', 'with', 'by', 'is', 'are', 'was', 'were', 'how', 'much',
          'what', 'which', 'who', 'when', 'where', 'why', 'have', 'has', 'had', 'do', 'did', 'does', 'item', 'items', 'our', 'we',
          'പ്രോഡക്റ്റ്', 'ഓരോ', 'എല്ലാം', 'ആകെ', 'നിലവിലെ', 'ഇന്നത്തെ', 'ഇന്നലത്തെ', 'ഈ', 'കഴിഞ്ഞ', 'എത്ര', 'മാസം'
        ];
        if (!reserved.includes(candidate) && candidate.length > 2) {
          productFilter = prodMatch[1].trim();
        }
      }
    }

    // ==========================================
    // ERP DOMAIN 1: CUSTOMER INTELLIGENCE
    // ==========================================
    if (
      qLower.includes('how many customer') ||
      qLower.includes('customer count') ||
      qLower.includes('customers count') ||
      qLower.includes('കസ്റ്റമർ എത്ര') ||
      qLower.includes('എത്ര കസ്റ്റമർ') ||
      qLower.includes('എത്ര customer') ||
      qLower.includes('active customer count') ||
      (qLower.includes('how many') && qLower.includes('customer'))
    ) {
      return { type: 'customer_count' };
    }

    if (
      qLower.includes('owes the most') ||
      qLower.includes('owe the most') ||
      qLower.includes('highest debt') ||
      qLower.includes('top debtor') ||
      qLower.includes('കൂടുതൽ കടം') ||
      qLower.includes('കൂടുതൽ കൊടുക്കാനുള്ള customer') ||
      qLower.includes('ഏറ്റവും കൂടുതൽ balance')
    ) {
      return { type: 'customer_ranking_debt' };
    }

    if (
      qLower.includes('customer bought the most') ||
      qLower.includes('customer purchased the most') ||
      qLower.includes('top customer') ||
      qLower.includes('best customer') ||
      qLower.includes('ഏറ്റവും കൂടുതൽ വാങ്ങിയ customer')
    ) {
      return { type: 'customer_ranking_sales', input: periodInput };
    }

    if (
      qLower.includes('show all customer') ||
      qLower.includes('all customer') ||
      qLower.includes('list customer') ||
      qLower.includes('customer list') ||
      qLower.includes('customers list') ||
      qLower.includes('എല്ലാ customer') ||
      qLower.includes('കസ്റ്റമർ ലിസ്റ്റ്')
    ) {
      return { type: 'customer_list' };
    }

    const customerQueryCandidate = this.extractCustomerQuery(rawQ);
    const hasFullDetailsKeyword =
      qLower.includes('full detail') ||
      qLower.includes('full information') ||
      qLower.includes('full profile') ||
      qLower.includes('complete detail') ||
      qLower.includes('വിശദാംശങ്ങൾ') ||
      qLower.includes('മുഴുവൻ വിവരങ്ങൾ') ||
      qLower.includes('profile');

    // Customer profile (full details requested)
    if (hasFullDetailsKeyword && customerQueryCandidate) {
      return { type: 'customer_profile', customerQuery: customerQueryCandidate };
    }

    // Customer balance / outstanding
    if (
      (qLower.includes('owe') || qLower.includes('balance') || qLower.includes('കടം') || qLower.includes('കൊടുക്കാനുണ്ട്') || qLower.includes('outstanding') || qLower.includes('കുടിശ്ശിക')) &&
      customerQueryCandidate
    ) {
      return { type: 'customer_balance', customerQuery: customerQueryCandidate };
    }

    // Customer outstanding without specific customer = debt ranking
    if (
      (qLower.includes('owe') || qLower.includes('outstanding') || qLower.includes('കടം') || qLower.includes('കൊടുക്കാനുണ്ട്')) &&
      (qLower.includes('customer') || qLower.includes('കസ്റ്റമർ')) &&
      !customerQueryCandidate
    ) {
      return { type: 'customer_ranking_debt' };
    }

    // Generic customer details query without specific named candidate
    if (
      (qLower.includes('customer') || qLower.includes('കസ്റ്റമർ')) &&
      (qLower.includes('വിവരങ്ങൾ') || qLower.includes('വിവരം') || qLower.includes('details') || qLower.includes('info') || qLower.includes('profile')) &&
      !customerQueryCandidate
    ) {
      if (context?.customer || context?.lastCustomer) {
        return { type: 'customer_profile', customerQuery: (context.customer || context.lastCustomer)! };
      }
      return {
        type: 'clarification_prompt',
        metric: 'customer',
        options: [],
        promptMl: 'ഏത് customer-ന്റെ വിവരങ്ങളാണ് അറിയേണ്ടത്? (ഉദാഹരണത്തിന്: Sinan)',
        promptEn: 'Which customer\'s details would you like to see? (For example: Sinan)',
      };
    }

    // Customer transaction history with period filter
    if (
      customerQueryCandidate &&
      (qLower.includes('transaction') || qLower.includes('history') || qLower.includes('bought') || qLower.includes('purchased') || qLower.includes('buy') ||
       qLower.includes('വാങ്ങി') || qLower.includes('ട്രാൻസ്') || qLower.includes('ഇടപാട്'))
    ) {
      const hasPeriod = periodInput.period !== 'this_month' || qLower.includes('this month') || qLower.includes('ഈ മാസം');
      if (hasPeriod && (
        qLower.includes('in ') || qLower.includes('during') || qLower.includes('-ൽ') || qLower.includes('july') ||
        qLower.includes('august') || qLower.includes('month') || qLower.includes('today') || qLower.includes('yesterday')
      )) {
        return { type: 'customer_sales_period', customerQuery: customerQueryCandidate, input: periodInput };
      }
      return { type: 'customer_transactions', customerQuery: customerQueryCandidate };
    }

    // Customer Payments
    if (
      customerQueryCandidate &&
      (qLower.includes('payment') || qLower.includes('paid') || qLower.includes('പേയ്‌മെന്റ്') || qLower.includes('പണം'))
    ) {
      return { type: 'customer_payments', customerQuery: customerQueryCandidate };
    }

    // Customer Ledger
    if (
      customerQueryCandidate &&
      (qLower.includes('ledger') || qLower.includes('statement') || qLower.includes('ലെഡ്ജർ'))
    ) {
      return { type: 'customer_ledger', customerQuery: customerQueryCandidate };
    }

    // Named customer without specific keyword — return profile
    if (
      customerQueryCandidate &&
      !qLower.includes('product') &&
      !qLower.includes('stock') &&
      !qLower.includes('material') &&
      !qLower.includes('incident') &&
      !qLower.includes('downtime') &&
      !qLower.includes('goods receipt') &&
      !qLower.includes('grn') &&
      !qLower.includes('vendor') &&
      !qLower.includes('supplier') &&
      !qLower.includes('batch') &&
      !qLower.includes('warehouse')
    ) {
      return { type: 'customer_profile', customerQuery: customerQueryCandidate };
    }

    // ==========================================
    // ERP DOMAIN 2: RAW MATERIAL INTELLIGENCE
    // ==========================================
    if (
      qLower.includes('raw material is lowest') ||
      qLower.includes('lowest raw material') ||
      qLower.includes('lowest material') ||
      qLower.includes('low stock material') ||
      qLower.includes('out of stock material') ||
      qLower.includes('ഏറ്റവും കുറഞ്ഞ material') ||
      qLower.includes('കുറഞ്ഞ material') ||
      qLower.includes('കുറഞ്ഞ റോ മെറ്റീരിയൽ')
    ) {
      return { type: 'raw_material_lowest' };
    }

    const rawMatTypeCandidate = this.extractRawMaterialType(rawQ);

    if (
      rawMatTypeCandidate &&
      (qLower.includes('movement') || qLower.includes('history') || qLower.includes('consumed') || qLower.includes('used') || qLower.includes('മൂവ്മെന്റ്'))
    ) {
      return { type: 'raw_material_movements', materialQuery: rawMatTypeCandidate };
    }

    if (
      qLower.includes('raw material movement') ||
      qLower.includes('material movement') ||
      qLower.includes('material consumption') ||
      qLower.includes('material was consumed') ||
      qLower.includes('material was used') ||
      qLower.includes('മെറ്റീരിയൽ മൂവ്മെന്റ്')
    ) {
      return { type: 'raw_material_movements', materialQuery: rawMatTypeCandidate || undefined };
    }

    if (rawMatTypeCandidate) {
      return { type: 'raw_material_item', materialQuery: rawMatTypeCandidate };
    }

    if (
      qLower.includes('raw material stock') ||
      qLower.includes('all raw material') ||
      qLower.includes('raw materials') ||
      qLower.includes('show all materials') ||
      qLower.includes('show material') ||
      qLower.includes('റോ മെറ്റീരിയൽ സ്റ്റോക്ക്') ||
      qLower.includes('റോ മെറ്റീരിയൽസ്') ||
      (qLower.includes('material') && qLower.includes('stock'))
    ) {
      return { type: 'raw_material_summary' };
    }

    // ==========================================
    // ERP DOMAIN 3: PRODUCT INTELLIGENCE
    // ==========================================

    // Product BOM
    if (
      qLower.includes('bom') ||
      qLower.includes('bill of material') ||
      qLower.includes('materials required') ||
      qLower.includes('components of')
    ) {
      const prodCandidate = this.extractProductProfileQuery(rawQ) || productFilter || rawQ;
      return { type: 'product_bom', productQuery: prodCandidate };
    }

    // Product list
    if (
      qLower.includes('show all product') ||
      qLower.includes('all product') ||
      qLower.includes('list product') ||
      qLower.includes('product list') ||
      qLower.includes('list of product') ||
      qLower.includes('എല്ലാ product') ||
      qLower.includes('products list')
    ) {
      return { type: 'product_list' };
    }

    // Lowest stock products
    if (
      (qLower.includes('lowest') || qLower.includes('low stock') || qLower.includes('least stock') || qLower.includes('running low') || qLower.includes('കുറഞ്ഞ stock')) &&
      (qLower.includes('product') || qLower.includes('stock') || qLower.includes('item'))
    ) {
      return { type: 'product_lowest_stock' };
    }

    // Highest stock product
    if (
      (qLower.includes('highest stock') || qLower.includes('most stock') || qLower.includes('maximum stock') || qLower.includes('കൂടുതൽ stock')) &&
      qLower.includes('product')
    ) {
      return { type: 'product_highest_stock' };
    }

    // Best selling product
    if (
      (qLower.includes('best sell') || qLower.includes('most sold') || qLower.includes('top sell') || qLower.includes('highest sell') ||
       qLower.includes('most sale') || qLower.includes('ഏറ്റവും കൂടുതൽ വിറ്റ') || qLower.includes('ഏറ്റവും കൂടുതൽ sale')) &&
      qLower.includes('product')
    ) {
      return { type: 'product_best_selling', input: periodInput };
    }

    // Named product queries
    const productProfileCandidate = this.extractProductProfileQuery(rawQ);

    // Full profile request
    if (hasFullDetailsKeyword && productProfileCandidate) {
      return { type: 'product_profile', productQuery: productProfileCandidate };
    }

    // Named product stock query (e.g. "How much stock of 1L Bottle?")
    if (
      productProfileCandidate &&
      (qLower.includes('stock') || qLower.includes('സ്റ്റോക്ക്') || qLower.includes('available') || qLower.includes('how much') || qLower.includes('എത്ര'))
    ) {
      return { type: 'product_stock_named', productQuery: productProfileCandidate };
    }

    // ==========================================
    // ERP DOMAIN 4: WAREHOUSE / INVENTORY STOCK
    // ==========================================
    if (
      qLower.includes('warehouse stock') ||
      qLower.includes('inventory stock') ||
      qLower.includes('warehouse inventory') ||
      (qLower.includes('warehouse') && qLower.includes('stock'))
    ) {
      return { type: 'inventory_stock_summary' };
    }

    // ==========================================
    // ERP DOMAIN 5: PROCUREMENT & VENDORS
    // ==========================================
    if (
      qLower.includes('show all vendor') ||
      qLower.includes('all vendor') ||
      qLower.includes('vendor list') ||
      qLower.includes('list vendor') ||
      qLower.includes('suppliers') ||
      qLower.includes('show vendor') ||
      qLower.includes('സപ്ലയർ')
    ) {
      return { type: 'vendor_list' };
    }

    if (
      qLower.includes('purchase order') ||
      qLower.includes('po status') ||
      qLower.includes('pending po') ||
      qLower.includes('open po')
    ) {
      return { type: 'purchase_orders_summary' };
    }

    // ==========================================
    // ERP DOMAIN 6: PRODUCTION BATCHES & DOWNTIME
    // ==========================================
    if (
      qLower.includes('production batch') ||
      qLower.includes('running batch') ||
      qLower.includes('active batch') ||
      qLower.includes('ബാച്ചുകൾ')
    ) {
      return { type: 'production_batches' };
    }

    if (
      qLower.includes('downtime') ||
      qLower.includes('breakdown reason') ||
      qLower.includes('machine breakdown') ||
      qLower.includes('മെഷീൻ തകരാർ')
    ) {
      return { type: 'production_downtime' };
    }

    // 3. MULTI-METRIC / CROSS-ANALYSIS DETECTOR
    const metricMatches: string[] = [];
    if (qLower.includes('sales') || qLower.includes('സെയിൽ') || qLower.includes('sell') || qLower.includes('വിറ്റ') || qLower.includes('ഡിസ്പാച്ച്') || qLower.includes('dispatch')) metricMatches.push('sales');
    if (qLower.includes('production') || qLower.includes('പ്രൊഡക്ഷൻ') || qLower.includes('ഉൽപ്പാദനം') || qLower.includes('ഉല്പാദനം')) metricMatches.push('production');
    if (qLower.includes('stock') || qLower.includes('സ്റ്റോക്ക്') || qLower.includes('ലഭ്യമായത്') || qLower.includes('കൈവശം')) metricMatches.push('stock');
    if (qLower.includes('return') || qLower.includes('റിട്ടേൺ') || qLower.includes('തിരികെ')) metricMatches.push('returns');
    if (qLower.includes('damage') || qLower.includes('ഡാമേജ്') || qLower.includes('നഷ്ടം')) metricMatches.push('damage');

    // Case A: Top selling product + stock query
    const isTopProductStock =
      (qLower.includes('ഏറ്റവും കൂടുതൽ') || qLower.includes('most') || qLower.includes('highest')) &&
      (qLower.includes('sell') || qLower.includes('sales') || qLower.includes('വിറ്റ')) &&
      (qLower.includes('stock') || qLower.includes('സ്റ്റോക്ക്'));

    if (isTopProductStock) {
      return {
        type: 'business_analysis',
        input: periodInput,
        metrics: ['sales_breakdown', 'top_product_stock'],
        queryMode: 'top_product_stock',
        productFilter,
      };
    }

    // Case B: Explicit difference query
    const isDifferenceQuery =
      (qLower.includes('എത്ര കൂടുതലാണ്') || qLower.includes('difference') || qLower.includes('വ്യത്യാസം') || qLower.includes('gap')) &&
      (metricMatches.includes('sales') || qLower.includes('sales')) &&
      (metricMatches.includes('production') || qLower.includes('production'));

    if (isDifferenceQuery) {
      return {
        type: 'business_analysis',
        input: periodInput,
        metrics: ['sales', 'production', 'difference'],
        queryMode: 'difference',
        productFilter,
      };
    }

    // Case C: MoM comparison query ("July-നേക്കാൾ August sales കൂടിയോ?", "August-നോട് compare ചെയ്യൂ")
    const isComparisonQuery =
      (qLower.includes('നേക്കാൾ') || qLower.includes('നെക്കാൾ') || qLower.includes('കൂടിയോ') || qLower.includes('കുറഞ്ഞോ') || qLower.includes('കമ്പാരിസൺ') || qLower.includes('compare') || qLower.includes('എങ്ങനെയാണ്')) &&
      ((qLower.includes('july') || qLower.includes('ജൂലൈ')) && (qLower.includes('august') || qLower.includes('ഓഗസ്റ്റ്') || qLower.includes('കഴിഞ്ഞ മാസം')));

    if (isComparisonQuery) {
      let targetInput = periodInput;
      let compInput: SalesSummaryPeriodInput | undefined = undefined;

      if ((qLower.includes('august') || qLower.includes('ഓഗസ്റ്റ്')) && (qLower.includes('july') || qLower.includes('ജൂലൈ'))) {
        targetInput = { period: 'specific_month', year: 2026, month: 8 };
        compInput = { period: 'specific_month', year: 2026, month: 7 };
      }

      return {
        type: 'business_analysis',
        input: targetInput,
        metrics: ['sales', 'comparison'],
        queryMode: 'comparison',
        productFilter,
        comparisonPeriodInput: compInput,
      };
    }

    // Case D: All 4 metrics overview (Explicit multi-metric request)
    const isAllMetricsQuery =
      qLower.includes('എല്ലാം പറയൂ') ||
      qLower.includes('all metrics') ||
      (metricMatches.includes('returns') && metricMatches.includes('damage') && metricMatches.includes('sales') && metricMatches.includes('production'));

    if (isAllMetricsQuery) {
      return {
        type: 'business_analysis',
        input: periodInput,
        metrics: ['sales', 'production', 'returns', 'damage'],
        queryMode: 'all_metrics',
        productFilter,
      };
    }

    // Case E: Multi-metric query (e.g. "August sales and production എത്ര?", "Kenby 1 sales, production, stock")
    if (metricMatches.length >= 2) {
      return {
        type: 'business_analysis',
        input: periodInput,
        metrics: metricMatches,
        queryMode: 'multi_metric',
        productFilter,
      };
    }

    // 4. EXPLICIT BREAKDOWN QUESTIONS (Product-wise / Which products / Stock of each product)
    const isProductBreakdownQuery =
      qLower.includes('product-wise') ||
      qLower.includes('product wise') ||
      qLower.includes('ഓരോ product') ||
      qLower.includes('ഓരോ പ്രോഡക്റ്റ്') ||
      qLower.includes('each product') ||
      qLower.includes('every product') ||
      qLower.includes('ഏതൊക്കെ product') ||
      qLower.includes('ഏതൊക്കെ പ്രോഡക്റ്റ്') ||
      qLower.includes('ഏതൊക്കെ products') ||
      qLower.includes('ഏത് product') ||
      qLower.includes('ഏതാണ് product') ||
      qLower.includes('products ഏതാണ്') ||
      qLower.includes('products ഏവ') ||
      qLower.includes('which products') ||
      qLower.includes('stock details') ||
      qLower.includes('sales details') ||
      qLower.includes('production details') ||
      qLower.includes('return details') ||
      qLower.includes('damage details') ||
      qLower.includes('how much of each product') ||
      qLower.includes('how much return did');

    if (isProductBreakdownQuery) {
      if (qLower.includes('stock') || qLower.includes('സ്റ്റോക്ക്') || qLower.includes('ലഭ്യമായത്') || qLower.includes('കൈവശം')) {
        return { type: 'stock_breakdown', productFilter };
      }
      if (qLower.includes('return') || qLower.includes('റിട്ടേൺ') || qLower.includes('തിരികെ')) {
        return { type: 'return_breakdown', input: periodInput, productFilter };
      }
      if (qLower.includes('damage') || qLower.includes('ഡാമേജ്') || qLower.includes('നഷ്ടം')) {
        return { type: 'damage_breakdown', input: periodInput, productFilter };
      }
      if (qLower.includes('production') || qLower.includes('പ്രൊഡക്ഷൻ') || qLower.includes('ഉൽപ്പാദനം')) {
        return { type: 'production_breakdown', input: periodInput, productFilter };
      }
      if (qLower.includes('sales') || qLower.includes('സെയിൽ') || qLower.includes('sell') || qLower.includes('വിറ്റ') || qLower.includes('dispatch') || qLower.includes('ഡിസ്പാച്ച്')) {
        return { type: 'sales_breakdown', input: periodInput, productFilter };
      }
    }

    // 5. EXPLICIT BUSINESS SNAPSHOT INTENT (Only for full business report queries)
    const isSnapshotQuery =
      qLower === 'business' ||
      qLower === 'business status' ||
      qLower === 'business report' ||
      qLower === 'business summary' ||
      qLower === 'how is my business' ||
      qLower === 'how is business' ||
      qLower.includes('ബിസിനസ്സ് നില പറയൂ') ||
      qLower.includes('ബിസിനസ് റിപ്പോർട്ട്') ||
      qLower.includes('ബിസിനസ്സ് റിപ്പോർട്ട്') ||
      qLower.includes('ഓവറോൾ റിപ്പോർട്ട്') ||
      qLower.includes('full business summary');

    if (isSnapshotQuery) {
      const intent: KenbyIntent = { type: 'business_snapshot', input: periodInput };
      this.logger.log(`[KENBY_ROUTER] Intent: business_snapshot`);
      return intent;
    }

    // 5b. HYBRID QUERY (Live Operational Fact + RAG Knowledge Definition)
    const isHybridQuery =
      (qLower.includes('എന്താണ്') || qLower.includes('what is') || qLower.includes('meaning of') || qLower.includes('explain')) &&
      (qLower.includes('എത്ര') || qLower.includes('how much') || qLower.includes('count') || qLower.includes('total') || qLower.includes('ഈ മാസം') || qLower.includes('കഴിഞ്ഞ മാസം') || qLower.includes('കടഞ്ഞ മാസം'));

    if (isHybridQuery) {
      let liveIntent: 'sales_summary' | 'production_summary' | 'stock_summary' = 'sales_summary';
      if (qLower.includes('production') || qLower.includes('പ്രൊഡക്ഷൻ') || qLower.includes('ഉൽപ്പാദനം')) liveIntent = 'production_summary';
      else if (qLower.includes('stock') || qLower.includes('സ്റ്റോക്ക്')) liveIntent = 'stock_summary';

      const intent: KenbyIntent = {
        type: 'hybrid',
        query: rawQ,
        liveIntent,
        input: periodInput,
        productFilter,
      };
      this.logger.log(`[KENBY_ROUTER] Intent: hybrid (liveIntent=${liveIntent})`);
      return intent;
    }

    // 6. KNOWLEDGE INTENT (RAG Path — Strictly for static business definitions/concepts)
    const isConceptDefinition =
      qLower.includes('what is a sales dispatch') ||
      qLower.includes('what is sales dispatch') ||
      qLower.includes('what is sales') ||
      qLower.includes('what is production') ||
      qLower.includes('what is stock') ||
      qLower.includes('what is return') ||
      qLower.includes('what is damage') ||
      qLower.includes('what is bom') ||
      qLower.includes('what does') ||
      qLower.includes('meaning of') ||
      qLower.includes('explain') ||
      qLower.includes('ഡെഫിനിഷൻ') ||
      qLower.includes('വിശദീകരിക്കുക') ||
      (qLower.includes('എന്താണ്') && !qLower.includes('ശ്രദ്ധിക്കേണ്ടത്') && !qLower.includes('എത്ര'));

    const hasOperationalDataFilter =
      qLower.includes('how much') ||
      qLower.includes('how many') ||
      qLower.includes('count') ||
      qLower.includes('total') ||
      qLower.includes('balance') ||
      qLower.includes('outstanding') ||
      qLower.includes('july') ||
      qLower.includes('august') ||
      qLower.includes('today') ||
      qLower.includes('yesterday') ||
      qLower.includes('this month') ||
      qLower.includes('last month') ||
      qLower.includes('kenby 1') ||
      qLower.includes('sinan') ||
      qLower.includes('green cap') ||
      qLower.includes('എത്ര');

    if (isConceptDefinition && !hasOperationalDataFilter) {
      const intent: KenbyIntent = { type: 'knowledge', query: rawQ };
      this.logger.log(`[KENBY_ROUTER] Intent: knowledge`);
      return intent;
    }

    // 7. GROQ STRUCTURED ROUTING (IF GROQ_API_KEY IS AVAILABLE)
    if (process.env.GROQ_API_KEY) {
      try {
        const groqResult = await this.queryGroqRouter(rawQ);
        if (groqResult) {
          const validated = this.validateAndNormalizeIntent(groqResult, rawQ);
          if (validated) {
            this.logger.log(`[KENBY_ROUTER] Intent from LLM: ${validated.type}`);
            return validated;
          }
        }
      } catch (err: any) {
        this.logger.warn(`[KENBY_ROUTER] Groq routing fallback used: ${err.message}`);
      }
    }

    // 8. HIGH-PRECISION DETERMINISTIC ROUTER
    const deterministicIntent = this.deterministicRoute(rawQ, qLower, context);
    this.logger.log(`[KENBY_ROUTER] Intent: ${deterministicIntent.type}`);
    return deterministicIntent;
  }

  /**
   * Helper to normalize period input safely
   */
  private normalizePeriodInput(p: any): SalesSummaryPeriodInput {
    if (!p) return { period: 'this_month' };
    const period = (p.period || p.type || 'this_month') as any;
    return {
      period,
      year: p.year,
      month: p.month,
      date: p.date,
      startDate: p.startDate,
      endDate: p.endDate,
    };
  }

  /**
   * Formats period name in Malayalam or English for natural clarification questions
   */
  private formatPeriodName(p: any, lang: 'ml' | 'en'): string {
    if (!p) return lang === 'ml' ? 'ഈ മാസം' : 'this month';
    if (p.period === 'specific_month' || p.month) {
      const m = p.month;
      const monthsMl: Record<number, string> = { 1: 'ജനുവരി', 2: 'ഫെബ്രുവരി', 3: 'മാർച്ച്', 4: 'ഏപ്രിൽ', 5: 'മേയ്', 6: 'ജൂൺ', 7: 'July', 8: 'August', 9: 'സെപ്റ്റംബർ', 10: 'ഒക്ടോബർ', 11: 'നവംബർ', 12: 'ഡിസംബർ' };
      const monthsEn: Record<number, string> = { 1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June', 7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December' };
      return lang === 'ml' ? (monthsMl[m] || 'മാസം') : (monthsEn[m] || 'month');
    }
    if (p.period === 'today') return lang === 'ml' ? 'ഇന്ന്' : 'today';
    if (p.period === 'yesterday') return lang === 'ml' ? 'ഇന്നലെ' : 'yesterday';
    if (p.period === 'last_month') return lang === 'ml' ? 'കഴിഞ്ഞ മാസം' : 'last month';
    return lang === 'ml' ? 'ഈ മാസം' : 'this month';
  }

  /**
   * True Semantic Conversational Context Resolution Engine
   */
  private resolveFollowUpContext(rawQ: string, qLower: string, context?: KenbyConversationContext): KenbyIntent | null {
    if (!context) return null;

    const primary = context.primaryPeriod || context.lastPeriod;
    const comparison = context.comparisonPeriod;
    const activeMetric = context.activeTopic || context.metric || context.lastMetric || 'sales';
    const activeProduct = context.product || context.lastProduct;

    // Rule 0: Pending Ambiguity Resolution Protocol
    if (context.pendingAmbiguity) {
      const options = context.pendingAmbiguity.options || [];
      let selectedPeriod: SalesSummaryPeriodInput | null = null;

      if (qLower.includes('july') || qLower.includes('ജൂലൈ')) {
        selectedPeriod = options.find((o: any) => o.month === 7) || { period: 'specific_month', year: 2026, month: 7 };
      } else if (qLower.includes('august') || qLower.includes('ഓഗസ്റ്റ്')) {
        selectedPeriod = options.find((o: any) => o.month === 8) || { period: 'specific_month', year: 2026, month: 8 };
      } else if (qLower.includes('first') || qLower.includes('ആദ്യത്തേത്')) {
        selectedPeriod = options[0];
      } else if (qLower.includes('second') || qLower.includes('രണ്ടാമത്തേത്')) {
        selectedPeriod = options[1];
      }

      if (selectedPeriod) {
        const metric = context.pendingAmbiguity.metric;
        this.logger.log(`[KENBY_ROUTER] Resolved pending ambiguity to period: ${JSON.stringify(selectedPeriod)} for metric: ${metric}`);

        if (metric === 'production') return { type: 'production_summary', input: selectedPeriod, productFilter: activeProduct || undefined };
        if (metric === 'returns') return { type: 'sales_return_summary', input: selectedPeriod, productFilter: activeProduct || undefined };
        if (metric === 'damage') return { type: 'damage_summary', input: selectedPeriod, productFilter: activeProduct || undefined };
        if (metric === 'sales') return { type: 'sales_summary', input: selectedPeriod, productFilter: activeProduct || undefined };
      }
    }

    // Rule 0a: Correction & Clarification Detection ("പക്ഷേ ഞാൻ ചോദിച്ചത്...", "അല്ല, August ആണ്")
    const isCorrection =
      qLower.includes('പക്ഷേ ഞാൻ ചോദിച്ചത്') ||
      qLower.includes('ഞാൻ ചോദിച്ചത്') ||
      qLower.includes('ഞാൻ ചോദിച്ച') ||
      qLower.includes('അല്ല,') ||
      qLower.includes('അതല്ല') ||
      qLower.includes('തെറ്റായി') ||
      qLower.includes('ഉദ്ദേശിച്ചത്') ||
      qLower.includes('no, i meant') ||
      qLower.includes('i meant') ||
      qLower.includes('i asked for') ||
      qLower.includes('no, august') ||
      qLower.includes('no, july');

    if (isCorrection) {
      return this.resolveCorrectionContext(rawQ, qLower, context);
    }

    // Rule 0b: "Why?" / "എന്തുകൊണ്ട്?" / "കാരണം"
    const isWhyQuestion =
      qLower === 'why?' ||
      qLower === 'why' ||
      qLower === 'എന്തുകൊണ്ട്?' ||
      qLower === 'എന്തുകൊണ്ട്' ||
      qLower.includes('കാരണം') ||
      qLower.includes('reason');

    if (isWhyQuestion) {
      return { type: 'why_explanation', topic: activeMetric || 'business' };
    }

    // Rule 0c: Comparison Follow-ups ("August-നോട് compare ചെയ്യൂ", "July-യുമായി കമ്പാരിസൺ")
    const isComparisonFollowUp =
      qLower.includes('നേക്കാൾ') ||
      qLower.includes('കൂടിയോ') ||
      qLower.includes('കുറഞ്ഞോ') ||
      qLower.includes('കമ്പാരിസൺ') ||
      qLower.includes('compare');

    if (isComparisonFollowUp && !qLower.includes('എത്ര കൂടുതലാണ്')) {
      const periodInput = this.normalizePeriodInput(primary);
      const compPeriodInput = this.extractPeriodInput(qLower);
      return {
        type: 'business_analysis',
        input: compPeriodInput.period !== 'this_month' ? compPeriodInput : periodInput,
        metrics: ['sales', 'comparison'],
        queryMode: 'comparison',
        productFilter: activeProduct || undefined,
        comparisonPeriodInput: periodInput,
      };
    }

    // Rule 0d: "Difference?" / "വ്യത്യാസം എത്ര?" / "ഇത് എത്ര കൂടുതലാണ്?"
    const isDiffFollowUp =
      qLower === 'difference?' ||
      qLower === 'difference' ||
      qLower === 'വ്യത്യാസം എത്ര?' ||
      qLower === 'വ്യത്യാസം എത്ര' ||
      qLower === 'എത്ര കൂടുതലാണ്?' ||
      qLower === 'എത്ര കൂടുതലാണ്' ||
      qLower.includes('ഇത് എത്ര കൂടുതലാണ്');

    if (isDiffFollowUp) {
      const periodInput = this.normalizePeriodInput(primary);
      return {
        type: 'business_analysis',
        input: periodInput,
        metrics: ['sales', 'production', 'difference'],
        queryMode: 'difference',
        productFilter: activeProduct || undefined,
      };
    }

    // Rule 0e: Generic Breakdown Follow-ups ("ഏതൊക്കെ product?", "Product-wise?", "Which products?", "അതിൽ ഏതാണ് കൂടുതൽ?")
    const isGenericBreakdownFollowUp =
      qLower.includes('ഏതൊക്കെ product') ||
      qLower.includes('ഏതൊക്കെ പ്രോഡക്റ്റ്') ||
      qLower.includes('product-wise') ||
      qLower.includes('product wise') ||
      qLower.includes('which products') ||
      qLower.includes('അതിൽ ഏതാണ് കൂടുതൽ') ||
      qLower.includes('ഇതിൽ ഏതാണ് കൂടുതൽ') ||
      qLower.includes('ഏതാണ് കൂടുതൽ') ||
      qLower.includes('product wise പറയൂ') ||
      qLower.includes('product details') ||
      qLower.includes('breakdown പറയൂ');

    if (isGenericBreakdownFollowUp) {
      const periodInput = this.normalizePeriodInput(primary);
      const prodFilter = activeProduct || undefined;

      if (activeMetric === 'stock' || context.lastIntent === 'stock_summary' || context.lastIntent === 'stock_breakdown') {
        return { type: 'stock_breakdown', productFilter: prodFilter };
      }
      if (activeMetric === 'returns' || context.lastIntent === 'sales_return_summary' || context.lastIntent === 'return_breakdown') {
        return { type: 'return_breakdown', input: periodInput, productFilter: prodFilter };
      }
      if (activeMetric === 'damage' || context.lastIntent === 'damage_summary' || context.lastIntent === 'damage_breakdown') {
        return { type: 'damage_breakdown', input: periodInput, productFilter: prodFilter };
      }
      if (activeMetric === 'production' || context.lastIntent === 'production_summary' || context.lastIntent === 'production_breakdown') {
        return { type: 'production_breakdown', input: periodInput, productFilter: prodFilter };
      }
      if (activeMetric === 'sales' || context.lastIntent === 'sales_summary' || context.lastIntent === 'sales_breakdown' || activeMetric === 'business') {
        return { type: 'sales_breakdown', input: periodInput, productFilter: prodFilter };
      }
    }

    const hasExplicitMetric =
      qLower.includes('sales') ||
      qLower.includes('സെയിൽ') ||
      qLower.includes('വിറ്റ') ||
      qLower.includes('dispatch') ||
      qLower.includes('ഡിസ്പാച്ച്') ||
      qLower.includes('production') ||
      qLower.includes('പ്രൊഡക്ഷൻ') ||
      qLower.includes('ഉൽപ്പാദനം') ||
      qLower.includes('ഉല്പാദനം') ||
      qLower.includes('stock') ||
      qLower.includes('സ്റ്റോക്ക്') ||
      qLower.includes('ലഭ്യമായത്') ||
      qLower.includes('കൈവശം') ||
      qLower.includes('return') ||
      qLower.includes('റിട്ടേൺ') ||
      qLower.includes('തിരികെ') ||
      qLower.includes('damage') ||
      qLower.includes('ഡാമേജ്') ||
      qLower.includes('നഷ്ടം');

    const hasExplicitPeriod =
      qLower.includes('july') ||
      qLower.includes('june') ||
      qLower.includes('august') ||
      qLower.includes('january') ||
      qLower.includes('february') ||
      qLower.includes('march') ||
      qLower.includes('april') ||
      qLower.includes('may') ||
      qLower.includes('september') ||
      qLower.includes('october') ||
      qLower.includes('november') ||
      qLower.includes('december') ||
      qLower.includes('ജൂലൈ') ||
      qLower.includes('ജൂൺ') ||
      qLower.includes('ഓഗസ്റ്റ്') ||
      qLower.includes('today') ||
      qLower.includes('yesterday') ||
      qLower.includes('ഇന്ന്') ||
      qLower.includes('ഇന്നലെ') ||
      qLower.includes('ഈ മാസം') ||
      qLower.includes('കഴിഞ്ഞ മാസം') ||
      qLower.includes('കടഞ്ഞ മാസം') ||
      qLower.includes('കഴിഞ്ഞമാസം') ||
      qLower.includes('കടഞ്ഞമാസം') ||
      qLower.includes('മുൻപത്തെ മാസം') ||
      qLower.includes('മുമ്പത്തെ മാസം') ||
      /\d{4}-\d{1,2}-\d{1,2}/.test(qLower);

    const hasExplicitProduct = qLower.includes('kenby 1') || qLower.includes('കെൻബി 1');
    const effectiveProduct = hasExplicitProduct ? 'Kenby 1' : activeProduct;

    // Rule: Stock questions asking for "now" or "current" should NOT inherit old transaction periods (July/August)
    const isInstantaneousStockQuery =
      (qLower.includes('stock') || qLower.includes('സ്റ്റോക്ക്') || qLower.includes('ലഭ്യമായത്')) &&
      (qLower.includes('now') || qLower.includes('current') || qLower.includes('ഇപ്പോൾ') || qLower.includes('നിലവിൽ') || !hasExplicitPeriod);

    if (isInstantaneousStockQuery) {
      if (qLower.includes('each') || qLower.includes('ഓരോ') || qLower.includes('product-wise') || qLower.includes('details') || qLower.includes('ഏതൊക്കെ')) {
        return { type: 'stock_breakdown', productFilter: effectiveProduct || undefined };
      }
      return { type: 'stock_summary', productFilter: effectiveProduct || undefined };
    }

    // Rule 1: Metric Follow-up with BOTH primaryPeriod and comparisonPeriod active (AMBIGUITY CHECK)
    if (hasExplicitMetric && !hasExplicitPeriod) {
      if (comparison && primary && JSON.stringify(primary) !== JSON.stringify(comparison)) {
        let requestedMetric = 'production';
        if (qLower.includes('return') || qLower.includes('റിട്ടേൺ')) requestedMetric = 'returns';
        else if (qLower.includes('damage') || qLower.includes('ഡാമേജ്')) requestedMetric = 'damage';
        else if (qLower.includes('sales') || qLower.includes('സെയിൽ')) requestedMetric = 'sales';
        else if (qLower.includes('production') || qLower.includes('പ്രൊഡക്ഷൻ') || qLower.includes('ഉൽപ്പാദനം')) requestedMetric = 'production';

        const p1NameMl = this.formatPeriodName(primary, 'ml');
        const p2NameMl = this.formatPeriodName(comparison, 'ml');
        const p1NameEn = this.formatPeriodName(primary, 'en');
        const p2NameEn = this.formatPeriodName(comparison, 'en');

        return {
          type: 'clarification_prompt',
          metric: requestedMetric,
          options: [primary, comparison],
          promptMl: `${p1NameMl} ${requestedMetric} ആണോ ${p2NameMl} ${requestedMetric} ആണോ?`,
          promptEn: `Do you mean ${p1NameEn} ${requestedMetric} or ${p2NameEn} ${requestedMetric}?`,
        };
      }
    }

    // Rule 2: Short Period Follow-up ("What about August?", "August-ലോ?", "July-ലോ?", "Yesterday?", "ഇന്നലെ?")
    if (hasExplicitPeriod && !hasExplicitMetric) {
      const newPeriod = this.extractPeriodInput(qLower);
      const targetMetric = activeMetric || 'sales';

      if (targetMetric === 'sales') return { type: 'sales_summary', input: newPeriod, productFilter: effectiveProduct || undefined };
      if (targetMetric === 'production') return { type: 'production_summary', input: newPeriod, productFilter: effectiveProduct || undefined };
      if (targetMetric === 'returns') return { type: 'sales_return_summary', input: newPeriod, productFilter: effectiveProduct || undefined };
      if (targetMetric === 'damage') return { type: 'damage_summary', input: newPeriod, productFilter: effectiveProduct || undefined };
      if (targetMetric === 'stock') return { type: 'stock_summary', productFilter: effectiveProduct || undefined };
    }

    // Rule 3: Short Metric Follow-up with single active period ("What about returns?", "Production?", "Damage?", "Sales?")
    if (hasExplicitMetric && !hasExplicitPeriod) {
      const periodInput = this.normalizePeriodInput(primary);

      if (qLower.includes('production') || qLower.includes('പ്രൊഡക്ഷൻ') || qLower.includes('ഉൽപ്പാദനം')) {
        return { type: 'production_summary', input: periodInput, productFilter: effectiveProduct || undefined };
      }
      if (qLower.includes('return') || qLower.includes('റിട്ടേൺ') || qLower.includes('തിരികെ')) {
        return { type: 'sales_return_summary', input: periodInput, productFilter: effectiveProduct || undefined };
      }
      if (qLower.includes('damage') || qLower.includes('ഡാമേജ്') || qLower.includes('നഷ്ടം')) {
        return { type: 'damage_summary', input: periodInput, productFilter: effectiveProduct || undefined };
      }
      if (qLower.includes('sales') || qLower.includes('സെയിൽ') || qLower.includes('dispatch') || qLower.includes('ഡിസ്പാച്ച്')) {
        return { type: 'sales_summary', input: periodInput, productFilter: effectiveProduct || undefined };
      }
    }

    return null;
  }

  /**
   * Correction Context Resolver: Resets primaryPeriod and clears comparisonPeriod
   */
  private resolveCorrectionContext(rawQ: string, qLower: string, context?: KenbyConversationContext): KenbyIntent {
    const hasExplicitPeriod =
      qLower.includes('july') || qLower.includes('june') || qLower.includes('august') ||
      qLower.includes('january') || qLower.includes('february') || qLower.includes('march') ||
      qLower.includes('april') || qLower.includes('may') || qLower.includes('september') ||
      qLower.includes('october') || qLower.includes('november') || qLower.includes('december') ||
      qLower.includes('ജൂലൈ') || qLower.includes('ജൂൺ') || qLower.includes('ഓഗസ്റ്റ്') ||
      qLower.includes('today') || qLower.includes('yesterday') || qLower.includes('ഇന്ന്') ||
      qLower.includes('ഇന്നലെ') || qLower.includes('ഈ മാസം') || qLower.includes('കഴിഞ്ഞ മാസം') ||
      qLower.includes('കടഞ്ഞ മാസം') || qLower.includes('കഴിഞ്ഞമാസം') || qLower.includes('കടഞ്ഞമാസം') ||
      qLower.includes('മുൻപത്തെ മാസം') || qLower.includes('മുമ്പത്തെ മാസം');

    const periodInput = hasExplicitPeriod ? this.extractPeriodInput(qLower) : this.normalizePeriodInput(context?.primaryPeriod || context?.lastPeriod);

    let productFilter = context?.product || context?.lastProduct || undefined;
    if (qLower.includes('kenby 1') || qLower.includes('കെൻബി 1')) {
      productFilter = 'Kenby 1';
    }

    let targetMetric = context?.activeTopic || context?.metric || context?.lastMetric || 'sales';
    if (qLower.includes('production') || qLower.includes('പ്രൊഡക്ഷൻ') || qLower.includes('ഉൽപ്പാദനം')) {
      targetMetric = 'production';
    } else if (qLower.includes('stock') || qLower.includes('സ്റ്റോക്ക്')) {
      targetMetric = 'stock';
    } else if (qLower.includes('return') || qLower.includes('റിട്ടേൺ')) {
      targetMetric = 'returns';
    } else if (qLower.includes('damage') || qLower.includes('ഡാമേജ്')) {
      targetMetric = 'damage';
    } else if (qLower.includes('sales') || qLower.includes('സെയിൽ')) {
      targetMetric = 'sales';
    }

    let targetIntent: KenbyIntent = { type: 'sales_summary', input: periodInput, productFilter };
    if (targetMetric === 'production') targetIntent = { type: 'production_summary', input: periodInput, productFilter };
    if (targetMetric === 'stock') targetIntent = { type: 'stock_summary', productFilter };
    if (targetMetric === 'returns') targetIntent = { type: 'sales_return_summary', input: periodInput, productFilter };
    if (targetMetric === 'damage') targetIntent = { type: 'damage_summary', input: periodInput, productFilter };

    return {
      type: 'context_correction',
      correctedDimension: hasExplicitPeriod ? 'period' : 'metric',
      targetIntent,
      originalCorrectionText: rawQ,
    };
  }

  /**
   * Deterministic Classifier (Zero unsolicited metrics, precise targeting)
   */
  private deterministicRoute(rawQ: string, qLower: string, context?: KenbyConversationContext): KenbyIntent {
    const periodInput = this.extractPeriodInput(qLower);

    let productFilter: string | undefined = undefined;
    if (qLower.includes('kenby 1') || qLower.includes('കെൻബി 1')) {
      productFilter = 'Kenby 1';
    }

    // Incidents & Breakdown Tickets
    if (
      qLower.includes('incident') ||
      qLower.includes('ഇൻസിഡന്റ്') ||
      qLower.includes('breakdown ticket') ||
      qLower.includes('safety ticket')
    ) {
      return { type: 'incident_summary' };
    }

    // Goods Receipts (GRN)
    if (
      qLower.includes('goods receipt') ||
      qLower.includes('grn') ||
      qLower.includes('material received from supplier') ||
      qLower.includes('supplier delivery') ||
      qLower.includes('ലഭിച്ച സാധനങ്ങൾ')
    ) {
      return { type: 'goods_receipts' };
    }

    // Vendors & Suppliers
    if (
      qLower.includes('vendor') ||
      qLower.includes('supplier') ||
      qLower.includes('വെണ്ടർ') ||
      qLower.includes('സപ്ലയർ')
    ) {
      return { type: 'vendor_list' };
    }

    // Purchase Orders
    if (
      qLower.includes('purchase order') ||
      qLower.includes('po status') ||
      qLower.includes('open po') ||
      qLower.includes('പർച്ചേസ് ഓർഡർ')
    ) {
      return { type: 'purchase_orders_summary' };
    }

    // Production Batches
    if (
      qLower.includes('batch') ||
      qLower.includes('ബാച്ച്')
    ) {
      return { type: 'production_batches' };
    }

    // Machine Downtime
    if (
      qLower.includes('downtime') ||
      qLower.includes('ഡൗൺടൈം') ||
      qLower.includes('തകരാർ')
    ) {
      return { type: 'production_downtime' };
    }

    // Warehouse Inventory
    if (
      qLower.includes('warehouse stock') ||
      qLower.includes('warehouse inventory') ||
      qLower.includes('factory warehouse') ||
      qLower.includes('വെയർഹൗസ്')
    ) {
      return { type: 'inventory_stock_summary' };
    }

    // Stock
    if (qLower.includes('stock') || qLower.includes('സ്റ്റോക്ക്') || qLower.includes('ലഭ്യമായത്') || qLower.includes('കൈവശം')) {
      if (qLower.includes('each') || qLower.includes('ഓരോ') || qLower.includes('product') || qLower.includes('പ്രോഡക്റ്റ്') || qLower.includes('details')) {
        return { type: 'stock_breakdown', productFilter };
      }
      return { type: 'stock_summary', productFilter };
    }

    // Damage
    if (qLower.includes('damage') || qLower.includes('ഡാമേജ്') || qLower.includes('നഷ്ടം')) {
      if (qLower.includes('product') || qLower.includes('പ്രോഡക്റ്റ്') || qLower.includes('details')) {
        return { type: 'damage_breakdown', input: periodInput, productFilter };
      }
      return { type: 'damage_summary', input: periodInput, productFilter };
    }

    // Return
    if (qLower.includes('return') || qLower.includes('റിട്ടേൺ') || qLower.includes('തിരികെ')) {
      if (qLower.includes('product') || qLower.includes('പ്രോഡക്റ്റ്') || qLower.includes('details')) {
        return { type: 'return_breakdown', input: periodInput, productFilter };
      }
      return { type: 'sales_return_summary', input: periodInput, productFilter };
    }

    // Production
    if (qLower.includes('production') || qLower.includes('പ്രൊഡക്ഷൻ') || qLower.includes('ഉൽപ്പാദനം') || qLower.includes('ഉല്പാദനം')) {
      if (qLower.includes('product') || qLower.includes('പ്രോഡക്റ്റ്') || qLower.includes('details')) {
        return { type: 'production_breakdown', input: periodInput, productFilter };
      }
      return { type: 'production_summary', input: periodInput, productFilter };
    }

    // Sales / Dispatch
    if (
      qLower.includes('sales') ||
      qLower.includes('സെയിൽ') ||
      qLower.includes('sell') ||
      qLower.includes('വിറ്റ') ||
      qLower.includes('dispatch') ||
      qLower.includes('ഡിസ്പാച്ച്')
    ) {
      if (qLower.includes('product') || qLower.includes('പ്രോഡക്റ്റ്') || qLower.includes('details')) {
        return { type: 'sales_breakdown', input: periodInput, productFilter };
      }
      return { type: 'sales_summary', input: periodInput, productFilter };
    }

    return { type: 'unknown', query: rawQ };
  }

  /**
   * Extracts date period from natural language query with strict month isolation
   */
  public extractPeriodInput(qLower: string): SalesSummaryPeriodInput {
    const now = new Date();
    const currentYear = now.getFullYear();

    // Specific date match (e.g., 2026-07-12)
    const dateISO = qLower.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (dateISO) {
      const y = parseInt(dateISO[1], 10);
      const m = parseInt(dateISO[2], 10);
      const d = parseInt(dateISO[3], 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return { period: 'specific_date', date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
      }
    }

    const monthsMap: Record<string, number> = {
      january: 1, jan: 1, ജനുവരി: 1,
      february: 2, feb: 2, ഫെബ്രുവരി: 2,
      march: 3, mar: 3, മാർച്ച്: 3,
      april: 4, apr: 4, ഏപ്രിൽ: 4,
      may: 5, മേയ്: 5,
      june: 6, jun: 6, ജൂൺ: 6,
      july: 7, jul: 7, ജൂലൈ: 7,
      august: 8, aug: 8, ഓഗസ്റ്റ്: 8,
      september: 9, sep: 9, സെപ്റ്റംബർ: 9,
      october: 10, oct: 10, ഒക്ടോബർ: 10,
      november: 11, nov: 11, നവംബർ: 11,
      december: 12, dec: 12, ഡിസംബർ: 12,
    };

    // Date + Month (e.g. July 15, ജൂലൈ 15)
    const dayMonthMatch = /(july|june|august|january|february|march|april|may|september|october|november|december|ജനുവരി|ഫെബ്രുവരി|മാർച്ച്|ഏപ്രിൽ|മേയ്|ജൂൺ|ജൂലൈ|ഓഗസ്റ്റ്|സെപ്റ്റംബർ|ഒക്ടോബർ|നവംബർ|ഡിസംബർ)\s*(\d{1,2})/i;
    const dm = qLower.match(dayMonthMatch);
    if (dm) {
      const mVal = monthsMap[dm[1].toLowerCase()];
      const dVal = parseInt(dm[2], 10);
      if (mVal && dVal >= 1 && dVal <= 31) {
        return { period: 'specific_date', date: `${currentYear}-${String(mVal).padStart(2, '0')}-${String(dVal).padStart(2, '0')}` };
      }
    }

    // Month + Day (e.g. 15th July, 15-ാം തീയതി)
    const monthDayMatch = /(\d{1,2})(st|nd|rd|th|\s*-\s*ാം|\s*ാം|\s*th)?\s*(july|june|august|january|february|march|april|may|september|october|november|december|ജനുവരി|ഫെബ്രുവരി|മാർച്ച്|ഏപ്രിൽ|മേയ്|ജൂൺ|ജൂലൈ|ഓഗസ്റ്റ്|സെപ്റ്റംബർ|ഒക്ടോബർ|നവംബർ|ഡിസംബർ|തീയതി)/i;
    const md = qLower.match(monthDayMatch);
    if (md) {
      const mVal = monthsMap[md[3]?.toLowerCase()] || (now.getMonth() + 1);
      const dVal = parseInt(md[1], 10);
      if (dVal >= 1 && dVal <= 31) {
        return { period: 'specific_date', date: `${currentYear}-${String(mVal).padStart(2, '0')}-${String(dVal).padStart(2, '0')}` };
      }
    }

    if (qLower.includes('today') || qLower.includes('ഇന്ന്') || qLower.includes('ഇന്നത്തേത്') || qLower.includes('ഇന്നത്തെ')) {
      return { period: 'today' };
    }

    if (qLower.includes('yesterday') || qLower.includes('ഇന്നലെ') || qLower.includes('ഇന്നലത്തെ')) {
      return { period: 'yesterday' };
    }

    // Check specific months strictly (checking exact tokens to avoid substrings)
    for (const [mName, mVal] of Object.entries(monthsMap)) {
      if (qLower.includes(mName)) {
        return { period: 'specific_month', year: currentYear, month: mVal };
      }
    }

    if (
      qLower.includes('last month') ||
      qLower.includes('കഴിഞ്ഞ മാസം') ||
      qLower.includes('കഴിഞ്ഞ മാസത്തെ') ||
      qLower.includes('കടഞ്ഞ മാസം') ||
      qLower.includes('കടഞ്ഞ മാസത്തെ') ||
      qLower.includes('കഴിഞ്ഞമാസം') ||
      qLower.includes('കടഞ്ഞമാസം') ||
      qLower.includes('മുൻപത്തെ മാസം') ||
      qLower.includes('മുമ്പത്തെ മാസം') ||
      qLower.includes('മുൻപത്തെ മാസത്തെ')
    ) {
      return { period: 'last_month' };
    }

    return { period: 'this_month' };
  }

  /**
   * Validate and normalize Groq structured output
   */
  private validateAndNormalizeIntent(rawObj: any, originalQuery: string): KenbyIntent | null {
    if (!rawObj || typeof rawObj !== 'object') return null;

    if (rawObj.intent === 'knowledge') {
      return { type: 'knowledge', query: originalQuery };
    }

    if (rawObj.intent === 'greeting') {
      return { type: 'greeting', message: originalQuery };
    }

    if (rawObj.intent === 'stock_summary') {
      return { type: 'stock_summary', productFilter: rawObj.productFilter };
    }

    if (rawObj.intent === 'stock_breakdown') {
      return { type: 'stock_breakdown', productFilter: rawObj.productFilter };
    }

    if (rawObj.intent === 'business_snapshot') {
      return { type: 'business_snapshot', input: this.extractPeriodInput(originalQuery.toLowerCase()) };
    }

    if (rawObj.intent === 'business_analysis') {
      const period = rawObj.period || 'this_month';
      let input: SalesSummaryPeriodInput = { period };

      if (period === 'specific_date' && rawObj.date && /^\d{4}-\d{2}-\d{2}$/.test(rawObj.date)) {
        input = { period: 'specific_date', date: rawObj.date };
      } else if (period === 'specific_month' && rawObj.year && rawObj.month && rawObj.month >= 1 && rawObj.month <= 12) {
        input = { period: 'specific_month', year: Number(rawObj.year), month: Number(rawObj.month) };
      }

      return {
        type: 'business_analysis',
        input,
        metrics: Array.isArray(rawObj.metrics) ? rawObj.metrics : ['sales', 'production'],
        queryMode: rawObj.queryMode || 'multi_metric',
        productFilter: rawObj.productFilter,
      };
    }

    const validIntents: KenbyIntentType[] = [
      'sales_summary',
      'production_summary',
      'sales_return_summary',
      'damage_summary',
      'sales_breakdown',
      'return_breakdown',
      'damage_breakdown',
      'production_breakdown',
    ];
    if (validIntents.includes(rawObj.intent)) {
      const period = rawObj.period || 'this_month';
      let input: SalesSummaryPeriodInput = { period };

      if (period === 'specific_date' && rawObj.date && /^\d{4}-\d{2}-\d{2}$/.test(rawObj.date)) {
        input = { period: 'specific_date', date: rawObj.date };
      } else if (period === 'specific_month' && rawObj.year && rawObj.month && rawObj.month >= 1 && rawObj.month <= 12) {
        input = { period: 'specific_month', year: Number(rawObj.year), month: Number(rawObj.month) };
      }

      return { type: rawObj.intent as any, input, productFilter: rawObj.productFilter };
    }

    // Customer intents
    if (rawObj.intent === 'customer_count') return { type: 'customer_count' };
    if (rawObj.intent === 'customer_list') return { type: 'customer_list' };
    if (rawObj.intent === 'customer_ranking_debt') return { type: 'customer_ranking_debt' };
    if (rawObj.intent === 'customer_profile' && rawObj.customerQuery) {
      return { type: 'customer_profile', customerQuery: rawObj.customerQuery };
    }
    if (rawObj.intent === 'customer_balance') {
      return { type: 'customer_balance', customerQuery: rawObj.customerQuery };
    }
    if (rawObj.intent === 'customer_ranking_sales') {
      const period = rawObj.period || 'this_month';
      let input: SalesSummaryPeriodInput = { period };
      if (period === 'specific_month' && rawObj.year && rawObj.month) {
        input = { period: 'specific_month', year: Number(rawObj.year), month: Number(rawObj.month) };
      }
      return { type: 'customer_ranking_sales', input, limit: rawObj.limit };
    }
    if (rawObj.intent === 'customer_transactions' && rawObj.customerQuery) {
      return { type: 'customer_transactions', customerQuery: rawObj.customerQuery };
    }
    if (rawObj.intent === 'customer_sales_period' && rawObj.customerQuery) {
      const period = rawObj.period || 'this_month';
      let input: SalesSummaryPeriodInput = { period };
      if (period === 'specific_month' && rawObj.year && rawObj.month) {
        input = { period: 'specific_month', year: Number(rawObj.year), month: Number(rawObj.month) };
      }
      return { type: 'customer_sales_period', customerQuery: rawObj.customerQuery, input };
    }

    // Raw material intents
    if (rawObj.intent === 'raw_material_summary') return { type: 'raw_material_summary' };
    if (rawObj.intent === 'raw_material_lowest') return { type: 'raw_material_lowest' };
    if (rawObj.intent === 'raw_material_movements') {
      return { type: 'raw_material_movements', materialQuery: rawObj.materialQuery };
    }
    if (rawObj.intent === 'raw_material_item' && rawObj.materialQuery) {
      return { type: 'raw_material_item', materialQuery: rawObj.materialQuery };
    }

    // Product intents
    if (rawObj.intent === 'product_profile' && rawObj.productQuery) {
      return { type: 'product_profile', productQuery: rawObj.productQuery };
    }
    if (rawObj.intent === 'product_list') return { type: 'product_list' };
    if (rawObj.intent === 'product_stock_named' && rawObj.productQuery) {
      return { type: 'product_stock_named', productQuery: rawObj.productQuery };
    }
    if (rawObj.intent === 'product_lowest_stock') return { type: 'product_lowest_stock' };
    if (rawObj.intent === 'product_highest_stock') return { type: 'product_highest_stock' };
    if (rawObj.intent === 'product_best_selling') {
      const period = rawObj.period || 'this_month';
      let input: SalesSummaryPeriodInput = { period };
      if (period === 'specific_month' && rawObj.year && rawObj.month) {
        input = { period: 'specific_month', year: Number(rawObj.year), month: Number(rawObj.month) };
      }
      return { type: 'product_best_selling', input };
    }

    // Procurement, production infrastructure, inventory intents
    if (rawObj.intent === 'vendor_list') return { type: 'vendor_list' };
    if (rawObj.intent === 'purchase_orders_summary') return { type: 'purchase_orders_summary' };
    if (rawObj.intent === 'production_batches') return { type: 'production_batches' };
    if (rawObj.intent === 'production_downtime') return { type: 'production_downtime' };
    if (rawObj.intent === 'inventory_stock_summary') return { type: 'inventory_stock_summary' };

    return null;
  }

  private queryGroqRouter(question: string): Promise<any> {
    return new Promise((resolve) => {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) return resolve(null);

      const prompt = `Classify this user question for Kenby ERP Business Intelligence system into strict JSON format.

Available intents:
Data queries: "sales_summary", "production_summary", "stock_summary", "stock_breakdown", "sales_return_summary", "damage_summary", "sales_breakdown", "return_breakdown", "damage_breakdown", "production_breakdown", "business_analysis", "business_snapshot"
Customer queries: "customer_count", "customer_list", "customer_profile", "customer_balance", "customer_ranking_debt", "customer_ranking_sales", "customer_transactions", "customer_sales_period"
Product queries: "product_profile", "product_list", "product_stock_named", "product_lowest_stock", "product_highest_stock", "product_best_selling"
Raw material queries: "raw_material_summary", "raw_material_item", "raw_material_lowest", "raw_material_movements"
Procurement queries: "vendor_list", "purchase_orders_summary"
Production queries: "production_batches", "production_downtime"
Inventory: "inventory_stock_summary"
Other: "knowledge", "greeting", "unknown"

Options for period: "this_month", "last_month", "today", "yesterday", "specific_month", "specific_date".
Current year is 2026.

Question: "${question}"

Respond with ONLY raw JSON. Examples:
{"intent": "sales_summary", "period": "specific_month", "year": 2026, "month": 7}
{"intent": "customer_profile", "customerQuery": "ABC Traders"}
{"intent": "raw_material_item", "materialQuery": "PREFORM"}
{"intent": "product_stock_named", "productQuery": "1L Bottle"}
{"intent": "customer_sales_period", "customerQuery": "ABC Traders", "period": "specific_month", "year": 2026, "month": 7}`;


      const payload = JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.0,
      });

      const req = https.request(
        {
          hostname: 'api.groq.com',
          path: '/openai/v1/chat/completions',
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              const contentStr = parsed.choices?.[0]?.message?.content;
              if (contentStr) {
                const jsonObj = JSON.parse(contentStr);
                resolve(jsonObj);
              } else {
                resolve(null);
              }
            } catch (e) {
              resolve(null);
            }
          });
        }
      );

      req.on('error', () => resolve(null));
      req.setTimeout(3000, () => {
        req.destroy();
        resolve(null);
      });
      req.write(payload);
      req.end();
    });
  }

  extractCustomerQuery(rawQ: string): string | null {
    const sanitized = rawQ.replace(/[?!.,;]/g, ' ').trim();
    const qLower = sanitized.toLowerCase();
    const patterns = [
      /(?:show profile of|profile of|show details of|details of|information of|about customer|about)\s+([a-zA-Z0-9&'\-\s]+?)(?:\s+full|\s+details|\s+profile|\s+transaction|\s+balance|\s+owe|\s+bought|\s+history|$)/i,
      /(?:what is the outstanding balance of|what is the balance of|outstanding balance of|balance of|ledger statement for|ledger of|ledger for|payments history for|payments of|payments for)\s+([a-zA-Z0-9&'\-\s]+?)(?:\s+full|\s+details|\s+profile|\s+transaction|\s+balance|\s+owe|\s+bought|\s+history|$)/i,
      /^([a-zA-Z0-9&'\-\s]{2,30}?)\s+(?:payments history|payments|ledger statement|ledger|profile|full details|balance)/i,
      /([a-zA-Z0-9&'\-\s]+?)(?:-ന്റെ|-ഉടെ|\s+ന്റെ)\s*(?:full|details|balance|വിശദാംശങ്ങൾ|ബാക്കി|കടം|profile|history|transaction|purchase|bought|payment|പേയ്‌മെന്റ്|ലെഡ്ജർ)/i,
      /(?:how much does|how much has|what did)\s+([a-zA-Z0-9&'\-\s]+?)(?:\s+owe|\s+buy|\s+purchase|\s+return|\s+pay)/i,
      /(?:show me|show|get|fetch)\s+([a-zA-Z0-9&'\-\s]{3,30})(?:'s)?\s+(?:full|details|profile|balance|transaction|purchase)/i,
    ];
    const reserved = new Set([
      'each', 'all', 'the', 'my', 'our', 'this', 'that', 'every', 'product', 'material',
      'customers', 'customer', 'vendor', 'suppliers', 'supplier', 'we', 'company', 'top', 'best',
      'raw', 'stock', 'sales', 'production', 'how', 'what', 'which', 'who', 'where',
      'when', 'why', 'total', 'current', 'me', 'his', 'her', 'their', 'its', 'a', 'an',
      'open', 'factory', 'incidents', 'incident', 'recent', 'machine', 'downtime', 'goods', 'receipts', 'receipt', 'grn',
      'ledger', 'statement', 'warehouse', 'location', 'active', 'batches', 'batch', 'inventory',
      'cap', 'caps', 'preform', 'label', 'labels', 'shrink', 'movement', 'movements',
      'jar', 'jars', 'bottle', 'bottles', 'can', 'cans', 'pack', 'packs', '20l', '1l', '2l', '5l', '500ml', 'litre', 'litres'
    ]);
    for (const p of patterns) {
      const match = sanitized.match(p);
      if (match && match[1]) {
        let candidate = match[1].trim();
        if (candidate.toLowerCase().startsWith('profile of ')) {
          candidate = candidate.slice(11).trim();
        }
        if (candidate.toLowerCase().startsWith('details of ')) {
          candidate = candidate.slice(11).trim();
        }
        if (candidate.toLowerCase().startsWith('statement for ')) {
          candidate = candidate.slice(14).trim();
        }
        // Filter single reserved words, but allow multi-word names
        const words = candidate.toLowerCase().split(/\s+/);
        const allReserved = words.every((w) => reserved.has(w));
        if (!allReserved && candidate.length >= 2 && candidate.length <= 50) {
          return candidate;
        }
      }
    }
    return null;
  }

  extractRawMaterialType(rawQ: string): string | null {
    const q = rawQ.toLowerCase();
    if (q.includes('preform') || q.includes('പ്രിഫോം') || q.includes('പ്രീഫോം')) return 'PREFORM';
    if (q.includes('cap') || q.includes('ക്യാപ്') || q.includes('ക്യാപ്പുകൾ') || q.includes('caps')) return 'CAP';
    if (q.includes('label') || q.includes('ലേബൽ') || q.includes('labels')) return 'LABEL';
    if (q.includes('shrink') || q.includes('ഷ്രിങ്ക്') || q.includes('shrink roll') || q.includes('rolls')) return 'SHRINK';
    if (q.includes('bottle') && (q.includes('raw') || q.includes('material'))) return 'PREFORM';
    return null;
  }

  extractProductProfileQuery(rawQ: string): string | null {
    const q = rawQ.toLowerCase();
    // Real DB products
    if (q.includes('kenby 1') || q.includes('കെൻബി 1')) return 'Kenby 1';
    if (q.includes('aquora 2') || q.includes('അക്വോറ 2')) return 'Aquora 2';
    // Match well-known product size patterns first
    if (q.includes('20l') || q.includes('20 l') || q.includes('20 litre') || q.includes('20 liter')) return '20L';
    if (q.includes('500ml') || q.includes('500 ml')) return '500ml';
    if (q.includes('1l') || q.includes('1 l') || q.includes('1 litre') || q.includes('1 liter') || q.includes('one litre')) return '1L';
    if (q.includes('2l') || q.includes('2 l') || q.includes('2 litre') || q.includes('2 liter')) return '2L';
    if (q.includes('5l') || q.includes('5 l') || q.includes('5 litre')) return '5L';
    if (q.includes('10l') || q.includes('10 l') || q.includes('10 litre')) return '10L';
    // Generic bottle/jar/product name extraction
    const productMatch = rawQ.match(
      /(?:of|for|about|details of|profile of|stock of|how much)\s+([a-zA-Z0-9L. ]{2,30}?)(?:\s+(?:bottle|jar|pack|can|pouch|product|details|stock|profile|full)|$)/i
    );
    if (productMatch && productMatch[1]) {
      const candidate = productMatch[1].trim();
      const reservedWords = ['the', 'a', 'an', 'our', 'my', 'all', 'every', 'each', 'this', 'that', 'how', 'much', 'stock'];
      if (!reservedWords.includes(candidate.toLowerCase()) && candidate.length >= 2) {
        return candidate;
      }
    }
    const leadingProdMatch = rawQ.match(/^([a-zA-Z0-9L. ]{2,30}?)\s+(?:full details|details|profile|full information)/i);
    if (leadingProdMatch && leadingProdMatch[1]) {
      const cand = leadingProdMatch[1].trim();
      const reservedWords = ['the', 'a', 'an', 'our', 'my', 'all', 'every', 'each', 'this', 'that', 'show', 'customer'];
      if (!reservedWords.includes(cand.toLowerCase()) && cand.length >= 2) {
        return cand;
      }
    }
    return null;
  }

  /**
   * Universal Entity Candidate Extraction
   */
  extractCandidateEntityPhrase(rawQ: string): string | null {
    // 1. Try customer extractor
    const cust = this.extractCustomerQuery(rawQ);
    if (cust) return cust;

    // 2. Try raw material extractor
    const rawMat = this.extractRawMaterialType(rawQ);
    if (rawMat) return rawMat;

    // 3. Try product size/name extractor
    const prod = this.extractProductProfileQuery(rawQ);
    if (prod) return prod;

    // 4. Match phrases before Malayalam postpositions (-ന്റെ, -ഉടെ, -ൽ)
    const postpositionMatch = rawQ.match(/([a-zA-Z0-9&.'\-\s]{2,40}?)(?:-ന്റെ|-ഉടെ|\s+ന്റെ|-ൽ)/);
    if (postpositionMatch && postpositionMatch[1]) {
      const cand = postpositionMatch[1].trim();
      if (cand.length >= 2 && !['ഇന്നത്തെ', 'ഇന്നലത്തെ', 'ഈ മാസത്തെ'].includes(cand)) {
        return cand;
      }
    }

    return null;
  }

  /**
   * Maps capability execution plan to strongly typed KenbyIntent
   */
  private mapPlanToIntent(plan: any, rawQ: string): KenbyIntent | null {
    if (!plan || !plan.capabilityId) return null;

    const entityName = plan.entity ? plan.entity.name : '';
    const periodInput = plan.period || { period: 'this_month' };

    switch (plan.capabilityId) {
      case 'customer_payments':
        return { type: 'customer_payments', customerQuery: entityName, input: periodInput };
      case 'customer_ledger':
        return { type: 'customer_ledger', customerQuery: entityName, input: periodInput };
      case 'customer_balance':
        return { type: 'customer_balance', customerQuery: entityName };
      case 'customer_profile':
        return { type: 'customer_profile', customerQuery: entityName };
      case 'customer_sales_history':
        return { type: 'customer_sales_period', customerQuery: entityName, input: periodInput };
      case 'product_bom':
        return { type: 'product_bom', productQuery: entityName };
      case 'product_profile':
        return { type: 'product_profile', productQuery: entityName };
      case 'product_stock':
        return { type: 'product_stock_named', productQuery: entityName };
      case 'product_sales':
        return { type: 'sales_breakdown', input: periodInput, productFilter: entityName };
      case 'raw_material_stock':
        return { type: 'raw_material_item', materialQuery: entityName };
      case 'raw_material_movements':
        return { type: 'raw_material_movements', materialQuery: entityName };
      case 'vendor_list':
        return { type: 'vendor_list' };
      case 'production_batches':
        return { type: 'production_batches' };
      case 'warehouse_stock':
        return { type: 'inventory_stock_summary' };
      default:
        return null;
    }
  }
}

