import { History, Loader2 } from 'lucide-react';
import { LedgerCard } from './LedgerCard';
import { ProductLedgerItem } from './ledger-types';

interface LedgerHistoryProps {
  ledger: ProductLedgerItem[];
  isLedgerLoading: boolean;
  currentProduct: any | null;
  canManageProducts: boolean;
  onEditTransaction: (tx: ProductLedgerItem) => void;
  onDeleteTransaction: (id: string) => void;
}

export function LedgerHistory({
  ledger,
  isLedgerLoading,
  currentProduct,
  canManageProducts,
  onEditTransaction,
  onDeleteTransaction,
}: LedgerHistoryProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col min-h-[450px]">
      <div className="p-6 bg-slate-50/50 border-b border-slate-200 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-[#1A9A91]" />
            {currentProduct ? `${currentProduct.productName} Ledger History` : 'Transaction History'}
          </h3>
          <p className="text-slate-400 font-bold text-[10px] mt-1 uppercase tracking-wide">
            Chronological stock movements
          </p>
        </div>
        {currentProduct && (
          <span className="bg-slate-100 border border-slate-200 text-slate-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider">
            {Number.isFinite(Number(currentProduct.currentStock))
              ? Number(currentProduct.currentStock).toLocaleString()
              : '[Invalid]'} units left
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-h-[500px] space-y-4">
        {isLedgerLoading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-slate-200" />
          </div>
        ) : !ledger || ledger.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center gap-3 opacity-30">
            <History className="w-12 h-12" />
            <p className="font-black uppercase tracking-widest text-[10px]">No movements recorded</p>
          </div>
        ) : (
          ledger.map((normalizedTx) => (
            <LedgerCard
              key={normalizedTx.id}
              tx={normalizedTx}
              canManageProducts={canManageProducts}
              onEdit={onEditTransaction}
              onDelete={onDeleteTransaction}
            />
          ))
        )}
      </div>
    </div>
  );
}
