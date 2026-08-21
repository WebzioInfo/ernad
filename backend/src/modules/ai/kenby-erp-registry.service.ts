import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import {
  customers,
  salesTransactions,
  salesOrders,
  salesPayments,
  rawMaterials,
  rawMaterialTransactions,
  products,
  productionStock,
  vendors,
  purchaseOrders,
  productionBatches,
  downtimeLogs,
  productBrands,
  inventoryStock,
  warehouseLocations,
  billOfMaterials,
  incidents,
  incidentTypes,
  productionLines,
  goodsReceipts,
  goodsReceiptItems,
  users,
} from '../../database/schema';
import { eq, ilike, and, desc, asc, isNull, sql, lte, lt, gt, not } from 'drizzle-orm';
import { SalesSummaryPeriodInput } from './kenby-live-data.service';

export interface CustomerPaymentItem {
  id: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string | null;
  orderNumber: string | null;
  remarks: string | null;
}

export interface CustomerLedgerResult {
  customer: { id: string; name: string; openingBalance: number; openingBalanceType: string };
  entries: Array<{
    date: string;
    reference: string;
    description: string;
    debit: number;
    credit: number;
    balanceAfter?: number;
    transactionType: string;
  }>;
  totalDebits: number;
  totalCredits: number;
  netBalance: number;
}

export interface ProductBomResult {
  product: { id: string; name: string; sku: string | null };
  components: Array<{
    itemName: string;
    materialType: string | null;
    quantityPerUnit: number;
    unit: string;
    availableStock: number;
  }>;
}

export interface CustomerProfileResult {
  customer: {
    id: string;
    name: string;
    code: string | null;
    businessName: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    customerType: string;
    status: string;
    creditLimit: number;
    openingBalance: number;
    openingBalanceType: string;
    paymentTerms: string | null;
  };
  financials: {
    openingBalance: number;
    totalSalesDispatchedCases: number;
    totalSalesDispatchedValue: number;
    totalReturnsCases: number;
    estimatedOutstanding: number;
  };
  purchasedProducts: Array<{
    productId: string;
    productName: string;
    quantityCases: number;
    transactionCount: number;
  }>;
  recentTransactions: Array<{
    id: string;
    type: string;
    salesDate: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
  lastTransactionDate: string | null;
}

export interface RawMaterialStockItem {
  id: string;
  name: string;
  materialType: string; // PREFORM, CAP, LABEL, SHRINK, OTHER
  unit: string; // BAG, BOX, KG, ROLL, PIECE
  currentStock: number;
}

export interface RawMaterialProfileResult {
  material: RawMaterialStockItem;
  recentTransactions: Array<{
    id: string;
    type: string;
    quantityChange: number;
    balanceAfter: number;
    remarks: string | null;
    createdAt: Date;
  }>;
}

export interface ProductFullProfileResult {
  product: {
    id: string;
    name: string;
    category: string | null;
    unitsPerCase: number | null;
    brandName: string | null;
  };
  inventory: {
    currentStockCases: number;
    totalProducedCases: number;
    totalDispatchedCases: number;
  };
  sales: {
    thisMonthCases: number;
    totalAllTimeCases: number;
    transactionCount: number;
  };
  quality: {
    totalReturnsCases: number;
    totalDamageCases: number;
  };
  recentDispatches: Array<{
    salesDate: string;
    customerName: string | null;
    quantity: number;
  }>;
}

@Injectable()
export class KenbyErpRegistryService {
  private readonly logger = new Logger(KenbyErpRegistryService.name);

  // ==========================================
  // 1. CUSTOMER INTELLIGENCE
  // ==========================================

  async getCustomerCount(): Promise<{ total: number; active: number }> {
    const res = await db
      .select({
        status: customers.status,
        count: sql<number>`count(*)::int`,
      })
      .from(customers)
      .where(isNull(customers.deletedAt))
      .groupBy(customers.status);

    let total = 0;
    let active = 0;
    for (const r of res) {
      total += Number(r.count);
      if (r.status === 'ACTIVE') {
        active += Number(r.count);
      }
    }
    return { total, active };
  }

  async listCustomers(status?: string, limit: number = 20): Promise<Array<{ id: string; name: string; code: string | null; phone: string | null; status: string; openingBalance: number }>> {
    const conditions = [isNull(customers.deletedAt)];
    if (status) {
      conditions.push(eq(customers.status, status.toUpperCase()));
    }

    const rows = await db
      .select({
        id: customers.id,
        name: customers.name,
        code: customers.code,
        phone: customers.phone,
        status: customers.status,
        openingBalance: customers.openingBalance,
      })
      .from(customers)
      .where(and(...conditions))
      .orderBy(asc(customers.name))
      .limit(limit);

    return rows.map((r) => ({
      ...r,
      openingBalance: Number(r.openingBalance || 0),
    }));
  }

  async findCustomer(query: string): Promise<any | null> {
    const trimmed = query.trim();
    if (!trimmed) return null;

    // 1. Exact match
    const exact = await db
      .select()
      .from(customers)
      .where(and(isNull(customers.deletedAt), ilike(customers.name, trimmed)))
      .limit(1);

    if (exact.length > 0) return exact[0];

    // 2. Fuzzy substring match
    const substring = await db
      .select()
      .from(customers)
      .where(and(isNull(customers.deletedAt), ilike(customers.name, `%${trimmed}%`)))
      .limit(1);

    if (substring.length > 0) return substring[0];

    // 3. Search code or phone
    const byCode = await db
      .select()
      .from(customers)
      .where(and(isNull(customers.deletedAt), ilike(customers.code, `%${trimmed}%`)))
      .limit(1);

    if (byCode.length > 0) return byCode[0];

    return null;
  }

