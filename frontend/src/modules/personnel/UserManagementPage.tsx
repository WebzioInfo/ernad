import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api-client';
import {
  Users, UserPlus, Search,
  Trash2, Edit2, UserCheck,
  Mail,
  Lock, Unlock, BadgeCheck,
  ShieldCheck, ShieldAlert, UserCog,
  Filter, XCircle, Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { ENDPOINTS } from '../../constants/endpoints';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import useAuthStore from '../auth/auth.store';

export interface User {
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

// ── Role definitions ─────────────────────────────────────────────────────────

/** Exact slugs that are platform-privileged. Used for deny-list filtering. */
export const PRIVILEGED_ROLE_SLUGS = [
  'ADMIN',
] as const;

/** Operational roles visible to managers. */
export const OPERATIONAL_ROLES = [
  { slug: 'MANAGER', label: 'Plant Manager', color: 'amber' },
  { slug: 'ACCOUNTANT', label: 'Accountant', color: 'slate' },
  { slug: 'OPERATOR', label: 'General Operator', color: 'emerald' },
];

/** Roles visible to ADMIN. */
export const ADMIN_VISIBLE_ROLES = [
  { slug: 'ADMIN', label: 'Administrator', color: 'indigo' },
  ...OPERATIONAL_ROLES,
];

/** Full three-role list. */
export const ALL_ROLES = [
  ...ADMIN_VISIBLE_ROLES,
];

const getRoleStyle = (role: string) => {
  switch (role) {
    case 'ADMIN':
      return {
        icon: <ShieldCheck className="w-3.5 h-3.5" />,
        color: 'from-indigo-500 to-blue-600',
        bg: 'bg-indigo-50 text-[#1A9A91] border-indigo-100',
        text: 'text-[#1A9A91]',
      };
    case 'MANAGER':
      return {
        icon: <ShieldAlert className="w-3.5 h-3.5" />,
        color: 'from-amber-500 to-orange-600',
        bg: 'bg-amber-50 text-amber-700 border-amber-100',
        text: 'text-amber-700',
      };
    case 'ACCOUNTANT':
      return {
        icon: <UserCog className="w-3.5 h-3.5" />,
        color: 'from-slate-500 to-slate-700',
        bg: 'bg-slate-100 text-slate-800 border-slate-200',
        text: 'text-slate-800',
      };
    default:
      return {
        icon: <UserCheck className="w-3.5 h-3.5" />,
        color: 'from-emerald-500 to-teal-600',
        bg: 'bg-slate-50 text-slate-700 border-slate-200',
        text: 'text-slate-700',
      };
  }
};

export default function UserManagementPage() {
  const { user: currentUser } = useAuthStore();
  const callerRoles = currentUser?.roles || [];
  const isAdmin      = callerRoles.includes('ADMIN');
  const isManager    = callerRoles.includes('MANAGER');
  const canAddUser    = isAdmin || isManager;

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const queryClient = useQueryClient();

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users', searchTerm, roleFilter, deptFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (roleFilter !== 'ALL') params.append('role', roleFilter);
      if (deptFilter !== 'ALL') params.append('department', deptFilter);
      if (statusFilter !== 'ALL') params.append('isActive', statusFilter === 'ACTIVE' ? 'true' : 'false');
      
      return (await api.get(`${ENDPOINTS.USERS.LIST}?${params.toString()}`)).data;
    }
  });

  const users = (usersData?.data || []) as User[];

  const toggleActiveMutation = useMutation({
    mutationFn: (id: string) => api.patch(ENDPOINTS.USERS.TOGGLE_ACTIVE(id)),
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
    mutationFn: (id: string) => api.delete(ENDPOINTS.USERS.UPDATE(id)), // DELETE uses the same base path
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

  const departments = Array.from(new Set(users.map(u => u.department).filter(Boolean))) as string[];

  // ── No more client-side filtering ──────────────────────────────────
  // The backend now handles all hierarchical scoping, search, and role filters.
  const filteredUsers = users;

  const clearFilters = () => {
    setSearchTerm('');
    setRoleFilter('ALL');
    setDeptFilter('ALL');
    setStatusFilter('ALL');
  };

  if (isLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[#1A9A91]" />
        <p className="font-semibold uppercase tracking-wider text-[10px]">Loading User Accounts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-100 rounded-lg text-slate-700 border border-slate-200">
              <UserCog className="w-5 h-5 text-[#1A9A91]" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">
              User Access & Roles
            </h2>
            <span className="bg-slate-100 text-slate-655 text-[10px] px-2 py-0.5 rounded-full border border-slate-200 font-semibold">
              {filteredUsers?.length || 0} Total
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">Configure credentials, platform access privileges, and operator stations.</p>
        </div>

        {canAddUser && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-[#1A9A91] hover:bg-[#157C75] text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 text-xs uppercase tracking-wider sm:self-center"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
        )}
      </div>

      {/* Advanced Filters Strip */}
      <div className="bg-white border border-slate-200 p-2.5 rounded-lg flex flex-wrap items-center gap-3 shadow-sm">
        <div className="flex items-center gap-2 text-slate-400 pr-2 border-r border-slate-200">
          <Filter className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Filters</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search user..."
              className="bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs font-medium text-slate-700 w-48 sm:w-60 focus:ring-2 focus:ring-[#1A9A91] focus:bg-white transition-all outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {[
            {
              value: roleFilter,
              setter: setRoleFilter,
              options: [
                { slug: 'ALL', label: 'All Roles' },
                ...(isAdmin ? ADMIN_VISIBLE_ROLES : OPERATIONAL_ROLES)
                  .map((r: { slug: string; label: string }) => ({ slug: r.slug, label: r.label })),
              ],
            },
            { value: deptFilter, setter: setDeptFilter, options: [{ slug: 'ALL', label: 'All Departments' }, ...departments.map(d => ({ slug: d, label: d }))] },
            { value: statusFilter, setter: setStatusFilter, options: [{ slug: 'ALL', label: 'All Status' }, { slug: 'ACTIVE', label: 'Active' }, { slug: 'SUSPENDED', label: 'Blocked' }] }
          ].map((filter, i) => (
            <select
              key={i}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 focus:ring-2 focus:ring-[#1A9A91] focus:border-[#1A9A91] outline-none cursor-pointer transition-all hover:bg-slate-100/50"
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
            className="flex items-center gap-1.5 px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-[10px] font-bold transition-all uppercase tracking-wider border border-transparent hover:border-rose-100"
          >
            <XCircle className="w-3.5 h-3.5" />
            Reset Filters
          </button>
        )}
      </div>

      {/* User Table/List */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-2.5">User</th>
                <th className="px-4 py-2.5">Department</th>
                <th className="px-4 py-2.5">Access Roles</th>
                <th className="px-4 py-2.5">Line Allocation</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredUsers?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                    No users found matching current filters.
                  </td>
                </tr>
              )}
              {filteredUsers?.map((user) => {
                return (
                  <tr key={user.id} className="hover:bg-slate-50/45 transition-colors group">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.name} className="w-9 h-9 rounded-lg object-cover border border-slate-200" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                              <Users className="w-4.5 h-4.5" />
                            </div>
                          )}
                          <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${user.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 group-hover:text-[#1A9A91] transition-colors">{user.name}</div>
                          <div className="text-xs text-slate-450">@{user.username} • {user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-medium text-slate-700">{user.department || 'General Operations'}</div>
                      <div className="text-xs text-slate-400">{user.jobTitle || 'System User'}</div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.roles?.map(role => (
                          <span key={role} className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${getRoleStyle(role).bg}`}>
                            {role.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      {user.assignedLines && user.assignedLines.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.assignedLines.map(lineId => (
                            <span key={lineId} className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 rounded text-[10px] font-medium uppercase">
                              Line {lineId.slice(-4)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-450">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        {user.isActive ? 'Active' : 'Blocked'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => setViewingUser(user)}
                        className="p-1.5 text-slate-400 hover:text-[#1A9A91] hover:bg-slate-100 rounded-lg transition-all inline-flex items-center gap-1 text-xs font-semibold uppercase"
                      >
                        <UserCog className="w-4 h-4" /> Manage
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Responsive Mobile Layout fallback */}
      <div className="md:hidden grid grid-cols-1 gap-4">
        {filteredUsers?.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">
            No users found matching current filters.
          </div>
        )}
        {filteredUsers?.map((user) => (
          <div
            key={user.id}
            onClick={() => setViewingUser(user)}
            className="bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-350 transition-all cursor-pointer relative"
          >
            <div className="flex items-start gap-3">
              <div className="relative shrink-0">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                    <Users className="w-5 h-5" />
                  </div>
                )}
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${user.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-800 truncate">{user.name}</div>
                <div className="text-xs text-slate-400 truncate">@{user.username}</div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {user.roles?.map(role => (
                    <span key={role} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase border ${getRoleStyle(role).bg}`}>
                      {role.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {user.isActive ? 'Active' : 'Blocked'}
                </span>
              </div>
            </div>
          </div>
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
          isAdmin={isAdmin}
          canManage={canAddUser}
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

function UserDetailModal({ user, onClose, onEdit, onToggleActive, onDelete, isAdmin, canManage }: { user: User, onClose: () => void, onEdit: () => void, onToggleActive: () => void, onDelete: () => void, isAdmin: boolean, canManage: boolean }) {
  const { user: currentUser } = useAuthStore();
  const isTargetAdmin = user.roles?.includes('ADMIN');
  const isTargetManager = user.roles?.includes('MANAGER');
  const isSelf = user.id === currentUser?.id;
  
  // Managers can manage users, but NOT Admins. Managers can edit themselves.
  const canEditThisUser = isAdmin || (canManage && !isTargetAdmin && (!isTargetManager || isSelf));
  const { data: logs } = useQuery({
    queryKey: ['user-audit-logs', user.id],
    queryFn: async () => (await api.get(ENDPOINTS.USERS.USER_AUDIT_LOGS(user.id))).data,
    retry: false
  });

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">User Account Profile</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200/80 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {/* Identity Info */}
          <div className="flex items-center gap-4 pb-5 border-b border-slate-100">
            <div className="relative shrink-0">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} className="w-16 h-16 rounded-lg object-cover border border-slate-200" alt="Avatar" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                  <Users className="w-7 h-7" />
                </div>
              )}
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${user.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                {user.isActive ? <Unlock className="w-2.5 h-2.5 text-white" /> : <Lock className="w-2.5 h-2.5 text-white" />}
              </div>
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-800 leading-tight">{user.name}</h4>
              <p className="text-xs text-slate-500 font-medium">@{user.username} • {user.jobTitle || 'System User'}</p>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {user.email}
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Department</span>
              <span className="text-xs font-semibold text-slate-700">{user.department || 'General Operations'}</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Access Roles</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {user.roles.map(r => (
                  <span key={r} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-200/50 text-slate-700 border border-slate-300/40">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Allocation */}
          {user.assignedLines && user.assignedLines.length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Line Allocation</span>
              <div className="flex flex-wrap gap-1">
                {user.assignedLines.map(lineId => (
                  <span key={lineId} className="px-2 py-0.5 bg-white border border-slate-200 text-[#1A9A91] rounded text-[10px] font-semibold uppercase">
                    Line {lineId.slice(-4)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Timeline Activity */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#1A9A91]" />
              Recent Activity Timeline
            </h4>
            <div className="border border-slate-200 rounded-lg bg-slate-50 p-3 max-h-[140px] overflow-y-auto custom-scrollbar space-y-3">
              {logs && logs.length > 0 ? logs.map((log: any, idx: number) => (
                <div key={log.id} className="flex gap-3 text-xs">
                  <div className="flex flex-col items-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1A9A91] mt-1.5 shadow-[0_0_4px_rgba(26,154,145,0.4)]" />
                    {idx !== logs.length - 1 && <div className="w-[1px] h-full bg-slate-200 my-1" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-700">
                      {log.action.split(' /')[0].replace('POST', 'Created').replace('PATCH', 'Updated').replace('GET', 'Accessed') || 'Performed System Action'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{new Date(log.occurredAt).toLocaleString()}</p>
                  </div>
                </div>
              )) : (
                <div className="py-4 text-center text-slate-450 text-xs font-semibold uppercase tracking-wider">
                  No activity logs recorded
                </div>
              )}
            </div>
          </div>

          {/* Modify Actions */}
          {canEditThisUser && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={onToggleActive}
                className={`flex-1 h-9 rounded-lg font-semibold uppercase tracking-wider text-[10px] transition-all flex items-center justify-center gap-1 border ${
                  user.isActive
                    ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white hover:border-rose-600'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-600 hover:text-white hover:border-emerald-600'
                }`}
              >
                {user.isActive ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                {user.isActive ? 'Suspend User' : 'Restore User'}
              </button>
              <button
                onClick={onEdit}
                className="flex-1 h-9 bg-[#1A9A91] hover:bg-[#157C75] text-white rounded-lg font-semibold uppercase tracking-wider text-[10px] transition-colors flex items-center justify-center gap-1 shadow-sm"
              >
                <Edit2 className="w-3.5 h-3.5" /> Modify Profile
              </button>
            </div>
          )}

          {/* Danger Zone */}
          {isAdmin && (
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between bg-rose-50/20 p-3 rounded-lg border border-rose-100/50">
                <div className="text-left">
                  <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Danger Zone</p>
                  <p className="text-[11px] text-slate-500 font-medium">Permanently delete user profile.</p>
                </div>
                <button
                  onClick={onDelete}
                  className="bg-white hover:bg-rose-600 text-rose-600 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all border border-rose-200 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function UserFormModal({ user, onClose }: { user?: User, onClose: () => void }) {
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.roles.includes('ADMIN');
  const isManager = currentUser?.roles.includes('MANAGER');

  const allowedRoles = isAdmin ? ADMIN_VISIBLE_ROLES : isManager ? OPERATIONAL_ROLES.filter(role => role.slug === 'OPERATOR') : OPERATIONAL_ROLES;
  const isSelf = user?.id === currentUser?.id;
  const canEditRoles = isAdmin || (isManager && !isSelf);

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

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        username: user.username || '',
        email: user.email || '',
        roles: user.roles || ['OPERATOR'],
        assignedLines: user.assignedLines || [],
        department: user.department || '',
        jobTitle: user.jobTitle || '',
        phoneNumber: user.phoneNumber || '',
        pin: '',
      });
    }
  }, [user]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: lines } = useQuery({
    queryKey: ['production-lines'],
    queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.LINES)).data
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
      const isEdit = !!user;
      const res = isEdit
        ? await api.patch(ENDPOINTS.USERS.UPDATE(user.id), data)
        : await api.post(ENDPOINTS.USERS.CREATE, data);

      const savedUser = res.data;

      if (selectedFile) {
        const fileData = new FormData();
        fileData.append('file', selectedFile);
        await api.post(ENDPOINTS.USERS.AVATAR(savedUser.id), fileData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      return savedUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['staff-directory'] });
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

    // Sanitize roles if we are allowed to edit them
    if (canEditRoles) {
      if (data.roles && Array.isArray(data.roles)) {
        data.roles = Array.from(new Set(data.roles.map(r => String(r).trim().toUpperCase())));
      }
    } else {
      delete (data as any).roles;
    }

    mutation.mutate(data);
  };

  const selectRole = (roleSlug: string) => {
    setFormData(prev => ({
      ...prev,
      roles: [roleSlug.toUpperCase()]
    }));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              {user ? 'Modify System User' : 'Create User Account'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Configure system role permissions, lines allocation, and profile photo.</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200/80 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4.5 custom-scrollbar">
          {/* Avatar Upload Block */}
          <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center">
                {previewUrl || user?.avatarUrl ? (
                  <img src={previewUrl || user?.avatarUrl} className="w-full h-full object-cover" alt="Avatar" />
                ) : (
                  <Users className="w-6 h-6 text-slate-400" />
                )}
              </div>
              <label className="absolute -bottom-1 -right-1 bg-[#1A9A91] hover:bg-[#157C75] text-white p-1 rounded-md shadow cursor-pointer transition-colors">
                <BadgeCheck className="w-3.5 h-3.5" />
                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-700">Account Image</span>
              <span className="block text-[11px] text-slate-500 mt-0.5">Upload portrait avatar (JPG, PNG).</span>
            </div>
          </div>

          {/* Form Rows */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Full Name</label>
              <input required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-[#1A9A91] focus:bg-white transition-all outline-none" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Username</label>
              <input required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-[#1A9A91] focus:bg-white transition-all outline-none" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Email Address</label>
              <input required type="email" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-[#1A9A91] focus:bg-white transition-all outline-none" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Phone Number</label>
              <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-[#1A9A91] focus:bg-white transition-all outline-none" value={formData.phoneNumber} placeholder="+254..." onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })} />
            </div>
          </div>

          {/* Access Roles */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Access Roles</label>
            {canEditRoles ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {allowedRoles.map((role: { slug: string; label: string }) => {
                  const isSelected = formData.roles.includes(role.slug);
                  return (
                    <button
                      key={role.slug}
                      type="button"
                      onClick={() => selectRole(role.slug)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-emerald-50 border-[#1A9A91] text-[#1A9A91] shadow-sm'
                          : 'bg-white border-slate-200 text-slate-655 hover:bg-slate-50'
                      }`}
                    >
                      <span>{role.label}</span>
                      {isSelected && <BadgeCheck className="w-3.5 h-3.5 text-[#1A9A91]" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {formData.roles.map(r => (
                  <span key={r} className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold uppercase">
                    {r.replace('_', ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Dept & Job Title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Department</label>
              <input className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-[#1A9A91] focus:bg-white transition-all outline-none" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Job Title</label>
              <input className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-[#1A9A91] focus:bg-white transition-all outline-none" value={formData.jobTitle} onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })} />
            </div>
          </div>

          {/* Security PIN */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">{user ? 'Security PIN (Optional)' : 'Security PIN (Required)'}</label>
            <input
              required={!user}
              type="password"
              placeholder="••••"
              maxLength={4}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-[#1A9A91] focus:bg-white transition-all outline-none"
              value={formData.pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                setFormData({ ...formData, pin: val });
              }}
            />
            <p className="text-[10px] text-slate-400">Must be exactly 4 digits. Used for biometric tablet kiosks sign-in.</p>
          </div>

          {/* Assigned Lines (Operators only) */}
          {formData.roles.some(r => r.startsWith('OPERATOR')) && (
            <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <label className="block text-xs font-semibold text-slate-700">Assigned Production Lines</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {lines?.map((line: any) => {
                  const isSelected = formData.assignedLines.includes(line.id);
                  return (
                    <button
                      key={line.id}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          assignedLines: isSelected
                            ? prev.assignedLines.filter(id => id !== line.id)
                            : [...prev.assignedLines, line.id]
                        }));
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-white border-[#1A9A91] text-[#1A9A91] shadow-sm'
                          : 'bg-white border-slate-200 text-slate-555 hover:border-slate-300'
                      }`}
                    >
                      <span>{line.name}</span>
                      {isSelected && <BadgeCheck className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors uppercase tracking-wider">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-5 py-1.5 bg-[#1A9A91] hover:bg-[#157C75] text-white rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 uppercase tracking-wider shadow-sm">
              {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {user ? 'Save Changes' : 'Add User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Inline fallback loader and close indicators in case of dependency changes
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
