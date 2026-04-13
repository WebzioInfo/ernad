import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import { api } from '../api';
import toast from 'react-hot-toast';
import { Lock, User } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setAuth = useAuthStore((state) => state.setAuth);

  if (isAuthenticated) {
    const role = useAuthStore.getState().user?.role;
    if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER') {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to="/line/1/operator" replace />; // Default operator redirect
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return toast.error('Check username and password');
    
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { username, password });
      const { access_token, user } = response.data;
      setAuth(access_token, user);
      
      toast.success(`Welcome back, ${user.name}`);
      
      if (user.role === 'ADMIN' || user.role === 'MANAGER' || user.role === 'SUPER_ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        // Here we could extract their designated line from their profile if it was available
        navigate('/line/1/operator', { replace: true });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Login Failed. Invalid PIN or operator ID.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-blue-500/30">
      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <h2 className="mt-6 text-center text-4xl font-extrabold text-white tracking-tight">ERNAD MES</h2>
        <p className="mt-2 text-center text-sm text-slate-400 uppercase tracking-widest">Operator & Admin Portal</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="bg-slate-800/80 backdrop-blur-xl py-8 px-4 shadow-[0_0_40px_rgba(37,99,235,0.1)] sm:rounded-3xl sm:px-10 border border-slate-700/50">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-300">
                Operator ID / Username
              </label>
              <div className="mt-2 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toUpperCase())}
                  className="bg-slate-900/50 block w-full pl-10 sm:text-lg border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all border py-3"
                  placeholder="EMP-102"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                Secure PIN
              </label>
              <div className="mt-2 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  inputMode="numeric"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-900/50 block w-full pl-10 sm:text-lg border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all border py-3 tracking-widest"
                  placeholder="••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-500/20 text-lg font-bold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Authenticating...' : 'Access Dashboard'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
