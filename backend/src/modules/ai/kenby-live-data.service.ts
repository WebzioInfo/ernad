import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { salesTransactions, products, productionLogs, productionBatches, productionStock } from '../../database/schema';
import { eq, and, gte, lte, lt, sql, isNull, ilike } from 'drizzle-orm';
import { KenbyProactiveInsightService } from './kenby-proactive-insight.service';

export type SalesSummaryPeriodType =
  | 'today'
  | 'yesterday'
  | 'this_month'
  | 'last_month'
  | 'specific_date'
  | 'specific_month'
  | 'date_range';

export interface SalesSummaryPeriodInput {
  period: SalesSummaryPeriodType;
  date?: string; // YYYY-MM-DD for specific_date
  year?: number; // YYYY for specific_month
  month?: number; // 1-12 for specific_month
  startDate?: string; // YYYY-MM-DD for date_range
  endDate?: string; // YYYY-MM-DD for date_range
}

export interface ProductSalesBreakdown {
  productId: string;
  productName: string;
  quantity: number;
}

export interface ProductBreakdownItem {
  productId: string;
  productName: string;
  quantity: number; // in cases
  transactionCount?: number;
  casesProduced?: number;
}

export interface SalesSummaryResult {
  period: {
    type: SalesSummaryPeriodType;
    startDate: string;
    endDate: string;
    date?: string;
    year?: number;
    month?: number;
  };
  totalQuantity: number; // In cases
  transactionCount: number;
  byProduct: ProductSalesBreakdown[];
}

export interface ProductionSummaryResult {
  period: {
    type: SalesSummaryPeriodType;
    startDate: string;
    endDate: string;
    date?: string;
    year?: number;
    month?: number;
  };
  totalCasesProduced: number; // Total packing output in cases
  totalFinishedGoodsProduced: number;
  totalWastage: number;
  logCount: number;
}

export interface ReturnBreakdownResult {
  period: {
    type: SalesSummaryPeriodType;
    startDate: string;
    endDate: string;
    date?: string;
    year?: number;
    month?: number;
  };
  totalQuantity: number;
  transactionCount: number;
  products: ProductBreakdownItem[];
  productFilter?: string;
}

export interface DamageBreakdownResult {
  period: {
    type: SalesSummaryPeriodType;
    startDate: string;
    endDate: string;
    date?: string;
    year?: number;
    month?: number;
  };
  totalQuantity: number;
  transactionCount: number;
  products: ProductBreakdownItem[];
  productFilter?: string;
}

export interface SalesBreakdownResult {
  period: {
    type: SalesSummaryPeriodType;
    startDate: string;
    endDate: string;
    date?: string;
    year?: number;
    month?: number;
  };
  totalQuantity: number;
  transactionCount: number;
  products: ProductBreakdownItem[];
  productFilter?: string;
}

export interface ProductionBreakdownResult {
  period: {
    type: SalesSummaryPeriodType;
    startDate: string;
    endDate: string;
    date?: string;
    year?: number;
    month?: number;
  };
  totalCases: number;
  logCount: number;
  products: ProductBreakdownItem[];
  productFilter?: string;
}

export interface StockProductItem {
  productId: string;
  productName: string;
  category?: string;
  unit: 'jars' | 'cases' | 'units' | string;
  currentStock: number; // In product specific units (jars or cases)
  totalProduced: number;
  totalDispatched: number;
}

export interface UnitStockGroup {
  unit: string;
  total: number;
  products: StockProductItem[];
}

export interface CurrentStockResult {
  totalCurrentStock: number; // In cases / primary units
  productFilter?: string;
  products: StockProductItem[];
  unitGroups?: UnitStockGroup[];
}

export interface MonthComparisonResult {
  currentPeriod: { year: number; month: number; label: string };
  previousPeriod: { year: number; month: number; label: string };
  salesChangeQuantity: number;
  salesChangePercent: number | null;
  productionChangeQuantity: number;
  productionChangePercent: number | null;
  returnChangeQuantity: number;
  damageChangeQuantity: number;
}

