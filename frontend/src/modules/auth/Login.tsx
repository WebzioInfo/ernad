import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  User, Loader2, ArrowRight, KeyRound, Eye, EyeOff
} from 'lucide-react';
import { api } from '../../services/api-client';
import useAuthStore from './auth.store';
import { toast } from 'sonner';
import { ENDPOINTS } from '../../constants/endpoints';
import Watermark from '../../components/Watermark';

export default function Login() {
  const { isAuthenticated, user, setAuth } = useAuthStore();
  const [identity, setIdentity] = useState('');
  const [credential, setCredential] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // Redirect if already authenticated
  if (isAuthenticated) {
    const userRoles = (user?.roles || (user?.role ? [user.role] : [])).map((role: string) => role.toUpperCase());
    const isOperator = userRoles.includes('OPERATOR');
    const isManager = userRoles.includes('MANAGER');
    const isAccountant = userRoles.includes('ACCOUNTANT');

    if (isManager) return <Navigate to="/manager/overview" replace />;
    if (isAccountant) return <Navigate to="/accountant" replace />;
    if (isOperator) return <Navigate to="/line/select" replace />;
    return <Navigate to="/admin/overview" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Intelligent Auto-Detection Flow (No "Type" toggle needed)
      // Added trimming and type hint to match Swagger behavior
      const trimmedIdentity = identity.trim();
      const detectedType = credential.length <= 6 && /^\d+$/.test(credential) ? 'PIN' : 'PASSWORD';
      
      const res = await api.post(ENDPOINTS.AUTH.LOGIN, { 
        identity: trimmedIdentity, 
        credential,
        type: detectedType
      });
      setAuth(res.data.access_token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.name.split(' ')[0]}`);

      const userRoles = (res.data.user.roles || (res.data.user.role ? [res.data.user.role] : [])).map((role: string) => role.toUpperCase());
      if (userRoles.includes('ADMIN')) navigate('/admin');
      else if (userRoles.includes('MANAGER')) navigate('/manager');
      else if (userRoles.includes('ACCOUNTANT')) navigate('/accountant');
      else if (userRoles.includes('OPERATOR')) navigate('/operator/select');
      else navigate('/admin'); // Fallback
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
              <div className="h-24 w-40 flex items-center justify-center overflow-hidden">
                <img src="/fav-nobg.png" alt="Eranad logo" className="h-full w-full object-contain" />
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
                  type={showPassword ? "text" : "password"}
                  required
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  autoComplete="current-password"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 pl-12 pr-12 py-3.5 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Forgot Password?
                </button>
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

