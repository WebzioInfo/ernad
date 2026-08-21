import { Injectable, Logger } from '@nestjs/common';
import { BusinessSnapshotResult } from './kenby-live-data.service';

export interface LocalizedText {
  ml: string;
  en: string;
}

export interface KenbyProactiveInsight {
  id: string;
  type:
    | 'sales_increase'
    | 'sales_decrease'
    | 'production_gap'
    | 'high_returns'
    | 'damage'
    | 'low_stock'
    | 'high_stock'
    | 'production_increase'
    | 'production_decrease'
    | 'attention';
  severity: 'info' | 'warning' | 'important';
  title: LocalizedText;
  message: LocalizedText;
  text: LocalizedText; // Backward compatibility for UI
  data?: {
    current?: number;
    previous?: number;
    difference?: number;
    percentage?: number;
    unit?: string;
  };
  reason: string;
}

@Injectable()
export class KenbyProactiveInsightService {
  private readonly logger = new Logger(KenbyProactiveInsightService.name);

  /**
   * Deterministic Business Rule Engine for Proactive Owner Intelligence.
   * Evaluates single-source-of-truth business snapshot and produces ranked insights.
   */
  generateProactiveInsights(snapshot: BusinessSnapshotResult): KenbyProactiveInsight[] {
    const rawInsights: KenbyProactiveInsight[] = [];
    const salesQty = snapshot.sales.quantity;
    const prodCases = snapshot.production.casesProduced;
    const returnQty = snapshot.returns.quantity;
    const damageQty = snapshot.damage.quantity;
    const stockTotal = snapshot.stock.totalCurrentStock;
    const comp = snapshot.comparison;

    // 1. HIGH RETURNS RULE (Highest Priority Warning / Important)
    if (returnQty > salesQty && returnQty > 0) {
      rawInsights.push({
        id: 'ins_high_returns',
        type: 'high_returns',
        severity: 'important',
        title: {
          ml: 'Returns ശ്രദ്ധിക്കുക',
          en: 'Review Sales Returns',
        },
        message: {
          ml: `ഈ കാലയളവിൽ ${returnQty.toLocaleString('en-IN')} cases returns ആയി രേഖപ്പെടുത്തിയിട്ടുണ്ട്. ഇത് ഈ കാലയളവിലെ sales dispatch-നേക്കാൾ കൂടുതലാണ്. Return records പരിശോധിക്കുന്നത് നല്ലതാണ്.`,
          en: `${returnQty.toLocaleString()} cases were recorded as returns during this period. This is higher than the sales dispatch recorded during the same period. It may be useful to review the return records.`,
        },
        text: {
          ml: `Returns ഈ കാലയളവിലെ sales dispatch-നേക്കാൾ കൂടുതലായി (${returnQty.toLocaleString('en-IN')} cases) രേഖപ്പെടുത്തിയിട്ടുണ്ട്. Return records പരിശോധിക്കുന്നത് നല്ലതാണ്.`,
          en: `Returns (${returnQty.toLocaleString()} cases) exceed sales dispatches during this period. Review return records.`,
        },
        data: {
          current: returnQty,
          difference: returnQty - salesQty,
          unit: 'cases',
        },
        reason: 'returns_quantity > current_sales_quantity',
      });
    } else if (returnQty > 0) {
      rawInsights.push({
        id: 'ins_returns_info',
        type: 'high_returns',
        severity: 'warning',
        title: {
          ml: 'Sales Returns',
          en: 'Sales Returns',
        },
        message: {
          ml: `ഈ കാലയളവിൽ ${returnQty.toLocaleString('en-IN')} cases sales return രേഖപ്പെടുത്തിയിട്ടുണ്ട്.`,
          en: `${returnQty.toLocaleString()} cases of sales returns were recorded for this period.`,
        },
        text: {
          ml: `${returnQty.toLocaleString('en-IN')} cases sales return രേഖപ്പെടുത്തിയിട്ടുണ്ട്.`,
          en: `${returnQty.toLocaleString()} cases of sales returns recorded.`,
        },
        data: { current: returnQty, unit: 'cases' },
        reason: 'returns_quantity > 0',
      });
    }

    // 2. DAMAGE RULE
    if (damageQty > 0) {
      rawInsights.push({
        id: 'ins_damage',
        type: 'damage',
        severity: 'warning',
        title: {
          ml: 'Damage രേഖപ്പെടുത്തിയിട്ടുണ്ട്',
          en: 'Damage Recorded',
        },
        message: {
          ml: `ഈ മാസം ${damageQty.toLocaleString('en-IN')} cases damage ആയി രേഖപ്പെടുത്തിയിട്ടുണ്ട്.`,
          en: `${damageQty.toLocaleString()} cases were recorded as damaged stock for this period.`,
        },
        text: {
          ml: `${damageQty.toLocaleString('en-IN')} cases damage ആയി രേഖപ്പെടുത്തിയിട്ടുണ്ട്.`,
          en: `${damageQty.toLocaleString()} cases recorded as damaged stock.`,
        },
        data: { current: damageQty, unit: 'cases' },
        reason: 'damage_quantity > 0',
      });
    }

    // 3. SALES TREND RULE (MONTH-OVER-MONTH COMPARISON)
    if (comp) {
      const salesDiff = comp.salesChangeQuantity;
      const salesPct = comp.salesChangePercent;

      if (salesDiff > 0) {
        const prevSales = comp.previousPeriod ? salesQty - salesDiff : 0;
        rawInsights.push({
          id: 'ins_sales_increase',
          type: 'sales_increase',
          severity: 'info',
          title: {
            ml: 'Sales വർദ്ധനവ്',
            en: 'Sales Increased',
          },
          message: {
            ml: `ഈ മാസം sales കഴിഞ്ഞ മാസത്തേക്കാൾ ${salesDiff.toLocaleString('en-IN')} cases കൂടുതലാണ്.`,
            en: `Sales are ${salesDiff.toLocaleString()} cases higher than last month.`,
          },
          text: {
            ml: `Sales കഴിഞ്ഞ മാസത്തേക്കാൾ (${comp.previousPeriod.label}) ${salesDiff.toLocaleString('en-IN')} cases കൂടുതലാണ് (${salesPct !== null ? '+' + salesPct + '%' : ''}).`,
            en: `Sales increased by ${salesDiff.toLocaleString()} cases compared to ${comp.previousPeriod.label}.`,
          },
          data: {
            current: salesQty,
            previous: prevSales,
            difference: salesDiff,
            percentage: salesPct || undefined,
            unit: 'cases',
          },
          reason: 'current_sales > previous_sales',
        });
      } else if (salesDiff < 0) {
        const absDiff = Math.abs(salesDiff);
        const absPct = salesPct !== null ? Math.abs(salesPct) : 0;
        const isSignificantDecrease = absPct > 30;

        rawInsights.push({
          id: 'ins_sales_decrease',
          type: 'sales_decrease',
          severity: isSignificantDecrease ? 'warning' : 'info',
          title: {
            ml: 'Sales കുറഞ്ഞിട്ടുണ്ട്',
            en: 'Sales Decreased',
          },
          message: {
            ml: `ഈ മാസം sales കഴിഞ്ഞ മാസത്തേക്കാൾ ${absDiff.toLocaleString('en-IN')} cases കുറഞ്ഞിട്ടുണ്ട്.`,
            en: `Sales are ${absDiff.toLocaleString()} cases lower than last month.`,
          },
          text: {
            ml: `Sales കഴിഞ്ഞ മാസത്തേക്കാൾ (${comp.previousPeriod.label}) ${absDiff.toLocaleString('en-IN')} cases കുറഞ്ഞിട്ടുണ്ട്.`,
            en: `Sales decreased by ${absDiff.toLocaleString()} cases compared to ${comp.previousPeriod.label}.`,
          },
          data: {
            current: salesQty,
            difference: absDiff,
            percentage: absPct,
            unit: 'cases',
          },
          reason: 'current_sales < previous_sales',
        });
      }
    }

    // 4. PRODUCTION VS SALES GAP RULE
    if (prodCases > 0 && salesQty > 0 && prodCases !== salesQty) {
      const gap = Math.abs(prodCases - salesQty);

      if (prodCases > salesQty) {
        rawInsights.push({
          id: 'ins_prod_higher_than_sales',
          type: 'production_gap',
          severity: 'info',
          title: {
            ml: 'Production vs Sales',
            en: 'Production vs Sales Gap',
          },
          message: {
            ml: `ഈ മാസം production sales-നേക്കാൾ ${gap.toLocaleString('en-IN')} cases കൂടുതലാണ്.`,
            en: `Production output is ${gap.toLocaleString()} cases higher than sales dispatch.`,
          },
          text: {
            ml: `Production sales-നേക്കാൾ ${gap.toLocaleString('en-IN')} cases കൂടുതലാണ്.`,
            en: `Production is ${gap.toLocaleString()} cases higher than sales dispatch.`,
          },
          data: {
            current: prodCases,
            previous: salesQty,
            difference: gap,
            unit: 'cases',
          },
          reason: 'production_cases > sales_cases',
        });
      } else {
        rawInsights.push({
          id: 'ins_sales_higher_than_prod',
          type: 'production_gap',
          severity: 'info',
          title: {
            ml: 'Sales vs Production',
            en: 'Sales vs Production Gap',
          },
          message: {
            ml: `ഈ മാസം sales production-നേക്കാൾ ${gap.toLocaleString('en-IN')} cases കൂടുതലാണ്.`,
            en: `Sales dispatch is ${gap.toLocaleString()} cases higher than production output.`,
          },
          text: {
            ml: `Sales dispatch production-നേക്കാൾ ${gap.toLocaleString('en-IN')} cases കൂടുതലാണ്.`,
            en: `Sales dispatch is ${gap.toLocaleString()} cases higher than production output.`,
          },
          data: {
            current: salesQty,
            previous: prodCases,
            difference: gap,
            unit: 'cases',
          },
          reason: 'sales_cases > production_cases',
        });
      }
    }

    // 5. CURRENT STOCK FACTUAL OBSERVATION (Rule 7: No DB threshold exists, report stock count cleanly)
    if (stockTotal > 0) {
      rawInsights.push({
        id: 'ins_current_stock',
        type: 'high_stock',
        severity: 'info',
        title: {
          ml: 'നിലവിലെ Stock',
          en: 'Current Stock',
        },
        message: {
          ml: `നിലവിൽ ആകെ ${stockTotal.toLocaleString('en-IN')} cases stock ലഭ്യമാണ്.`,
          en: `Currently a total of ${stockTotal.toLocaleString()} cases are available in stock.`,
        },
        text: {
          ml: `Stock-ൽ ആകെ ${stockTotal.toLocaleString('en-IN')} cases ലഭ്യമാണ്.`,
          en: `Stock holds a total of ${stockTotal.toLocaleString()} available cases.`,
        },
        data: { current: stockTotal, unit: 'cases' },
        reason: 'no_db_threshold_reporting_current_stock',
      });
    }

    // 6. FALLBACK IF NO INSIGHTS GENERATED
    if (rawInsights.length === 0) {
      rawInsights.push({
        id: 'ins_no_observations',
        type: 'attention',
        severity: 'info',
        title: {
          ml: 'ശ്രദ്ധിക്കേണ്ട കാര്യങ്ങൾ',
          en: 'Business Observation',
        },
        message: {
          ml: 'ഈ മാസം പ്രത്യേകമായി ശ്രദ്ധിക്കേണ്ട മാറ്റങ്ങളൊന്നും കണ്ടെത്തിയിട്ടില്ല.',
          en: 'No special changes requiring attention detected for this period.',
        },
        text: {
          ml: 'ഈ മാസം പ്രത്യേകമായി ശ്രദ്ധിക്കേണ്ട മാറ്റങ്ങളൊന്നും കണ്ടെത്തിയിട്ടില്ല.',
          en: 'No special changes requiring attention detected for this period.',
        },
        reason: 'no_anomalies_detected',
      });
    }

    // 7. RANK AND PRIORITIZE INSIGHTS (Important > Warning > Info)
    const severityMap: Record<string, number> = {
      important: 1,
      warning: 2,
      info: 3,
    };

    rawInsights.sort((a, b) => {
      const pA = severityMap[a.severity] || 3;
      const pB = severityMap[b.severity] || 3;
      return pA - pB;
    });

    // Maximum 4 owner-facing insights
    return rawInsights.slice(0, 4);
  }
}
