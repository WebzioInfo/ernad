import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { sql } from 'drizzle-orm';
import { TtsService } from './tts.service';
import {
  KenbyLiveDataService,
  SalesSummaryResult,
  ProductionSummaryResult,
  CurrentStockResult,
  BusinessSnapshotResult,
  SalesSummaryPeriodInput,
  ReturnBreakdownResult,
  DamageBreakdownResult,
  SalesBreakdownResult,
  ProductionBreakdownResult,
} from './kenby-live-data.service';
import { KenbyRagService } from './kenby-rag.service';
import { KenbyRouterService, KenbyIntent, KenbyConversationContext } from './kenby-router.service';
import { KenbyAnalysisService } from './kenby-analysis.service';
import {
  KenbyErpRegistryService,
  CustomerProfileResult,
  RawMaterialStockItem,
  RawMaterialProfileResult,
  ProductFullProfileResult,
} from './kenby-erp-registry.service';

import { GroqLlmService } from './llm/groq-llm.service';
import { KenbyToolExecutorService } from './tools/kenby-tool-executor.service';
import { VectorRagService } from './rag/vector-rag.service';
import { LlmSynthesizerService } from './llm/llm-synthesizer.service';
import { AnswerEvidence } from './grounding/kenby-grounding.interface';
import { KenbyQueryScopeService } from './scope/kenby-query-scope.service';

export interface LocalizedText {
  ml: string;
  en: string;
}

export interface BusinessInsight {
  id: string;
  type: 'SALES' | 'PRODUCTION' | 'RETURNS' | 'DAMAGE' | 'STOCK';
  icon?: string;
  title: LocalizedText;
  highlight?: LocalizedText;
  message?: LocalizedText;
  actionText?: LocalizedText;
  buttonText?: LocalizedText;
  link?: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  metrics?: any;
  data?: any;
}

export interface KenbyMonthlyReportResponse {
  year: number;
  month: number;
  monthName: string;
  dateStr?: string | null;
  viewingLabel: LocalizedText;
  summary: LocalizedText;
  cards: {
    sales: { cases: number; transactionsCount: number };
    production: { cases: number; batchesCount: number };
    returns: { cases: number };
    damage: { cases: number };
    stock: {
      totalProductsCount: number;
      totalAvailableStock: number;
      lowStockCount: number;
      lowStockItemNames: string[];
      sampleProductName?: string | null;
    };
  };
  insights: BusinessInsight[];
  actions: Array<{ id: string; text: LocalizedText; priority: number; link?: string }>;
  hasData: boolean;
  snapshot?: BusinessSnapshotResult;
}

export interface AskQuestionResponse {
  question: string;
  answer: LocalizedText;
  language: 'ml' | 'en';
  audioUrl?: string | null;
  speechText?: string;
  context?: KenbyConversationContext & {
    type?: 'date' | 'month';
    year?: number;
    month?: number;
    date?: string;
  };
  metric?: string;
  source?: string;
  evidence?: AnswerEvidence;
  data?: any;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly kenbyErpRegistry: KenbyErpRegistryService;

  constructor(
    private readonly ttsService: TtsService,
    private readonly kenbyLiveDataService: KenbyLiveDataService,
    private readonly kenbyRagService: KenbyRagService,
    private readonly kenbyRouterService: KenbyRouterService,
    private readonly kenbyAnalysisService: KenbyAnalysisService,
    kenbyErpRegistry?: KenbyErpRegistryService,
    private readonly groqLlmService?: GroqLlmService,
    private readonly toolExecutor?: KenbyToolExecutorService,
    private readonly vectorRag?: VectorRagService,
    private readonly llmSynthesizer?: LlmSynthesizerService,
    private readonly queryScopeService?: KenbyQueryScopeService,
  ) {
    this.kenbyErpRegistry = kenbyErpRegistry || new KenbyErpRegistryService();
  }

  /**
   * Trusted Business Intelligence Engine: Fetches single-source-of-truth metrics
   * matching Sales, Production Logs, and Products/Inventory modules exactly.
   */
  async getMonthlyReport(reqYear?: number, reqMonth?: number, reqDateStr?: string): Promise<KenbyMonthlyReportResponse> {
    const now = new Date();
    const year = reqYear && !isNaN(reqYear) ? reqYear : now.getFullYear();
    const month = reqMonth && !isNaN(reqMonth) ? reqMonth : now.getMonth() + 1; // 1-indexed

    const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthNamesMl = ['ജനുവരി', 'ഫെബ്രുവരി', 'മാർച്ച്', 'ഏപ്രിൽ', 'മേയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗസ്റ്റ്', 'സെപ്റ്റംബർ', 'ഒക്ടോബർ', 'നവംബർ', 'ഡിസംബർ'];

    const monthNameEn = monthNamesEn[month - 1] || 'Month';
    const monthNameMl = monthNamesMl[month - 1] || 'മാസം';

    try {
      const [salesMetrics, productionMetrics, stockMetrics, snapshot] = await Promise.all([
        this.fetchMonthlySalesMetrics(year, month, reqDateStr),
        this.fetchMonthlyProductionMetrics(year, month, reqDateStr),
        this.fetchFinishedStockMetrics(),
        this.kenbyLiveDataService.getBusinessSnapshot({
          period: reqDateStr ? 'specific_date' : 'specific_month',
          date: reqDateStr,
          year,
          month,
        }),
      ]);

      const hasData =
        salesMetrics.salesCases > 0 ||
        salesMetrics.returnCases > 0 ||
        salesMetrics.damageCases > 0 ||
        productionMetrics.productionCases > 0 ||
        stockMetrics.totalProductsCount > 0;

      const formattedLabelDate = reqDateStr ? this.formatMalayalamDate(reqDateStr) : `${monthNameMl} ${year}`;
      const formattedLabelDateEn = reqDateStr ? this.formatEnglishDate(reqDateStr) : `${monthNameEn} ${year}`;

      const viewingLabel: LocalizedText = {
        ml: `Viewing: ${formattedLabelDate}`,
        en: `Viewing: ${formattedLabelDateEn}`,
      };

      const summary = this.buildMonthlySummary(salesMetrics, productionMetrics, stockMetrics, monthNameMl, monthNameEn, reqDateStr);
      const insights = this.buildMonthlyInsights(salesMetrics, productionMetrics, stockMetrics);
      const actions = this.buildMonthlyActions(salesMetrics, productionMetrics, stockMetrics);

      return {
        year,
        month,
        monthName: monthNameEn,
        dateStr: reqDateStr || null,
        viewingLabel,
        summary: {
          ml: this.cleanText(summary.ml),
          en: this.cleanText(summary.en),
        },
        cards: {
          sales: { cases: salesMetrics.salesCases, transactionsCount: salesMetrics.salesTxCount },
          production: { cases: productionMetrics.productionCases, batchesCount: productionMetrics.batchesCount },
          returns: { cases: salesMetrics.returnCases },
          damage: { cases: salesMetrics.damageCases },
          stock: {
            totalProductsCount: stockMetrics.totalProductsCount,
            totalAvailableStock: stockMetrics.totalAvailableStock,
            lowStockCount: stockMetrics.lowStockCount,
            lowStockItemNames: stockMetrics.lowStockItemNames,
            sampleProductName: stockMetrics.sampleProductName,
          },
        },
        insights,
        actions,
        hasData,
        snapshot,
      };
    } catch (error: any) {
      this.logger.error(`Error generating monthly AI report for ${year}-${month}`, error.stack);
      throw error;
    }
  }

