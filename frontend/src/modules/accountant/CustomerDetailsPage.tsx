import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Users, ArrowLeft, Edit2, 
  ShoppingBag, Clipboard, History, Layers, 
  Printer, Download, ChevronLeft, ChevronRight,
  TrendingUp, Activity, Ban, X
} from 'lucide-react';
import { 
  useCustomerById, useCustomerSummary, useCustomerLedger, 
  useCustomerSales, useCustomerReturns, useCustomerDamages, 
  useCustomerActivities 
} from '../../hooks/useApi';
import { SalesService } from '../../services/api-services';
import useAuthStore from '../auth/auth.store';
import { toast } from 'sonner';

export default function CustomerDetailsPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const id = customerId || '';

  // Tab State
  const [activeTab, setActiveTab] = useState<'ledger' | 'sales' | 'returns' | 'damages' | 'activity'>('ledger');

  // Ledger Filter States
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');
  const [ledgerType, setLedgerType] = useState('');

  // Paginated List Pages
  const [salesPage, setSalesPage] = useState(1);
  const [returnsPage, setReturnsPage] = useState(1);
  const [damagesPage, setDamagesPage] = useState(1);

  // Modal Transaction View State
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [modalType, setModalType] = useState<'sale' | 'return' | 'damage' | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [orderDetails, setOrderDetails] = useState<any>(null);

  // Queries (Cast as any to bypass generic options type checks)
  const { data: customer, isLoading: isCustLoading } = useCustomerById(id) as any;
  useCustomerSummary(id);
  
  const ledgerParams = useMemo(() => {
    const p: any = {};
    if (ledgerStartDate) p.startDate = ledgerStartDate;
    if (ledgerEndDate) p.endDate = ledgerEndDate;
    if (ledgerType) p.type = ledgerType;
    return p;
  }, [ledgerStartDate, ledgerEndDate, ledgerType]);

  // Lazy Load queries based on Active Tab
  const { data: ledger, isLoading: isLedgerLoading } = useCustomerLedger(id, ledgerParams, { enabled: activeTab === 'ledger' }) as any;
  const { data: salesData, isLoading: isSalesLoading } = useCustomerSales(id, { page: salesPage, limit: 5 }, { enabled: activeTab === 'sales' }) as any;
  const { data: returnsData, isLoading: isReturnsLoading } = useCustomerReturns(id, { page: returnsPage, limit: 5 }, { enabled: activeTab === 'returns' }) as any;
  const { data: damagesData, isLoading: isDamagesLoading } = useCustomerDamages(id, { page: damagesPage, limit: 5 }, { enabled: activeTab === 'damages' }) as any;
  const { data: activities, isLoading: isActivitiesLoading } = useCustomerActivities(id, { enabled: activeTab === 'activity' }) as any;

  const userRoles = (user?.roles || [user?.role]).map(r => String(r).toUpperCase());
  const isAdmin = userRoles.includes('ADMIN');
  const isAccountant = userRoles.includes('ACCOUNTANT');
  const canEdit = isAdmin || isAccountant;

  const getBasePath = () => {
    const role = String(user?.role || '').toUpperCase();
    if (role === 'MANAGER') return '/manager';
    if (role === 'ACCOUNTANT') return '/accountant';
    return '/admin';
  };

  // View Row Action Handler
  const handleViewTransaction = async (tx: any) => {
    setSelectedTx(tx);
    let type: 'sale' | 'return' | 'damage' | null = null;
    
    if (activeTab === 'sales' || tx.transactionType === 'sale') type = 'sale';
    else if (activeTab === 'returns' || tx.transactionType === 'return') type = 'return';
    else if (activeTab === 'damages' || tx.transactionType === 'damage') type = 'damage';
    
    setModalType(type);

    // If it's a standard sales order, fetch items dynamically
    const orderNumber = tx.orderNumber || tx.reference;
    if (type === 'sale' && orderNumber && !orderNumber.startsWith('DISP-')) {
      setIsLoadingOrder(true);
      setOrderDetails(null);
      try {
        const fullOrder = await SalesService.getOrderById(tx.id || tx.orderId);
        setOrderDetails(fullOrder);
      } catch (err) {
        console.error('[Transaction Modal] Failed to load sales order items', err);
        toast.error('Failed to load transaction details.');
      } finally {
        setIsLoadingOrder(false);
      }
    }
  };

  // Export Ledger to CSV
  const handleExportLedgerExcel = () => {
    if (!ledger || ledger.length === 0) {
      toast.error('No ledger entries to export');
      return;
    }
    const headers = ['Date', 'Reference', 'Description', 'Debit (₹)', 'Credit (₹)', 'Running Balance (₹)', 'Created By'];
    const rows = ledger.map((e: any) => [
      new Date(e.date).toLocaleDateString('en-IN'),
      e.reference,
      e.description,
      e.debit,
      e.credit,
      e.runningBalance,
      e.createdBy
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map((r: any) => r.map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `customer_ledger_${customer?.code || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Ledger statement exported successfully');
  };

  // Browser Print Statement helper
  const handlePrintLedger = () => {
    window.print();
  };

  if (isCustLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen gap-3 text-slate-400">
        <Layers className="w-8 h-8 animate-spin text-[#1A9A91]" />
        <span className="font-semibold text-sm">Querying customer accounts...</span>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col justify-center items-center h-screen gap-3 text-rose-500 font-bold">
        <Ban className="w-12 h-12" />
        <span>Customer record not found.</span>
        <button onClick={() => navigate(-1)} className="text-[#1A9A91] hover:underline mt-2">Go Back</button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto print:p-0 print:m-0 print:bg-white font-sans selection:bg-[#1A9A91]/10">
      {/* 1. Header Card (Hides on browser printing) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-3 px-5 shadow-sm print:hidden">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`${getBasePath()}/sales/customers`)}
              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-[#1A9A91] rounded-lg transition-all active:scale-95 border border-slate-200"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A9A91] bg-[#1A9A91]/10 px-2 py-0.5 rounded-md">
                  {customer.customerType || 'B2C'}
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  {customer.code || '-'}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-black rounded-full uppercase tracking-wider border ${
                  customer.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : 'bg-slate-50 text-slate-500 border-slate-100'
                }`}>
                  {customer.status || 'ACTIVE'}
                </span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{customer.name}</h1>
              {customer.businessName && <p className="text-xs text-slate-500 font-medium">{customer.businessName}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <button
                onClick={() => navigate(`${getBasePath()}/sales/customers/edit/${customer.id}`)}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg border border-slate-200 shadow-sm transition-all flex items-center gap-1.5 active:scale-95 text-xs"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Printable Statement Header (Visible only when printing) */}
      <div className="hidden print:block mb-8 p-4 border-b-2 border-slate-300 bg-white">
        <h1 className="text-2xl font-bold text-slate-900">{customer.name}</h1>
        <p className="text-sm text-slate-500">Customer Account Statement / Ledger Summary</p>
        <p className="text-xs text-slate-400 font-mono mt-1">Code: {customer.code || '-'} | Type: {customer.customerType}</p>
        <p className="text-xs text-slate-400">Statement generated on {new Date().toLocaleDateString('en-IN')}</p>
      </div>

      {/* 3. Main Details and Tabs section */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left Side: General Profile Card (Hides on browser printing) */}
        <div className="lg:col-span-4 space-y-4 print:hidden">
          <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Users className="w-3.5 h-3.5 text-[#1A9A91]" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Account Details</h2>
            </div>
            
            <div className="space-y-2 text-xs font-medium text-slate-600">
              {/* Type Details */}
              <div className="flex justify-between py-1 border-b border-slate-100/50">
                <span className="text-slate-400">Business Type:</span>
                <span className="font-bold text-slate-900">{customer.customerType || 'B2C'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100/50">
                <span className="text-slate-400">Trade/Business Name:</span>
                <span className="font-bold text-slate-900 text-right">{customer.businessName || <span className="text-slate-300">N/A</span>}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100/50">
                <span className="text-slate-400">Primary Phone:</span>
                <span className="font-bold text-slate-900">{customer.phone}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100/50">
                <span className="text-slate-400">Alternative Phone:</span>
                <span className="font-bold text-slate-900">{customer.alternativePhone || <span className="text-slate-300">N/A</span>}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100/50">
                <span className="text-slate-400">Email:</span>
                <span className="font-bold text-slate-900 text-right">{customer.email || <span className="text-slate-300">N/A</span>}</span>
              </div>

              {/* Tax Details */}
              {customer.customerType === 'B2B' && (
                <>
                  <div className="flex justify-between py-1 border-b border-slate-100/50">
                    <span className="text-slate-400">GST Number:</span>
                    <span className="font-mono font-bold text-slate-900">{customer.gstNumber || <span className="text-slate-300">N/A</span>}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100/50">
                    <span className="text-slate-400">PAN Number:</span>
                    <span className="font-mono font-bold text-slate-900">{customer.panNumber || <span className="text-slate-300">N/A</span>}</span>
                  </div>
                </>
              )}

              {/* Opening Balance */}
              <div className="flex justify-between py-1 border-b border-slate-100/50">
                <span className="text-slate-400">Opening Balance:</span>
                <span className="font-bold text-slate-900">
                  ₹{parseFloat(customer.openingBalance || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({customer.openingBalanceType})
                </span>
              </div>

              {/* Addresses */}
              <div className="py-1 space-y-0.5">
                <span className="text-slate-400">Billing Address:</span>
                <p className="font-bold text-slate-800 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100 text-[11px]">
                  {customer.billingAddress || customer.address || <span className="text-slate-300">No address recorded.</span>}
                </p>
              </div>
              {customer.shippingAddress && (
                <div className="py-1 space-y-0.5">
                  <span className="text-slate-400">Shipping Address:</span>
                  <p className="font-bold text-slate-800 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100 text-[11px]">
                    {customer.shippingAddress}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Side: Navigation Tabs and Table Data List */}
        <div className="lg:col-span-8 space-y-4 print:col-span-12">
          {/* Tab Selection Row (Hides on browser printing) */}
          <div className="border-b border-slate-200 flex flex-wrap gap-1 print:hidden bg-slate-100/50 p-1 rounded-xl">
            {[
              { id: 'ledger', label: 'Customer Ledger', icon: Clipboard },
              { id: 'sales', label: 'Sales', icon: ShoppingBag },
              { id: 'returns', label: 'Returns', icon: TrendingUp },
              { id: 'damages', label: 'Damages', icon: Ban },
              { id: 'activity', label: 'Activity Logs', icon: Activity },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === tab.id
                      ? 'bg-white text-[#1A9A91] shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-white/40'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* TAB 1: LEDGER */}
          {activeTab === 'ledger' && (
            <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4 print:border-none print:shadow-none print:p-0">
              {/* Header options (hidden when printing) */}
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between print:hidden">
                <h2 className="text-base font-extrabold text-slate-900">Ledger Statement</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handlePrintLedger}
                    className="p-2.5 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 active:scale-95 transition-all"
                    title="Print Ledger"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleExportLedgerExcel}
                    className="p-2.5 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 active:scale-95 transition-all"
                    title="Export CSV"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Ledger filters row (hidden when printing) */}
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 print:hidden text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={ledgerStartDate}
                    onChange={(e: any) => setLedgerStartDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-950 px-3 py-2 rounded-xl focus:ring-1 focus:ring-[#1A9A91] focus:border-[#1A9A91] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1">End Date</label>
                  <input
                    type="date"
                    value={ledgerEndDate}
                    onChange={(e: any) => setLedgerEndDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-950 px-3 py-2 rounded-xl focus:ring-1 focus:ring-[#1A9A91] focus:border-[#1A9A91] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1">Type</label>
                  <select
                    value={ledgerType}
                    onChange={(e: any) => setLedgerType(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-800 px-3 py-2 rounded-xl focus:ring-1 focus:ring-[#1A9A91] focus:border-[#1A9A91] outline-none"
                  >
                    <option value="">All Entries</option>
                    <option value="invoice">Invoices Only</option>
                    <option value="return">Returns Only</option>
                    <option value="damage">Damages Only</option>
                  </select>
                </div>
                <div className="flex items-end justify-end">
                  {(ledgerStartDate || ledgerEndDate || ledgerType) && (
                    <button
                      onClick={() => { setLedgerStartDate(''); setLedgerEndDate(''); setLedgerType(''); }}
                      className="px-4 py-2 hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-bold transition-all"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>

              {/* Ledger Table */}
              <div className="overflow-x-auto">
                {isLedgerLoading ? (
                  <div className="flex justify-center items-center py-16 text-slate-400 text-xs font-semibold gap-2">
                    <History className="w-5 h-5 animate-spin text-[#1A9A91]" />
                    Compiling ledger records...
                  </div>
                ) : !ledger || ledger.length === 0 ? (
                  <div className="flex justify-center items-center py-16 text-slate-400 text-xs font-semibold">
                    No transactions found for the specified period.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs table-auto">
                    <thead>
                      <tr className="text-slate-400 uppercase tracking-widest text-[10px] border-b border-slate-100">
                        <th className="py-3 px-3 font-semibold">Reference Number</th>
                        <th className="py-3 px-3 font-semibold">Date</th>
                        <th className="py-3 px-3 font-semibold">Transaction Type</th>
                        <th className="py-3 px-3 font-semibold text-right">Amount (₹)</th>
                        <th className="py-3 px-3 font-semibold text-right">Running Balance</th>
                        <th className="py-3 px-3 font-semibold text-center">Status</th>
                        <th className="py-3 px-3 font-semibold">Created By</th>
                        <th className="py-3 px-3 font-semibold text-right print:hidden">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ledger.map((entry: any, index: number) => (
                        <tr key={index} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100/50">
                          <td className="py-3 px-3 font-mono font-bold text-slate-800 uppercase">
                            {entry.reference}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-500 whitespace-nowrap">
                            {new Date(entry.date).toLocaleDateString('en-IN')}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-black rounded-md uppercase border ${
                              entry.transactionType === 'sale'
                                ? 'bg-teal-50 text-teal-700 border-teal-100'
                                : entry.transactionType === 'return'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                : entry.transactionType === 'damage'
                                ? 'bg-orange-50 text-orange-700 border-orange-100'
                                : 'bg-slate-50 text-slate-600 border-slate-100'
                            }`}>
                              {entry.transactionType || 'Adjustment'}
                            </span>
                          </td>
                          <td className={`py-3 px-3 text-right font-bold ${entry.debit > 0 ? 'text-slate-900' : 'text-[#1A9A91]'}`}>
                            ₹{entry.debit > 0 
                              ? entry.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) 
                              : entry.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className={`py-3 px-3 text-right font-black ${entry.runningBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                            ₹{Math.abs(entry.runningBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} 
                            <span className="text-[10px] text-slate-400 font-semibold ml-0.5">
                              {entry.runningBalance >= 0 ? 'Dr' : 'Cr'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase">
                              {entry.status || 'CONFIRMED'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-500 font-medium whitespace-nowrap">
                            {entry.createdBy}
                          </td>
                          <td className="py-3 px-3 text-right print:hidden">
                            {entry.transactionType !== 'opening' && (
                              <button
                                onClick={() => handleViewTransaction(entry)}
                                className="px-2.5 py-1 text-[10px] bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 active:scale-95 transition-all"
                              >
                                View
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          )}

          {/* TAB 2: INVOICES / SALES */}
          {activeTab === 'sales' && (
            <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-base font-extrabold text-slate-900">Invoices & Direct Dispatches</h2>
              </div>

              <div className="overflow-x-auto">
                {isSalesLoading ? (
                  <div className="flex justify-center items-center py-16 text-slate-400 text-xs font-semibold gap-2">
                    <History className="w-5 h-5 animate-spin text-[#1A9A91]" />
                    Fetching sales orders...
                  </div>
                ) : !salesData || salesData.data.length === 0 ? (
                  <div className="flex justify-center items-center py-16 text-slate-400 text-xs font-semibold">
                    No sales orders recorded.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <table className="w-full text-left text-xs table-auto">
                      <thead>
                        <tr className="text-slate-400 uppercase tracking-widest text-[10px] border-b border-slate-100">
                          <th className="py-3 px-3 font-semibold">Invoice Number</th>
                          <th className="py-3 px-3 font-semibold">Date</th>
                          <th className="py-3 px-3 font-semibold text-center">Product Count</th>
                          <th className="py-3 px-3 font-semibold text-center">Quantity</th>
                          <th className="py-3 px-3 font-semibold text-right">Grand Total (₹)</th>
                          <th className="py-3 px-3 font-semibold text-center">Status</th>
                          <th className="py-3 px-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {salesData.data.map((order: any) => (
                          <tr key={order.id} className="hover:bg-slate-50/50 border-b border-slate-100/50">
                            <td className="py-3 px-3 font-mono font-bold text-slate-800 uppercase">
                              {order.orderNumber}
                            </td>
                            <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                              {new Date(order.orderDate).toLocaleDateString('en-IN')}
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-slate-800">
                              {order.itemCount}
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-slate-800">
                              {order.quantity}
                            </td>
                            <td className="py-3 px-3 text-right font-black text-slate-900">
                              ₹{parseFloat(order.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-black rounded-md uppercase border ${
                                order.status === 'DELIVERED'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                              }`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => handleViewTransaction(order)}
                                className="px-2.5 py-1 text-[10px] bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 active:scale-95 transition-all"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Pagination */}
                    {salesData.totalPages > 1 && (
                      <div className="flex items-center justify-end gap-1.5 pt-4 text-xs">
                        <button
                          onClick={() => setSalesPage(prev => Math.max(prev - 1, 1))}
                          disabled={salesPage === 1}
                          className="p-1.5 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg transition-colors disabled:opacity-30"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-slate-400">Page {salesPage} of {salesData.totalPages}</span>
                        <button
                          onClick={() => setSalesPage(prev => Math.min(prev + 1, salesData.totalPages))}
                          disabled={salesPage === salesData.totalPages}
                          className="p-1.5 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg transition-colors disabled:opacity-30"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* TAB 3: RETURNS */}
          {activeTab === 'returns' && (
            <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-base font-extrabold text-slate-900">Returns Records</h2>
              </div>

              <div className="overflow-x-auto">
                {isReturnsLoading ? (
                  <div className="flex justify-center items-center py-16 text-slate-400 text-xs font-semibold gap-2">
                    <History className="w-5 h-5 animate-spin text-[#1A9A91]" />
                    Fetching returns transactions...
                  </div>
                ) : !returnsData || returnsData.data.length === 0 ? (
                  <div className="flex justify-center items-center py-16 text-slate-400 text-xs font-semibold">
                    No sales returns recorded.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <table className="w-full text-left text-xs table-auto">
                      <thead>
                        <tr className="text-slate-400 uppercase tracking-widest text-[10px] border-b border-slate-100">
                          <th className="py-3 px-3 font-semibold">Return Number</th>
                          <th className="py-3 px-3 font-semibold">Date</th>
                          <th className="py-3 px-3 font-semibold">Original Invoice</th>
                          <th className="py-3 px-3 font-semibold">Items</th>
                          <th className="py-3 px-3 font-semibold text-center">Quantity</th>
                          <th className="py-3 px-3 font-semibold text-right">Amount (₹)</th>
                          <th className="py-3 px-3 font-semibold text-center">Status</th>
                          <th className="py-3 px-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {returnsData.data.map((r: any) => (
                          <tr key={r.id} className="hover:bg-slate-50/50 border-b border-slate-100/50">
                            <td className="py-3 px-3 font-mono font-bold text-slate-800 uppercase">
                              RET-{r.id.substring(0, 8).toUpperCase()}
                            </td>
                            <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                              {new Date(r.salesDate).toLocaleDateString('en-IN')}
                            </td>
                            <td className="py-3 px-3 text-slate-500 italic">
                              {r.remarks && r.remarks.includes('Inv:') 
                                ? r.remarks.substring(r.remarks.indexOf('Inv:')) 
                                : 'Direct Return'}
                            </td>
                            <td className="py-3 px-3 font-bold text-slate-700">
                              {r.productName}
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-slate-800">
                              {r.quantity}
                            </td>
                            <td className="py-3 px-3 text-right font-black text-slate-900">
                              ₹{r.refundAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase">
                                CONFIRMED
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => handleViewTransaction(r)}
                                className="px-2.5 py-1 text-[10px] bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 active:scale-95 transition-all"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Pagination */}
                    {returnsData.totalPages > 1 && (
                      <div className="flex items-center justify-end gap-1.5 pt-4 text-xs">
                        <button
                          onClick={() => setReturnsPage(prev => Math.max(prev - 1, 1))}
                          disabled={returnsPage === 1}
                          className="p-1.5 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg transition-colors disabled:opacity-30"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-slate-400">Page {returnsPage} of {returnsData.totalPages}</span>
                        <button
                          onClick={() => setReturnsPage(prev => Math.min(prev + 1, returnsData.totalPages))}
                          disabled={returnsPage === returnsData.totalPages}
                          className="p-1.5 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg transition-colors disabled:opacity-30"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* TAB 4: DAMAGES */}
          {activeTab === 'damages' && (
            <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-base font-extrabold text-slate-900">Damage Entries</h2>
              </div>

              <div className="overflow-x-auto">
                {isDamagesLoading ? (
                  <div className="flex justify-center items-center py-16 text-slate-400 text-xs font-semibold gap-2">
                    <History className="w-5 h-5 animate-spin text-[#1A9A91]" />
                    Fetching damage logs...
                  </div>
                ) : !damagesData || damagesData.data.length === 0 ? (
                  <div className="flex justify-center items-center py-16 text-slate-400 text-xs font-semibold">
                    No damage logs recorded.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <table className="w-full text-left text-xs table-auto">
                      <thead>
                        <tr className="text-slate-400 uppercase tracking-widest text-[10px] border-b border-slate-100">
                          <th className="py-3 px-3 font-semibold">Reference Number</th>
                          <th className="py-3 px-3 font-semibold">Date</th>
                          <th className="py-3 px-3 font-semibold">Product</th>
                          <th className="py-3 px-3 font-semibold text-center">Quantity</th>
                          <th className="py-3 px-3 font-semibold">Reason</th>
                          <th className="py-3 px-3 font-semibold text-center">Status</th>
                          <th className="py-3 px-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {damagesData.data.map((d: any) => (
                          <tr key={d.id} className="hover:bg-slate-50/50 border-b border-slate-100/50">
                            <td className="py-3 px-3 font-mono font-bold text-slate-800 uppercase">
                              DAM-{d.id.substring(0, 8).toUpperCase()}
                            </td>
                            <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                              {new Date(d.salesDate).toLocaleDateString('en-IN')}
                            </td>
                            <td className="py-3 px-3 font-bold text-slate-700">
                              {d.productName}
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-slate-800">
                              {d.quantity}
                            </td>
                            <td className="py-3 px-3 text-slate-500 max-w-[150px] truncate" title={d.remarks || ''}>
                              {d.remarks || 'Wastage / Faulty Pack'}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 uppercase">
                                CONFIRMED
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => handleViewTransaction(d)}
                                className="px-2.5 py-1 text-[10px] bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 active:scale-95 transition-all"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Pagination */}
                    {damagesData.totalPages > 1 && (
                      <div className="flex items-center justify-end gap-1.5 pt-4 text-xs">
                        <button
                          onClick={() => setDamagesPage(prev => Math.max(prev - 1, 1))}
                          disabled={damagesPage === 1}
                          className="p-1.5 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg transition-colors disabled:opacity-30"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-slate-400">Page {damagesPage} of {damagesData.totalPages}</span>
                        <button
                          onClick={() => setDamagesPage(prev => Math.min(prev + 1, damagesData.totalPages))}
                          disabled={damagesPage === damagesData.totalPages}
                          className="p-1.5 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg transition-colors disabled:opacity-30"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* TAB 5: ACTIVITY TIMELINE */}
          {activeTab === 'activity' && (
            <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-base font-extrabold text-slate-900">Customer Activity Logs</h2>
              </div>

              {isActivitiesLoading ? (
                <div className="flex justify-center items-center py-16 text-slate-400 text-xs font-semibold gap-2">
                  <History className="w-5 h-5 animate-spin text-[#1A9A91]" />
                  Loading activity logs...
                </div>
              ) : !activities || activities.length === 0 ? (
                <div className="flex justify-center items-center py-16 text-slate-400 text-xs font-semibold">
                  No activities recorded.
                </div>
              ) : (
                <div className="relative pl-6 border-l-2 border-slate-100 space-y-8 ml-3 py-2 text-xs">
                  {activities.map((act: any, idx: number) => (
                    <div key={idx} className="relative group">
                      {/* Timeline dot */}
                      <span className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 bg-white border-2 border-[#1A9A91] rounded-full group-hover:bg-[#1A9A91] transition-all" />
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {act.action.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {new Date(act.date).toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            User: {act.user}
                          </span>
                        </div>
                        <p className="text-slate-500 font-medium leading-relaxed">
                          {act.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {/* 4. DETAILS MODAL WINDOW */}
      {modalType !== null && selectedTx !== null && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] border border-slate-200 max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-700">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-1.5">
                  {modalType === 'sale' ? 'Sale Transaction Details' : modalType === 'return' ? 'Return Details' : 'Damage Entry Details'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Ref: {selectedTx.orderNumber || selectedTx.reference}
                </p>
              </div>
              <button
                onClick={() => { setSelectedTx(null); setModalType(null); setOrderDetails(null); }}
                className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-800 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs font-medium">
              
              {/* SALE MODAL */}
              {modalType === 'sale' && (
                <div className="space-y-4">
                  {isLoadingOrder ? (
                    <div className="flex justify-center items-center py-10 gap-2 text-slate-500">
                      <History className="w-4 h-4 animate-spin text-[#1A9A91]" />
                      Loading invoice items...
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                        <div>
                          <span className="text-slate-400">Invoice Number:</span>
                          <p className="font-mono font-bold text-slate-900 uppercase mt-0.5 text-xs">
                            {selectedTx.orderNumber || selectedTx.reference}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-400">Invoice Date:</span>
                          <p className="font-bold text-slate-900 mt-0.5">
                            {new Date(selectedTx.orderDate || selectedTx.date).toLocaleDateString('en-IN')}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                        <div>
                          <span className="text-slate-400">Customer:</span>
                          <p className="font-bold text-slate-900 mt-0.5">{customer.name}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Business Type:</span>
                          <p className="font-bold text-slate-900 mt-0.5">{customer.customerType || 'B2C'}</p>
                        </div>
                      </div>

                      {/* Items Grid */}
                      <div className="space-y-2">
                        <span className="text-slate-400">Line Items:</span>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl overflow-hidden">
                          <table className="w-full text-left text-[11px]">
                            <thead>
                              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[9px]">
                                <th className="py-2 px-3 font-semibold">Brand</th>
                                <th className="py-2 px-3 font-semibold">Product</th>
                                <th className="py-2 px-3 font-semibold text-center">Qty</th>
                                <th className="py-2 px-3 font-semibold text-right">Rate (₹)</th>
                                <th className="py-2 px-3 font-semibold text-right">Subtotal (₹)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {orderDetails ? (
                                orderDetails.items.map((item: any, idx: number) => (
                                  <tr key={idx} className="text-slate-700">
                                    <td className="py-2 px-3 font-semibold">N/A</td>
                                    <td className="py-2 px-3">Item #{idx+1}</td>
                                    <td className="py-2 px-3 text-center font-bold">{item.quantity}</td>
                                    <td className="py-2 px-3 text-right">₹{parseFloat(item.unitPrice).toFixed(2)}</td>
                                    <td className="py-2 px-3 text-right font-bold">₹{parseFloat(item.totalPrice).toFixed(2)}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr className="text-slate-700">
                                  <td className="py-2 px-3 font-semibold">{selectedTx.brandName || 'N/A'}</td>
                                  <td className="py-2 px-3">{selectedTx.productName || 'N/A'}</td>
                                  <td className="py-2 px-3 text-center font-bold">{selectedTx.quantity || 1}</td>
                                  <td className="py-2 px-3 text-right">₹{parseFloat(selectedTx.unitPrice || '0').toFixed(2)}</td>
                                  <td className="py-2 px-3 text-right font-bold">
                                    ₹{((selectedTx.quantity || 1) * parseFloat(selectedTx.unitPrice || '0')).toFixed(2)}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Calculations breakdown */}
                      <div className="bg-slate-50 p-4 rounded-xl space-y-1.5 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Subtotal:</span>
                          <span className="font-bold text-slate-850">
                            ₹{parseFloat(selectedTx.totalAmount || selectedTx.debit || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Discount:</span>
                          <span className="font-bold text-slate-850">₹0.00</span>
                        </div>
                        <div className="flex justify-between pb-1.5 border-b border-slate-200">
                          <span className="text-slate-400">Tax Amount (GST):</span>
                          <span className="font-bold text-slate-850">
                            ₹{parseFloat(selectedTx.taxAmount || '0').toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between font-black text-slate-900 text-xs pt-1">
                          <span>Grand Total:</span>
                          <span>
                            ₹{parseFloat(selectedTx.totalAmount || selectedTx.debit || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Remarks and creator details */}
                      <div className="space-y-2 text-[11px] text-slate-500">
                        <p><span className="font-bold text-slate-600">Remarks:</span> {selectedTx.remarks || 'No remarks recorded.'}</p>
                        <p>
                          <span className="font-bold text-slate-600">Created By:</span> {selectedTx.creatorName || selectedTx.createdBy || 'System'} | 
                          <span className="font-bold text-slate-600 ml-1">Status:</span> {selectedTx.status || 'DELIVERED'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* RETURN MODAL */}
              {modalType === 'return' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <span className="text-slate-400">Return Number:</span>
                      <p className="font-mono font-bold text-slate-900 uppercase mt-0.5 text-xs">
                        {selectedTx.reference || `RET-${selectedTx.id.substring(0, 8).toUpperCase()}`}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Return Date:</span>
                      <p className="font-bold text-slate-900 mt-0.5">
                        {new Date(selectedTx.date || selectedTx.salesDate).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  </div>

                  <div className="pb-4 border-b border-slate-100">
                    <span className="text-slate-400">Original Invoice:</span>
                    <p className="font-bold text-slate-900 mt-0.5">
                      {selectedTx.remarks && selectedTx.remarks.includes('Inv:') 
                        ? selectedTx.remarks.substring(selectedTx.remarks.indexOf('Inv:')) 
                        : 'Direct Customer Return'}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pb-4 border-b border-slate-100 text-[11px]">
                    <div>
                      <span className="text-slate-400">Product:</span>
                      <p className="font-bold text-slate-850 mt-0.5">{selectedTx.productName}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Returned Quantity:</span>
                      <p className="font-bold text-slate-850 mt-0.5">{selectedTx.quantity} units</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Refund/Credit Amount:</span>
                      <p className="font-bold text-indigo-600 mt-0.5">
                        ₹{(selectedTx.quantity * parseFloat(selectedTx.unitPrice || '0')).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-[11px] text-slate-500">
                    <p><span className="font-bold text-slate-600">Return Reason:</span> {selectedTx.remarks || 'Standard Return'}</p>
                    <p>
                      <span className="font-bold text-slate-600">Processed By:</span> {selectedTx.creatorName || selectedTx.perfName || 'System'} | 
                      <span className="font-bold text-slate-600 ml-1">Status:</span> CONFIRMED
                    </p>
                  </div>
                </div>
              )}

              {/* DAMAGE MODAL */}
              {modalType === 'damage' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <span className="text-slate-400">Damage/Ref Number:</span>
                      <p className="font-mono font-bold text-slate-900 uppercase mt-0.5 text-xs">
                        {selectedTx.reference || `DAM-${selectedTx.id.substring(0, 8).toUpperCase()}`}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Recorded Date:</span>
                      <p className="font-bold text-slate-900 mt-0.5">
                        {new Date(selectedTx.date || selectedTx.salesDate).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100 text-[11px]">
                    <div>
                      <span className="text-slate-400">Product:</span>
                      <p className="font-bold text-slate-850 mt-0.5">{selectedTx.productName}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Quantity Damaged:</span>
                      <p className="font-bold text-slate-850 mt-0.5">{selectedTx.quantity} units</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-[11px] text-slate-500">
                    <p><span className="font-bold text-slate-600">Damage/Wastage Reason:</span> {selectedTx.remarks || 'Faulty packing / Leakage'}</p>
                    <p>
                      <span className="font-bold text-slate-600">Recorded By:</span> {selectedTx.creatorName || selectedTx.perfName || 'N/A'} | 
                      <span className="font-bold text-slate-600 ml-1">Status:</span> CONFIRMED
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => { setSelectedTx(null); setModalType(null); setOrderDetails(null); }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-350 text-slate-700 font-bold rounded-xl active:scale-95 transition-all text-xs border border-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
