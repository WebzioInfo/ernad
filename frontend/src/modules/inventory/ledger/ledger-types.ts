export interface ProductLedgerImpact {
  stock: number;
  produced: number;
  dispatched: number;
}

export interface ProductLedgerItem {
  id: string;
  transactionType: string;
  quantity: number;
  remarks?: string;
  batchCode?: string;
  createdAt: string;
  performedByName: string;
  impact: ProductLedgerImpact;
  stockBalanceAfter: number;
  producedBalanceAfter: number;
  dispatchedBalanceAfter: number;
}

export function normalizeLedgerItem(apiItem: unknown): ProductLedgerItem {
  const item = (apiItem || {}) as Record<string, unknown>;

  const safeNumber = (val: unknown, fieldName: string): number => {
    if (val === null || val === undefined) return 0;
    const num = Number(val);
    if (!Number.isFinite(num)) {
      console.warn(`[Ledger Normalization] Field ${fieldName} parsed to invalid number:`, val);
      return 0;
    }
    return num;
  };

  const safeString = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    return String(val);
  };

  const impactObj = (item.impact || {}) as Record<string, unknown>;

  return {
    id: safeString(item.id),
    transactionType: safeString(item.transactionType),
    quantity: safeNumber(item.quantity, 'quantity'),
    remarks: item.remarks ? String(item.remarks) : undefined,
    batchCode: item.batchCode ? String(item.batchCode) : undefined,
    createdAt: safeString(item.createdAt),
    performedByName: item.performedByName ? String(item.performedByName) : 'Unknown User',
    impact: {
      stock: safeNumber(impactObj.stock, 'impact.stock'),
      produced: safeNumber(impactObj.produced, 'impact.produced'),
      dispatched: safeNumber(impactObj.dispatched, 'impact.dispatched'),
    },
    stockBalanceAfter: safeNumber(item.stockBalanceAfter, 'stockBalanceAfter'),
    producedBalanceAfter: safeNumber(item.producedBalanceAfter, 'producedBalanceAfter'),
    dispatchedBalanceAfter: safeNumber(item.dispatchedBalanceAfter, 'dispatchedBalanceAfter'),
  };
}