export interface BusinessSnapshotResult {
  period: {
    type: SalesSummaryPeriodType;
    startDate: string;
    endDate: string;
    date?: string;
    year?: number;
    month?: number;
  };
  sales: {
    quantity: number;
    transactionCount: number;
  };
  production: {
    casesProduced: number;
    finishedGoodsProduced: number;
    wastage: number;
    logCount: number;
  };
  stock: {
    totalCurrentStock: number;
    productsCount: number;
  };
  returns: {
    quantity: number;
    transactionCount: number;
  };
  damage: {
    quantity: number;
    transactionCount: number;
  };
  derivedMetrics: {
    productionMinusSales: number;
    returnRate: number | null;
    damageRate: number | null;
  };
  comparison: MonthComparisonResult | null;
  insights: Array<{
    id: string;
    type: string;
    text: { ml: string; en: string };
    severity?: string;
    title?: { ml: string; en: string };
    message?: { ml: string; en: string };
    data?: any;
    reason?: string;
  }>;
  dataQuality: {
    status: 'ok' | 'warning';
    issues: string[];
  };
}

@Injectable()
export class KenbyLiveDataService {
  private readonly logger = new Logger(KenbyLiveDataService.name);
  private readonly proactiveInsightService = new KenbyProactiveInsightService();

  /**
   * Deterministic Tool 1: get_sales_summary()
   * Aggregates sales_transactions where type = 'SALES_DISPATCH'
   */
  async getSalesSummary(input: SalesSummaryPeriodInput): Promise<SalesSummaryResult> {
    const { startDateStr, endDateStr } = this.buildDatePeriodStrings(input);

    this.logger.log(
      `[KENBY_LIVE_DATA] Executing SALES_DISPATCH summary for period: ${input.period} (${startDateStr} to ${endDateStr})`
    );

    let dateWhere = sql`sales_date >= ${startDateStr}::date AND sales_date < ${endDateStr}::date`;
    if (input.period === 'specific_date') {
      if (this.isValidDateString(input.date)) {
        dateWhere = sql`sales_date = ${input.date}::date`;
      } else {
        dateWhere = sql`1=0`;
      }
    }

    const totalRes = await db.execute(sql`
      SELECT
        coalesce(sum(quantity), 0)::int as total_quantity,
        count(*)::int as tx_count
      FROM sales_transactions
      WHERE type = 'SALES_DISPATCH' AND ${dateWhere}
    `);

    const totalQuantity = Number(totalRes[0]?.total_quantity || 0);
    const transactionCount = Number(totalRes[0]?.tx_count || 0);

    const breakdownRes = await db.execute(sql`
      SELECT
        st.product_id,
        coalesce(p.name, 'Unknown Product') as product_name,
        coalesce(sum(st.quantity), 0)::int as quantity
      FROM sales_transactions st
      LEFT JOIN products p ON p.id = st.product_id
      WHERE st.type = 'SALES_DISPATCH' AND ${dateWhere}
      GROUP BY st.product_id, p.name
      ORDER BY quantity DESC
    `);

    const byProduct: ProductSalesBreakdown[] = (breakdownRes as any[]).map((row) => ({
      productId: String(row.product_id || ''),
      productName: String(row.product_name || 'Unknown Product'),
      quantity: Number(row.quantity || 0),
    }));

    return {
      period: {
        type: input.period,
        startDate: startDateStr,
        endDate: endDateStr,
        date: input.date,
        year: input.year,
        month: input.month,
      },
      totalQuantity,
      transactionCount,
      byProduct,
    };
  }

