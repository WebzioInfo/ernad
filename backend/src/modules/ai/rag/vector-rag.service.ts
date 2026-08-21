import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { db } from '../../../database/db';
import { sql } from 'drizzle-orm';
import { GroqLlmService } from '../llm/groq-llm.service';

export interface VectorChunk {
  id: string;
  title: string;
  category: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

export interface VectorSearchResult {
  chunk: VectorChunk;
  similarity: number;
}

@Injectable()
export class VectorRagService implements OnModuleInit {
  private readonly logger = new Logger(VectorRagService.name);
  private vectorStore: VectorChunk[] = [];

  constructor(private readonly groqLlmService: GroqLlmService) {}

  async onModuleInit() {
    await this.initializeKnowledgeBase();
  }

  /**
   * Initializes the in-memory vector index with embedded ERP documents and SOPs
   */
  async initializeKnowledgeBase() {
    this.logger.log('[VECTOR_RAG] Initializing ERP Vector Knowledge Base...');

    const baseDocuments = [
      {
        id: 'doc-sales-dispatch',
        title: 'Sales Dispatch & Delivery Operations',
        category: 'sales',
        content: `Sales Dispatch represents finished beverage products loaded and shipped to customers.
In Kenby ERP, sales quantity is recorded upon dispatch transaction confirmation.
Sales transactions reduce finished goods inventory in the warehouse.
Payment tracking is handled separately in the customer ledger and credit system.
Malayalam: Sales Dispatch എന്നത് കസ്റ്റമർക്ക് അയച്ച ഫിനിഷ്ഡ് ഗുഡ്സ് ആണ്. Sales dispatch സ്റ്റോക്ക് കുറയ്ക്കും.`,
      },
      {
        id: 'doc-sales-return',
        title: 'Sales Return & Credit Memo Policy',
        category: 'sales',
        content: `Sales Return represents products returned by customers due to rejection, expiration, or delivery refusal.
Sales returns are logged as distinct return transactions and must not be counted as new sales.
Returned goods are inspected before being classified as return-to-stock or damaged goods.
Malayalam: Sales Return എന്നത് കസ്റ്റമർ തിരികെ നൽകിയ ഉൽപ്പന്നങ്ങളാണ്. ഇത് പുതിയ സെയിൽസ് ആയി കണക്കാക്കില്ല.`,
      },
      {
        id: 'doc-production-overview',
        title: 'Factory Production & Batch Tracking',
        category: 'production',
        content: `Production represents finished goods produced on the plant bottling and packaging lines.
Each production run logs output quantity, batch number, production date, and station efficiency.
Production batches automatically increase finished goods inventory.
Malayalam: Production എന്നത് ഫാക്ടറിയിൽ നിർമ്മിച്ച ഉൽപ്പന്നങ്ങളാണ്. ഇത് ഫിനിഷ്ഡ് ഗുഡ്സ് സ്റ്റോക്ക് വർദ്ധിപ്പിക്കും.`,
      },
      {
        id: 'doc-inventory-stock',
        title: 'Finished Goods Inventory Calculation',
        category: 'inventory',
        content: `Finished goods stock is the net available quantity of bottled products ready for delivery.
Stock Formula: Initial Stock + Production Output - Sales Dispatches - Recorded Damages.
Current warehouse inventory is tracked per SKU (e.g. Kenby 1, Kenby 500ml).
Malayalam: Finished Goods Stock എന്നത് നിലവിൽ ഫാക്ടറിയിലുള്ള ലഭ്യമായ ഉൽപ്പന്നങ്ങളുടെ അളവാണ്.`,
      },
      {
        id: 'doc-damage-recording',
        title: 'Damaged Goods & Spoilage Classification',
        category: 'inventory',
        content: `Damaged goods include broken bottles, leaking packages, or factory defects during handling.
Damage records are deducted from available stock and logged under scrap/loss accounts.
Damage is distinct from customer returns.
Malayalam: Damage എന്നത് കേടായ ഉൽപ്പന്നങ്ങളാണ്. ഇത് സ്റ്റോക്കിൽ നിന്ന് കുറയ്ക്കപ്പെടും.`,
      },
      {
        id: 'doc-raw-materials',
        title: 'Raw Material Procurement & Consumption',
        category: 'raw_materials',
        content: `Raw materials consist of bottle preforms, caps (e.g. Green Cap, Blue Cap), labels, and packaging film.
Raw materials are consumed during production and replenished via Goods Receipt Notes (GRN).
Stock balances reflect net physical inventory in material stores.
Malayalam: Raw Materials എന്നത് ക്യാപ്, പ്രീഫോം, ലേബൽ എന്നിവയാണ്.`,
      },
      {
        id: 'doc-customer-credit',
        title: 'Customer Credit & Outstanding Ledger',
        category: 'customers',
        content: `Customer balance represents the net outstanding debt owed by a distributor or retailer.
Sales dispatches increase the customer's balance (debit). Payment collections decrease the balance (credit).
Credit limits restrict dispatch authorization if overdue thresholds are exceeded.
Malayalam: Customer balance എന്നത് കസ്റ്റമർ നൽകാനുള്ള കുടിശ്ശികയാണ്.`,
      },
    ];

    // Embed all base documents
    for (const doc of baseDocuments) {
      const embedding = await this.groqLlmService.generateEmbedding(`${doc.title} ${doc.content}`);
      this.vectorStore.push({
        ...doc,
        embedding,
      });
    }

    // Try loading custom documents from PostgreSQL if available
    try {
      const dbDocs = (await db.execute(sql`SELECT id, title, category, content FROM public.kenby_ai_documents`).catch(() => [])) as any[];
      if (Array.isArray(dbDocs)) {
        for (const row of dbDocs) {
          if (!this.vectorStore.some((v) => v.id === String(row.id))) {
            const embedding = await this.groqLlmService.generateEmbedding(`${row.title} ${row.content}`);
            this.vectorStore.push({
              id: String(row.id),
              title: String(row.title),
              category: String(row.category),
              content: String(row.content),
              embedding,
            });
          }
        }
      }
    } catch (err: any) {
      this.logger.debug(`[VECTOR_RAG] DB document table check: ${err.message}`);
    }

    this.logger.log(`[VECTOR_RAG] Vector index ready with ${this.vectorStore.length} embedded documents.`);
  }

  /**
   * Performs dense vector similarity search over embedded knowledge chunks
   */
  async searchSimilar(query: string, topK: number = 3, threshold: number = 0.25): Promise<VectorSearchResult[]> {
    this.logger.log(`[VECTOR_RAG] Searching semantic similarity for: "${query}" (topK=${topK})`);

    const queryVec = await this.groqLlmService.generateEmbedding(query);

    const scored: VectorSearchResult[] = this.vectorStore.map((chunk) => {
      const similarity = this.cosineSimilarity(queryVec, chunk.embedding);
      return { chunk, similarity };
    });

    // Sort descending by cosine similarity
    scored.sort((a, b) => b.similarity - a.similarity);

    const results = scored.filter((r) => r.similarity >= threshold).slice(0, topK);

    this.logger.log(
      `[VECTOR_RAG] Found ${results.length} matches. Top match: "${results[0]?.chunk.title}" (score: ${results[0]?.similarity.toFixed(3)})`
    );

    return results;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}
