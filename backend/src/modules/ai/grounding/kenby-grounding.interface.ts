export interface AnswerEvidence {
  source: 'DATABASE' | 'RAG' | 'DATABASE_AND_RAG' | 'UNSUPPORTED' | 'CLARIFICATION';
  toolsExecuted: string[];
  queryPeriod?: {
    type: string;
    startDate?: string;
    endDate?: string;
    exactDate?: string;
    label?: string;
  };
  entities: Array<{
    type: string;
    id?: string;
    name: string;
    matchConfidence: number;
  }>;
  recordCount: number;
  transactionIds?: string[];
  extractedNumbers: number[];
  resultData: any;
  isValidated: boolean;
}

export interface GroundingValidationResult {
  isValid: boolean;
  violations: string[];
  enforcedAnswer?: {
    ml: string;
    en: string;
  };
}
