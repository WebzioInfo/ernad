import { Injectable, Logger } from '@nestjs/common';
import { GroqLlmService } from './groq-llm.service';
import { LlmSynthesisContext, LlmSynthesisResult } from './llm-provider.interface';
import { KenbyGroundingValidatorService } from '../grounding/kenby-grounding-validator.service';
import { AnswerEvidence } from '../grounding/kenby-grounding.interface';

@Injectable()
export class LlmSynthesizerService {
  private readonly logger = new Logger(LlmSynthesizerService.name);

  constructor(
    private readonly groqLlmService: GroqLlmService,
    private readonly groundingValidator: KenbyGroundingValidatorService
  ) {}

  /**
   * Synthesizes natural multilingual output grounded strictly in ERP tool execution and RAG chunks,
   * enforced by the KenbyGroundingValidatorService with ZERO raw-JSON guarantee.
   */
  async synthesize(context: LlmSynthesisContext & { evidence?: AnswerEvidence }): Promise<LlmSynthesisResult> {
    this.logger.log(`[LLM_SYNTHESIZER] Synthesizing response for: "${context.question}" (lang: ${context.language})`);

    // 1. Call Groq LLM synthesis
    const result = await this.groqLlmService.synthesizeAnswer(context);

    // 2. Extract or construct evidence from toolResults if not explicitly provided
    let evidence = context.evidence;
    if (!evidence && context.toolResults && context.toolResults.length > 0) {
      const firstRes = context.toolResults[0] as any;
      evidence = firstRes.evidence;
    }

    // 3. ZERO RAW JSON VALIDATION: Check if LLM generated raw JSON or unformatted data
    if (result && result.answer && (result.answer.ml || result.answer.en)) {
      const isRawJsonMl = this.isRawJsonOrDebugText(result.answer.ml);
      const isRawJsonEn = this.isRawJsonOrDebugText(result.answer.en);

      if (!isRawJsonMl && !isRawJsonEn) {
        const validation = this.groundingValidator.validateAnswer(result.answer, evidence);
        if (validation.isValid) {
          return result;
        }

        if (validation.enforcedAnswer) {
          this.logger.warn(`[LLM_SYNTHESIZER] Grounding validator enforced honest answer: ${validation.violations.join(', ')}`);
          return {
            answer: validation.enforcedAnswer,
            audioSpeechText: context.language === 'ml' ? validation.enforcedAnswer.ml : validation.enforcedAnswer.en,
          };
        }
      } else {
        this.logger.warn(`[LLM_SYNTHESIZER] Raw JSON or debug payload detected in LLM output. Forcing human-readable deterministic synthesis.`);
      }
    }

    // 4. Deterministic fallback formatters if Groq synthesis is unavailable or invalid
    return this.buildDeterministicSynthesis(context, evidence);
  }

