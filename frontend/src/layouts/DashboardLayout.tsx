import { useState, useEffect } from 'react';
import {
  Search, Menu, X, LogOut, Command
} from 'lucide-react';
import useAuthStore from '../modules/auth/auth.store';
import { moduleRegistry } from '../app/registry/moduleRegistry';
import { useNavigate, NavLink, Outlet, useSearchParams } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import CommandPalette from '../components/common/CommandPalette';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { usePWA } from '../hooks/usePWA';

export default function DashboardLayout() {
  const { user, logout } = useAuthStore();
  const { installPrompt, installApp } = usePWA();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSidebarOpen, setSidebarOpen] = useState(true);



  const filters = {
    lineId: searchParams.get('lineId') || '',
    brandId: searchParams.get('brandId') || 'all',
    productId: searchParams.get('productId') || 'all',
    shiftId: searchParams.get('shiftId') || 'all',
    timeRange: searchParams.get('timeRange') || 'live'
  };

  const setFilters = (newFilters: any) => {
    const updated = { ...filters, ...newFilters };
    const params: any = {};
    if (updated.lineId) params.lineId = updated.lineId;
    if (updated.brandId !== 'all') params.brandId = updated.brandId;
    if (updated.productId !== 'all') params.productId = updated.productId;
    if (updated.shiftId !== 'all') params.shiftId = updated.shiftId;
    if (updated.timeRange !== 'live') params.timeRange = updated.timeRange;
    setSearchParams(params);
  };

  useEffect(() => {
    const lineId = searchParams.get('lineId');
    if (lineId && (lineId.startsWith(':') || lineId === 'all')) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('lineId');
      setSearchParams(newParams);
    }
  }, [searchParams, setSearchParams]);


  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebarGroups = moduleRegistry.getAllSidebarGroups();

  const filterByRole = (allowedRoles?: string[]) => {
    if (!allowedRoles || allowedRoles.length === 0) return true;
    const userRoles = user?.roles || (user?.role ? [user.role] : []);
    if (userRoles.includes('SUPER_ADMIN')) return true;
    return allowedRoles.some(role => userRoles.includes(role));
  };

  const getModulePath = (path: string) => {
    // If the path is intended for the operator terminal or top-level tools, don't prefix it
    if (path.startsWith('/line') || path.startsWith('/terminal')) return path;

    const base = (user?.role === 'MANAGER') ? '/manager' : '/admin';
    return `${base}${path}`;
  };

  return (
    <div className="flex h-screen bg-[#FDFDFD]">
      <CommandPalette />

      {/* Sidebar */}
      <aside className={`
        ${isSidebarOpen ? 'w-72' : 'w-20'} 
        bg-slate-900 transition-all duration-300 ease-in-out flex flex-col z-30
      `}>
        <div className="h-24 flex items-center px-6">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 group">
            <Command className="w-7 h-7" />
          </div>
          {isSidebarOpen && (
            <div className="ml-4 animate-in fade-in slide-in-from-left-2 duration-500">
              <span className="block font-black text-xl tracking-tight text-white">ERANAD<span className="text-indigo-400">MES</span></span>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">System</span>
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 py-8 space-y-8 overflow-y-auto no-scrollbar">
          {sidebarGroups.filter(g => filterByRole(g.allowedRoles)).map((group) => (
            <div key={group.id} className="space-y-3">
              {isSidebarOpen && (
                <h3 className="px-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                  {group.label}
                </h3>
              )}
              <div className="space-y-1">
                {group.items.filter(i => filterByRole(i.allowedRoles)).map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <NavLink
                        to={getModulePath(item.path)}
                        className={({ isActive }) => `
                          w-full flex items-center py-4 rounded-2xl transition-all duration-300 group relative
                          ${isSidebarOpen ? 'px-5' : 'justify-center'}
                          ${isActive
                            ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-500/40 translate-x-1'
                            : 'text-slate-400 hover:bg-white/5 hover:text-white'}
                        `}
                      >
                        {({ isActive }) => (
                          <>
                            <Icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-500 ${isActive ? 'scale-110' : 'group-hover:scale-125'}`} />
                            {isSidebarOpen && (
                              <span className="ml-4 font-bold text-sm tracking-tight truncate flex-1">{item.label}</span>
                            )}
                            {item.isComingSoon && isSidebarOpen && (
                              <span className="ml-auto text-[8px] font-black bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md uppercase tracking-tighter">Soon</span>
                            )}
                            {isActive && (
                              <motion.div
                                layoutId="active-pill"
                                className="absolute left-0 w-1 h-8 bg-white rounded-r-full"
                              />
                            )}
                          </>
                        )}
                      </NavLink>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 bg-slate-950/30 space-y-2">
          {installPrompt && (
            <button
              onClick={installApp}
              className={`w-full flex items-center py-3 rounded-2xl bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 transition-colors border border-indigo-500/20 ${isSidebarOpen ? 'px-4' : 'justify-center'}`}
            >
              <Command className="w-5 h-5 flex-shrink-0" />
              {isSidebarOpen && <span className="ml-4 font-bold text-sm truncate animate-in fade-in slide-in-from-left-2">Install System</span>}
            </button>
          )}

          <button
            onClick={handleLogout}
            className={`w-full flex items-center py-3 rounded-2xl text-rose-400 hover:bg-rose-500/10 transition-colors ${isSidebarOpen ? 'px-4' : 'justify-center'}`}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {isSidebarOpen && <span className="ml-4 font-bold text-sm truncate animate-in fade-in slide-in-from-left-2">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Modern Header */}
        <header className="h-24 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-10 z-20">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-500 transition-all active:scale-90"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Executive Control</h1>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 text-[9px] font-black uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  System Pulse: OK
                </div>
                <div className="h-3 w-px bg-slate-100" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Factory v4.0.2</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="relative hidden lg:block group">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-600 transition-colors" />
              <input
                type="text"
                placeholder="Search..."
                className="bg-slate-50 border border-transparent rounded-[1.25rem] pl-11 pr-4 py-3 text-sm w-80 focus:ring-4 focus:ring-indigo-50 focus:bg-white focus:border-indigo-100 transition-all font-semibold text-slate-700"
              />
            </div>

            <div className="flex items-center gap-4">
              <NotificationBell />

              <div className="h-10 w-px bg-slate-100 mx-2" />

              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-black text-slate-900 leading-tight">{user?.name}</p>
                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{user?.role}</p>
                  </div>
                </div>
                <div className="w-12 h-12 bg-slate-100 rounded-2xl border-2 border-white shadow-xl shadow-slate-200/50 overflow-hidden group cursor-pointer hover:ring-4 hover:ring-indigo-50 transition-all">
                  <img
                    src={user?.avatarUrl || `https://ui-avatars.com/api/?name=${user?.name}&background=4f46e5&color=fff&bold=true`}
                    alt="Avatar"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        <div id="main-scroll-container" className="flex-1 overflow-y-auto bg-[#FAFBFF] p-10 relative custom-scrollbar">
          <div className="max-w-[1700px] mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <Outlet context={{ filters, setFilters }} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}


