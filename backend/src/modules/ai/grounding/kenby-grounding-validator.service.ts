import { Injectable, Logger } from '@nestjs/common';
import { AnswerEvidence, GroundingValidationResult } from './kenby-grounding.interface';

@Injectable()
export class KenbyGroundingValidatorService {
  private readonly logger = new Logger(KenbyGroundingValidatorService.name);

  /**
   * Strictly validates that the generated answer is 100% grounded in verified AnswerEvidence.
   * If any ungrounded numbers or zero-data violations are detected, rejects or enforces factual replacement.
   */
  validateAnswer(
    answer: { ml: string; en: string },
    evidence?: AnswerEvidence
  ): GroundingValidationResult {
    if (!evidence) {
      return { isValid: true, violations: [] };
    }

    const violations: string[] = [];

    // 1. ZERO-DATA HONESTY ENFORCEMENT
    if (evidence.source === 'DATABASE' || evidence.source === 'DATABASE_AND_RAG') {
      const isZeroRecords = evidence.recordCount === 0;
      const isZeroQuantity = this.isZeroTotalQuantity(evidence.resultData);

      if (isZeroRecords || isZeroQuantity) {
        const textToCheck = `${answer.ml} ${answer.en}`.toLowerCase();

        // If the DB returned 0 records for a specific date, but the answer claims positive sales
        const numbersInAnswer = this.extractNumbersFromText(textToCheck);
        const nonZeroNumbers = numbersInAnswer.filter(
          (n) => n !== 0 && !this.isAllowedDateComponent(n, evidence)
        );

        if (nonZeroNumbers.length > 0 && isZeroRecords) {
          violations.push(
            `ZERO_DATA_VIOLATION: Database has 0 records, but answer contained positive numbers: ${nonZeroNumbers.join(', ')}`
          );

          const dateLabel = evidence.queryPeriod?.exactDate || evidence.queryPeriod?.label || 'ആവശ്യപ്പെട്ട കാലയളവിൽ';
          const dateLabelEn = evidence.queryPeriod?.exactDate || evidence.queryPeriod?.label || 'the requested period';

          return {
            isValid: false,
            violations,
            enforcedAnswer: {
              ml: `${dateLabel}-ൽ റെക്കോർഡുകൾ ഒന്നും കണ്ടെത്താനായില്ല (0 transactions).`,
              en: `No records were found for ${dateLabelEn} (0 transactions).`,
            },
          };
        }
      }
    }

    // 2. NUMBER GROUNDING VALIDATION
    if (evidence.source === 'DATABASE' && evidence.extractedNumbers.length > 0) {
      const numbersInMl = this.extractNumbersFromText(answer.ml);
      const numbersInEn = this.extractNumbersFromText(answer.en);
      const allAnswerNumbers = Array.from(new Set([...numbersInMl, ...numbersInEn]));

      const allowedNumbers = new Set(evidence.extractedNumbers);

      for (const num of allAnswerNumbers) {
        if (num === 0 || this.isAllowedDateComponent(num, evidence)) {
          continue;
        }

        if (!allowedNumbers.has(num)) {
          violations.push(`UNGROUNDED_NUMBER: Answer contained number ${num} which is absent from verified tool evidence.`);
        }
      }
    }

    if (violations.length > 0) {
      this.logger.warn(`[KENBY_GROUNDING] Validation failed with ${violations.length} violations:\n${violations.join('\n')}`);
      return {
        isValid: false,
        violations,
      };
    }

    return { isValid: true, violations: [] };
  }

  /**
   * Recursively extracts all numerical values from tool result data into a flat set
   */
  public extractNumbersFromData(data: any): number[] {
    const nums = new Set<number>();

    const traverse = (obj: any) => {
      if (obj === null || obj === undefined) return;
      if (typeof obj === 'number' && !isNaN(obj)) {
        nums.add(obj);
        return;
      }
      if (typeof obj === 'string') {
        const parsed = Number(obj);
        if (!isNaN(parsed) && obj.trim().length > 0 && !obj.includes('-') && !obj.includes(':')) {
          nums.add(parsed);
        }
        return;
      }
      if (Array.isArray(obj)) {
        for (const item of obj) traverse(item);
        return;
      }
      if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
          traverse(obj[key]);
        }
      }
    };

    traverse(data);
    return Array.from(nums);
  }

  private extractNumbersFromText(text: string): number[] {
    if (!text) return [];
    // Remove formatting commas between digits e.g. "1,000" -> "1000"
    const normalized = text.replace(/(\d+),(\d+)/g, '$1$2');
    const matches = normalized.match(/\b\d+(\.\d+)?\b/g);
    if (!matches) return [];

    return matches.map((m) => Number(m)).filter((n) => !isNaN(n));
  }

  private isZeroTotalQuantity(resultData: any): boolean {
    if (!resultData) return true;
    if (resultData.totalQuantity !== undefined && Number(resultData.totalQuantity) === 0) return true;
    if (resultData.totalCases !== undefined && Number(resultData.totalCases) === 0) return true;
    if (resultData.currentStock !== undefined && Number(resultData.currentStock) === 0) return true;
    return false;
  }

  private isAllowedDateComponent(num: number, evidence: AnswerEvidence): boolean {
    // Years: 2024, 2025, 2026, 2027
    if (num >= 2020 && num <= 2030) return true;
    // Months: 1 to 12
    if (num >= 1 && num <= 12) return true;
    // Days of month: 1 to 31
    if (num >= 1 && num <= 31) return true;

    // Check if number is in queryPeriod string bounds
    if (evidence.queryPeriod?.exactDate?.includes(String(num))) return true;
    if (evidence.queryPeriod?.startDate?.includes(String(num))) return true;
    if (evidence.queryPeriod?.endDate?.includes(String(num))) return true;

    return false;
  }
}
