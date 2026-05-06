import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import {
  Users, UserPlus, Search,
  Trash2, Edit2, UserCheck,
  Mail, 
  Lock, Unlock, BadgeCheck,
  ShieldCheck, ShieldAlert, UserCog,
  Filter, XCircle, Activity
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmationModal from '../../components/common/ConfirmationModal';

interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  roles: string[]; 
  assignedLines?: string[]; // Added: Multi-line assignment
  department?: string;
  jobTitle?: string;
  phoneNumber?: string;
  isActive: boolean;
  avatarUrl?: string;
}

export default function UserManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/users')).data
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/toggle-active`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User status updated');
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || error.message;
      toast.error(`Status update failed: ${Array.isArray(msg) ? msg[0] : msg}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteConfirmation({ isOpen: false, userId: '', userName: '' });
      toast.success('User deleted successfully');
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || error.message;
      toast.error(`Deletion failed: ${Array.isArray(msg) ? msg[0] : msg}`);
    }
  });

  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; userId: string; userName: string }>({
    isOpen: false,
    userId: '',
    userName: ''
  });

  const departments = Array.from(new Set(users?.map(u => u.department).filter(Boolean))) as string[];

  const filteredUsers = users?.filter(u => {
    const matchesSearch = !searchTerm || 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.roles.some(r => r.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesRole = roleFilter === 'ALL' || u.roles.includes(roleFilter);
    const matchesDept = deptFilter === 'ALL' || u.department === deptFilter;
    const matchesStatus = statusFilter === 'ALL' || 
      (statusFilter === 'ACTIVE' ? u.isActive : !u.isActive);

    return matchesSearch && matchesRole && matchesDept && matchesStatus;
  });

  const clearFilters = () => {
    setSearchTerm('');
    setRoleFilter('ALL');
    setDeptFilter('ALL');
    setStatusFilter('ALL');
  };

  if (isLoading) return <div className="p-20 text-center text-slate-400 animate-pulse font-bold">Loading users...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        title="Block User"
        message={`Are you sure you want to block ${deleteConfirmation.userName}?`}
        confirmText="Block User"
        onClose={() => setDeleteConfirmation({ ...deleteConfirmation, isOpen: false })}
        onConfirm={() => deleteMutation.mutate(deleteConfirmation.userId)}
      />
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 glass p-10 rounded-[3.5rem] relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-indigo-500/10 transition-colors duration-700" />
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <UserCog className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">
              Users
            </h2>
          </div>
          <p className="text-slate-500 font-medium text-lg ml-1">Manage users and their permissions.</p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
          <div className="relative group/search">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within/search:text-indigo-500 transition-all duration-300" />
            <input
              type="text"
              placeholder="Search users..."
              className="bg-white/50 border border-slate-100 rounded-[2rem] pl-14 pr-8 py-4 text-sm font-bold text-slate-700 w-full md:w-80 focus:ring-4 focus:ring-indigo-50 focus:bg-white transition-all duration-300 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-slate-900 hover:bg-indigo-600 text-white px-8 py-4 rounded-[2rem] font-black flex items-center gap-3 shadow-xl shadow-slate-200 hover:shadow-indigo-200 transition-all duration-300 active:scale-95 whitespace-nowrap uppercase tracking-widest text-xs"
          >
            <UserPlus className="w-5 h-5" />
            Add User
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="glass p-5 rounded-[2.5rem] flex flex-wrap items-center gap-4 animate-in slide-in-from-top-4 duration-500">
        <div className="flex items-center gap-3 text-slate-400 px-4 py-2 bg-slate-50/50 rounded-2xl border border-slate-100">
          <Filter className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Filters</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {[
            { value: roleFilter, setter: setRoleFilter, options: [{ slug: 'ALL', label: 'All Roles' }, ...AVAILABLE_ROLES.map(r => ({ slug: r.slug, label: r.label }))] },
            { value: deptFilter, setter: setDeptFilter, options: [{ slug: 'ALL', label: 'All Departments' }, ...departments.map(d => ({ slug: d, label: d }))] },
            { value: statusFilter, setter: setStatusFilter, options: [{ slug: 'ALL', label: 'All Status' }, { slug: 'ACTIVE', label: 'Active' }, { slug: 'SUSPENDED', label: 'Blocked' }] }
          ].map((filter, i) => (
            <select 
              key={i}
              className="bg-white border border-slate-100 rounded-2xl px-5 py-3 text-xs font-black text-slate-600 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 outline-none cursor-pointer transition-all hover:bg-slate-50"
              value={filter.value}
              onChange={(e) => filter.setter(e.target.value)}
            >
              {filter.options.map(opt => (
                <option key={opt.slug} value={opt.slug}>{opt.label}</option>
              ))}
            </select>
          ))}
        </div>

        {(searchTerm || roleFilter !== 'ALL' || deptFilter !== 'ALL' || statusFilter !== 'ALL') && (
          <button 
            onClick={clearFilters}
            className="flex items-center gap-2 px-6 py-3 text-rose-500 hover:bg-rose-50 rounded-2xl text-[10px] font-black transition-all ml-auto uppercase tracking-widest border border-transparent hover:border-rose-100"
          >
            <XCircle className="w-4 h-4" />
            Reset
          </button>
        )}
      </div>

      {/* User Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        {filteredUsers?.map((user) => (
          <UserCard
            key={user.id}
            user={user}
            onOpen={() => setViewingUser(user)}
          />
        ))}
      </div>

      {viewingUser && (
        <UserDetailModal
          user={viewingUser}
          onClose={() => setViewingUser(null)}
          onEdit={() => {
            setEditingUser(viewingUser);
            setViewingUser(null);
          }}
          onToggleActive={() => {
            toggleActiveMutation.mutate(viewingUser.id);
            setViewingUser(null);
          }}
          onDelete={() => {
            setDeleteConfirmation({ isOpen: true, userId: viewingUser.id, userName: viewingUser.name });
            setViewingUser(null);
          }}
        />
      )}

      {(isAddModalOpen || editingUser) && (
        <UserFormModal 
          user={editingUser || undefined} 
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingUser(null);
          }} 
        />
      )}
    </div>
  );
}

function UserCard({ user, onOpen }: { user: User, onOpen: () => void }) {
  const getRoleStyle = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return { icon: <ShieldCheck />, color: 'from-purple-500 to-indigo-600', bg: 'bg-purple-50 text-purple-700' };
      case 'ADMIN': return { icon: <ShieldCheck />, color: 'from-indigo-500 to-blue-600', bg: 'bg-indigo-50 text-indigo-700' };
      case 'MANAGER': return { icon: <ShieldAlert />, color: 'from-amber-500 to-orange-600', bg: 'bg-amber-50 text-amber-700' };
      default: return { icon: <UserCheck />, color: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50 text-emerald-700' };
    }
  };

  return (
    <div 
      onClick={onOpen}
      className="glass rounded-[3rem] p-8 hover:shadow-2xl hover:shadow-indigo-100/50 hover:-translate-y-2 cursor-pointer transition-all duration-500 group relative overflow-hidden flex flex-col h-full"
    >
      {/* Background Accent */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${getRoleStyle(user.roles[0]).color} opacity-[0.03] rounded-full translate-x-10 -translate-y-10 group-hover:opacity-[0.07] transition-opacity duration-700`} />
      
      <div className="flex items-start justify-between mb-8 relative z-10">
        <div className="flex items-center gap-6">
          <div className="relative group/avatar">
            <div className={`absolute inset-0 bg-gradient-to-br ${getRoleStyle(user.roles[0]).color} rounded-[2rem] blur-xl opacity-20 group-hover/avatar:opacity-40 transition-opacity duration-500`} />
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-20 h-20 rounded-[2rem] object-cover relative z-10 border-4 border-white shadow-2xl" />
            ) : (
              <div className="w-20 h-20 rounded-[2rem] bg-white flex items-center justify-center text-slate-200 relative z-10 border-4 border-white shadow-2xl">
                <Users className="w-10 h-10" />
              </div>
            )}
            <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-4 border-white flex items-center justify-center relative z-20 shadow-lg ${user.isActive ? 'bg-emerald-500 animate-pulse-soft' : 'bg-slate-300'}`}>
              {user.isActive ? <Unlock className="w-3 h-3 text-white" /> : <Lock className="w-3 h-3 text-white" />}
            </div>
          </div>
          
          <div>
            <h4 className="font-black text-slate-900 tracking-tight text-xl leading-tight mb-2 group-hover:text-indigo-600 transition-colors">
              {user.name}
            </h4>
            <div className="flex flex-wrap gap-2">
              {user.roles?.map(role => {
                const style = getRoleStyle(role);
                return (
                  <div key={role} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.1em] border border-white/50 shadow-sm ${style.bg}`}>
                    {role.replace('_', ' ')}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5 mb-10 flex-grow relative z-10">
        <div className="flex items-center gap-4 group/item">
          <div className="w-10 h-10 glass rounded-xl flex items-center justify-center text-slate-400 group-hover/item:text-indigo-500 group-hover/item:bg-white transition-all duration-300">
            <Mail className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Contact Info</span>
            <span className="text-sm font-bold text-slate-600 truncate max-w-[200px]">{user.email}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4 group/item">
          <div className="w-10 h-10 glass rounded-xl flex items-center justify-center text-slate-400 group-hover/item:text-indigo-500 group-hover/item:bg-white transition-all duration-300">
            <BadgeCheck className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Department</span>
            <span className="text-sm font-bold text-slate-600">{user.department || 'General Operations'}</span>
          </div>
        </div>

        {user.assignedLines && user.assignedLines.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-[2px] w-4 bg-indigo-100" />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Line Allocation</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {user.assignedLines.map(lineId => (
                <div key={lineId} className="px-3 py-1 bg-white border border-slate-100 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm hover:border-indigo-200 transition-colors">
                  Line {lineId.slice(-4)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="pt-6 border-t border-slate-100/50 flex items-center justify-between mt-auto relative z-10">
        <span className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl ${user.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {user.isActive ? 'Active Member' : 'System Blocked'}
        </span>
        <div className="flex items-center gap-2 text-indigo-600 text-[10px] font-black uppercase tracking-widest group-hover:translate-x-2 transition-transform">
          Manage <BadgeCheck className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

function UserDetailModal({ user, onClose, onEdit, onToggleActive, onDelete }: { user: User, onClose: () => void, onEdit: () => void, onToggleActive: () => void, onDelete: () => void }) {
  const { data: logs } = useQuery({
    queryKey: ['user-audit-logs', user.id],
    queryFn: async () => (await api.get(`/users/${user.id}/audit-logs`)).data
  });

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-500">
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="p-12 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-slate-50 to-transparent" />
            <button onClick={onClose} className="absolute top-8 right-8 p-3 hover:bg-slate-100 rounded-2xl text-slate-400 transition-all z-10">
               <X className="w-6 h-6" />
            </button>

            <div className="relative z-10 flex flex-col items-center">
               <div className="relative mb-6">
                 <div className="w-32 h-32 rounded-[2.5rem] bg-white shadow-2xl overflow-hidden border-4 border-white">
                   {user.avatarUrl ? (
                     <img src={user.avatarUrl} className="w-full h-full object-cover" alt="Avatar" />
                   ) : (
                     <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-200">
                       <Users className="w-16 h-16" />
                     </div>
                   )}
                 </div>
                 <div className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl border-4 border-white shadow-lg flex items-center justify-center ${user.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                    {user.isActive ? <Unlock className="w-4 h-4 text-white" /> : <Lock className="w-4 h-4 text-white" />}
                 </div>
               </div>

               <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-2">{user.name}</h3>
               <p className="text-slate-500 font-bold mb-8">@{user.username} • {user.jobTitle || 'System User'}</p>

               <div className="grid grid-cols-2 gap-4 w-full mb-10">
                  <div className="p-6 bg-slate-50 rounded-3xl text-left border border-slate-100">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Department</p>
                     <p className="text-sm font-black text-slate-700">{user.department || 'Not Assigned'}</p>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-3xl text-left border border-slate-100">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Access Roles</p>
                     <div className="flex flex-wrap gap-1">
                       {user.roles.map(r => <span key={r} className="text-[9px] font-black text-indigo-600">{r}</span>)}
                     </div>
                  </div>
               </div>

               {/* Activity Timeline */}
               <div className="w-full text-left mb-10">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2 px-2">
                   <Activity className="w-3 h-3 text-indigo-500" />
                   Recent Activity Timeline
                 </h4>
                 <div className="space-y-4">
                    {logs?.length > 0 ? logs.map((log: any, idx: number) => (
                      <div key={log.id} className="flex gap-4 group/log">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                          {idx !== logs.length - 1 && <div className="w-[1px] h-full bg-slate-100 my-1" />}
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="text-xs font-bold text-slate-700 group-hover/log:text-indigo-600 transition-colors">{log.action.split(' /')[0].replace('POST', 'Created').replace('PATCH', 'Updated').replace('GET', 'Accessed') || 'Performed System Action'}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{new Date(log.occurredAt).toLocaleString()}</p>
                        </div>
                      </div>
                    )) : (
                      <div className="p-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">
                        No activity recorded
                      </div>
                    )}
                 </div>
               </div>

               <div className="flex flex-wrap gap-4 w-full mb-8">
                  <button 
                    onClick={onToggleActive}
                    className={`flex-1 py-5 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 border-2 ${
                     user.isActive 
                       ? 'bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white hover:border-rose-600' 
                       : 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-600 hover:text-white hover:border-emerald-600'
                    }`}
                  >
                    {user.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    {user.isActive ? 'Suspend User' : 'Restore User'}
                  </button>
                  <button onClick={onEdit} className="flex-1 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-2">
                     <Edit2 className="w-4 h-4" /> Modify Profile
                  </button>
               </div>

               {/* Danger Zone */}
               <div className="w-full pt-8 border-t border-slate-100">
                 <div className="flex items-center justify-between bg-rose-50/50 p-6 rounded-3xl border border-rose-100/50 group/danger">
                   <div className="text-left">
                     <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Danger Zone</p>
                     <p className="text-[11px] font-bold text-slate-500">Permanently remove this user and all associated data.</p>
                   </div>
                   <button 
                     onClick={onDelete}
                     className="bg-white hover:bg-rose-600 text-rose-600 hover:text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border border-rose-100 flex items-center gap-2"
                   >
                     <Trash2 className="w-4 h-4" />
                     Delete Account
                   </button>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const AVAILABLE_ROLES = [
  { slug: 'SUPER_ADMIN', label: 'Super Admin', color: 'purple' },
  { slug: 'ADMIN', label: 'Administrator', color: 'indigo' },
  { slug: 'MANAGER', label: 'Plant Manager', color: 'amber' },
  { slug: 'OPERATOR', label: 'General Operator', color: 'emerald' },
  { slug: 'OPERATOR_BLOWING', label: 'Blowing Op.', color: 'emerald' },
  { slug: 'OPERATOR_FILLING', label: 'Filling Op.', color: 'emerald' },
  { slug: 'OPERATOR_LABELING', label: 'Labeling Op.', color: 'emerald' },
  { slug: 'OPERATOR_PACKING', label: 'Packing Op.', color: 'emerald' },
];



function UserFormModal({ user, onClose }: { user?: User, onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    username: user?.username || '',
    email: user?.email || '',
    roles: user?.roles || ['OPERATOR'],
    assignedLines: user?.assignedLines || [],
    department: user?.department || '',
    jobTitle: user?.jobTitle || '',
    phoneNumber: user?.phoneNumber || '',
    pin: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: lines } = useQuery({
    queryKey: ['production-lines'],
    queryFn: async () => (await api.get('/master-data/lines')).data
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('--- SAVING USER DATA ---', data);
      const isEdit = !!user;
      const res = isEdit
        ? await api.patch(`/users/${user.id}`, data)
        : await api.post('/users', data);

      const savedUser = res.data;

      if (selectedFile) {
        const fileData = new FormData();
        fileData.append('file', selectedFile);
        await api.post(`/users/${savedUser.id}/avatar`, fileData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      return savedUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(user ? 'User updated' : 'User added');
      onClose();
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg || 'Operation failed'));
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...formData };
    if (!data.pin) delete (data as any).pin;
    
    // Sanitize roles
    if (data.roles && Array.isArray(data.roles)) {
      data.roles = Array.from(new Set(data.roles.map(r => String(r).trim().toUpperCase())));
    }

    mutation.mutate(data);
  };

  const toggleRole = (roleSlug: string) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(roleSlug)
        ? prev.roles.filter(r => r !== roleSlug)
        : [...prev.roles, roleSlug]
    }));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-500">
        <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">
              {user ? 'Edit User' : 'Add User'}
            </h3>
            <p className="text-slate-500 font-medium mt-1">Configure identity, roles, and access credentials.</p>
          </div>
          <button onClick={onClose} className="p-3 bg-white text-slate-400 hover:text-slate-600 rounded-2xl shadow-sm transition-all hover:rotate-90">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar no-scrollbar">
          <div className="flex flex-col items-center gap-6 p-8 bg-indigo-50/30 rounded-[2.5rem] border-2 border-dashed border-indigo-100 group transition-all hover:border-indigo-300">
            <div className="relative">
              <div className="w-40 h-40 rounded-[2.5rem] bg-white shadow-2xl overflow-hidden border-4 border-white flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                {previewUrl || user?.avatarUrl ? (
                  <img src={previewUrl || user?.avatarUrl} className="w-full h-full object-cover" alt="Avatar" />
                ) : (
                  <div className="flex flex-col items-center text-indigo-300">
                    <Users className="w-12 h-12 mb-2" />
                    <span className="text-xs font-black uppercase tracking-tighter">Photo</span>
                  </div>
                )}
              </div>
              <label className="absolute -bottom-4 -right-4 bg-indigo-600 text-white p-4 rounded-2xl shadow-xl cursor-pointer hover:bg-indigo-700 hover:scale-110 transition-all active:scale-95">
                <BadgeCheck className="w-6 h-6" />
                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
              <input required className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-50 transition-all" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username</label>
              <input required className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-50 transition-all" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
              <input required type="email" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-50 transition-all" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
              <input type="text" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-50 transition-all" value={formData.phoneNumber} placeholder="+254..." onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })} />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">System Access Roles</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {AVAILABLE_ROLES.map(role => (
                <button
                  key={role.slug}
                  type="button"
                  onClick={() => toggleRole(role.slug)}
                  className={`px-4 py-4 rounded-2xl text-[10px] font-black uppercase tracking-wider border-2 transition-all ${formData.roles.includes(role.slug)
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100 scale-105'
                    : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'
                    }`}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Department</label>
              <input className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-50 transition-all" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Job Title</label>
              <input className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-50 transition-all" value={formData.jobTitle} onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })} />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{user ? 'Security PIN (Optional)' : 'Security PIN (Required)'}</label>
            <input required={!user} type="password" placeholder="••••" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-50 transition-all" value={formData.pin} onChange={(e) => setFormData({ ...formData, pin: e.target.value })} />
          </div>

          {/* Line Assignment (Only for Operators) */}
          {formData.roles.some(r => r.startsWith('OPERATOR')) && (
            <div className="space-y-4 p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Production Lines</label>
               <div className="grid grid-cols-2 gap-3">
                  {lines?.map((line: any) => (
                    <button
                      key={line.id}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          assignedLines: prev.assignedLines.includes(line.id)
                            ? prev.assignedLines.filter(id => id !== line.id)
                            : [...prev.assignedLines, line.id]
                        }));
                      }}
                      className={`px-4 py-4 rounded-2xl text-[10px] font-black uppercase tracking-wider border-2 transition-all flex items-center justify-between ${formData.assignedLines.includes(line.id)
                        ? 'bg-white border-indigo-600 text-indigo-600 shadow-lg shadow-indigo-100'
                        : 'bg-white border-white text-slate-400 hover:border-slate-200'
                        }`}
                    >
                      <span>{line.name}</span>
                      {formData.assignedLines.includes(line.id) && <BadgeCheck className="w-4 h-4" />}
                    </button>
                  ))}
               </div>
            </div>
          )}

          <div className="pt-6 flex justify-end gap-4 border-t border-slate-50">
            <button type="button" onClick={onClose} className="px-10 py-5 bg-slate-100 text-slate-600 rounded-[1.5rem] font-black hover:bg-slate-200 transition-all uppercase tracking-widest text-xs">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-12 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black hover:bg-indigo-700 shadow-2xl shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 uppercase tracking-widest text-xs">
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {user ? 'Save Changes' : 'Add User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


function Loader2({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`animate-spin ${className}`}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
  );
}

function X({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
  );
}

