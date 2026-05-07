import { Component, ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: any) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-full flex items-center justify-center bg-slate-50 p-10">
          <div className="max-w-md text-center bg-white p-12 rounded-[3rem] shadow-2xl border border-rose-100">
            <div className="w-20 h-20 bg-rose-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
              <ShieldAlert className="w-10 h-10 text-rose-500" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-4">Module Loading Failed</h2>
            <p className="text-slate-500 font-bold mb-10 leading-relaxed">The manufacturing module could not be initialized due to a network or deployment error. This is often caused by a 403 Forbidden state on assets.</p>
            <button onClick={() => window.location.reload()} className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl shadow-indigo-100">
              Force Re-Initialize
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
