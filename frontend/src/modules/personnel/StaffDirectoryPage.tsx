import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api-client';
import { 
  Users, Search, Filter, Mail, 
  ShieldCheck, Loader2, MoreHorizontal
} from 'lucide-react';

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
  
  const { data: staff, isLoading } = useQuery<Staff[]>({
    queryKey: ['staff-directory'],
    queryFn: async () => (await api.get('/users')).data // Reusing users endpoint as staff directory
  });

  const filteredStaff = staff?.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) return (
    <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-4">
      <Loader2 className="w-8 h-8 animate-spin" />
      <p className="font-bold uppercase tracking-widest text-[10px]">Loading Directory...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-[1.5rem] flex items-center justify-center">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Staff Directory</h2>
            <p className="text-slate-500 font-medium">Manage and view all personnel across factory stations.</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 border border-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[9px]">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            eSSL Biometric Active
          </div>
          <p className="text-[10px] font-bold text-slate-400 max-w-[200px]">Registration handled directly via biometric terminal hardware.</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
          <input 
            type="text" 
            placeholder="Search by name, email or job title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-100 rounded-[2rem] pl-16 pr-8 py-5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-50 transition-all shadow-sm"
          />
        </div>
        <button className="px-8 py-5 bg-white border border-slate-100 rounded-[2rem] text-slate-600 font-black uppercase tracking-widest text-[10px] flex items-center gap-3 hover:bg-slate-50 transition-all shadow-sm">
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredStaff?.map((person) => (
          <div key={person.id} className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className="w-16 h-16 rounded-[1.25rem] overflow-hidden border-2 border-white shadow-lg shadow-slate-200">
                <img 
                  src={person.avatarUrl || `https://ui-avatars.com/api/?name=${person.name}&background=4f46e5&color=fff&bold=true`} 
                  alt={person.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex gap-2">
                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                  person.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  {person.status}
                </span>
                <button className="p-2 hover:bg-slate-50 rounded-lg transition-all text-slate-400">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-black text-slate-900 tracking-tight mb-1">{person.name}</h3>
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{person.jobTitle || 'Station Operator'}</p>
            </div>

            <div className="space-y-3 pt-6 border-t border-slate-50">
              <div className="flex items-center gap-3 text-slate-500">
                <Mail className="w-4 h-4" />
                <span className="text-xs font-medium">{person.email}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-500">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-medium">{person.role} Access</span>
              </div>
            </div>

            <button className="w-full mt-8 py-4 bg-slate-50 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all">
              View Full Profile
            </button>
          </div>
        ))}
      </div>

      {filteredStaff?.length === 0 && (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-4 bg-white rounded-[3rem] border border-dashed border-slate-200">
          <p className="font-bold uppercase tracking-widest text-[10px]">No personnel found matching "{searchTerm}"</p>
        </div>
      )}
    </div>
  );
}
