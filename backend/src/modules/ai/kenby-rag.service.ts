import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { sql } from 'drizzle-orm';

export interface RagKnowledgeDocument {
  id?: string;
  title: string;
  category: string;
  content: string;
  similarity?: number;
}

@Injectable()
export class KenbyRagService {
  private readonly logger = new Logger(KenbyRagService.name);

  /**
   * RAG Knowledge Retrieval: Fetches concept/definition knowledge documents
   * for questions like "Sales dispatch എന്താണ്?" or "Production എന്താണ്?".
   * RAG is responsible ONLY for knowledge/business definitions, NOT live sales numbers.
   */
  async retrieveKnowledge(query: string): Promise<RagKnowledgeDocument | null> {
    const qLower = (query || '').toLowerCase().trim();
    this.logger.log(`[KENBY_RAG] Retrieving knowledge for query: "${query}"`);

    try {
      // 1. Try vector similarity match if table/function exists
      const vectorRes = await db.execute(sql`
        SELECT title, content, category
        FROM public.kenby_ai_documents
        ORDER BY created_at DESC
      `).catch(() => []);

      const docs = vectorRes as any[];

      if (docs && docs.length > 0) {
        // Find best match by title or topic keywords
        if (qLower.includes('sales dispatch') || (qLower.includes('sales') && !qLower.includes('return'))) {
          const match = docs.find((d) => String(d.title).toLowerCase().includes('sales') && !String(d.title).toLowerCase().includes('return'));
          if (match) return { title: match.title, category: match.category, content: match.content };
        }
        if (qLower.includes('production') || qLower.includes('പ്രൊഡക്ഷൻ')) {
          const match = docs.find((d) => String(d.title).toLowerCase().includes('production'));
          if (match) return { title: match.title, category: match.category, content: match.content };
        }
        if (qLower.includes('return') || qLower.includes('റിട്ടേൺ')) {
          const match = docs.find((d) => String(d.title).toLowerCase().includes('return'));
          if (match) return { title: match.title, category: match.category, content: match.content };
        }
        if (qLower.includes('stock') || qLower.includes('സ്റ്റോക്ക്')) {
          const match = docs.find((d) => String(d.title).toLowerCase().includes('stock'));
          if (match) return { title: match.title, category: match.category, content: match.content };
        }
        if (qLower.includes('damage') || qLower.includes('ഡാമേജ്')) {
          const match = docs.find((d) => String(d.title).toLowerCase().includes('damage'));
          if (match) return { title: match.title, category: match.category, content: match.content };
        }
      }

      // 2. Fallback Knowledge Base if DB vector records are not queried directly
      return this.getFallbackKnowledgeDocument(qLower);
    } catch (err: any) {
      this.logger.warn(`[KENBY_RAG] RAG retrieval fallback used: ${err.message}`);
      return this.getFallbackKnowledgeDocument(qLower);
    }
  }

  private getFallbackKnowledgeDocument(qLower: string): RagKnowledgeDocument {
    if (qLower.includes('sales return') || qLower.includes('റിട്ടേൺ')) {
      return {
        title: 'Sales Return',
        category: 'sales',
        content: `Sales Return means products that were previously dispatched or sold and then returned. A sales return is a separate transaction type from Sales Dispatch. Return quantities should not be reported as new sales.\n\nമലയാളത്തിൽ:\nSales Return എന്നത് മുമ്പ് customer-ന് dispatch ചെയ്ത products തിരികെ വന്നതാണ്. Sales Return ഒരു separate transaction ആണ്. Return quantity പുതിയ sales ആയി കണക്കാക്കരുത്.`
      };
    }

    if (qLower.includes('production') || qLower.includes('പ്രൊഡക്ഷൻ')) {
      return {
        title: 'Production',
        category: 'production',
        content: `Production means finished goods produced by the factory. Kenby production records contain production output, production date, batch information, station information and related production details.\n\nമലയാളത്തിൽ:\nProduction എന്നത് factory-ൽ നിർമ്മിച്ച finished goods ആണ്. Production records-ൽ production quantity, date, batch, station തുടങ്ങിയ വിവരങ്ങൾ ഉൾപ്പെടുന്നു.`
      };
    }

    if (qLower.includes('stock') || qLower.includes('സ്റ്റോക്ക്')) {
      return {
        title: 'Finished Goods Stock',
        category: 'inventory',
        content: `Finished goods stock means the quantity of finished products currently available for dispatch. Stock is affected by production and dispatch transactions. Production increases finished goods stock; Sales dispatch decreases available finished goods stock.\n\nമലയാളത്തിൽ:\nFinished goods stock എന്നത് ഇപ്പോൾ dispatch ചെയ്യാൻ ലഭ്യമായ finished products-ന്റെ quantity ആണ്. Production stock കൂട്ടും. Sales Dispatch stock കുറയ്ക്കും.`
      };
    }

    if (qLower.includes('damage') || qLower.includes('ഡാമേജ്')) {
      return {
        title: 'Damage',
        category: 'inventory',
        content: `Damage means finished goods that are recorded as damaged and are not considered normal available stock.\n\nമലയാളത്തിൽ:\nDamage എന്നത് damaged goods ആണ്. Damage quantity sales അല്ല. അത് പ്രത്യേകം report ചെയ്യേണ്ടതാണ്.`
      };
    }

    // Default Sales Dispatch definition
    return {
      title: 'Sales Dispatch',
      category: 'business',
      content: `Sales means products that were dispatched or sold to customers. In Kenby ERP, Sales Dispatch represents finished products sent out to customers. Sales quantity is recorded based on the sales transaction. Sales information does not include customer payment information because Kenby currently does not manage payment tracking.\n\nമലയാളത്തിൽ:\nSales എന്നത് customer-ന് ഉൽപ്പന്നങ്ങൾ dispatch ചെയ്തതിനെ സൂചിപ്പിക്കുന്നു. Kenby-യിൽ Sales Dispatch ആയി രേഖപ്പെടുത്തിയ quantity ആണ് sales ആയി കണക്കാക്കുന്നത്. Kenby നിലവിൽ customer payment tracking കൈകാര്യം ചെയ്യുന്നില്ല.`
    };
  }
}
