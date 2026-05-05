import { Construction, Sparkles, Clock, Globe, ShieldAlert } from 'lucide-react';

interface ComingSoonPageProps {
  title: string;
  description: string;
  icon?: any;
}

export default function ComingSoonPage({ title, description, icon: Icon = Construction }: ComingSoonPageProps) {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-10 animate-in fade-in zoom-in duration-700">
      <div className="relative mb-12">
        <div className="w-32 h-32 bg-slate-100 rounded-[3rem] flex items-center justify-center shadow-inner">
          <Icon className="w-16 h-16 text-slate-300" />
        </div>
        <div className="absolute -top-4 -right-4 w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-xl animate-bounce">
          <Clock className="w-6 h-6" />
        </div>
        <div className="absolute -bottom-2 -left-2 w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg animate-pulse">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
      </div>

      <div className="text-center max-w-md">
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-4">{title}</h2>
        <p className="text-slate-500 font-medium leading-relaxed">
          {description}
        </p>
        
        <div className="mt-12 flex items-center justify-center gap-4 py-4 px-8 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Development In Progress</span>
        </div>

        <div className="mt-20 flex gap-4 opacity-30">
          <Globe className="w-5 h-5 text-slate-400" />
          <ShieldAlert className="w-5 h-5 text-slate-400" />
          <Sparkles className="w-5 h-5 text-slate-400" />
        </div>
      </div>
    </div>
  );
}