  async getCustomerProfile(customerIdentifier: string): Promise<CustomerProfileResult | null> {
    const cust = await this.findCustomer(customerIdentifier);
    if (!cust) return null;

    // Get all transactions for this customer
    const txs = await db
      .select({
        id: salesTransactions.id,
        type: salesTransactions.type,
        salesDate: salesTransactions.salesDate,
        quantity: salesTransactions.quantity,
        unitPrice: salesTransactions.unitPrice,
        productId: salesTransactions.productId,
        productName: products.name,
      })
      .from(salesTransactions)
      .leftJoin(products, eq(salesTransactions.productId, products.id))
      .where(eq(salesTransactions.customerId, cust.id))
      .orderBy(desc(salesTransactions.salesDate))
      .limit(50);

    let totalDispatchedCases = 0;
    let totalDispatchedValue = 0;
    let totalReturnsCases = 0;

    const prodMap: Record<string, { productId: string; productName: string; quantityCases: number; transactionCount: number }> = {};

    for (const t of txs) {
      const q = Number(t.quantity || 0);
      const price = Number(t.unitPrice || 0);
      if (t.type === 'SALES_DISPATCH') {
        totalDispatchedCases += q;
        totalDispatchedValue += q * price;

        if (t.productId) {
          if (!prodMap[t.productId]) {
            prodMap[t.productId] = {
              productId: t.productId,
              productName: t.productName || 'Unknown Product',
              quantityCases: 0,
              transactionCount: 0,
            };
          }
          prodMap[t.productId].quantityCases += q;
          prodMap[t.productId].transactionCount += 1;
        }
      } else if (t.type === 'RETURN') {
        totalReturnsCases += q;
      }
    }

    const purchasedProducts = Object.values(prodMap).sort((a, b) => b.quantityCases - a.quantityCases);
    const openingBalance = Number(cust.openingBalance || 0);
    const estimatedOutstanding = openingBalance + totalDispatchedValue;

    return {
      customer: {
        id: cust.id,
        name: cust.name,
        code: cust.code,
        businessName: cust.businessName,
        phone: cust.phone,
        email: cust.email,
        address: cust.address || cust.billingAddress,
        customerType: cust.customerType,
        status: cust.status,
        creditLimit: Number(cust.creditLimit || 0),
        openingBalance,
        openingBalanceType: cust.openingBalanceType,
        paymentTerms: cust.paymentTerms,
      },
      financials: {
        openingBalance,
        totalSalesDispatchedCases: totalDispatchedCases,
        totalSalesDispatchedValue: totalDispatchedValue,
        totalReturnsCases,
        estimatedOutstanding,
      },
      purchasedProducts,
      recentTransactions: txs.slice(0, 5).map((t) => ({
        id: t.id,
        type: t.type,
        salesDate: t.salesDate ? t.salesDate.toString() : '',
        productName: t.productName || 'General Product',
        quantity: Number(t.quantity || 0),
        unitPrice: Number(t.unitPrice || 0),
      })),
      lastTransactionDate: txs.length > 0 && txs[0].salesDate ? txs[0].salesDate.toString() : null,
    };
  }

  async getCustomerDebtRanking(limit: number = 10): Promise<Array<{ id: string; name: string; code: string | null; openingBalance: number; status: string }>> {
    const rows = await db
      .select({
        id: customers.id,
        name: customers.name,
        code: customers.code,
        openingBalance: customers.openingBalance,
        status: customers.status,
      })
      .from(customers)
      .where(isNull(customers.deletedAt))
      .orderBy(desc(customers.openingBalance))
      .limit(limit);

    return rows.map((r) => ({
      ...r,
      openingBalance: Number(r.openingBalance || 0),
    }));
  }

  async getTopCustomersBySales(periodInput?: SalesSummaryPeriodInput, limit: number = 10): Promise<Array<{ customerId: string; customerName: string; totalCases: number; transactionCount: number }>> {
    let dateFilter = sql`1=1`;
    if (periodInput) {
      if (periodInput.period === 'specific_month' && periodInput.year && periodInput.month) {
        const start = `${periodInput.year}-${String(periodInput.month).padStart(2, '0')}-01`;
        const endMonth = periodInput.month === 12 ? 1 : periodInput.month + 1;
        const endYear = periodInput.month === 12 ? periodInput.year + 1 : periodInput.year;
        const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
        dateFilter = sql`${salesTransactions.salesDate} >= ${start}::date AND ${salesTransactions.salesDate} < ${end}::date`;
      } else if (periodInput.period === 'this_month') {
        dateFilter = sql`${salesTransactions.salesDate} >= date_trunc('month', CURRENT_DATE) AND ${salesTransactions.salesDate} < date_trunc('month', CURRENT_DATE) + interval '1 month'`;
      }
    }

    const rows = await db
      .select({
        customerId: salesTransactions.customerId,
        customerName: customers.name,
        totalCases: sql<number>`COALESCE(SUM(${salesTransactions.quantity}), 0)::int`,
        transactionCount: sql<number>`count(*)::int`,
      })
      .from(salesTransactions)
      .leftJoin(customers, eq(salesTransactions.customerId, customers.id))
      .where(and(eq(salesTransactions.type, 'SALES_DISPATCH'), dateFilter, sql`${salesTransactions.customerId} IS NOT NULL`))
      .groupBy(salesTransactions.customerId, customers.name)
      .orderBy(desc(sql`SUM(${salesTransactions.quantity})`))
      .limit(limit);

    return rows.map((r) => ({
      customerId: r.customerId || '',
      customerName: r.customerName || 'Unknown Customer',
      totalCases: Number(r.totalCases || 0),
      transactionCount: Number(r.transactionCount || 0),
    }));
  }

  // ==========================================
  // 2. RAW MATERIAL INTELLIGENCE
  // ==========================================

  async getRawMaterialsStock(typeFilter?: string): Promise<{ items: RawMaterialStockItem[]; totalQuantity: number; byType: Record<string, number> }> {
    const conditions = [];
    if (typeFilter) {
      conditions.push(eq(rawMaterials.materialType, typeFilter.toUpperCase()));
    }

    const rows = await db
      .select({
        id: rawMaterials.id,
        name: rawMaterials.name,
        materialType: rawMaterials.materialType,
        unit: rawMaterials.unit,
        currentStock: rawMaterials.currentStock,
      })
      .from(rawMaterials)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(rawMaterials.materialType), asc(rawMaterials.name));

    let totalQuantity = 0;
    const byType: Record<string, number> = {};

    const items: RawMaterialStockItem[] = rows.map((r) => {
      const qty = Number(r.currentStock || 0);
      totalQuantity += qty;
      const t = r.materialType.toUpperCase();
      byType[t] = (byType[t] || 0) + qty;
      return {
        id: r.id,
        name: r.name,
        materialType: r.materialType,
        unit: r.unit,
        currentStock: qty,
      };
    });

    return { items, totalQuantity, byType };
  }