  /**
   * Deterministic Tool 2: get_production_summary()
   * Aggregates production_logs joined with non-deleted production_batches where station = 'PACKING'
   */
  async getProductionSummary(input: SalesSummaryPeriodInput): Promise<ProductionSummaryResult> {
    const { startDateStr, endDateStr } = this.buildDatePeriodStrings(input);

    this.logger.log(
      `[KENBY_LIVE_DATA] Executing get_production_summary for period: ${input.period} (${startDateStr} to ${endDateStr})`
    );

    let dateWhere = sql`date(pl.logged_at) >= ${startDateStr}::date AND date(pl.logged_at) < ${endDateStr}::date`;
    if (input.period === 'specific_date' && input.date) {
      dateWhere = sql`date(pl.logged_at) = ${input.date}::date`;
    }

    const res = await db.execute(sql`
      SELECT
        coalesce(sum(coalesce(pl.cases_produced, pl.primary_count, 0)), 0)::int as total_cases_produced,
        coalesce(sum(coalesce(pl.finished_goods_produced, 0)), 0)::int as total_finished_goods,
        coalesce(sum(coalesce(pl.wastage_count, 0)), 0)::int as total_wastage,
        count(pl.id)::int as log_count
      FROM production_logs pl
      JOIN production_batches pb ON pb.id = pl.batch_id AND pb.deleted_at IS NULL
      WHERE pb.deleted_at IS NULL AND pl.station = 'PACKING' AND ${dateWhere}
    `);

    const totalCasesProduced = Number(res[0]?.total_cases_produced || 0);
    const totalFinishedGoodsProduced = Number(res[0]?.total_finished_goods || 0);
    const totalWastage = Number(res[0]?.total_wastage || 0);
    const logCount = Number(res[0]?.log_count || 0);

    return {
      period: {
        type: input.period,
        startDate: startDateStr,
        endDate: endDateStr,
        date: input.date,
        year: input.year,
        month: input.month,
      },
      totalCasesProduced,
      totalFinishedGoodsProduced,
      totalWastage,
      logCount,
    };
  }

  /**
   * Deterministic Tool 3: get_current_stock()
   * Aggregates production_stock joined with products table
   */
  async getCurrentStock(productFilter?: string): Promise<CurrentStockResult> {
    this.logger.log(
      `[KENBY_LIVE_DATA] Executing get_current_stock with filter: "${productFilter || 'none'}"`
    );

    let whereClause = sql`1=1`;
    if (productFilter && productFilter.trim().length > 0) {
      whereClause = sql`p.name ILIKE ${'%' + productFilter.trim() + '%'}`;
    }

    const res = await db.execute(sql`
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.category as category,
        coalesce(ps.current_stock, 0)::int as current_stock,
        coalesce(ps.total_produced, 0)::int as total_produced,
        coalesce(ps.total_dispatched, 0)::int as total_dispatched
      FROM products p
      LEFT JOIN production_stock ps ON ps.product_id = p.id
      WHERE ${whereClause}
      ORDER BY p.name ASC
    `);

    const productsList: StockProductItem[] = (res as any[]).map((row) => {
      const name = String(row.product_name || 'Unknown Product');
      const cat = String(row.category || '');
      let unit = 'cases';
      if (/jar/i.test(name) || /jar/i.test(cat)) {
        unit = 'jars';
      }

      return {
        productId: String(row.product_id || ''),
        productName: name,
        category: cat,
        unit,
        currentStock: Number(row.current_stock || 0),
        totalProduced: Number(row.total_produced || 0),
        totalDispatched: Number(row.total_dispatched || 0),
      };
    });

    let totalCurrentStock = 0;
    const groupMap = new Map<string, { total: number; products: StockProductItem[] }>();

    productsList.forEach((prod) => {
      totalCurrentStock += prod.currentStock;
      const grp = groupMap.get(prod.unit) || { total: 0, products: [] };
      grp.total += prod.currentStock;
      grp.products.push(prod);
      groupMap.set(prod.unit, grp);
    });

    const unitGroups: UnitStockGroup[] = Array.from(groupMap.entries()).map(([unit, val]) => ({
      unit,
      total: val.total,
      products: val.products,
    }));

    return {
      totalCurrentStock,
      productFilter,
      products: productsList,
      unitGroups,
    };
  }

