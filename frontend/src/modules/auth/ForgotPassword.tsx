import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { api } from '../../services/api-client';
import { toast } from 'sonner';
import Watermark from '../../components/Watermark';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      toast.success(res.data.message || 'Password reset link sent');
      // Do not navigate away immediately, let the user read the success message.
      setEmail('');
    } catch (err: any) {
      // In a real secure system, we still return success message even if email doesn't exist,
      // but in case of server error (500) we can show it:
      toast.error(err.response?.data?.message || 'Failed to request password reset');
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
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Reset Password</h1>
            <p className="text-slate-500 text-sm">Enter your email address and we'll send you a link to reset your password.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">
                Email Address
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                   <Mail className="w-5 h-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 pl-12 pr-4 py-3.5 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-600/20 flex justify-center items-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Send Reset Link <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
            
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors flex items-center justify-center gap-2 mx-auto"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Login
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
