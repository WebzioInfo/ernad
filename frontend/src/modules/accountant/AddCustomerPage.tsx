import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Users, Save, X, ArrowLeft, Loader2, AlertCircle, Info, Landmark, MapPin, BadgePercent
} from 'lucide-react';
import { useCustomerById, useCreateCustomer, useUpdateCustomer } from '../../hooks/useApi';
import useAuthStore from '../auth/auth.store';
import { toast } from 'sonner';
import ConfirmationModal from '../../components/common/ConfirmationModal';

interface FormErrors {
  name?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  panNumber?: string;
  openingBalance?: string;
  creditLimit?: string;
}

export default function AddCustomerPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const { user } = useAuthStore();

  // Queries & Mutations
  const { data: existingCustomer, isLoading: isFetching } = useCustomerById(id || '');
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();

  // Form Fields State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [customerType, setCustomerType] = useState<'INDIVIDUAL' | 'BUSINESS'>('BUSINESS');
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [alternativePhone, setAlternativePhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [country, setCountry] = useState('India');
  const [pinCode, setPinCode] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [openingBalanceType, setOpeningBalanceType] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [creditLimit, setCreditLimit] = useState('0');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [notes, setNotes] = useState('');

  // Auxiliary UI States
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Populate data in edit mode
  useEffect(() => {
    if (isEditMode && existingCustomer) {
      setName(existingCustomer.name || '');
      setCode(existingCustomer.code || '');
      setBusinessName(existingCustomer.businessName || '');
      setCustomerType(existingCustomer.customerType || 'BUSINESS');
      setGstNumber(existingCustomer.gstNumber || '');
      setPanNumber(existingCustomer.panNumber || '');
      setPhone(existingCustomer.phone || '');
      setAlternativePhone(existingCustomer.alternativePhone || '');
      setEmail(existingCustomer.email || '');
      setAddress(existingCustomer.address || '');
      setBillingAddress(existingCustomer.billingAddress || '');
      setShippingAddress(existingCustomer.shippingAddress || '');
      setState(existingCustomer.state || '');
      setDistrict(existingCustomer.district || '');
      setCountry(existingCustomer.country || 'India');
      setPinCode(existingCustomer.pinCode || '');
      setOpeningBalance(existingCustomer.openingBalance || '0');
      setOpeningBalanceType(existingCustomer.openingBalanceType || 'DEBIT');
      setCreditLimit(existingCustomer.creditLimit || '0');
      setPaymentTerms(existingCustomer.paymentTerms || '');
      setStatus(existingCustomer.status || 'ACTIVE');
      setNotes(existingCustomer.notes || '');
      setIsDirty(false);
    }
  }, [isEditMode, existingCustomer]);

  // Handle input change & dirty state
  const handleFieldChange = (setter: any, val: any) => {
    setter(val);
    setIsDirty(true);
  };

  // Base path resolution
  const getBasePath = () => {
    const role = String(user?.role || '').toUpperCase();
    if (role === 'MANAGER') return '/manager';
    if (role === 'ACCOUNTANT') return '/accountant';
    return '/admin';
  };

  // Form Client Validations
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!name.trim()) {
      newErrors.name = 'Customer name is required';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Primary phone number is required';
    } else if (!/^\+?[\d\s-]{8,15}$/.test(phone.trim())) {
      newErrors.phone = 'Phone number is invalid (8-15 digits expected)';
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Email address format is invalid';
    }

    if (gstNumber.trim() && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstNumber.trim().toUpperCase())) {
      newErrors.gstNumber = 'GST Number must match Indian format (e.g. 22AAAAA1111A1Z1)';
    }

    if (panNumber.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.trim().toUpperCase())) {
      newErrors.panNumber = 'PAN Number must match Indian format (e.g. ABCDE1234F)';
    }

    if (isNaN(parseFloat(openingBalance))) {
      newErrors.openingBalance = 'Opening balance must be a number';
    }

    if (isNaN(parseFloat(creditLimit))) {
      newErrors.creditLimit = 'Credit limit must be a number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please correct the validation errors before saving');
      return;
    }

    setIsSaving(true);
    const payload = {
      name: name.trim(),
      code: code.trim() || undefined,
      businessName: businessName.trim() || null,
      customerType,
      gstNumber: gstNumber.trim().toUpperCase() || null,
      panNumber: panNumber.trim().toUpperCase() || null,
      phone: phone.trim(),
      alternativePhone: alternativePhone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      billingAddress: billingAddress.trim() || null,
      shippingAddress: shippingAddress.trim() || null,
      state: state.trim() || null,
      district: district.trim() || null,
      country: country.trim() || null,
      pinCode: pinCode.trim() || null,
      openingBalance: openingBalance.trim(),
      openingBalanceType,
      creditLimit: creditLimit.trim(),
      paymentTerms: paymentTerms.trim() || null,
      status,
      notes: notes.trim() || null,
    };

    try {
      if (isEditMode && id) {
        await updateMutation.mutateAsync({ id, payload });
        toast.success('Customer updated successfully');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Customer added successfully');
      }
      setIsDirty(false);
      navigate(`${getBasePath()}/sales/customers`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save customer profiles');
    } finally {
      setIsSaving(false);
    }
  };

  // Back navigation wrapper
  const handleBack = () => {
    if (isDirty) {
      setShowCancelModal(true);
    } else {
      navigate(`${getBasePath()}/sales/customers`);
    }
  };

  if (isEditMode && isFetching) {
    return (
      <div className="flex flex-col justify-center items-center h-screen gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-[#1A9A91]" />
        <span className="font-semibold text-sm">Loading customer record...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto font-sans selection:bg-[#1A9A91]/10">
      {/* Top action header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="p-2.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-xl transition-all active:scale-95 border border-slate-200 bg-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">
              {isEditMode ? 'Modify Customer Profile' : 'Add New Customer'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">Configure invoicing accounts, tax declarations, and shipping addresses.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: General Details */}
        <section className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Info className="w-4 h-4 text-[#1A9A91]" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">General Information</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Customer Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 ml-1">Customer Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleFieldChange(setName, e.target.value)}
                placeholder="Enter customer or brand name"
                className={`w-full bg-slate-50 border ${errors.name ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91]'} text-slate-900 px-4 py-3 rounded-xl focus:ring-2 focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium text-sm`}
              />
              {errors.name && <p className="text-rose-500 text-xs ml-1">{errors.name}</p>}
            </div>

            {/* Business Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 ml-1">Business Name (Trade Name)</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => handleFieldChange(setBusinessName, e.target.value)}
                placeholder="Enter formal registered business name"
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91] focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium text-sm"
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 ml-1">Primary Phone Number *</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => handleFieldChange(setPhone, e.target.value)}
                placeholder="e.g. 9876543210"
                className={`w-full bg-slate-50 border ${errors.phone ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91]'} text-slate-900 px-4 py-3 rounded-xl focus:ring-2 focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium text-sm`}
              />
              {errors.phone && <p className="text-rose-500 text-xs ml-1">{errors.phone}</p>}
            </div>

            {/* Alternative Phone */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 ml-1">Alternative Phone</label>
              <input
                type="text"
                value={alternativePhone}
                onChange={(e) => handleFieldChange(setAlternativePhone, e.target.value)}
                placeholder="Enter secondary contact number"
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91] focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium text-sm"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 ml-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => handleFieldChange(setEmail, e.target.value)}
                placeholder="billing@customer.com"
                className={`w-full bg-slate-50 border ${errors.email ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91]'} text-slate-900 px-4 py-3 rounded-xl focus:ring-2 focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium text-sm`}
              />
              {errors.email && <p className="text-rose-500 text-xs ml-1">{errors.email}</p>}
            </div>

            {/* Custom Code */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 ml-1">Customer Code (Optional)</label>
              <input
                type="text"
                value={code}
                onChange={(e) => handleFieldChange(setCode, e.target.value)}
                placeholder="Leave blank to generate automatically"
                disabled={isEditMode}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91] focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium text-sm disabled:opacity-50"
              />
            </div>

            {/* Customer Type */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 ml-1">Customer Type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 text-sm">
                  <input
                    type="radio"
                    name="customerType"
                    checked={customerType === 'BUSINESS'}
                    onChange={() => handleFieldChange(setCustomerType, 'BUSINESS')}
                    className="accent-[#1A9A91] w-4 h-4"
                  />
                  Business Entity
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 text-sm">
                  <input
                    type="radio"
                    name="customerType"
                    checked={customerType === 'INDIVIDUAL'}
                    onChange={() => handleFieldChange(setCustomerType, 'INDIVIDUAL')}
                    className="accent-[#1A9A91] w-4 h-4"
                  />
                  Individual Account
                </label>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 ml-1">Status</label>
              <select
                value={status}
                onChange={(e) => handleFieldChange(setStatus, e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91] focus:bg-white outline-none font-semibold text-sm"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
        </section>

        {/* SECTION 2: Billing & Shipping Address */}
        <section className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <MapPin className="w-4 h-4 text-[#1A9A91]" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Address Information</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Billing Address */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 ml-1">Billing Address</label>
              <textarea
                rows={3}
                value={billingAddress}
                onChange={(e) => handleFieldChange(setBillingAddress, e.target.value)}
                placeholder="Enter primary billing address details"
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91] focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium text-sm resize-none"
              />
            </div>

            {/* Shipping Address */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 ml-1">Shipping Address</label>
                <button
                  type="button"
                  onClick={() => { setShippingAddress(billingAddress); setIsDirty(true); }}
                  className="text-[10px] font-black text-[#1A9A91] hover:text-[#157C75] uppercase tracking-wider transition-colors"
                >
                  Copy from Billing
                </button>
              </div>
              <textarea
                rows={3}
                value={shippingAddress}
                onChange={(e) => handleFieldChange(setShippingAddress, e.target.value)}
                placeholder="Enter delivery/shipping address details"
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91] focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium text-sm resize-none"
              />
            </div>

            {/* Country */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 ml-1">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => handleFieldChange(setCountry, e.target.value)}
                placeholder="India"
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91] focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium text-sm"
              />
            </div>

            {/* State */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 ml-1">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => handleFieldChange(setState, e.target.value)}
                placeholder="e.g. Kerala"
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91] focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium text-sm"
              />
            </div>

            {/* District */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 ml-1">District</label>
              <input
                type="text"
                value={district}
                onChange={(e) => handleFieldChange(setDistrict, e.target.value)}
                placeholder="e.g. Malappuram"
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91] focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium text-sm"
              />
            </div>

            {/* PIN Code */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 ml-1">PIN Code</label>
              <input
                type="text"
                value={pinCode}
                onChange={(e) => handleFieldChange(setPinCode, e.target.value)}
                placeholder="e.g. 676505"
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91] focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium text-sm"
              />
            </div>
          </div>
        </section>

        {/* SECTION 3: Financials & Tax Identifications */}
        <section className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Landmark className="w-4 h-4 text-[#1A9A91]" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Financials & Taxes</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* GST Number */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 ml-1">GST Number</label>
              <input
                type="text"
                value={gstNumber}
                onChange={(e) => handleFieldChange(setGstNumber, e.target.value)}
                placeholder="e.g. 32ABCDE1234F1Z5"
                className={`w-full bg-slate-50 border ${errors.gstNumber ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91]'} text-slate-900 px-4 py-3 rounded-xl focus:ring-2 focus:bg-white outline-none transition-all placeholder:text-slate-400 font-mono font-bold text-sm`}
              />
              {errors.gstNumber && <p className="text-rose-500 text-xs ml-1">{errors.gstNumber}</p>}
            </div>

            {/* PAN Number */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 ml-1">PAN Number</label>
              <input
                type="text"
                value={panNumber}
                onChange={(e) => handleFieldChange(setPanNumber, e.target.value)}
                placeholder="e.g. ABCDE1234F"
                className={`w-full bg-slate-50 border ${errors.panNumber ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91]'} text-slate-900 px-4 py-3 rounded-xl focus:ring-2 focus:bg-white outline-none transition-all placeholder:text-slate-400 font-mono font-bold text-sm`}
              />
              {errors.panNumber && <p className="text-rose-500 text-xs ml-1">{errors.panNumber}</p>}
            </div>

            {/* Opening Balance */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 ml-1">Opening Balance (₹)</label>
              <input
                type="text"
                value={openingBalance}
                onChange={(e) => handleFieldChange(setOpeningBalance, e.target.value)}
                placeholder="0.00"
                className={`w-full bg-slate-50 border ${errors.openingBalance ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91]'} text-slate-900 px-4 py-3 rounded-xl focus:ring-2 focus:bg-white outline-none transition-all placeholder:text-slate-400 font-bold text-sm`}
              />
              {errors.openingBalance && <p className="text-rose-500 text-xs ml-1">{errors.openingBalance}</p>}
            </div>

            {/* Opening Balance Type */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 ml-1">Opening Balance Type</label>
              <select
                value={openingBalanceType}
                onChange={(e) => handleFieldChange(setOpeningBalanceType, e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91] focus:bg-white outline-none font-semibold text-sm"
              >
                <option value="DEBIT">Debit (Outstanding Receivable)</option>
                <option value="CREDIT">Credit (Advance Payable)</option>
              </select>
            </div>

            {/* Credit Limit */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 ml-1">Credit Limit (₹)</label>
              <input
                type="text"
                value={creditLimit}
                onChange={(e) => handleFieldChange(setCreditLimit, e.target.value)}
                placeholder="0.00"
                className={`w-full bg-slate-50 border ${errors.creditLimit ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91]'} text-slate-900 px-4 py-3 rounded-xl focus:ring-2 focus:bg-white outline-none transition-all placeholder:text-slate-400 font-bold text-sm`}
              />
              {errors.creditLimit && <p className="text-rose-500 text-xs ml-1">{errors.creditLimit}</p>}
            </div>

            {/* Payment Terms */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 ml-1">Payment Terms</label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => handleFieldChange(setPaymentTerms, e.target.value)}
                placeholder="e.g. Net 30, COD, etc."
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91] focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium text-sm"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2 mt-4">
            <label className="text-xs font-bold text-slate-700 ml-1">Administrative Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => handleFieldChange(setNotes, e.target.value)}
              placeholder="Enter special instructions or internal notations"
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded-xl focus:ring-2 focus:ring-[#1A9A91]/20 focus:border-[#1A9A91] focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium text-sm resize-none"
            />
          </div>
        </section>

        {/* Footer save / cancel controllers */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={handleBack}
            className="px-5 py-3 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl border border-slate-200 transition-all active:scale-95 text-sm"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 bg-[#1A9A91] hover:bg-[#157C75] text-white font-bold rounded-xl shadow-md shadow-[#1A9A91]/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 text-sm uppercase tracking-wider"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving Profile
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Customer
              </>
            )}
          </button>
        </div>
      </form>

      {/* Discard changes warning modal */}
      <ConfirmationModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={() => { setShowCancelModal(false); navigate(`${getBasePath()}/sales/customers`); }}
        title="Discard Unsaved Changes?"
        message="You have unsaved changes in this customer profile form. Are you sure you want to discard them and return to the list?"
        confirmText="Discard Changes"
        cancelText="Keep Editing"
      />
    </div>
  );
}