  private isRawJsonOrDebugText(text: string): boolean {
    if (!text) return false;
    const trimmed = text.trim();
    if (trimmed.startsWith('Data:') || trimmed.startsWith('data:') || trimmed.startsWith('Data retrieved:')) {
      return true;
    }
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      return true;
    }
    if (trimmed.includes('"type":') || trimmed.includes('"id":') || trimmed.includes('"salesDate":') || trimmed.includes('"totalCasesProduced":')) {
      return true;
    }
    return false;
  }

  private buildDeterministicSynthesis(context: LlmSynthesisContext, evidence?: AnswerEvidence): LlmSynthesisResult {
    const { toolResults, ragChunks, language } = context;

    let mlParts: string[] = [];
    let enParts: string[] = [];

    // Format tool results
    for (const res of toolResults) {
      if (!res.success || !res.data) continue;
      const data = res.data;

      // ── FULL ERP SUMMARY ──
      if (res.tool === 'get_full_erp_summary') {
        const pLabelEn = data.period?.label?.en || 'Requested Period';
        const pLabelMl = data.period?.label?.ml || 'ആവശ്യപ്പെട്ട കാലയളവ്';

        const salesQty = Number(data.sales?.totalQuantity || 0);
        const salesTx = Number(data.sales?.transactionCount || 0);
        const returnsQty = Number(data.returns?.totalQuantity || 0);
        const damageQty = Number(data.damage?.totalQuantity || 0);
        const prodCases = Number(data.production?.totalCasesProduced || 0);
        const prodBatches = Number(data.production?.logCount || 0);
        const stockCases = Number(data.inventory?.totalCurrentStock || 0);
        const rawCount = Array.isArray(data.rawMaterials) ? data.rawMaterials.length : 0;
        const custCount = Array.isArray(data.customers) ? data.customers.length : 0;

        const ml = `📊 ${pLabelMl} — സമഗ്ര ERP റിപ്പോർട്ട്:

• വിൽപ്പന (Sales & Dispatch): ${salesQty > 0 ? `${salesQty.toLocaleString()} യൂണിറ്റുകൾ (${salesTx} ഇടപാടുകൾ)` : 'റെക്കോർഡുകൾ ഒന്നും കണ്ടെത്താനായില്ല'}
• സെയിൽസ് റിട്ടേൺ (Returns): ${returnsQty > 0 ? `${returnsQty.toLocaleString()} കേസുകൾ` : 'റെക്കോർഡുകൾ ഒന്നും കണ്ടെത്താനായില്ല'}
• ഡാമേജ് (Damage): ${damageQty > 0 ? `${damageQty.toLocaleString()} കേസുകൾ` : 'റെക്കോർഡുകൾ ഒന്നും കണ്ടെത്താനായില്ല'}
• ഉത്പാദനം (Production): ${prodCases > 0 ? `${prodCases.toLocaleString()} കേസുകൾ (${prodBatches} ലോഗുകൾ)` : 'റെക്കോർഡുകൾ ഒന്നും കണ്ടെത്താനായില്ല'}
• നിലവിലെ സ്റ്റോക്ക് (Current Inventory): ${stockCases.toLocaleString()} കേസുകൾ (ശ്രദ്ധിക്കുക: ഇത് ഇപ്പോഴത്തെ സ്റ്റോക്ക് ഇരിപ്പാണ്)
• റോ മെറ്റീരിയലുകൾ (Raw Materials): ${rawCount} എണ്ണം ട്രാക്ക് ചെയ്യുന്നു
• രജിസ്റ്റർ ചെയ്ത കസ്റ്റമേഴ്സ്: ${custCount} പേർ`;

        const en = `📊 ${pLabelEn} — Comprehensive ERP Summary:

• Sales & Dispatch: ${salesQty > 0 ? `${salesQty.toLocaleString()} units (${salesTx} transactions)` : 'No records found'}
• Sales Returns: ${returnsQty > 0 ? `${returnsQty.toLocaleString()} cases` : 'No records found'}
• Damage Records: ${damageQty > 0 ? `${damageQty.toLocaleString()} cases` : 'No records found'}
• Production Output: ${prodCases > 0 ? `${prodCases.toLocaleString()} cases across ${prodBatches} batches` : 'No records found'}
• Current Inventory: ${stockCases.toLocaleString()} cases (Note: Current stock balance)
• Raw Materials: ${rawCount} tracked items
• Registered Customers: ${custCount} active customers`;

        mlParts.push(ml);
        enParts.push(en);
      }
      // ── DAMAGE SUMMARY ──
      else if (res.tool === 'get_damage_summary') {
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
      // ── RETURN SUMMARY ──
      else if (res.tool === 'get_return_summary') {
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
      // ── SALES SUMMARY ──
      else if (res.tool === 'get_sales_summary' || res.tool === 'get_sales_by_date') {
        const qty = Number(data.totalQuantity || 0);
        const tx = Number(data.transactionCount || 0);
        const dateStr = data.period?.date || (data.period?.startDate === data.period?.endDate ? data.period?.startDate : null);
        // Use the period label returned by the tool executor (e.g. "July 2026" / "2026 ജൂലൈ")
        const pLabelEn = data.period?.label?.en || data.period?.label || 'for this period';
        const pLabelMl = data.period?.label?.ml || data.period?.labelMl || 'ഈ കാലയളവിൽ';

        if (qty === 0 && tx === 0) {
          if (dateStr) {
            mlParts.push(`${dateStr}-ന് sales records ഒന്നും കണ്ടെത്താനായില്ല.`);
            enParts.push(`No sales records were found for ${dateStr}.`);
          } else {
            mlParts.push(`${pLabelMl} sales records ഒന്നും കണ്ടെത്താനായില്ല.`);
            enParts.push(`No sales records were found ${pLabelEn.startsWith('for') ? pLabelEn : `for ${pLabelEn}`}.`);
          }
        } else {
          if (dateStr) {
            mlParts.push(`${dateStr}-ൽ ആകെ ${qty.toLocaleString()} യൂണിറ്റ് sales dispatch ചെയ്തിട്ടുണ്ട് (${tx} ഇടപാടുകൾ).`);
            enParts.push(`Total ${qty.toLocaleString()} units dispatched on ${dateStr} across ${tx} transactions.`);
          } else {
            mlParts.push(`${pLabelMl} ആകെ ${qty.toLocaleString()} യൂണിറ്റ് sales dispatch ചെയ്തിട്ടുണ്ട് (${tx} ഇടപാടുകൾ).`);
            enParts.push(`Total ${qty.toLocaleString()} units sales dispatched ${pLabelEn.startsWith('for') ? pLabelEn : `for ${pLabelEn}`} across ${tx} transactions.`);
          }
        }
      }
      // ── SALES TRANSACTIONS LIST ──
      else if (res.tool === 'get_sales_transactions') {
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
      }
      // ── PRODUCTION SUMMARY ──
      else if (res.tool === 'get_production_summary') {
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
      }
      // ── PRODUCT LIST ──
      else if (res.tool === 'list_products' || res.tool === 'get_all_products') {
        const items = Array.isArray(data) ? data : [];
        if (items.length === 0) {
          mlParts.push('സിസ്റ്റത്തിൽ registered products ഒന്നും കണ്ടെത്താനായില്ല.');
          enParts.push('No registered products found.');
        } else {
          const listStr = items.map((p: any) => `• ${p.name}: ${p.currentStock} ${p.unit || 'cases'}`).join('\n');
          mlParts.push(`ലഭ്യമായ ഉൽപ്പന്നങ്ങൾ (${items.length} എണ്ണം):\n${listStr}`);
          enParts.push(`Registered Products (${items.length} items):\n${listStr}`);
        }
      }
      // ── RAW MATERIALS LIST ──
      else if (res.tool === 'list_raw_materials' || res.tool === 'get_all_raw_materials') {
        const items = Array.isArray(data) ? data : [];
        if (items.length === 0) {
          mlParts.push('സിസ്റ്റത്തിൽ raw materials ഒന്നും കണ്ടെത്താനായില്ല.');
          enParts.push('No raw materials found.');
        } else {
          const listStr = items.map((m: any) => `• ${m.name} (${m.materialType}): ${m.currentStock} ${m.unit}`).join('\n');
          mlParts.push(`ലഭ്യമായ Raw Materials (${items.length} എണ്ണം):\n${listStr}`);
          enParts.push(`Raw Materials (${items.length} items):\n${listStr}`);
        }
      }
      // ── CUSTOMERS LIST ──
      else if (res.tool === 'list_customers' || res.tool === 'get_all_customers') {
        const items = Array.isArray(data) ? data : [];
        if (items.length === 0) {
          mlParts.push('കസ്റ്റമർ റെക്കോർഡുകൾ ഒന്നും കണ്ടെത്താനായില്ല.');
          enParts.push('No customer records found.');
        } else {
          const listStr = items.map((c: any) => `• ${c.name} (Balance: ₹${Number(c.outstandingBalance || 0).toLocaleString()})`).join('\n');
          mlParts.push(`രജിസ്റ്റർ ചെയ്ത കസ്റ്റമേഴ്സ് (${items.length} പേർ):\n${listStr}`);
          enParts.push(`Registered Customers (${items.length}):\n${listStr}`);
        }
      }
      // ── VENDORS LIST ──
      else if (res.tool === 'list_vendors' || res.tool === 'list_suppliers') {
        const items = Array.isArray(data) ? data : [];
        if (items.length === 0) {
          mlParts.push('സപ്ലയർ റെക്കോർഡുകൾ ഒന്നും കണ്ടെത്താനായില്ല.');
          enParts.push('No supplier/vendor records found.');
        } else {
          const listStr = items.map((v: any) => `• ${v.name}`).join('\n');
          mlParts.push(`രജിസ്റ്റർ ചെയ്ത Suppliers (${items.length} പേർ):\n${listStr}`);
          enParts.push(`Registered Suppliers (${items.length}):\n${listStr}`);
        }
      }
      // ── CUSTOMER PROFILE & BALANCE ──
      else if (res.tool === 'get_customer_profile') {
        const name = data.customer?.name || data.name || 'Customer';
        const bal = data.financials?.estimatedOutstanding ?? data.outstandingBalance ?? 0;
        mlParts.push(`കസ്റ്റമർ: ${name}. നിലവിലെ കുടിശ്ശിക: ₹${Number(bal).toLocaleString()}.`);
        enParts.push(`Customer: ${name}. Current Outstanding Balance: ₹${Number(bal).toLocaleString()}.`);
      } else if (res.tool === 'get_customer_balance') {
        const name = data.customer?.name || data.name || 'Customer';
        const bal = Number(data.financials?.estimatedOutstanding ?? data.outstandingBalance ?? 0).toLocaleString();
        mlParts.push(`${name}-ന്റെ നിലവിലെ കുടിശ്ശിക ₹${bal} ആണ്.`);
        enParts.push(`${name}'s current outstanding balance is ₹${bal}.`);
      }
      // ── PRODUCT STOCK ──
      else if (res.tool === 'get_product_stock' || res.tool === 'get_finished_goods_stock') {
        if (data.material) {
          const name = data.material.name || 'Material';
          const stock = Number(data.material.currentStock ?? 0);
          const unit = data.material.unit || 'units';
          mlParts.push(`${name} നിലവിൽ ${stock} ${unit} സ്റ്റോക്കിലുണ്ട്.`);
          enParts.push(`${name} currently has ${stock} ${unit} in stock.`);
        } else {
          const totalCases = Number(data.inventory?.currentStockCases ?? data.totalCurrentStock ?? data.currentStock ?? 0).toLocaleString();
          mlParts.push(`നിലവിൽ ആകെ ${totalCases} കേസുകൾ സ്റ്റോക്കിലുണ്ട്.`);
          enParts.push(`Current stock is ${totalCases} cases.`);
        }
      }
      // ── RAW MATERIAL STOCK ──
      else if (res.tool === 'get_raw_material_stock') {
        const name = data.material?.name || data.name || 'Material';
        const stock = Number(data.material?.currentStock ?? data.currentStock ?? 0);
        const unit = data.material?.unit || data.unit || 'units';
        mlParts.push(`${name} നിലവിൽ ${stock} ${unit} സ്റ്റോക്കിലുണ്ട്.`);
        enParts.push(`${name} currently has ${stock} ${unit} in stock.`);
      } else {
        mlParts.push('വിവരങ്ങൾ വിജയകരമായി വീണ്ടെടുത്തു.');
        enParts.push('Information retrieved successfully.');
      }
    }

    // Format RAG chunks
    if (ragChunks && ragChunks.length > 0) {
      const topChunk = ragChunks[0];
      mlParts.push(`\n📚 ${topChunk.title}:\n${topChunk.content}`);
      enParts.push(`\n📚 ${topChunk.title}:\n${topChunk.content}`);
    }

    const finalMl = mlParts.join('\n\n') || 'ക്ഷമിക്കണം, ആവശ്യപ്പെട്ട വിവരങ്ങൾ ലഭ്യമായില്ല.';
    const finalEn = enParts.join('\n\n') || 'Sorry, no authoritative information found.';

    return {
      answer: {
        ml: finalMl,
        en: finalEn,
      },
      audioSpeechText: language === 'ml' ? finalMl.split('\n')[0] : finalEn.split('\n')[0],
    };
  }
}
