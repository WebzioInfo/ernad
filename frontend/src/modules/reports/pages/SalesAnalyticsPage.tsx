import { useState } from 'react';
import {
  Package, Search, Trash2, Edit2, AlertTriangle, X, CheckCircle2, Loader2, Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../../../modules/auth/auth.store';
import {
  useBrands,
  useProducts,
  useProductionStock,
  useSalesTransactions,
  useCreateSalesTransaction,
  useUpdateSalesTransaction,
  useDeleteSalesTransaction
} from '../../../hooks/useApi';

export default function SalesAnalyticsPage() {
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [transactionType, setTransactionType] = useState<'SALES_DISPATCH' | 'RETURN' | 'DAMAGE'>('SALES_DISPATCH');
  const [quantity, setQuantity] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Dialog states for Admin Edit/Delete
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  // Search & Filters for Ledger
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('');

  const { data: transactions, isLoading: isLedgerLoading } = useSalesTransactions();
  const { data: brands, isLoading: isBrandsLoading } = useBrands();
  const { data: products, isLoading: isProductsLoading } = useProducts();
  const { data: productionStock } = useProductionStock();

  const { user } = useAuthStore();
  const isAdmin = user?.roles?.includes('ADMIN') || user?.role === 'ADMIN';

  const createTxMutation = useCreateSalesTransaction();

  if (isLedgerLoading || isBrandsLoading || isProductsLoading) {
    return (
      <div className="h-96 flex items-center justify-center animate-pulse text-slate-400 font-black uppercase tracking-widest text-xs">
        Loading POS Terminal...
      </div>
    );
  }

  // Filtered transactions for the ledger view
  const filteredTransactions = transactions?.filter((tx: any) => {
    const brandName = tx.brandName || '';
    const productName = tx.productName || '';
    const userName = tx.userName || '';
    const matchesSearch =
      brandName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      userName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesBrand = selectedBrandFilter ? tx.brandId === selectedBrandFilter : true;
    const matchesType = selectedTypeFilter ? tx.type === selectedTypeFilter : true;

    return matchesSearch && matchesBrand && matchesType;
  }) || [];

  const handleBrandSelect = (brandId: string) => {
    setSelectedBrandId(brandId);
    setSelectedProductId(''); // Reset product when brand changes
  };

  const handleProductSelect = (productId: string) => {
    if (selectedProductId === productId) {
      setSelectedProductId(''); // unselect if already selected
    } else {
      setSelectedProductId(productId);
    }
  };

  const currentProduct = products?.find(p => p.id === selectedProductId);
  const currentBrand = brands?.find(b => b.id === selectedBrandId);

  // Stock calculation for Live Summary
  const currentStockItem = productionStock?.find(s => s.productId === selectedProductId);
  const currentStock = currentStockItem ? currentStockItem.currentStock : 0;

  const quantityInt = parseInt(quantity, 10) || 0;
  const isDeduction = transactionType === 'SALES_DISPATCH' || transactionType === 'DAMAGE';
  const projectedStock = isDeduction ? currentStock - quantityInt : currentStock + quantityInt;

  const handleSave = () => {
    if (!selectedBrandId || !selectedProductId || !transactionType || quantityInt <= 0) {
      setErrorMsg('All fields are required and quantity must be greater than zero.');
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }

    createTxMutation.mutate(
      {
        brandId: selectedBrandId,
        productId: selectedProductId,
        type: transactionType as any,
        quantity: quantityInt,
      },
      {
        onSuccess: () => {
          setQuantity(''); // Clear quantity field for rapid successive entries
          setErrorMsg('');
        },
        onError: (err: any) => {
          setErrorMsg(err?.response?.data?.message || 'Failed to create sales transaction.');
          setTimeout(() => setErrorMsg(''), 5000);
        }
      }
    );
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Page Header */}
      <div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-2xl">
            <Package className="w-8 h-8" />
          </div>
          Dispatch Terminal
        </h1>
        <p className="text-slate-500 font-bold mt-2 ml-1">
          Record sales dispatches, product returns, and damaged goods.
        </p>
      </div>

      {/* Main Entry POS Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Entry Sections (Left) */}
        <div className="col-span-1 lg:col-span-8 space-y-6">
          
          {/* Section 1: Brand Categories */}
          <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">1. Select Brand</h3>
            <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
              {brands?.map((brand) => (
                <button
                  key={brand.id}
                  onClick={() => handleBrandSelect(brand.id)}
                  className={`px-8 py-5 rounded-2xl border text-center transition-all duration-200 hover:-translate-y-0.5 active:scale-95 whitespace-nowrap min-w-[140px] flex-shrink-0 ${
                    selectedBrandId === brand.id
                      ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span className="font-black text-lg tracking-tight">{brand.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Product Selection Grid */}
          <div className={`bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm transition-opacity duration-300 ${!selectedBrandId ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">2. Select Product</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {products
                ?.filter((p) => p.brandId === selectedBrandId)
                .map((prod) => (
                  <button
                    key={prod.id}
                    onClick={() => handleProductSelect(prod.id)}
                    className={`px-4 py-6 rounded-2xl border text-center transition-all duration-200 active:scale-95 flex flex-col items-center justify-center gap-2 relative ${
                      selectedProductId === prod.id
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-700 shadow-inner'
                        : 'border-slate-200 bg-white hover:border-indigo-300 text-slate-600'
                    }`}
                  >
                    <span className={`font-black text-sm tracking-tight ${selectedProductId === prod.id ? 'text-indigo-800' : 'text-slate-800'}`}>
                      {prod.name}
                    </span>
                    {selectedProductId === prod.id && (
                      <div className="absolute top-2 right-2 text-indigo-600">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}
                  </button>
                ))}
            </div>
          </div>

          {/* Section 3 & 4: Transaction Type & Quantity */}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-opacity duration-300 ${!selectedProductId ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">3. Transaction Type</h3>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value as any)}
                className="w-full px-5 py-4 rounded-2xl border border-slate-200 text-base font-black text-slate-800 focus:outline-none focus:border-indigo-500 shadow-sm bg-slate-50 cursor-pointer transition-colors"
              >
                <option value="SALES_DISPATCH">Sales Dispatch</option>
                <option value="RETURN">Return</option>
                <option value="DAMAGE">Damage</option>
              </select>
            </div>

            <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">4. Quantity (Cases)</h3>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-5 py-4 rounded-2xl border border-slate-200 text-2xl font-black text-slate-900 focus:outline-none focus:border-indigo-500 shadow-inner bg-slate-50 placeholder-slate-300"
                placeholder="0"
                min="1"
              />
            </div>
          </div>

        </div>

        {/* Section 5 & 6: Live Summary Card & Save (Right) */}
        <div className="col-span-1 lg:col-span-4 sticky top-6">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden flex flex-col min-h-[400px]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
            
            <h3 className="text-xl font-black tracking-tight mb-8 relative z-10 flex items-center gap-2">
              <Activity className="w-6 h-6 text-indigo-400" /> Ticket Summary
            </h3>
            
            <div className="space-y-6 relative z-10 flex-1">
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Brand</span>
                <span className="text-lg font-black text-white">{currentBrand?.name || '-'}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Product</span>
                <span className="text-lg font-black text-white">{currentProduct?.name || '-'}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</span>
                <span className={`text-lg font-black ${
                  transactionType === 'RETURN' ? 'text-emerald-400' :
                  transactionType === 'DAMAGE' ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {transactionType === 'RETURN' ? 'Return' :
                   transactionType === 'DAMAGE' ? 'Damage' : 'Sales Dispatch'}
                </span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</span>
                <span className="text-2xl font-black text-white">{quantityInt > 0 ? quantityInt.toLocaleString() : '-'}</span>
              </div>
            </div>

            {errorMsg && (
              <div className="mt-4 p-4 bg-rose-500/20 border border-rose-500/50 text-rose-200 text-xs font-bold rounded-2xl flex items-center gap-2 relative z-10 backdrop-blur-md">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                {errorMsg}
              </div>
            )}

            {projectedStock < 0 && selectedProductId && (
              <div className="mt-4 p-4 bg-amber-500/20 border border-amber-500/50 text-amber-200 text-xs font-bold rounded-2xl flex items-center gap-2 relative z-10 backdrop-blur-md">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                Warning: Transaction will result in negative stock.
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={createTxMutation.isPending || !selectedBrandId || !selectedProductId || quantityInt <= 0}
              className="w-full mt-8 py-5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 disabled:shadow-none relative z-10"
            >
              {createTxMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" /> Save Transaction
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Ledger Table */}
      <div className="mt-16">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Recent Dispatches & Returns</h2>
          
          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="flex-1 max-w-sm relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search ledger..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:border-indigo-500 shadow-sm bg-white"
              />
            </div>
            
            <select
              value={selectedBrandFilter}
              onChange={(e) => setSelectedBrandFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:border-indigo-500 shadow-sm cursor-pointer w-full md:w-auto"
            >
              <option value="">All Brands</option>
              {brands?.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:border-indigo-500 shadow-sm cursor-pointer w-full md:w-auto"
            >
              <option value="">All Types</option>
              <option value="SALES_DISPATCH">Sales Dispatch</option>
              <option value="RETURN">Product Return</option>
              <option value="DAMAGE">Damaged Goods</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="py-5 px-8 text-xs font-black text-slate-400 uppercase tracking-widest">Date & Time</th>
                  <th className="py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">Brand</th>
                  <th className="py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">Product</th>
                  <th className="py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">Type</th>
                  <th className="py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Quantity</th>
                  <th className="py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">Logged By</th>
                  {isAdmin && <th className="py-5 px-8 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="py-20 text-center text-slate-400 font-bold text-sm">
                      No sales transaction logs found.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx: any) => (
                    <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-all">
                      <td className="py-4 px-8 text-sm font-semibold text-slate-700">
                        {format(new Date(tx.createdAt), 'MMM d, yyyy hh:mm a')}
                      </td>
                      <td className="py-4 px-6 text-sm font-black text-slate-800">{tx.brandName}</td>
                      <td className="py-4 px-6 text-sm font-semibold text-slate-600">{tx.productName}</td>
                      <td className="py-4 px-6 text-sm">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          tx.type === 'RETURN'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                            : tx.type === 'SALES_DISPATCH'
                            ? 'bg-rose-50 text-rose-700 border-rose-200/50'
                            : 'bg-amber-50 text-amber-700 border-amber-200/50'
                        }`}>
                          {tx.type === 'RETURN' ? 'Return' : tx.type === 'SALES_DISPATCH' ? 'Dispatch' : 'Damage'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm font-black text-slate-900 text-right">{tx.quantity.toLocaleString()} cases</td>
                      <td className="py-4 px-6 text-sm font-semibold text-slate-500">{tx.userName}</td>
                      {isAdmin && (
                        <td className="py-4 px-8 text-sm text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedTransaction(tx);
                                setIsEditModalOpen(true);
                              }}
                              className="p-2 hover:bg-slate-100 text-slate-600 rounded-lg transition-all"
                              title="Edit entry"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedTransaction(tx);
                                setIsDeleteModalOpen(true);
                              }}
                              className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg transition-all"
                              title="Delete entry"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Admin Modals */}
      <AnimatePresence>
        {isEditModalOpen && selectedTransaction && (
          <EditSalesEntryModal
            onClose={() => {
              setIsEditModalOpen(false);
              setSelectedTransaction(null);
            }}
            transaction={selectedTransaction}
            brands={brands}
            products={products}
          />
        )}

        {isDeleteModalOpen && selectedTransaction && (
          <ConfirmDeleteModal
            onClose={() => {
              setIsDeleteModalOpen(false);
              setSelectedTransaction(null);
            }}
            transaction={selectedTransaction}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── EDIT SALES ENTRY MODAL (ADMIN ONLY) ─────────────────────────────────────

interface EditSalesEntryModalProps {
  onClose: () => void;
  transaction: any;
  brands: any[] | undefined;
  products: any[] | undefined;
}

function EditSalesEntryModal({ onClose, transaction, brands, products }: EditSalesEntryModalProps) {
  const [brandId, setBrandId] = useState(transaction.brandId);
  const [productId, setProductId] = useState(transaction.productId);
  const [type, setType] = useState(transaction.type);
  const [quantity, setQuantity] = useState(String(transaction.quantity));
  const [errorMsg, setErrorMsg] = useState('');

  const updateTxMutation = useUpdateSalesTransaction();

  const handleUpdate = () => {
    const qtyInt = parseInt(quantity, 10) || 0;
    if (!brandId || !productId || !type || qtyInt <= 0) {
      setErrorMsg('All fields are required and quantity must be greater than zero.');
      return;
    }

    updateTxMutation.mutate(
      {
        id: transaction.id,
        payload: { brandId, productId, type, quantity: qtyInt }
      },
      {
        onSuccess: () => {
          onClose();
        },
        onError: (err: any) => {
          setErrorMsg(err?.response?.data?.message || 'Failed to update transaction.');
        }
      }
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 15 }}
        className="bg-white rounded-[2.5rem] p-10 max-w-md w-full border border-slate-100 shadow-2xl relative flex flex-col"
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Edit Transaction</h2>
        <p className="text-slate-500 font-semibold text-xs mb-6">Modify details for transaction logs.</p>

        {errorMsg && (
          <div className="mb-4 p-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            {errorMsg}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Brand</label>
            <select
              value={brandId}
              onChange={(e) => {
                setBrandId(e.target.value);
                setProductId('');
              }}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-slate-50 shadow-sm"
            >
              <option value="">Select Brand</option>
              {brands?.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Product</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-slate-50 shadow-sm"
              disabled={!brandId}
            >
              <option value="">Select Product</option>
              {products
                ?.filter((p) => p.brandId === brandId)
                .map((prod) => (
                  <option key={prod.id} value={prod.id}>{prod.name}</option>
                ))}
            </select>
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-slate-50 shadow-sm"
            >
              <option value="SALES_DISPATCH">Sales Dispatch</option>
              <option value="RETURN">Product Return</option>
              <option value="DAMAGE">Damaged Goods</option>
            </select>
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Quantity (Cases)</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-slate-50 shadow-sm"
              placeholder="Enter cases"
              min="1"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-5 py-3 hover:bg-slate-50 text-slate-500 rounded-xl font-bold text-xs uppercase tracking-wider border border-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdate}
            disabled={updateTxMutation.isPending}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {updateTxMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving...
              </>
            ) : (
              <>Save Changes</>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── DELETE TRANSACTION CONFIRMATION MODAL (ADMIN ONLY) ──────────────────────

interface ConfirmDeleteModalProps {
  onClose: () => void;
  transaction: any;
}

function ConfirmDeleteModal({ onClose, transaction }: ConfirmDeleteModalProps) {
  const [errorMsg, setErrorMsg] = useState('');
  const deleteTxMutation = useDeleteSalesTransaction();

  const handleDelete = () => {
    deleteTxMutation.mutate(transaction.id, {
      onSuccess: () => {
        onClose();
      },
      onError: (err: any) => {
        setErrorMsg(err?.response?.data?.message || 'Failed to delete transaction.');
      }
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 15 }}
        className="bg-white rounded-[2.5rem] p-10 max-w-md w-full border border-slate-100 shadow-2xl relative flex flex-col"
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 bg-rose-550 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-rose-100">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Delete Transaction</h2>
        <p className="text-slate-500 font-semibold text-xs mb-6">
          Are you sure you want to delete this sales transaction? This action will restore previous stock values and cannot be undone.
        </p>

        {errorMsg && (
          <div className="mb-4 p-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            {errorMsg}
          </div>
        )}

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-6 text-xs space-y-2 font-semibold">
          <div className="flex justify-between">
            <span className="text-slate-400">Product:</span>
            <span className="text-slate-800">{transaction.productName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Type:</span>
            <span className="text-slate-800">{transaction.type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Quantity:</span>
            <span className="text-slate-800 font-bold">{transaction.quantity} cases</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-5 py-3 hover:bg-slate-50 text-slate-500 rounded-xl font-bold text-xs uppercase tracking-wider border border-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteTxMutation.isPending}
            className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {deleteTxMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Deleting...
              </>
            ) : (
              <>Confirm Delete</>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
