import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api-client';
import {
  Users, Search, Filter, Mail,
  ShieldCheck, Loader2, MoreHorizontal, UserPlus
} from 'lucide-react';
import { ENDPOINTS } from '../../constants/endpoints';
import useAuthStore from '../auth/auth.store';
import { UserFormModal } from './UserManagementPage';

interface Staff {
  id: string;
  name: string;
  email: string;
  role: string;
  roles?: string[];
  jobTitle: string;
  department: string;
  status: 'ACTIVE' | 'INACTIVE';
  avatarUrl?: string;
}

export default function StaffDirectoryPage() {
  const { user } = useAuthStore();
  const userRoles = (user?.roles || [user?.role]).map((role: any) => String(role).toUpperCase());
  const canRegisterStaff = userRoles.includes('ADMIN') || userRoles.includes('MANAGER');
  const [searchTerm, setSearchTerm] = useState('');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  const { data: staffData, isLoading } = useQuery({
    queryKey: ['staff-directory', searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      params.append('role', 'OPERATOR');
      params.append('isActive', 'true');
      return (await api.get(`${ENDPOINTS.USERS.LIST}?${params.toString()}`)).data;
    }
  });

  const staffRows = Array.isArray(staffData) ? staffData : (staffData?.data || []);

  const staff = (staffRows as any[]).map(person => ({
    ...person,
    status: person.isActive ? 'ACTIVE' : 'INACTIVE',
  })) as Staff[];

  const filteredStaff = staff.filter(person => {
    const rolesList = person.roles || (person.role ? [person.role] : []);
    const normalizedRoles = rolesList.map(role => String(role).toUpperCase().trim());
    return normalizedRoles.includes('OPERATOR') && person.status === 'ACTIVE';
  });

  if (isLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[#1A9A91]" />
        <p className="font-semibold uppercase tracking-wider text-[10px]">Loading Staff Directory...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-100 rounded-lg text-slate-700 border border-slate-200">
              <Users className="w-5 h-5 text-[#1A9A91]" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Staff Directory</h2>
            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full border border-slate-200 font-semibold">
              {filteredStaff?.length || 0} Operators
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-1">Real-time operator registry, station allocation, and biometric verification state.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-650 rounded-lg text-xs font-semibold shadow-sm justify-center">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            eSSL Biometric: Active
          </div>
          {canRegisterStaff && (
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="px-4 py-2 bg-[#1A9A91] hover:bg-[#157C75] text-white rounded-lg font-semibold uppercase tracking-wider text-xs shadow-sm transition-all active:scale-95 inline-flex items-center justify-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Register New Staff
            </button>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white border border-slate-200 p-3 rounded-lg flex flex-wrap items-center gap-3 shadow-sm">
        <div className="flex items-center gap-2 text-slate-400 pr-2 border-r border-slate-200">
          <Filter className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Refine</span>
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by operator name, email, title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#1A9A91] focus:bg-white transition-all"
          />
        </div>

        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="flex items-center gap-1 px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border border-transparent hover:border-rose-100"
          >
            Clear Search
          </button>
        )}
      </div>

      {/* Staff Table Layout */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-3.5 col-span-4">Personnel Profile</th>
                <th className="px-6 py-3.5 col-span-3">Access Control</th>
                <th className="px-6 py-3.5 col-span-3">Contact Details</th>
                <th className="px-6 py-3.5 col-span-2 text-right">System Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStaff?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-400">
                    {searchTerm
                      ? `No operator accounts found matching "${searchTerm}"`
                      : "No operators found. Create an operator account to assign production lines."
                    }
                  </td>
                </tr>
              )}
              {filteredStaff?.map((person) => (
                <tr key={person.id} className="hover:bg-slate-50/45 transition-colors group">
                  {/* Personnel Info */}
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 shrink-0 relative group-hover:scale-105 transition-transform duration-300">
                        <img
                          src={person.avatarUrl || `https://ui-avatars.com/api/?name=${person.name}&background=1A9A91&color=fff&bold=true`}
                          alt={person.name}
                          className="w-full h-full object-cover"
                        />
                        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm ${person.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-300'
                          }`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800 leading-tight group-hover:text-[#1A9A91] transition-colors">{person.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100/50 text-[#1A9A91] rounded text-[9px] font-bold uppercase tracking-wide">
                            {person.jobTitle || 'Operator'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Access & Role */}
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-slate-100 rounded text-slate-500">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-700 uppercase tracking-tight">
                          {person.roles?.join(', ') || person.role}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">Factory Protocol Access</p>
                      </div>
                    </div>
                  </td>

                  {/* Contact */}
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2 group/mail max-w-[200px]">
                      <div className="w-7 h-7 rounded bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 group-hover/mail:bg-[#1A9A91] group-hover/mail:text-white transition-all">
                        <Mail className="w-3.5 h-3.5" />
                      </div>
                      <div className="overflow-hidden min-w-0">
                        <p className="text-xs font-medium text-slate-600 truncate">{person.email}</p>
                        <p className="text-[9px] font-bold text-[#1A9A91] uppercase tracking-wide mt-0.5 opacity-0 group-hover/mail:opacity-100 transition-all">Click to Email</p>
                      </div>
                    </div>
                  </td>

                  {/* Status & Actions */}
                  <td className="px-6 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${person.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-slate-55 bg-slate-100 text-slate-400 border border-slate-200'
                        }`}>
                        {person.status}
                      </span>

                      <button className="p-1 text-slate-400 hover:text-slate-650 hover:bg-slate-100 rounded transition-all">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Responsive Mobile Layout fallback */}
      <div className="md:hidden grid grid-cols-1 gap-4">
        {filteredStaff?.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">
            {searchTerm
              ? `No operator accounts found matching "${searchTerm}"`
              : "No operators found. Create an operator account to assign production lines."
            }
          </div>
        )}
        {filteredStaff?.map((person) => (
          <div key={person.id} className="bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-350 transition-all relative">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shrink-0 relative">
                <img
                  src={person.avatarUrl || `https://ui-avatars.com/api/?name=${person.name}&background=1A9A91&color=fff&bold=true`}
                  alt={person.name}
                  className="w-full h-full object-cover"
                />
                <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${person.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-300'
                  }`} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-800 truncate">{person.name}</h3>
                <p className="text-xs text-slate-400 truncate">{person.email}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                  <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 text-[#1A9A91] rounded text-[9px] font-bold uppercase tracking-wide">
                    {person.jobTitle || 'Operator'}
                  </span>
                  <span className="text-xs text-slate-300">•</span>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">
                    {person.roles?.join(', ') || person.role}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${person.status === 'ACTIVE'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-400'
                  }`}>
                  {person.status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isRegisterModalOpen && (
        <UserFormModal onClose={() => setIsRegisterModalOpen(false)} />
      )}
    </div>
  );
}
