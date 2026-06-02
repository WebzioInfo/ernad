import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ENDPOINTS } from '../../constants/endpoints';
import { api } from '../../services/api-client';
import {
  Package, Search, RefreshCw, Loader2,
  TrendingUp, CheckCircle, Truck, History,
  ArrowDownLeft, ArrowUpRight, Plus, PenLine, Trash2, X
} from 'lucide-react';
import { toast } from 'sonner';
import useAuthStore from '../auth/auth.store';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import { StockTransactionModal } from './RawMaterialsPage';
import { useProductionStock, useProducts, useBrands, useProductLedger, QK } from '../../hooks/useApi';
import { useTransactionOverlay } from '../../components/TransactionOverlay';

export default function ProductsPage() {
  const { user } = useAuthStore();
  const userRoles = (user?.roles || [user?.role]).map(r => String(r).toUpperCase());
  const isAdmin = userRoles.includes('ADMIN');
  const canManageProducts = isAdmin || userRoles.includes('MANAGER');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productToDelete, setProductToDelete] = useState<any>(null);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const overlay = useTransactionOverlay();

  const { data: productionStock, isLoading, refetch } = useProductionStock();
  const { data: products = [] } = useProducts();
  const { data: brands = [] } = useBrands();

  const currentProduct = selectedProduct || productionStock?.[0];

  const { data: ledger, isLoading: isLedgerLoading, refetch: refetchLedger } = useProductLedger(currentProduct?.productId);

  const addStockMutation = useMutation({
    mutationFn: (data: any) => {
      overlay.startProcessing('Adding Stock...');
      return api.post(ENDPOINTS.INVENTORY.ADD_STOCK, data);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: QK.PRODUCTION_STOCK });
      if (currentProduct?.productId) queryClient.invalidateQueries({ queryKey: QK.PRODUCT_LEDGER(currentProduct.productId) });
      queryClient.invalidateQueries({ queryKey: QK.RAW_MATERIALS_STOCK });
      await overlay.showSuccess('Stock Added');
      setIsAddModalOpen(false);
    },
    onError: (err: any) => {
      overlay.showError('Save Failed');
      toast.error(err.response?.data?.message || 'Failed to add stock');
    }
  });

  const updateStockMutation = useMutation({
    mutationFn: (data: any) => {
      overlay.startProcessing('Updating Record...');
      return api.put(ENDPOINTS.INVENTORY.UPDATE_STOCK, data);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: QK.PRODUCTION_STOCK });
      if (currentProduct?.productId) queryClient.invalidateQueries({ queryKey: QK.PRODUCT_LEDGER(currentProduct.productId) });
      await overlay.showSuccess('Record Updated');
      setEditingTransaction(null);
    },
    onError: (err: any) => {
      overlay.showError('Update Failed');
      toast.error(err.response?.data?.message || 'Failed to update transaction');
    }
  });

  const deleteStockMutation = useMutation({
    mutationFn: (transactionId: string) => {
      overlay.startProcessing('Deleting Record...');
      return api.delete(ENDPOINTS.INVENTORY.DELETE_STOCK, { data: { transactionId } });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: QK.PRODUCTION_STOCK });
      if (currentProduct?.productId) queryClient.invalidateQueries({ queryKey: QK.PRODUCT_LEDGER(currentProduct.productId) });
      await overlay.showSuccess('Record Deleted');
      setTransactionToDelete(null);
    },
    onError: (err: any) => {
      overlay.showError('Delete Failed');
      toast.error(err.response?.data?.message || 'Failed to delete transaction');
    }
  });

  const saveProductMutation = useMutation({
    mutationFn: (data: any) => {
      const { id, ...payload } = data;
      overlay.startProcessing(id ? 'Updating Product...' : 'Adding Product...');
      return id
        ? api.patch(`${ENDPOINTS.MASTER_DATA.PRODUCTS}/${id}`, payload)
        : api.post(ENDPOINTS.MASTER_DATA.PRODUCTS, payload);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: QK.PRODUCTS });
      queryClient.invalidateQueries({ queryKey: QK.PRODUCTION_STOCK });
      await overlay.showSuccess(editingProduct ? 'Product Updated' : 'Product Added');
      setEditingProduct(null);
      setIsProductModalOpen(false);
    },
    onError: (err: any) => {
      overlay.showError('Save Failed');
      toast.error(err.response?.data?.message || 'Failed to save product');
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: (productId: string) => {
      overlay.startProcessing('Deleting Product...');
      return api.delete(`${ENDPOINTS.MASTER_DATA.PRODUCTS}/${productId}`);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: QK.PRODUCTS });
      queryClient.invalidateQueries({ queryKey: QK.PRODUCTION_STOCK });
      await overlay.showSuccess('Product Deleted');
      setProductToDelete(null);
    },
    onError: (err: any) => {
      overlay.showError('Delete Failed');
      toast.error(err.response?.data?.message || 'Failed to delete product');
    }
  });

  const handleManualSync = () => {
    refetch();
    if (currentProduct) refetchLedger();
    toast.success('Finished Goods stock updated.');
  };

  const filteredStock = productionStock?.filter((p: any) => 
    (p.productName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  const productById = new Map<string, any>(products.map((product: any) => [product.id, product]));

  // Calculate totals for dashboard summary cards
  const totalAvailableStock = productionStock?.reduce((acc: number, cur: any) => acc + cur.currentStock, 0) || 0;
  const totalProducedAllTime = productionStock?.reduce((acc: number, cur: any) => acc + cur.totalProduced, 0) || 0;
  const totalDispatchedAllTime = productionStock?.reduce((acc: number, cur: any) => acc + cur.totalDispatched, 0) || 0;

  if (isLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#1A9A91]" />
        <p className="font-semibold uppercase tracking-wider text-[10px]">Syncing Production Stocks...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#1A9A91]/10 rounded-xl text-[#1A9A91]">
              <Package className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Finished Goods Inventory
            </h2>
            <span className="bg-slate-100 text-[#1A9A91] text-xs px-2.5 py-1 rounded-full border border-slate-200 font-bold uppercase tracking-widest">
              Production Stock
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-2">
            Auto-calculates finished goods stock from packing station logs (produced count minus rejections/leakage) and dispatch records.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleManualSync}
            className="p-2.5 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl border border-slate-200 flex items-center justify-center shadow-sm transition-all group active:scale-95 self-start sm:self-center"
            title="Manual Sync"
          >
            <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
          </button>

          {isAdmin && (
            <button
              onClick={() => {
                setIsAddModalOpen(true);
              }}
              className="bg-[#1A9A91] hover:bg-[#157C75] text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-[#1A9A91]/10 transition-all active:scale-95 text-xs uppercase tracking-wider self-start sm:self-center"
            >
              <Plus className="w-4 h-4" />
              Add Stock
            </button>
          )}

          {canManageProducts && (
            <button
              onClick={() => {
                setEditingProduct(null);
                setIsProductModalOpen(true);
              }}
              className="bg-slate-900 hover:bg-slate-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-slate-900/10 transition-all active:scale-95 text-xs uppercase tracking-wider self-start sm:self-center"
            >
              <Package className="w-4 h-4" />
              Add Product
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 flex items-center justify-between shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full translate-x-4 -translate-y-4 bg-emerald-50 opacity-40 blur-lg pointer-events-none" />
          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available Stock</p>
            <h4 className="text-3xl font-black text-slate-900 tracking-tight tabular-nums">
              {totalAvailableStock.toLocaleString()}
            </h4>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Ready for dispatch</p>
          </div>
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 flex items-center justify-between shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full translate-x-4 -translate-y-4 bg-indigo-50 opacity-40 blur-lg pointer-events-none" />
          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Produced</p>
            <h4 className="text-3xl font-black text-slate-900 tracking-tight tabular-nums">
              {totalProducedAllTime.toLocaleString()}
            </h4>
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Cumulative output</p>
          </div>
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 flex items-center justify-between shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full translate-x-4 -translate-y-4 bg-blue-50 opacity-40 blur-lg pointer-events-none" />
          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Dispatched</p>
            <h4 className="text-3xl font-black text-slate-900 tracking-tight tabular-nums">
              {totalDispatchedAllTime.toLocaleString()}
            </h4>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Loaded & Outwarded</p>
          </div>
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
            <Truck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Search Filter */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search finished products by name..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91]/40 focus:bg-white transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Production Stock Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-5">Product Name</th>
                <th className="px-8 py-5 text-right">Total Produced</th>
                <th className="px-8 py-5 text-right">Total Dispatched</th>
                <th className="px-8 py-5 text-right text-[#1A9A91]">Available Stock</th>
                <th className="px-8 py-5 text-center">Status</th>
                {canManageProducts && <th className="px-8 py-5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStock?.length === 0 ? (
                <tr>
                  <td colSpan={canManageProducts ? 6 : 5} className="px-8 py-16 text-center text-slate-400 font-bold">
                    No products found matching the query.
                  </td>
                </tr>
              ) : (
                filteredStock?.map((stock: any) => {
                  const isSelected = currentProduct?.productId === stock.productId;
                  const product = productById.get(stock.productId) || { id: stock.productId, name: stock.productName };
                  return (
                    <tr 
                      key={stock.id} 
                      onClick={() => setSelectedProduct(stock)}
                      className={`hover:bg-slate-50/30 transition-colors group cursor-pointer ${
                        isSelected ? 'bg-[#1A9A91]/5 font-semibold' : ''
                      }`}
                    >
                      <td className="px-8 py-6 font-bold text-slate-800 group-hover:text-[#1A9A91] transition-colors flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-[#1A9A91]/15 text-[#1A9A91]' : 'bg-slate-100 text-slate-400'}`}>
                          <Package className="w-4 h-4" />
                        </div>
                        {stock.productName}
                      </td>
                      <td className="px-8 py-6 text-right font-mono font-bold text-slate-650 tabular-nums">
                        {Number(stock.totalProduced).toLocaleString()}
                      </td>
                      <td className="px-8 py-6 text-right font-mono font-bold text-slate-650 tabular-nums">
                        {Number(stock.totalDispatched).toLocaleString()}
                      </td>
                      <td className={`px-8 py-6 text-right font-mono font-black tabular-nums ${
                        stock.currentStock < 0 ? 'text-rose-600' : 'text-slate-900'
                      }`}>
                        {Number(stock.currentStock).toLocaleString()}
                      </td>
                      <td className="px-8 py-6 text-center">
                        {stock.currentStock > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[9px] font-black uppercase tracking-widest">
                            In Stock
                          </span>
                        ) : stock.currentStock < 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-full text-[9px] font-black uppercase tracking-widest animate-pulse">
                            Negative Balance
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 text-slate-400 rounded-full text-[9px] font-black uppercase tracking-widest">
                            Empty
                          </span>
                        )}
                      </td>
                      {canManageProducts && (
                        <td className="px-8 py-6 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setEditingProduct(product);
                                setIsProductModalOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Edit product"
                            >
                              <PenLine className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setProductToDelete(product);
                              }}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete product"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Ledger History for Selected Product */}
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
              {Number(currentProduct.currentStock).toLocaleString()} units left
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 max-h-[500px] space-y-4">
          {isLedgerLoading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-200" /></div>
          ) : !ledger || ledger.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center gap-3 opacity-30">
              <History className="w-12 h-12" />
              <p className="font-black uppercase tracking-widest text-[10px]">No movements recorded</p>
            </div>
          ) : (
            ledger.map((tx: any) => {
              const isAddition = tx.type === 'ADD' || tx.type === 'PRODUCTION';
              const isReduction = tx.type === 'DISPATCH' || tx.type === 'LEAKAGE' || tx.type === 'REJECTION';
              const isManual = tx.type === 'ADD' || tx.type === 'EDIT' || tx.type === 'DELETE';

              return (
                <div key={tx.id} className="bg-slate-50/40 rounded-2xl p-5 border border-slate-150 flex items-center justify-between group hover:bg-white hover:shadow-md hover:border-slate-250 transition-all duration-300">
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                      isAddition ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                      isReduction ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
                    }`}>
                      {isAddition ? <ArrowDownLeft className="w-5 h-5" /> :
                       isReduction ? <ArrowUpRight className="w-5 h-5" /> : <RefreshCw className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${
                          isAddition ? 'text-emerald-700' : isReduction ? 'text-rose-700' : 'text-blue-700'
                        }`}>{tx.type}</span>
                        <span className="text-[10px] font-bold text-slate-400">• {new Date(tx.createdAt).toLocaleDateString()} at {new Date(tx.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs text-slate-600 font-bold mt-1">{tx.remarks}</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Performed by: {tx.userName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`text-lg font-black tabular-nums tracking-tight ${
                        isAddition ? 'text-emerald-600' : isReduction ? 'text-rose-600' : 'text-blue-600'
                      }`}>
                        {tx.quantityChange > 0 ? '+' : ''}{tx.quantityChange.toLocaleString()}
                      </p>
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Balance: {tx.balanceAfter.toLocaleString()}</p>
                    </div>

                    {isAdmin && isManual && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingTransaction(tx)}
                          className="p-1.5 hover:bg-slate-100 hover:text-indigo-600 rounded-lg text-slate-400 transition-colors"
                          title="Edit Record"
                        >
                          <PenLine className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setTransactionToDelete(tx.id)}
                          className="p-1.5 hover:bg-slate-100 hover:text-rose-600 rounded-lg text-slate-400 transition-colors"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Stock Modal */}
      {isAddModalOpen && (
        <StockTransactionModal
          materials={[]}
          material={{ id: currentProduct?.productId, name: currentProduct?.productName }}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={(data: any) => addStockMutation.mutate(data)}
          isPending={addStockMutation.isPending}
        />
      )}

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <StockTransactionModal
          materials={[]}
          material={{ id: currentProduct?.productId, name: currentProduct?.productName }}
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSubmit={(data: any) => updateStockMutation.mutate({ transactionId: editingTransaction.id, quantity: data.quantity, remarks: data.remarks })}
          isPending={updateStockMutation.isPending}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!transactionToDelete}
        onClose={() => setTransactionToDelete(null)}
        onConfirm={() => {
          if (transactionToDelete) {
            deleteStockMutation.mutate(transactionToDelete);
          }
        }}
        title="Revert Stock Transaction"
        message="Are you sure you want to revert this stock transaction? This will restore the previous stock level."
        variant="danger"
        confirmText="Yes, Revert"
      />

      {isProductModalOpen && (
        <ProductFormModal
          product={editingProduct}
          brands={brands}
          isPending={saveProductMutation.isPending}
          onClose={() => {
            setIsProductModalOpen(false);
            setEditingProduct(null);
          }}
          onSubmit={(data) => saveProductMutation.mutate(data)}
        />
      )}

      <ConfirmationModal
        isOpen={!!productToDelete}
        onClose={() => setProductToDelete(null)}
        onConfirm={() => {
          if (productToDelete?.id) deleteProductMutation.mutate(productToDelete.id);
        }}
        title="Delete Product"
        message={`Delete ${productToDelete?.name || productToDelete?.productName || 'this product'}? Existing production records may prevent deletion until dependent records are cleared.`}
        variant="danger"
        confirmText="Delete Product"
      />
    </div>
  );
}

function ProductFormModal({
  product,
  brands,
  isPending,
  onClose,
  onSubmit,
}: {
  product?: any;
  brands: any[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    id: product?.id || '',
    name: product?.name || '',
    sku: product?.sku || '',
    brandId: product?.brandId || brands?.[0]?.id || '',
    category: product?.category || 'Water',
    targetBPM: product?.targetBPM || 120,
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      ...formData,
      targetBPM: Number(formData.targetBPM) || 0,
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">{product ? 'Edit Product' : 'Add Product'}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Manage finished goods master data.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-600">Product Name</span>
              <input required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-[#1A9A91]/25 focus:border-[#1A9A91]" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-600">SKU</span>
              <input className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-[#1A9A91]/25 focus:border-[#1A9A91]" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-600">Brand</span>
              <select required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-[#1A9A91]/25 focus:border-[#1A9A91]" value={formData.brandId} onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}>
                <option value="" disabled>Select brand</option>
                {brands.map((brand: any) => (
                  <option key={brand.id} value={brand.id}>{brand.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-600">Category</span>
              <input className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-[#1A9A91]/25 focus:border-[#1A9A91]" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} />
            </label>
          </div>

          <label className="space-y-1 block">
            <span className="text-xs font-semibold text-slate-600">Target BPM</span>
            <input type="number" min={0} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-[#1A9A91]/25 focus:border-[#1A9A91]" value={formData.targetBPM} onChange={(e) => setFormData({ ...formData, targetBPM: Number(e.target.value) })} />
          </label>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold uppercase tracking-wider">Cancel</button>
            <button type="submit" disabled={isPending} className="px-5 py-2 bg-[#1A9A91] hover:bg-[#157C75] text-white rounded-lg text-xs font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-2">
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
