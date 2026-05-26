import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Command, 
  Settings, 
  Users, 
  Activity, 
  Package, 
  ShieldCheck,
  Zap,
  ArrowRight
} from 'lucide-react';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const ACTIONS = [
    { id: 'prod', name: 'Production Commander', icon: Activity, path: '/production', category: 'Operations' },
    { id: 'staff', name: 'Personnel Directory', icon: Users, path: '/personnel/staff', category: 'Management' },
    { id: 'products', name: 'Products Database', icon: Package, path: '/products', category: 'Logistics' },
    { id: 'raw-materials', name: 'Raw Materials Database', icon: Package, path: '/raw-materials', category: 'Logistics' },
    { id: 'audit', name: 'System Security Audit', icon: ShieldCheck, path: '/personnel/users', category: 'Admin' },
    { id: 'settings', name: 'Factory Configuration', icon: Settings, path: '/settings', category: 'Admin' },
  ];

  const filteredActions = query === '' 
    ? ACTIONS 
    : ACTIONS.filter(a => a.name.toLowerCase().includes(query.toLowerCase()));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-start justify-center pt-[15vh] p-4 animate-in fade-in duration-300">
      <div 
        className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-top-4 duration-500 border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-6 border-b border-slate-50 bg-slate-50/50">
          <Search className="absolute left-10 top-1/2 -translate-y-1/2 w-6 h-6 text-indigo-500" />
          <input 
            autoFocus
            type="text"
            placeholder="Search commands, pages, and actions..."
            className="w-full bg-white border border-slate-200 rounded-2xl pl-14 pr-6 py-5 text-lg font-bold text-slate-800 focus:ring-4 focus:ring-indigo-50 transition-all outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <span className="px-2 py-1 bg-slate-100 text-slate-400 rounded-lg text-[10px] font-black">ESC</span>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-4 space-y-6">
           {filteredActions.length > 0 ? (
             <div>
               <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Quick Navigation</p>
               <div className="space-y-1">
                 {filteredActions.map((action) => (
                   <button
                     key={action.id}
                     onClick={() => {
                        navigate(action.path);
                        setIsOpen(false);
                     }}
                     className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-indigo-50 group transition-all text-left"
                   >
                     <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-indigo-600 transition-all">
                         <action.icon className="w-5 h-5" />
                       </div>
                       <div>
                         <p className="text-sm font-black text-slate-700 group-hover:text-indigo-900">{action.name}</p>
                         <p className="text-[10px] font-bold text-slate-400">{action.category}</p>
                       </div>
                     </div>
                     <ArrowRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                   </button>
                 ))}
               </div>
             </div>
           ) : (
             <div className="p-12 text-center">
               <Zap className="w-12 h-12 text-slate-200 mx-auto mb-4" />
               <p className="text-sm font-bold text-slate-400">No results found for "{query}"</p>
             </div>
           )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                 <Command className="w-3 h-3 text-slate-400" />
                 <span className="text-[10px] font-black text-slate-400 uppercase">K</span>
              </div>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Global Search Enabled</span>
           </div>
           <button onClick={() => setIsOpen(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Close</button>
        </div>
      </div>
      <div className="absolute inset-0 -z-10" onClick={() => setIsOpen(false)} />
    </div>
  );
}