  /**
   * Deterministic Tool 4: get_sales_return_summary()
   * Aggregates sales_transactions where type = 'RETURN'
   */
  async getSalesReturnSummary(input: SalesSummaryPeriodInput): Promise<SalesSummaryResult> {
    const { startDateStr, endDateStr } = this.buildDatePeriodStrings(input);

    this.logger.log(
      `[KENBY_LIVE_DATA] Executing RETURN summary for period: ${input.period} (${startDateStr} to ${endDateStr})`
    );

    let dateWhere = sql`sales_date >= ${startDateStr}::date AND sales_date < ${endDateStr}::date`;
    if (input.period === 'specific_date' && input.date) {
      dateWhere = sql`sales_date = ${input.date}::date`;
    }

    const totalRes = await db.execute(sql`
      SELECT
        coalesce(sum(quantity), 0)::int as total_quantity,
        count(*)::int as tx_count
      FROM sales_transactions
      WHERE type = 'RETURN' AND ${dateWhere}
    `);

    const totalQuantity = Number(totalRes[0]?.total_quantity || 0);
    const transactionCount = Number(totalRes[0]?.tx_count || 0);

    const breakdownRes = await db.execute(sql`
      SELECT
        st.product_id,
        coalesce(p.name, 'Unknown Product') as product_name,
        coalesce(sum(st.quantity), 0)::int as quantity
      FROM sales_transactions st
      LEFT JOIN products p ON p.id = st.product_id
      WHERE st.type = 'RETURN' AND ${dateWhere}
      GROUP BY st.product_id, p.name
      ORDER BY quantity DESC
    `);

    const byProduct: ProductSalesBreakdown[] = (breakdownRes as any[]).map((row) => ({
      productId: String(row.product_id || ''),
      productName: String(row.product_name || 'Unknown Product'),
      quantity: Number(row.quantity || 0),
    }));

    return {
      period: {
        type: input.period,
        startDate: startDateStr,
        endDate: endDateStr,
        date: input.date,
        year: input.year,
        month: input.month,
      },
      totalQuantity,
      transactionCount,
      byProduct,
    };
  }

  /**
   * Deterministic Tool 5: get_damage_summary()
   * Aggregates sales_transactions where type = 'DAMAGE'
   */
  async getDamageSummary(input: SalesSummaryPeriodInput): Promise<SalesSummaryResult> {
    const { startDateStr, endDateStr } = this.buildDatePeriodStrings(input);

    this.logger.log(
      `[KENBY_LIVE_DATA] Executing DAMAGE summary for period: ${input.period} (${startDateStr} to ${endDateStr})`
    );

    let dateWhere = sql`sales_date >= ${startDateStr}::date AND sales_date < ${endDateStr}::date`;
    if (input.period === 'specific_date' && input.date) {
      dateWhere = sql`sales_date = ${input.date}::date`;
    }

    const totalRes = await db.execute(sql`
      SELECT
        coalesce(sum(quantity), 0)::int as total_quantity,
        count(*)::int as tx_count
      FROM sales_transactions
      WHERE type = 'DAMAGE' AND ${dateWhere}
    `);

    const totalQuantity = Number(totalRes[0]?.total_quantity || 0);
    const transactionCount = Number(totalRes[0]?.tx_count || 0);

    const breakdownRes = await db.execute(sql`
      SELECT
        st.product_id,
        coalesce(p.name, 'Unknown Product') as product_name,
        coalesce(sum(st.quantity), 0)::int as quantity
      FROM sales_transactions st
      LEFT JOIN products p ON p.id = st.product_id
      WHERE st.type = 'DAMAGE' AND ${dateWhere}
      GROUP BY st.product_id, p.name
      ORDER BY quantity DESC
    `);

    const byProduct: ProductSalesBreakdown[] = (breakdownRes as any[]).map((row) => ({
      productId: String(row.product_id || ''),
      productName: String(row.product_name || 'Unknown Product'),
      quantity: Number(row.quantity || 0),
    }));

    return {
      period: {
        type: input.period,
        startDate: startDateStr,
        endDate: endDateStr,
        date: input.date,
        year: input.year,
        month: input.month,
      },
      totalQuantity,
      transactionCount,
      byProduct,
    };
  }

  // ── PHASE 8 BREAKDOWN DRILL-DOWN TOOLS ──

