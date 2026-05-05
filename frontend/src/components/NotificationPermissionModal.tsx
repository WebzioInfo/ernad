import { useState, useEffect } from 'react';
import { Bell, Shield, X } from 'lucide-react';
import OneSignal from 'react-onesignal';

export default function NotificationPermissionModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const checkPermission = async () => {
      // Small delay to not annoy user immediately
      setTimeout(() => {
        const permission = Notification.permission;
        if (permission === 'default') {
          setShow(true);
        }
      }, 3000);
    };
    checkPermission();
  }, []);

  const handleRequest = async () => {
    try {
      // OneSignal requires HTTPS to function correctly. 
      // On localhost, we skip the real request to avoid silent failures.
      if (window.location.protocol === 'https:') {
        await OneSignal.Notifications.requestPermission();
      } else {
        console.info('[OneSignal] Skipping permission request on non-HTTPS environment (localhost).');
      }
      setShow(false);
    } catch (err) {
      console.error('Permission request failed:', err);
      setShow(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-8 right-8 z-[100] animate-in slide-in-from-bottom-10 duration-500">
      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 max-w-md w-full overflow-hidden relative group">
        {/* Decorative background */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-40 h-40 bg-blue-50 rounded-full blur-3xl group-hover:bg-blue-100 transition-colors duration-700" />
        
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-blue-200">
              <Bell className="w-7 h-7" />
            </div>
            <button 
              onClick={() => setShow(false)}
              className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-3">Stay in the Loop</h3>
          <p className="text-slate-500 font-medium leading-relaxed mb-8">
            Enable notifications to receive real-time alerts about batch completions, material shortages, and system events.
          </p>

          <div className="space-y-4">
            <button 
              onClick={handleRequest}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 group/btn"
            >
              Enable Notifications
              <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={() => setShow(false)}
              className="w-full py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all"
            >
              Maybe Later
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-50 flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Secure & Non-Intrusive System Alerts
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m9 18 6-6-6-6"/></svg>
  );
}