  /**
   * Phase 6, 7, 8 & 9 Conversational Question Handler: Resolves intents, proactive topics, drill-downs & multi-tool analysis
   */
  async askQuestion(question: string, conversationContext?: KenbyConversationContext): Promise<AskQuestionResponse> {
    const reqId = `REQ-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const rawQ = (question || '').trim();
    const qLower = rawQ.toLowerCase();
    const isMl = this.isMalayalam(rawQ);
    const lang: 'ml' | 'en' = isMl ? 'ml' : 'en';

    this.logger.log(`[KENBY_TRACE] [${reqId}] request_received: "${rawQ}"`);
    this.logger.log(`[KENBY_TRACE] [${reqId}] query_normalized: "${qLower}" | lang: ${lang}`);
    this.logger.log(`[KENBY_TRACE] [${reqId}] conversation_context_resolved: ${JSON.stringify(conversationContext || {})}`);

    // Unsupported financial/profit-loss check (Rule 18 / Safety)
    // NOTE: 'outstanding', customer payments, and customer ledger ARE queryable in Kenby.
    const isFinancialQuery =
      (qLower.includes('company revenue') || qLower.includes('net profit') || qLower.includes('company profit') || qLower.includes('profit and loss') || qLower.includes('profit & loss') ||
       qLower.includes('ലാഭം') || qLower.includes('ലാഭ നഷ്ടം') || qLower.includes('കമ്പനി ചിലവ്')) &&
      !qLower.includes('customer') && !qLower.includes('കസ്റ്റമർ') && !qLower.includes('balance') && !qLower.includes('owe') && !qLower.includes('payment');

    if (isFinancialQuery) {
      this.logger.log(`[KENBY_TRACE] [${reqId}] source_selected: UNSUPPORTED (financial guardrail)`);
      const answer: LocalizedText = {
        ml: 'സാമ്പത്തിക / പേയ്‌മെന്റ് വിവരങ്ങൾ (payment, revenue, profit) Kenby-യിൽ ലഭ്യമല്ല.',
        en: 'Financial, payment collection, revenue, and profit tracking data are not managed in Kenby.',
      };
      const audioUrl = await this.ttsService.generateNeuralSpeech(answer[lang], lang);

      return {
        question: rawQ,
        answer,
        language: lang,
        audioUrl,
        context: {
          lastIntent: 'unknown',
          lastMetric: null,
          lastPeriod: conversationContext?.lastPeriod || null,
          lastProduct: conversationContext?.lastProduct || null,
          language: lang,
        },
      };
    }

    // Rule 17: Return reasons check ("Why were these returned?", "എന്തുകൊണ്ടാണ് return വന്നത്?")
    const isReturnReasonQuery =
      (qLower.includes('why') && qLower.includes('return')) ||
      (qLower.includes('എന്തുകൊണ്ട്') && qLower.includes('return')) ||
      (qLower.includes('കാരണം') && qLower.includes('return')) ||
      (qLower.includes('reason') && qLower.includes('return'));

    if (isReturnReasonQuery) {
      this.logger.log(`[KENBY_TRACE] [${reqId}] source_selected: RAG (return reasons)`);
      const answer: LocalizedText = {
        ml: 'Return records-ൽ return reason സംബന്ധിച്ച മതിയായ വിവരങ്ങൾ ഇല്ല. അതിനാൽ കാരണം ഉറപ്പിച്ച് പറയാൻ കഴിയില്ല.',
        en: 'The available return records do not contain enough information to determine why the products were returned.',
      };
      const audioUrl = await this.ttsService.generateNeuralSpeech(answer[lang], lang);

      return {
        question: rawQ,
        answer,
        language: lang,
        audioUrl,
        context: {
          lastIntent: 'sales_return_summary',
          lastMetric: 'returns',
          lastPeriod: conversationContext?.lastPeriod || null,
          lastProduct: conversationContext?.lastProduct || null,
          language: lang,
        },
      };
    }

    // =========================================================================
    // 0. TRUE AI PLANNING & SECURE ERP TOOL ORCHESTRATION (GROQ LLM)
    // =========================================================================
    if (this.groqLlmService && this.toolExecutor && this.vectorRag && this.llmSynthesizer) {
      try {
        let scope: any = null;
        if (this.queryScopeService) {
          scope = await this.queryScopeService.resolveScope(rawQ, conversationContext);
          this.logger.log(`[KENBY_TRACE] [${reqId}] stage=scope_resolved | intent=${scope.intent} | domains=${scope.domains.join(',')}`);
        }

        const plan = await this.groqLlmService.generatePlan(rawQ, conversationContext);
        this.logger.log(`[KENBY_TRACE] [${reqId}] stage=llm_plan_generated | thought="${plan.thought}"`);

        if (scope?.intent === 'UNSUPPORTED_FINANCIAL' || plan.isUnsupportedFinancial) {
          this.logger.log(`[KENBY_TRACE] [${reqId}] source_selected: UNSUPPORTED (financial guardrail)`);
          const answer: LocalizedText = {
            ml: 'സാമ്പത്തിക / പേയ്‌മെന്റ് വിവരങ്ങൾ (payment, revenue, profit) Kenby-യിൽ ലഭ്യമല്ല.',
            en: 'Financial, payment collection, revenue, and profit tracking data are not managed in Kenby.',
          };
          const audioUrl = await this.ttsService.generateNeuralSpeech(answer[lang], lang);
          return {
            question: rawQ,
            answer,
            language: lang,
            audioUrl,
            context: {
              lastIntent: 'unknown',
              lastMetric: null,
              lastPeriod: conversationContext?.lastPeriod || null,
              lastProduct: conversationContext?.lastProduct || null,
              language: lang,
            },
          };
        }

        // Enforce Scope Overrides if LLM planning missed domain-specific tools
        let finalTasks = plan.tasks || [];
        if (scope?.intent === 'FULL_ERP_SUMMARY') {
          finalTasks = [{
            tool: 'get_full_erp_summary',
            parameters: {
              period: scope.period?.periodType || 'this_month',
              date: scope.period?.exactDate,
              year: scope.period?.year,
              month: scope.period?.month,
            },
          }];
        } else if (scope?.intent === 'TRANSACTION_HISTORY') {
          finalTasks = [{
            tool: 'get_sales_transactions',
            parameters: {
              customer: scope.entities.customers[0]?.name,
              product: scope.entities.products[0]?.name,
              date: scope.period?.exactDate,
              limit: 10,
            },
          }];
        } else if (scope?.domains?.includes('damage') && !finalTasks.some((t: any) => t.tool === 'get_damage_summary')) {
          finalTasks = [{
            tool: 'get_damage_summary',
            parameters: {
              period: scope.period?.periodType || 'this_month',
              date: scope.period?.exactDate,
              year: scope.period?.year,
              month: scope.period?.month,
              product: scope.entities.products[0]?.name,
            },
          }];
        } else if (scope?.domains?.includes('returns') && !finalTasks.some((t: any) => t.tool === 'get_return_summary')) {
          finalTasks = [{
            tool: 'get_return_summary',
            parameters: {
              period: scope.period?.periodType || 'this_month',
              date: scope.period?.exactDate,
              year: scope.period?.year,
              month: scope.period?.month,
              product: scope.entities.products[0]?.name,
            },
          }];
        } else if (scope?.domains?.includes('raw_materials') && scope.entities.rawMaterials.length > 0 && !finalTasks.some((t: any) => t.tool === 'get_raw_material_stock')) {
          finalTasks = [{
            tool: 'get_raw_material_stock',
            parameters: {
              material: scope.entities.rawMaterials[0]?.name,
            },
          }];
        }

        // Enforce explicit date / period on all executed tasks
        if (scope?.period?.isExplicitInCurrentQuery) {
          for (const task of finalTasks) {
            task.parameters = {
              ...(task.parameters || {}),
              period: scope.period.periodType,
              date: scope.period.exactDate || task.parameters?.date,
              year: scope.period.year,
              month: scope.period.month,
              startDate: scope.period.startDateStr,
              endDate: scope.period.endDateStr,
            };
          }
        }

        if ((scope?.intent === 'CLARIFICATION_REQUIRED' || plan.clarificationNeeded || scope?.requiresClarification) && (!finalTasks || finalTasks.length === 0)) {
          const clarificationMsg = scope?.clarificationMessage || plan.clarificationMessage || {
            ml: 'ക്ഷമിക്കണം, താങ്കൾ ചോദിച്ച വിഷയം വ്യക്തമായില്ല. വിൽപ്പന, ഉത്പാദനം, സ്റ്റോക്ക്, ഡാമേജ്, റിട്ടേൺ അല്ലെങ്കിൽ കസ്റ്റമർ വിവരങ്ങളിൽ ഏതാണ് താങ്കൾക്ക് അറിയേണ്ടത്?',
            en: 'I did not quite understand your request. Could you please specify if you want information regarding Sales, Production, Stock, Damage, Returns, or Customers?',
          };
          const answer: LocalizedText = {
            ml: clarificationMsg.ml,
            en: clarificationMsg.en,
          };
          const audioUrl = await this.ttsService.generateNeuralSpeech(answer[lang], lang);
          return {
            question: rawQ,
            answer,
            language: lang,
            audioUrl,
            context: {
              ...(conversationContext || {}),
              language: lang,
            },
          };
        }

        if (finalTasks && finalTasks.length > 0) {
          // Execute live ERP tool(s)
          const toolResults: Array<{ tool: string; parameters: any; data: any; success: boolean; error?: string }> = [];
          for (const task of finalTasks) {
            if (task.tool !== 'get_knowledge') {
              this.logger.log(`[KENBY_TRACE] [${reqId}] stage=tool_selected | tool=${task.tool}`);
              const res = await this.toolExecutor.executeTool(task.tool, task.parameters);
              toolResults.push(res);
              this.logger.log(`[KENBY_TRACE] [${reqId}] stage=tool_executed | success=${res.success}`);
            }
          }

          // Execute Vector RAG if knowledge is required
          let ragChunks: Array<{ title: string; content: string; score?: number }> = [];
          const knowledgeTask = plan.tasks.find((t) => t.tool === 'get_knowledge');
          if (plan.requiresKnowledge || knowledgeTask) {
            const topic = (knowledgeTask?.parameters?.topic as string) || rawQ;
            this.logger.log(`[KENBY_TRACE] [${reqId}] stage=rag_retrieval | topic="${topic}"`);
            const vectorRes = await this.vectorRag.searchSimilar(topic, 3);
            ragChunks = vectorRes.map((v) => ({
              title: v.chunk.title,
              content: v.chunk.content,
              score: v.similarity,
            }));
          }

          // Synthesize response using LLM Synthesizer
          this.logger.log(`[KENBY_TRACE] [${reqId}] stage=response_generated`);
          const synthesis = await this.llmSynthesizer.synthesize({
            question: rawQ,
            language: lang,
            conversationContext,
            toolResults,
            ragChunks,
          });

          const speechTxt = synthesis.audioSpeechText || synthesis.answer[lang];
          const audioUrl = await this.ttsService.generateNeuralSpeech(speechTxt, lang);

          this.logger.log(`[KENBY_TRACE] [${reqId}] stage=response_sent`);

          // Format context
          const firstTool = toolResults[0];
          const resolvedContext: KenbyConversationContext = {
            ...(conversationContext || {}),
            language: lang,
            lastIntent: (firstTool?.tool as any) || 'live_data',
          };
          if (firstTool?.data?.customer?.name) {
            resolvedContext.customer = firstTool.data.customer.name;
            resolvedContext.lastCustomer = firstTool.data.customer.name;
            resolvedContext.lastMeaningfulEntity = { type: 'customer', value: firstTool.data.customer.name };
          }
          if (firstTool?.data?.product?.name) {
            resolvedContext.product = firstTool.data.product.name;
            resolvedContext.lastProduct = firstTool.data.product.name;
            resolvedContext.lastMeaningfulEntity = { type: 'product', value: firstTool.data.product.name };
          }

          return {
            question: rawQ,
            answer: synthesis.answer,
            language: lang,
            audioUrl,
            speechText: speechTxt,
            source: plan.requiresKnowledge && toolResults.length > 0 ? 'HYBRID' : (toolResults.length > 0 ? 'LIVE_ERP' : 'RAG'),
            evidence: (firstTool as any)?.evidence,
            data: firstTool?.data || ragChunks,
            context: resolvedContext,
          };
        }
      } catch (err: any) {
        this.logger.warn(`[KENBY_TRACE] [${reqId}] LLM Planning flow error, falling back to deterministic: ${err.message}`);
      }
    }

    // 1. ROUTE QUESTION USING CONVERSATIONAL INTENT ROUTER
    const intent: KenbyIntent = await this.kenbyRouterService.routeQuestion(rawQ, conversationContext);
    this.logger.log(`[KENBY_TRACE] [${reqId}] capability_selected: intent=${intent.type}`);

    let response: AskQuestionResponse;

    // 2. GREETING INTENT (Independent, resets context)
    if (intent.type === 'greeting') {
      const answer: LocalizedText = {
        ml: 'ഹായ്! 👋 എങ്ങനെ സഹായിക്കാം?',
        en: 'Hi! 👋 How can I help you?',
      };
      const audioUrl = await this.ttsService.generateNeuralSpeech(answer[lang], lang);

      response = {
        question: rawQ,
        answer,
        language: lang,
        audioUrl,
        context: {
          activeTopic: null,
          primaryPeriod: null,
          comparisonPeriod: null,
          metric: null,
          product: null,
          lastMeaningfulEntity: null,
          lastIntent: 'greeting',
          pendingAmbiguity: null,
          language: lang,
          lastMetric: null,
          lastPeriod: null,
          lastProduct: null,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Greeting intent: reset context');
      return response;
    }

    // 2a. CLARIFICATION PROMPT INTENT (Ambiguous active periods)
    if (intent.type === 'clarification_prompt') {
      const answer: LocalizedText = {
        ml: intent.promptMl,
        en: intent.promptEn,
      };
      const audioUrl = await this.ttsService.generateNeuralSpeech(answer[lang], lang);

      response = {
        question: rawQ,
        answer,
        language: lang,
        audioUrl,
        context: {
          activeTopic: (conversationContext?.activeTopic || 'business') as any,
          primaryPeriod: conversationContext?.primaryPeriod || conversationContext?.lastPeriod || null,
          comparisonPeriod: conversationContext?.comparisonPeriod || null,
          metric: intent.metric,
          product: conversationContext?.product || conversationContext?.lastProduct || null,
          lastMeaningfulEntity: conversationContext?.lastMeaningfulEntity || null,
          lastIntent: 'clarification_prompt',
          pendingAmbiguity: {
            metric: intent.metric,
            options: intent.options,
          },
          language: lang,
          lastMetric: (conversationContext?.lastMetric || 'business') as any,
          lastPeriod: conversationContext?.primaryPeriod || conversationContext?.lastPeriod || null,
          lastProduct: conversationContext?.product || conversationContext?.lastProduct || null,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Ambiguity detected: asking user for period clarification');
      return response;
    }

    // 2b. WHY / EXPLANATION INTENT (Honest transparent response, no LLM hallucinations)
    if (intent.type === 'why_explanation') {
      const answer: LocalizedText = {
        ml: 'ഇതിന് കാരണം വ്യക്തമാക്കാൻ ആവശ്യമായ customer/order-level data Kenby-യിൽ ഇല്ല.',
        en: 'Detailed customer or order-level driver data is not available to explain the exact cause in Kenby.',
      };
      const audioUrl = await this.ttsService.generateNeuralSpeech(answer[lang], lang);

      response = {
        question: rawQ,
        answer,
        language: lang,
        audioUrl,
        context: {
          activeTopic: conversationContext?.activeTopic || null,
          primaryPeriod: conversationContext?.primaryPeriod || conversationContext?.lastPeriod || null,
          comparisonPeriod: conversationContext?.comparisonPeriod || null,
          metric: conversationContext?.metric || null,
          product: conversationContext?.product || conversationContext?.lastProduct || null,
          lastMeaningfulEntity: conversationContext?.lastMeaningfulEntity || null,
          lastIntent: 'why_explanation',
          pendingAmbiguity: null,
          language: lang,
          lastMetric: conversationContext?.lastMetric || null,
          lastPeriod: conversationContext?.lastPeriod || null,
          lastProduct: conversationContext?.lastProduct || null,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Transparent driver data response');
      return response;
    }

    // 2c. CONTEXT CORRECTION INTENT (Natural acknowledgement + tool re-execution)
    if (intent.type === 'context_correction') {
      this.logger.log(`[KENBY_FLOW] Executing context_correction for targetIntent=${intent.targetIntent.type}`);
      const baseResult = await this.askQuestionWithIntent(intent.targetIntent, rawQ, lang, conversationContext);

      const ackPrefixMl = this.buildCorrectionAckMl(intent, baseResult.answer.ml);
      const ackPrefixEn = this.buildCorrectionAckEn(intent, baseResult.answer.en);

      const answer: LocalizedText = {
        ml: ackPrefixMl,
        en: ackPrefixEn,
      };

      const audioUrl = await this.ttsService.generateNeuralSpeech(answer[lang], lang);

      response = {
        ...baseResult,
        question: rawQ,
        answer,
        audioUrl,
        context: {
          ...baseResult.context,
          comparisonPeriod: null, // Correction clears comparison state!
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Acknowledged user correction and updated primaryPeriod');
      return response;
    }

    // 3. KNOWLEDGE INTENT (RAG RETRIEVAL PATH)
    if (intent.type === 'knowledge') {
      this.logger.log(`[KENBY_FLOW] Executing RAG Knowledge path for question: "${rawQ}"`);
      const doc = await this.kenbyRagService.retrieveKnowledge(intent.query);

      const answer: LocalizedText = doc
        ? {
            ml: `${doc.title}: ${doc.content}`,
            en: `${doc.title}: ${doc.content}`,
          }
        : {
            ml: 'ചോദിച്ച വിഷയത്തെക്കുറിച്ചുള്ള വിവരങ്ങൾ ലഭ്യമാണ്.',
            en: 'Information for this knowledge topic is available.',
          };

      const audioUrl = await this.ttsService.generateNeuralSpeech(answer[lang], lang);

      response = {
        question: rawQ,
        answer,
        language: lang,
        audioUrl,
        source: 'kenby_ai_documents',
        context: {
          activeTopic: 'knowledge',
          primaryPeriod: conversationContext?.primaryPeriod || conversationContext?.lastPeriod || null,
          comparisonPeriod: conversationContext?.comparisonPeriod || null,
          metric: 'knowledge',
          product: conversationContext?.product || conversationContext?.lastProduct || null,
          lastMeaningfulEntity: null,
          lastIntent: 'knowledge',
          pendingAmbiguity: null,
          language: lang,
          lastMetric: 'knowledge',
          lastPeriod: conversationContext?.lastPeriod || null,
          lastProduct: conversationContext?.lastProduct || null,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'RAG Knowledge answer');
      return response;
    }

    // 4. BUSINESS ANALYSIS TOOL (Phase 9 & 11.2: Multi-Metric Reasoning & Comparison)
    if (intent.type === 'business_analysis') {
      this.logger.log(`[KENBY_FLOW] Executing business_analysis tool for mode=${intent.queryMode}`);
      const analysisData = await this.kenbyAnalysisService.executeAnalysis(
        intent.input,
        intent.metrics,
        intent.queryMode,
        intent.productFilter || conversationContext?.product || conversationContext?.lastProduct || undefined,
        lang
      );
      const formattedAnswer = analysisData.answerText;
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      const primaryP = intent.comparisonPeriodInput || conversationContext?.primaryPeriod || conversationContext?.lastPeriod || { period: 'specific_month', year: 2026, month: 7 };
      const compP = intent.queryMode === 'comparison' ? intent.input : null;

      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'kenby_multi_tool_analysis',
        data: analysisData.metricsData,
        context: {
          activeTopic: 'sales',
          primaryPeriod: primaryP,
          comparisonPeriod: compP,
          metric: 'sales',
          product: intent.productFilter || conversationContext?.product || conversationContext?.lastProduct || null,
          lastMeaningfulEntity: { type: 'comparison', value: analysisData.metricsData },
          lastIntent: 'business_analysis',
          pendingAmbiguity: null,
          language: lang,
          lastMetric: 'business',
          lastPeriod: primaryP,
          lastProduct: intent.productFilter || conversationContext?.product || conversationContext?.lastProduct || null,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, `Executed business_analysis mode=${intent.queryMode}`);
      return response;
    }

    // 5. BUSINESS SNAPSHOT TOOL (get_business_snapshot)
    if (intent.type === 'business_snapshot') {
      this.logger.log(`[KENBY_FLOW] Executing get_business_snapshot tool`);
      const snapshot: BusinessSnapshotResult = await this.kenbyLiveDataService.getBusinessSnapshot(intent.input);
      const formattedAnswer = this.formatBusinessSnapshotAnswer(snapshot, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      const normPeriod = this.normalizePeriodForContext(snapshot.period);
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'kenby_business_snapshot',
        data: snapshot,
        context: {
          activeTopic: 'business',
          primaryPeriod: normPeriod,
          comparisonPeriod: null,
          metric: 'business',
          product: null,
          lastMeaningfulEntity: { type: 'metric', value: snapshot },
          lastIntent: 'business_snapshot',
          pendingAmbiguity: null,
          language: lang,
          lastMetric: 'business',
          lastPeriod: normPeriod,
          lastProduct: null,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed get_business_snapshot');
      return response;
    }

    // 6. SALES SUMMARY TOOL (get_sales_summary)
    if (intent.type === 'sales_summary') {
      this.logger.log(`[KENBY_FLOW] Executing get_sales_summary tool`);
      const liveData: SalesSummaryResult = await this.kenbyLiveDataService.getSalesSummary(intent.input);
      const formattedAnswer = this.formatSalesSummaryAnswer(liveData, lang, intent.productFilter);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      const normPeriod = this.normalizePeriodForContext(liveData.period);
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'sales_transactions',
        data: liveData,
        context: {
          activeTopic: 'sales',
          primaryPeriod: normPeriod,
          comparisonPeriod: null,
          metric: 'sales',
          product: intent.productFilter || conversationContext?.product || conversationContext?.lastProduct || null,
          lastMeaningfulEntity: { type: 'metric', value: liveData },
          lastIntent: 'sales_summary',
          pendingAmbiguity: null,
          language: lang,
          lastMetric: 'sales',
          lastPeriod: normPeriod,
          lastProduct: intent.productFilter || conversationContext?.product || conversationContext?.lastProduct || null,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed get_sales_summary');
      return response;
    }

    // 7. PRODUCTION SUMMARY TOOL (get_production_summary)
    if (intent.type === 'production_summary') {
      this.logger.log(`[KENBY_FLOW] Executing get_production_summary tool`);
      const liveData: ProductionSummaryResult = await this.kenbyLiveDataService.getProductionSummary(intent.input);
      const formattedAnswer = this.formatProductionSummaryAnswer(liveData, lang, intent.productFilter);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      const normPeriod = this.normalizePeriodForContext(liveData.period);
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'production_logs',
        data: liveData,
        context: {
          activeTopic: 'production',
          primaryPeriod: normPeriod,
          comparisonPeriod: null,
          metric: 'production',
          product: intent.productFilter || conversationContext?.product || conversationContext?.lastProduct || null,
          lastMeaningfulEntity: { type: 'metric', value: liveData },
          lastIntent: 'production_summary',
          pendingAmbiguity: null,
          language: lang,
          lastMetric: 'production',
          lastPeriod: normPeriod,
          lastProduct: intent.productFilter || conversationContext?.product || conversationContext?.lastProduct || null,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed get_production_summary');
      return response;
    }

    // 8. CURRENT STOCK TOOL (get_current_stock)
    if (intent.type === 'stock_summary') {
      this.logger.log(`[KENBY_FLOW] Executing get_current_stock tool`);
      const liveData: CurrentStockResult = await this.kenbyLiveDataService.getCurrentStock(intent.productFilter);
      const formattedAnswer = this.formatCurrentStockAnswer(liveData, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      const effectiveProd = intent.productFilter || conversationContext?.product || conversationContext?.lastProduct || null;
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'production_stock',
        data: liveData,
        context: {
          activeTopic: 'stock',
          primaryPeriod: conversationContext?.primaryPeriod || conversationContext?.lastPeriod || { period: 'this_month' },
          comparisonPeriod: conversationContext?.comparisonPeriod || null,
          metric: 'stock',
          product: effectiveProd,
          lastMeaningfulEntity: { type: 'product', value: effectiveProd },
          lastIntent: 'stock_summary',
          pendingAmbiguity: null,
          language: lang,
          lastMetric: 'stock',
          lastPeriod: conversationContext?.primaryPeriod || conversationContext?.lastPeriod || { period: 'this_month' },
          lastProduct: effectiveProd,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed get_current_stock');
      return response;
    }

    // 8a. PRODUCT-WISE STOCK BREAKDOWN TOOL (get_stock_breakdown)
    if (intent.type === 'stock_breakdown') {
      this.logger.log(`[KENBY_FLOW] Executing stock_breakdown tool`);
      const liveData: CurrentStockResult = await this.kenbyLiveDataService.getCurrentStock(intent.productFilter);
      const formattedAnswer = this.formatStockBreakdownAnswer(liveData, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      const effectiveProd = intent.productFilter || conversationContext?.product || conversationContext?.lastProduct || null;
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'production_stock',
        data: liveData,
        context: {
          activeTopic: 'stock',
          primaryPeriod: { period: 'this_month' },
          comparisonPeriod: null,
          metric: 'stock',
          product: effectiveProd,
          lastMeaningfulEntity: { type: 'product', value: effectiveProd },
          lastIntent: 'stock_breakdown',
          pendingAmbiguity: null,
          language: lang,
          lastMetric: 'stock',
          lastPeriod: { period: 'this_month' },
          lastProduct: effectiveProd,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed get_stock_breakdown');
      return response;
    }

    // 9. SALES RETURN SUMMARY TOOL (get_sales_return_summary)
    if (intent.type === 'sales_return_summary') {
      this.logger.log(`[KENBY_FLOW] Executing get_sales_return_summary tool`);
      const liveData: SalesSummaryResult = await this.kenbyLiveDataService.getSalesReturnSummary(intent.input);
      const formattedAnswer = this.formatReturnSummaryAnswer(liveData, lang, intent.productFilter);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      const normPeriod = this.normalizePeriodForContext(liveData.period);
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'sales_transactions',
        data: liveData,
        context: {
          activeTopic: 'returns',
          primaryPeriod: normPeriod,
          comparisonPeriod: null,
          metric: 'returns',
          product: intent.productFilter || conversationContext?.product || conversationContext?.lastProduct || null,
          lastMeaningfulEntity: { type: 'metric', value: liveData },
          lastIntent: 'sales_return_summary',
          pendingAmbiguity: null,
          language: lang,
          lastMetric: 'returns',
          lastPeriod: normPeriod,
          lastProduct: intent.productFilter || conversationContext?.product || conversationContext?.lastProduct || null,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed get_sales_return_summary');
      return response;
    }

    // 10. DAMAGE SUMMARY TOOL (get_damage_summary)
    if (intent.type === 'damage_summary') {
      this.logger.log(`[KENBY_FLOW] Executing get_damage_summary tool`);
      const liveData: SalesSummaryResult = await this.kenbyLiveDataService.getDamageSummary(intent.input);
      const formattedAnswer = this.formatDamageSummaryAnswer(liveData, lang, intent.productFilter);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      const normPeriod = this.normalizePeriodForContext(liveData.period);
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'sales_transactions',
        data: liveData,
        context: {
          activeTopic: 'damage',
          primaryPeriod: normPeriod,
          comparisonPeriod: null,
          metric: 'damage',
          product: intent.productFilter || conversationContext?.product || conversationContext?.lastProduct || null,
          lastMeaningfulEntity: { type: 'metric', value: liveData },
          lastIntent: 'damage_summary',
          pendingAmbiguity: null,
          language: lang,
          lastMetric: 'damage',
          lastPeriod: normPeriod,
          lastProduct: intent.productFilter || conversationContext?.product || conversationContext?.lastProduct || null,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed get_damage_summary');
      return response;
    }

    // 11. RETURN BREAKDOWN TOOL (get_return_breakdown)
    if (intent.type === 'return_breakdown') {
      this.logger.log(`[KENBY_FLOW] Executing get_return_breakdown tool`);
      const breakdownData: ReturnBreakdownResult = await this.kenbyLiveDataService.getReturnBreakdown(
        intent.input,
        intent.productFilter
      );
      const formattedAnswer = this.formatReturnBreakdownAnswer(breakdownData, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      const topProd = breakdownData.products[0]?.productName || intent.productFilter || conversationContext?.product || conversationContext?.lastProduct || null;
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'sales_transactions',
        data: breakdownData,
        context: {
          activeTopic: 'returns',
          primaryPeriod: this.normalizePeriodForContext(breakdownData.period),
          comparisonPeriod: null,
          metric: 'returns',
          product: topProd,
          lastMeaningfulEntity: { type: 'product', value: topProd },
          lastIntent: 'return_breakdown',
          pendingAmbiguity: null,
          language: lang,
          lastMetric: 'returns',
          lastPeriod: this.normalizePeriodForContext(breakdownData.period),
          lastProduct: topProd,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed get_return_breakdown');
      return response;
    }

    // 12. DAMAGE BREAKDOWN TOOL (get_damage_breakdown)
    if (intent.type === 'damage_breakdown') {
      this.logger.log(`[KENBY_FLOW] Executing get_damage_breakdown tool`);
      const breakdownData: DamageBreakdownResult = await this.kenbyLiveDataService.getDamageBreakdown(
        intent.input,
        intent.productFilter
      );
      const formattedAnswer = this.formatDamageBreakdownAnswer(breakdownData, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      const topProd = breakdownData.products[0]?.productName || intent.productFilter || conversationContext?.product || conversationContext?.lastProduct || null;
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'sales_transactions',
        data: breakdownData,
        context: {
          activeTopic: 'damage',
          primaryPeriod: this.normalizePeriodForContext(breakdownData.period),
          comparisonPeriod: null,
          metric: 'damage',
          product: topProd,
          lastMeaningfulEntity: { type: 'product', value: topProd },
          lastIntent: 'damage_breakdown',
          pendingAmbiguity: null,
          language: lang,
          lastMetric: 'damage',
          lastPeriod: this.normalizePeriodForContext(breakdownData.period),
          lastProduct: topProd,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed get_damage_breakdown');
      return response;
    }

    // 13. SALES BREAKDOWN TOOL (get_sales_breakdown)
    if (intent.type === 'sales_breakdown') {
      this.logger.log(`[KENBY_FLOW] Executing get_sales_breakdown tool`);
      const breakdownData: SalesBreakdownResult = await this.kenbyLiveDataService.getSalesBreakdown(
        intent.input,
        intent.productFilter
      );
      const formattedAnswer = this.formatSalesBreakdownAnswer(breakdownData, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      const topProd = breakdownData.products[0]?.productName || intent.productFilter || conversationContext?.product || conversationContext?.lastProduct || null;
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'sales_transactions',
        data: breakdownData,
        context: {
          activeTopic: 'sales',
          primaryPeriod: this.normalizePeriodForContext(breakdownData.period),
          comparisonPeriod: null,
          metric: 'sales',
          product: topProd,
          lastMeaningfulEntity: { type: 'product', value: topProd },
          lastIntent: 'sales_breakdown',
          pendingAmbiguity: null,
          language: lang,
          lastMetric: 'sales',
          lastPeriod: this.normalizePeriodForContext(breakdownData.period),
          lastProduct: topProd,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed get_sales_breakdown');
      return response;
    }

    // 14. PRODUCTION BREAKDOWN TOOL (get_production_breakdown)
    if (intent.type === 'production_breakdown') {
      this.logger.log(`[KENBY_FLOW] Executing get_production_breakdown tool`);
      const breakdownData: ProductionBreakdownResult = await this.kenbyLiveDataService.getProductionBreakdown(
        intent.input,
        intent.productFilter
      );
      const formattedAnswer = this.formatProductionBreakdownAnswer(breakdownData, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      const topProd = breakdownData.products[0]?.productName || intent.productFilter || conversationContext?.product || conversationContext?.lastProduct || null;
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'production_logs',
        data: breakdownData,
        context: {
          activeTopic: 'production',
          primaryPeriod: this.normalizePeriodForContext(breakdownData.period),
          comparisonPeriod: null,
          metric: 'production',
          product: topProd,
          lastMeaningfulEntity: { type: 'product', value: topProd },
          lastIntent: 'production_breakdown',
          pendingAmbiguity: null,
          language: lang,
          lastMetric: 'production',
          lastPeriod: this.normalizePeriodForContext(breakdownData.period),
          lastProduct: topProd,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed get_production_breakdown');
      return response;
    }

    // ==========================================
    // ERP DOMAIN 1: CUSTOMER INTELLIGENCE
    // ==========================================
    if (intent.type === 'customer_count') {
      this.logger.log(`[KENBY_FLOW] Executing customer_count tool`);
      const res = await this.kenbyErpRegistry.getCustomerCount();
      const formattedAnswer = this.formatCustomerCountAnswer(res, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'customers',
        data: res,
        context: {
          activeTopic: 'customers',
          metric: 'customer_count',
          lastMeaningfulEntity: { type: 'metric', value: res },
          lastIntent: 'customer_count',
          language: lang,
          lastMetric: 'customers',
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed customer_count');
      return response;
    }

    if (intent.type === 'customer_list') {
      this.logger.log(`[KENBY_FLOW] Executing customer_list tool`);
      const res = await this.kenbyErpRegistry.listCustomers(intent.statusFilter);
      const formattedAnswer = this.formatCustomerListAnswer(res, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'customers',
        data: res,
        context: {
          activeTopic: 'customers',
          metric: 'customer_list',
          lastMeaningfulEntity: { type: 'metric', value: res },
          lastIntent: 'customer_list',
          language: lang,
          lastMetric: 'customers',
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed customer_list');
      return response;
    }

    if (intent.type === 'customer_profile') {
      this.logger.log(`[KENBY_FLOW] Executing customer_profile tool for: "${intent.customerQuery}"`);
      const profile = await this.kenbyErpRegistry.getCustomerProfile(intent.customerQuery);
      const formattedAnswer = this.formatCustomerProfileAnswer(profile, intent.customerQuery, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      const custName = profile?.customer.name || intent.customerQuery;
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'customers',
        data: profile,
        context: {
          activeTopic: 'customers',
          customer: custName,
          lastMeaningfulEntity: { type: 'customer', value: custName },
          lastIntent: 'customer_profile',
          language: lang,
          lastMetric: 'customers',
          lastCustomer: custName,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed customer_profile');
      return response;
    }

    if (intent.type === 'customer_balance') {
      this.logger.log(`[KENBY_FLOW] Executing customer_balance tool`);
      const q = intent.customerQuery || conversationContext?.customer || conversationContext?.lastCustomer;
      let profile: CustomerProfileResult | null = null;
      let ranking: any[] = [];

      if (q) {
        profile = await this.kenbyErpRegistry.getCustomerProfile(q);
      } else {
        ranking = await this.kenbyErpRegistry.getCustomerDebtRanking(5);
      }

      const formattedAnswer = this.formatCustomerBalanceAnswer(profile, ranking, q, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'customers',
        data: profile || ranking,
        context: {
          activeTopic: 'customers',
          metric: 'customer_balance',
          customer: profile?.customer.name || null,
          lastMeaningfulEntity: { type: 'customer', value: profile?.customer.name || ranking },
          lastIntent: 'customer_balance',
          language: lang,
          lastMetric: 'customers',
          lastCustomer: profile?.customer.name || null,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed customer_balance');
      return response;
    }

    if (intent.type === 'customer_ranking_debt') {
      this.logger.log(`[KENBY_FLOW] Executing customer_ranking_debt tool`);
      const ranking = await this.kenbyErpRegistry.getCustomerDebtRanking(intent.limit || 5);
      const formattedAnswer = this.formatCustomerDebtRankingAnswer(ranking, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'customers',
        data: ranking,
        context: {
          activeTopic: 'customers',
          metric: 'customer_ranking_debt',
          lastMeaningfulEntity: { type: 'metric', value: ranking },
          lastIntent: 'customer_ranking_debt',
          language: lang,
          lastMetric: 'customers',
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed customer_ranking_debt');
      return response;
    }

    if (intent.type === 'customer_ranking_sales') {
      this.logger.log(`[KENBY_FLOW] Executing customer_ranking_sales tool`);
      const ranking = await this.kenbyErpRegistry.getTopCustomersBySales(intent.input, intent.limit || 5);
      const formattedAnswer = this.formatCustomerSalesRankingAnswer(ranking, intent.input, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'sales_transactions',
        data: ranking,
        context: {
          activeTopic: 'customers',
          metric: 'customer_ranking_sales',
          lastMeaningfulEntity: { type: 'metric', value: ranking },
          lastIntent: 'customer_ranking_sales',
          language: lang,
          lastMetric: 'sales',
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed customer_ranking_sales');
      return response;
    }

    // ==========================================
    // ERP DOMAIN 2: RAW MATERIAL INTELLIGENCE
    // ==========================================
    if (intent.type === 'raw_material_summary') {
      this.logger.log(`[KENBY_FLOW] Executing raw_material_summary tool`);
      const stockRes = await this.kenbyErpRegistry.getRawMaterialsStock(intent.typeFilter);
      const formattedAnswer = this.formatRawMaterialSummaryAnswer(stockRes, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'raw_materials',
        data: stockRes,
        context: {
          activeTopic: 'raw_materials',
          metric: 'raw_material_summary',
          lastMeaningfulEntity: { type: 'metric', value: stockRes },
          lastIntent: 'raw_material_summary',
          language: lang,
          lastMetric: 'raw_materials',
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed raw_material_summary');
      return response;
    }

    if (intent.type === 'raw_material_item') {
      this.logger.log(`[KENBY_FLOW] Executing raw_material_item tool for: "${intent.materialQuery}"`);
      const item = await this.kenbyErpRegistry.findRawMaterial(intent.materialQuery);
      const formattedAnswer = this.formatRawMaterialItemAnswer(item, intent.materialQuery, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'raw_materials',
        data: item,
        context: {
          activeTopic: 'raw_materials',
          rawMaterial: item?.name || intent.materialQuery,
          lastMeaningfulEntity: { type: 'raw_material', value: item?.name || intent.materialQuery },
          lastIntent: 'raw_material_item',
          language: lang,
          lastMetric: 'raw_materials',
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed raw_material_item');
      return response;
    }

    if (intent.type === 'raw_material_lowest') {
      this.logger.log(`[KENBY_FLOW] Executing raw_material_lowest tool`);
      const lowItems = await this.kenbyErpRegistry.getLowStockRawMaterials(0);
      const formattedAnswer = this.formatRawMaterialLowestAnswer(lowItems, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'raw_materials',
        data: lowItems,
        context: {
          activeTopic: 'raw_materials',
          metric: 'raw_material_lowest',
          lastMeaningfulEntity: { type: 'metric', value: lowItems },
          lastIntent: 'raw_material_lowest',
          language: lang,
          lastMetric: 'raw_materials',
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed raw_material_lowest');
      return response;
    }

    if (intent.type === 'raw_material_movements') {
      this.logger.log(`[KENBY_FLOW] Executing raw_material_movements tool`);
      // Use contextual material or the one specified in intent, default to first available
      const materialQuery = (intent as any).materialQuery || conversationContext?.rawMaterial || null;
      const prof = materialQuery
        ? await this.kenbyErpRegistry.getRawMaterialProfile(materialQuery)
        : await this.kenbyErpRegistry.getRawMaterialProfile('PREFORM');
      const formattedAnswer = this.formatRawMaterialMovementsAnswer(prof, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'raw_material_transactions',
        data: prof,
        context: {
          activeTopic: 'raw_materials',
          metric: 'raw_material_movements',
          lastMeaningfulEntity: { type: 'metric', value: prof },
          lastIntent: 'raw_material_movements',
          language: lang,
          lastMetric: 'raw_materials',
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed raw_material_movements');
      return response;
    }

    // ==========================================
    // ERP DOMAIN 3: PRODUCT FULL PROFILE
    // ==========================================
    if (intent.type === 'product_profile') {
      this.logger.log(`[KENBY_FLOW] Executing product_profile tool for: "${intent.productQuery}"`);
      const prodProf = await this.kenbyErpRegistry.getProductFullProfile(intent.productQuery);
      const formattedAnswer = this.formatProductFullProfileAnswer(prodProf, intent.productQuery, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      const prodName = prodProf?.product.name || intent.productQuery;
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'products',
        data: prodProf,
        context: {
          activeTopic: 'stock',
          product: prodName,
          lastMeaningfulEntity: { type: 'product', value: prodName },
          lastIntent: 'product_profile',
          language: lang,
          lastMetric: 'stock',
          lastProduct: prodName,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed product_profile');
      return response;
    }

    // ==========================================
    // ERP DOMAIN 4: PROCUREMENT & VENDORS
    // ==========================================
    if (intent.type === 'vendor_list') {
      this.logger.log(`[KENBY_FLOW] Executing vendor_list tool`);
      const vendorList = await this.kenbyErpRegistry.listVendors();
      const formattedAnswer = this.formatVendorListAnswer(vendorList, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'vendors',
        data: vendorList,
        context: {
          activeTopic: 'procurement',
          metric: 'vendor_list',
          lastMeaningfulEntity: { type: 'metric', value: vendorList },
          lastIntent: 'vendor_list',
          language: lang,
          lastMetric: 'procurement',
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed vendor_list');
      return response;
    }

    if (intent.type === 'purchase_orders_summary') {
      this.logger.log(`[KENBY_FLOW] Executing purchase_orders_summary tool`);
      const poSum = await this.kenbyErpRegistry.getPurchaseOrdersSummary();
      const formattedAnswer = this.formatPurchaseOrdersSummaryAnswer(poSum, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'purchase_orders',
        data: poSum,
        context: {
          activeTopic: 'procurement',
          metric: 'purchase_orders_summary',
          lastMeaningfulEntity: { type: 'metric', value: poSum },
          lastIntent: 'purchase_orders_summary',
          language: lang,
          lastMetric: 'procurement',
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed purchase_orders_summary');
      return response;
    }

    // ==========================================
    // ERP DOMAIN 5: PRODUCTION BATCHES & DOWNTIME
    // ==========================================
    if (intent.type === 'production_batches') {
      this.logger.log(`[KENBY_FLOW] Executing production_batches tool`);
      const batches = await this.kenbyErpRegistry.getBatchesSummary();
      const formattedAnswer = this.formatProductionBatchesAnswer(batches, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'production_batches',
        data: batches,
        context: {
          activeTopic: 'production',
          metric: 'production_batches',
          lastMeaningfulEntity: { type: 'metric', value: batches },
          lastIntent: 'production_batches',
          language: lang,
          lastMetric: 'production',
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed production_batches');
      return response;
    }

    if (intent.type === 'production_downtime') {
      this.logger.log(`[KENBY_FLOW] Executing production_downtime tool`);
      const dt = await this.kenbyErpRegistry.getDowntimeSummary();
      const formattedAnswer = this.formatProductionDowntimeAnswer(dt, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);

      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'downtime_logs',
        data: dt,
        context: {
          activeTopic: 'production',
          metric: 'production_downtime',
          lastMeaningfulEntity: { type: 'metric', value: dt },
          lastIntent: 'production_downtime',
          language: lang,
          lastMetric: 'production',
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed production_downtime');
      return response;
    }

    // ==========================================
    // NEW ERP INTENTS
    // ==========================================

    if (intent.type === 'customer_transactions') {
      this.logger.log(`[KENBY_FLOW] Executing customer_transactions for: "${intent.customerQuery}"`);
      const result = await this.kenbyErpRegistry.getCustomerTransactionsByPeriod(intent.customerQuery, (intent as any).input);
      const formattedAnswer = this.formatCustomerTransactionsAnswer(result, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);
      const custName = result.customer?.name || intent.customerQuery;
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'sales_transactions',
        data: result,
        context: {
          activeTopic: 'customers',
          customer: custName,
          lastMeaningfulEntity: { type: 'customer', value: custName },
          lastIntent: 'customer_transactions',
          language: lang,
          lastMetric: 'customers',
          lastCustomer: custName,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed customer_transactions');
      return response;
    }

    if (intent.type === 'customer_sales_period') {
      this.logger.log(`[KENBY_FLOW] Executing customer_sales_period for: "${intent.customerQuery}"`);
      const result = await this.kenbyErpRegistry.getCustomerTransactionsByPeriod(intent.customerQuery, intent.input);
      const formattedAnswer = this.formatCustomerSalesPeriodAnswer(result, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);
      const custName = result.customer?.name || intent.customerQuery;
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'sales_transactions',
        data: result,
        context: {
          activeTopic: 'customers',
          customer: custName,
          primaryPeriod: intent.input,
          lastMeaningfulEntity: { type: 'customer', value: custName },
          lastEntity: { type: 'customer', id: result.customer?.id || '', name: custName },
          lastIntent: 'customer_sales_period',
          language: lang,
          lastMetric: 'customers',
          lastCustomer: custName,
          lastPeriod: intent.input,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed customer_sales_period');
      return response;
    }

    if (intent.type === 'customer_payments') {
      this.logger.log(`[KENBY_FLOW] Executing customer_payments for: "${intent.customerQuery}"`);
      const result = await this.kenbyErpRegistry.getCustomerPayments(intent.customerQuery);
      const formattedAnswer = this.formatCustomerPaymentsAnswer(result, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);
      const custName = result.customer?.name || intent.customerQuery;
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'sales_payments',
        data: result,
        context: {
          activeTopic: 'finance',
          customer: custName,
          lastMeaningfulEntity: { type: 'customer', value: custName },
          lastEntity: { type: 'customer', id: result.customer?.id || '', name: custName },
          lastIntent: 'customer_payments',
          language: lang,
          lastMetric: 'customers',
          lastCustomer: custName,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed customer_payments');
      return response;
    }

    if (intent.type === 'customer_ledger') {
      this.logger.log(`[KENBY_FLOW] Executing customer_ledger for: "${intent.customerQuery}"`);
      const result = await this.kenbyErpRegistry.getCustomerLedgerStatement(intent.customerQuery);
      const formattedAnswer = this.formatCustomerLedgerAnswer(result, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);
      const custName = result?.customer?.name || intent.customerQuery;
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'sales_orders',
        data: result,
        context: {
          activeTopic: 'customers',
          customer: custName,
          lastMeaningfulEntity: { type: 'customer', value: custName },
          lastEntity: { type: 'customer', id: result?.customer?.id || '', name: custName },
          lastIntent: 'customer_ledger',
          language: lang,
          lastMetric: 'customers',
          lastCustomer: custName,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed customer_ledger');
      return response;
    }

    if (intent.type === 'product_bom') {
      this.logger.log(`[KENBY_FLOW] Executing product_bom for: "${intent.productQuery}"`);
      const result = await this.kenbyErpRegistry.getProductBom(intent.productQuery);
      const formattedAnswer = this.formatProductBomAnswer(result, intent.productQuery, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);
      const prodName = result?.product?.name || intent.productQuery;
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'bill_of_materials',
        data: result,
        context: {
          activeTopic: 'stock',
          product: prodName,
          lastMeaningfulEntity: { type: 'product', value: prodName },
          lastEntity: { type: 'product', id: result?.product?.id || '', name: prodName },
          lastIntent: 'product_bom',
          language: lang,
          lastMetric: 'stock',
          lastProduct: prodName,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed product_bom');
      return response;
    }

    if (intent.type === 'inventory_stock_summary') {
      this.logger.log(`[KENBY_FLOW] Executing inventory_stock_summary tool`);
      const result = await this.kenbyErpRegistry.getInventoryStockSummary();
      const formattedAnswer = this.formatInventoryStockSummaryAnswer(result, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'inventory_stock',
        data: result,
        context: {
          activeTopic: 'stock',
          metric: 'inventory_stock',
          lastMeaningfulEntity: { type: 'metric', value: result },
          lastIntent: 'inventory_stock_summary',
          language: lang,
          lastMetric: 'stock',
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed inventory_stock_summary');
      return response;
    }

    if (intent.type === 'product_list') {
      this.logger.log(`[KENBY_FLOW] Executing product_list tool`);
      const result = await this.kenbyErpRegistry.listAllProducts();
      const formattedAnswer = this.formatProductListAnswer(result, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'products',
        data: result,
        context: {
          activeTopic: 'stock',
          metric: 'product_list',
          lastMeaningfulEntity: { type: 'metric', value: result },
          lastIntent: 'product_list',
          language: lang,
          lastMetric: 'stock',
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed product_list');
      return response;
    }

    if (intent.type === 'product_stock_named') {
      this.logger.log(`[KENBY_FLOW] Executing product_stock_named for: "${intent.productQuery}"`);
      const result = await this.kenbyErpRegistry.getProductStockByName(intent.productQuery);
      const formattedAnswer = this.formatProductStockNamedAnswer(result, intent.productQuery, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);
      const prodName = result?.productName || intent.productQuery;
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'production_stock',
        data: result,
        context: {
          activeTopic: 'stock',
          product: prodName,
          lastMeaningfulEntity: { type: 'product', value: prodName },
          lastIntent: 'product_stock_named',
          language: lang,
          lastMetric: 'stock',
          lastProduct: prodName,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed product_stock_named');
      return response;
    }

    if (intent.type === 'product_lowest_stock') {
      this.logger.log(`[KENBY_FLOW] Executing product_lowest_stock tool`);
      const result = await this.kenbyErpRegistry.getLowStockProducts(100);
      const formattedAnswer = this.formatProductLowestStockAnswer(result, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'production_stock',
        data: result,
        context: {
          activeTopic: 'stock',
          metric: 'product_lowest_stock',
          lastMeaningfulEntity: { type: 'metric', value: result },
          lastIntent: 'product_lowest_stock',
          language: lang,
          lastMetric: 'stock',
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed product_lowest_stock');
      return response;
    }

    if (intent.type === 'product_highest_stock') {
      this.logger.log(`[KENBY_FLOW] Executing product_highest_stock tool`);
      const result = await this.kenbyErpRegistry.getHighestStockProduct();
      const formattedAnswer = this.formatProductHighestStockAnswer(result, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'production_stock',
        data: result,
        context: {
          activeTopic: 'stock',
          metric: 'product_highest_stock',
          lastMeaningfulEntity: { type: 'metric', value: result },
          lastIntent: 'product_highest_stock',
          language: lang,
          lastMetric: 'stock',
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed product_highest_stock');
      return response;
    }

    if (intent.type === 'product_best_selling') {
      this.logger.log(`[KENBY_FLOW] Executing product_best_selling tool`);
      const periodIn = (intent as any).input || { period: 'this_month' };
      const result = await this.kenbyErpRegistry.getBestSellingProduct(periodIn);
      const formattedAnswer = this.formatProductBestSellingAnswer(result, periodIn, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'sales_transactions',
        data: result,
        context: {
          activeTopic: 'sales',
          metric: 'product_best_selling',
          primaryPeriod: periodIn,
          lastMeaningfulEntity: { type: 'metric', value: result },
          lastIntent: 'product_best_selling',
          language: lang,
          lastMetric: 'sales',
          lastPeriod: periodIn,
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed product_best_selling');
      return response;
    }

    if (intent.type === 'incident_summary') {
      this.logger.log(`[KENBY_FLOW] Executing incident_summary tool`);
      const result = await this.kenbyErpRegistry.getIncidentsSummary(intent.statusFilter);
      const formattedAnswer = this.formatIncidentsSummaryAnswer(result, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'incidents',
        data: result,
        context: {
          activeTopic: 'plant_operations',
          metric: 'incident_summary',
          lastMeaningfulEntity: { type: 'metric', value: result },
          lastIntent: 'incident_summary',
          language: lang,
          lastMetric: 'plant_operations',
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed incident_summary');
      return response;
    }

    if (intent.type === 'goods_receipts') {
      this.logger.log(`[KENBY_FLOW] Executing goods_receipts tool`);
      const result = await this.kenbyErpRegistry.getGoodsReceiptsSummary();
      const formattedAnswer = this.formatGoodsReceiptsSummaryAnswer(result, lang);
      const audioUrl = await this.ttsService.generateNeuralSpeech(formattedAnswer[lang], lang);
      response = {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        audioUrl,
        source: 'goods_receipts',
        data: result,
        context: {
          activeTopic: 'procurement',
          metric: 'goods_receipts',
          lastMeaningfulEntity: { type: 'metric', value: result },
          lastIntent: 'goods_receipts',
          language: lang,
          lastMetric: 'procurement',
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed goods_receipts');
      return response;
    }

    if (intent.type === 'hybrid') {
      this.logger.log(`[KENBY_FLOW] Executing hybrid tool (live + rag)`);
      this.logger.log(`[KENBY_TRACE] source_selected=HYBRID`);

      // 1. Fetch live operational data
      let liveAnswer: LocalizedText = { ml: '', en: '' };
      let liveDataResult: any = null;

      if (intent.liveIntent === 'sales_summary') {
        const salesRes = await this.kenbyLiveDataService.getSalesSummary(intent.input);
        liveDataResult = salesRes;
        liveAnswer = this.formatSalesSummaryAnswer(salesRes, lang, intent.productFilter);
      } else if (intent.liveIntent === 'production_summary') {
        const prodRes = await this.kenbyLiveDataService.getProductionSummary(intent.input);
        liveDataResult = prodRes;
        liveAnswer = this.formatProductionSummaryAnswer(prodRes, lang, intent.productFilter);
      } else if (intent.liveIntent === 'stock_summary') {
        const stockRes = await this.kenbyLiveDataService.getCurrentStock(intent.productFilter);
        liveDataResult = stockRes;
        liveAnswer = this.formatCurrentStockAnswer(stockRes, lang);
      }

      // 2. Fetch RAG knowledge definition
      const ragDoc = await this.kenbyRagService.retrieveKnowledge(rawQ);
      const ragAnswer = ragDoc ? ragDoc.content : '';

      const combinedMl = `${liveAnswer.ml}\n\n📚 വിശദീകരണം:\n${ragAnswer || 'Sales dispatch എന്നത് കസ്റ്റമർമാർക്ക് ഉൽപ്പന്നങ്ങൾ അയച്ചു നൽകിയതിന്റെ റെക്കോർഡാണ്.'}`;
      const combinedEn = `${liveAnswer.en}\n\n📚 Concept Definition:\n${ragAnswer || 'Sales dispatch represents finished goods shipped to customers.'}`;

      const finalAnswer: LocalizedText = { ml: combinedMl, en: combinedEn };
      const audioUrl = await this.ttsService.generateNeuralSpeech(finalAnswer[lang], lang);

      response = {
        question: rawQ,
        answer: finalAnswer,
        language: lang,
        audioUrl,
        source: 'hybrid',
        data: { live: liveDataResult, knowledge: ragDoc },
        context: {
          activeTopic: intent.liveIntent === 'sales_summary' ? 'sales' : 'knowledge',
          metric: 'hybrid',
          lastMeaningfulEntity: { type: 'metric', value: liveDataResult },
          lastIntent: 'hybrid',
          language: lang,
          lastMetric: intent.liveIntent === 'sales_summary' ? 'sales' : 'knowledge',
        },
      };
      this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Executed hybrid');
      return response;
    }

    // UNKNOWN / GENERAL INTELLIGENT CLARIFICATION FALLBACK
    const defaultAnswer: LocalizedText = {
      ml: `ക്ഷമിക്കണം, ആ ചോദ്യത്തിന് ERP ഡേറ്റയിൽ നിന്ന് ഉത്തരം കണ്ടെത്താനായില്ല. കൂടുതൽ വ്യക്തമാക്കാമോ? ഉദാഹരണം: കസ്റ്റമർ വിവരങ്ങൾ, raw material stock, product stock, sales, production, vendor list, purchase orders.`,
      en: `I couldn't find information to answer that from the ERP business data I have access to. Could you be more specific? For example: customer details, raw material stock, product stock, sales, production, vendor list, or purchase orders.`,
    };
    const audioUrl = await this.ttsService.generateNeuralSpeech(defaultAnswer[lang], lang);

