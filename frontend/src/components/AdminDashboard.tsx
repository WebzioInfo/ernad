import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Users, Activity, LogOut,
  ShieldCheck, User, Zap, PackageOpen,

  TrendingUp, Clock, Loader2, KeyRound, ArrowUpRight,
  X, Upload, Camera, RefreshCw
} from 'lucide-react';








import useAuthStore from '../store/useAuthStore';
import { api } from '../api';
import toast from 'react-hot-toast';
import Watermark from './Watermark';
import { useWebSocket } from '../hooks/useWebSocket';
import NotificationBell from './NotificationBell';
import ProductionLedger from './ProductionLedger';

type ActiveTab = 'dashboard' | 'users' | 'production' | 'analytics' | 'reports' | 'entries';



interface Operator {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  department?: string;
  jobTitle?: string;
  phoneNumber?: string;
  operatorType?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
}

// ─── User Profile (Modern Profile Editor) ──────────────────────────────────
function UserProfileDrawer({
  operator,
  onClose,
  onSuccess,
}: {
  operator: Operator;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: operator.name,
    email: operator.email,
    phoneNumber: operator.phoneNumber || '',
    department: operator.department || '',
    jobTitle: operator.jobTitle || '',
    avatarUrl: operator.avatarUrl || '',
    newCredential: '',
    type: (operator.role === 'OPERATOR' ? 'PIN' : 'PASSWORD') as 'PASSWORD' | 'PIN',
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post(`/users/${operator.id}/avatar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFormData(prev => ({ ...prev, avatarUrl: res.data.avatarUrl }));
      toast.success('Profile picture updated');
      onSuccess();
    } catch (err) {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Update Profile Information
      await api.patch(`/users/${operator.id}`, {
        name: formData.name,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        department: formData.department,
        jobTitle: formData.jobTitle,
      });

      // 2. Update Login Details if provided
      if (formData.newCredential) {
        await api.patch('/auth/reset-credential', {
          userId: operator.id,
          newCredential: formData.newCredential,
          avatarUrl: formData.avatarUrl,
          type: formData.type
        });
      }

      toast.success(`User "${formData.name}" updated`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-end overflow-hidden">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="relative w-[500px] bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        <header className="p-8 border-b border-slate-100 flex justify-between items-center bg-white">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Edit User Profile</h3>
            <p className="text-xs text-slate-500 mt-1">Update user details and access Login Details</p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all text-slate-400 hover:text-slate-900 border border-slate-200">
            <X className="w-6 h-6" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
          {/* Visual Profile Section */}
          <div className="flex items-center gap-8">
            <div className="relative group">
              <div className="w-32 h-32 rounded-[2.5rem] bg-slate-100 border-4 border-white shadow-2xl overflow-hidden ring-1 ring-slate-200 transition-transform group-hover:scale-105 duration-300">
                {formData.avatarUrl ? (
                  <img src={formData.avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300 bg-gradient-to-br from-slate-50 to-slate-200">
                    <User className="w-16 h-16" />
                  </div>
                )}
              </div>
              <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-2.5 rounded-2xl shadow-xl border-4 border-white">
                <User className="w-5 h-5" />
              </div>
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-500 block mb-2">Profile Photo</label>

              <div className="flex gap-3">
                <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl p-6 bg-slate-50 hover:bg-white hover:border-blue-500 transition-all cursor-pointer group">
                  <input type="file" className="hidden" onChange={handleAvatarUpload} accept="image/*" />
                  {uploading ? <Loader2 className="w-6 h-6 animate-spin text-blue-500" /> : <Upload className="w-6 h-6 text-slate-400 group-hover:text-blue-500 mb-2" />}
                  <span className="text-xs font-medium text-slate-500">Upload new image</span>

                </label>
                <button type="button" className="px-6 bg-slate-100 hover:bg-slate-200 rounded-3xl text-slate-400 hover:text-slate-900 transition-all">
                  <Camera className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2 space-y-2">
              <label className="text-xs font-semibold text-slate-600 ml-1">Full Name</label>

              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 ml-1">Username</label>

              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  readOnly
                  value={operator.username}
                  className="w-full pl-11 pr-5 py-4 bg-slate-100 border border-slate-200 rounded-2xl text-slate-400 font-mono text-sm cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 ml-1">Email Address</label>

              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold text-blue-600"

              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 ml-1">Job Title</label>

              <input
                type="text"
                value={formData.jobTitle}
                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                placeholder="Senior Technician"
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 ml-1">Department</label>

              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="Production Line A"
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
              />
            </div>
          </div>

          <div className="bg-slate-900 rounded-[2.5rem] p-8 space-y-6 shadow-2xl shadow-slate-900/40">
            <h4 className="flex items-center gap-2 text-xs font-bold text-blue-400 mb-6">
              <ShieldCheck className="w-5 h-5 text-blue-500" /> Security Settings
            </h4>



            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-blue-400/80   ml-1">Login Type</label>

                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold appearance-none cursor-pointer"
                >
                  <option value="PASSWORD">Password Auth</option>
                  <option value="PIN">Operational PIN</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-blue-400/80   ml-1">Set New Password</label>

                <input
                  type={formData.type === 'PIN' ? 'text' : 'password'}
                  value={formData.newCredential}
                  onChange={(e) => setFormData({ ...formData, newCredential: e.target.value })}
                  placeholder="Set new secret..."
                  className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold placeholder:text-white/20"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500 font-medium">Leave empty to keep the current password/PIN.</p>
          </div>
        </form>

        <div className="p-8 border-t border-slate-100 bg-slate-50 flex gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-8 py-5 border border-slate-200 text-slate-600 font-semibold rounded-2xl hover:bg-white transition-all text-sm"

          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-[2] px-10 py-5 bg-blue-600 text-white font-semibold rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 flex justify-center items-center disabled:opacity-50 text-sm gap-3"

          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <><Zap className="w-5 h-5" /> Save Changes</>

            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create User Drawer ──────────────────────────────────────────────────

function CreateUserDrawer({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    phoneNumber: '',
    department: '',
    jobTitle: '',
    pin: '',
    role: 'OPERATOR',
    operatorType: 'FILLING_OPERATOR',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/users', formData);
      toast.success(`User "${formData.name}" created successfully`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-end overflow-hidden">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="relative w-[500px] bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        <header className="p-8 border-b border-slate-100 flex justify-between items-center bg-white">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Add New Staff</h3>
            <p className="text-xs text-slate-500 mt-1">Register a new system operator or administrator</p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all text-slate-400 hover:text-slate-900 border border-slate-200">
            <X className="w-6 h-6" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 ml-1">Full Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
              placeholder="e.g. John Doe"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 ml-1">Username</label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                placeholder="johndoe"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 ml-1">Email Address</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                placeholder="john@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 ml-1">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
              >
                <option value="OPERATOR">Operator</option>
                <option value="MANAGER">Manager</option>
                <option value="ADMIN">Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 ml-1">Initial PIN / Password</label>
              <input
                type="password"
                required
                value={formData.pin}
                onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                placeholder="••••"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 ml-1">Department</label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                placeholder="Production"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 ml-1">Job Title</label>
              <input
                type="text"
                value={formData.jobTitle}
                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                placeholder="Technician"
              />
            </div>
          </div>
        </form>

        <div className="p-8 border-t border-slate-100 bg-slate-50 flex gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-8 py-5 border border-slate-200 text-slate-600 font-semibold rounded-2xl hover:bg-white transition-all text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-[2] px-10 py-5 bg-blue-600 text-white font-semibold rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 flex justify-center items-center disabled:opacity-50 text-sm gap-3"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <><Zap className="w-5 h-5" /> Create Account</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}




function StaffCard({
  operator,
  onReset,
  onToggle,
  onDelete,
  isToggling,
  currentUser
}: {
  operator: Operator;
  onReset: (op: Operator) => void;
  onToggle: (op: Operator) => void;
  onDelete: (op: Operator) => void;
  isToggling: boolean;
  currentUser: any;
}) {

  return (
    <div className="group bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-all">
      <div className="flex items-center gap-4 mb-6">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-slate-200 overflow-hidden shadow-sm">
            {operator.avatarUrl ? (
              <img src={operator.avatarUrl} alt="User" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <User className="w-8 h-8" />
              </div>
            )}
          </div>
          <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${operator.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-lg leading-tight">{operator.name}</h3>
          <p className="text-slate-500 text-xs mt-1">{operator.email || operator.username}</p>
        </div>
      </div>

      {currentUser?.role === 'SUPER_ADMIN' && (
        <div className="grid grid-cols-2 gap-3 w-full opacity-40 group-hover:opacity-100 transition-all duration-300">
          <button
            onClick={() => onReset(operator)}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-900 text-white font-semibold text-xs hover:bg-blue-600 transition-colors shadow-md"
          >
            <KeyRound className="w-4 h-4" /> Edit User
          </button>

          <button
            onClick={() => onToggle(operator)}
            disabled={isToggling}
            className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-xs transition-all ${operator.isActive
              ? 'bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100'
              : 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100'
              }`}
          >
            {isToggling ? <Loader2 className="w-4 h-4 animate-spin" /> : operator.isActive ? 'Suspend' : 'Reinstate'}
          </button>

          <button
            onClick={() => onDelete(operator)}
            className="col-span-2 mt-2 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white text-rose-500 font-semibold text-xs border border-rose-100 hover:bg-rose-50 transition-all"
          >
            Delete User
          </button>
        </div>
      )}
      {currentUser?.role !== 'SUPER_ADMIN' && (
        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
          <span className="text-xs font-semibold text-slate-400">View Only</span>
        </div>
      )}
    </div>

  );
}



