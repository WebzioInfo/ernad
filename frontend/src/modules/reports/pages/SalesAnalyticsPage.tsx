import { useEffect, useState } from 'react';
import {
  Package, Search, AlertTriangle, X, Loader2, Check,
  Boxes, ChevronLeft, ChevronRight, Calendar, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../../../modules/auth/auth.store';
import {
  useBrands,
  useProducts,
  useSalesTransactionsFiltered,
  useCreateSalesTransaction,
  useUpdateSalesTransaction,
  useDeleteSalesTransaction,
  useCustomers,
  useCreateCustomer,
} from '../../../hooks/useApi';
import { useTransactionOverlay } from '../../../components/TransactionOverlay';

function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let start = displayValue;
    const end = value;
    if (start === end) return;

    const duration = 250; // ms
    const startTime = performance.now();

    let animationFrameId: number;

    const updateNumber = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = progress * (2 - progress); // easeOutQuad
      const current = Math.round(start + (end - start) * easeProgress);
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateNumber);
      }
    };

    animationFrameId = requestAnimationFrame(updateNumber);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value]);

  return <>{displayValue.toLocaleString()}</>;
}

export default function SalesAnalyticsPage() {
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [transactionType, setTransactionType] = useState<'SALES_DISPATCH' | 'RETURN' | 'DAMAGE'>('SALES_DISPATCH');
  const [quantity, setQuantity] = useState<string>('');
  const [salesDate, setSalesDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customerId, setCustomerId] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createErrorMsg, setCreateErrorMsg] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<{ brand?: string; product?: string; salesDate?: string; quantity?: string }>({});

  // Dialog states for Admin Edit/Delete
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  const isAnyModalOpen = isCustomerModalOpen || isCreateModalOpen || isEditModalOpen || isDeleteModalOpen;

  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isAnyModalOpen]);
  // Search & Filters for Ledger (Server-side & Current Month defaults)
  const defaultStartDate = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const defaultEndDate = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  const [startDate, setStartDate] = useState<string>(() => defaultStartDate);
  const [endDate, setEndDate] = useState<string>(() => defaultEndDate);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const queryParams = {
    startDate,
    endDate,
    brand: selectedBrandFilter,
    type: selectedTypeFilter,
    search: searchQuery,
    page,
    limit,
  };

  const {
    data: filteredResponse,
    isLoading: isLedgerLoading,
    isError: isLedgerError,
    error: ledgerError,
  } = useSalesTransactionsFiltered(queryParams);

  const { data: brands, isLoading: isBrandsLoading } = useBrands();
  const { data: products, isLoading: isProductsLoading } = useProducts();
  const { data: customers, isLoading: isCustomersLoading } = useCustomers();

  const { user } = useAuthStore();
  const isAdmin = user?.roles?.includes('ADMIN') || user?.role === 'ADMIN';
  const isAccountant = user?.roles?.includes('ACCOUNTANT') || user?.role === 'ACCOUNTANT';
  const canManageSales = isAdmin || isAccountant;

  const overlay = useTransactionOverlay();
  const createTxMutation = useCreateSalesTransaction();
  const createCustomerMutation = useCreateCustomer();

  const filteredTransactions = filteredResponse?.items || [];
  const pagination = filteredResponse?.pagination || { page: 1, limit: 10, totalItems: 0, totalPages: 1 };
  const summaryData = filteredResponse?.summary || { totalCases: 0, salesCases: 0, returnCases: 0, damageCases: 0 };
  const totalPages = pagination.totalPages;
  const totalCount = pagination.totalItems;

  if (isBrandsLoading || isProductsLoading || isCustomersLoading || (isLedgerLoading && !filteredResponse)) {
    return (
      <div className="h-96 flex items-center justify-center animate-pulse text-slate-400 font-black uppercase tracking-widest text-xs">
        Loading POS Terminal...
      </div>
    );
  }

  if (isLedgerError && !filteredResponse) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-center text-slate-600 px-6">
        <p className="text-xl font-bold text-slate-900">Unable to load sales ledger</p>
        <p className="mt-3 text-sm">{(ledgerError as any)?.response?.data?.message || (ledgerError as any)?.message || 'Please try again or contact support.'}</p>
      </div>
    );
  }
  const currentProduct = products?.find(p => p.id === selectedProductId);
  const currentBrand = brands?.find(b => b.id === selectedBrandId);
  const quantityInt = parseInt(quantity, 10) || 0;

  const resetCreateForm = () => {
    setSelectedBrandId('');
    setSelectedProductId('');
    setTransactionType('SALES_DISPATCH');
    setQuantity('');
    setSalesDate(format(new Date(), 'yyyy-MM-dd'));
    setCustomerId('');
    setRemarks('');
    setCreateErrorMsg('');
    setFieldErrors({});
  };

  const closeCreateModal = () => {
    resetCreateForm();
    setIsCreateModalOpen(false);
  };

  const handleSave = () => {
    if (overlay.isLocked) return;

    const errors: { brand?: string; product?: string; salesDate?: string; quantity?: string } = {};
    if (!selectedBrandId) errors.brand = 'Brand is required.';
    if (!selectedProductId) errors.product = 'Product is required.';
    if (!salesDate) errors.salesDate = 'Sales date is required.';
    if (quantityInt <= 0) errors.quantity = 'Enter a quantity greater than zero.';

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setCreateErrorMsg('Please fix the highlighted fields before saving.');
      return;
    }

    setCreateErrorMsg('');
    overlay.startProcessing('Saving sale...');

    createTxMutation.mutate(
      {
        brandId: selectedBrandId,
        productId: selectedProductId,
        type: transactionType as any,
        quantity: quantityInt,
        salesDate,
        customerId: customerId || undefined,
        remarks: remarks || undefined,
      },
      {
        onSuccess: async () => {
          await overlay.showSuccess('Sale created');
          toast.success('Sale created successfully');
          closeCreateModal();
        },
        onError: (err: any) => {
          overlay.showError('Save failed');
          setCreateErrorMsg(err?.response?.data?.message || 'Failed to create sales transaction.');
        }
      }
    );
  };

  const handleCustomerCreate = (payload: { name: string; code?: string; email?: string; phone?: string; address?: string }) => {
    createCustomerMutation.mutate(payload, {
      onSuccess: (customer: any) => {
        setCustomerId(customer?.id || '');
        setIsCustomerModalOpen(false);
        setCreateErrorMsg('');
      },
      onError: (err: any) => {
        setCreateErrorMsg(err?.response?.data?.message || 'Failed to create customer.');
      },
    });
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Page Header */}
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-4">
              <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-2xl">
                <Package className="w-8 h-8" />
              </div>
              Sales Dashboard
            </h1>
            <p className="text-slate-500 font-bold mt-2 ml-1">
              Create and review sales history from a simple workflow.
            </p>
          </div>

          {canManageSales && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1A9A91] px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-[#1A9A91]/20 hover:bg-[#157C75] transition active:scale-95"
            >
              + Create Sale
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total Cases */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex items-center justify-between transition hover:shadow-md">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Cases</p>
            <p className="text-2xl font-black text-slate-900">
              <AnimatedNumber value={summaryData.totalCases} /> Cases
            </p>
          </div>
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-700">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Sales Cases */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex items-center justify-between transition hover:shadow-md border-l-4 border-l-emerald-500">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Sales Cases</p>
            <p className="text-2xl font-black text-slate-900">
              <AnimatedNumber value={summaryData.salesCases} /> Cases
            </p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Return Cases */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex items-center justify-between transition hover:shadow-md border-l-4 border-l-amber-500">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Return Cases</p>
            <p className="text-2xl font-black text-slate-900">
              <AnimatedNumber value={summaryData.returnCases} /> Cases
            </p>
          </div>
          <div className="w-12 h-12 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
            <RefreshCw className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Damage Cases */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex items-center justify-between transition hover:shadow-md border-l-4 border-l-rose-500">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Damage Cases</p>
            <p className="text-2xl font-black text-slate-900">
              <AnimatedNumber value={summaryData.damageCases} /> Cases
            </p>
          </div>
          <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center text-rose-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </section>

      {/* ERP Analytics Filter Toolbar */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        {/* <div className="flex items-center gap-2 border-b border-slate-100 pb-3 justify-between"> */}
        <div className="flex items-center gap-2">
          {isLedgerLoading && (
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1A9A91]" /> Updating...
            </span>
          )}

        </div>
        {/* </div> */}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Primary Filters: Date Range */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Date *</label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 pl-11 pr-3 py-2.5 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/25 focus:border-[#1A9A91] focus:bg-white outline-none transition-all font-semibold text-sm cursor-pointer"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">End Date *</label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 pl-11 pr-3 py-2.5 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/25 focus:border-[#1A9A91] focus:bg-white outline-none transition-all font-semibold text-sm cursor-pointer"
              />
            </div>
          </div>

          {/* Search Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Search Text</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search code, product, staff..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 pl-11 pr-3 py-2.5 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/25 focus:border-[#1A9A91] focus:bg-white outline-none transition-all font-semibold text-sm placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Brand Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Brand</label>
            <select
              value={selectedBrandFilter}
              onChange={(e) => { setSelectedBrandFilter(e.target.value); setPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/25 focus:border-[#1A9A91] focus:bg-white outline-none transition-all font-semibold text-sm cursor-pointer"
            >
              <option value="">All Brands</option>
              {brands?.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Transaction Type Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Transaction Type</label>
            <select
              value={selectedTypeFilter}
              onChange={(e) => { setSelectedTypeFilter(e.target.value); setPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/25 focus:border-[#1A9A91] focus:bg-white outline-none transition-all font-semibold text-sm cursor-pointer"
            >
              <option value="">All Types</option>
              <option value="SALES_DISPATCH">Sales Dispatch</option>
              <option value="RETURN">Return</option>
              <option value="DAMAGE">Damage</option>
            </select>
          </div>
        </div>

        {/* Action buttons (Clear Filters) */}
        {
          (searchQuery || selectedBrandFilter || selectedTypeFilter || startDate !== defaultStartDate || endDate !== defaultEndDate) && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setStartDate(defaultStartDate);
                  setEndDate(defaultEndDate);
                  setSearchQuery('');
                  setSelectedBrandFilter('');
                  setSelectedTypeFilter('');
                  setPage(1);
                }}
                className="px-4 py-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-95 text-xs font-black uppercase tracking-wider border border-transparent hover:border-rose-100 bg-transparent"
              >
                Clear Filters
              </button>
            </div>
          )
        }
      </section >

      {/* Transaction Ledger Table */}
      < div className="mt-8 space-y-4" >
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Recent Dispatches & Returns</h2>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <motion.div
              key={`${startDate}-${endDate}-${searchQuery}-${selectedBrandFilter}-${selectedTypeFilter}-${page}`}
              initial={{ opacity: 0.7 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="py-5 px-8 text-xs font-black text-slate-400 uppercase tracking-widest">Sales Date</th>
                    <th className="py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">Brand</th>
                    <th className="py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">Product</th>
                    <th className="py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">Type</th>
                    <th className="py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Quantity</th>
                    <th className="py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                    <th className="py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">Logged By</th>
                    {canManageSales && <th className="py-5 px-8 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={canManageSales ? 8 : 7} className="py-20 text-center text-slate-400 font-bold text-sm">
                        No sales records found for the selected date range.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx: any) => (
                      <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-all">
                        <td className="py-4 px-8 text-sm font-semibold text-slate-700">
                          {formatSalesDate(tx.salesDate)}
                        </td>
                        <td className="py-4 px-6 text-sm font-black text-slate-800">{tx.brandName}</td>
                        <td className="py-4 px-6 text-sm font-semibold text-slate-600">{tx.productName}</td>
                        <td className="py-4 px-6 text-sm">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${tx.type === 'RETURN'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                            : tx.type === 'SALES_DISPATCH'
                              ? 'bg-rose-50 text-rose-700 border-rose-200/50'
                              : 'bg-amber-50 text-amber-700 border-amber-200/50'
                            }`}>
                            {tx.type === 'RETURN' ? 'Return' : tx.type === 'SALES_DISPATCH' ? 'Dispatch' : 'Damage'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-sm font-black text-slate-900 text-right">{tx.quantity.toLocaleString()} cases</td>
                        <td className="py-4 px-6 text-sm font-bold text-slate-700 text-right">
                          {tx.unitPrice && Number(tx.unitPrice) > 0 ? `₹${(Number(tx.unitPrice) * tx.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="py-4 px-6 text-sm font-semibold text-slate-500">
                          {tx.userName}
                          {tx.customerName ? (
                            <span className="block text-[10px] text-slate-400 font-bold mt-0.5">
                              To: {tx.customerName}
                            </span>
                          ) : (
                            <span className="block text-[10px] text-rose-400 font-bold mt-0.5">
                              Customer optional
                            </span>
                          )}
                        </td>
                        {canManageSales && (
                          <td className="py-4 px-8 text-sm text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setSelectedTransaction(tx);
                                  setIsEditModalOpen(true);
                                }}
                                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-all"
                              >
                                Edit
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    setSelectedTransaction(tx);
                                    setIsDeleteModalOpen(true);
                                  }}
                                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-all"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </motion.div>
          </div>

          {/* Table Pagination Controller */}
          {!isLedgerLoading && filteredTransactions.length > 0 && (
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pt-6 border-t border-slate-100 mt-6 text-[11px] text-slate-500 px-8 pb-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold">Show</span>
                <select
                  value={limit}
                  onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                  className="bg-white border border-slate-200 text-slate-700 px-2 py-1.5 rounded-lg font-semibold outline-none focus:ring-2 focus:ring-[#1A9A91]/30 focus:border-[#1A9A91] text-xs"
                >
                  <option value={5}>5 records</option>
                  <option value={10}>10 records</option>
                  <option value={25}>25 records</option>
                  <option value={50}>50 records</option>
                </select>
                <span>of <strong>{totalCount}</strong> transaction logs</span>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center gap-1 self-center">
                <button
                  onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                  disabled={page === 1}
                  className="p-2 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>

                {Array.from({ length: totalPages }).map((_, index) => {
                  const pageNum = index + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${page === pageNum
                        ? 'bg-[#1A9A91] border-[#1A9A91] text-white shadow-md shadow-[#1A9A91]/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                        }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={page === totalPages}
                  className="p-2 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div >

      <AnimatePresence>
        {isCreateModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={closeCreateModal}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="relative w-full max-w-[1100px] max-h-[90vh] overflow-hidden rounded-[2rem] bg-white border border-slate-100 shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-950 px-10 py-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-teal-500 text-white shadow-lg shadow-teal-500/20">
                    <Package className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-white">Create Sale</h2>
                    <p className="text-sm text-slate-300 mt-2">Enter sale details and save to your sales history.</p>
                  </div>
                </div>
                <button
                  onClick={closeCreateModal}
                  className="rounded-full bg-slate-800 p-3 text-slate-300 hover:bg-slate-700 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex-1 min-h-0 overflow-y-auto p-10 pb-12 md:grid md:grid-cols-[1fr_380px] gap-8 bg-slate-50 scrollbar-thin scrollbar-track-slate-100 scrollbar-thumb-slate-400/50">
                  <div className="space-y-6">
                    <section className="space-y-4 rounded-[2rem] bg-white p-5 shadow-sm border border-slate-100">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-black text-slate-900">Sale details</h3>
                          <p className="text-sm text-slate-500 mt-1">Select the brand, product, and customer for the sale.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-widest text-slate-500">Required</span>
                      </div>

                      <div className="grid gap-4">
                        <div>
                          <label className="mb-1 block text-[13px] font-black uppercase tracking-widest text-slate-500">Brand</label>
                          <select
                            value={selectedBrandId}
                            onChange={(e) => {
                              setSelectedBrandId(e.target.value);
                              setSelectedProductId('');
                            }}
                            className={`w-full rounded-3xl border px-4 py-3 text-sm font-bold text-slate-900 outline-none transition ${fieldErrors.brand ? 'border-rose-400 focus:border-rose-400 bg-rose-50' : 'border-slate-200 bg-white focus:border-teal-500'}`}
                          >
                            <option value="">Select brand</option>
                            {brands?.map((brand) => (
                              <option key={brand.id} value={brand.id}>{brand.name}</option>
                            ))}
                          </select>
                          {fieldErrors.brand ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.brand}</p> : null}
                        </div>

                        <div>
                          <label className="mb-1 block text-[13px] font-black uppercase tracking-widest text-slate-500">Product</label>
                          <select
                            value={selectedProductId}
                            onChange={(e) => setSelectedProductId(e.target.value)}
                            disabled={!selectedBrandId}
                            className={`w-full rounded-3xl border px-4 py-3 text-sm font-bold text-slate-900 outline-none transition ${fieldErrors.product ? 'border-rose-400 focus:border-rose-400 bg-rose-50' : 'border-slate-200 bg-white focus:border-teal-500'} disabled:cursor-not-allowed disabled:bg-slate-100`}
                          >
                            <option value="">Select product</option>
                            {products
                              ?.filter((product) => product.brandId === selectedBrandId)
                              .map((product) => (
                                <option key={product.id} value={product.id}>{product.name}</option>
                              ))}
                          </select>
                          {fieldErrors.product ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.product}</p> : null}
                        </div>
                      </div>
                    </section>

                    <section className="space-y-4 rounded-[2rem] bg-white p-5 shadow-sm border border-slate-100">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-black text-slate-900">Transaction details</h3>
                          <p className="text-sm text-slate-500 mt-1">Capture the date, type, and quantity for this sale.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-slate-500">Mandatory</span>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-[13px] font-black uppercase tracking-widest text-slate-500">Sales date</label>
                          <input
                            type="date"
                            value={salesDate}
                            onChange={(e) => setSalesDate(e.target.value)}
                            className={`w-full rounded-3xl border px-4 py-3 text-sm font-bold text-slate-900 outline-none transition ${fieldErrors.salesDate ? 'border-rose-400 focus:border-rose-400 bg-rose-50' : 'border-slate-200 bg-white focus:border-teal-500'}`}
                          />
                          {fieldErrors.salesDate ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.salesDate}</p> : null}
                        </div>
                        <div>
                          <label className="mb-1 block text-[13px] font-black uppercase tracking-widest text-slate-500">Transaction type</label>
                          <select
                            value={transactionType}
                            onChange={(e) => setTransactionType(e.target.value as any)}
                            className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-teal-500"
                          >
                            <option value="SALES_DISPATCH">Sales Dispatch</option>
                            <option value="RETURN">Return</option>
                            <option value="DAMAGE">Damage</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-[13px] font-black uppercase tracking-widest text-slate-500">Quantity (cases)</label>
                        <input
                          type="number"
                          min="1"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          placeholder="0"
                          className={`w-full rounded-3xl border px-4 py-3 text-sm font-bold text-slate-900 outline-none transition ${fieldErrors.quantity ? 'border-rose-400 focus:border-rose-400 bg-rose-50' : 'border-slate-200 bg-white focus:border-teal-500'}`}
                        />
                        {fieldErrors.quantity ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.quantity}</p> : null}
                      </div>
                    </section>

                    <section className="space-y-4 rounded-[2rem] bg-white p-6 shadow-sm border border-slate-100">
                      <div>
                        <h3 className="text-lg font-black text-slate-900">Optional details</h3>
                        <p className="text-sm text-slate-500 mt-1">Add a customer or notes for better tracking.</p>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500">Customer</label>
                          <select
                            value={customerId}
                            onChange={(e) => setCustomerId(e.target.value)}
                            className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold text-slate-900 outline-none transition focus:border-teal-500"
                          >
                            <option value="">No customer</option>
                            {customers?.map((customer) => (
                              <option key={customer.id} value={customer.id}>{customer.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => setIsCustomerModalOpen(true)}
                            className="w-full rounded-3xl border border-slate-200 bg-slate-100 px-4 py-4 text-sm font-black uppercase tracking-widest text-slate-700 hover:bg-slate-200 transition"
                          >
                            Add new customer
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-[13px] font-black uppercase tracking-widest text-slate-500">Notes</label>
                        <textarea
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          rows={4}
                          className="w-full min-h-[100px] rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-teal-500"
                          placeholder="Optional notes"
                        />
                      </div>
                    </section>
                  </div>

                  <aside className="space-y-5 rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl shadow-slate-900/20 border border-slate-800">
                    <div className="flex items-center justify-between gap-3 rounded-3xl bg-teal-500/10 px-4 py-3 border border-teal-500/20">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-teal-200">Order summary</p>
                        <p className="mt-2 text-2xl font-black">Review sale details</p>
                      </div>
                      <div className="rounded-3xl bg-teal-500/20 p-3 text-teal-200">
                        <Check className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <div className="rounded-3xl bg-slate-900/80 p-3 border border-slate-800">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Brand</p>
                        <p className="mt-2 text-base font-black text-white">{currentBrand?.name || 'Not selected'}</p>
                      </div>
                      <div className="rounded-3xl bg-slate-900/80 p-3 border border-slate-800">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Product</p>
                        <p className="mt-2 text-base font-black text-white">{currentProduct?.name || 'Not selected'}</p>
                      </div>
                      <div className="rounded-3xl bg-slate-900/80 p-3 border border-slate-800">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Type</p>
                        <p className="mt-2 text-base font-black text-white">{transactionType === 'RETURN' ? 'Return' : transactionType === 'DAMAGE' ? 'Damage' : 'Sales Dispatch'}</p>
                      </div>
                      <div className="rounded-3xl bg-slate-900/80 p-3 border border-slate-800">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Quantity</p>
                        <p className="mt-2 text-2xl font-black text-white">{quantityInt > 0 ? `${quantityInt} cases` : '0 cases'}</p>
                      </div>
                      <div className="rounded-3xl bg-slate-900/80 p-3 border border-slate-800">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Customer</p>
                        <p className="mt-2 text-base font-black text-white">{customers?.find((customer) => customer.id === customerId)?.name || 'Not selected'}</p>
                      </div>
                      <div className="rounded-3xl bg-slate-900/80 p-3 border border-slate-800">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Date</p>
                        <p className="mt-2 text-base font-black text-white">{salesDate || 'Not selected'}</p>
                      </div>
                    </div>

                    <div className="rounded-3xl bg-slate-900/80 p-4 border border-slate-800 text-sm text-slate-400">
                      Sales will be added directly to the ledger after saving. Close the modal at any time to keep your current search and filters intact.
                    </div>
                  </aside>
                </div>

                <div className="border-t border-slate-100 bg-white px-10 py-5">
                  {createErrorMsg ? (
                    <div className="mb-4 rounded-3xl bg-rose-50 p-4 text-sm font-bold text-rose-700 border border-rose-100">
                      {createErrorMsg}
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button
                      onClick={closeCreateModal}
                      className="rounded-3xl border border-slate-200 bg-white px-6 py-4 text-sm font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={createTxMutation.isPending || !selectedBrandId || !selectedProductId || quantityInt <= 0 || !salesDate}
                      className="inline-flex items-center justify-center gap-2 rounded-3xl bg-teal-500 px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-teal-500/20 hover:bg-teal-400 transition disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                    >
                      <Check className="w-4 h-4" />
                      {createTxMutation.isPending ? 'Saving sale...' : 'Save Sale'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
            customers={customers}
          />
        )}

        {isCustomerModalOpen && (
          <AddCustomerModal
            onClose={() => setIsCustomerModalOpen(false)}
            onSave={handleCustomerCreate}
            isSaving={createCustomerMutation.isPending}
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
    </div >
  );
}

// ─── EDIT SALES ENTRY MODAL ──────────────────────────────────────────────────

interface EditSalesEntryModalProps {
  onClose: () => void;
  transaction: any;
  brands: any[] | undefined;
  products: any[] | undefined;
  customers: any[] | undefined;
}

function EditSalesEntryModal({ onClose, transaction, brands, products, customers }: EditSalesEntryModalProps) {
  const [brandId, setBrandId] = useState(transaction.brandId);
  const [productId, setProductId] = useState(transaction.productId);
  const [type, setType] = useState(transaction.type);
  const [quantity, setQuantity] = useState(String(transaction.quantity));
  const [salesDate, setSalesDate] = useState(transaction.salesDate || format(new Date(), 'yyyy-MM-dd'));
  const [unitPrice, setUnitPrice] = useState(String(transaction.unitPrice || '0.00'));
  const [customerId, setCustomerId] = useState(transaction.customerId || '');
  const [remarks, setRemarks] = useState(transaction.remarks || '');
  const [errorMsg, setErrorMsg] = useState('');

  const updateTxMutation = useUpdateSalesTransaction();

  const handleUpdate = () => {
    const qtyInt = parseInt(quantity, 10) || 0;
    const priceNum = parseFloat(unitPrice) || 0;
    if (!brandId || !productId || !type || qtyInt <= 0 || !salesDate) {
      setErrorMsg('All fields are required and quantity must be greater than zero.');
      return;
    }
    if (priceNum < 0) {
      setErrorMsg('Unit price must be a non-negative number.');
      return;
    }

    updateTxMutation.mutate(
      {
        id: transaction.id,
        payload: {
          brandId,
          productId,
          type,
          quantity: qtyInt,
          salesDate,
          unitPrice: priceNum,
          customerId: customerId || undefined,
          remarks: remarks || undefined,
        }
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
        className="bg-white rounded-[2.5rem] p-10 max-w-lg w-full border border-slate-100 shadow-2xl relative flex flex-col max-h-[90vh] overflow-y-auto"
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
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div className="grid grid-cols-2 gap-4">
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
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Sales Date *</label>
              <input
                type="date"
                value={salesDate}
                onChange={(e) => setSalesDate(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-slate-50 shadow-sm cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Quantity (Cases) *</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-slate-50 shadow-sm"
                placeholder="Enter cases"
                min="1"
                required
              />
            </div>

            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Unit Price (₹) *</label>
              <input
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-slate-50 shadow-sm"
                placeholder="0.00"
                min="0"
                step="0.01"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Customer / Distributor *</label>
            </div>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-slate-50 shadow-sm"
            >
              <option value="">Select Customer (Required)</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code || 'No Code'})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Remarks / Notes</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-slate-50 shadow-sm min-h-[70px]"
              placeholder="Add optional notes..."
            />
          </div>
        </div>

        {/* Admin Audit Trail */}
        <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-[10px] space-y-2 font-semibold">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Audit Trail</div>
          <div className="flex justify-between">
            <span className="text-slate-400">Entered At (Created):</span>
            <span className="text-slate-700">{format(new Date(transaction.createdAt), 'dd-MMM-yyyy hh:mm a')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Last Updated:</span>
            <span className="text-slate-700">{format(new Date(transaction.updatedAt), 'dd-MMM-yyyy hh:mm a')}</span>
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

interface AddCustomerModalProps {
  onClose: () => void;
  onSave: (payload: { name: string; code?: string; email?: string; phone?: string; address?: string }) => void;
  isSaving: boolean;
}

function AddCustomerModal({ onClose, onSave, isSaving }: AddCustomerModalProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('Customer name is required.');
      return;
    }

    onSave({
      name: name.trim(),
      code: code.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
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
        className="bg-white rounded-[2.5rem] p-10 max-w-lg w-full border border-slate-100 shadow-2xl relative flex flex-col max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Add Customer</h2>
        <p className="text-slate-500 font-semibold text-xs mb-6">Create a customer record quickly for sales dispatch tracking.</p>

        {error && (
          <div className="mb-4 p-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold rounded-2xl">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Customer Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-slate-50 shadow-sm"
              placeholder="Customer name"
            />
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-slate-50 shadow-sm"
              placeholder="Optional customer code"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-slate-50 shadow-sm"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-slate-50 shadow-sm"
                placeholder="Phone number"
              />
            </div>
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Address</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-slate-50 shadow-sm min-h-[90px]"
              placeholder="Optional address or delivery details"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={onClose}
              className="px-5 py-3 hover:bg-slate-50 text-slate-500 rounded-xl font-bold text-xs uppercase tracking-wider border border-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Customer'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
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

        <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-rose-100">
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

// Timezone-safe local sales date formatter
const formatSalesDate = (dateStr: string) => {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const date = new Date(year, month, day);
  return format(date, 'dd-MMM-yyyy');
};
