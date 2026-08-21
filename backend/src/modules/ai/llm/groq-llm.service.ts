import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import Groq from 'groq-sdk';
import {
  LlmProvider,
  LlmPlan,
  LlmSynthesisContext,
  LlmSynthesisResult,
} from './llm-provider.interface';
import { KenbyDateResolverService } from '../dates/kenby-date-resolver.service';

@Injectable()
export class GroqLlmService implements LlmProvider, OnModuleInit {
  private readonly logger = new Logger(GroqLlmService.name);
  private groq: Groq | null = null;
  private readonly models = [
    'qwen/qwen3.6-27b',
    'llama-3.3-70b-versatile',
    // llama3-70b-8192, llama3-8b-8192, mixtral-8x7b-32768 removed — decommissioned by Groq
  ];

  constructor(
    @Optional() private readonly dateResolver?: KenbyDateResolverService
  ) {}

  async onModuleInit() {
    const apiKey = process.env.GROQ_API_KEY;
    if (apiKey && apiKey.trim().length > 0) {
      this.groq = new Groq({ apiKey });
      this.logger.log('[KenbyAI] Groq provider configured: YES');
      this.logger.log('[KenbyAI] API key available: YES');
    } else {
      this.logger.warn('[KenbyAI] GROQ_API_KEY not found in environment. LLM calls will use deterministic safety layer.');
    }
  }

  async checkHealth(): Promise<{ ok: boolean; provider: string; model: string }> {
    if (!this.groq) {
      return { ok: false, provider: 'Groq', model: this.models[0] };
    }
    try {
      return { ok: true, provider: 'Groq', model: this.models[0] };
    } catch (err: any) {
      this.logger.warn(`[KenbyAI] Groq health check failed: ${err.message}`);
      return { ok: false, provider: 'Groq', model: this.models[0] };
    }
  }

