import { Injectable, Logger } from '@nestjs/common';
import {
  KenbyLiveDataService,
  SalesSummaryPeriodInput,
  SalesSummaryResult,
  ProductionSummaryResult,
  CurrentStockResult,
  SalesBreakdownResult,
  BusinessSnapshotResult,
} from './kenby-live-data.service';

export interface LocalizedText {
  ml: string;
  en: string;
}

export interface BusinessAnalysisResult {
  periodLabel: LocalizedText;
  metricsData: {
    sales?: SalesSummaryResult;
    production?: ProductionSummaryResult;
    stock?: CurrentStockResult;
    returns?: SalesSummaryResult;
    damage?: SalesSummaryResult;
    salesBreakdown?: SalesBreakdownResult;
    snapshot?: BusinessSnapshotResult;
    topProduct?: { productName: string; salesQuantity: number; currentStock: number };
    difference?: { metricA: string; metricB: string; valueA: number; valueB: number; diff: number };
    comparison?: { currentLabel: string; prevLabel: string; currSales: number; prevSales: number; diff: number; pct: number | null };
  };
  answerText: LocalizedText;
}

@Injectable()
export class KenbyAnalysisService {
  private readonly logger = new Logger(KenbyAnalysisService.name);

  constructor(private readonly liveDataService: KenbyLiveDataService) {}