  /**
   * Phase 8 Tool 1: get_return_breakdown()
   * Aggregates sales_transactions where type = 'RETURN' product-wise ordered by quantity DESC
   */
  async getReturnBreakdown(input: SalesSummaryPeriodInput, productFilter?: string): Promise<ReturnBreakdownResult> {
    const { startDateStr, endDateStr } = this.buildDatePeriodStrings(input);

    this.logger.log(
      `[KENBY_LIVE_DATA] Executing get_return_breakdown for period: ${input.period} | filter: "${productFilter || 'none'}"`
    );

    let dateWhere = sql`sales_date >= ${startDateStr}::date AND sales_date < ${endDateStr}::date`;
    if (input.period === 'specific_date' && input.date) {
      dateWhere = sql`sales_date = ${input.date}::date`;
    }

    let productWhere = sql`1=1`;
    if (productFilter && productFilter.trim().length > 0) {
      productWhere = sql`p.name ILIKE ${'%' + productFilter.trim() + '%'}`;
    }

    const res = await db.execute(sql`
      SELECT
        st.product_id,
        coalesce(p.name, 'Unknown Product') as product_name,
        coalesce(sum(st.quantity), 0)::int as quantity,
        count(st.id)::int as tx_count
      FROM sales_transactions st
      LEFT JOIN products p ON p.id = st.product_id
      WHERE st.type = 'RETURN' AND ${dateWhere} AND ${productWhere}
      GROUP BY st.product_id, p.name
      ORDER BY quantity DESC
    `);

    const productsList: ProductBreakdownItem[] = (res as any[]).map((row) => ({
      productId: String(row.product_id || ''),
      productName: String(row.product_name || 'Unknown Product'),
      quantity: Number(row.quantity || 0),
      transactionCount: Number(row.tx_count || 0),
    }));

    let totalQuantity = 0;
    let transactionCount = 0;
    productsList.forEach((p) => {
      totalQuantity += p.quantity;
      transactionCount += p.transactionCount || 0;
    });

    return {
      period: {
        type: input.period,
        startDate: startDateStr,
        endDate: endDateStr,
        date: input.date,
        year: input.year,
        month: input.month,
      },
      totalQuantity,
      transactionCount,
      products: productsList,
      productFilter,
    };
  }

  /**
   * Phase 8 Tool 2: get_damage_breakdown()
   * Aggregates sales_transactions where type = 'DAMAGE' product-wise ordered by quantity DESC
   */
  async getDamageBreakdown(input: SalesSummaryPeriodInput, productFilter?: string): Promise<DamageBreakdownResult> {
    const { startDateStr, endDateStr } = this.buildDatePeriodStrings(input);

    this.logger.log(
      `[KENBY_LIVE_DATA] Executing get_damage_breakdown for period: ${input.period} | filter: "${productFilter || 'none'}"`
    );

    let dateWhere = sql`sales_date >= ${startDateStr}::date AND sales_date < ${endDateStr}::date`;
    if (input.period === 'specific_date' && input.date) {
      dateWhere = sql`sales_date = ${input.date}::date`;
    }

    let productWhere = sql`1=1`;
    if (productFilter && productFilter.trim().length > 0) {
      productWhere = sql`p.name ILIKE ${'%' + productFilter.trim() + '%'}`;
    }

    const res = await db.execute(sql`
      SELECT
        st.product_id,
        coalesce(p.name, 'Unknown Product') as product_name,
        coalesce(sum(st.quantity), 0)::int as quantity,
        count(st.id)::int as tx_count
      FROM sales_transactions st
      LEFT JOIN products p ON p.id = st.product_id
      WHERE st.type = 'DAMAGE' AND ${dateWhere} AND ${productWhere}
      GROUP BY st.product_id, p.name
      ORDER BY quantity DESC
    `);

    const productsList: ProductBreakdownItem[] = (res as any[]).map((row) => ({
      productId: String(row.product_id || ''),
      productName: String(row.product_name || 'Unknown Product'),
      quantity: Number(row.quantity || 0),
      transactionCount: Number(row.tx_count || 0),
    }));

    let totalQuantity = 0;
    let transactionCount = 0;
    productsList.forEach((p) => {
      totalQuantity += p.quantity;
      transactionCount += p.transactionCount || 0;
    });

    return {
      period: {
        type: input.period,
        startDate: startDateStr,
        endDate: endDateStr,
        date: input.date,
        year: input.year,
        month: input.month,
      },
      totalQuantity,
      transactionCount,
      products: productsList,
      productFilter,
    };
  }

