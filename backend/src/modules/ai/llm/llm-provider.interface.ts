/**
 * KENBY AI: LLM PROVIDER ABSTRACTION INTERFACE
 */

export interface LlmTask {
  tool: string;
  parameters: Record<string, any>;
}

export interface LlmPlan {
  thought: string;
  requiresLiveData: boolean;
  requiresKnowledge: boolean;
  tasks: LlmTask[];
  isUnsupportedFinancial: boolean;
  clarificationNeeded: boolean;
  clarificationMessage: {
    ml: string;
    en: string;
  } | null;
}

export interface LlmSynthesisContext {
  question: string;
  language: 'ml' | 'en';
  conversationContext?: any;
  toolResults: Array<{
    tool: string;
    parameters: any;
    data: any;
    success?: boolean;
    error?: string;
  }>;
  ragChunks: Array<{
    title: string;
    content: string;
    score?: number;
  }>;
}

export interface LlmSynthesisResult {
  answer: {
    ml: string;
    en: string;
  };
  audioSpeechText?: string;
}

export interface LlmProvider {
  /**
   * Health check verifying API connectivity and credentials
   */
  checkHealth(): Promise<{ ok: boolean; provider: string; model: string }>;

  /**
   * Generates a structured tool & RAG execution plan from user natural language query
   */
  generatePlan(
    userQuestion: string,
    conversationContext?: any,
    availableTools?: any[]
  ): Promise<LlmPlan>;

  /**
   * Synthesizes natural factual bilingual response grounded in tool data and vector RAG chunks
   */
  synthesizeAnswer(context: LlmSynthesisContext): Promise<LlmSynthesisResult>;

  /**
   * Generates dense vector embedding for semantic search
   */
  generateEmbedding(text: string): Promise<number[]>;
}
