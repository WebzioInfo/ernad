import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api-client';
import { 
  Users, Search, Filter, Mail, 
  ShieldCheck, Loader2, MoreHorizontal
} from 'lucide-react';
import { ENDPOINTS } from '../../constants/endpoints';

interface Staff {
  id: string;
  name: string;
  email: string;
  role: string;
  jobTitle: string;
  department: string;
  status: 'ACTIVE' | 'INACTIVE';
  avatarUrl?: string;
}

export default function StaffDirectoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: staffData, isLoading } = useQuery({
    queryKey: ['staff-directory', searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      return (await api.get(`${ENDPOINTS.USERS.LIST}?${params.toString()}`)).data;
    }
  });

  const staff = (staffData?.data || []) as Staff[];

  const filteredStaff = staff; // Already filtered by backend

  if (isLoading) return (
    <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-4">
      <Loader2 className="w-8 h-8 animate-spin" />
      <p className="font-bold uppercase tracking-widest text-[10px]">Loading Directory...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-indigo-500/10 transition-all duration-700" />
        
        <div className="flex items-center gap-8 relative z-10">
          <div className="w-20 h-20 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-indigo-200">
            <Users className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Staff Directory</h2>
            <p className="text-slate-500 font-bold mt-1">Real-time personnel management & station allocation.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 relative z-10">
          <div className="flex items-center gap-3 px-6 py-4 bg-slate-50 border border-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[9px] shadow-sm">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            eSSL Biometric Node: Active
          </div>
          <button className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200 active:scale-95">
            Register New Staff
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 relative group">
          <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
          <input 
            type="text" 
            placeholder="Search by name, email or job title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-100 rounded-[2.5rem] pl-16 pr-8 py-6 text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-indigo-50 focus:border-indigo-100 transition-all shadow-sm"
          />
        </div>
        <button className="px-10 py-6 bg-white border border-slate-100 rounded-[2.5rem] text-slate-600 font-black uppercase tracking-widest text-[10px] flex items-center gap-3 hover:bg-slate-50 transition-all shadow-sm active:scale-95">
          <Filter className="w-4 h-4" />
          Refine Search
        </button>
      </div>

      {/* Staff List */}
      <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-xl shadow-slate-200/20 overflow-hidden">
        {/* Table Header */}
        <div className="hidden lg:grid grid-cols-12 gap-4 px-12 py-8 bg-slate-50/50 border-b border-slate-100">
          <div className="col-span-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Personnel Profile</div>
          <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Access Control</div>
          <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Contact Details</div>
          <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">System Status</div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-slate-50">
          {filteredStaff?.map((person) => (
            <div key={person.id} className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-12 py-10 items-center hover:bg-indigo-50/30 transition-all group">
              {/* Personnel Info */}
              <div className="col-span-1 lg:col-span-4 flex items-center gap-8">
                <div className="w-16 h-16 rounded-[1.5rem] overflow-hidden border-2 border-white shadow-xl shadow-slate-200 shrink-0 relative group-hover:scale-110 transition-transform duration-500">
                  <img 
                    src={person.avatarUrl || `https://ui-avatars.com/api/?name=${person.name}&background=1A9A91&color=fff&bold=true`} 
                    alt={person.name}
                    className="w-full h-full object-cover"
                  />
                  <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                    person.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-300'
                  }`} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight mb-0.5">{person.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[9px] font-black uppercase tracking-widest">
                      {person.jobTitle || 'Operator'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Access & Role */}
              <div className="col-span-1 lg:col-span-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-700 uppercase tracking-tight">{person.role}</p>
                      <p className="text-[10px] font-bold text-slate-400">Factory Protocol Access</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="col-span-1 lg:col-span-3">
                <div className="flex items-center gap-4 group/mail cursor-pointer">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover/mail:bg-indigo-600 group-hover/mail:text-white transition-all">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-600 truncate">{person.email}</p>
                    <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-0.5 opacity-0 group-hover/mail:opacity-100 transition-opacity">Send Message</p>
                  </div>
                </div>
              </div>

              {/* Status & Actions */}
              <div className="col-span-1 lg:col-span-2 flex items-center justify-between lg:justify-end gap-6">
                <div className="lg:hidden text-[10px] font-black uppercase tracking-widest text-slate-400">Status</div>
                <div className="flex items-center gap-4">
                  <span className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                    person.status === 'ACTIVE' 
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                      : 'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}>
                    {person.status}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <button className="p-3 bg-white border border-slate-100 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-90">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {filteredStaff?.length === 0 && (
        <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-6 bg-white rounded-[3.5rem] border border-dashed border-slate-200 mx-auto max-w-4xl">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
            <Search className="w-8 h-8 text-slate-200" />
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-slate-900 tracking-tight">No Personnel Found</p>
            <p className="text-sm font-medium text-slate-400 mt-1">We couldn't find any staff matching "{searchTerm}"</p>
          </div>
          <button 
            onClick={() => setSearchTerm('')}
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-200"
          >
            Clear Search
          </button>
        </div>
      )}
    </div>

  );
}