  /**
   * Phase 8 Tool 3: get_sales_breakdown()
   * Aggregates sales_transactions where type = 'SALES_DISPATCH' product-wise ordered by quantity DESC
   */
  async getSalesBreakdown(input: SalesSummaryPeriodInput, productFilter?: string): Promise<SalesBreakdownResult> {
    const { startDateStr, endDateStr } = this.buildDatePeriodStrings(input);

    this.logger.log(
      `[KENBY_LIVE_DATA] Executing get_sales_breakdown for period: ${input.period} | filter: "${productFilter || 'none'}"`
    );

    let dateWhere = sql`sales_date >= ${startDateStr}::date AND sales_date < ${endDateStr}::date`;
    if (input.period === 'specific_date' && input.date) {
      dateWhere = sql`sales_date = ${input.date}::date`;
    }

    let productWhere = sql`1=1`;
    if (productFilter && productFilter.trim().length > 0) {
      productWhere = sql`p.name ILIKE ${'%' + productFilter.trim() + '%'}`;
    }

    const res = await db.execute(sql`
      SELECT
        st.product_id,
        coalesce(p.name, 'Unknown Product') as product_name,
        coalesce(sum(st.quantity), 0)::int as quantity,
        count(st.id)::int as tx_count
      FROM sales_transactions st
      LEFT JOIN products p ON p.id = st.product_id
      WHERE st.type = 'SALES_DISPATCH' AND ${dateWhere} AND ${productWhere}
      GROUP BY st.product_id, p.name
      ORDER BY quantity DESC
    `);

    const productsList: ProductBreakdownItem[] = (res as any[]).map((row) => ({
      productId: String(row.product_id || ''),
      productName: String(row.product_name || 'Unknown Product'),
      quantity: Number(row.quantity || 0),
      transactionCount: Number(row.tx_count || 0),
    }));

    let totalQuantity = 0;
    let transactionCount = 0;
    productsList.forEach((p) => {
      totalQuantity += p.quantity;
      transactionCount += p.transactionCount || 0;
    });

    return {
      period: {
        type: input.period,
        startDate: startDateStr,
        endDate: endDateStr,
        date: input.date,
        year: input.year,
        month: input.month,
      },
      totalQuantity,
      transactionCount,
      products: productsList,
      productFilter,
    };
  }

  /**
   * Phase 8 Tool 4: get_production_breakdown()
   * Aggregates production_logs for station = 'PACKING' product-wise ordered by cases_produced DESC
   */
  async getProductionBreakdown(input: SalesSummaryPeriodInput, productFilter?: string): Promise<ProductionBreakdownResult> {
    const { startDateStr, endDateStr } = this.buildDatePeriodStrings(input);

    this.logger.log(
      `[KENBY_LIVE_DATA] Executing get_production_breakdown for period: ${input.period} | filter: "${productFilter || 'none'}"`
    );

    let dateWhere = sql`date(pl.logged_at) >= ${startDateStr}::date AND date(pl.logged_at) < ${endDateStr}::date`;
    if (input.period === 'specific_date' && input.date) {
      dateWhere = sql`date(pl.logged_at) = ${input.date}::date`;
    }

    let productWhere = sql`1=1`;
    if (productFilter && productFilter.trim().length > 0) {
      productWhere = sql`p.name ILIKE ${'%' + productFilter.trim() + '%'}`;
    }

    const res = await db.execute(sql`
      SELECT
        pb.product_id,
        coalesce(p.name, 'Unknown Product') as product_name,
        coalesce(sum(coalesce(pl.cases_produced, pl.primary_count, 0)), 0)::int as cases_produced,
        count(pl.id)::int as log_count
      FROM production_logs pl
      JOIN production_batches pb ON pb.id = pl.batch_id AND pb.deleted_at IS NULL
      LEFT JOIN products p ON p.id = pb.product_id
      WHERE pb.deleted_at IS NULL AND pl.station = 'PACKING' AND ${dateWhere} AND ${productWhere}
      GROUP BY pb.product_id, p.name
      ORDER BY cases_produced DESC
    `);

    const productsList: ProductBreakdownItem[] = (res as any[]).map((row) => ({
      productId: String(row.product_id || ''),
      productName: String(row.product_name || 'Unknown Product'),
      quantity: Number(row.cases_produced || 0),
      casesProduced: Number(row.cases_produced || 0),
      transactionCount: Number(row.log_count || 0),
    }));

    let totalCases = 0;
    let logCount = 0;
    productsList.forEach((p) => {
      totalCases += p.casesProduced || p.quantity;
      logCount += p.transactionCount || 0;
    });

    return {
      period: {
        type: input.period,
        startDate: startDateStr,
        endDate: endDateStr,
        date: input.date,
        year: input.year,
        month: input.month,
      },
      totalCases,
      logCount,
      products: productsList,
      productFilter,
    };
  }

