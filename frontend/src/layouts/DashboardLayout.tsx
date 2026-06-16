import { useState, useEffect, useMemo } from 'react';
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
import { IOSInstallPrompt } from '../components/common/IOSInstallPrompt';
import { cn } from '@/lib/utils';
import QuickNotes from '../components/QuickNotes';

export default function DashboardLayout() {
  const { user, logout } = useAuthStore();
  const { 
    installPrompt, 
    installApp, 
    isIOS, 
    isInstalled, 
    showIOSPrompt, 
    dismissIOSPrompt, 
    triggerIOSPrompt 
  } = usePWA();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSidebarOpen, setSidebarOpen] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 768 : true;
  });



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
    // Close sidebar on mobile/tablet when route changes
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

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

  const rawGroups = moduleRegistry.getAllSidebarGroups();

  // Unified Grouping Logic: Merges items with the same Group ID across modules
  const sidebarGroups = useMemo(() => {
    const merged: Record<string, any> = {};

    rawGroups.forEach(group => {
      if (!merged[group.id]) {
        merged[group.id] = { ...group, items: [...group.items] };
      } else {
        // Merge items and avoid duplicates by ID
        const existingIds = new Set(merged[group.id].items.map((i: any) => i.id));
        group.items.forEach(item => {
          if (!existingIds.has(item.id)) {
            merged[group.id].items.push(item);
          }
        });
      }
    });

    // Define canonical order for groups
    const userRole = String(user?.role || '').toUpperCase();
    const order = userRole === 'MANAGER'
      ? ['overview', 'production', 'inventory', 'team', 'reports']
      : ['overview', 'production', 'team', 'inventory', 'reports', 'system'];

    return Object.values(merged).sort((a, b) => {
      const idxA = order.indexOf(a.id);
      const idxB = order.indexOf(b.id);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }, [rawGroups]);

  const filterByRole = (allowedRoles?: string[]) => {
    if (!allowedRoles || allowedRoles.length === 0) return true;
    const userRoles = user?.roles || (user?.role ? [user.role] : []);
    return allowedRoles.some(role => userRoles.includes(role));
  };

  const getModulePath = (path: string) => {
    // Only /line or /operator (operator workflows) should stay top-level/external
    const isTopLevelWorkflow =
      path === '/line' ||
      path.startsWith('/line/') ||
      path === '/operator' ||
      path.startsWith('/operator/');

    if (isTopLevelWorkflow) return path;

    const userRole = String(user?.role || '').toUpperCase();
    const base = (userRole === 'MANAGER') ? '/manager' : '/admin';
    return `${base}${path}`;
  };

  return (
    <div className="flex h-screen bg-[#FDFDFD]">
      <CommandPalette />
      <IOSInstallPrompt isOpen={showIOSPrompt} onClose={dismissIOSPrompt} />

      {/* Mobile Sidebar Backdrop Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "bg-slate-900 transition-all duration-300 ease-in-out flex flex-col z-40 fixed md:relative inset-y-0 left-0 h-full",
        isSidebarOpen
          ? "w-72 translate-x-0"
          : "w-72 -translate-x-full md:w-20 md:translate-x-0"
      )}>
        <div className="h-24 flex items-center px-0">
          <div className="w-20 h-16 rounded-2xl flex items-center justify-center overflow-hidden shrink-0">
            <img src="/fav-nobg.png" alt="Eranad logo" className="h-full w-full object-contain" />
          </div>
          {isSidebarOpen && (
            <div className="ml-4 animate-in fade-in slide-in-from-left-2 duration-500">
              <span className="block font-black text-xl tracking-tight text-white">ERANAD<span className="text-[#A7F3D0]">MES</span></span>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">System</span>
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 py-8 space-y-7 overflow-y-auto no-scrollbar scroll-smooth">
          {sidebarGroups.filter(g => filterByRole(g.allowedRoles)).map((group) => {
            const userRole = String(user?.role || '').toUpperCase();
            const filteredItems = group.items.filter((i: any) => {
              const roleAllowed = filterByRole(i.allowedRoles);
              if (userRole === 'MANAGER' && i.isComingSoon) return false;
              return roleAllowed;
            });
            if (filteredItems.length === 0) return null;

            return (
              <div key={group.id} className="space-y-2">
                {isSidebarOpen && (
                  <h3 className="px-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-3">
                    {group.label}
                  </h3>
                )}
                <div className="space-y-1">
                  {filteredItems.map((item: any, idx: number) => {
                    const Icon = item.icon;
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                      >
                        <NavLink
                          to={getModulePath(item.path)}
                          className={({ isActive }) => `
                            w-full flex items-center py-3.5 rounded-2xl transition-all duration-300 group relative
                            ${isSidebarOpen ? 'px-5' : 'justify-center'}
                            ${isActive
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
                              : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}
                          `}
                        >
                          {({ isActive }) => (
                            <>
                              <Icon className={cn(
                                "w-5 h-5 flex-shrink-0 transition-all duration-300",
                                isActive ? "scale-110" : "group-hover:scale-110 group-hover:text-indigo-400"
                              )} />
                              {isSidebarOpen && (
                                <span className={cn(
                                  "ml-4 font-bold text-[13px] tracking-tight truncate flex-1",
                                  isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                                )}>
                                  {item.label}
                                </span>
                              )}
                              {item.isComingSoon && isSidebarOpen && (
                                <span className="ml-auto text-[7px] font-black bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-md uppercase tracking-tighter border border-white/5">Soon</span>
                              )}
                              {isActive && (
                                <motion.div
                                  layoutId="active-indicator"
                                  className="absolute left-0 w-1.5 h-6 bg-white rounded-r-full shadow-[0_0_10px_white]"
                                />
                              )}
                            </>
                          )}
                        </NavLink>
                      </motion.div>
                    );
                  })}
                </div>
                {isSidebarOpen && <div className="h-px bg-white/5 mx-4 mt-6 opacity-50" />}
              </div>
            );
          })}
        </nav>

        <div className="p-4 bg-slate-950/30 space-y-2">
          {/* Install prompt button for non-iOS browsers supporting beforeinstallprompt */}
          {!isIOS && installPrompt && (
            <button
              onClick={installApp}
              className={`w-full flex items-center py-3 rounded-2xl bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 transition-colors border border-indigo-500/20 ${isSidebarOpen ? 'px-4' : 'justify-center'}`}
            >
              <Command className="w-5 h-5 flex-shrink-0" />
              {isSidebarOpen && <span className="ml-4 font-bold text-sm truncate animate-in fade-in slide-in-from-left-2">Install System</span>}
            </button>
          )}

          {/* Install guidance button for iOS devices */}
          {isIOS && !isInstalled && (
            <button
              onClick={triggerIOSPrompt}
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
        <header className="h-24 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-4 sm:px-6 md:px-10 z-20">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-500 transition-all active:scale-90"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {user?.role === 'MANAGER' ? 'Operations Center' : 'Executive Control'}
              </h1>
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
                    src={user?.avatarUrl || `https://ui-avatars.com/api/?name=${user?.name}&background=1A9A91&color=fff&bold=true`}
                    alt="Avatar"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        <div id="main-scroll-container" className="flex-1 overflow-y-auto bg-[#FAFBFF] p-4 sm:p-6 md:p-10 relative custom-scrollbar">
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
        <QuickNotes />
      </main>
    </div>
  );
}