  /**
   * Deterministic Multi-Metric Business Analysis Engine.
   * Fetches required single-source-of-truth metrics and performs factual calculations.
   */
  async executeAnalysis(
    input: SalesSummaryPeriodInput,
    requestedMetrics: string[],
    queryMode: 'multi_metric' | 'top_product_stock' | 'difference' | 'all_metrics' | 'comparison',
    productFilter?: string,
    lang: 'ml' | 'en' = 'ml'
  ): Promise<BusinessAnalysisResult> {
    this.logger.log(
      `[KENBY_ANALYSIS] Executing analysis mode="${queryMode}" for metrics=[${requestedMetrics.join(', ')}] filter="${productFilter || 'none'}"`
    );

    // MODE 1: TOP SELLING PRODUCT + ITS CURRENT STOCK
    if (queryMode === 'top_product_stock' || requestedMetrics.includes('top_product_stock')) {
      const breakdown = await this.liveDataService.getSalesBreakdown(input);
      if (!breakdown.products || breakdown.products.length === 0) {
        return {
          periodLabel: { ml: 'ഈ മാസം', en: 'This month' },
          metricsData: {},
          answerText: {
            ml: 'ഈ കാലയളവിൽ sales dispatch രേഖപ്പെടുത്തിയിട്ടില്ല. അതിനാൽ top product വിവരങ്ങൾ ലഭ്യമല്ല.',
            en: 'No sales dispatches were recorded for this period. Top product details are unavailable.',
          },
        };
      }

      const topProd = breakdown.products[0]; // Ordered by quantity DESC
      const stockRes = await this.liveDataService.getCurrentStock(topProd.productName);
      const prodStock = stockRes.products.length > 0 ? stockRes.products[0].currentStock : stockRes.totalCurrentStock;

      const answerText: LocalizedText = {
        ml: `ഈ മാസം ഏറ്റവും കൂടുതൽ sales രേഖപ്പെടുത്തിയ product ${topProd.productName} ആണ് — ${topProd.quantity.toLocaleString('en-IN')} cases.\nഇപ്പോൾ അതിന്റെ stock ${prodStock.toLocaleString('en-IN')} cases ആണ്.`,
        en: `The product with the highest sales dispatches for this period is ${topProd.productName} — ${topProd.quantity.toLocaleString()} cases.\nCurrently, its available stock is ${prodStock.toLocaleString()} cases.`,
      };

      return {
        periodLabel: { ml: 'ഈ മാസം', en: 'This month' },
        metricsData: {
          salesBreakdown: breakdown,
          stock: stockRes,
          topProduct: {
            productName: topProd.productName,
            salesQuantity: topProd.quantity,
            currentStock: prodStock,
          },
        },
        answerText,
      };
    }

    // MODE 2: EXPLICIT DIFFERENCE QUERY (e.g. Sales vs Production difference)
    if (queryMode === 'difference' || requestedMetrics.includes('difference')) {
      const [salesRes, prodRes] = await Promise.all([
        this.liveDataService.getSalesSummary(input),
        this.liveDataService.getProductionSummary(input),
      ]);

      const salesQty = salesRes.totalQuantity;
      const prodCases = prodRes.totalCasesProduced;
      const diff = salesQty - prodCases;
      const absDiff = Math.abs(diff);

      let mlMsg = '';
      let enMsg = '';

      if (diff > 0) {
        mlMsg = `Sales production-നേക്കാൾ ${absDiff.toLocaleString('en-IN')} cases കൂടുതലാണ്.`;
        enMsg = `Sales dispatch is ${absDiff.toLocaleString()} cases higher than production output.`;
      } else if (diff < 0) {
        mlMsg = `Production sales-നേക്കാൾ ${absDiff.toLocaleString('en-IN')} cases കൂടുതലാണ്.`;
        enMsg = `Production output is ${absDiff.toLocaleString()} cases higher than sales dispatch.`;
      } else {
        mlMsg = `Sales-ഉം production-ഉം തുല്യമാണ് (${salesQty.toLocaleString('en-IN')} cases).`;
        enMsg = `Sales dispatch and production output are equal (${salesQty.toLocaleString()} cases).`;
      }

      return {
        periodLabel: { ml: 'ഈ മാസം', en: 'This month' },
        metricsData: {
          sales: salesRes,
          production: prodRes,
          difference: {
            metricA: 'Sales',
            metricB: 'Production',
            valueA: salesQty,
            valueB: prodCases,
            diff,
          },
        },
        answerText: { ml: mlMsg, en: enMsg },
      };
    }

    // MODE 3: PERIOD COMPARISON QUERY (e.g. July sales vs August sales)
    if (queryMode === 'comparison' || requestedMetrics.includes('comparison')) {
      const snapshot = await this.liveDataService.getBusinessSnapshot(input);
      const comp = snapshot.comparison;

      if (!comp) {
        return {
          periodLabel: { ml: 'ഈ മാസം', en: 'This month' },
          metricsData: { snapshot },
          answerText: {
            ml: `ഈ മാസത്തെ sales ${snapshot.sales.quantity.toLocaleString('en-IN')} cases ആണ്.`,
            en: `Sales for this period are ${snapshot.sales.quantity.toLocaleString()} cases.`,
          },
        };
      }

      const diff = comp.salesChangeQuantity;
      const pct = comp.salesChangePercent;
      const absDiff = Math.abs(diff);
      const currQty = snapshot.sales.quantity;
      const prevQty = snapshot.sales.quantity - diff;
      const currLabel = comp.currentPeriod.label.replace(' 2026', '');
      const prevLabel = comp.previousPeriod.label.replace(' 2026', '');

      let mlMsg = '';
      let enMsg = '';

      if (diff > 0) {
        mlMsg = `${currLabel} sales ${prevLabel}-നേക്കാൾ ${absDiff.toLocaleString('en-IN')} cases കൂടുതലാണ്.\n${currLabel}: ${currQty.toLocaleString('en-IN')} cases\n${prevLabel}: ${prevQty.toLocaleString('en-IN')} cases`;
        enMsg = `${currLabel} sales are ${absDiff.toLocaleString()} cases higher than ${prevLabel}.\n${currLabel}: ${currQty.toLocaleString()} cases\n${prevLabel}: ${prevQty.toLocaleString()} cases`;
      } else if (diff < 0) {
        mlMsg = `${currLabel} sales ${prevLabel}-നേക്കാൾ ${absDiff.toLocaleString('en-IN')} cases കുറവാണ്.\n${currLabel}: ${currQty.toLocaleString('en-IN')} cases\n${prevLabel}: ${prevQty.toLocaleString('en-IN')} cases`;
        enMsg = `${currLabel} sales are ${absDiff.toLocaleString()} cases lower than ${prevLabel}.\n${currLabel}: ${currQty.toLocaleString()} cases\n${prevLabel}: ${prevQty.toLocaleString()} cases`;
      } else {
        mlMsg = `${currLabel} sales-ഉം ${prevLabel} sales-ഉം തുല്യമാണ് (${currQty.toLocaleString('en-IN')} cases).`;
        enMsg = `${currLabel} sales and ${prevLabel} sales are equal (${currQty.toLocaleString()} cases).`;
      }

      return {
        periodLabel: { ml: comp.currentPeriod.label, en: comp.currentPeriod.label },
        metricsData: {
          snapshot,
          comparison: {
            currentLabel: comp.currentPeriod.label,
            prevLabel: comp.previousPeriod.label,
            currSales: currQty,
            prevSales: prevQty,
            diff,
            pct,
          },
        },
        answerText: { ml: mlMsg, en: enMsg },
      };
    }

    // MODE 4: ALL 4 METRICS OVERVIEW
    if (queryMode === 'all_metrics' || (requestedMetrics.includes('sales') && requestedMetrics.includes('production') && requestedMetrics.includes('returns') && requestedMetrics.includes('damage'))) {
      const [salesRes, prodRes, returnRes, damageRes] = await Promise.all([
        productFilter ? this.liveDataService.getSalesBreakdown(input, productFilter) : this.liveDataService.getSalesSummary(input),
        productFilter ? this.liveDataService.getProductionBreakdown(input, productFilter) : this.liveDataService.getProductionSummary(input),
        productFilter ? this.liveDataService.getReturnBreakdown(input, productFilter) : this.liveDataService.getSalesReturnSummary(input),
        productFilter ? this.liveDataService.getDamageBreakdown(input, productFilter) : this.liveDataService.getDamageSummary(input),
      ]);

      const salesQty = Number((salesRes as any).totalQuantity || 0);
      const prodCases = Number((prodRes as any).totalCasesProduced ?? (prodRes as any).totalCases ?? 0);
      const returnQty = Number((returnRes as any).totalQuantity || 0);
      const damageQty = Number((damageRes as any).totalQuantity || 0);

      const prodPrefix = productFilter ? `${productFilter} — ` : '';

      const mlLines = [
        `📊 ${prodPrefix}ബിസിനസ്സ് വിവരങ്ങൾ:`,
        `• Sales: ${salesQty.toLocaleString('en-IN')} cases`,
        `• Production: ${prodCases.toLocaleString('en-IN')} cases`,
        `• Returns: ${returnQty.toLocaleString('en-IN')} cases`,
        `• Damage: ${damageQty.toLocaleString('en-IN')} cases`,
      ];

      const enLines = [
        `📊 ${prodPrefix}Business Overview:`,
        `• Sales: ${salesQty.toLocaleString()} cases`,
        `• Production: ${prodCases.toLocaleString()} cases`,
        `• Returns: ${returnQty.toLocaleString()} cases`,
        `• Damage: ${damageQty.toLocaleString()} cases`,
      ];

      return {
        periodLabel: { ml: 'ഈ മാസം', en: 'This month' },
        metricsData: {
          sales: salesRes as any,
          production: prodRes as any,
          returns: returnRes as any,
          damage: damageRes as any,
        },
        answerText: { ml: mlLines.join('\n'), en: enLines.join('\n') },
      };
    }

    // MODE 5: GENERIC MULTI-METRIC (e.g. Sales + Production, or Product-specific Sales + Production + Stock)
    const promises: Promise<any>[] = [];
    const activeMetrics: string[] = [];

    if (requestedMetrics.includes('sales')) {
      promises.push(productFilter ? this.liveDataService.getSalesBreakdown(input, productFilter) : this.liveDataService.getSalesSummary(input));
      activeMetrics.push('sales');
    }
    if (requestedMetrics.includes('production')) {
      promises.push(productFilter ? this.liveDataService.getProductionBreakdown(input, productFilter) : this.liveDataService.getProductionSummary(input));
      activeMetrics.push('production');
    }
    if (requestedMetrics.includes('stock')) {
      promises.push(this.liveDataService.getCurrentStock(productFilter));
      activeMetrics.push('stock');
    }
    if (requestedMetrics.includes('returns')) {
      promises.push(productFilter ? this.liveDataService.getReturnBreakdown(input, productFilter) : this.liveDataService.getSalesReturnSummary(input));
      activeMetrics.push('returns');
    }
    if (requestedMetrics.includes('damage')) {
      promises.push(productFilter ? this.liveDataService.getDamageBreakdown(input, productFilter) : this.liveDataService.getDamageSummary(input));
      activeMetrics.push('damage');
    }

    const results = await Promise.all(promises);
    const metricsMap: Record<string, any> = {};
    activeMetrics.forEach((mKey, idx) => {
      metricsMap[mKey] = results[idx];
    });

    const prodPrefix = productFilter ? `${productFilter} — ` : '';
    const mlParts: string[] = [];
    const enParts: string[] = [];

    if (metricsMap.sales) {
      const q = Number(metricsMap.sales.totalQuantity || 0).toLocaleString('en-IN');
      mlParts.push(`Sales: ${q} cases`);
      enParts.push(`Sales: ${q} cases`);
    }

    if (metricsMap.production) {
      const q = Number(metricsMap.production.totalCasesProduced ?? metricsMap.production.totalCases ?? 0).toLocaleString('en-IN');
      mlParts.push(`Production: ${q} cases`);
      enParts.push(`Production: ${q} cases`);
    }

    if (metricsMap.stock) {
      let q = metricsMap.stock.totalCurrentStock.toLocaleString('en-IN');
      if (productFilter && metricsMap.stock.products.length > 0) {
        q = metricsMap.stock.products[0].currentStock.toLocaleString('en-IN');
      }
      mlParts.push(`Current Stock: ${q} cases`);
      enParts.push(`Current Stock: ${q} cases`);
    }

    if (metricsMap.returns) {
      const q = Number(metricsMap.returns.totalQuantity || 0).toLocaleString('en-IN');
      mlParts.push(`Returns: ${q} cases`);
      enParts.push(`Returns: ${q} cases`);
    }

    if (metricsMap.damage) {
      const q = Number(metricsMap.damage.totalQuantity || 0).toLocaleString('en-IN');
      mlParts.push(`Damage: ${q} cases`);
      enParts.push(`Damage: ${q} cases`);
    }

    const mlFormatted = `${prodPrefix}വിവരങ്ങൾ:\n• ` + mlParts.join('\n• ');
    const enFormatted = `${prodPrefix}Summary:\n• ` + enParts.join('\n• ');

    return {
      periodLabel: { ml: 'ഈ മാസം', en: 'This month' },
      metricsData: metricsMap,
      answerText: { ml: mlFormatted, en: enFormatted },
    };
  }
}
