import React, { useState } from 'react';
import { 
  BarChart3, Settings, Users, Activity, 
  Package, LayoutDashboard, Bell, Search, 
  Menu, X, LogOut, ChevronRight
} from 'lucide-react';
import useAuthStore from '../../../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function DashboardLayout({ children, activeTab, setActiveTab }: DashboardLayoutProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'analytics', label: 'Efficiency & OEE', icon: BarChart3 },
    { id: 'production', label: 'Production Control', icon: Activity },
    { id: 'inventory', label: 'Material Usage', icon: Package },
    { id: 'users', label: 'Workforce', icon: Users },
    { id: 'settings', label: 'Factory Settings', icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside className={`
        ${isSidebarOpen ? 'w-72' : 'w-20'} 
        bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-20
      `}>
        <div className="h-20 flex items-center px-6 border-b border-slate-50">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-blue-200">
            E
          </div>
          {isSidebarOpen && (
            <span className="ml-3 font-black text-xl tracking-tighter text-slate-900">ERNAD<span className="text-blue-600">MES</span></span>
          )}
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`
                  w-full flex items-center px-4 py-3.5 rounded-2xl transition-all group
                  ${isActive 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}
                `}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-900'}`} />
                {isSidebarOpen && (
                  <span className="ml-4 font-bold text-sm tracking-tight">{item.label}</span>
                )}
                {isActive && isSidebarOpen && (
                  <ChevronRight className="ml-auto w-4 h-4 text-blue-600" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-50">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 rounded-2xl text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            {isSidebarOpen && <span className="ml-4 font-bold text-sm">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 z-10">
          <div className="flex items-center gap-4">
             <button 
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-50 rounded-xl text-slate-500 transition-colors"
             >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
             </button>
             <h1 className="text-xl font-black text-slate-900 tracking-tight capitalize">{activeTab.replace('-', ' ')}</h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search factory data..." 
                className="bg-slate-50 border-none rounded-2xl pl-10 pr-4 py-2.5 text-sm w-64 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
              />
            </div>
            
            <button className="relative p-2.5 text-slate-500 hover:bg-slate-50 rounded-2xl transition-all">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>

            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900 leading-tight">{user?.name}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{user?.role}</p>
              </div>
              <div className="w-10 h-10 bg-slate-100 rounded-2xl border-2 border-white shadow-sm overflow-hidden">
                <img 
                  src={user?.avatarUrl || `https://ui-avatars.com/api/?name=${user?.name}&background=6366f1&color=fff&bold=true`} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-10">
          <div className="max-w-[1600px] mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
