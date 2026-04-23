import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, User, Loader2, ArrowRight, KeyRound
} from 'lucide-react';
import { api } from '../api';
import useAuthStore from '../store/useAuthStore';
import toast from 'react-hot-toast';
import Watermark from './Watermark';

export default function Login() {
  const [identity, setIdentity] = useState('');
  const [credential, setCredential] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Intelligent Auto-Detection Flow (No "Type" toggle needed)
      const res = await api.post('/auth/login', { identity, credential });
      setAuth(res.data.access_token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.name.split(' ')[0]}`);

      const role = res.data.user.role;
      if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER') navigate('/admin');
      else navigate(`/line/1/operator`); // Default line for now
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Access Denied: Invalid Identity or Credential');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative font-sans selection:bg-blue-100">
      <Watermark />
      
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl relative z-10 overflow-hidden">
        <div className="p-8 lg:p-10">
          <div className="mb-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-blue-600 rounded-2xl shadow-lg">
                <ShieldCheck className="w-10 h-10 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">System Login</h1>
            <p className="text-slate-500 text-sm">Please enter your Login Details to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">
                Username or Email
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                   <User className="w-5 h-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                  autoComplete="username"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 pl-12 pr-4 py-3.5 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium"
                  placeholder="Enter your identity"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">
                Password or PIN
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                   <KeyRound className="w-5 h-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  autoComplete="current-password"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 pl-12 pr-4 py-3.5 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-600/20 flex justify-center items-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Log In <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <footer className="mt-10 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400 mb-1">A Webzio International Product & Service</p>
            <p className="text-[11px] font-semibold text-slate-500">Built by Webzio Technology</p>
          </footer>
        </div>
      </div>
    </div>
  )
}

