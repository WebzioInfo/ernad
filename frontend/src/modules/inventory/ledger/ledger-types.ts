export interface LedgerItem {
  id: string;
  transactionType: string;
  quantity: number;
  performedByName: string;
  remarks?: string;
  createdAt: string;
  batchCode?: string;
  stockBalanceAfter?: number;
  producedBalanceAfter?: number;
  dispatchedBalanceAfter?: number;
}

export function normalizeLedgerItem(apiItem: unknown): LedgerItem {
  const item = (apiItem || {}) as Record<string, unknown>;

  const safeNumber = (val: unknown, fieldName: string): number => {
    if (val === null || val === undefined) {
      throw new Error(`[Ledger Contract] Missing required numeric field: ${fieldName}`);
    }
    const num = Number(val);
    if (!Number.isFinite(num)) {
      throw new Error(`[Ledger Contract] Invalid numeric field ${fieldName}: ${String(val)}`);
    }
    return num;
  };

  const safeOptionalNumber = (val: unknown): number | undefined => {
    if (val === null || val === undefined) return undefined;
    const num = Number(val);
    return Number.isFinite(num) ? num : undefined;
  };

  const safeString = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    return String(val);
  };

  return {
    id: safeString(item.id),
    transactionType: safeString(item.transactionType ?? item.type),
    quantity: safeNumber(item.quantity ?? item.quantityChange, 'quantity'),
    remarks: (item.remarks) ? String(item.remarks) : undefined,
    batchCode: (item.batchCode ?? item.batch) ? String(item.batchCode ?? item.batch) : undefined,
    createdAt: safeString(item.createdAt),
    performedByName: (item.performedByName ?? item.userName ?? item.performedBy)
      ? String(item.performedByName ?? item.userName ?? item.performedBy)
      : (() => { throw new Error('[Ledger Contract] Missing performedByName'); })(),
    stockBalanceAfter: safeOptionalNumber(item.stockBalanceAfter ?? item.balanceAfter),
    producedBalanceAfter: safeOptionalNumber(item.producedBalanceAfter),
    dispatchedBalanceAfter: safeOptionalNumber(item.dispatchedBalanceAfter),
  };
}