    response = {
      question: rawQ,
      answer: defaultAnswer,
      language: lang,
      audioUrl,
      context: {
        activeTopic: null,
        primaryPeriod: null,
        comparisonPeriod: null,
        metric: null,
        product: null,
        lastMeaningfulEntity: null,
        lastIntent: null,
        pendingAmbiguity: null,
        language: lang,
        lastMetric: null,
        lastPeriod: null,
        lastProduct: null,
      },
    };
    this.logDebugTrace(rawQ, lang, intent, conversationContext, response, 'Fallback unknown intent');
    return response;
  }

  private async askQuestionWithIntent(
    intent: KenbyIntent,
    rawQ: string,
    lang: 'ml' | 'en',
    conversationContext?: KenbyConversationContext
  ): Promise<AskQuestionResponse> {
    if (intent.type === 'sales_summary') {
      const liveData: SalesSummaryResult = await this.kenbyLiveDataService.getSalesSummary(intent.input);
      const formattedAnswer = this.formatSalesSummaryAnswer(liveData, lang, intent.productFilter);
      const normPeriod = this.normalizePeriodForContext(liveData.period);
      const prod = intent.productFilter || conversationContext?.product || conversationContext?.lastProduct || null;
      return {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        source: 'sales_transactions',
        data: liveData,
        context: {
          activeTopic: 'sales',
          primaryPeriod: normPeriod,
          comparisonPeriod: null,
          metric: 'sales',
          product: prod,
          lastMeaningfulEntity: { type: 'metric', value: liveData },
          lastIntent: 'sales_summary',
          pendingAmbiguity: null,
          language: lang,
          lastMetric: 'sales',
          lastPeriod: normPeriod,
          lastProduct: prod,
        },
      };
    }

    if (intent.type === 'production_summary') {
      const liveData: ProductionSummaryResult = await this.kenbyLiveDataService.getProductionSummary(intent.input);
      const formattedAnswer = this.formatProductionSummaryAnswer(liveData, lang, intent.productFilter);
      const normPeriod = this.normalizePeriodForContext(liveData.period);
      const prod = intent.productFilter || conversationContext?.product || conversationContext?.lastProduct || null;
      return {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        source: 'production_logs',
        data: liveData,
        context: {
          activeTopic: 'production',
          primaryPeriod: normPeriod,
          comparisonPeriod: null,
          metric: 'production',
          product: prod,
          lastMeaningfulEntity: { type: 'metric', value: liveData },
          lastIntent: 'production_summary',
          pendingAmbiguity: null,
          language: lang,
          lastMetric: 'production',
          lastPeriod: normPeriod,
          lastProduct: prod,
        },
      };
    }

    if (intent.type === 'stock_summary') {
      const liveData: CurrentStockResult = await this.kenbyLiveDataService.getCurrentStock(intent.productFilter);
      const formattedAnswer = this.formatCurrentStockAnswer(liveData, lang);
      const effectiveProd = intent.productFilter || conversationContext?.product || conversationContext?.lastProduct || null;
      return {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        source: 'production_stock',
        data: liveData,
        context: {
          activeTopic: 'stock',
          primaryPeriod: conversationContext?.primaryPeriod || conversationContext?.lastPeriod || { period: 'this_month' },
          comparisonPeriod: conversationContext?.comparisonPeriod || null,
          metric: 'stock',
          product: effectiveProd,
          lastMeaningfulEntity: { type: 'product', value: effectiveProd },
          lastIntent: 'stock_summary',
          pendingAmbiguity: null,
          language: lang,
          lastMetric: 'stock',
          lastPeriod: conversationContext?.primaryPeriod || conversationContext?.lastPeriod || { period: 'this_month' },
          lastProduct: effectiveProd,
        },
      };
    }

    if (intent.type === 'stock_breakdown') {
      const liveData: CurrentStockResult = await this.kenbyLiveDataService.getCurrentStock(intent.productFilter);
      const formattedAnswer = this.formatStockBreakdownAnswer(liveData, lang);
      const effectiveProd = intent.productFilter || conversationContext?.product || conversationContext?.lastProduct || null;
      return {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        source: 'production_stock',
        data: liveData,
        context: {
          activeTopic: 'stock',
          primaryPeriod: { period: 'this_month' },
          comparisonPeriod: null,
          metric: 'stock',
          product: effectiveProd,
          lastMeaningfulEntity: { type: 'product', value: effectiveProd },
          lastIntent: 'stock_breakdown',
          pendingAmbiguity: null,
          language: lang,
          lastMetric: 'stock',
          lastPeriod: { period: 'this_month' },
          lastProduct: effectiveProd,
        },
      };
    }

    if (intent.type === 'sales_return_summary') {
      const liveData: SalesSummaryResult = await this.kenbyLiveDataService.getSalesReturnSummary(intent.input);
      const formattedAnswer = this.formatReturnSummaryAnswer(liveData, lang, intent.productFilter);
      const normPeriod = this.normalizePeriodForContext(liveData.period);
      const prod = intent.productFilter || conversationContext?.product || conversationContext?.lastProduct || null;
      return {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        source: 'sales_transactions',
        data: liveData,
        context: {
          activeTopic: 'returns',
          primaryPeriod: normPeriod,
          comparisonPeriod: null,
          metric: 'returns',
          product: prod,
          lastMeaningfulEntity: { type: 'metric', value: liveData },
          lastIntent: 'sales_return_summary',
          pendingAmbiguity: null,
          language: lang,
          lastMetric: 'returns',
          lastPeriod: normPeriod,
          lastProduct: prod,
        },
      };
    }

    if (intent.type === 'damage_summary') {
      const liveData: SalesSummaryResult = await this.kenbyLiveDataService.getDamageSummary(intent.input);
      const formattedAnswer = this.formatDamageSummaryAnswer(liveData, lang, intent.productFilter);
      const normPeriod = this.normalizePeriodForContext(liveData.period);
      const prod = intent.productFilter || conversationContext?.product || conversationContext?.lastProduct || null;
      return {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        source: 'sales_transactions',
        data: liveData,
        context: {
          activeTopic: 'damage',
          primaryPeriod: normPeriod,
          comparisonPeriod: null,
          metric: 'damage',
          product: prod,
          lastMeaningfulEntity: { type: 'metric', value: liveData },
          lastIntent: 'damage_summary',
          pendingAmbiguity: null,
          language: lang,
          lastMetric: 'damage',
          lastPeriod: normPeriod,
          lastProduct: prod,
        },
      };
    }

    if (intent.type === 'customer_count') {
      const res = await this.kenbyErpRegistry.getCustomerCount();
      const formattedAnswer = this.formatCustomerCountAnswer(res, lang);
      return {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        source: 'customers',
        data: res,
        context: {
          activeTopic: 'customers',
          metric: 'customer_count',
          lastMeaningfulEntity: { type: 'metric', value: res },
          lastIntent: 'customer_count',
          language: lang,
          lastMetric: 'customers',
        },
      };
    }

    if (intent.type === 'customer_list') {
      const res = await this.kenbyErpRegistry.listCustomers(intent.statusFilter);
      const formattedAnswer = this.formatCustomerListAnswer(res, lang);
      return {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        source: 'customers',
        data: res,
        context: {
          activeTopic: 'customers',
          metric: 'customer_list',
          lastMeaningfulEntity: { type: 'metric', value: res },
          lastIntent: 'customer_list',
          language: lang,
          lastMetric: 'customers',
        },
      };
    }

    if (intent.type === 'customer_profile') {
      const profile = await this.kenbyErpRegistry.getCustomerProfile(intent.customerQuery);
      const formattedAnswer = this.formatCustomerProfileAnswer(profile, intent.customerQuery, lang);
      const custName = profile?.customer.name || intent.customerQuery;
      return {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        source: 'customers',
        data: profile,
        context: {
          activeTopic: 'customers',
          customer: custName,
          lastMeaningfulEntity: { type: 'customer', value: custName },
          lastIntent: 'customer_profile',
          language: lang,
          lastMetric: 'customers',
          lastCustomer: custName,
        },
      };
    }

    if (intent.type === 'customer_balance') {
      const q = intent.customerQuery || conversationContext?.customer || conversationContext?.lastCustomer;
      let profile: CustomerProfileResult | null = null;
      let ranking: any[] = [];
      if (q) {
        profile = await this.kenbyErpRegistry.getCustomerProfile(q);
      } else {
        ranking = await this.kenbyErpRegistry.getCustomerDebtRanking(5);
      }
      const formattedAnswer = this.formatCustomerBalanceAnswer(profile, ranking, q, lang);
      return {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        source: 'customers',
        data: profile || ranking,
        context: {
          activeTopic: 'customers',
          metric: 'customer_balance',
          customer: profile?.customer.name || null,
          lastMeaningfulEntity: { type: 'customer', value: profile?.customer.name || ranking },
          lastIntent: 'customer_balance',
          language: lang,
          lastMetric: 'customers',
          lastCustomer: profile?.customer.name || null,
        },
      };
    }

    if (intent.type === 'customer_ranking_debt') {
      const ranking = await this.kenbyErpRegistry.getCustomerDebtRanking(intent.limit || 5);
      const formattedAnswer = this.formatCustomerDebtRankingAnswer(ranking, lang);
      return {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        source: 'customers',
        data: ranking,
        context: {
          activeTopic: 'customers',
          metric: 'customer_ranking_debt',
          lastMeaningfulEntity: { type: 'metric', value: ranking },
          lastIntent: 'customer_ranking_debt',
          language: lang,
          lastMetric: 'customers',
        },
      };
    }

    if (intent.type === 'customer_ranking_sales') {
      const ranking = await this.kenbyErpRegistry.getTopCustomersBySales(intent.input, intent.limit || 5);
      const formattedAnswer = this.formatCustomerSalesRankingAnswer(ranking, intent.input, lang);
      return {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        source: 'sales_transactions',
        data: ranking,
        context: {
          activeTopic: 'customers',
          metric: 'customer_ranking_sales',
          lastMeaningfulEntity: { type: 'metric', value: ranking },
          lastIntent: 'customer_ranking_sales',
          language: lang,
          lastMetric: 'sales',
        },
      };
    }

    if (intent.type === 'raw_material_summary') {
      const stockRes = await this.kenbyErpRegistry.getRawMaterialsStock(intent.typeFilter);
      const formattedAnswer = this.formatRawMaterialSummaryAnswer(stockRes, lang);
      return {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        source: 'raw_materials',
        data: stockRes,
        context: {
          activeTopic: 'raw_materials',
          metric: 'raw_material_summary',
          lastMeaningfulEntity: { type: 'metric', value: stockRes },
          lastIntent: 'raw_material_summary',
          language: lang,
          lastMetric: 'raw_materials',
        },
      };
    }

    if (intent.type === 'raw_material_item') {
      const item = await this.kenbyErpRegistry.findRawMaterial(intent.materialQuery);
      const formattedAnswer = this.formatRawMaterialItemAnswer(item, intent.materialQuery, lang);
      return {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        source: 'raw_materials',
        data: item,
        context: {
          activeTopic: 'raw_materials',
          rawMaterial: item?.name || intent.materialQuery,
          lastMeaningfulEntity: { type: 'raw_material', value: item?.name || intent.materialQuery },
          lastIntent: 'raw_material_item',
          language: lang,
          lastMetric: 'raw_materials',
        },
      };
    }

    if (intent.type === 'raw_material_lowest') {
      const lowItems = await this.kenbyErpRegistry.getLowStockRawMaterials(0);
      const formattedAnswer = this.formatRawMaterialLowestAnswer(lowItems, lang);
      return {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        source: 'raw_materials',
        data: lowItems,
        context: {
          activeTopic: 'raw_materials',
          metric: 'raw_material_lowest',
          lastMeaningfulEntity: { type: 'metric', value: lowItems },
          lastIntent: 'raw_material_lowest',
          language: lang,
          lastMetric: 'raw_materials',
        },
      };
    }

    if (intent.type === 'raw_material_movements') {
      const prof = await this.kenbyErpRegistry.getRawMaterialProfile('PREFORM');
      const formattedAnswer = this.formatRawMaterialMovementsAnswer(prof, lang);
      return {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        source: 'raw_material_transactions',
        data: prof,
        context: {
          activeTopic: 'raw_materials',
          metric: 'raw_material_movements',
          lastMeaningfulEntity: { type: 'metric', value: prof },
          lastIntent: 'raw_material_movements',
          language: lang,
          lastMetric: 'raw_materials',
        },
      };
    }

    if (intent.type === 'product_profile') {
      const prodProf = await this.kenbyErpRegistry.getProductFullProfile(intent.productQuery);
      const formattedAnswer = this.formatProductFullProfileAnswer(prodProf, intent.productQuery, lang);
      const prodName = prodProf?.product.name || intent.productQuery;
      return {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        source: 'products',
        data: prodProf,
        context: {
          activeTopic: 'stock',
          product: prodName,
          lastMeaningfulEntity: { type: 'product', value: prodName },
          lastIntent: 'product_profile',
          language: lang,
          lastMetric: 'stock',
          lastProduct: prodName,
        },
      };
    }

    if (intent.type === 'vendor_list') {
      const vendorList = await this.kenbyErpRegistry.listVendors();
      const formattedAnswer = this.formatVendorListAnswer(vendorList, lang);
      return {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        source: 'vendors',
        data: vendorList,
        context: {
          activeTopic: 'procurement',
          metric: 'vendor_list',
          lastMeaningfulEntity: { type: 'metric', value: vendorList },
          lastIntent: 'vendor_list',
          language: lang,
          lastMetric: 'procurement',
        },
      };
    }

    if (intent.type === 'purchase_orders_summary') {
      const poSum = await this.kenbyErpRegistry.getPurchaseOrdersSummary();
      const formattedAnswer = this.formatPurchaseOrdersSummaryAnswer(poSum, lang);
      return {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        source: 'purchase_orders',
        data: poSum,
        context: {
          activeTopic: 'procurement',
          metric: 'purchase_orders_summary',
          lastMeaningfulEntity: { type: 'metric', value: poSum },
          lastIntent: 'purchase_orders_summary',
          language: lang,
          lastMetric: 'procurement',
        },
      };
    }

    if (intent.type === 'production_batches') {
      const batches = await this.kenbyErpRegistry.getBatchesSummary();
      const formattedAnswer = this.formatProductionBatchesAnswer(batches, lang);
      return {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        source: 'production_batches',
        data: batches,
        context: {
          activeTopic: 'production',
          metric: 'production_batches',
          lastMeaningfulEntity: { type: 'metric', value: batches },
          lastIntent: 'production_batches',
          language: lang,
          lastMetric: 'production',
        },
      };
    }

    if (intent.type === 'production_downtime') {
      const dt = await this.kenbyErpRegistry.getDowntimeSummary();
      const formattedAnswer = this.formatProductionDowntimeAnswer(dt, lang);
      return {
        question: rawQ,
        answer: formattedAnswer,
        language: lang,
        source: 'downtime_logs',
        data: dt,
        context: {
          activeTopic: 'production',
          metric: 'production_downtime',
          lastMeaningfulEntity: { type: 'metric', value: dt },
          lastIntent: 'production_downtime',
          language: lang,
          lastMetric: 'production',
        },
      };
    }

    // If intent type is unrecognized — return intelligent clarification instead of defaulting to sales
    const unrecognizedAnswer: LocalizedText = {
      ml: `ക്ഷമിക്കണം, ആ ചോദ്യം ശരിയായി മനസ്സിലായില്ല. കൂടുതൽ വ്യക്തമായി ചോദിക്കാമോ? ഉദാഹരണം: "20L Jar stock", "ABC Traders balance", "August sales", "preform stock".`,
      en: `I'm not sure I understood that question. Could you rephrase it? For example: "20L Jar stock", "ABC Traders balance", "August sales", "preform stock".`,
    };
    const fallbackAudioUrl = await this.ttsService.generateNeuralSpeech(unrecognizedAnswer[lang], lang);
    return {
      question: rawQ,
      answer: unrecognizedAnswer,
      language: lang,
      audioUrl: fallbackAudioUrl,
      context: {
        lastIntent: 'unknown',
        lastMetric: conversationContext?.lastMetric || null,
        lastPeriod: conversationContext?.lastPeriod || null,
        lastProduct: conversationContext?.lastProduct || null,
        language: lang,
      },
    };
  }

  private buildCorrectionAckMl(intent: any, targetAnswer: string): string {
    const text = (intent.originalCorrectionText || '').toLowerCase();
    if (text.includes('august') || text.includes('ഓഗസ്റ്റ്')) {
      return `ശരി — നിങ്ങൾ August sales ആണ് ഉദ്ദേശിച്ചത്. ${targetAnswer}`;
    }
    if (text.includes('july') || text.includes('ജൂലൈ')) {
      return `ശരി — നിങ്ങൾ July sales ആണ് ഉദ്ദേശിച്ചത്. ${targetAnswer}`;
    }
    if (text.includes('production') || text.includes('പ്രൊഡക്ഷൻ')) {
      return `ശരി, production ആണ് നിങ്ങൾ ചോദിച്ചത്. ${targetAnswer}`;
    }
    return `ശരി — ${targetAnswer}`;
  }

  private buildCorrectionAckEn(intent: any, targetAnswer: string): string {
    const text = (intent.originalCorrectionText || '').toLowerCase();
    if (text.includes('august')) {
      return `Right — you meant August. ${targetAnswer}`;
    }
    if (text.includes('july')) {
      return `Right — you meant July. ${targetAnswer}`;
    }
    if (text.includes('production')) {
      return `Right, you asked for production. ${targetAnswer}`;
    }
    return `Right — ${targetAnswer}`;
  }

  private logDebugTrace(
    rawMessage: string,
    lang: 'ml' | 'en',
    intent: KenbyIntent,
    previousContext?: KenbyConversationContext,
    response?: AskQuestionResponse,
    reason?: string
  ) {
    const trace = {
      rawMessage,
      detectedLanguage: lang,
      detectedIntent: intent.type,
      previousContext: previousContext || null,
      resolvedMetric: response?.context?.lastMetric || null,
      resolvedPeriod: response?.context?.lastPeriod || null,
      resolvedProduct: response?.context?.lastProduct || null,
      selectedTool: intent.type,
      finalAnswer: response?.answer?.[lang] || null,
    };
    this.logger.log(`[KENBY_DEBUG_TRACE] ${JSON.stringify(trace)}`);
  }

  private normalizePeriodForContext(p: any): SalesSummaryPeriodInput {
    if (!p) return { period: 'this_month' };
    return {
      period: p.period || p.type || 'this_month',
      year: p.year,
      month: p.month,
      date: p.date,
    };
  }

  // ── NATURAL LANGUAGE FORMATTERS FOR DETERMINISTIC SNAPSHOT, TOOLS & BREAKDOWNS ──

  private formatReturnBreakdownAnswer(data: ReturnBreakdownResult, lang: 'ml' | 'en'): LocalizedText {
    const periodLabelMl = this.getPeriodLabelMl(data.period);
    const periodLabelEn = this.getPeriodLabelEn(data.period);
    const totalQty = data.totalQuantity;

    if (data.products.length === 0 || totalQty === 0) {
      return {
        ml: `${periodLabelMl}-ൽ return രേഖപ്പെടുത്തിയിട്ടില്ല.`,
        en: `No returns were recorded for ${periodLabelEn}.`,
      };
    }

    if (data.products.length === 1) {
      const prod = data.products[0];
      return {
        ml: `${periodLabelMl}-ൽ return മുഴുവൻ ${prod.productName}-ൽ നിന്നാണ് — ${prod.quantity.toLocaleString('en-IN')} cases.`,
        en: `All returns in ${periodLabelEn} were for ${prod.productName} — ${prod.quantity.toLocaleString()} cases.`,
      };
    }

    const mlLines = [
      `${periodLabelMl}-ൽ ${totalQty.toLocaleString('en-IN')} cases returns ആയി രേഖപ്പെടുത്തിയിട്ടുണ്ട്.\n\nProduct-wise:`,
    ];
    const enLines = [
      `In ${periodLabelEn}, ${totalQty.toLocaleString()} cases were recorded as returns.\n\nProduct-wise:`,
    ];

    data.products.forEach((p) => {
      mlLines.push(`• ${p.productName} — ${p.quantity.toLocaleString('en-IN')} cases`);
      enLines.push(`• ${p.productName} — ${p.quantity.toLocaleString()} cases`);
    });

    return {
      ml: mlLines.join('\n'),
      en: enLines.join('\n'),
    };
  }

  private formatDamageBreakdownAnswer(data: DamageBreakdownResult, lang: 'ml' | 'en'): LocalizedText {
    const periodLabelMl = this.getPeriodLabelMl(data.period);
    const periodLabelEn = this.getPeriodLabelEn(data.period);
    const totalQty = data.totalQuantity;

    if (data.products.length === 0 || totalQty === 0) {
      return {
        ml: `${periodLabelMl}-ൽ damage രേഖപ്പെടുത്തിയിട്ടില്ല.`,
        en: `No damage was recorded for ${periodLabelEn}.`,
      };
    }

    if (data.products.length === 1) {
      const prod = data.products[0];
      return {
        ml: `${periodLabelMl}-ൽ damage മുഴുവൻ ${prod.productName}-ൽ നിന്നാണ് — ${prod.quantity.toLocaleString('en-IN')} cases.`,
        en: `All damage in ${periodLabelEn} was for ${prod.productName} — ${prod.quantity.toLocaleString()} cases.`,
      };
    }

    const mlLines = [
      `${periodLabelMl}-ൽ ${totalQty.toLocaleString('en-IN')} cases damage ആയി രേഖപ്പെടുത്തിയിട്ടുണ്ട്.\n\nProduct-wise:`,
    ];
    const enLines = [
      `In ${periodLabelEn}, ${totalQty.toLocaleString()} cases were recorded as damaged stock.\n\nProduct-wise:`,
    ];

    data.products.forEach((p) => {
      mlLines.push(`• ${p.productName} — ${p.quantity.toLocaleString('en-IN')} cases`);
      enLines.push(`• ${p.productName} — ${p.quantity.toLocaleString()} cases`);
    });

    return {
      ml: mlLines.join('\n'),
      en: enLines.join('\n'),
    };
  }

  private formatSalesBreakdownAnswer(data: SalesBreakdownResult, lang: 'ml' | 'en'): LocalizedText {
    const periodLabelMl = this.getPeriodLabelMl(data.period);
    const periodLabelEn = this.getPeriodLabelEn(data.period);
    const totalQty = data.totalQuantity;

    if (data.products.length === 0 || totalQty === 0) {
      return {
        ml: `${periodLabelMl}-ൽ sales dispatch രേഖപ്പെടുത്തിയിട്ടില്ല.`,
        en: `No sales dispatches were recorded for ${periodLabelEn}.`,
      };
    }

    if (data.products.length === 1) {
      const prod = data.products[0];
      return {
        ml: `${periodLabelMl}-ൽ sales dispatch മുഴുവൻ ${prod.productName}-ൽ നിന്നാണ് — ${prod.quantity.toLocaleString('en-IN')} cases.`,
        en: `All sales dispatches in ${periodLabelEn} were for ${prod.productName} — ${prod.quantity.toLocaleString()} cases.`,
      };
    }

    const mlLines = [
      `${periodLabelMl}-ൽ ${totalQty.toLocaleString('en-IN')} cases sales dispatch ചെയ്തിട്ടുണ്ട്.\n\nProduct-wise:`,
    ];
    const enLines = [
      `In ${periodLabelEn}, ${totalQty.toLocaleString()} cases were dispatched across sales.\n\nProduct-wise:`,
    ];

    data.products.forEach((p) => {
      mlLines.push(`• ${p.productName} — ${p.quantity.toLocaleString('en-IN')} cases`);
      enLines.push(`• ${p.productName} — ${p.quantity.toLocaleString()} cases`);
    });

    return {
      ml: mlLines.join('\n'),
      en: enLines.join('\n'),
    };
  }

  private formatProductionBreakdownAnswer(data: ProductionBreakdownResult, lang: 'ml' | 'en'): LocalizedText {
    const periodLabelMl = this.getPeriodLabelMl(data.period);
    const periodLabelEn = this.getPeriodLabelEn(data.period);
    const totalCases = data.totalCases;

    if (data.products.length === 0 || totalCases === 0) {
      return {
        ml: `${periodLabelMl}-ൽ production രേഖപ്പെടുത്തിയിട്ടില്ല.`,
        en: `No production output was recorded for ${periodLabelEn}.`,
      };
    }

    if (data.products.length === 1) {
      const prod = data.products[0];
      return {
        ml: `${periodLabelMl}-ൽ production മുഴുവൻ ${prod.productName}-ൽ നിന്നാണ് — ${prod.quantity.toLocaleString('en-IN')} cases.`,
        en: `All production in ${periodLabelEn} was for ${prod.productName} — ${prod.quantity.toLocaleString()} cases.`,
      };
    }

    const mlLines = [
      `${periodLabelMl}-ൽ ആകെ ${totalCases.toLocaleString('en-IN')} cases ഉൽപ്പാദനം നടത്തിയിട്ടുണ്ട്.\n\nProduct-wise:`,
    ];
    const enLines = [
      `In ${periodLabelEn}, total ${totalCases.toLocaleString()} cases of output were produced.\n\nProduct-wise:`,
    ];

    data.products.forEach((p) => {
      mlLines.push(`• ${p.productName} — ${p.quantity.toLocaleString('en-IN')} cases`);
      enLines.push(`• ${p.productName} — ${p.quantity.toLocaleString()} cases`);
    });

    return {
      ml: mlLines.join('\n'),
      en: enLines.join('\n'),
    };
  }

  private getPeriodLabelMl(period: any): string {
    if (period.type === 'specific_month' && period.year && period.month) {
      return `${period.year} ${this.getMonthNameMl(period.month)}`;
    }
    if (period.type === 'specific_date' && period.date) {
      return this.formatMalayalamDate(period.date);
    }
    return 'ഈ മാസം';
  }

  private getPeriodLabelEn(period: any): string {
    if (period.type === 'specific_month' && period.year && period.month) {
      return `${this.getMonthNameEn(period.month)} ${period.year}`;
    }
    if (period.type === 'specific_date' && period.date) {
      return this.formatEnglishDate(period.date);
    }
    return 'this month';
  }

  private formatBusinessSnapshotAnswer(snapshot: BusinessSnapshotResult, lang: 'ml' | 'en'): LocalizedText {
    const s = snapshot;
    const periodLabelMl = s.comparison ? s.comparison.currentPeriod.label : `${s.period.startDate} to ${s.period.endDate}`;
    const periodLabelEn = s.comparison ? s.comparison.currentPeriod.label : `${s.period.startDate} to ${s.period.endDate}`;

    const partsMl: string[] = [
      `📊 ${periodLabelMl} ബിസിനസ്സ് നില:`,
      `• Sales: ${s.sales.quantity.toLocaleString('en-IN')} cases`,
      `• Production: ${s.production.casesProduced.toLocaleString('en-IN')} cases`,
      `• Stock: ${s.stock.totalCurrentStock.toLocaleString('en-IN')} cases`,
      `• Returns: ${s.returns.quantity.toLocaleString('en-IN')} cases`,
      `• Damage: ${s.damage.quantity.toLocaleString('en-IN')} cases`,
    ];

    const partsEn: string[] = [
      `📊 ${periodLabelEn} Business Status:`,
      `• Sales: ${s.sales.quantity.toLocaleString()} cases`,
      `• Production: ${s.production.casesProduced.toLocaleString()} cases`,
      `• Stock: ${s.stock.totalCurrentStock.toLocaleString()} cases`,
      `• Returns: ${s.returns.quantity.toLocaleString()} cases`,
      `• Damage: ${s.damage.quantity.toLocaleString()} cases`,
    ];

    if (s.insights && s.insights.length > 0) {
      partsMl.push('\n🧠 Kenby പറയുന്നു:');
      partsEn.push('\n🧠 Kenby Insights:');

      s.insights.forEach((ins, idx) => {
        const insText = ins.message?.[lang] || ins.text[lang] || ins.text.ml;
        partsMl.push(`${idx + 1}. ${insText}`);
        partsEn.push(`${idx + 1}. ${insText}`);
      });
    }

    return {
      ml: partsMl.join('\n'),
      en: partsEn.join('\n'),
    };
  }

  private formatSalesSummaryAnswer(liveData: SalesSummaryResult, lang: 'ml' | 'en', productFilter?: string): LocalizedText {
    const qty = liveData.totalQuantity;
    const count = liveData.transactionCount;
    const formattedQty = qty.toLocaleString('en-IN');
    const periodType = liveData.period.type;
    const prodPrefix = productFilter ? `${productFilter} — ` : '';

    if (periodType === 'specific_date' && liveData.period.date) {
      const mlDate = this.formatMalayalamDate(liveData.period.date);
      const enDate = this.formatEnglishDate(liveData.period.date);

      if (qty === 0) {
        return {
          ml: `${prodPrefix}${mlDate}-ന് sales dispatch ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല.`,
          en: `${prodPrefix}No sales dispatch was recorded on ${enDate}.`,
        };
      }
      return {
        ml: `${prodPrefix}${mlDate}-ന് ആകെ ${formattedQty} യൂണിറ്റ് sales dispatch ചെയ്തിട്ടുണ്ട്.`,
        en: `${prodPrefix}On ${enDate}, total ${formattedQty} units were dispatched across ${count} sales transactions.`,
      };
    }

    if (periodType === 'specific_month' && liveData.period.year && liveData.period.month) {
      const mlMonth = `${liveData.period.year} ${this.getMonthNameMl(liveData.period.month)}`;
      const enMonth = `${this.getMonthNameEn(liveData.period.month)} ${liveData.period.year}`;

      if (qty === 0) {
        return {
          ml: `${prodPrefix}${mlMonth} മാസത്തിൽ sales dispatch ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല.`,
          en: `${prodPrefix}No sales dispatches were recorded in ${enMonth}.`,
        };
      }
      return {
        ml: `${prodPrefix}${mlMonth} മാസത്തിൽ ആകെ ${formattedQty} യൂണിറ്റ് sales dispatch ചെയ്തിട്ടുണ്ട്.`,
        en: `${prodPrefix}In ${enMonth}, total ${formattedQty} units were dispatched across ${count} sales transactions.`,
      };
    }

    if (qty === 0) {
      return {
        ml: `${prodPrefix}ഈ സമയപരിധിയിൽ sales dispatch ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല.`,
        en: `${prodPrefix}No sales dispatches were recorded for this period.`,
      };
    }

    return {
      ml: `${prodPrefix}ഈ മാസം ഇതുവരെ ${formattedQty} യൂണിറ്റ് sales dispatch ചെയ്തിട്ടുണ്ട്.`,
      en: `${prodPrefix}In this month so far, total ${formattedQty} units were dispatched across ${count} sales transactions.`,
    };
  }

  private formatProductionSummaryAnswer(liveData: ProductionSummaryResult, lang: 'ml' | 'en', productFilter?: string): LocalizedText {
    const cases = liveData.totalCasesProduced;
    const count = liveData.logCount;
    const formattedCases = cases.toLocaleString('en-IN');
    const periodType = liveData.period.type;
    const prodPrefix = productFilter ? `${productFilter} — ` : '';

    if (periodType === 'specific_date' && liveData.period.date) {
      const mlDate = this.formatMalayalamDate(liveData.period.date);
      const enDate = this.formatEnglishDate(liveData.period.date);

      if (cases === 0) {
        return {
          ml: `${prodPrefix}${mlDate}-ന് production ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല.`,
          en: `${prodPrefix}No production was recorded on ${enDate}.`,
        };
      }
      return {
        ml: `${prodPrefix}${mlDate}-ന് ആകെ ${formattedCases} കേസുകൾ finished output ആയി ഉൽപ്പാദിച്ചിട്ടുണ്ട്.`,
        en: `${prodPrefix}On ${enDate}, total ${formattedCases} cases of finished output were produced (${count} packing logs).`,
      };
    }

    if (periodType === 'specific_month' && liveData.period.year && liveData.period.month) {
      const mlMonth = `${liveData.period.year} ${this.getMonthNameMl(liveData.period.month)}`;
      const enMonth = `${this.getMonthNameEn(liveData.period.month)} ${liveData.period.year}`;

      if (cases === 0) {
        return {
          ml: `${prodPrefix}${mlMonth} മാസത്തിൽ production ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല.`,
          en: `${prodPrefix}No production output was recorded in ${enMonth}.`,
        };
      }
      return {
        ml: `${prodPrefix}${mlMonth} മാസത്തിൽ ആകെ ${formattedCases} കേസുകൾ finished output ആയി ഉൽപ്പാദിച്ചിട്ടുണ്ട്.`,
        en: `${prodPrefix}In ${enMonth}, total ${formattedCases} cases of finished output were produced.`,
      };
    }

    if (cases === 0) {
      return {
        ml: `${prodPrefix}ഈ സമയപരിധിയിൽ production ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല.`,
        en: `${prodPrefix}No production output was recorded for this period.`,
      };
    }

    return {
      ml: `${prodPrefix}ഈ മാസം ഇതുവരെ ആകെ ${formattedCases} കേസുകൾ finished output ആയി ഉൽപ്പാദിച്ചിട്ടുണ്ട്.`,
      en: `${prodPrefix}In this month so far, total ${formattedCases} cases of finished output were produced.`,
    };
  }

  private formatCurrentStockAnswer(liveData: CurrentStockResult, lang: 'ml' | 'en'): LocalizedText {
    const total = liveData.totalCurrentStock;
    const formattedTotal = total.toLocaleString('en-IN');

    if (liveData.productFilter && liveData.products.length > 0) {
      const prod = liveData.products[0];
      const prodStock = prod.currentStock.toLocaleString('en-IN');
      const unitLabelMl = prod.unit === 'jars' ? 'ജാർ' : 'കേസുകൾ';
      const unitLabelEn = prod.unit === 'jars' ? 'jars' : 'cases';
      return {
        ml: `${prod.productName} — നിലവിൽ ${prodStock} ${unitLabelMl} stock-ൽ ലഭ്യമാണ്.`,
        en: `${prod.productName} — currently ${prodStock} ${unitLabelEn} available in stock.`,
      };
    }

    if (liveData.products.length === 0 || total === 0) {
      return {
        ml: `നിലവിൽ stock ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല.`,
        en: `No current stock is available.`,
      };
    }

    if (liveData.unitGroups && liveData.unitGroups.length > 1) {
      const partsMl = ['നിലവിലെ stock നില:'];
      const partsEn = ['Current stock status:'];

      liveData.unitGroups.forEach((g) => {
        const uLabelMl = g.unit === 'jars' ? 'ജാർ' : 'കേസുകൾ';
        const uLabelEn = g.unit === 'jars' ? 'jars' : 'cases';
        partsMl.push(`• ${g.unit.toUpperCase()} — ${g.total.toLocaleString('en-IN')} ${uLabelMl}`);
        partsEn.push(`• ${g.unit.toUpperCase()} — ${g.total.toLocaleString('en-IN')} ${uLabelEn}`);
      });

      return {
        ml: partsMl.join('\n'),
        en: partsEn.join('\n'),
      };
    }

    return {
      ml: `നിലവിൽ ആകെ ${formattedTotal} കേസുകൾ finished goods stock ആയി ലഭ്യമാണ്.`,
      en: `Currently a total of ${formattedTotal} cases are available in finished goods stock.`,
    };
  }

  private formatStockBreakdownAnswer(liveData: CurrentStockResult, lang: 'ml' | 'en'): LocalizedText {
    if (!liveData.products || liveData.products.length === 0) {
      return {
        ml: `നിലവിൽ stock വിവരങ്ങൾ ലഭ്യമല്ല.`,
        en: `No current stock records found.`,
      };
    }

    const partsMl: string[] = ['നിലവിലെ product-wise stock:'];
    const partsEn: string[] = ['Current product-wise stock:'];

    liveData.products.forEach((p) => {
      const uLabelMl = p.unit === 'jars' ? 'ജാർ' : 'കേസുകൾ';
      const uLabelEn = p.unit === 'jars' ? 'jars' : 'cases';
      partsMl.push(`• ${p.productName} — ${p.currentStock.toLocaleString('en-IN')} ${uLabelMl}`);
      partsEn.push(`• ${p.productName} — ${p.currentStock.toLocaleString('en-IN')} ${uLabelEn}`);
    });

    return {
      ml: partsMl.join('\n'),
      en: partsEn.join('\n'),
    };
  }

  private formatReturnSummaryAnswer(liveData: SalesSummaryResult, lang: 'ml' | 'en', productFilter?: string): LocalizedText {
    const qty = liveData.totalQuantity;
    const formattedQty = qty.toLocaleString('en-IN');
    const periodType = liveData.period.type;
    const prodPrefix = productFilter ? `${productFilter} — ` : '';

    if (periodType === 'specific_month' && liveData.period.year && liveData.period.month) {
      const mlMonth = `${liveData.period.year} ${this.getMonthNameMl(liveData.period.month)}`;
      const enMonth = `${this.getMonthNameEn(liveData.period.month)} ${liveData.period.year}`;

      if (qty === 0) {
        return {
          ml: `${prodPrefix}${mlMonth} മാസത്തിൽ sales return ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല.`,
          en: `${prodPrefix}No sales returns were recorded in ${enMonth}.`,
        };
      }
      return {
        ml: `${prodPrefix}${mlMonth} മാസത്തിൽ ആകെ ${formattedQty} കേസുകൾ sales return രേഖപ്പെടുത്തിയിട്ടുണ്ട്.`,
        en: `${prodPrefix}In ${enMonth}, total ${formattedQty} cases of sales returns were recorded.`,
      };
    }

    if (qty === 0) {
      return {
        ml: `${prodPrefix}ഈ മാസം sales return ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല.`,
        en: `${prodPrefix}No sales returns were recorded for this period.`,
      };
    }

    return {
      ml: `${prodPrefix}ഈ മാസം ഇതുവരെ ${formattedQty} കേസുകൾ sales return രേഖപ്പെടുത്തിയിട്ടുണ്ട്.`,
      en: `${prodPrefix}In this month so far, total ${formattedQty} cases of sales returns were recorded.`,
    };
  }

  private formatDamageSummaryAnswer(liveData: SalesSummaryResult, lang: 'ml' | 'en', productFilter?: string): LocalizedText {
    const qty = liveData.totalQuantity;
    const formattedQty = qty.toLocaleString('en-IN');
    const periodType = liveData.period.type;
    const prodPrefix = productFilter ? `${productFilter} — ` : '';

    if (periodType === 'specific_month' && liveData.period.year && liveData.period.month) {
      const mlMonth = `${liveData.period.year} ${this.getMonthNameMl(liveData.period.month)}`;
      const enMonth = `${this.getMonthNameEn(liveData.period.month)} ${liveData.period.year}`;

      if (qty === 0) {
        return {
          ml: `${prodPrefix}${mlMonth} മാസത്തിൽ damage ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല.`,
          en: `${prodPrefix}No damage was recorded in ${enMonth}.`,
        };
      }
      return {
        ml: `${prodPrefix}${mlMonth} മാസത്തിൽ ആകെ ${formattedQty} കേസുകൾ damage രേഖപ്പെടുത്തിയിട്ടുണ്ട്.`,
        en: `${prodPrefix}In ${enMonth}, total ${formattedQty} cases of damage were recorded.`,
      };
    }

    if (qty === 0) {
      return {
        ml: `${prodPrefix}ഈ മാസം damage ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല.`,
        en: `${prodPrefix}No damage was recorded for this period.`,
      };
    }

    return {
      ml: `${prodPrefix}ഈ മാസം ഇതുവരെ ${formattedQty} കേസുകൾ damage രേഖപ്പെടുത്തിയിട്ടുണ്ട്.`,
      en: `${prodPrefix}In this month so far, total ${formattedQty} cases of damage were recorded.`,
    };
  }

  // ── LOCALIZED DATE & TEXT FORMATTING UTILITIES ──

  private formatMalayalamDate(dateStr: string): string {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parts[0];
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    const monthNamesMl = ['ജനുവരി', 'ഫെബ്രുവരി', 'മാർച്ച്', 'ഏപ്രിൽ', 'മേയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗസ്റ്റ്', 'സെപ്റ്റംബർ', 'ഒക്ടോബർ', 'നവംബർ', 'ഡിസംബർ'];
    const mName = monthNamesMl[month - 1] || '';

    return `${year} ${mName} ${day}`;
  }

  private formatEnglishDate(dateStr: string): string {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parts[0];
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const mName = monthNamesEn[month - 1] || '';

    return `${mName} ${day}, ${year}`;
  }

  private cleanText(str: string): string {
    if (!str) return '';
    return str
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/###/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ── AUTHORITATIVE DATA FETCH HELPERS ──

  private async fetchMonthlySalesMetrics(year: number, month: number, dateStr?: string) {
    let dateFilter = sql`extract(year from sales_date) = ${year} and extract(month from sales_date) = ${month}`;
    if (dateStr) {
      dateFilter = sql`sales_date = ${dateStr}`;
    }

    const res = await db.execute(sql`
      SELECT
        coalesce(sum(case when type = 'SALES_DISPATCH' then quantity else 0 end), 0)::int as sales_cases,
        coalesce(sum(case when type = 'RETURN' then quantity else 0 end), 0)::int as return_cases,
        coalesce(sum(case when type = 'DAMAGE' then quantity else 0 end), 0)::int as damage_cases,
        count(case when type = 'SALES_DISPATCH' then 1 else null end)::int as sales_tx_count
      FROM sales_transactions
      WHERE ${dateFilter}
    `);

    return {
      salesCases: Number(res[0]?.sales_cases || 0),
      returnCases: Number(res[0]?.return_cases || 0),
      damageCases: Number(res[0]?.damage_cases || 0),
      salesTxCount: Number(res[0]?.sales_tx_count || 0),
    };
  }

  private async fetchMonthlyProductionMetrics(year: number, month: number, dateStr?: string) {
    let logFilter = sql`extract(year from pl.logged_at) = ${year} and extract(month from pl.logged_at) = ${month}`;
    let batchFilter = sql`extract(year from pb.created_at) = ${year} and extract(month from pb.created_at) = ${month}`;

    if (dateStr) {
      logFilter = sql`date(pl.logged_at) = ${dateStr}`;
      batchFilter = sql`date(pb.created_at) = ${dateStr}`;
    }

    const logRes = await db.execute(sql`
      SELECT coalesce(sum(coalesce(pl.cases_produced, pl.primary_count, 0)), 0)::int as prod_cases
      FROM production_logs pl
      JOIN production_batches pb ON pb.id = pl.batch_id AND pb.deleted_at IS NULL
      WHERE pl.deleted_at IS NULL AND pl.station = 'PACKING' AND ${logFilter}
    `);

    const batchRes = await db.execute(sql`
      SELECT count(*)::int as batch_count
      FROM production_batches pb
      WHERE pb.deleted_at IS NULL AND ${batchFilter}
    `);

    return {
      productionCases: Number(logRes[0]?.prod_cases || 0),
      batchesCount: Number(batchRes[0]?.batch_count || 0),
    };
  }

  private async fetchFinishedStockMetrics() {
    const productsRes = await db.execute(sql`
      SELECT
        p.id,
        p.name,
        coalesce(ps.current_stock, 0)::numeric as current_stock,
        coalesce(ps.total_produced, 0)::numeric as total_produced,
        coalesce(ps.total_dispatched, 0)::numeric as total_dispatched
      FROM products p
      LEFT JOIN production_stock ps ON ps.product_id = p.id
    `);

    const productList = productsRes as any[];
    const totalProductsCount = productList.length;

    let totalAvailableStock = 0;
    const lowStockItemNames: string[] = [];

    productList.forEach((prod) => {
      const avail = Number(prod.current_stock || 0);
      totalAvailableStock += avail;
      if (avail <= 10) {
        lowStockItemNames.push(String(prod.name));
      }
    });

    const sampleProductName = productList.length > 0 ? String(productList[0].name) : undefined;

    return {
      totalProductsCount,
      totalAvailableStock,
      lowStockCount: lowStockItemNames.length,
      lowStockItemNames,
      sampleProductName,
    };
  }

  // ── PRIVATE SUMMARY BUILDERS ──

  private buildMonthlySummary(sales: any, prod: any, stock: any, monthMl: string, monthEn: string, dateStr?: string): LocalizedText {
    const periodMl = dateStr ? `${this.formatMalayalamDate(dateStr)}-ന്` : `${monthMl} മാസത്തിൽ ഇതുവരെ`;
    const periodEn = dateStr ? `On ${this.formatEnglishDate(dateStr)}` : `In ${monthEn} so far`;

    const partsMl: string[] = [];
    const partsEn: string[] = [];

    if (sales.salesCases > 0) {
      partsMl.push(`${periodMl} ${sales.salesCases.toLocaleString('en-IN')} കേസുകൾ sales dispatch ചെയ്തു.`);
      partsEn.push(`${periodEn}, ${sales.salesCases.toLocaleString()} cases were dispatched.`);
    } else {
      partsMl.push(`${periodMl} sales dispatch ഒന്നും ഉണ്ടായിട്ടില്ല.`);
      partsEn.push(`${periodEn}, no sales dispatches were logged.`);
    }

    if (sales.returnCases > 0) {
      partsMl.push(`${sales.returnCases.toLocaleString('en-IN')} കേസുകൾ sales return രേഖപ്പെടുത്തിയിട്ടുണ്ട്.`);
      partsEn.push(`${sales.returnCases.toLocaleString()} cases of sales returns were recorded.`);
    }

    if (prod.productionCases > 0) {
      partsMl.push(`Production-ൽ ${prod.productionCases.toLocaleString('en-IN')} കേസുകൾ finished output ഉൽപ്പാദിച്ചു (${prod.batchesCount} batch).`);
      partsEn.push(`Production output reached ${prod.productionCases.toLocaleString()} cases across ${prod.batchesCount} batch.`);
    } else {
      partsMl.push('Production activity തുടരുകയാണ്.');
      partsEn.push('Production activity is ongoing.');
    }

    if (stock.totalProductsCount > 0) {
      const pName = stock.sampleProductName || 'product';
      if (stock.lowStockCount > 0) {
        partsMl.push(`Stock-ൽ ${stock.lowStockItemNames[0]} ഉൾപ്പെടെ ${stock.lowStockCount} items ശ്രദ്ധിക്കേണ്ടതുണ്ട്.`);
        partsEn.push(`${stock.lowStockCount} stock items including ${stock.lowStockItemNames[0]} require attention.`);
      } else {
        partsMl.push(`Stock-ൽ ${stock.totalProductsCount} product (${pName}) (ആകെ ${stock.totalAvailableStock.toLocaleString('en-IN')} കേസുകൾ) ലഭ്യമാണ്.`);
        partsEn.push(`Stock holds ${stock.totalProductsCount} product (${pName}) with ${stock.totalAvailableStock.toLocaleString()} cases available.`);
      }
    } else {
      partsMl.push('Stock-ൽ വിവരങ്ങളൊന്നും ലഭ്യമല്ല.');
      partsEn.push('No stock records available.');
    }

    return {
      ml: partsMl.join(' '),
      en: partsEn.join(' '),
    };
  }

  private buildMonthlyInsights(sales: any, prod: any, stock: any): BusinessInsight[] {
    const insights: BusinessInsight[] = [];

    insights.push({
      id: 'sales_card',
      type: 'SALES',
      icon: '📈',
      title: { ml: 'Sales', en: 'Sales' },
      highlight: {
        ml: `${sales.salesCases.toLocaleString('en-IN')} cases`,
        en: `${sales.salesCases.toLocaleString()} cases`,
      },
      actionText: { ml: `${sales.salesTxCount} transactions`, en: `${sales.salesTxCount} transactions` },
      buttonText: { ml: 'കാണുക', en: 'View' },
      link: '/admin/sales',
    });

    insights.push({
      id: 'prod_card',
      type: 'PRODUCTION',
      icon: '🏭',
      title: { ml: 'Production', en: 'Production' },
      highlight: {
        ml: `${prod.productionCases.toLocaleString('en-IN')} cases`,
        en: `${prod.productionCases.toLocaleString()} cases`,
      },
      actionText: { ml: `${prod.batchesCount} batch`, en: `${prod.batchesCount} batch` },
      buttonText: { ml: 'കാണുക', en: 'View' },
      link: '/admin/overview',
    });

    insights.push({
      id: 'returns_card',
      type: 'RETURNS',
      icon: '↩',
      title: { ml: 'Returns', en: 'Returns' },
      highlight: {
        ml: `${sales.returnCases.toLocaleString('en-IN')} cases`,
        en: `${sales.returnCases.toLocaleString()} cases`,
      },
      actionText: { ml: 'Sales returns summary', en: 'Sales returns summary' },
      buttonText: { ml: 'കാണുക', en: 'View' },
      link: '/admin/sales',
    });

    insights.push({
      id: 'damage_card',
      type: 'DAMAGE',
      icon: '⚠',
      title: { ml: 'Damage', en: 'Damage' },
      highlight: {
        ml: `${sales.damageCases.toLocaleString('en-IN')} cases`,
        en: `${sales.damageCases.toLocaleString()} cases`,
      },
      actionText: { ml: 'Damaged stock summary', en: 'Damaged stock summary' },
      buttonText: { ml: 'കാണുക', en: 'View' },
      link: '/admin/sales',
    });

    insights.push({
      id: 'stock_card',
      type: 'STOCK',
      icon: '📦',
      title: { ml: 'Stock', en: 'Stock' },
      highlight: {
        ml: stock.lowStockCount > 0
          ? `${stock.lowStockCount} products need attention`
          : `${stock.totalProductsCount} product in stock`,
        en: stock.lowStockCount > 0
          ? `${stock.lowStockCount} products need attention`
          : `${stock.totalProductsCount} product in stock`,
      },
      actionText: { ml: `Available ${stock.totalAvailableStock.toLocaleString('en-IN')} cases`, en: `Available ${stock.totalAvailableStock.toLocaleString()} cases` },
      buttonText: { ml: 'കാണുക', en: 'View' },
      link: '/admin/products',
    });

    return insights;
  }

  private buildMonthlyActions(sales: any, prod: any, stock: any): Array<{ id: string; text: LocalizedText; priority: number; link?: string }> {
    const actions = [];
    let priority = 1;

    if (stock.lowStockCount > 0) {
      const sampleItem = stock.lowStockItemNames[0] || 'item';
      actions.push({
        id: `act_${priority}`,
        text: {
          ml: `① Stock കുറവുള്ള ${sampleItem} പരിശോധിക്കുക`,
          en: `① Inspect low stock of ${sampleItem}`,
        },
        priority: priority++,
        link: '/admin/products',
      });
    }

    if (sales.returnCases > 0) {
      actions.push({
        id: `act_${priority}`,
        text: {
          ml: `② ${sales.returnCases.toLocaleString('en-IN')} കേസുകൾ sales return രേഖകൾ പരിശോധിക്കുക`,
          en: `② Review ${sales.returnCases.toLocaleString()} cases of sales returns`,
        },
        priority: priority++,
        link: '/admin/sales',
      });
    }

    actions.push({
      id: `act_${priority}`,
      text: {
        ml: `③ ഇന്നത്തെ sales & production നിരീക്ഷിക്കുക`,
        en: `③ Monitor today’s sales & production performance`,
      },
      priority: priority++,
      link: '/admin/sales',
    });

    return actions.slice(0, 3);
  }

  private formatCustomerCountAnswer(res: { total: number; active: number }, lang: 'ml' | 'en'): LocalizedText {
    return {
      ml: `ERP സിസ്റ്റത്തിൽ ആകെ ${res.total} കസ്റ്റമേഴ്സ് രജിസ്റ്റർ ചെയ്തിട്ടുണ്ട് (${res.active} പേർ ആക്ടീവ് ആണ്).`,
      en: `There are currently ${res.total} customers registered in the ERP (${res.active} active).`,
    };
  }

  private formatCustomerListAnswer(
    res: Array<{ name: string; code: string | null; phone: string | null; status: string; openingBalance: number }>,
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (!res || res.length === 0) {
      return {
        ml: `നിലവിൽ കസ്റ്റമർ വിവരങ്ങൾ ലഭ്യമല്ല.`,
        en: `No customer records found.`,
      };
    }

    const linesMl = [`📋 കസ്റ്റമർ ലിസ്റ്റ് (ആകെ ${res.length} പേർ):`];
    const linesEn = [`📋 Customer Directory (Total ${res.length}):`];

    res.forEach((c, idx) => {
      const codeStr = c.code ? ` (${c.code})` : '';
      const phoneStr = c.phone ? ` — ഫോൺ: ${c.phone}` : '';
      const phoneStrEn = c.phone ? ` — Phone: ${c.phone}` : '';
      linesMl.push(`• ${idx + 1}. ${c.name}${codeStr}${phoneStr}`);
      linesEn.push(`• ${idx + 1}. ${c.name}${codeStr}${phoneStrEn}`);
    });

    return {
      ml: linesMl.join('\n'),
      en: linesEn.join('\n'),
    };
  }

  private formatCustomerProfileAnswer(
    prof: CustomerProfileResult | null,
    query: string,
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (!prof) {
      return {
        ml: `"${query}" എന്ന പേരിൽ കസ്റ്റമർ വിവരങ്ങൾ ERP-യിൽ കണ്ടെത്താനായില്ല.`,
        en: `No customer records found matching "${query}".`,
      };
    }

    const c = prof.customer;
    const f = prof.financials;

    const linesMl = [
      `👤 ${c.name} (${c.code || 'Code N/A'})`,
      `• Status: ${c.status} | Type: ${c.customerType}`,
      `• Phone: ${c.phone || 'N/A'} | Address: ${c.address || 'N/A'}`,
      ``,
      `💰 സാമ്പത്തിക വിവരങ്ങൾ:`,
      `• Opening Balance: ₹${f.openingBalance.toLocaleString('en-IN')}`,
      `• Total Dispatched: ${f.totalSalesDispatchedCases.toLocaleString('en-IN')} cases (₹${f.totalSalesDispatchedValue.toLocaleString('en-IN')})`,
      `• Returns: ${f.totalReturnsCases.toLocaleString('en-IN')} cases`,
      `• Estimated Outstanding: ₹${f.estimatedOutstanding.toLocaleString('en-IN')}`,
    ];

    const linesEn = [
      `👤 ${c.name} (${c.code || 'Code N/A'})`,
      `• Status: ${c.status} | Type: ${c.customerType}`,
      `• Phone: ${c.phone || 'N/A'} | Address: ${c.address || 'N/A'}`,
      ``,
      `💰 Financial Profile:`,
      `• Opening Balance: ₹${f.openingBalance.toLocaleString()}`,
      `• Total Dispatched: ${f.totalSalesDispatchedCases.toLocaleString()} cases (₹${f.totalSalesDispatchedValue.toLocaleString()})`,
      `• Returns: ${f.totalReturnsCases.toLocaleString()} cases`,
      `• Estimated Outstanding: ₹${f.estimatedOutstanding.toLocaleString()}`,
    ];

    if (prof.purchasedProducts.length > 0) {
      linesMl.push(``, `📦 വാങ്ങിയ പ്രോഡക്റ്റുകൾ:`);
      linesEn.push(``, `📦 Purchased Products:`);
      prof.purchasedProducts.slice(0, 3).forEach((p) => {
        linesMl.push(`• ${p.productName}: ${p.quantityCases.toLocaleString('en-IN')} cases`);
        linesEn.push(`• ${p.productName}: ${p.quantityCases.toLocaleString()} cases`);
      });
    }

    if (prof.recentTransactions.length > 0) {
      linesMl.push(``, `🕒 അവസാന ട്രാൻസാക്ഷനുകൾ:`);
      linesEn.push(``, `🕒 Recent Transactions:`);
      prof.recentTransactions.slice(0, 3).forEach((t) => {
        linesMl.push(`• ${t.salesDate} — ${t.type}: ${t.quantity} cases (${t.productName})`);
        linesEn.push(`• ${t.salesDate} — ${t.type}: ${t.quantity} cases (${t.productName})`);
      });
    }

    return {
      ml: linesMl.join('\n'),
      en: linesEn.join('\n'),
    };
  }

  private formatCustomerBalanceAnswer(
    prof: CustomerProfileResult | null,
    ranking: any[],
    query: string | undefined,
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (prof) {
      const c = prof.customer;
      const f = prof.financials;
      return {
        ml: `${c.name}-ന്റെ opening balance ₹${f.openingBalance.toLocaleString('en-IN')}-ഉം estimated outstanding ₹${f.estimatedOutstanding.toLocaleString('en-IN')}-ഉം ആണ്.`,
        en: `${c.name} has an opening balance of ₹${f.openingBalance.toLocaleString()} and estimated outstanding of ₹${f.estimatedOutstanding.toLocaleString()}.`,
      };
    }

    if (ranking && ranking.length > 0) {
      const linesMl = [`💰 കസ്റ്റമർ ബാലൻസ് വിവരങ്ങൾ:`];
      const linesEn = [`💰 Customer Outstanding Balances:`];
      ranking.forEach((r, idx) => {
        linesMl.push(`• ${idx + 1}. ${r.name} — ₹${r.openingBalance.toLocaleString('en-IN')}`);
        linesEn.push(`• ${idx + 1}. ${r.name} — ₹${r.openingBalance.toLocaleString()}`);
      });
      return {
        ml: linesMl.join('\n'),
        en: linesEn.join('\n'),
      };
    }

    return {
      ml: `കസ്റ്റമർ ബാലൻസ് വിവരങ്ങൾ ലഭ്യമല്ല.`,
      en: `Customer balance details are unavailable.`,
    };
  }

  private formatCustomerDebtRankingAnswer(
    ranking: Array<{ name: string; openingBalance: number }>,
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (!ranking || ranking.length === 0) {
      return {
        ml: `കടം ഉള്ള കസ്റ്റമർ വിവരങ്ങൾ ലഭ്യമല്ല.`,
        en: `No customer outstanding debt records found.`,
      };
    }

    const linesMl = [`💰 ഏറ്റവും കൂടുതൽ ബാക്കി നൽകാനുള്ള കസ്റ്റമേഴ്സ്:`];
    const linesEn = [`💰 Top Customer Debtors (Highest Balance):`];

    ranking.forEach((c, idx) => {
      linesMl.push(`• ${idx + 1}. ${c.name} — ₹${c.openingBalance.toLocaleString('en-IN')}`);
      linesEn.push(`• ${idx + 1}. ${c.name} — ₹${c.openingBalance.toLocaleString()}`);
    });

    return {
      ml: linesMl.join('\n'),
      en: linesEn.join('\n'),
    };
  }

  private formatCustomerSalesRankingAnswer(
    ranking: Array<{ customerName: string; totalCases: number; transactionCount: number }>,
    periodInput: any,
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (!ranking || ranking.length === 0) {
      return {
        ml: `ഈ കാലയളവിൽ കസ്റ്റമർ പർച്ചേസ് വിവരങ്ങൾ ലഭ്യമല്ല.`,
        en: `No customer sales purchases recorded for this period.`,
      };
    }

    const linesMl = [`🏆 ഏറ്റവും കൂടുതൽ വാങ്ങിയ കസ്റ്റമേഴ്സ്:`];
    const linesEn = [`🏆 Top Purchasing Customers:`];

    ranking.forEach((c, idx) => {
      linesMl.push(`• ${idx + 1}. ${c.customerName} — ${c.totalCases.toLocaleString('en-IN')} cases (${c.transactionCount} ഓർഡറുകൾ)`);
      linesEn.push(`• ${idx + 1}. ${c.customerName} — ${c.totalCases.toLocaleString()} cases (${c.transactionCount} orders)`);
    });

    return {
      ml: linesMl.join('\n'),
      en: linesEn.join('\n'),
    };
  }

  private formatRawMaterialSummaryAnswer(
    stockRes: { items: RawMaterialStockItem[]; totalQuantity: number; byType: Record<string, number> },
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (!stockRes.items || stockRes.items.length === 0) {
      return {
        ml: `നിലവിൽ റോ മെറ്റീരിയൽ സ്റ്റോക്ക് വിവരങ്ങൾ ലഭ്യമല്ല.`,
        en: `No raw material stock records found.`,
      };
    }

    const linesMl = [`🧱 റോ മെറ്റീരിയൽ സ്റ്റോക്ക് നില:`];
    const linesEn = [`🧱 Raw Material Inventory Stock:`];

    stockRes.items.forEach((m) => {
      linesMl.push(`• ${m.name} (${m.materialType}) — ${m.currentStock.toLocaleString('en-IN')} ${m.unit}`);
      linesEn.push(`• ${m.name} (${m.materialType}) — ${m.currentStock.toLocaleString()} ${m.unit}`);
    });

    return {
      ml: linesMl.join('\n'),
      en: linesEn.join('\n'),
    };
  }

  private formatRawMaterialItemAnswer(
    item: RawMaterialStockItem | null,
    query: string,
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (!item) {
      return {
        ml: `"${query}" എന്ന റോ മെറ്റീരിയലിന്റെ സ്റ്റോക്ക് വിവരങ്ങൾ ലഭ്യമല്ല.`,
        en: `No raw material records found matching "${query}".`,
      };
    }

    return {
      ml: `${item.name} (${item.materialType}) നിലവിൽ ${item.currentStock.toLocaleString('en-IN')} ${item.unit} സ്റ്റോക്കിലുണ്ട്.`,
      en: `Current stock of ${item.name} (${item.materialType}) is ${item.currentStock.toLocaleString()} ${item.unit}.`,
    };
  }

  private formatRawMaterialLowestAnswer(
    items: RawMaterialStockItem[],
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (!items || items.length === 0) {
      return {
        ml: `എല്ലാ റോ മെറ്റീരിയലുകൾക്കും ആവശ്യത്തിന് സ്റ്റോക്കുണ്ട്.`,
        en: `All raw materials currently have adequate stock levels.`,
      };
    }

    const linesMl = [`⚠️ ഏറ്റവും കുറഞ്ഞ / ഔട്ട് ഓഫ് സ്റ്റോക്ക് റോ മെറ്റീരിയലുകൾ:`];
    const linesEn = [`⚠️ Lowest / Out-of-Stock Raw Materials:`];

    items.forEach((m) => {
      linesMl.push(`• ${m.name} (${m.materialType}) — ${m.currentStock.toLocaleString('en-IN')} ${m.unit}`);
      linesEn.push(`• ${m.name} (${m.materialType}) — ${m.currentStock.toLocaleString()} ${m.unit}`);
    });

    return {
      ml: linesMl.join('\n'),
      en: linesEn.join('\n'),
    };
  }

  private formatRawMaterialMovementsAnswer(
    prof: RawMaterialProfileResult | null,
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (!prof || !prof.recentTransactions || prof.recentTransactions.length === 0) {
      return {
        ml: `റോ മെറ്റീരിയൽ മൂവ്മെന്റ് വിവരങ്ങൾ ലഭ്യമല്ല.`,
        en: `No recent raw material transaction movements found.`,
      };
    }

    const linesMl = [`🔄 ${prof.material.name} മെറ്റീരിയൽ ട്രാൻസാക്ഷനുകൾ:`];
    const linesEn = [`🔄 ${prof.material.name} Material Movements:`];

    prof.recentTransactions.slice(0, 5).forEach((t) => {
      linesMl.push(`• ${t.type}: ${t.quantityChange > 0 ? '+' : ''}${t.quantityChange} ${prof.material.unit} (Balance: ${t.balanceAfter})`);
      linesEn.push(`• ${t.type}: ${t.quantityChange > 0 ? '+' : ''}${t.quantityChange} ${prof.material.unit} (Balance: ${t.balanceAfter})`);
    });

    return {
      ml: linesMl.join('\n'),
      en: linesEn.join('\n'),
    };
  }

  private formatProductFullProfileAnswer(
    prof: ProductFullProfileResult | null,
    query: string,
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (!prof) {
      return {
        ml: `"${query}" എന്ന പ്രോഡക്റ്റിന്റെ വിവരങ്ങൾ ലഭ്യമല്ല.`,
        en: `No product profile records found for "${query}".`,
      };
    }

    const p = prof.product;
    const inv = prof.inventory;
    const s = prof.sales;
    const q = prof.quality;

    const linesMl = [
      `🍾 ${p.name} — ബിസിനസ്സ് പ്രൊഫൈൽ`,
      `• Category: ${p.category || 'General'} | Packaging: ${p.unitsPerCase || 1} units/case`,
      ``,
      `📦 സ്റ്റോക്ക് & ഉൽപ്പാദനം:`,
      `• Current Stock: ${inv.currentStockCases.toLocaleString('en-IN')} cases`,
      `• Total Produced: ${inv.totalProducedCases.toLocaleString('en-IN')} cases`,
      `• Total Dispatched: ${inv.totalDispatchedCases.toLocaleString('en-IN')} cases`,
      ``,
      `📈 സെയിൽസ് & ക്വാളിറ്റി:`,
      `• This Month Sales: ${s.thisMonthCases.toLocaleString('en-IN')} cases`,
      `• All-Time Sales: ${s.totalAllTimeCases.toLocaleString('en-IN')} cases (${s.transactionCount} dispatches)`,
      `• Total Returns: ${q.totalReturnsCases.toLocaleString('en-IN')} cases`,
      `• Total Damage: ${q.totalDamageCases.toLocaleString('en-IN')} cases`,
    ];

    const linesEn = [
      `🍾 ${p.name} — Full Product Profile`,
      `• Category: ${p.category || 'General'} | Packaging: ${p.unitsPerCase || 1} units/case`,
      ``,
      `📦 Inventory & Production:`,
      `• Current Stock: ${inv.currentStockCases.toLocaleString()} cases`,
      `• Total Produced: ${inv.totalProducedCases.toLocaleString()} cases`,
      `• Total Dispatched: ${inv.totalDispatchedCases.toLocaleString()} cases`,
      ``,
      `📈 Sales & Quality:`,
      `• This Month Sales: ${s.thisMonthCases.toLocaleString()} cases`,
      `• All-Time Sales: ${s.totalAllTimeCases.toLocaleString()} cases (${s.transactionCount} dispatches)`,
      `• Total Returns: ${q.totalReturnsCases.toLocaleString()} cases`,
      `• Total Damage: ${q.totalDamageCases.toLocaleString()} cases`,
    ];

    return {
      ml: linesMl.join('\n'),
      en: linesEn.join('\n'),
    };
  }

  private formatVendorListAnswer(
    vendors: Array<{ name: string; code: string | null; phone: string | null }>,
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (!vendors || vendors.length === 0) {
      return {
        ml: `നിലവിൽ സപ്ലയർ വിവരങ്ങൾ ലഭ്യമല്ല.`,
        en: `No supplier or vendor records found.`,
      };
    }

    const linesMl = [`🏢 സപ്ലയർ ലിസ്റ്റ് (ആകെ ${vendors.length}):`];
    const linesEn = [`🏢 Supplier Directory (Total ${vendors.length}):`];

    vendors.forEach((v, idx) => {
      linesMl.push(`• ${idx + 1}. ${v.name} (${v.code || 'N/A'}) — ഫോൺ: ${v.phone || 'N/A'}`);
      linesEn.push(`• ${idx + 1}. ${v.name} (${v.code || 'N/A'}) — Phone: ${v.phone || 'N/A'}`);
    });

    return {
      ml: linesMl.join('\n'),
      en: linesEn.join('\n'),
    };
  }

  private formatPurchaseOrdersSummaryAnswer(
    po: { totalCount: number; pendingCount: number; totalValue: number },
    lang: 'ml' | 'en'
  ): LocalizedText {
    return {
      ml: `ആകെ ${po.totalCount} പർച്ചേസ് ഓർഡറുകളുണ്ട് (പെൻഡിംഗ്: ${po.pendingCount}, ആകെ തുക: ₹${po.totalValue.toLocaleString('en-IN')}).`,
      en: `There are ${po.totalCount} total Purchase Orders (${po.pendingCount} pending, total value ₹${po.totalValue.toLocaleString()}).`,
    };
  }

  private formatProductionBatchesAnswer(
    batches: { runningCount: number; completedCount: number; recentBatches: any[] },
    lang: 'ml' | 'en'
  ): LocalizedText {
    const linesMl = [
      `🏭 പ്രൊഡക്ഷൻ ബാച്ചുകൾ: ${batches.runningCount} ബാച്ച് റണ്ണിംഗ്, ${batches.completedCount} ബാച്ച് പൂർത്തിയായി.`,
    ];
    const linesEn = [
      `🏭 Production Batches: ${batches.runningCount} running, ${batches.completedCount} completed.`,
    ];

    if (batches.recentBatches.length > 0) {
      linesMl.push(``, `സമീപകാല ബാച്ചുകൾ:`);
      linesEn.push(``, `Recent Batches:`);
      batches.recentBatches.forEach((b) => {
        linesMl.push(`• ${b.batchCode} (${b.status})`);
        linesEn.push(`• ${b.batchCode} (${b.status})`);
      });
    }

    return {
      ml: linesMl.join('\n'),
      en: linesEn.join('\n'),
    };
  }

  private formatProductionDowntimeAnswer(
    dt: { incidentCount: number; recentReasons: string[] },
    lang: 'ml' | 'en'
  ): LocalizedText {
    const reasonsStr = dt.recentReasons.length > 0 ? dt.recentReasons.join(', ') : 'None';
    return {
      ml: `ആകെ ${dt.incidentCount} ഡൗൺടൈം സംഭവങ്ങൾ രേഖപ്പെടുത്തിയിട്ടുണ്ട്. പ്രധാന കാരണങ്ങൾ: ${reasonsStr}.`,
      en: `Total ${dt.incidentCount} downtime incidents recorded. Main reasons: ${reasonsStr}.`,
    };
  }

  private isMalayalam(text: string): boolean {
    return /[\u0D00-\u0D7F]/.test(text);
  }

  private getMonthNameMl(m: number): string {
    const names = ['ജനുവരി', 'ഫെബ്രുവരി', 'മാർച്ച്', 'ഏപ്രിൽ', 'മേയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗസ്റ്റ്', 'സെപ്റ്റംബർ', 'ഒക്ടോബർ', 'നവംബർ', 'ഡിസംബർ'];
    return names[m - 1] || 'മാസം';
  }

  private getMonthNameEn(m: number): string {
    const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return names[m - 1] || 'Month';
  }

  // ── NEW ERP INTELLIGENCE FORMATTERS ──

  private formatCustomerTransactionsAnswer(
    result: { customer: { id: string; name: string } | null; transactions: Array<{ type: string; salesDate: string; productName: string; quantity: number; unitPrice: number }>; totalCases: number; period: string },
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (!result.customer) {
      return {
        ml: `ആ കസ്റ്റമർ ERP-യിൽ കണ്ടെത്താനായില്ല.`,
        en: `Customer not found in the ERP system.`,
      };
    }
    if (result.transactions.length === 0) {
      return {
        ml: `${result.customer.name}-ന്റെ ഇടപാട് ചരിത്രം ലഭ്യമല്ല.`,
        en: `No transaction history found for ${result.customer.name}.`,
      };
    }
    const linesMl = [`🕒 ${result.customer.name} — ഇടപാട് ചരിത്രം (ആകെ dispatch: ${result.totalCases.toLocaleString('en-IN')} cases):`];
    const linesEn = [`🕒 ${result.customer.name} — Transaction History (Total dispatched: ${result.totalCases.toLocaleString()} cases):`];
    result.transactions.slice(0, 10).forEach((t) => {
      linesMl.push(`• ${t.salesDate} — ${t.type}: ${t.quantity} cases (${t.productName})`);
      linesEn.push(`• ${t.salesDate} — ${t.type}: ${t.quantity} cases (${t.productName})`);
    });
    return { ml: linesMl.join('\n'), en: linesEn.join('\n') };
  }

  private formatCustomerSalesPeriodAnswer(
    result: { customer: { id: string; name: string } | null; transactions: Array<{ type: string; salesDate: string; productName: string; quantity: number; unitPrice: number }>; totalCases: number; period: string },
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (!result.customer) {
      return {
        ml: `ആ കസ്റ്റമർ ERP-യിൽ കണ്ടെത്താനായില്ല.`,
        en: `Customer not found in the ERP system.`,
      };
    }
    const dispatches = result.transactions.filter((t) => t.type === 'SALES_DISPATCH');
    if (dispatches.length === 0) {
      return {
        ml: `${result.period}-ൽ ${result.customer.name} ഒന്നും വാങ്ങിയിട്ടില്ല.`,
        en: `${result.customer.name} had no purchases in ${result.period}.`,
      };
    }
    const linesMl = [`📦 ${result.customer.name} — ${result.period}-ലെ purchases (${result.totalCases.toLocaleString('en-IN')} cases):`];
    const linesEn = [`📦 ${result.customer.name} — Purchases in ${result.period} (${result.totalCases.toLocaleString()} cases):`];
    dispatches.slice(0, 10).forEach((t) => {
      linesMl.push(`• ${t.salesDate}: ${t.quantity} cases (${t.productName})`);
      linesEn.push(`• ${t.salesDate}: ${t.quantity} cases (${t.productName})`);
    });
    return { ml: linesMl.join('\n'), en: linesEn.join('\n') };
  }

  private formatInventoryStockSummaryAnswer(
    result: { items: Array<{ itemName: string; materialType: string | null; quantity: number; unit: string; minimumStock: number; warehouseName: string | null }>; totalItems: number; lowStockItems: string[] },
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (!result.items || result.items.length === 0) {
      return {
        ml: `വെയർഹൗസ് ഇൻവെന്ററി സ്റ്റോക്ക് വിവരങ്ങൾ ലഭ്യമല്ല.`,
        en: `No warehouse inventory stock records found.`,
      };
    }
    const linesMl = [`🏭 വെയർഹൗസ് ഇൻവെന്ററി (ആകെ ${result.totalItems} items):`];
    const linesEn = [`🏭 Warehouse Inventory Stock (Total ${result.totalItems} items):`];
    result.items.forEach((i) => {
      const wh = i.warehouseName ? ` [${i.warehouseName}]` : '';
      linesMl.push(`• ${i.itemName}${wh} — ${i.quantity.toLocaleString('en-IN')} ${i.unit}`);
      linesEn.push(`• ${i.itemName}${wh} — ${i.quantity.toLocaleString()} ${i.unit}`);
    });
    if (result.lowStockItems.length > 0) {
      linesMl.push(``, `⚠️ ശ്രദ്ധ ആവശ്യം: ${result.lowStockItems.join(', ')}`);
      linesEn.push(``, `⚠️ Low stock alert: ${result.lowStockItems.join(', ')}`);
    }
    return { ml: linesMl.join('\n'), en: linesEn.join('\n') };
  }

  private formatProductListAnswer(
    result: Array<{ id: string; name: string; category: string | null; currentStock: number }>,
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (!result || result.length === 0) {
      return {
        ml: `ERP-യിൽ product വിവരങ്ങൾ ലഭ്യമല്ല.`,
        en: `No products found in the ERP system.`,
      };
    }
    const linesMl = [`📦 Product List (ആകെ ${result.length} products):`];
    const linesEn = [`📦 Product List (Total ${result.length}):`];
    result.forEach((p, idx) => {
      linesMl.push(`• ${idx + 1}. ${p.name}${p.category ? ` (${p.category})` : ''} — Stock: ${p.currentStock.toLocaleString('en-IN')} cases`);
      linesEn.push(`• ${idx + 1}. ${p.name}${p.category ? ` (${p.category})` : ''} — Stock: ${p.currentStock.toLocaleString()} cases`);
    });
    return { ml: linesMl.join('\n'), en: linesEn.join('\n') };
  }

  private formatProductStockNamedAnswer(
    result: { productName: string; currentStock: number; unit: string } | null,
    query: string,
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (!result) {
      return {
        ml: `"${query}" ERP-യിൽ കണ്ടെത്താനായില്ല.`,
        en: `Product "${query}" not found in the ERP system.`,
      };
    }
    const unitLabelMl = result.unit === 'jars' ? 'ജാർ' : 'കേസുകൾ';
    return {
      ml: `${result.productName} — നിലവിൽ ${result.currentStock.toLocaleString('en-IN')} ${unitLabelMl} stock-ൽ ലഭ്യമാണ്.`,
      en: `${result.productName} — currently ${result.currentStock.toLocaleString()} ${result.unit} available in stock.`,
    };
  }

  private formatProductLowestStockAnswer(
    result: Array<{ productName: string; currentStock: number }>,
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (!result || result.length === 0) {
      return {
        ml: `Low stock products ഒന്നും കണ്ടെത്തിയില്ല.`,
        en: `No low stock products found.`,
      };
    }
    const linesMl = [`⚠️ Stock കുറഞ്ഞ Products:`];
    const linesEn = [`⚠️ Products with Lowest Stock:`];
    result.forEach((p, idx) => {
      linesMl.push(`• ${idx + 1}. ${p.productName} — ${p.currentStock.toLocaleString('en-IN')} cases`);
      linesEn.push(`• ${idx + 1}. ${p.productName} — ${p.currentStock.toLocaleString()} cases`);
    });
    return { ml: linesMl.join('\n'), en: linesEn.join('\n') };
  }

  private formatProductHighestStockAnswer(
    result: { productName: string; currentStock: number } | null,
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (!result) {
      return {
        ml: `Product stock വിവരങ്ങൾ ലഭ്യമല്ല.`,
        en: `No product stock records found.`,
      };
    }
    return {
      ml: `📦 ഏറ്റവും കൂടുതൽ stock ഉള്ള product: ${result.productName} — ${result.currentStock.toLocaleString('en-IN')} cases.`,
      en: `📦 Highest stocked product: ${result.productName} — ${result.currentStock.toLocaleString()} cases.`,
    };
  }

  private formatProductBestSellingAnswer(
    result: Array<{ productName: string; totalCases: number }>,
    periodInput: any,
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (!result || result.length === 0) {
      return {
        ml: `ഈ കാലയളവിൽ sales data ലഭ്യമല്ല.`,
        en: `No sales data available for this period.`,
      };
    }
    const periodLabelMl = this.getPeriodLabelMl(periodInput);
    const periodLabelEn = this.getPeriodLabelEn(periodInput);
    const linesMl = [`🏆 ${periodLabelMl}-ൽ ഏറ്റവും കൂടുതൽ വിറ്റ Products:`];
    const linesEn = [`🏆 Best Selling Products in ${periodLabelEn}:`];
    result.forEach((p, idx) => {
      linesMl.push(`• ${idx + 1}. ${p.productName} — ${p.totalCases.toLocaleString('en-IN')} cases`);
      linesEn.push(`• ${idx + 1}. ${p.productName} — ${p.totalCases.toLocaleString()} cases`);
    });
    return { ml: linesMl.join('\n'), en: linesEn.join('\n') };
  }

  private formatCustomerPaymentsAnswer(
    result: { customer: { id: string; name: string } | null; payments: Array<{ amount: number; paymentDate: string; paymentMethod: string; referenceNumber: string | null; orderNumber: string | null; remarks: string | null }>; totalPaid: number },
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (!result.customer) {
      return {
        ml: `ആ കസ്റ്റമർ ERP-യിൽ കണ്ടെത്താനായില്ല.`,
        en: `Customer not found in the ERP system.`,
      };
    }
    if (result.payments.length === 0) {
      return {
        ml: `${result.customer.name}-ൽ നിന്ന് ഇതുവരെ പേയ്‌മെന്റുകൾ ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല.`,
        en: `No payment records found for ${result.customer.name}.`,
      };
    }
    const linesMl = [`💰 ${result.customer.name} — ലഭിച്ച പേയ്‌മെന്റുകൾ (ആകെ: ₹${result.totalPaid.toLocaleString('en-IN')}):`];
    const linesEn = [`💰 ${result.customer.name} — Payments Received (Total: ₹${result.totalPaid.toLocaleString()}):`];
    result.payments.slice(0, 10).forEach((p) => {
      const ref = p.referenceNumber ? ` [Ref: ${p.referenceNumber}]` : '';
      linesMl.push(`• ${p.paymentDate} — ₹${p.amount.toLocaleString('en-IN')} (${p.paymentMethod})${ref}`);
      linesEn.push(`• ${p.paymentDate} — ₹${p.amount.toLocaleString()} (${p.paymentMethod})${ref}`);
    });
    return { ml: linesMl.join('\n'), en: linesEn.join('\n') };
  }

  private formatCustomerLedgerAnswer(
    result: { customer: { id: string; name: string; openingBalance: number; openingBalanceType: string }; entries: Array<{ date: string; reference: string; description: string; debit: number; credit: number; transactionType: string }>; totalDebits: number; totalCredits: number; netBalance: number } | null,
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (!result || !result.customer) {
      return {
        ml: `കസ്റ്റമർ ലെഡ്ജർ വിവരങ്ങൾ ലഭ്യമല്ല.`,
        en: `Customer ledger statement not found.`,
      };
    }
    const linesMl = [
      `📜 ${result.customer.name} — ലെഡ്ജർ സ്റ്റേറ്റ്‌മെന്റ്:`,
      `• Total Debits (Invoices): ₹${result.totalDebits.toLocaleString('en-IN')}`,
      `• Total Credits (Payments): ₹${result.totalCredits.toLocaleString('en-IN')}`,
      `• Net Balance: ₹${result.netBalance.toLocaleString('en-IN')}`,
      ``,
      `ഇടപാടുകൾ:`,
    ];
    const linesEn = [
      `📜 ${result.customer.name} — Ledger Statement:`,
      `• Total Debits (Invoices): ₹${result.totalDebits.toLocaleString()}`,
      `• Total Credits (Payments): ₹${result.totalCredits.toLocaleString()}`,
      `• Net Balance: ₹${result.netBalance.toLocaleString()}`,
      ``,
      `Transactions:`,
    ];
    result.entries.slice(0, 10).forEach((e) => {
      const amtStr = e.debit > 0 ? `+₹${e.debit.toLocaleString('en-IN')} (Debit)` : `-₹${e.credit.toLocaleString('en-IN')} (Credit)`;
      linesMl.push(`• ${e.date}: ${e.description} | ${amtStr}`);
      linesEn.push(`• ${e.date}: ${e.description} | ${amtStr}`);
    });
    return { ml: linesMl.join('\n'), en: linesEn.join('\n') };
  }

  private formatProductBomAnswer(
    result: { product: { id: string; name: string; sku: string | null }; components: Array<{ itemName: string; materialType: string | null; quantityPerUnit: number; unit: string; availableStock: number }> } | null,
    query: string,
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (!result || !result.product) {
      return {
        ml: `"${query}"-ന്റെ BOM വിവരങ്ങൾ ERP-യിൽ കണ്ടെത്താനായില്ല.`,
        en: `Bill of Materials not found for "${query}".`,
      };
    }
    if (result.components.length === 0) {
      return {
        ml: `${result.product.name}-ന് BOM രേഖപ്പെടുത്തിയിട്ടില്ല.`,
        en: `No Bill of Materials (BOM) components configured for ${result.product.name}.`,
      };
    }
    const linesMl = [`📋 ${result.product.name} — Bill of Materials (BOM ഘടകങ്ങൾ):`];
    const linesEn = [`📋 ${result.product.name} — Bill of Materials (BOM Components):`];
    result.components.forEach((c) => {
      linesMl.push(`• ${c.itemName} (${c.materialType || 'Material'}) — 1 യൂണിറ്റിന് ${c.quantityPerUnit} ${c.unit} (ലഭ്യമായ സ്റ്റോക്ക്: ${c.availableStock} ${c.unit})`);
      linesEn.push(`• ${c.itemName} (${c.materialType || 'Material'}) — ${c.quantityPerUnit} ${c.unit}/unit (Available Stock: ${c.availableStock} ${c.unit})`);
    });
    return { ml: linesMl.join('\n'), en: linesEn.join('\n') };
  }

  private formatIncidentsSummaryAnswer(
    result: { totalOpenCount: number; openIncidents: Array<{ id: string; incidentNumber: string; title: string; priority: string; status: string; lineName: string | null; openedAt: string }> },
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (result.totalOpenCount === 0 || result.openIncidents.length === 0) {
      return {
        ml: `നിലവിൽ open ആയ incidents അല്ലെങ്കിൽ machine breakdown tickets ഒന്നും റിപ്പോർട്ട് ചെയ്തിട്ടില്ല. ✅`,
        en: `There are currently no open incidents or active breakdown tickets reported. ✅`,
      };
    }
    const linesMl = [`⚠️ നിലവിലെ Open Incidents (ആകെ: ${result.totalOpenCount}):`];
    const linesEn = [`⚠️ Current Open Incidents (Total: ${result.totalOpenCount}):`];
    result.openIncidents.forEach((inc) => {
      const lineStr = inc.lineName ? ` [Line: ${inc.lineName}]` : '';
      linesMl.push(`• [${inc.incidentNumber}] ${inc.title} — Priority: ${inc.priority} (${inc.status})${lineStr}`);
      linesEn.push(`• [${inc.incidentNumber}] ${inc.title} — Priority: ${inc.priority} (${inc.status})${lineStr}`);
    });
    return { ml: linesMl.join('\n'), en: linesEn.join('\n') };
  }

  private formatGoodsReceiptsSummaryAnswer(
    result: Array<{ id: string; grnNumber: string; vendorName: string; receivedDate: string; status: string }>,
    lang: 'ml' | 'en'
  ): LocalizedText {
    if (!result || result.length === 0) {
      return {
        ml: `ലഭിച്ച സാധനങ്ങളുടെ GRN രേഖകൾ ഒന്നും കണ്ടെത്തിയില്ല.`,
        en: `No goods receipt (GRN) records found.`,
      };
    }
    const linesMl = [`📦 അടുത്തിടെ ലഭിച്ച Goods Receipts (GRN):`];
    const linesEn = [`📦 Recent Goods Receipts (GRN):`];
    result.forEach((grn) => {
      linesMl.push(`• [${grn.grnNumber}] ${grn.vendorName} — ${grn.receivedDate} (${grn.status})`);
      linesEn.push(`• [${grn.grnNumber}] ${grn.vendorName} — ${grn.receivedDate} (${grn.status})`);
    });
    return { ml: linesMl.join('\n'), en: linesEn.join('\n') };
  }
}