  async findRawMaterial(query: string): Promise<RawMaterialStockItem | null> {
    const trimmed = query.trim().toUpperCase();
    if (!trimmed) return null;

    // 1. Exact name match
    const exact = await db
      .select()
      .from(rawMaterials)
      .where(ilike(rawMaterials.name, trimmed))
      .limit(1);

    if (exact.length > 0) {
      return {
        id: exact[0].id,
        name: exact[0].name,
        materialType: exact[0].materialType,
        unit: exact[0].unit,
        currentStock: Number(exact[0].currentStock || 0),
      };
    }

    // 2. Substring match
    const substring = await db
      .select()
      .from(rawMaterials)
      .where(ilike(rawMaterials.name, `%${trimmed}%`))
      .limit(1);

    if (substring.length > 0) {
      return {
        id: substring[0].id,
        name: substring[0].name,
        materialType: substring[0].materialType,
        unit: substring[0].unit,
        currentStock: Number(substring[0].currentStock || 0),
      };
    }

    // 3. Match by Material Type (PREFORM, CAP, LABEL, SHRINK)
    const byType = await db
      .select()
      .from(rawMaterials)
      .where(ilike(rawMaterials.materialType, `%${trimmed}%`))
      .limit(1);

    if (byType.length > 0) {
      return {
        id: byType[0].id,
        name: byType[0].name,
        materialType: byType[0].materialType,
        unit: byType[0].unit,
        currentStock: Number(byType[0].currentStock || 0),
      };
    }

    return null;
  }

  async getRawMaterialProfile(materialIdentifier: string): Promise<RawMaterialProfileResult | null> {
    const mat = await this.findRawMaterial(materialIdentifier);
    if (!mat) return null;

    const txs = await db
      .select({
        id: rawMaterialTransactions.id,
        type: rawMaterialTransactions.type,
        quantityChange: rawMaterialTransactions.quantityChange,
        balanceAfter: rawMaterialTransactions.balanceAfter,
        remarks: rawMaterialTransactions.remarks,
        createdAt: rawMaterialTransactions.createdAt,
      })
      .from(rawMaterialTransactions)
      .where(eq(rawMaterialTransactions.materialId, mat.id))
      .orderBy(desc(rawMaterialTransactions.createdAt))
      .limit(10);

    return {
      material: mat,
      recentTransactions: txs.map((t) => ({
        id: t.id,
        type: t.type,
        quantityChange: Number(t.quantityChange || 0),
        balanceAfter: Number(t.balanceAfter || 0),
        remarks: t.remarks,
        createdAt: t.createdAt,
      })),
    };
  }

