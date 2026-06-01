import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ENDPOINTS } from '../../constants/endpoints';
import { api } from '../../services/api-client';
import useAuthStore from '../auth/auth.store';
import {
  Plus, Layers, Check, Loader2, Trash2, PenLine,
  RefreshCw, History, ArrowDownLeft, ArrowUpRight,
  Wind, PackageOpen, Zap, Box
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import { useRawMaterials, useStationConsumption, useRawMaterialLedger, QK } from '../../hooks/useApi';
import { MaterialUnit, MaterialType } from '../../types/enums';

export default function RawMaterialsPage() {
  const { user } = useAuthStore();
  const userRoles = (user?.roles || [user?.role]).map((r: any) => String(r).toUpperCase());
  const isAdmin = userRoles.includes('ADMIN');
  const isManager = userRoles.includes('MANAGER');

  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCreateMaterialModalOpen, setIsCreateMaterialModalOpen] = useState(false);
  const [isEditMaterialModalOpen, setIsEditMaterialModalOpen] = useState(false);
  const [materialToEdit, setMaterialToEdit] = useState<any>(null);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [materialToDelete, setMaterialToDelete] = useState<any>(null);

  const queryClient = useQueryClient();


  // Fetch Preforms and Caps raw materials
  const { data: rawMaterials, isLoading: isMaterialsLoading, refetch: refetchMaterials } = useRawMaterials();

  // Fetch Station Consumption summary
  const { data: stationConsumption, isLoading: isConsumptionLoading } = useStationConsumption();

  // Automatically select the first material for ledger view when data loads
  const currentMaterial = selectedMaterial || rawMaterials?.[0];

  // Fetch dynamic ledger/history for the selected raw material
  const { data: ledger, isLoading: isLedgerLoading, refetch: refetchLedger } = useRawMaterialLedger(currentMaterial?.id);

  const createMaterialMutation = useMutation({
    mutationFn: (data: { name: string; materialType: string; unit: string }) => api.post('/master-data/raw-materials', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.RAW_MATERIALS_STOCK });
      toast.success('Raw material created successfully');
      setIsCreateMaterialModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create raw material');
    }
  });

  const updateMaterialMutation = useMutation({
    mutationFn: (data: { id: string; payload: any }) => api.patch(ENDPOINTS.MASTER_DATA.UPDATE_RAW_MATERIAL(data.id), data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.RAW_MATERIALS_STOCK });
      toast.success('Raw material updated successfully');
      setIsEditMaterialModalOpen(false);
      setMaterialToEdit(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update raw material');
    }
  });

  const addStockMutation = useMutation({
    mutationFn: (data: any) => api.post(ENDPOINTS.INVENTORY.ADD_STOCK, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.RAW_MATERIALS_STOCK });
      if (currentMaterial?.id) queryClient.invalidateQueries({ queryKey: QK.RAW_MATERIAL_LEDGER(currentMaterial.id) });
      queryClient.invalidateQueries({ queryKey: QK.PRODUCTION_STOCK });
      toast.success('Stock added successfully');
      setIsAddModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to add stock');
    }
  });

  const updateStockMutation = useMutation({
    mutationFn: (data: any) => api.put(ENDPOINTS.INVENTORY.UPDATE_STOCK, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.RAW_MATERIALS_STOCK });
      if (currentMaterial?.id) queryClient.invalidateQueries({ queryKey: QK.RAW_MATERIAL_LEDGER(currentMaterial.id) });
      queryClient.invalidateQueries({ queryKey: QK.PRODUCTION_STOCK });
      toast.success('Stock transaction updated successfully');
      setEditingTransaction(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update transaction');
    }
  });

  const deleteStockMutation = useMutation({
    mutationFn: (transactionId: string) => 
      api.delete(ENDPOINTS.INVENTORY.DELETE_STOCK, { data: { transactionId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.RAW_MATERIALS_STOCK });
      if (currentMaterial?.id) queryClient.invalidateQueries({ queryKey: QK.RAW_MATERIAL_LEDGER(currentMaterial.id) });
      queryClient.invalidateQueries({ queryKey: QK.PRODUCTION_STOCK });
      toast.success('Stock transaction deleted successfully');
      setTransactionToDelete(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete transaction');
    }
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: (id: string) => api.delete(ENDPOINTS.MASTER_DATA.DELETE_RAW_MATERIAL(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.RAW_MATERIALS_STOCK });
      toast.success('Raw material deleted successfully');
      setMaterialToDelete(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete material');
    }
  });

  const handleManualSync = () => {
    refetchMaterials();
    if (currentMaterial) refetchLedger();
    toast.success('Inventory state re-synchronized.');
  };

  if (isMaterialsLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#1A9A91]" />
        <p className="font-semibold uppercase tracking-wider text-[10px]">Syncing Raw Materials Stock...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#1A9A91]/10 rounded-xl text-[#1A9A91]">
              <Layers className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Raw Material Stock Tracking
            </h2>
            <span className="bg-slate-100 text-[#1A9A91] text-xs px-2.5 py-1 rounded-full border border-slate-200 font-bold uppercase tracking-widest">
              Live Stock
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-2">
            Track and log preforms and caps inventory. Raw materials are automatically consumed as production data is submitted.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleManualSync}
            className="p-2.5 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl border border-slate-200 flex items-center justify-center shadow-sm transition-all group active:scale-95"
            title="Manual Sync"
          >
            <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
          </button>

          {(isAdmin || isManager) && (
            <>
              <button
                onClick={() => {
                  setIsCreateMaterialModalOpen(true);
                }}
                className="bg-white hover:bg-slate-50 text-slate-700 px-5 py-3 rounded-xl font-bold flex items-center gap-2 border border-slate-200 shadow-sm transition-all active:scale-95 text-xs uppercase tracking-wider"
              >
                <Plus className="w-4 h-4" />
                Add Material
              </button>
              <button
                onClick={() => {
                  setIsAddModalOpen(true);
                }}
                className="bg-[#1A9A91] hover:bg-[#157C75] text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-[#1A9A91]/10 transition-all active:scale-95 text-xs uppercase tracking-wider"
              >
                <Plus className="w-4 h-4" />
                Add Stock
              </button>
            </>
          )}
        </div>
      </div>

      {/* Raw Materials Stock Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-5">Material Name</th>
                <th className="px-8 py-5 text-right text-[#1A9A91]">Available Stock</th>
                <th className="px-8 py-5 text-center">Last Updated</th>
                <th className="px-8 py-5 text-center">Status</th>
                {(isAdmin || isManager) && <th className="px-8 py-5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {rawMaterials?.map((material: any) => {
                const isSelected = currentMaterial?.id === material.id;
                return (
                  <tr 
                    key={material.id} 
                    onClick={() => setSelectedMaterial(material)}
                    className={`hover:bg-slate-50/30 transition-colors group cursor-pointer ${
                      isSelected ? 'bg-[#1A9A91]/5 font-semibold' : ''
                    }`}
                  >
                    <td className="px-8 py-6 font-bold text-slate-800 group-hover:text-[#1A9A91] transition-colors flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-[#1A9A91]/15 text-[#1A9A91]' : 'bg-slate-100 text-slate-400'}`}>
                        <Layers className="w-4 h-4" />
                      </div>
                      {material.name}
                    </td>
                    <td className={`px-8 py-6 text-right font-mono font-black tabular-nums ${
                      material.currentStock < 0 ? 'text-rose-600' : 'text-slate-900'
                    }`}>
                      {Number(material.currentStock).toLocaleString()} <span className="text-[10px] text-slate-400 font-bold ml-1">{material.unit}</span>
                    </td>
                    <td className="px-8 py-6 text-center text-xs font-bold text-slate-500">
                      {new Date(material.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-8 py-6 text-center">
                      {material.currentStock > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[9px] font-black uppercase tracking-widest">
                          In Stock
                        </span>
                      ) : material.currentStock < 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-full text-[9px] font-black uppercase tracking-widest animate-pulse">
                          Negative Balance
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 text-slate-400 rounded-full text-[9px] font-black uppercase tracking-widest">
                          Empty
                        </span>
                      )}
                    </td>
                    {(isAdmin || isManager) && (
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMaterialToEdit(material);
                              setIsEditMaterialModalOpen(true);
                            }}
                            className="p-2 text-slate-400 hover:text-[#1A9A91] hover:bg-[#1A9A91]/10 rounded-lg transition-colors"
                          >
                            <PenLine className="w-4 h-4" />
                          </button>
                          {(isAdmin || isManager) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMaterialToDelete(material);
                              }}
                              className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Transaction Ledger */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col min-h-[450px]">
        <div className="p-6 bg-slate-50/50 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-[#1A9A91]" />
              {currentMaterial ? `${currentMaterial.name} Ledger History` : 'Transaction History'}
            </h3>
            <p className="text-slate-400 font-bold text-[10px] mt-1 uppercase tracking-wide">
              Chronological stock movements
            </p>
          </div>
          {currentMaterial && (
            <span className="bg-slate-100 border border-slate-200 text-slate-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider">
              {Number(currentMaterial.currentStock).toLocaleString()} units left
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
              const isAddition = tx.type === 'ADD';
              const isConsumption = tx.type === 'CONSUMPTION';

              return (
                <div key={tx.id} className="bg-slate-50/40 rounded-2xl p-5 border border-slate-150 flex items-center justify-between group hover:bg-white hover:shadow-md hover:border-slate-250 transition-all duration-300">
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                      isAddition ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                      isConsumption ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
                    }`}>
                      {isAddition ? <ArrowDownLeft className="w-5 h-5" /> :
                       isConsumption ? <ArrowUpRight className="w-5 h-5" /> : <RefreshCw className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${
                          isAddition ? 'text-emerald-700' : isConsumption ? 'text-rose-700' : 'text-blue-700'
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
                        isAddition ? 'text-emerald-600' : isConsumption ? 'text-rose-600' : 'text-blue-600'
                      }`}>
                        {tx.quantityChange > 0 ? '+' : ''}{tx.quantityChange.toLocaleString()} <span className="text-xs ml-0.5">{tx.unit || currentMaterial?.unit}</span>
                      </p>
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Balance: {tx.balanceAfter.toLocaleString()} {tx.unit || currentMaterial?.unit}</p>
                    </div>

                    {isAdmin && !isConsumption && (
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
          materials={rawMaterials}
          material={currentMaterial}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={(data: any) => addStockMutation.mutate(data)}
          isPending={addStockMutation.isPending}
        />
      )}

      {/* Create Material Modal */}
      {isCreateMaterialModalOpen && (
        <CreateMaterialModal
          onClose={() => setIsCreateMaterialModalOpen(false)}
          onSubmit={(data: any) => createMaterialMutation.mutate(data)}
          isPending={createMaterialMutation.isPending}
        />
      )}

      {isEditMaterialModalOpen && materialToEdit && (
        <EditMaterialModal
          material={materialToEdit}
          onClose={() => {
            setIsEditMaterialModalOpen(false);
            setMaterialToEdit(null);
          }}
          onSubmit={(payload: any) => updateMaterialMutation.mutate({ id: materialToEdit.id, payload })}
          isPending={updateMaterialMutation.isPending}
        />
      )}

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <StockTransactionModal
          materials={rawMaterials}
          material={currentMaterial}
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

      {/* Station-Wise Raw Material Consumption */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm p-6 space-y-6">
        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#1A9A91]" />
            Station-Wise Consumption Summary
          </h3>
          <p className="text-slate-400 font-bold text-[10px] mt-1 uppercase tracking-wide">
            Real-time material consumption across production stations
          </p>
        </div>

        {isConsumptionLoading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#1A9A91]" /></div>
        ) : !stationConsumption ? (
          <div className="py-12 text-center opacity-30 font-bold uppercase tracking-widest text-[10px]">No consumption data found</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                station: 'BLOWING',
                title: 'Blowing Station',
                material: 'Preforms',
                unit: 'Bags',
                icon: Wind,
                color: 'text-sky-600 bg-sky-50 border-sky-100',
                dataKey: 'preforms',
              },
              {
                station: 'FILLING',
                title: 'Filling Station',
                material: 'Caps',
                unit: 'Boxes',
                icon: PackageOpen,
                color: 'text-amber-600 bg-amber-50 border-amber-100',
                dataKey: 'caps',
              },
              {
                station: 'LABELING',
                title: 'Labeling Station',
                material: 'Labels',
                unit: 'KG',
                icon: Zap,
                color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
                dataKey: 'labels',
              },
              {
                station: 'PACKING',
                title: 'Packing Station',
                material: 'Shrink Film',
                unit: 'KG',
                icon: Box,
                color: 'text-[#1A9A91] bg-[#1A9A91]/5 border-[#1A9A91]/15',
                dataKey: 'shrinkFilm',
              },
            ].map((st) => {
              const stationData = stationConsumption[st.station] || {
                today: { preforms: 0, caps: 0, labels: 0, shrinkFilm: 0 },
                weekly: { preforms: 0, caps: 0, labels: 0, shrinkFilm: 0 },
                monthly: { preforms: 0, caps: 0, labels: 0, shrinkFilm: 0 },
              };
              const Icon = st.icon;

              return (
                <div key={st.station} className="bg-slate-50/40 rounded-2xl p-5 border border-slate-150 flex flex-col justify-between hover:shadow-md hover:bg-white hover:border-slate-200 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${st.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">{st.title}</h4>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{st.material} ({st.unit})</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: 'Today', val: stationData.today[st.dataKey] },
                      { label: 'Weekly (7d)', val: stationData.weekly[st.dataKey] },
                      { label: 'Monthly (30d)', val: stationData.monthly[st.dataKey] },
                    ].map((p) => (
                      <div key={p.label} className="flex justify-between items-center text-xs border-b border-slate-100/55 pb-1.5 last:border-0 last:pb-0">
                        <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">{p.label}</span>
                        <span className="font-mono font-black text-slate-800 tabular-nums">
                          {Number(p.val).toLocaleString(undefined, { minimumFractionDigits: st.unit === 'KG' || st.unit === 'g' ? 2 : 0, maximumFractionDigits: 2 })} {st.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      <ConfirmationModal
        isOpen={!!materialToDelete}
        onClose={() => setMaterialToDelete(null)}
        onConfirm={() => deleteMaterialMutation.mutate(materialToDelete.id)}
        title="Delete Raw Material"
        message={`Are you sure you want to delete ${materialToDelete?.name}? This will permanently remove the material and may affect production logs.`}
        confirmText="Yes, Delete Material"
        variant="danger"
      />
    </div>
  );
}

export function StockTransactionModal({ materials, material, transaction, onClose, onSubmit, isPending }: any) {
  const [itemType, setItemType] = useState<'RAW' | 'PRODUCT'>(
    transaction?.productId ? 'PRODUCT' : 'RAW'
  );
  const [quantity, setQuantity] = useState(transaction ? Math.abs(transaction.quantityChange).toString() : '');
  const [remarks, setRemarks] = useState(transaction?.remarks || '');
  const [selectedId, setSelectedId] = useState(
    transaction ? (transaction.productId || transaction.materialId) : (material?.id || '')
  );

  const { data: products } = useQuery({
    queryKey: ['production-stock-modal-list'],
    queryFn: async () => (await api.get(ENDPOINTS.INVENTORY.PRODUCTION_STOCK)).data,
    enabled: !transaction
  });

  const handleTypeChange = (newType: 'RAW' | 'PRODUCT') => {
    setItemType(newType);
    if (newType === 'PRODUCT') {
      setSelectedId(products?.[0]?.productId || '');
    } else {
      setSelectedId(materials?.[0]?.id || '');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
            {transaction ? 'Edit Stock Record' : 'Inward Stock'}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:bg-slate-200 rounded-lg transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>

        <form 
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ 
              itemId: selectedId, 
              itemType, 
              quantity: parseInt(quantity, 10), 
              remarks 
            });
          }}
          className="p-6 space-y-5"
        >
          {!transaction && (
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Stock Type</label>
              <select
                value={itemType}
                onChange={(e) => handleTypeChange(e.target.value as 'RAW' | 'PRODUCT')}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-black focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91]/50 outline-none transition-all"
              >
                <option value="RAW">Raw Material</option>
                <option value="PRODUCT">Finished Product</option>
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              {itemType === 'PRODUCT' ? 'Product Name' : 'Material Name'}
            </label>
            {transaction ? (
              <input 
                readOnly 
                value={material?.name || transaction.productName || transaction.materialName || ''} 
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-black text-slate-600 focus:outline-none select-none" 
              />
            ) : itemType === 'PRODUCT' ? (
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-black focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91]/50 outline-none transition-all"
              >
                <option value="">Select Product...</option>
                {products?.map((p: any) => (
                  <option key={p.productId} value={p.productId}>{p.productName}</option>
                ))}
              </select>
            ) : (
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-black focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91]/50 outline-none transition-all"
              >
                <option value="">Select Material...</option>
                {materials?.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Inward Quantity (Units)</label>
            <input 
              required
              type="number"
              min="1"
              value={quantity} 
              onChange={(e) => setQuantity(e.target.value)} 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-black focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91]/50 focus:bg-white outline-none transition-all" 
              placeholder="e.g. 10000" 
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Add Memo / Remarks</label>
            <textarea 
              value={remarks} 
              onChange={(e) => setRemarks(e.target.value)} 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91]/50 focus:bg-white outline-none transition-all h-24 resize-none" 
              placeholder="Enter supplier batch, delivery note details, or adjustment reason..." 
            />
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !quantity || parseInt(quantity, 10) <= 0 || !selectedId}
              className="px-5 py-2 bg-[#1A9A91] hover:bg-[#157C75] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {transaction ? 'Save Changes' : 'Confirm Inward'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CreateMaterialModal({ onClose, onSubmit, isPending }: any) {
  const [name, setName] = useState('');
  const [materialType, setMaterialType] = useState('');
  const [unit, setUnit] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !materialType || !unit) return;
    onSubmit({ name, materialType, unit });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#1A9A91]/10 text-[#1A9A91] rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 tracking-tight">Create Raw Material</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Define a new stock item</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Material Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 29mm Cap Blue"
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91] transition-all"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Material Type</label>
              <select
                value={materialType}
                onChange={(e) => setMaterialType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91] transition-all appearance-none"
                required
              >
                <option value="">Select...</option>
                <option value={MaterialType.PREFORM}>Preform</option>
                <option value={MaterialType.CAP}>Cap</option>
                <option value={MaterialType.LABEL}>Label</option>
                <option value={MaterialType.SHRINK}>Shrink Roll</option>
                <option value={MaterialType.OTHER}>Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Unit</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91] transition-all appearance-none"
                required
              >
                <option value="">Select...</option>
                <option value={MaterialUnit.BAG}>Bag (BAG)</option>
                <option value={MaterialUnit.BOX}>Box (BOX)</option>
                <option value={MaterialUnit.PCS}>Piece (PCS)</option>
                <option value={MaterialUnit.ROLL}>Roll (ROLL)</option>
                <option value={MaterialUnit.KG}>Kilogram (KG)</option>
                <option value={MaterialUnit.LTR}>Liter (LTR)</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-5 py-3 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold text-xs uppercase tracking-wider transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name || !materialType || !unit}
              className="flex-1 px-5 py-3 bg-[#1A9A91] hover:bg-[#157C75] text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#1A9A91]/20"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Create Material
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EditMaterialModal({ material, onClose, onSubmit, isPending }: any) {
  const [name, setName] = useState(material.name || '');
  const [materialType, setMaterialType] = useState(material.materialType || '');
  const [unit, setUnit] = useState(material.unit || '');
  const [currentStock, setCurrentStock] = useState<number | ''>(material.currentStock ?? 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !materialType || !unit || currentStock === '') return;
    onSubmit({ name, materialType, unit, currentStock: Number(currentStock) });
  };

  const hasChanges = name !== (material.name || '') || materialType !== (material.materialType || '') || unit !== (material.unit || '') || currentStock !== (material.currentStock ?? 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#1A9A91]/10 text-[#1A9A91] rounded-xl">
              <PenLine className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 tracking-tight">Edit Raw Material</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Update details and stock</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Material Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91] transition-all"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Material Type</label>
              <select
                value={materialType}
                onChange={(e) => setMaterialType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91] transition-all appearance-none"
                required
              >
                <option value={MaterialType.PREFORM}>Preform</option>
                <option value={MaterialType.CAP}>Cap</option>
                <option value={MaterialType.LABEL}>Label</option>
                <option value={MaterialType.SHRINK}>Shrink Roll</option>
                <option value={MaterialType.OTHER}>Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Unit</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91] transition-all appearance-none"
                required
              >
                <option value={MaterialUnit.BAG}>Bag (BAG)</option>
                <option value={MaterialUnit.BOX}>Box (BOX)</option>
                <option value={MaterialUnit.PCS}>Piece (PCS)</option>
                <option value={MaterialUnit.ROLL}>Roll (ROLL)</option>
                <option value={MaterialUnit.KG}>Kilogram (KG)</option>
                <option value={MaterialUnit.LTR}>Liter (LTR)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Current Stock Balance</label>
            <input
              type="number"
              value={currentStock}
              onChange={(e) => setCurrentStock(e.target.value ? Number(e.target.value) : '')}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91] transition-all"
              required
            />
            <p className="text-[9px] text-slate-400 mt-1.5 font-bold uppercase tracking-wider">
              Changing this value will automatically post an adjustment to the transaction ledger.
            </p>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-5 py-3 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold text-xs uppercase tracking-wider transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name || !materialType || !unit || currentStock === '' || !hasChanges}
              className="flex-1 px-5 py-3 bg-[#1A9A91] hover:bg-[#157C75] text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#1A9A91]/20"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
