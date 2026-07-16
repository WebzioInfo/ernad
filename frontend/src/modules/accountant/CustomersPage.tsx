import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Search, Plus, Filter, ArrowUpDown, ChevronLeft, 
  ChevronRight, Edit2, Trash2, Download, RefreshCw, AlertTriangle, Eye
} from 'lucide-react';
import { useCustomersFiltered, useDeleteCustomer } from '../../hooks/useApi';
import useAuthStore from '../auth/auth.store';
import { toast } from 'sonner';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import { Customer } from '../../services/api-services';

export default function CustomersPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userRoles = (user?.roles || [user?.role]).map(r => String(r).toUpperCase());
  const isAdmin = userRoles.includes('ADMIN');
  const isAccountant = userRoles.includes('ACCOUNTANT');
  
  // Permissions checking
  const canCreate = isAdmin || isAccountant;
  const canEdit = isAdmin || isAccountant;
  const canDelete = isAdmin || isAccountant;
  const canExport = isAdmin || isAccountant;

  // State
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  // Filter params memo
  const params = useMemo(() => {
    const p: any = { page, limit, sortBy, sortOrder };
    if (search.trim()) p.search = search.trim();
    if (status) p.status = status;
    if (type) p.type = type;
    return p;
  }, [search, status, type, page, limit, sortBy, sortOrder]);

  const { data, isLoading, isError, refetch } = useCustomersFiltered(params);
  const deleteMutation = useDeleteCustomer();

  const customersList = data?.data || [];
  const totalCount = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleDelete = async () => {
    if (!customerToDelete) return;
    try {
      await deleteMutation.mutateAsync(customerToDelete.id);
      toast.success('Customer deleted successfully');
      setCustomerToDelete(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete customer');
    }
  };

  const handleExportCSV = () => {
    if (customersList.length === 0) {
      toast.error('No customer records to export');
      return;
    }
    
    const headers = [
      'Customer Code', 'Name', 'Business Name', 'Customer Type', 
      'GST Number', 'PAN Number', 'Phone', 'Alternative Phone', 
      'Email', 'Billing Address', 'ShippingAddress', 'State', 
      'District', 'Country', 'PIN Code', 'Opening Balance', 
      'Balance Type', 'Credit Limit', 'Payment Terms', 'Status'
    ];
    
    const rows = customersList.map(c => [
      c.code || '',
      c.name || '',
      c.businessName || '',
      c.customerType || '',
      c.gstNumber || '',
      c.panNumber || '',
      c.phone || '',
      c.alternativePhone || '',
      c.email || '',
      c.billingAddress || c.address || '',
      c.shippingAddress || '',
      c.state || '',
      c.district || '',
      c.country || '',
      c.pinCode || '',
      c.openingBalance || '0',
      c.openingBalanceType || 'DEBIT',
      c.creditLimit || '0',
      c.paymentTerms || '',
      c.status || 'ACTIVE'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `customers_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Customers exported to CSV successfully');
  };

  const handleResetFilters = () => {
    setSearch('');
    setStatus('');
    setType('');
    setPage(1);
  };

  // Base path resolution for routing (handles manager / accountant / admin prefix)
  const getBasePath = () => {
    const role = String(user?.role || '').toUpperCase();
    if (role === 'MANAGER') return '/manager';
    if (role === 'ACCOUNTANT') return '/accountant';
    return '/admin';
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto font-sans selection:bg-[#1A9A91]/10">
      {/* Title Header Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#1A9A91]/10 text-[#1A9A91] rounded-2xl animate-pulse-soft">
              <Users className="w-5 h-5" />
            </div>

            <div>
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight mt-1">
                Customer Directory
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {canExport && (
              <button
                onClick={handleExportCSV}
                className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border border-slate-200 shadow-sm transition-all flex items-center gap-1.5 active:scale-95 text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            )}

            {canCreate && (
              <button
                onClick={() => navigate(`${getBasePath()}/sales/customers/add`)}
                className="px-4 py-2 bg-[#1A9A91] hover:bg-[#157C75] text-white font-bold rounded-xl shadow-md shadow-[#1A9A91]/20 transition-all flex items-center gap-1.5 active:scale-95 text-xs uppercase tracking-wider"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Customer
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Filters and Controls Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Inputs */}
          <div className="relative flex-1 max-w-lg">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              placeholder="Search Name, Phone, Code, GST..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 pl-10 pr-3 py-2.5 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/30 focus:border-[#1A9A91] focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium text-sm"
            />
          </div>

          {/* Selector Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Filter className="w-3 h-3 text-slate-500" />
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Filters</span>
            </div>

            {/* Customer Type selector */}
            <select
              value={type}
              onChange={(e) => { setType(e.target.value); setPage(1); }}
              className="bg-white border border-slate-200 text-slate-700 px-2.5 py-2 rounded-xl font-semibold outline-none focus:ring-2 focus:ring-[#1A9A91]/30 text-xs"
            >
              <option value="">All Types</option>
              <option value="BUSINESS">Business</option>
              <option value="INDIVIDUAL">Individual</option>
            </select>

            {/* Status selector */}
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="bg-white border border-slate-200 text-slate-700 px-2.5 py-2 rounded-xl font-semibold outline-none focus:ring-2 focus:ring-[#1A9A91]/30 text-xs"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            {/* Reset Button */}
            {(search || status || type) && (
              <button
                onClick={handleResetFilters}
                className="px-3 py-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-95 text-[11px] font-bold"
              >
                Clear
              </button>
            )}

            {/* Refresh Button */}
            <button
              onClick={() => void refetch()}
              className="p-2 text-slate-500 hover:bg-slate-50 rounded-xl transition-all border border-slate-200 active:scale-95"
              title="Refresh List"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Main Table Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm overflow-hidden">
        <div className="overflow-x-auto min-h-[260px]">
          {isLoading ? (
            <div className="flex flex-col justify-center items-center h-64 gap-3 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-[#1A9A91]" />
              <span className="font-semibold text-sm">Querying customer accounts...</span>
            </div>
          ) : isError ? (
            <div className="flex flex-col justify-center items-center h-64 gap-2 text-rose-500 font-bold">
              <AlertTriangle className="w-8 h-8" />
              <span>Failed to fetch customers. Please retry.</span>
            </div>
          ) : customersList.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-64 gap-2 text-slate-400">
              <Users className="w-12 h-12 stroke-[1.5]" />
              <span className="font-bold text-base mt-2">No customers found.</span>
              <span className="text-xs text-slate-400">Try modifying search tags or filters.</span>
            </div>
          ) : (
            <table className="w-full text-left text-sm table-auto">
              <thead>
                <tr className="text-slate-400 uppercase tracking-widest text-[10px] border-b border-slate-100">
                  <th className="py-2 px-2 font-semibold">
                    <button onClick={() => handleSort('code')} className="flex items-center gap-1 hover:text-slate-700">
                      Code <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2 px-2 font-semibold">
                    <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-slate-700">
                      Name <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3 font-semibold">
                    <button onClick={() => handleSort('businessName')} className="flex items-center gap-1 hover:text-slate-700">
                      Business <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3 font-semibold">Contact</th>
                  <th className="py-3 px-3 font-semibold">Tax Identification</th>
                  <th className="py-3 px-3 font-semibold text-right">
                    <button onClick={() => handleSort('creditLimit')} className="flex items-center gap-1 hover:text-slate-700 ml-auto">
                      Credit Limit <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3 font-semibold text-center">Status</th>
                  <th className="py-3 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customersList.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors group border-b border-slate-100/50">
                    {/* Customer Code */}
                    <td className="py-2 px-2 font-mono font-bold text-slate-700 text-[11px]">
                      {customer.code || '-'}
                    </td>
                    
                    {/* Customer Name */}
                    <td className="py-2 px-2 font-black text-slate-900 text-sm">
                      {customer.name}
                    </td>

                    {/* Business Name */}
                    <td className="py-3 px-3 text-slate-500 font-medium text-[11px]">
                      {customer.businessName || <span className="text-slate-300">N/A</span>}
                    </td>

                    {/* Contact Details */}
                    <td className="py-3 px-3 space-y-0.5">
                      <p className="text-slate-800 font-bold text-[11px]">{customer.phone}</p>
                      {customer.email && <p className="text-slate-400 text-[10px] truncate max-w-[150px]">{customer.email}</p>}
                    </td>

                    {/* Tax IDs (GST/PAN) */}
                    <td className="py-2 px-2 space-y-1">
                      {customer.gstNumber ? (
                        <div className="inline-flex items-center px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-[9px] rounded-md tracking-wider">
                          GST: {customer.gstNumber}
                        </div>
                      ) : null}
                      {customer.panNumber ? (
                        <div className="block text-[10px] text-slate-400 font-semibold font-mono">
                          PAN: {customer.panNumber}
                        </div>
                      ) : null}
                      {!customer.gstNumber && !customer.panNumber && <span className="text-slate-300 text-[11px]">N/A</span>}
                    </td>

                    {/* Credit Limit */}
                    <td className="py-2 px-2 text-right font-black text-slate-900 text-[11px]">
                      ₹{parseFloat(customer.creditLimit || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Status badge */}
                    <td className="py-2 px-2 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-black rounded-full uppercase tracking-wider border ${
                        customer.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-slate-50 text-slate-500 border-slate-100'
                      }`}>
                        {customer.status || 'ACTIVE'}
                      </span>
                    </td>

                    {/* Edit/Delete Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`${getBasePath()}/sales/customers/${customer.id}`)}
                          className="p-1.5 hover:bg-[#1A9A91]/10 text-slate-500 hover:text-[#1A9A91] rounded-lg transition-colors"
                          title="View Ledger & Profile"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => navigate(`${getBasePath()}/sales/customers/edit/${customer.id}`)}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-950 rounded-lg transition-colors"
                            title="Edit profile"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => setCustomerToDelete(customer)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                            title="Delete customer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Table Pagination Controller */}
        {!isLoading && !isError && customersList.length > 0 && (
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pt-6 border-t border-slate-100 mt-6 text-[11px] text-slate-500">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold">Show</span>
              <select
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="bg-white border border-slate-200 text-slate-700 px-2 py-1.5 rounded-lg font-semibold outline-none focus:ring-2 focus:ring-[#1A9A91]/30 text-xs"
              >
                <option value={5}>5 records</option>
                <option value={10}>10 records</option>
                <option value={25}>25 records</option>
                <option value={50}>50 records</option>
              </select>
              <span>of <strong>{totalCount}</strong> customer records</span>
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
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                      page === pageNum
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
      </section>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!customerToDelete}
        onClose={() => setCustomerToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Customer Account"
        message={`Are you sure you want to delete the customer "${customerToDelete?.name}"? This operation performs a soft delete and will retain historical invoice/dispatch ledger entries.`}
        confirmText="Yes, Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