  /**
   * Deterministic Business Snapshot Engine: Combines sales, production, stock, returns, damage,
   * calculates derived metrics & month-over-month comparisons, and runs the Proactive Insight Engine.
   */
  async getBusinessSnapshot(input?: SalesSummaryPeriodInput): Promise<BusinessSnapshotResult> {
    const periodInput = input || { period: 'this_month' };
    this.logger.log(`[KENBY_LIVE_DATA] Executing get_business_snapshot for period: ${periodInput.period}`);

    const [salesRes, prodRes, stockRes, returnRes, damageRes] = await Promise.all([
      this.getSalesSummary(periodInput),
      this.getProductionSummary(periodInput),
      this.getCurrentStock(),
      this.getSalesReturnSummary(periodInput),
      this.getDamageSummary(periodInput),
    ]);

    const salesQty = salesRes.totalQuantity;
    const prodCases = prodRes.totalCasesProduced;
    const returnQty = returnRes.totalQuantity;
    const damageQty = damageRes.totalQuantity;

    // Derived Metrics Calculations
    const productionMinusSales = prodCases - salesQty;

    // DATA AUDIT RULE: Set returnRate = null when returns exceed dispatches
    let returnRate: number | null = null;
    if (salesQty > 0 && returnQty <= salesQty) {
      returnRate = Number(((returnQty / salesQty) * 100).toFixed(2));
    }

    let damageRate: number | null = null;
    if (prodCases > 0) {
      damageRate = Number(((damageQty / prodCases) * 100).toFixed(2));
    }

    // Month-over-month comparison engine
    let comparison: MonthComparisonResult | null = null;
    const now = new Date();
    let currentYear = now.getFullYear();
    let currentMonth = now.getMonth() + 1;

    if (periodInput.period === 'specific_month' && periodInput.year && periodInput.month) {
      currentYear = periodInput.year;
      currentMonth = periodInput.month;
    }

    let prevYear = currentYear;
    let prevMonth = currentMonth - 1;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear = currentYear - 1;
    }

    const prevMonthInput: SalesSummaryPeriodInput = {
      period: 'specific_month',
      year: prevYear,
      month: prevMonth,
    };

    try {
      const [prevSales, prevProd, prevReturn, prevDamage] = await Promise.all([
        this.getSalesSummary(prevMonthInput),
        this.getProductionSummary(prevMonthInput),
        this.getSalesReturnSummary(prevMonthInput),
        this.getDamageSummary(prevMonthInput),
      ]);

      const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const currentLabel = `${monthNamesEn[currentMonth - 1]} ${currentYear}`;
      const prevLabel = `${monthNamesEn[prevMonth - 1]} ${prevYear}`;

      const salesChangeQuantity = salesQty - prevSales.totalQuantity;
      let salesChangePercent: number | null = null;
      if (prevSales.totalQuantity > 0) {
        salesChangePercent = Number(((salesChangeQuantity / prevSales.totalQuantity) * 100).toFixed(2));
      }

      const productionChangeQuantity = prodCases - prevProd.totalCasesProduced;
      let productionChangePercent: number | null = null;
      if (prevProd.totalCasesProduced > 0) {
        productionChangePercent = Number(((productionChangeQuantity / prevProd.totalCasesProduced) * 100).toFixed(2));
      }

      comparison = {
        currentPeriod: { year: currentYear, month: currentMonth, label: currentLabel },
        previousPeriod: { year: prevYear, month: prevMonth, label: prevLabel },
        salesChangeQuantity,
        salesChangePercent,
        productionChangeQuantity,
        productionChangePercent,
        returnChangeQuantity: returnQty - prevReturn.totalQuantity,
        damageChangeQuantity: damageQty - prevDamage.totalQuantity,
      };
    } catch (e: any) {
      this.logger.warn(`Could not compute previous month comparison: ${e.message}`);
    }

    // Data Quality Warnings Engine
    const dataQualityIssues: string[] = [];
    if (returnQty > salesQty && returnQty > 0) {
      dataQualityIssues.push(
        `Returns recorded during this period (${returnQty} cases) exceed sales dispatches recorded during the same period (${salesQty} cases). Returns may relate to past dispatches.`
      );
    }

    const dataQuality = {
      status: (dataQualityIssues.length > 0 ? 'warning' : 'ok') as 'ok' | 'warning',
      issues: dataQualityIssues,
    };