export default function AdminDashboard() {
  useWebSocket(); // Activate real-time updates

  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [resetTarget, setResetTarget] = useState<Operator | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLineModalOpen, setIsLineModalOpen] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { data: lines = [] } = useQuery({
    queryKey: ['lines'],
    queryFn: async () => {
      const res = await api.get('/master-data/lines');
      return res.data;
    },
    enabled: activeTab === 'dashboard',
    refetchInterval: 5000,
  });

  const { data: usersList = [], isLoading: loadingUsers, refetch: fetchUsers } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data;
    },
    enabled: activeTab === 'users',
  });

  const { data: aiStats } = useQuery({
    queryKey: ['aiStats'],
    queryFn: async () => {
      const activeLine = lines.find((l: any) => l.status === 'RUNNING');
      if (!activeLine) return null;

      const batchRes = await api.get(`/production-batch/active/${activeLine.id}`);
      const batchId = batchRes.data?.id;
      if (!batchId) return null;

      const [anoRes, predRes] = await Promise.all([
        api.get(`/analytics/filling-anomalies?batchId=${batchId}`),
        api.get(`/analytics/predictive-insights?batchId=${batchId}`)
      ]);
      return { anomalies: anoRes.data, predictions: predRes.data };
    },
    enabled: activeTab === 'dashboard' && lines.length > 0,
    refetchInterval: 10000,
  });

  const anomalies = aiStats?.anomalies || null;
  const predictions = aiStats?.predictions || null;

  const handleToggleActive = async (op: Operator) => {
    setTogglingId(op.id);
    try {
      const res = await api.patch(`/users/${op.id}/toggle-active`);
      toast.success(res.data.message);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to toggle status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteUser = async (op: Operator) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${op.name}"? This action cannot be undone.`)) return;

    try {
      await api.delete(`/users/${op.id}`);
      toast.success(`User "${op.name}" deleted`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };



  const navItems = [
    { key: 'dashboard' as ActiveTab, name: 'Dashboard', icon: LayoutDashboard },
    { key: 'users' as ActiveTab, name: 'User Management', icon: Users },
    ...(currentUser?.role === 'SUPER_ADMIN' ? [
      { key: 'production' as ActiveTab, name: 'Production', icon: Zap },
      { key: 'analytics' as ActiveTab, name: 'Analytics', icon: Activity },
      { key: 'reports' as ActiveTab, name: 'Reports', icon: TrendingUp },
      { key: 'entries' as ActiveTab, name: 'Data Entries', icon: PackageOpen },
    ] : []),

  ];


  return (
    <div className="flex h-screen bg-white text-slate-900 font-sans relative">
      <Watermark />
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col z-20 flex-shrink-0">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                Admin Panel
              </h2>
              <p className="text-xs text-slate-500 font-semibold  ">System Management</p>

            </div>
          </div>
        </div>

        <nav className="flex-1 py-6">
          <ul className="space-y-1.5 px-4">
            {navItems.map((item) => (
              <li key={item.name}>
                <button
                  onClick={() => setActiveTab(item.key!)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all duration-300 ${activeTab === item.key
                    ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/30 scale-[1.02]'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                >
                  <item.icon className={`w-4.5 h-4.5 ${activeTab === item.key ? 'text-white' : 'text-slate-400'}`} />
                  <span className="text-sm tracking-tight">{item.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-6 border-t border-slate-100">
          {currentUser && (
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="User" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <User className="w-5 h-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-slate-900 text-sm font-semibold truncate">{currentUser?.name?.split(' ')[0] || 'User'}</p>
                <p className="text-slate-500 text-xs truncate">{currentUser.role}</p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center space-x-3 px-4 py-2 w-full text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all text-xs font-black uppercase tracking-widest"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-5 flex justify-between items-center z-30 sticky top-0">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-8 bg-blue-600 rounded-full" />
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {activeTab === 'dashboard' && 'System Overview'}
                {activeTab === 'users' && 'Personnel Directory'}
                {activeTab === 'production' && 'Line Controls'}
                {activeTab === 'analytics' && 'Intelligent Insights'}
                {activeTab === 'reports' && 'Business Intelligence'}
                {activeTab === 'entries' && 'Terminal Access'}
              </h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                {activeTab === 'dashboard' ? 'Real-time performance metrics' : 'Administrative control center'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 shadow-inner">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">
                {currentUser?.role === 'SUPER_ADMIN' ? 'Elevated Access' : 'Standard View'}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <NotificationBell />
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-slate-900">System Dashboard</h2>
                <p className="text-slate-500 text-sm mt-1">{lines.length} Production Lines Active</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-blue-500/5 transition-all duration-500 group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
                  <Activity className="w-24 h-24 text-blue-600" />
                </div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                    <Activity className="w-6 h-6" />
                  </div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Efficiency</h3>
                </div>
                <div className="text-4xl font-black text-slate-900 tracking-tight italic">98.4%</div>
                <div className="mt-3 flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                  <span className="text-[11px] text-emerald-600 font-black uppercase">Optimal performance</span>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-amber-500/5 transition-all duration-500 group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
                  <Zap className="w-24 h-24 text-amber-600" />
                </div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl group-hover:bg-amber-600 group-hover:text-white transition-colors duration-300">
                    <Zap className="w-6 h-6" />
                  </div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Batches</h3>
                </div>
                <div className="text-4xl font-black text-slate-900 tracking-tight italic">{lines.filter((l: any) => l.status === 'RUNNING').length}</div>
                <div className="mt-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-[11px] text-slate-500 font-black uppercase">Running across lines</span>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-500 group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
                  <Clock className="w-24 h-24 text-indigo-600" />
                </div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">System Uptime</h3>
                </div>
                <div className="text-4xl font-black text-slate-900 tracking-tight italic">24/7</div>
                <div className="mt-3 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span className="text-[11px] text-emerald-600 font-black uppercase">High Availability</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 mb-16">
              <div className="xl:col-span-2 bg-slate-50 rounded-[3rem] p-10 text-slate-800 shadow-xl shadow-slate-200/50 relative overflow-hidden group border border-slate-100">
                <div className="absolute -bottom-10 -right-10 p-12 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000 group-hover:rotate-12">
                  <Activity className="w-64 h-64 text-slate-900" />
                </div>

                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/30">
                      <Zap className="w-6 h-6 text-yellow-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm   text-slate-900">AI Status Monitor</h3>
                      <p className="text-xs text-blue-600 font-bold   mt-1">Analyzing Data Flow</p>

                    </div>
                  </div>
                  <h4 className="text-2xl font-bold text-slate-800 mb-4 max-w-md tracking-tight">

                    {anomalies && anomalies.anomalyCount > 0
                      ? `Attention Required: ${anomalies.anomalyCount} anomalies detected in flow rates.`
                      : "Optimal production cadence detected across all stations."}
                  </h4>
                  <div className="flex items-center gap-4 mt-8">
                    <div className="px-5 py-2 bg-blue-50 rounded-full border border-blue-100 flex items-baseline gap-2">
                      <span className="text-xl font-bold tracking-tight text-blue-600">{((predictions?.confidenceScore || 0) * 100).toFixed(0)}%</span>
                      <span className="text-[10px] font-bold text-slate-400  ">Confidence</span>

                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/20 flex flex-col justify-between group hover:border-blue-500/20 transition-all">
                <div>
                  <div className="flex items-center gap-3 mb-12">
                    <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 border border-emerald-100 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-400  ">Average Efficiency</h3>

                  </div>
                  <div className="text-5xl font-bold text-slate-800 tracking-tight">98.4<span className="text-lg ml-1">%</span></div>

                </div>
                <p className="text-xs text-emerald-500 font-bold   mt-8 flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5" /> Normal Operation

                </p>
              </div>

              <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/20 flex flex-col justify-between group hover:border-blue-500/20 transition-all">
                <div>
                  <div className="flex items-center gap-3 mb-12">
                    <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 border border-indigo-100 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                      <Clock className="w-6 h-6" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-400  ">Estimated End Time</h3>

                  </div>
                  <div className="text-5xl font-bold text-slate-800 tracking-tight">

                    {predictions && predictions.estimatedCompletionTime
                      ? new Date(predictions.estimatedCompletionTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '18:15'}
                  </div>
                  <p className="text-xs text-slate-400 font-bold mt-8 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-blue-500" /> Auto Updating
                  </p>
                </div>
              </div>


            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(lines || []).map((line: any) => (
                <div
                  key={line.id}
                  className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-all"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${line.status === 'RUNNING' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <Activity className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{line.name}</h3>
                        <p className="text-slate-500 text-xs">ID: {line.id.slice(0, 8).toUpperCase()}</p>
                      </div>
                    </div>
                    <StatusBadge status={line.status} />
                  </div>

                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Efficiency</span>
                      <span className="font-bold text-slate-900">{line.currentEfficiency ?? 0}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-1000 ${line.status === 'RUNNING' ? 'bg-blue-600' : 'bg-slate-300'}`}
                        style={{ width: `${line.currentEfficiency ?? 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-50">
                    <button className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-all flex items-center gap-1">
                      View Details <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}



        {/* Users Tab */}

        {activeTab === 'users' && (
          <div className="flex-1 overflow-y-auto p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-slate-900">User Management</h2>
                <p className="text-slate-500 text-sm mt-1">{usersList.length} Staff Records</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search users..."
                    className="w-64 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none pr-10"
                  />
                  <Users className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
                <button
                  onClick={() => fetchUsers()}
                  className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600"
                >
                  <Loader2 className={`w-5 h-5 ${loadingUsers ? 'animate-spin' : ''}`} />
                </button>
                {currentUser?.role === 'SUPER_ADMIN' && (
                  <button
                    onClick={() => setIsCreateOpen(true)}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2"
                  >
                    <User className="w-4 h-4" /> Add New Staff
                  </button>
                )}


              </div>

            </div>


            {loadingUsers && usersList.length === 0 ? (
              <div className="flex items-center justify-center py-40">
                <div className="flex flex-col items-center">
                  <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-6" />
                  <p className="text-slate-400 font-semibold   text-xs">Loading Staff Records...</p>

                </div>
              </div>
            ) : usersList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-40 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                <Users className="w-20 h-20 mb-6 text-slate-200" />
                <h3 className="text-2xl font-bold text-slate-300 tracking-tight">No Users Found</h3>
                <p className="text-slate-400 mt-2 font-semibold   text-xs">The user list is currently empty.</p>

              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
                {usersList.map((op: any) => (
                  <StaffCard
                    key={op.id}
                    operator={op}
                    onReset={setResetTarget}
                    onToggle={handleToggleActive}
                    onDelete={handleDeleteUser}
                    isToggling={togglingId === op.id}
                    currentUser={currentUser}
                  />


                ))}
              </div>
            )}
          </div>
        )}

        {/* Production Tab */}
        {activeTab === 'production' && (
          <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
            <div className="bg-white rounded-[2.5rem] p-12 border border-slate-200 shadow-xl flex flex-col items-center text-center max-w-4xl mx-auto mt-12">
              <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 mb-8 border border-blue-100">
                <Zap className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">Production Batch Control</h2>
              <p className="text-slate-500 max-w-md mb-12">Monitor and manage active production cycles, initiate material changeovers, and regulate line throughput in real-time.</p>

              <div className="grid grid-cols-2 gap-6 w-full text-left">
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-blue-500/20 transition-all cursor-pointer">
                  <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-600" /> Start New Batch
                  </h4>
                  <p className="text-xs text-slate-500">Configure parameters for a new production run on active lines.</p>
                </div>
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-amber-500/20 transition-all cursor-pointer">
                  <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-amber-600" /> Changeover Mode
                  </h4>
                  <p className="text-xs text-slate-500">Prepare stations for product switching and material updates.</p>
                </div>
                {currentUser?.role === 'SUPER_ADMIN' && (
                  <div
                    onClick={() => setIsLineModalOpen(true)}
                    className="p-6 rounded-2xl bg-slate-900 border border-slate-800 group hover:bg-slate-800 transition-all cursor-pointer col-span-2 mt-4"
                  >
                    <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-400" /> Add New Production Line
                    </h4>
                    <p className="text-xs text-slate-400">Expand factory capacity by initializing a new production line (e.g. Line 3).</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}


        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
              <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
                  <Zap className="w-40 h-40" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">Anomaly Detection</h3>
                <p className="text-slate-500 text-sm mb-10 leading-relaxed">Our AI models are scanning production data for deviations in flow, weight, and sealing integrity. Currently monitoring 32 sensor streams.</p>
                <button className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-blue-600 transition-all">Download Log Data</button>
              </div>

              <div className="bg-slate-900 p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                <div className="absolute bottom-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-700">
                  <TrendingUp className="w-40 h-40 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Predictive Insights</h3>
                <p className="text-slate-400 text-sm mb-10 leading-relaxed">Forecasted completion for current batch: <span className="text-blue-400 font-bold">18:15 (On Schedule)</span>. Recommended maintenance for Line B in 48 hours.</p>
                <button className="px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 transition-all">View Full Report</button>
              </div>
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden max-w-5xl mx-auto">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-xl text-slate-900">Historical Shift Reports</h3>
                <button className="text-xs font-bold text-blue-600 hover:underline">Export as PDF</button>
              </div>
              <div className="p-0">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="px-8 py-6 border-b border-slate-50 flex items-center justify-between hover:bg-slate-50 transition-all">
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                        <Clock className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">Night Shift {i} - Apr 22, 2026</p>
                        <p className="text-xs text-slate-500">Duration: 8.5 Hours | Supervisor: Admin {i}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">4,200 Units</p>
                      <p className="text-[10px] font-bold text-emerald-500">98.2% Efficiency</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Data Entry Tab */}
        {activeTab === 'entries' && (
          <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-4 mb-10">
                <div className="p-3 bg-blue-600 rounded-2xl">
                  <PackageOpen className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight italic uppercase">System Ledger</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Manual Production Entry & Historical Sync</p>
                </div>
              </div>

              <ProductionLedger />
            </div>
          </div>
        )}



        <footer className="px-12 py-6 border-t border-slate-100 flex justify-between items-center bg-white mt-auto">
          <div className="flex items-center gap-6">
            <span className="text-xs font-semibold text-slate-400  ">System Saved</span>

          </div>
          <div className="text-right">
            <p className="text-[10px] font-medium text-slate-300 mb-1">A Webzio International Product & Service</p>
            <p className="text-xs font-semibold text-slate-400">Built by Webzio Technology</p>


          </div>
        </footer>
      </main>


      {/* ── User Profile Edit ── */}
      {resetTarget && (
        <UserProfileDrawer
          operator={resetTarget}
          onClose={() => setResetTarget(null)}
          onSuccess={() => fetchUsers()}
        />
      )}

      {/* ── Create User ── */}
      {isCreateOpen && (
        <CreateUserDrawer
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => fetchUsers()}
        />
      )}

      {isLineModalOpen && (
        <CreateLineModal
          onClose={() => setIsLineModalOpen(false)}
          onSuccess={() => {
            window.location.reload();
          }}
        />
      )}
    </div>

  );
}

// ─── Status Badge ────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    RUNNING: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    CHANGEOVER: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    MAINTENANCE: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    IDLE: 'bg-slate-100 text-slate-400 border-slate-200',
  };
  return (
    <div className={`px-4 py-1.5 rounded-full border text-xs font-semibold   flex items-center gap-2 shadow-sm ${styles[status] || styles.IDLE}`}>

      {status === 'RUNNING' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />}
      {status}
    </div>

  );
}

// ─── Create Line Modal ──────────────────────────────────────────────────
function CreateLineModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/master-data/lines', formData);
      toast.success(`Line "${formData.name}" created successfully`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create line');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-900">Add Production Line</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500">Line Name</label>
            <input
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              placeholder="e.g. Line 3"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500">Description</label>
            <input
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              placeholder="Brief description..."
            />
          </div>
          <button disabled={loading} className="w-full py-5 bg-blue-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 text-xs">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Zap className="w-4 h-4" /> Initialize Line</>}
          </button>
        </form>
      </div>
    </div>
  );
}

