import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Activity, LogOut,
  ShieldCheck, User, Loader2
} from 'lucide-react';

import useAuthStore from '../store/useAuthStore';
import { api } from '../api';
import toast from 'react-hot-toast';
import Watermark from './Watermark';

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLines = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/master-data/lines');
      setLines(res.data);
    } catch (err: any) {
      toast.error('Failed to load production lines');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLines();
  }, [fetchLines]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen bg-white text-slate-900 font-sans relative">
      <Watermark />
      
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col z-20 flex-shrink-0">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-slate-900 rounded-lg">
                <ShieldCheck className="w-6 h-6 text-white" />
             </div>
             <div>
               <h2 className="text-lg font-bold text-slate-900  tracking-tight">
                 Manager HUB
               </h2>
               <p className="text-xs text-slate-500 font-semibold  ">Supervisor Access</p>

             </div>
          </div>
        </div>


        <nav className="flex-1 py-4">
          <ul className="space-y-1 px-3">
            <li>
              <button className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg bg-indigo-50 text-indigo-700 font-semibold transition-all">
                <LayoutDashboard className="w-4 h-4 text-indigo-600" />
                <span className="text-sm">Operations</span>
              </button>
            </li>
            <li>
              <button className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 transition-all">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-sm">Shift Reports</span>
              </button>
            </li>
            <li>
              <button className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 transition-all">
                <Activity className="w-4 h-4 text-slate-400" />
                <span className="text-sm">Analytics</span>
              </button>
            </li>
          </ul>
        </nav>

        <div className="p-6 border-t border-slate-100">
          {currentUser && (
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden">
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="User" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <User className="w-5 h-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-slate-900 text-sm font-bold  tracking-tight truncate">{currentUser?.name?.split(' ')[0] || 'User'}</p>
                <p className="text-blue-600 text-xs font-bold ">SUPERVISOR</p>

              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 px-4 py-2.5 w-full text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all text-xs font-semibold  "
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>

          </button>
        </div>

      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center z-10 sticky top-0">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Operations Overview</h1>
            <p className="text-xs text-slate-500">Monitor production lines and efficiency</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
          <div className="mb-8">
             <h2 className="text-3xl font-bold text-slate-900">Production Overview</h2>
             <p className="text-slate-500 text-sm mt-1">Status of {lines.length} production lines</p>

          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-40">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
              <p className="text-slate-500 text-sm italic">Loading production data...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(lines || []).map((line) => (
                <div 
                  key={line.id} 
                  className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/20 hover:border-blue-500/20 transition-all group"
                >
                  <div className="flex justify-between items-start mb-6">
                     <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${line.status === 'RUNNING' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-100 text-slate-400'}`}>
                           <Activity className="w-6 h-6" />
                        </div>

                        <div>
                          <h3 className="font-bold text-slate-900">{line.name}</h3>
                          <p className="text-slate-500 text-xs">ID: {line.id.slice(0,8).toUpperCase()}</p>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-2 mb-4">
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

                  <div className="flex gap-4">
                     <div className="flex-1 bg-slate-50 p-3 rounded-lg text-center">
                       <p className="text-xs text-slate-400  font-bold mb-1">Status</p>
                       <span className="text-xs font-semibold text-slate-700">{line.status}</span>
                     </div>
                     <div className="flex-1 bg-slate-50 p-3 rounded-lg text-center">
                       <p className="text-xs text-slate-400  font-bold mb-1">Health</p>
                       <span className="text-xs font-semibold text-emerald-600">Optimal</span>
                     </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="px-8 py-4 bg-white border-t border-slate-100 flex justify-between items-center relative z-20">
           <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-slate-400">System Online</span>
           </div>
           <div className="text-right">
              <p className="text-xs text-slate-300 mb-0.5">A Webzio International Product & Service</p>
              <p className="text-[11px] font-semibold text-slate-500">Built by Webzio Technology</p>

           </div>
        </footer>
      </main>
    </div>
  );
}

