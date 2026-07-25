import { useState, useMemo } from 'react';
import {
  History,
  Search,
  Calendar,
  Filter,
  RefreshCw,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  User,
  ShieldCheck,
  Clock,
  Sparkles,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditHistory } from '../../hooks/useApi';
import useAuthStore from '../auth/auth.store';
import type { EditHistoryRecord } from '../../types/database.types';

/**
 * Human-readable field label mapper.
 * Converts raw database column names into executive business labels.
 */
export function getFriendlyFieldLabel(fieldName: string): string {
  const map: Record<string, string> = {
    phone: 'Customer Phone',
    phoneNumber: 'Customer Phone',
    phone_number: 'Customer Phone',
    name: 'Name',
    customerName: 'Customer Name',
    customer_name: 'Customer Name',
    businessName: 'Business Name',
    business_name: 'Business Name',
    customerType: 'Customer Type',
    customer_type: 'Customer Type',
    gstNumber: 'GST Number',
    gst_number: 'GST Number',
    panNumber: 'PAN Number',
    pan_number: 'PAN Number',
    alternativePhone: 'Alternative Phone',
    alternative_phone: 'Alternative Phone',
    email: 'Email Address',
    address: 'Address',
    billingAddress: 'Billing Address',
    billing_address: 'Billing Address',
    shippingAddress: 'Shipping Address',
    shipping_address: 'Shipping Address',
    state: 'State',
    district: 'District',
    country: 'Country',
    pinCode: 'PIN Code',
    pin_code: 'PIN Code',
    openingBalance: 'Opening Balance',
    opening_balance: 'Opening Balance',
    openingBalanceType: 'Balance Type',
    opening_balance_type: 'Balance Type',
    creditLimit: 'Credit Limit',
    credit_limit: 'Credit Limit',
    paymentTerms: 'Payment Terms',
    payment_terms: 'Payment Terms',
    status: 'Status',
    notes: 'Notes / Remarks',
    remarks: 'Notes / Remarks',
    quantity: 'Quantity (Cases)',
    qty: 'Quantity (Cases)',
    salesDate: 'Sales Date',
    sales_date: 'Sales Date',
    unitPrice: 'Unit Price',
    unit_price: 'Unit Price',
    type: 'Transaction Type',
    brandName: 'Brand Name',
    productName: 'Product Name',
    targetBPM: 'Target Speed (BPM)',
    target_bpm: 'Target Speed (BPM)',
    sku: 'SKU Code',
    materialType: 'Material Type',
    material_type: 'Material Type',
    currentStock: 'Current Stock',
    current_stock: 'Current Stock',
    description: 'Description',
    unit: 'Unit of Measure',
  };

  if (map[fieldName]) return map[fieldName];

  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/** Grouped Edit Operation Structure */
export interface EditOperationGroup {
  groupId: string;
  editedAt: string;
  module: string;
  recordId: string;
  editedByName: string;
  editedByRole: string;
  changes: Array<{
    fieldName: string;
    friendlyLabel: string;
    oldValue?: string | null;
    newValue?: string | null;
  }>;
}

export default function EditHistoryPage() {
  const { user } = useAuthStore();
  const userRole = String(user?.role || '').toUpperCase();
  const userRoles = Array.isArray(user?.roles) ? user.roles.map(r => String(r).toUpperCase()) : [];

  const isOwnerOrAdmin =
    userRole === 'ADMIN' ||
    userRole === 'SUPER_ADMIN' ||
    userRole === 'COMPANY_OWNER' ||
    userRole === 'OWNER' ||
    userRoles.includes('ADMIN') ||
    userRoles.includes('SUPER_ADMIN') ||
    userRoles.includes('COMPANY_OWNER') ||
    userRoles.includes('OWNER');

  // Full Month Date Range Defaults
  const defaultStartDate = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const defaultEndDate = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(defaultEndDate);
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [employeeQuery, setEmployeeQuery] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [fieldQuery, setFieldQuery] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);

  const [selectedGroup, setSelectedGroup] = useState<EditOperationGroup | null>(null);

  const queryParams = {
    startDate,
    endDate,
    module: selectedModule,
    employee: employeeQuery,
    role: selectedRole,
    field: fieldQuery,
    search: searchQuery,
    page,
    limit,
  };

  const { data: historyResponse, isLoading, isError, error, refetch } = useEditHistory(queryParams);

  if (!isOwnerOrAdmin) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center shadow-lg">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Access Restricted</h2>
        <p className="text-sm font-semibold text-slate-500 max-w-md">
          The Edit History audit module is restricted exclusively to Company Owners and Super Admins.
        </p>
      </div>
    );
  }

  const items: EditHistoryRecord[] = historyResponse?.items || [];
  const pagination = historyResponse?.pagination || { page: 1, limit: 25, totalItems: 0, totalPages: 1 };
  const availableModules = historyResponse?.availableModules || [];
  const availableRoles = historyResponse?.availableRoles || [];

  /**
   * Group individual field edit rows into coherent Edit Operations
   * (Rows modified in the same save operation within 2 seconds for the same record)
   */
  const groupedOperations: EditOperationGroup[] = useMemo(() => {
    if (!items || items.length === 0) return [];

    const map = new Map<string, EditOperationGroup>();

    items.forEach((item) => {
      // Create rounded timestamp window (same 2-second bucket)
      const dateObj = new Date(item.editedAt);
      const timeBucket = Math.floor(dateObj.getTime() / 2000) * 2000;
      const key = `${timeBucket}_${item.module}_${item.recordId}_${item.editedByName || 'system'}`;

      const changeItem = {
        fieldName: item.fieldName,
        friendlyLabel: getFriendlyFieldLabel(item.fieldName),
        oldValue: item.oldValue,
        newValue: item.newValue,
      };

      if (map.has(key)) {
        const existingGroup = map.get(key)!;
        // Avoid duplicate field entries in same group
        if (!existingGroup.changes.some(c => c.fieldName === item.fieldName)) {
          existingGroup.changes.push(changeItem);
        }
      } else {
        map.set(key, {
          groupId: key,
          editedAt: item.editedAt,
          module: item.module,
          recordId: item.recordId,
          editedByName: item.editedByName || 'System User',
          editedByRole: item.editedByRole || 'OPERATOR',
          changes: [changeItem],
        });
      }
    });

    return Array.from(map.values());
  }, [items]);

  const handleClearFilters = () => {
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
    setSelectedModule('');
    setEmployeeQuery('');
    setSelectedRole('');
    setFieldQuery('');
    setSearchQuery('');
    setPage(1);
  };

  const isFiltered =
    startDate !== defaultStartDate ||
    endDate !== defaultEndDate ||
    selectedModule !== '' ||
    employeeQuery !== '' ||
    selectedRole !== '' ||
    fieldQuery !== '' ||
    searchQuery !== '';

  return (
    <div className="space-y-8 pb-20">
      {/* Executive Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-2xl">
              <History className="w-8 h-8 text-[#1A9A91]" />
            </div>
            Edit History Ledger
          </h1>
          <p className="text-slate-500 font-bold mt-2 ml-1">
            Complete Visibility into Record Modifications Made by Employees.
          </p>
        </div>

        <button
          onClick={() => void refetch()}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white border border-slate-200 px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-700 shadow-sm hover:bg-slate-50 transition active:scale-95 self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#1A9A91]' : ''}`} />
          Refresh History
        </button>
      </div>

      {/* Owner Filter Controls */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Filter History Records</h3>
          </div>
          {isFiltered && (
            <button
              onClick={handleClearFilters}
              className="text-xs font-black uppercase tracking-wider text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-xl transition"
            >
              Clear Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Start Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 pl-10 pr-3 py-2 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/25 focus:border-[#1A9A91] outline-none font-semibold text-xs cursor-pointer"
              />
            </div>
          </div>

          {/* End Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 pl-10 pr-3 py-2 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/25 focus:border-[#1A9A91] outline-none font-semibold text-xs cursor-pointer"
              />
            </div>
          </div>

          {/* Module Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Module</label>
            <select
              value={selectedModule}
              onChange={(e) => { setSelectedModule(e.target.value); setPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/25 focus:border-[#1A9A91] outline-none font-semibold text-xs cursor-pointer"
            >
              <option value="">All Modules</option>
              <option value="Customers">Customers</option>
              <option value="Sales">Sales</option>
              <option value="Returns">Returns</option>
              <option value="Damage">Damage</option>
              <option value="Products">Products</option>
              <option value="Raw Materials">Raw Materials</option>
              <option value="Machines">Machines</option>
              <option value="Inventory">Inventory</option>
              {availableModules.map(m => (
                !['Customers', 'Sales', 'Returns', 'Damage', 'Products', 'Raw Materials', 'Machines', 'Inventory'].includes(m) && (
                  <option key={m} value={m}>{m}</option>
                )
              ))}
            </select>
          </div>

          {/* Employee Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Edited By</label>
            <input
              type="text"
              placeholder="Employee name..."
              value={employeeQuery}
              onChange={(e) => { setEmployeeQuery(e.target.value); setPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/25 focus:border-[#1A9A91] outline-none font-semibold text-xs"
            />
          </div>

          {/* Role Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">User Role</label>
            <select
              value={selectedRole}
              onChange={(e) => { setSelectedRole(e.target.value); setPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/25 focus:border-[#1A9A91] outline-none font-semibold text-xs cursor-pointer"
            >
              <option value="">All Roles</option>
              <option value="ADMIN">ADMIN</option>
              <option value="MANAGER">MANAGER</option>
              <option value="ACCOUNTANT">ACCOUNTANT</option>
              <option value="OPERATOR">OPERATOR</option>
              {availableRoles.map(r => (
                !['ADMIN', 'MANAGER', 'ACCOUNTANT', 'OPERATOR'].includes(r) && (
                  <option key={r} value={r}>{r}</option>
                )
              ))}
            </select>
          </div>

          {/* Global Search */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Search Text</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search modifications..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 pl-9 pr-3 py-2 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/25 focus:border-[#1A9A91] outline-none font-semibold text-xs"
              />
            </div>
          </div>
        </div>
      </section>

      {/* History Ledger Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">Edited On</th>
                <th className="py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">Module</th>
                <th className="py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">Changes Made</th>
                <th className="py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">Edited By</th>
                <th className="py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">
                    Loading edit history records...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-rose-500 font-bold text-sm">
                    {(error as any)?.response?.data?.message || 'Failed to load edit history.'}
                  </td>
                </tr>
              ) : groupedOperations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400 font-bold text-sm">
                    No edit history records found for the selected query filters.
                  </td>
                </tr>
              ) : (
                groupedOperations.map((group) => (
                  <tr key={group.groupId} className="border-b border-slate-50 hover:bg-slate-50/60 transition-all">
                    {/* Edited On */}
                    <td className="py-4 px-6 text-xs font-bold text-slate-600 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {format(new Date(group.editedAt), 'dd MMM yyyy, HH:mm:ss')}
                      </div>
                    </td>

                    {/* Module */}
                    <td className="py-4 px-6 text-xs font-black text-slate-900 whitespace-nowrap">
                      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                        {group.module}
                      </span>
                    </td>

                    {/* Changes Made Summary */}
                    <td className="py-4 px-6 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5 max-w-xl">
                        {group.changes.slice(0, 3).map((change, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-lg font-bold text-[11px]">
                            {change.friendlyLabel}
                          </span>
                        ))}
                        {group.changes.length > 3 && (
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg text-[10px] font-black">
                            +{group.changes.length - 3} more
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Edited By */}
                    <td className="py-4 px-6 text-xs font-semibold text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <div>
                          <span className="font-bold text-slate-900">{group.editedByName}</span>
                          {group.editedByRole && (
                            <span className="ml-2 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-amber-50 text-amber-800 border border-amber-200">
                              {group.editedByRole}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Action button */}
                    <td className="py-4 px-6 text-xs text-center">
                      <button
                        onClick={() => setSelectedGroup(group)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1A9A91] hover:bg-[#157C75] text-white font-bold text-xs shadow-sm transition active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Changes
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controller */}
        {!isLoading && items.length > 0 && (
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pt-4 border-t border-slate-100 text-xs text-slate-500 px-6 pb-6">
            <div className="flex items-center gap-2">
              <span>Show</span>
              <select
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded-lg font-semibold outline-none text-xs"
              >
                <option value={15}>15 items</option>
                <option value={25}>25 items</option>
                <option value={50}>50 items</option>
                <option value={100}>100 items</option>
              </select>
              <span>of <strong>{pagination.totalItems}</strong> recorded changes</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                disabled={page === 1}
                className="p-2 border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {Array.from({ length: pagination.totalPages }).map((_, index) => {
                const pageNum = index + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg border transition ${
                      page === pageNum
                        ? 'bg-[#1A9A91] border-[#1A9A91] text-white shadow-sm'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setPage(prev => Math.min(prev + 1, pagination.totalPages))}
                disabled={page === pagination.totalPages}
                className="p-2 border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Simplified Executive Detail Modal */}
      <AnimatePresence>
        {selectedGroup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={() => setSelectedGroup(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              className="relative w-full max-w-2xl overflow-hidden rounded-[2.5rem] bg-white border border-slate-100 shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Executive Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-950 px-8 py-6 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#1A9A91]/20 flex items-center justify-center text-[#1A9A91]">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">Record Edit Details</h3>
                    <p className="text-xs text-slate-400">Executive Audit Overview</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedGroup(null)}
                  className="rounded-full bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Simplified Metadata Grid */}
              <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Module</span>
                    <span className="font-black text-slate-900 text-sm">{selectedGroup.module}</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Edited By</span>
                    <span className="font-black text-slate-900 text-sm truncate block">{selectedGroup.editedByName}</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">User Role</span>
                    <span className="font-bold text-amber-700 text-sm">{selectedGroup.editedByRole}</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Edited On</span>
                    <span className="font-bold text-slate-800 text-xs block mt-0.5">
                      {format(new Date(selectedGroup.editedAt), 'dd MMM yyyy, HH:mm')}
                    </span>
                  </div>
                </div>

                {/* Changes Made Section */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <History className="w-4 h-4 text-[#1A9A91]" />
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">Changes Made</h4>
                  </div>

                  <div className="space-y-4">
                    {selectedGroup.changes.map((change, idx) => (
                      <div key={idx} className="p-5 border border-slate-200 rounded-2xl bg-white space-y-3 shadow-sm">
                        <div className="text-xs font-black text-slate-900 flex items-center justify-between">
                          <span>{change.friendlyLabel}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Field Modification</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Previous Value */}
                          <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200/70 space-y-1">
                            <span className="text-[10px] font-black uppercase text-rose-600 block tracking-wider">Previous Value</span>
                            <div className="text-xs font-bold text-rose-950 break-words">
                              {change.oldValue ?? <em className="text-slate-400 font-normal">None / Empty</em>}
                            </div>
                          </div>

                          {/* Updated Value */}
                          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/70 space-y-1">
                            <span className="text-[10px] font-black uppercase text-emerald-700 block tracking-wider">Updated Value</span>
                            <div className="text-xs font-bold text-emerald-950 break-words">
                              {change.newValue ?? <em className="text-slate-400 font-normal">None / Empty</em>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-slate-100 bg-slate-50 px-8 py-4 flex justify-end">
                <button
                  onClick={() => setSelectedGroup(null)}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs uppercase tracking-wider hover:bg-slate-800 transition shadow-sm active:scale-95"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