  /**
   * Generates a structured tool & RAG execution plan from the user's natural language input
   */
  async generatePlan(
    userQuestion: string,
    conversationContext?: any,
    availableTools?: any[]
  ): Promise<LlmPlan> {
    if (!this.groq) {
      return this.generateFallbackPlan(userQuestion, conversationContext);
    }

    // Build real-time date context from system clock — never hardcode
    const nowDate = new Date();
    const monthNamesEn = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const currentDate = nowDate.toISOString().split('T')[0];
    const currentYear = nowDate.getFullYear();
    const currentMonthNum = nowDate.getMonth() + 1;
    const currentMonthName = monthNamesEn[nowDate.getMonth()];
    const prevMonthNum = currentMonthNum === 1 ? 12 : currentMonthNum - 1;
    const prevMonthName = monthNamesEn[prevMonthNum - 1];
    const prevPrevMonthName = monthNamesEn[(prevMonthNum - 2 + 12) % 12];
    const timezone = 'Asia/Kolkata';

    const systemPrompt = `You are the Senior AI Architect and Planning Engine for Kenby ERP (Manufacturing & Beverage Distribution).
Current Real Context:
- Date: ${currentDate}
- Current Year: ${currentYear}, Current Month: ${currentMonthName} (Month ${currentMonthNum})
- Previous Month: ${prevMonthName} (Month ${prevMonthNum}), Month before that: ${prevPrevMonthName}
- Timezone: ${timezone}

You MUST respond strictly with a valid JSON object matching this schema:
{
  "thought": "brief reasoning",
  "requiresLiveData": true,
  "requiresKnowledge": false,
  "tasks": [
    {
      "tool": "tool_name",
      "parameters": {}
    }
  ],
  "isUnsupportedFinancial": false,
  "clarificationNeeded": false,
  "clarificationMessage": null
}

AVAILABLE TOOLS:
0. get_full_erp_summary({ period: "today" | "yesterday" | "this_month" | "last_month" | "specific_month" | "specific_date", year?: number, month?: number, date?: string })
   -> USE THIS whenever user asks for "total data", "all data", "full details", "complete data", "full report", "മുഴുവൻ data", "എല്ലാ data" for a period/month.
1. get_sales_summary({ period: "today" | "yesterday" | "this_month" | "last_month" | "specific_month" | "specific_date" | "date_range", date?: string (YYYY-MM-DD), year?: number, month?: number, startDate?: string, endDate?: string, product?: string, customer?: string })
2. get_sales_by_date({ date: string (YYYY-MM-DD), product?: string })
3. get_sales_transactions({ date?: string, customer?: string, product?: string, type?: "SALES_DISPATCH" | "SALES_RETURN" | "DAMAGE", limit?: number })
   -> USE THIS for "sales history", "Sinan sales history", "recent sales transactions", "transaction logs".
4. get_dispatch_summary({ period?: string, date?: string, year?: number, month?: number })
5. get_return_summary({ period?: string, date?: string, year?: number, month?: number, product?: string })
   -> USE THIS for "return", "sales return", "റിട്ടേൺ".
6. get_damage_summary({ period?: string, date?: string, year?: number, month?: number, product?: string })
   -> USE THIS for "damage", "case damage", "ഡാമേജ്", "കേടുപാടുകൾ". NEVER USE STOCK FOR DAMAGE!
7. list_products({})
8. get_product_stock({ product?: string })
   -> USE ONLY when user explicitly asks for product stock or inventory.
9. get_product_profile({ product: string })
10. get_product_bom({ product: string })
11. list_raw_materials({})
12. get_raw_material_stock({ material: string })
   -> USE THIS for raw materials like Green Cap, Preform, Bottle, Label.
13. get_raw_material_movements({ material: string, limit?: number })
14. get_low_stock_items({})
15. get_negative_stock_items({})
16. list_customers({ limit?: number })
17. get_customer_profile({ customer: string })
18. get_customer_balance({ customer: string })
   -> USE ONLY for balance, outstanding, ledger inquiries. NOT for sales history!
19. get_customer_payments({ customer: string, limit?: number })
20. get_customer_ledger({ customer: string })
21. get_customer_debt_ranking({ limit?: number })
22. list_vendors({})
23. get_goods_receipts({ limit?: number })
24. get_production_summary({ period?: string, year?: number, month?: number, date?: string, product?: string })
25. get_production_batches({ limit?: number })
26. get_production_downtime({ limit?: number })
27. get_incident_summary({ statusFilter?: "open" | "all" })
28. list_employees({})
29. get_knowledge({ topic: string })

STRICT PLANNING RULES:
1. NEVER USE STOCK AS FALLBACK: If user query is about damage, route to get_damage_summary. If return, route to get_return_summary.
2. Broad Full Data Queries:
   - "${currentMonthName} month total data" / "all data in ${currentMonthName}" / "${currentMonthName} full report" / "ഈ മാസം എല്ലാ data" -> get_full_erp_summary({ period: "specific_month", year: ${currentYear}, month: ${currentMonthNum} })
3. Sales History vs Customer Balance:
   - "Sinan sales history" / "sales history" -> get_sales_transactions({ customer: "Sinan" })
   - "Sinan balance" / "Sinan outstanding" -> get_customer_balance({ customer: "Sinan" })
4. Production Details:
   - "yesterday production details" -> get_production_summary({ period: "yesterday" })
5. Financial Guardrail:
   - Company net profit, company P&L, balance sheet -> set isUnsupportedFinancial: true.
6. Unknown Query:
   - If query is ambiguous or unrelated, set clarificationNeeded: true with clarificationMessage. NEVER route to stock.`;

    const userContent = `User Question: "${userQuestion}"
Active Conversation Context: ${JSON.stringify(conversationContext || {})}`;

    for (const model of this.models) {
      try {
        const response = await this.groq.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.0,
          max_tokens: 1024,
        });

        const rawJson = response.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(rawJson);

        return {
          thought: parsed.thought || '',
          requiresLiveData: !!parsed.requiresLiveData,
          requiresKnowledge: !!parsed.requiresKnowledge,
          tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
          isUnsupportedFinancial: !!parsed.isUnsupportedFinancial,
          clarificationNeeded: !!parsed.clarificationNeeded,
          clarificationMessage: parsed.clarificationMessage || null,
        };
      } catch (err: any) {
        this.logger.warn(`[KenbyAI] Groq model ${model} plan generation failed (${err.message}), trying next model...`);
      }
    }

    return this.generateFallbackPlan(userQuestion, conversationContext);
  }

  /**
   * Synthesizes natural factual bilingual response grounded strictly in tool data and vector RAG
   */
  async synthesizeAnswer(context: LlmSynthesisContext): Promise<LlmSynthesisResult> {
    if (!this.groq) {
      return this.generateFallbackSynthesis(context);
    }

    const systemPrompt = `You are Kenby AI, the authoritative Business Intelligence assistant for Kenby ERP.
Synthesize a direct, concise, natural response in BOTH Malayalam (ml) and English (en) based strictly on the provided Tool Execution Results and RAG Knowledge.

You MUST respond strictly with a valid JSON object matching this schema:
{
  "answer": {
    "ml": "Direct Malayalam answer here.",
    "en": "Direct English answer here."
  },
  "audioSpeechText": "Concise text for voice Text-to-Speech"
}

RESPONSE QUALITY & GROUNDING RULES:
1. FIRST SENTENCE DIRECTNESS: Answer the question directly in the very first sentence. No preamble or conversational filler.
2. ZERO-DATA ACCURACY:
   - If requested date/period has 0 records: Clearly state "ഈ കാലയളവിൽ [subject] records ഒന്നും കണ്ടെത്താനായില്ല." / "No [subject] records were found for [period]."
   - NEVER substitute stock for damage/returns/sales.
3. NEVER EXPOSE RAW JSON OR DATA DUMPS:
   - Format lists into clean bullet points.
   - NEVER output raw JSON or "Data: [...]".
4. GROUNDING: Every number must come directly from tool results.`;

    const userContent = `User Question: "${context.question}"
Language requested: ${context.language}
Tool Execution Results: ${JSON.stringify(context.toolResults || [])}
RAG Knowledge Chunks: ${JSON.stringify((context.ragChunks || []).map((c) => ({ title: c.title, content: c.content })))}`;

    for (const model of this.models) {
      try {
        const response = await this.groq.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 1024,
        });

        const rawJson = response.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(rawJson);

        if (parsed.answer && (parsed.answer.ml || parsed.answer.en)) {
          return {
            answer: {
              ml: parsed.answer.ml || parsed.answer.en || '',
              en: parsed.answer.en || parsed.answer.ml || '',
            },
            audioSpeechText: parsed.audioSpeechText || parsed.answer.ml || parsed.answer.en || '',
          };
        }
      } catch (err: any) {
        this.logger.warn(`[KenbyAI] Groq model ${model} synthesis failed (${err.message}), trying next model...`);
      }
    }

    return this.generateFallbackSynthesis(context);
  }

  /**
   * Generates dense vector embedding using character n-gram/token hashing vectorizer
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const dim = 128;
    const vec = new Array(dim).fill(0);
    const cleaned = (text || '').toLowerCase().trim();
    if (!cleaned) return vec;

    for (let i = 0; i < cleaned.length - 2; i++) {
      const gram = cleaned.substring(i, i + 3);
      let hash = 0;
      for (let j = 0; j < gram.length; j++) {
        hash = (hash << 5) - hash + gram.charCodeAt(j);
        hash |= 0;
      }
      const idx = Math.abs(hash) % dim;
      vec[idx] += 1;
    }

    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }

  private generateFallbackPlan(userQuestion: string, context?: any): LlmPlan {
    const qLower = (userQuestion || '').toLowerCase();

    // Resolve date deterministically using KenbyDateResolverService
    const resolvedDate = this.dateResolver ? this.dateResolver.resolveDateBounds({ question: userQuestion, ...context }) : null;
    const periodParams = resolvedDate ? {
      period: resolvedDate.periodType,
      date: resolvedDate.exactDate,
      year: resolvedDate.year,
      month: resolvedDate.month,
      startDate: resolvedDate.startDateStr,
      endDate: resolvedDate.endDateStr,
    } : { period: 'this_month' };

    // 1. Broad / Full ERP Summary Queries
    if (
      qLower.includes('total data') ||
      qLower.includes('all data') ||
      qLower.includes('complete data') ||
      qLower.includes('full report') ||
      qLower.includes('full details') ||
      qLower.includes('overall summary') ||
      qLower.includes('മുഴുവൻ data') ||
      qLower.includes('എല്ലാ data')
    ) {
      return {
        thought: 'Fallback full ERP summary plan',
        requiresLiveData: true,
        requiresKnowledge: false,
        tasks: [{ tool: 'get_full_erp_summary', parameters: periodParams }],
        isUnsupportedFinancial: false,
        clarificationNeeded: false,
        clarificationMessage: null,
      };
    }

    // 2. Damage Queries (MANDATORY: NEVER ROUTE TO STOCK)
    if (
      qLower.includes('damage') ||
      qLower.includes('ഡാമേജ്') ||
      qLower.includes('കേസ് ഡാമേജ്') ||
      qLower.includes('കേടുപാടുകൾ')
    ) {
      return {
        thought: 'Fallback damage summary plan',
        requiresLiveData: true,
        requiresKnowledge: false,
        tasks: [{ tool: 'get_damage_summary', parameters: periodParams }],
        isUnsupportedFinancial: false,
        clarificationNeeded: false,
        clarificationMessage: null,
      };
    }

    // 3. Return Queries
    if (qLower.includes('return') || qLower.includes('റിട്ടേൺ') || qLower.includes('തിരിച്ചയക്കൽ')) {
      return {
        thought: 'Fallback return summary plan',
        requiresLiveData: true,
        requiresKnowledge: false,
        tasks: [{ tool: 'get_return_summary', parameters: periodParams }],
        isUnsupportedFinancial: false,
        clarificationNeeded: false,
        clarificationMessage: null,
      };
    }

    // 4. Sales History / Transactions (English, Malayalam, Manglish)
    if (
      qLower.includes('history') ||
      qLower.includes('transactions') ||
      qLower.includes('ഇടപാടുകൾ') ||
      qLower.includes('ഹിസ്റ്ററി') ||
      qLower.includes('ചരിത്രം') ||
      qLower.includes('വാങ്ങി')
    ) {
      const custMatch = (qLower.includes('sinan') || qLower.includes('സിനാൻ')) ? 'Sinan' : context?.customer;
      return {
        thought: 'Fallback sales transactions plan',
        requiresLiveData: true,
        requiresKnowledge: false,
        tasks: [{ tool: 'get_sales_transactions', parameters: { customer: custMatch, ...periodParams, limit: 10 } }],
        isUnsupportedFinancial: false,
        clarificationNeeded: false,
        clarificationMessage: null,
      };
    }

    // 5. Production Queries
    if (qLower.includes('production') || qLower.includes('നിർമ്മാണം') || qLower.includes('ഉത്പാദനം')) {
      return {
        thought: 'Fallback production plan',
        requiresLiveData: true,
        requiresKnowledge: false,
        tasks: [{ tool: 'get_production_summary', parameters: periodParams }],
        isUnsupportedFinancial: false,
        clarificationNeeded: false,
        clarificationMessage: null,
      };
    }

    // 6. Raw Materials Queries
    if (
      qLower.includes('green cap') ||
      qLower.includes('preform') ||
      qLower.includes('bottle') ||
      qLower.includes('label') ||
      qLower.includes('raw material') ||
      qLower.includes('റോ മെറ്റീരിയൽ')
    ) {
      if (qLower.includes('green cap')) {
        return {
          thought: 'Fallback green cap stock',
          requiresLiveData: true,
          requiresKnowledge: false,
          tasks: [{ tool: 'get_raw_material_stock', parameters: { material: 'Green Cap' } }],
          isUnsupportedFinancial: false,
          clarificationNeeded: false,
          clarificationMessage: null,
        };
      }
      if (qLower.includes('preform')) {
        return {
          thought: 'Fallback preform stock',
          requiresLiveData: true,
          requiresKnowledge: false,
          tasks: [{ tool: 'get_raw_material_stock', parameters: { material: 'Preform' } }],
          isUnsupportedFinancial: false,
          clarificationNeeded: false,
          clarificationMessage: null,
        };
      }
      return {
        thought: 'Fallback list raw materials',
        requiresLiveData: true,
        requiresKnowledge: false,
        tasks: [{ tool: 'list_raw_materials', parameters: {} }],
        isUnsupportedFinancial: false,
        clarificationNeeded: false,
        clarificationMessage: null,
      };
    }

    // 7. Customer Queries
    if (qLower.includes('balance') || qLower.includes('outstanding') || qLower.includes('കുടിശ്ശിക')) {
      const custMatch = (qLower.includes('sinan') || qLower.includes('സിനാൻ')) ? 'Sinan' : context?.customer || 'Sinan';
      return {
        thought: 'Fallback customer balance',
        requiresLiveData: true,
        requiresKnowledge: false,
        tasks: [{ tool: 'get_customer_balance', parameters: { customer: custMatch } }],
        isUnsupportedFinancial: false,
        clarificationNeeded: false,
        clarificationMessage: null,
      };
    }

    if (qLower.includes('customer') || qLower.includes('കസ്റ്റമർ')) {
      return {
        thought: 'Fallback list customers',
        requiresLiveData: true,
        requiresKnowledge: false,
        tasks: [{ tool: 'list_customers', parameters: {} }],
        isUnsupportedFinancial: false,
        clarificationNeeded: false,
        clarificationMessage: null,
      };
    }

    // 8. Sales / Dispatch Queries
    if (qLower.includes('sales') || qLower.includes('dispatch') || qLower.includes('സെയിൽസ്') || qLower.includes('വിൽപ്പന')) {
      return {
        thought: 'Safety fallback sales plan',
        requiresLiveData: true,
        requiresKnowledge: false,
        tasks: [{ tool: 'get_sales_summary', parameters: periodParams }],
        isUnsupportedFinancial: false,
        clarificationNeeded: false,
        clarificationMessage: null,
      };
    }

    // 9. Products / Product Stock Queries (ONLY when explicitly requested!)
    if (
      qLower.includes('stock') ||
      qLower.includes('സ്റ്റോക്ക്') ||
      qLower.includes('ഇരിപ്പ്') ||
      qLower.includes('kenby 1') ||
      qLower.includes('aquora') ||
      qLower.includes('product') ||
      qLower.includes('ഉൽപ്പന്ന')
    ) {
      if (qLower.includes('kenby 1') || qLower.includes('aquora')) {
        const prod = qLower.includes('kenby 1') ? 'Kenby 1' : 'Aquora 2';
        return {
          thought: `Fallback stock for ${prod}`,
          requiresLiveData: true,
          requiresKnowledge: false,
          tasks: [{ tool: 'get_product_stock', parameters: { product: prod } }],
          isUnsupportedFinancial: false,
          clarificationNeeded: false,
          clarificationMessage: null,
        };
      }
      if (qLower.includes('all products') || qLower.includes('product list')) {
        return {
          thought: 'Fallback list products',
          requiresLiveData: true,
          requiresKnowledge: false,
          tasks: [{ tool: 'list_products', parameters: {} }],
          isUnsupportedFinancial: false,
          clarificationNeeded: false,
          clarificationMessage: null,
        };
      }
      return {
        thought: 'Fallback general stock',
        requiresLiveData: true,
        requiresKnowledge: false,
        tasks: [{ tool: 'get_product_stock', parameters: {} }],
        isUnsupportedFinancial: false,
        clarificationNeeded: false,
        clarificationMessage: null,
      };
    }

    // 10. STRICT SAFETY: UNKNOWN INTENT (NEVER DEFAULT TO STOCK!)
    return {
      thought: 'Unknown or ambiguous query - requiring clarification',
      requiresLiveData: false,
      requiresKnowledge: false,
      tasks: [],
      isUnsupportedFinancial: false,
      clarificationNeeded: true,
      clarificationMessage: {
        ml: 'ക്ഷമിക്കണം, താങ്കൾ ചോദിച്ച കാര്യം വ്യക്തമായില്ല. വിൽപ്പന, ഉത്പാദനം, സ്റ്റോക്ക്, ഡാമേജ്, റിട്ടേൺ അല്ലെങ്കിൽ കസ്റ്റമർ വിവരങ്ങളിൽ ഏതാണ് താങ്കൾക്ക് അറിയേണ്ടത്?',
        en: 'I did not quite understand your request. Could you please specify if you would like information on sales, production, stock, damage, returns, or customer details?',
      },
    };
  }

  private generateFallbackSynthesis(context: LlmSynthesisContext): LlmSynthesisResult {
    let mlParts: string[] = [];
    let enParts: string[] = [];

    const firstTool = context.toolResults && context.toolResults[0];
    if (firstTool && firstTool.data) {
      const data = firstTool.data;

      // Handle Full ERP Summary
      if (firstTool.tool === 'get_full_erp_summary') {
        const salesQty = Number(data.sales?.totalQuantity || 0);
        const salesTx = Number(data.sales?.transactionCount || 0);
        const returnsQty = Number(data.returns?.totalQuantity || 0);
        const damageQty = Number(data.damage?.totalQuantity || 0);
        const prodCases = Number(data.production?.totalCasesProduced || 0);
        const prodBatches = Number(data.production?.logCount || 0);
        const stockCases = Number(data.inventory?.totalCurrentStock || 0);
        const rawCount = Array.isArray(data.rawMaterials) ? data.rawMaterials.length : 0;
        const custCount = Array.isArray(data.customers) ? data.customers.length : 0;

        mlParts.push(`📊 സമഗ്ര ERP റിപ്പോർട്ട്:
• Sales & Dispatch: ${salesQty > 0 ? `${salesQty.toLocaleString()} യൂണിറ്റുകൾ (${salesTx} ഇടപാടുകൾ)` : 'റെക്കോർഡുകൾ ഒന്നും കണ്ടെത്താനായില്ല'}
• Returns: ${returnsQty > 0 ? `${returnsQty.toLocaleString()} കേസുകൾ` : 'റെക്കോർഡുകൾ ഒന്നും കണ്ടെത്താനായില്ല'}
• Damage: ${damageQty > 0 ? `${damageQty.toLocaleString()} കേസുകൾ` : 'റെക്കോർഡുകൾ ഒന്നും കണ്ടെത്താനായില്ല'}
• Production: ${prodCases > 0 ? `${prodCases.toLocaleString()} കേസുകൾ (${prodBatches} ലോഗുകൾ)` : 'റെക്കോർഡുകൾ ഒന്നും കണ്ടെത്താനായില്ല'}
• Current Inventory: ${stockCases.toLocaleString()} കേസുകൾ (ശ്രദ്ധിക്കുക: ഇപ്പോഴത്തെ സ്റ്റോക്ക് ഇരിപ്പ്)
• Raw Materials: ${rawCount} എണ്ണം ട്രാക്ക് ചെയ്യുന്നു
• Customers: ${custCount} പേർ രജിസ്റ്റർ ചെയ്തു`);

        enParts.push(`📊 Comprehensive ERP Summary:
• Sales & Dispatch: ${salesQty > 0 ? `${salesQty.toLocaleString()} units (${salesTx} transactions)` : 'No records found'}
• Returns: ${returnsQty > 0 ? `${returnsQty.toLocaleString()} cases` : 'No records found'}
• Damage: ${damageQty > 0 ? `${damageQty.toLocaleString()} cases` : 'No records found'}
• Production Output: ${prodCases > 0 ? `${prodCases.toLocaleString()} cases across ${prodBatches} batches` : 'No records found'}
• Current Inventory: ${stockCases.toLocaleString()} cases (Note: Current stock balance)
• Raw Materials: ${rawCount} tracked items
• Customers: ${custCount} active customers`);
      }
      // Handle Damage Summary
      else if (firstTool.tool === 'get_damage_summary') {
        const qty = Number(data.totalQuantity || 0);
        const tx = Number(data.transactionCount || 0);
        const pLabelEn = data.period?.label || 'for this period';
        const pLabelMl = data.period?.labelMl || 'ഈ കാലയളവിൽ';
        if (qty === 0 && tx === 0) {
          mlParts.push(`${pLabelMl} damage records ഒന്നും കണ്ടെത്താനായില്ല.`);
          enParts.push(`No damage records were found ${pLabelEn.startsWith('for') ? pLabelEn : `for ${pLabelEn}`}.`);
        } else {
          mlParts.push(`${pLabelMl} ആകെ ${qty.toLocaleString()} കേസുകൾ damage രേഖപ്പെടുത്തിയിട്ടുണ്ട് (${tx} ഇടപാടുകൾ).`);
          enParts.push(`Total ${qty.toLocaleString()} damaged cases recorded ${pLabelEn.startsWith('for') ? pLabelEn : `for ${pLabelEn}`} across ${tx} transactions.`);
        }
      }
      // Handle Return Summary
      else if (firstTool.tool === 'get_return_summary') {
        const qty = Number(data.totalQuantity || 0);
        const tx = Number(data.transactionCount || 0);
        const pLabelEn = data.period?.label || 'for this period';
        const pLabelMl = data.period?.labelMl || 'ഈ കാലയളവിൽ';
        if (qty === 0 && tx === 0) {
          mlParts.push(`${pLabelMl} സെയിൽസ് റിട്ടേൺ records ഒന്നും കണ്ടെത്താനായില്ല.`);
          enParts.push(`No sales return records were found ${pLabelEn.startsWith('for') ? pLabelEn : `for ${pLabelEn}`}.`);
        } else {
          mlParts.push(`${pLabelMl} ആകെ ${qty.toLocaleString()} കേസുകൾ റിട്ടേൺ (return) രേഖപ്പെടുത്തിയിട്ടുണ്ട് (${tx} ഇടപാടുകൾ).`);
          enParts.push(`Total ${qty.toLocaleString()} returned cases recorded ${pLabelEn.startsWith('for') ? pLabelEn : `for ${pLabelEn}`} across ${tx} transactions.`);
        }
      }
      // Handle Sales Summary
      else if (firstTool.tool === 'get_sales_summary' || firstTool.tool === 'get_sales_by_date') {
        const qty = Number(data.totalQuantity || 0);
        const txCount = Number(data.transactionCount || 0);
        const dateStr = data.period?.date || (data.period?.startDate === data.period?.endDate ? data.period?.startDate : null);
        // Use the period label returned by the tool executor (e.g. "July 2026" / "2026 ജൂലൈ")
        const pLabelEn = data.period?.label?.en || data.period?.label || 'for this period';
        const pLabelMl = data.period?.label?.ml || data.period?.labelMl || 'ഈ കാലയളവിൽ';

        if (qty === 0 && txCount === 0) {
          if (dateStr) {
            mlParts.push(`${dateStr}-ന് sales records ഒന്നും കണ്ടെത്താനായില്ല.`);
            enParts.push(`No sales records were found for ${dateStr}.`);
          } else {
            mlParts.push(`${pLabelMl} sales records ഒന്നും കണ്ടെത്താനായില്ല.`);
            enParts.push(`No sales records were found ${pLabelEn.startsWith('for') ? pLabelEn : `for ${pLabelEn}`}.`);
          }
        } else {
          if (dateStr) {
            mlParts.push(`${dateStr}-ൽ ആകെ ${qty.toLocaleString()} യൂണിറ്റ് sales dispatch ചെയ്തിട്ടുണ്ട് (${txCount} transactions).`);
            enParts.push(`Total ${qty.toLocaleString()} units sales dispatched on ${dateStr} across ${txCount} transactions.`);
          } else {
            mlParts.push(`${pLabelMl} ആകെ ${qty.toLocaleString()} യൂണിറ്റ് sales dispatch ചെയ്തിട്ടുണ്ട് (${txCount} transactions).`);
            enParts.push(`Total ${qty.toLocaleString()} units sales dispatched ${pLabelEn.startsWith('for') ? pLabelEn : `for ${pLabelEn}`} across ${txCount} transactions.`);
          }
        }
      } else if (firstTool.tool === 'get_sales_transactions') {
        const items = Array.isArray(data) ? data : [];
        if (items.length === 0) {
          mlParts.push('സെയിൽസ് ഇടപാടുകൾ ഒന്നും കണ്ടെത്താനായില്ല.');
          enParts.push('No sales transaction records found.');
        } else {
          const mlList = items.map((t: any) => `• ${t.salesDate || t.date || ''}: ${t.customerName || t.customer || 'Customer'} - ${t.productName || t.product || 'Product'} (${Number(t.quantity || 0).toLocaleString()} യൂണിറ്റ് ${t.type || 'SALES_DISPATCH'})`).join('\n');
          const enList = items.map((t: any) => `• ${t.salesDate || t.date || ''}: ${t.customerName || t.customer || 'Customer'} received ${Number(t.quantity || 0).toLocaleString()} units of ${t.productName || t.product || 'Product'} (${t.type || 'SALES_DISPATCH'})`).join('\n');
          mlParts.push(`കണ്ടെത്തിയ സെയിൽസ് ഇടപാടുകൾ (${items.length} എണ്ണം):\n${mlList}`);
          enParts.push(`Found ${items.length} sales transactions:\n${enList}`);
        }
      } else if (firstTool.tool === 'get_production_summary') {
        const total = Number(data.totalCasesProduced || 0);
        const finished = Number(data.totalFinishedGoodsProduced ?? total);
        const waste = Number(data.totalWastage || 0);
        const logs = Number(data.logCount || 0);
        const pLabel = data.period?.label || 'ഈ കാലയളവിൽ';
        const pLabelEn = data.period?.label || 'for this period';

        if (total === 0 && logs === 0) {
          mlParts.push(`${pLabel} production records ഒന്നും കണ്ടെത്താനായില്ല.`);
          enParts.push(`No production records were found ${pLabelEn}.`);
        } else {
          mlParts.push(`ഉത്പാദന വിവരങ്ങൾ (${pLabel}):\n• ആകെ ഉത്പാദനം: ${total.toLocaleString()} കേസുകൾ\n• Finished Goods: ${finished.toLocaleString()} കേസുകൾ\n• വേസ്റ്റേജ്: ${waste.toLocaleString()} കേസുകൾ\n• പ്രൊഡക്ഷൻ ലോഗുകൾ: ${logs} എണ്ണം`);
          enParts.push(`Production Details (${pLabelEn}):\n• Total Output: ${total.toLocaleString()} cases\n• Finished Goods: ${finished.toLocaleString()} cases\n• Wastage: ${waste.toLocaleString()} cases\n• Production Logs: ${logs}`);
        }
      } else if (firstTool.tool === 'list_products' || firstTool.tool === 'get_all_products') {
        const items = Array.isArray(data) ? data : [];
        if (items.length === 0) {
          mlParts.push('സിസ്റ്റത്തിൽ registered products ഒന്നും കണ്ടെത്താനായില്ല.');
          enParts.push('No registered products found in the system.');
        } else {
          const listStr = items.map((p: any) => `• ${p.name}: ${p.currentStock} ${p.unit || 'cases'}`).join('\n');
          mlParts.push(`ലഭ്യമായ ഉൽപ്പന്നങ്ങൾ (${items.length} എണ്ണം):\n${listStr}`);
          enParts.push(`Registered Products (${items.length} items):\n${listStr}`);
        }
      } else if (firstTool.tool === 'list_raw_materials' || firstTool.tool === 'get_all_raw_materials') {
        const items = Array.isArray(data) ? data : [];
        if (items.length === 0) {
          mlParts.push('സിസ്റ്റത്തിൽ raw materials ഒന്നും കണ്ടെത്താനായില്ല.');
          enParts.push('No raw materials found in the system.');
        } else {
          const listStr = items.map((m: any) => `• ${m.name} (${m.materialType}): ${m.currentStock} ${m.unit}`).join('\n');
          mlParts.push(`ലഭ്യമായ Raw Materials (${items.length} എണ്ണം):\n${listStr}`);
          enParts.push(`Raw Materials (${items.length} items):\n${listStr}`);
        }
      } else if (firstTool.tool === 'list_customers' || firstTool.tool === 'get_all_customers') {
        const items = Array.isArray(data) ? data : [];
        if (items.length === 0) {
          mlParts.push('കസ്റ്റമർ റെക്കോർഡുകൾ ഒന്നും കണ്ടെത്താനായില്ല.');
          enParts.push('No customer records found.');
        } else {
          const listStr = items.map((c: any) => `• ${c.name} (Balance: ₹${c.outstandingBalance})`).join('\n');
          mlParts.push(`രജിസ്റ്റർ ചെയ്ത കസ്റ്റമേഴ്സ് (${items.length} പേർ):\n${listStr}`);
          enParts.push(`Registered Customers (${items.length}):\n${listStr}`);
        }
      } else if (firstTool.tool === 'get_customer_balance' || firstTool.tool === 'get_customer_profile') {
        const name = data.customer?.name || data.name || 'Customer';
        const bal = data.financials?.estimatedOutstanding ?? data.outstandingBalance ?? 0;
        mlParts.push(`${name}-ന്റെ നിലവിലെ കുടിശ്ശിക ₹${Number(bal).toLocaleString()} ആണ്.`);
        enParts.push(`${name}'s current outstanding balance is ₹${Number(bal).toLocaleString()}.`);
      } else if (firstTool.tool === 'get_product_stock') {
        if (data.material) {
          const name = data.material.name || 'Product';
          const stock = Number(data.material.currentStock ?? 0);
          const unit = data.material.unit || 'units';
          mlParts.push(`${name} നിലവിൽ ${stock} ${unit} സ്റ്റോക്കിലുണ്ട്.`);
          enParts.push(`${name} currently has ${stock} ${unit} in stock.`);
        } else {
          const cases = data.inventory?.currentStockCases ?? data.totalCurrentStock ?? data.currentStock ?? 0;
          mlParts.push(`നിലവിൽ ആകെ ${Number(cases).toLocaleString()} കേസുകൾ സ്റ്റോക്കിലുണ്ട്.`);
          enParts.push(`Current stock is ${Number(cases).toLocaleString()} cases.`);
        }
      } else if (firstTool.tool === 'get_raw_material_stock') {
        const name = data.material?.name || data.name || 'Material';
        const stock = Number(data.material?.currentStock ?? data.currentStock ?? 0);
        const unit = data.material?.unit || data.unit || 'units';
        mlParts.push(`${name} നിലവിൽ ${stock} ${unit} സ്റ്റോക്കിലുണ്ട്.`);
        enParts.push(`${name} currently has ${stock} ${unit} in stock.`);
      } else {
        mlParts.push('ആവശ്യപ്പെട്ട വിവരങ്ങൾ വിജയകരമായി കണ്ടെത്തി.');
        enParts.push('Requested information was found successfully.');
      }
    }

    if (context.ragChunks && context.ragChunks.length > 0) {
      const top = context.ragChunks[0];
      mlParts.push(`\n📚 ${top.title}:\n${top.content}`);
      enParts.push(`\n📚 ${top.title}:\n${top.content}`);
    }

    const finalMl = mlParts.join('\n\n') || 'ക്ഷമിക്കണം, ആവശ്യപ്പെട്ട വിവരങ്ങൾ ERP ഡേറ്റയിൽ ലഭ്യമായില്ല.';
    const finalEn = enParts.join('\n\n') || 'Sorry, no authoritative information was found in ERP data.';

    return {
      answer: {
        ml: finalMl,
        en: finalEn,
      },
      audioSpeechText: context.language === 'ml' ? finalMl.split('\n')[0] : finalEn.split('\n')[0],
    };
  }
}
