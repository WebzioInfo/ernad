export function formatSafeNumber(value: number | undefined | null): string | JSX.Element {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }
  return value.toLocaleString();
}

export function formatSafeUnits(value: number | undefined | null): string | JSX.Element {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }
  return `${value.toLocaleString()} Units`;
}

export function getTransactionStyles(transactionType: string, quantity: number) {
  const isAddition = transactionType === 'ADD' || transactionType === 'PRODUCTION' || quantity > 0;
  const isReduction = transactionType === 'DISPATCH' || transactionType === 'LEAKAGE' || transactionType === 'REJECTION' || quantity < 0;
  const isManual = transactionType === 'ADD' || transactionType === 'EDIT' || transactionType === 'DELETE' || transactionType === 'MANUAL_PRODUCED_ADJUST' || transactionType === 'MANUAL_DISPATCH_ADJUST';

  return { isAddition, isReduction, isManual };
}
