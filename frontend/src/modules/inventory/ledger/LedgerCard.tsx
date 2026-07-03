import { LedgerItem } from './ledger-types';
import { formatSafeNumber, formatSafeUnits, getTransactionStyles } from './ledger-utils';
import { ArrowDownLeft, ArrowUpRight, RefreshCw, PenLine, Trash2 } from 'lucide-react';

interface LedgerCardProps {
  tx: LedgerItem;
  canManageProducts: boolean;
  onEdit: (tx: LedgerItem) => void;
  onDelete: (id: string) => void;
}

export function LedgerCard({ tx, canManageProducts, onEdit, onDelete }: LedgerCardProps) {
  const { isAddition, isReduction, isManual } = getTransactionStyles(tx.transactionType, tx.quantity);

  return (
    <div className="bg-slate-50/40 rounded-2xl p-6 border border-slate-150 group hover:bg-white hover:shadow-md hover:border-slate-250 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              isAddition
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                : isReduction
                ? 'bg-rose-50 text-rose-600 border border-rose-100'
                : 'bg-blue-50 text-blue-600 border border-blue-100'
            }`}
          >
            {isAddition ? <ArrowDownLeft className="w-5 h-5" /> : isReduction ? <ArrowUpRight className="w-5 h-5" /> : <RefreshCw className="w-4 h-4" />}
          </div>
          <div className="pt-1">
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-black uppercase tracking-wider ${
                  isAddition ? 'text-emerald-700' : isReduction ? 'text-rose-700' : 'text-blue-700'
                }`}
              >
                {tx.transactionType.replace(/_/g, ' ')}
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                • {new Date(tx.createdAt).toLocaleDateString()} at {new Date(tx.createdAt).toLocaleTimeString()}
              </span>
            </div>
            {tx.batchCode && <p className="text-sm text-slate-700 font-bold mt-1">Batch: {tx.batchCode}</p>}
            {tx.remarks && <p className="text-xs text-slate-500 font-semibold mt-1">Remarks: {tx.remarks}</p>}
            <div className="mt-2">
              <p className="text-[10px] text-slate-400 font-semibold">Performed by:</p>
              <p className="text-sm text-slate-800 font-bold">{tx.performedByName}</p>
            </div>
          </div>
        </div>

        <div className="text-right">
          <p
            className={`text-xl font-black tabular-nums tracking-tight ${
              isAddition ? 'text-emerald-600' : isReduction ? 'text-rose-600' : 'text-blue-600'
            }`}
          >
            {tx.quantity > 0 ? '+' : ''}
            {formatSafeUnits(tx.quantity)}
          </p>

          {canManageProducts && isManual && (
            <div className="flex items-center justify-end gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(tx)}
                className="p-1.5 hover:bg-slate-100 hover:text-indigo-600 rounded-lg text-slate-400 transition-colors"
                title="Edit Record"
              >
                <PenLine className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(tx.id)}
                className="p-1.5 hover:bg-slate-100 hover:text-rose-600 rounded-lg text-slate-400 transition-colors"
                title="Delete Record"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventory After Transaction</h5>
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2">
          {/* Stock */}
          <div className="px-2.5 py-1.5 rounded-lg border flex items-center gap-2 bg-indigo-50/20 border-indigo-100/50">
            <p className="text-[9px] font-bold uppercase tracking-wider text-indigo-600/70">Current Stock</p>
            <p className="text-xs font-black tabular-nums text-indigo-900">
              {formatSafeNumber(tx.stockBalanceAfter)}
            </p>
          </div>

          {/* Produced */}
          <div className="px-2.5 py-1.5 rounded-lg border flex items-center gap-2 bg-emerald-50/20 border-emerald-100/50">
            <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-600/70">Total Produced</p>
            <p className="text-xs font-black tabular-nums text-emerald-900">
              {formatSafeNumber(tx.producedBalanceAfter)}
            </p>
          </div>

          {/* Dispatched */}
          <div className="px-2.5 py-1.5 rounded-lg border flex items-center gap-2 bg-amber-50/20 border-amber-100/50">
            <p className="text-[9px] font-bold uppercase tracking-wider text-amber-600/70">Total Dispatched</p>
            <p className="text-xs font-black tabular-nums text-amber-900">
              {formatSafeNumber(tx.dispatchedBalanceAfter)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
