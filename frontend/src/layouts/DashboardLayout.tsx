import { useState, useEffect } from 'react';
import {
  BarChart3, Settings, Users, Activity,
  Package, LayoutDashboard, Bell, Search,
  Menu, X, LogOut, Globe, Command,
  UserCog, Sparkles, ClipboardList, ShieldCheck
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import { useNavigate, NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import NotificationPermissionModal from '../components/NotificationPermissionModal';
import NotificationBell from '../components/NotificationBell';

export default function DashboardLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  const { data: lines } = useQuery({ queryKey: ['lines'], queryFn: async () => (await api.get('/master-data/lines')).data });

  const showFilters = [
    '/admin/overview', '/admin/analytics', '/admin/production',
    '/manager/overview', '/manager/production'
  ].includes(location.pathname);

  const filters = {
    lineId: searchParams.get('lineId') || '',
    brandId: searchParams.get('brandId') || 'all',
    productId: searchParams.get('productId') || 'all',
    shiftId: searchParams.get('shiftId') || 'all'
  };

  const setFilters = (newFilters: any) => {
    const updated = { ...filters, ...newFilters };
    const params: any = {};
    if (updated.lineId) params.lineId = updated.lineId;
    if (updated.brandId !== 'all') params.brandId = updated.brandId;
    if (updated.productId !== 'all') params.productId = updated.productId;
    if (updated.shiftId !== 'all') params.shiftId = updated.shiftId;
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

  useEffect(() => {
    // Only auto-select line if specifically requested or on pages that require a focus
    // We removed automatic selection for /admin/production to keep URL clean as requested
  }, [lines, filters.lineId, showFilters, location.pathname, user?.role]);

  const getModulePath = (id: string) => {
    if (id === 'terminal') return '/line/select';
    
    const base = (user?.role === 'MANAGER') ? '/manager' : '/admin';
    return `${base}/${id}`;
  };

  const SUPER_ADMIN_MENU = [
    { id: 'overview', label: 'Overview', icon: Globe, path: '/admin/overview' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
    { id: 'production', label: 'Lines', icon: Activity, path: '/admin/production' },
    { id: 'users', label: 'Users', icon: ShieldCheck, path: '/admin/users' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/admin/settings' },
    { id: 'audit', label: 'Logs', icon: ClipboardList, path: '/admin/audit' },
  ];

  const ADMIN_MENU = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/admin/overview' },
    { id: 'production', label: 'Production', icon: Activity, path: '/admin/production' },
    { id: 'quality', label: 'Quality', icon: Bell, path: '/admin/quality' },
    { id: 'inventory', label: 'Inventory', icon: Package, path: '/admin/inventory' },
    { id: 'users', label: 'Users', icon: UserCog, path: '/admin/users' },
    { id: 'ai-advices', label: 'AI Tips', icon: Sparkles, path: '/admin/ai-advices', isComingSoon: true },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/admin/settings' },
  ];

  const MANAGER_MENU = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/manager/overview' },
    { id: 'production', label: 'Production', icon: Activity, path: '/manager/production' },
    { id: 'inventory', label: 'Inventory', icon: Package, path: '/manager/inventory' },
    { id: 'users', label: 'Users', icon: Users, path: '/manager/users' },
  ];

  const getMenuItems = () => {
    if (user?.role === 'SUPER_ADMIN') return SUPER_ADMIN_MENU;
    if (user?.role === 'ADMIN') return ADMIN_MENU;
    if (user?.role === 'MANAGER') return MANAGER_MENU;
    return [{ id: 'terminal', label: 'Terminal', icon: Command, path: '/line/select' }];
  };

  const filteredMenuItems = getMenuItems();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-[#FDFDFD]">
      <NotificationPermissionModal />

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
              <span className="block font-black text-xl tracking-tight text-white">ERNAD<span className="text-indigo-400">MES</span></span>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">System</span>
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 py-8 space-y-1.5 overflow-y-auto no-scrollbar">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.id}
                to={getModulePath(item.id)}
                className={({ isActive }) => `
                  w-full flex items-center py-3.5 rounded-2xl transition-all duration-200 group
                  ${isSidebarOpen ? 'px-4' : 'justify-center'}
                  ${isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                `}
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                    {isSidebarOpen && (
                      <span className="ml-4 font-bold text-sm tracking-tight truncate animate-in fade-in slide-in-from-left-2">{item.label}</span>
                    )}
                    {isActive && isSidebarOpen && (
                      <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full flex-shrink-0" />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 bg-slate-950/30">
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
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Control Panel</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                <Globe className="w-3 h-3" /> Status: OK
              </p>
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

        {/* Viewport Area */}
        <div className="flex-1 overflow-y-auto bg-[#FAFBFF] p-10">
          <div className="max-w-[1700px] mx-auto">

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 fill-mode-both">
              <Outlet context={{ filters, setFilters }} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}