    // PROACTIVE OWNER INTELLIGENCE ENGINE INVOCATION
    const partialSnapshotForInsights: BusinessSnapshotResult = {
      period: salesRes.period,
      sales: { quantity: salesQty, transactionCount: salesRes.transactionCount },
      production: { casesProduced: prodCases, finishedGoodsProduced: prodRes.totalFinishedGoodsProduced, wastage: prodRes.totalWastage, logCount: prodRes.logCount },
      stock: { totalCurrentStock: stockRes.totalCurrentStock, productsCount: stockRes.products.length },
      returns: { quantity: returnQty, transactionCount: returnRes.transactionCount },
      damage: { quantity: damageQty, transactionCount: damageRes.transactionCount },
      derivedMetrics: { productionMinusSales, returnRate, damageRate },
      comparison,
      insights: [],
      dataQuality,
    };

    const proactiveInsights = this.proactiveInsightService.generateProactiveInsights(partialSnapshotForInsights);

    return {
      ...partialSnapshotForInsights,
      insights: proactiveInsights,
    };
  }

  // ── PRIVATE DATE HELPERS ──

  private buildDatePeriodStrings(input: SalesSummaryPeriodInput) {
    const now = new Date();
    let startDateStr = '';
    let endDateStr = '';

    switch (input.period) {
      case 'today': {
        const todayStr = now.toISOString().split('T')[0];
        startDateStr = todayStr;
        endDateStr = todayStr;
        break;
      }
      case 'yesterday': {
        const d = new Date(now);
        d.setDate(d.getDate() - 1);
        const yesterdayStr = d.toISOString().split('T')[0];
        startDateStr = yesterdayStr;
        endDateStr = yesterdayStr;
        break;
      }
      case 'specific_date': {
        if (!this.isValidDateString(input.date)) {
          startDateStr = '1970-01-01';
          endDateStr = '1970-01-01';
        } else {
          startDateStr = input.date!;
          endDateStr = input.date!;
        }
        break;
      }
      case 'this_month': {
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        startDateStr = `${y}-${String(m).padStart(2, '0')}-01`;
        let nextY = y;
        let nextM = m + 1;
        if (nextM > 12) {
          nextM = 1;
          nextY = y + 1;
        }
        endDateStr = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
        break;
      }
      case 'last_month': {
        let y = now.getFullYear();
        let m = now.getMonth();
        if (m < 1) {
          m = 12;
          y -= 1;
        }
        startDateStr = `${y}-${String(m).padStart(2, '0')}-01`;
        let nextY = y;
        let nextM = m + 1;
        if (nextM > 12) {
          nextM = 1;
          nextY = y + 1;
        }
        endDateStr = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
        break;
      }
      case 'specific_month': {
        const y = input.year || (input.startDate ? Number(input.startDate.split('-')[0]) : (input as any).startDateStr ? Number((input as any).startDateStr.split('-')[0]) : now.getFullYear());
        const m = input.month || (input.startDate ? Number(input.startDate.split('-')[1]) : (input as any).startDateStr ? Number((input as any).startDateStr.split('-')[1]) : (now.getMonth() + 1));
        startDateStr = `${y}-${String(m).padStart(2, '0')}-01`;
        let nextY = y;
        let nextM = m + 1;
        if (nextM > 12) {
          nextM = 1;
          nextY = y + 1;
        }
        endDateStr = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
        break;
      }
      case 'date_range': {
        const start = input.startDate || (input as any).startDateStr;
        const end = input.endDate || (input as any).endDateStr;
        if (!start || !end) {
          const y = now.getFullYear();
          const m = now.getMonth() + 1;
          startDateStr = `${y}-${String(m).padStart(2, '0')}-01`;
          endDateStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        } else {
          startDateStr = start;
          endDateStr = end;
        }
        break;
      }
      default: {
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        startDateStr = `${y}-${String(m).padStart(2, '0')}-01`;
        let nextY = y;
        let nextM = m + 1;
        if (nextM > 12) {
          nextM = 1;
          nextY = y + 1;
        }
        endDateStr = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
        break;
      }
    }

    return { startDateStr, endDateStr };
  }

  private isValidDateString(date?: string): boolean {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const [y, m, d] = date.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }
}

