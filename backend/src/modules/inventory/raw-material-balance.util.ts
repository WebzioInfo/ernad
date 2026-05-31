export type RawMaterialTransactionInput = {
  quantityChange: number | string | null;
};

export type RawMaterialProductionUsageInput = {
  materialType?: string | null;
  bagsUsed?: number | string | null;
  capBoxUsage?: number | string | null;
  bopRollUsage?: number | string | null;
  shrinkWeightUsed?: number | string | null;
};

export function sumRawMaterialTransactions(transactions: RawMaterialTransactionInput[]): number {
  return transactions.reduce((sum, transaction) => sum + Number(transaction.quantityChange || 0), 0);
}

export function getRawMaterialProductionUsage(log: RawMaterialProductionUsageInput): number {
  switch (log.materialType) {
    case 'PREFORM':
      return Number(log.bagsUsed || 0);
    case 'CAP':
      return Number(log.capBoxUsage || 0);
    case 'LABEL':
      return Number(log.bopRollUsage || 0);
    case 'SHRINK':
      return Number(log.shrinkWeightUsed || 0);
    default:
      return 0;
  }
}

