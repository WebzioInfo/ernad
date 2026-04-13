import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Settings, Users, Activity, LogOut, CheckCircle2, AlertTriangle, XCircle, Play, Pause } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [lines, setLines] = useState([
    { id: '1', name: 'Line 1 (2L)', status: 'RUNNING', efficiency: 94, bottles: 14500, rejected: 120 },
    { id: '2', name: 'Line 2 (500ml)', status: 'CHANGEOVER', efficiency: 0, bottles: 0, rejected: 0 }
  ]);

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'RUNNING') return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    if (status === 'CHANGEOVER') return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    return <XCircle className="w-5 h-5 text-rose-500" />;
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-2xl z-20">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            ERNAD MES
          </h2>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Production System</p>
        </div>
        <nav className="flex-1 py-4">
          <ul className="space-y-1 px-3">
            {[
              { name: 'Live Dashboard', icon: LayoutDashboard, active: true },
              { name: 'Reports', icon: FileText },
              { name: 'Material Flow', icon: Activity },
              { name: 'Settings', icon: Settings },
              { name: 'Users', icon: Users },
            ].map((item) => (
              <li key={item.name}>
                <button
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    item.active
                      ? 'bg-blue-600/10 text-blue-400 font-medium'
                      : 'hover:bg-slate-800/50 hover:text-slate-100'
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${item.active ? 'text-blue-500' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button 
            type="button"
            onClick={() => {
              useAuthStore.getState().logout();
              navigate('/login', { replace: true });
            }}
            className="flex items-center space-x-3 px-4 py-2 w-full text-left text-slate-400 hover:text-rose-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-5 flex justify-between items-center z-10 sticky top-0">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Live Dashboard</h1>
            <p className="text-sm text-slate-500">Real-time production monitoring</p>
          </div>
          <div className="flex items-center space-x-4 bg-slate-100 px-4 py-2 rounded-full border border-slate-200">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-medium text-slate-600">Shift 1 • Manager: John Doe</span>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-8">
          
          {/* Lines Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {lines.map(line => (
              <div 
                key={line.id} 
                className={`bg-white rounded-2xl p-6 shadow-sm border border-slate-200 transition-all hover:shadow-md ${
                  line.status === 'RUNNING' ? 'border-t-4 border-t-emerald-500' : 
                  line.status === 'CHANGEOVER' ? 'border-t-4 border-t-amber-500' : 
                  'border-t-4 border-t-rose-500'
                }`}
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">{line.name}</h2>
                    <p className="text-sm text-slate-500 mt-1">Current Status</p>
                  </div>
                  <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                    line.status === 'RUNNING' ? 'bg-emerald-100 text-emerald-700' : 
                    line.status === 'CHANGEOVER' ? 'bg-amber-100 text-amber-700' : 
                    'bg-rose-100 text-rose-700'
                  }`}>
                    <StatusIcon status={line.status} />
                    <span>{line.status}</span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <span className="text-sm text-slate-500 font-medium block mb-1">Efficiency</span>
                    <span className="text-3xl font-extrabold text-slate-800">{line.efficiency}%</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <span className="text-sm text-slate-500 font-medium block mb-1">Produced</span>
                    <span className="text-3xl font-extrabold text-blue-600">{line.bottles.toLocaleString()}</span>
                  </div>
                  <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
                    <span className="text-sm text-rose-600 font-medium block mb-1">Rejected</span>
                    <span className="text-3xl font-extrabold text-rose-600">{line.rejected}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  {line.status === 'RUNNING' && (
                    <button className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-medium py-2.5 rounded-lg transition-colors flex justify-center items-center space-x-2">
                       <Pause className="w-4 h-4" /> <span>Initiate Changeover</span>
                    </button>
                  )}
                  {line.status === 'CHANGEOVER' && (
                    <button className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2.5 rounded-lg transition-colors flex justify-center items-center space-x-2">
                       <Play className="w-4 h-4" /> <span>Resume Production</span>
                    </button>
                  )}
                  <button className="flex-none bg-rose-100 hover:bg-rose-200 text-rose-700 font-medium px-6 py-2.5 rounded-lg transition-colors">
                    Stop Line
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Logs Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">Recent Anomalies & System Logs</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 uppercase text-xs tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Time</th>
                    <th className="px-6 py-4">Source</th>
                    <th className="px-6 py-4">Event</th>
                    <th className="px-6 py-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">10:42 AM</td>
                    <td className="px-6 py-4 font-medium text-slate-800">Line 1 / Filling</td>
                    <td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">High Wastage Flag</span></td>
                    <td className="px-6 py-4">50 Caps rejected in last 5 mins</td>
                  </tr>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">10:30 AM</td>
                    <td className="px-6 py-4 font-medium text-slate-800">System / Tally</td>
                    <td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Stock Mismatch</span></td>
                    <td className="px-6 py-4">Tally shows -50 2L Preforms vs System</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