  async getLowStockRawMaterials(threshold: number = 0): Promise<RawMaterialStockItem[]> {
    const rows = await db
      .select({
        id: rawMaterials.id,
        name: rawMaterials.name,
        materialType: rawMaterials.materialType,
        unit: rawMaterials.unit,
        currentStock: rawMaterials.currentStock,
      })
      .from(rawMaterials)
      .where(sql`${rawMaterials.currentStock} <= ${threshold}`)
      .orderBy(asc(rawMaterials.currentStock));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      materialType: r.materialType,
      unit: r.unit,
      currentStock: Number(r.currentStock || 0),
    }));
  }

  // ==========================================
  // 3. PRODUCT INTELLIGENCE
  // ==========================================

  async findProduct(query: string): Promise<any | null> {
    const trimmed = query.trim();
    if (!trimmed) return null;

    // 1. Exact name match
    const exact = await db
      .select({
        id: products.id,
        name: products.name,
        category: products.category,
        unitsPerCase: products.unitsPerCase,
        brandName: productBrands.name,
      })
      .from(products)
      .leftJoin(productBrands, eq(products.brandId, productBrands.id))
      .where(ilike(products.name, trimmed))
      .limit(1);

    if (exact.length > 0) return exact[0];

    // 2. Substring match
    const sub = await db
      .select({
        id: products.id,
        name: products.name,
        category: products.category,
        unitsPerCase: products.unitsPerCase,
        brandName: productBrands.name,
      })
      .from(products)
      .leftJoin(productBrands, eq(products.brandId, productBrands.id))
      .where(ilike(products.name, `%${trimmed}%`))
      .limit(1);

    if (sub.length > 0) return sub[0];

    return null;
  }

  async getProductFullProfile(productIdentifier: string): Promise<ProductFullProfileResult | null> {
    const prod = await this.findProduct(productIdentifier);
    if (!prod) return null;

    // 1. Production Stock
    const pStock = await db
      .select()
      .from(productionStock)
      .where(eq(productionStock.productId, prod.id))
      .limit(1);

    const currentStockCases = pStock.length > 0 ? Number(pStock[0].currentStock || 0) : 0;
    const totalProducedCases = pStock.length > 0 ? Number(pStock[0].totalProduced || 0) : 0;
    const totalDispatchedCases = pStock.length > 0 ? Number(pStock[0].totalDispatched || 0) : 0;

    // 2. Sales Transactions
    const txs = await db
      .select({
        id: salesTransactions.id,
        type: salesTransactions.type,
        salesDate: salesTransactions.salesDate,
        quantity: salesTransactions.quantity,
        customerId: salesTransactions.customerId,
        customerName: customers.name,
      })
      .from(salesTransactions)
      .leftJoin(customers, eq(salesTransactions.customerId, customers.id))
      .where(eq(salesTransactions.productId, prod.id))
      .orderBy(desc(salesTransactions.salesDate));

    let totalAllTimeSales = 0;
    let thisMonthSales = 0;
    let totalReturns = 0;
    let totalDamage = 0;
    let dispatchTxCount = 0;

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;

    for (const t of txs) {
      const q = Number(t.quantity || 0);
      if (t.type === 'SALES_DISPATCH') {
        totalAllTimeSales += q;
        dispatchTxCount += 1;
        if (t.salesDate) {
          const d = new Date(t.salesDate);
          if (d.getFullYear() === curYear && d.getMonth() + 1 === curMonth) {
            thisMonthSales += q;
          }
        }
      } else if (t.type === 'RETURN') {
        totalReturns += q;
      } else if (t.type === 'DAMAGE') {
        totalDamage += q;
      }
    }

    const recentDispatches = txs
      .filter((t) => t.type === 'SALES_DISPATCH')
      .slice(0, 5)
      .map((t) => ({
        salesDate: t.salesDate ? t.salesDate.toString() : '',
        customerName: t.customerName || null,
        quantity: Number(t.quantity || 0),
      }));

    return {
      product: {
        id: prod.id,
        name: prod.name,
        category: prod.category,
        unitsPerCase: prod.unitsPerCase,
        brandName: prod.brandName,
      },
      inventory: {
        currentStockCases,
        totalProducedCases,
        totalDispatchedCases,
      },
      sales: {
        thisMonthCases: thisMonthSales,
        totalAllTimeCases: totalAllTimeSales,
        transactionCount: dispatchTxCount,
      },
      quality: {
        totalReturnsCases: totalReturns,
        totalDamageCases: totalDamage,
      },
      recentDispatches,
    };
  }

  // ==========================================
  // 4. PROCUREMENT & VENDORS
  // ==========================================

  async listVendors(): Promise<Array<{ id: string; name: string; code: string | null; phone: string | null }>> {
    const rows = await db
      .select({
        id: vendors.id,
        name: vendors.name,
        code: vendors.code,
        phone: vendors.phone,
      })
      .from(vendors)
      .orderBy(asc(vendors.name))
      .limit(20);

    return rows;
  }

  async getPurchaseOrdersSummary(): Promise<{ totalCount: number; pendingCount: number; totalValue: number }> {
    const rows = await db
      .select({
        status: purchaseOrders.status,
        totalAmount: purchaseOrders.totalAmount,
      })
      .from(purchaseOrders);

    let totalCount = rows.length;
    let pendingCount = 0;
    let totalValue = 0;

    for (const r of rows) {
      const val = Number(r.totalAmount || 0);
      totalValue += val;
      if (r.status === 'PENDING_APPROVAL' || r.status === 'DRAFT' || r.status === 'SENT') {
        pendingCount += 1;
      }
    }

    return { totalCount, pendingCount, totalValue };
  }

  // ==========================================
  // 5. PRODUCTION BATCHES & DOWNTIME
  // ==========================================

  async getBatchesSummary(): Promise<{ runningCount: number; completedCount: number; recentBatches: Array<{ batchCode: string; status: string; targetQuantity: number | null }> }> {
    const rows = await db
      .select({
        id: productionBatches.id,
        batchCode: productionBatches.batchCode,
        status: productionBatches.status,
        targetQuantity: productionBatches.targetQuantity,
      })
      .from(productionBatches)
      .where(isNull(productionBatches.deletedAt))
      .orderBy(desc(productionBatches.createdAt))
      .limit(10);

    let runningCount = 0;
    let completedCount = 0;

    for (const r of rows) {
      if (r.status === 'RUNNING') runningCount += 1;
      if (r.status === 'COMPLETED' || r.status === 'CLOSED') completedCount += 1;
    }

    return {
      runningCount,
      completedCount,
      recentBatches: rows.slice(0, 5),
    };
  }

  async getDowntimeSummary(): Promise<{ incidentCount: number; recentReasons: string[] }> {
    const rows = await db
      .select({
        id: downtimeLogs.id,
        reason: downtimeLogs.reason,
        station: downtimeLogs.station,
      })
      .from(downtimeLogs)
      .orderBy(desc(downtimeLogs.startTime))
      .limit(10);

    const reasons = Array.from(new Set(rows.map((r) => r.reason)));
    return {
      incidentCount: rows.length,
      recentReasons: reasons,
    };
  }

  // ==========================================
  // 6. INVENTORY STOCK (WAREHOUSE-LEVEL)
  // ==========================================

  async getInventoryStockSummary(): Promise<{
    items: Array<{ itemName: string; materialType: string | null; quantity: number; unit: string; minimumStock: number; warehouseName: string | null }>;
    totalItems: number;
    lowStockItems: string[];
  }> {
    const rows = await db
      .select({
        itemName: inventoryStock.itemName,
        materialType: inventoryStock.materialType,
        quantity: inventoryStock.quantity,
        unit: inventoryStock.unit,
        minimumStock: inventoryStock.minimumStock,
        warehouseName: warehouseLocations.name,
      })
      .from(inventoryStock)
      .leftJoin(warehouseLocations, eq(inventoryStock.warehouseId, warehouseLocations.id))
      .orderBy(asc(inventoryStock.itemName));

    const items = rows.map((r) => ({
      itemName: r.itemName,
      materialType: r.materialType,
      quantity: Number(r.quantity || 0),
      unit: r.unit,
      minimumStock: Number(r.minimumStock || 0),
      warehouseName: r.warehouseName || null,
    }));

    const lowStockItems = items
      .filter((i) => i.quantity <= i.minimumStock && i.minimumStock > 0)
      .map((i) => i.itemName);

    return { items, totalItems: items.length, lowStockItems };
  }

  // ==========================================
  // 7. CUSTOMER TRANSACTIONS BY PERIOD
  // ==========================================

  async getCustomerTransactionsByPeriod(
    customerIdentifier: string,
    periodInput?: SalesSummaryPeriodInput
  ): Promise<{
    customer: { id: string; name: string } | null;
    transactions: Array<{ type: string; salesDate: string; productName: string; quantity: number; unitPrice: number }>;
    totalCases: number;
    period: string;
  }> {
    const cust = await this.findCustomer(customerIdentifier);
    if (!cust) return { customer: null, transactions: [], totalCases: 0, period: 'unknown' };

    let dateFilter = sql`1=1`;
    let periodLabel = 'all time';

    if (periodInput) {
      const now = new Date();
      if (periodInput.period === 'specific_month' && periodInput.year && periodInput.month) {
        const start = `${periodInput.year}-${String(periodInput.month).padStart(2, '0')}-01`;
        const endMonth = periodInput.month === 12 ? 1 : periodInput.month + 1;
        const endYear = periodInput.month === 12 ? periodInput.year + 1 : periodInput.year;
        const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
        dateFilter = sql`${salesTransactions.salesDate} >= ${start}::date AND ${salesTransactions.salesDate} < ${end}::date`;
        periodLabel = `${periodInput.year}-${String(periodInput.month).padStart(2, '0')}`;
      } else if (periodInput.period === 'this_month') {
        dateFilter = sql`${salesTransactions.salesDate} >= date_trunc('month', CURRENT_DATE) AND ${salesTransactions.salesDate} < date_trunc('month', CURRENT_DATE) + interval '1 month'`;
        periodLabel = 'this month';
      } else if (periodInput.period === 'today') {
        dateFilter = sql`${salesTransactions.salesDate} = CURRENT_DATE`;
        periodLabel = 'today';
      } else if (periodInput.period === 'yesterday') {
        dateFilter = sql`${salesTransactions.salesDate} = CURRENT_DATE - 1`;
        periodLabel = 'yesterday';
      } else if (periodInput.period === 'last_month') {
        dateFilter = sql`${salesTransactions.salesDate} >= date_trunc('month', CURRENT_DATE - interval '1 month') AND ${salesTransactions.salesDate} < date_trunc('month', CURRENT_DATE)`;
        periodLabel = 'last month';
      }
    }

    const txs = await db
      .select({
        type: salesTransactions.type,
        salesDate: salesTransactions.salesDate,
        quantity: salesTransactions.quantity,
        unitPrice: salesTransactions.unitPrice,
        productName: products.name,
      })
      .from(salesTransactions)
      .leftJoin(products, eq(salesTransactions.productId, products.id))
      .where(and(eq(salesTransactions.customerId, cust.id), dateFilter))
      .orderBy(desc(salesTransactions.salesDate))
      .limit(20);

    let totalCases = 0;
    const txList = txs.map((t) => {
      const q = Number(t.quantity || 0);
      if (t.type === 'SALES_DISPATCH') totalCases += q;
      return {
        type: t.type,
        salesDate: t.salesDate ? t.salesDate.toString() : '',
        productName: t.productName || 'Unknown Product',
        quantity: q,
        unitPrice: Number(t.unitPrice || 0),
      };
    });

    return {
      customer: { id: cust.id, name: cust.name },
      transactions: txList,
      totalCases,
      period: periodLabel,
    };
  }

  // ==========================================
  // 8. FINISHED GOODS STOCK INTELLIGENCE
  // ==========================================

  async getLowStockProducts(threshold: number = 50): Promise<Array<{ productName: string; currentStock: number }>> {
    const rows = await db
      .select({
        productName: products.name,
        currentStock: productionStock.currentStock,
      })
      .from(productionStock)
      .leftJoin(products, eq(productionStock.productId, products.id))
      .where(lte(productionStock.currentStock, String(threshold)))
      .orderBy(asc(productionStock.currentStock));

    return rows.map((r) => ({
      productName: r.productName || 'Unknown Product',
      currentStock: Number(r.currentStock || 0),
    }));
  }

  async getHighestStockProduct(): Promise<{ productName: string; currentStock: number } | null> {
    const rows = await db
      .select({
        productName: products.name,
        currentStock: productionStock.currentStock,
      })
      .from(productionStock)
      .leftJoin(products, eq(productionStock.productId, products.id))
      .orderBy(desc(productionStock.currentStock))
      .limit(1);

    if (rows.length === 0) return null;
    return {
      productName: rows[0].productName || 'Unknown Product',
      currentStock: Number(rows[0].currentStock || 0),
    };
  }

  async getBestSellingProduct(periodInput?: SalesSummaryPeriodInput): Promise<Array<{ productName: string; totalCases: number }>> {
    let dateFilter = sql`${salesTransactions.type} = 'SALES_DISPATCH'`;

    if (periodInput) {
      if (periodInput.period === 'specific_month' && periodInput.year && periodInput.month) {
        const start = `${periodInput.year}-${String(periodInput.month).padStart(2, '0')}-01`;
        const endMonth = periodInput.month === 12 ? 1 : periodInput.month + 1;
        const endYear = periodInput.month === 12 ? periodInput.year + 1 : periodInput.year;
        const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
        dateFilter = sql`${salesTransactions.type} = 'SALES_DISPATCH' AND ${salesTransactions.salesDate} >= ${start}::date AND ${salesTransactions.salesDate} < ${end}::date`;
      } else if (periodInput.period === 'this_month') {
        dateFilter = sql`${salesTransactions.type} = 'SALES_DISPATCH' AND ${salesTransactions.salesDate} >= date_trunc('month', CURRENT_DATE) AND ${salesTransactions.salesDate} < date_trunc('month', CURRENT_DATE) + interval '1 month'`;
      } else if (periodInput.period === 'today') {
        dateFilter = sql`${salesTransactions.type} = 'SALES_DISPATCH' AND ${salesTransactions.salesDate} = CURRENT_DATE`;
      }
    }

    const rows = await db
      .select({
        productName: products.name,
        totalCases: sql<number>`COALESCE(SUM(${salesTransactions.quantity}), 0)::int`,
      })
      .from(salesTransactions)
      .leftJoin(products, eq(salesTransactions.productId, products.id))
      .where(dateFilter)
      .groupBy(salesTransactions.productId, products.name)
      .orderBy(desc(sql`SUM(${salesTransactions.quantity})`))
      .limit(5);

    return rows.map((r) => ({
      productName: r.productName || 'Unknown Product',
      totalCases: Number(r.totalCases || 0),
    }));
  }

  async getProductStockByName(productIdentifier: string): Promise<{ productName: string; currentStock: number; unit: string } | null> {
    const prod = await this.findProduct(productIdentifier);
    if (!prod) return null;

    const pStock = await db
      .select({ currentStock: productionStock.currentStock })
      .from(productionStock)
      .where(eq(productionStock.productId, prod.id))
      .limit(1);

    const currentStock = pStock.length > 0 ? Number(pStock[0].currentStock || 0) : 0;
    const unit = prod.name?.toLowerCase().includes('jar') ? 'jars' : 'cases';

    return { productName: prod.name, currentStock, unit };
  }

  async listAllProducts(): Promise<Array<{ id: string; name: string; category: string | null; currentStock: number }>> {
    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        category: products.category,
        currentStock: productionStock.currentStock,
      })
      .from(products)
      .leftJoin(productionStock, eq(productionStock.productId, products.id))
      .orderBy(asc(products.name));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      currentStock: Number(r.currentStock || 0),
    }));
  }

  // ==========================================
  // 9. CUSTOMER PAYMENTS & LEDGER
  // ==========================================

  async getCustomerPayments(customerIdentifier: string): Promise<{
    customer: { id: string; name: string } | null;
    payments: CustomerPaymentItem[];
    totalPaid: number;
  }> {
    const cust = await this.findCustomer(customerIdentifier);
    if (!cust) return { customer: null, payments: [], totalPaid: 0 };

    const rows = await db
      .select({
        id: salesPayments.id,
        amount: salesPayments.amount,
        paymentDate: salesPayments.paymentDate,
        paymentMethod: salesPayments.paymentMethod,
        referenceNumber: salesPayments.referenceNumber,
        remarks: salesPayments.remarks,
        orderNumber: salesOrders.orderNumber,
      })
      .from(salesPayments)
      .innerJoin(salesOrders, eq(salesPayments.orderId, salesOrders.id))
      .where(eq(salesOrders.customerId, cust.id))
      .orderBy(desc(salesPayments.paymentDate))
      .limit(20);

    let totalPaid = 0;
    const paymentsList: CustomerPaymentItem[] = rows.map((r) => {
      const amt = Number(r.amount || 0);
      totalPaid += amt;
      return {
        id: r.id,
        amount: amt,
        paymentDate: r.paymentDate ? r.paymentDate.toISOString().split('T')[0] : '',
        paymentMethod: r.paymentMethod,
        referenceNumber: r.referenceNumber || null,
        orderNumber: r.orderNumber || null,
        remarks: r.remarks || null,
      };
    });

    return {
      customer: { id: cust.id, name: cust.name },
      payments: paymentsList,
      totalPaid,
    };
  }

  async getCustomerLedgerStatement(customerIdentifier: string): Promise<CustomerLedgerResult | null> {
    const cust = await this.findCustomer(customerIdentifier);
    if (!cust) return null;

    const openBal = Number(cust.openingBalance || 0);
    const openType = cust.openingBalanceType || 'DEBIT';

    const entries: CustomerLedgerResult['entries'] = [
      {
        date: cust.createdAt ? cust.createdAt.toISOString().split('T')[0] : '',
        reference: 'OPEN-BAL',
        description: 'Opening Balance',
        debit: openType === 'DEBIT' ? openBal : 0,
        credit: openType === 'CREDIT' ? openBal : 0,
        transactionType: 'opening',
      },
    ];

    // Fetch invoices / orders
    const orders = await db
      .select({
        id: salesOrders.id,
        orderNumber: salesOrders.orderNumber,
        orderDate: salesOrders.orderDate,
        totalAmount: salesOrders.totalAmount,
        status: salesOrders.status,
      })
      .from(salesOrders)
      .where(and(eq(salesOrders.customerId, cust.id), not(eq(salesOrders.status, 'CANCELLED'))))
      .orderBy(asc(salesOrders.orderDate));

    for (const o of orders) {
      entries.push({
        date: o.orderDate ? o.orderDate.toISOString().split('T')[0] : '',
        reference: o.orderNumber,
        description: `Invoice Order (${o.status})`,
        debit: Number(o.totalAmount || 0),
        credit: 0,
        transactionType: 'sale',
      });
    }

    // Fetch payments
    const payments = await db
      .select({
        id: salesPayments.id,
        amount: salesPayments.amount,
        paymentDate: salesPayments.paymentDate,
        paymentMethod: salesPayments.paymentMethod,
        referenceNumber: salesPayments.referenceNumber,
        orderNumber: salesOrders.orderNumber,
      })
      .from(salesPayments)
      .innerJoin(salesOrders, eq(salesPayments.orderId, salesOrders.id))
      .where(eq(salesOrders.customerId, cust.id))
      .orderBy(asc(salesPayments.paymentDate));

    for (const p of payments) {
      entries.push({
        date: p.paymentDate ? p.paymentDate.toISOString().split('T')[0] : '',
        reference: p.referenceNumber || p.id.substring(0, 8),
        description: `Payment (${p.paymentMethod})`,
        debit: 0,
        credit: Number(p.amount || 0),
        transactionType: 'payment',
      });
    }

    let totalDebits = 0;
    let totalCredits = 0;
    for (const e of entries) {
      totalDebits += e.debit;
      totalCredits += e.credit;
    }

    return {
      customer: {
        id: cust.id,
        name: cust.name,
        openingBalance: openBal,
        openingBalanceType: openType,
      },
      entries,
      totalDebits,
      totalCredits,
      netBalance: totalDebits - totalCredits,
    };
  }

  // ==========================================
  // 10. PRODUCT BILL OF MATERIALS (BOM)
  // ==========================================

  async getProductBom(productIdentifier: string): Promise<ProductBomResult | null> {
    const prod = await this.findProduct(productIdentifier);
    if (!prod) return null;

    const rows = await db
      .select({
        itemName: inventoryStock.itemName,
        materialType: inventoryStock.materialType,
        quantityPerUnit: billOfMaterials.quantityPerUnit,
        unit: inventoryStock.unit,
        availableStock: inventoryStock.quantity,
      })
      .from(billOfMaterials)
      .innerJoin(inventoryStock, eq(billOfMaterials.stockId, inventoryStock.id))
      .where(eq(billOfMaterials.productId, prod.id));

    const components = rows.map((r) => ({
      itemName: r.itemName,
      materialType: r.materialType,
      quantityPerUnit: Number(r.quantityPerUnit || 0),
      unit: r.unit,
      availableStock: Number(r.availableStock || 0),
    }));

    return {
      product: { id: prod.id, name: prod.name, sku: prod.sku },
      components,
    };
  }

  // ==========================================
  // 11. PLANT INCIDENTS & BREAKDOWN TICKETS
  // ==========================================

  async getIncidentsSummary(statusFilter?: string): Promise<{
    totalOpenCount: number;
    openIncidents: Array<{
      id: string;
      incidentNumber: string;
      title: string;
      priority: string;
      status: string;
      lineName: string | null;
      openedAt: string;
    }>;
  }> {
    const conditions = [isNull(incidents.deletedAt)];
    if (statusFilter) {
      conditions.push(eq(incidents.status, statusFilter.toUpperCase() as any));
    } else {
      conditions.push(not(eq(incidents.status, 'CLOSED' as any)));
    }

    const rows = await db
      .select({
        id: incidents.id,
        incidentNumber: incidents.incidentNumber,
        title: incidents.title,
        priority: incidents.priority,
        status: incidents.status,
        lineName: productionLines.name,
        openedAt: incidents.openedAt,
      })
      .from(incidents)
      .leftJoin(productionLines, eq(incidents.lineId, productionLines.id))
      .where(and(...conditions))
      .orderBy(desc(incidents.openedAt))
      .limit(10);

    return {
      totalOpenCount: rows.length,
      openIncidents: rows.map((r) => ({
        id: r.id,
        incidentNumber: r.incidentNumber,
        title: r.title,
        priority: r.priority,
        status: r.status,
        lineName: r.lineName || null,
        openedAt: r.openedAt ? r.openedAt.toISOString().split('T')[0] : '',
      })),
    };
  }

  // ==========================================
  // 12. GOODS RECEIPTS (GRN)
  // ==========================================

  async getGoodsReceiptsSummary(): Promise<Array<{
    id: string;
    grnNumber: string;
    vendorName: string;
    receivedDate: string;
    status: string;
  }>> {
    const rows = await db
      .select({
        id: goodsReceipts.id,
        grnNumber: goodsReceipts.grnNumber,
        vendorName: vendors.name,
        receivedDate: goodsReceipts.receivedDate,
        status: goodsReceipts.status,
      })
      .from(goodsReceipts)
      .leftJoin(vendors, eq(goodsReceipts.vendorId, vendors.id))
      .orderBy(desc(goodsReceipts.receivedDate))
      .limit(10);

    return rows.map((r) => ({
      id: r.id,
      grnNumber: r.grnNumber,
      vendorName: r.vendorName || 'Unknown Supplier',
      receivedDate: r.receivedDate ? r.receivedDate.toISOString().split('T')[0] : '',
      status: r.status,
    }));
  }

  // ==========================================
  // 13. NAMED PRODUCTION BATCH DETAILS
  // ==========================================

  async getNamedBatchDetails(batchCode: string): Promise<{
    batch: {
      id: string;
      batchCode: string;
      status: string;
      productName: string | null;
      lineName: string | null;
      targetQuantity: number | null;
      startTime: string | null;
    } | null;
  }> {
    const [row] = await db
      .select({
        id: productionBatches.id,
        batchCode: productionBatches.batchCode,
        status: productionBatches.status,
        productName: products.name,
        lineName: productionLines.name,
        targetQuantity: productionBatches.targetQuantity,
        startTime: productionBatches.startTime,
      })
      .from(productionBatches)
      .leftJoin(products, eq(productionBatches.productId, products.id))
      .leftJoin(productionLines, eq(productionBatches.lineId, productionLines.id))
      .where(
        and(
          isNull(productionBatches.deletedAt),
          ilike(productionBatches.batchCode, `%${batchCode.trim()}%`)
        )
      )
      .limit(1);

    if (!row) return { batch: null };

    return {
      batch: {
        id: row.id,
        batchCode: row.batchCode,
        status: row.status,
        productName: row.productName || null,
        lineName: row.lineName || null,
        targetQuantity: row.targetQuantity ? Number(row.targetQuantity) : null,
        startTime: row.startTime ? row.startTime.toISOString() : null,
      },
    };
  }

  // ==========================================
  // 14. UNIVERSAL LISTING & ENTITY RESOLUTION
  // ==========================================

  /**
   * Retrieves the dynamic list of all raw materials with stock and unit
   */
  async listAllRawMaterials(): Promise<Array<{ id: string; name: string; materialType: string; unit: string; currentStock: number }>> {
    const rows = await db
      .select({
        id: rawMaterials.id,
        name: rawMaterials.name,
        materialType: rawMaterials.materialType,
        unit: rawMaterials.unit,
        currentStock: rawMaterials.currentStock,
      })
      .from(rawMaterials)
      .orderBy(asc(rawMaterials.name));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      materialType: r.materialType,
      unit: r.unit,
      currentStock: Number(r.currentStock || 0),
    }));
  }

  /**
   * Retrieves the dynamic list of all customers
   */
  async listAllCustomers(limit: number = 50): Promise<Array<{ id: string; name: string; code: string | null; phone: string | null; outstandingBalance: number }>> {
    const rows = await db
      .select({
        id: customers.id,
        name: customers.name,
        code: customers.code,
        phone: customers.phone,
        openingBalance: customers.openingBalance,
      })
      .from(customers)
      .where(isNull(customers.deletedAt))
      .orderBy(asc(customers.name))
      .limit(limit);

    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code || null,
      phone: c.phone || null,
      outstandingBalance: Number(c.openingBalance || 0),
    }));
  }

  /**
   * Retrieves the dynamic list of all vendors
   */
  async listAllVendors(): Promise<Array<{ id: string; name: string; contactPerson: string | null; phone: string | null }>> {
    const rows = await db
      .select({
        id: vendors.id,
        name: vendors.name,
        contactPerson: vendors.contactPerson,
        phone: vendors.phone,
      })
      .from(vendors)
      .orderBy(asc(vendors.name));

    return rows.map((v) => ({
      id: v.id,
      name: v.name,
      contactPerson: v.contactPerson || null,
      phone: v.phone || null,
    }));
  }

  /**
   * Retrieves the dynamic list of all employees / active users
   */
  async listAllEmployees(): Promise<Array<{ id: string; name: string; username: string; department: string | null; jobTitle: string | null; isActive: boolean }>> {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        department: users.department,
        jobTitle: users.jobTitle,
        isActive: users.isActive,
      })
      .from(users)
      .where(isNull(users.deletedAt))
      .orderBy(asc(users.name));

    return rows.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      department: u.department || null,
      jobTitle: u.jobTitle || null,
      isActive: u.isActive,
    }));
  }

  /**
   * Retrieves detailed sales / return / damage transactions
   */
  async getRecentTransactions(filters: {
    date?: string;
    customer?: string;
    product?: string;
    type?: string;
    limit?: number;
  }): Promise<Array<{
    id: string;
    type: string;
    salesDate: string;
    productName: string;
    customerName: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
  }>> {
    const limit = filters.limit || 10;
    const conditions: any[] = [];

    if (filters.type) {
      conditions.push(eq(salesTransactions.type, filters.type as any));
    }
    if (filters.date) {
      conditions.push(sql`${salesTransactions.salesDate} = ${filters.date}::date`);
    }

    const rows = await db
      .select({
        id: salesTransactions.id,
        type: salesTransactions.type,
        salesDate: salesTransactions.salesDate,
        quantity: salesTransactions.quantity,
        unitPrice: salesTransactions.unitPrice,
        productName: products.name,
        customerName: customers.name,
      })
      .from(salesTransactions)
      .leftJoin(products, eq(salesTransactions.productId, products.id))
      .leftJoin(customers, eq(salesTransactions.customerId, customers.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(salesTransactions.salesDate), desc(salesTransactions.createdAt))
      .limit(limit);

    let filtered = rows;
    if (filters.customer) {
      const q = filters.customer.toLowerCase();
      filtered = filtered.filter((r) => (r.customerName || '').toLowerCase().includes(q));
    }
    if (filters.product) {
      const q = filters.product.toLowerCase();
      filtered = filtered.filter((r) => (r.productName || '').toLowerCase().includes(q));
    }

    return filtered.map((r) => ({
      id: r.id,
      type: r.type,
      salesDate: typeof r.salesDate === 'string' ? r.salesDate : (r.salesDate as any)?.toISOString ? (r.salesDate as any).toISOString().split('T')[0] : String(r.salesDate || ''),
      productName: r.productName || 'Unknown Product',
      customerName: r.customerName || 'Direct Sale',
      quantity: Number(r.quantity || 0),
      unitPrice: Number(r.unitPrice || 0),
      totalAmount: Number(r.quantity || 0) * Number(r.unitPrice || 0),
    }));
  }

  /**
   * Retrieves low stock or negative stock items across inventory
   */
  async getLowOrNegativeStockItems(): Promise<{
    negativeRawMaterials: Array<{ name: string; currentStock: number; unit: string }>;
    lowInventoryStock: Array<{ itemName: string; quantity: number; minimumStock: number; unit: string }>;
  }> {
    const rawNegative = await db
      .select({
        name: rawMaterials.name,
        currentStock: rawMaterials.currentStock,
        unit: rawMaterials.unit,
      })
      .from(rawMaterials)
      .where(lt(rawMaterials.currentStock, '0'));

    const lowStock = await db
      .select({
        itemName: inventoryStock.itemName,
        quantity: inventoryStock.quantity,
        minimumStock: inventoryStock.minimumStock,
        unit: inventoryStock.unit,
      })
      .from(inventoryStock)
      .where(lte(inventoryStock.quantity, inventoryStock.minimumStock));

    return {
      negativeRawMaterials: rawNegative.map((r) => ({
        name: r.name,
        currentStock: Number(r.currentStock || 0),
        unit: r.unit,
      })),
      lowInventoryStock: lowStock.map((s) => ({
        itemName: s.itemName,
        quantity: Number(s.quantity || 0),
        minimumStock: Number(s.minimumStock || 0),
        unit: s.unit,
      })),
    };
  }

  /**
   * Universal dynamic entity search with confidence scoring and disambiguation
   */
  async searchEntities(query: string): Promise<{
    status: 'EXACT_MATCH' | 'HIGH_CONFIDENCE_MATCH' | 'MULTIPLE_MATCHES' | 'NO_MATCH';
    matches: Array<{ id: string; name: string; type: 'product' | 'raw_material' | 'customer' | 'vendor' | 'employee'; score: number }>;
  }> {
    const cleanQ = (query || '').trim().toLowerCase();
    if (!cleanQ || cleanQ.length < 2) {
      return { status: 'NO_MATCH', matches: [] };
    }

    const matches: Array<{ id: string; name: string; type: 'product' | 'raw_material' | 'customer' | 'vendor' | 'employee'; score: number }> = [];

    // 1. Products
    const prods = await db.select({ id: products.id, name: products.name }).from(products);
    for (const p of prods) {
      const pLower = p.name.toLowerCase();
      if (pLower === cleanQ) {
        matches.push({ id: p.id, name: p.name, type: 'product', score: 1.0 });
      } else if (pLower.includes(cleanQ) || cleanQ.includes(pLower)) {
        matches.push({ id: p.id, name: p.name, type: 'product', score: 0.8 });
      }
    }

    // 2. Raw Materials
    const mats = await db.select({ id: rawMaterials.id, name: rawMaterials.name }).from(rawMaterials);
    for (const m of mats) {
      const mLower = m.name.toLowerCase();
      if (mLower === cleanQ) {
        matches.push({ id: m.id, name: m.name, type: 'raw_material', score: 1.0 });
      } else if (mLower.includes(cleanQ) || cleanQ.includes(mLower)) {
        matches.push({ id: m.id, name: m.name, type: 'raw_material', score: 0.8 });
      }
    }

    // 3. Customers
    const custs = await db.select({ id: customers.id, name: customers.name }).from(customers).where(isNull(customers.deletedAt));
    for (const c of custs) {
      const cLower = c.name.toLowerCase();
      if (cLower === cleanQ) {
        matches.push({ id: c.id, name: c.name, type: 'customer', score: 1.0 });
      } else if (cLower.includes(cleanQ) || cleanQ.includes(cLower)) {
        matches.push({ id: c.id, name: c.name, type: 'customer', score: 0.8 });
      }
    }

    // 4. Vendors
    const vends = await db.select({ id: vendors.id, name: vendors.name }).from(vendors);
    for (const v of vends) {
      const vLower = v.name.toLowerCase();
      if (vLower === cleanQ) {
        matches.push({ id: v.id, name: v.name, type: 'vendor', score: 1.0 });
      } else if (vLower.includes(cleanQ) || cleanQ.includes(vLower)) {
        matches.push({ id: v.id, name: v.name, type: 'vendor', score: 0.8 });
      }
    }

    if (matches.length === 0) {
      return { status: 'NO_MATCH', matches: [] };
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    const exacts = matches.filter((m) => m.score === 1.0);
    if (exacts.length === 1) {
      return { status: 'EXACT_MATCH', matches: exacts };
    }
    if (exacts.length > 1) {
      return { status: 'MULTIPLE_MATCHES', matches: exacts };
    }

    const highConfidence = matches.filter((m) => m.score >= 0.8);
    if (highConfidence.length === 1) {
      return { status: 'HIGH_CONFIDENCE_MATCH', matches: highConfidence };
    }
    if (highConfidence.length > 1) {
      return { status: 'MULTIPLE_MATCHES', matches: highConfidence };
    }

    return { status: 'NO_MATCH', matches: [] };
  }
}



