import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api-client';
import { io } from 'socket.io-client';
import Pusher from 'pusher-js';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY;
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER;

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications/unread');
      return res.data;
    },
    refetchInterval: 30000,
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  useEffect(() => {
    let socket: any = null;
    let pusher: Pusher | null = null;

    const handleNewNotification = () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    if (PUSHER_KEY) {
      pusher = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER || 'ap2' });
      const channel = pusher.subscribe('managers');
      channel.bind('NEW_NOTIFICATION', handleNewNotification);
    } else {
      socket = io(`${SOCKET_URL}/production`);
      socket.on('NEW_NOTIFICATION', handleNewNotification);
    }

    return () => {
      if (pusher) pusher.unsubscribe('managers');
      if (socket) socket.disconnect();
    };
  }, [queryClient]);

  const unreadCount = notifications.length;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 relative group active:scale-95"
      >
        <Bell className="w-5 h-5 group-hover:rotate-12 transition-transform" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow-sm animate-pulse"></span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop for closing */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          
          <div className="absolute right-0 mt-4 w-[360px] bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-white overflow-hidden z-50 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200">
            <div className="px-6 py-5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-black text-slate-900 tracking-tight text-lg">Notifications</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Real-time Updates</p>
              </div>
              {unreadCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-500/20">
                  <span className="text-[10px] font-black uppercase">{unreadCount} New</span>
                </div>
              )}
            </div>
            
            <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-emerald-100/50">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">All caught up!</h4>
                  <p className="text-xs text-slate-500 mt-1">No new alerts to show right now.</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {notifications.map((notif: any) => (
                    <div 
                      key={notif.id} 
                      className="group p-4 rounded-2xl hover:bg-slate-50/80 cursor-pointer flex gap-4 transition-all duration-200 border border-transparent hover:border-slate-100"
                      onClick={() => markAsRead.mutate(notif.id)}
                    >
                      <div className={`mt-0.5 flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                        notif.severity === 'CRITICAL' 
                          ? 'bg-red-50 text-red-500 border border-red-100' 
                          : notif.severity === 'WARNING' 
                            ? 'bg-amber-50 text-amber-500 border border-amber-100' 
                            : 'bg-blue-50 text-blue-500 border border-blue-100'
                      }`}>
                        {notif.severity === 'CRITICAL' ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-sm font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{notif.title}</h4>
                          <span className="text-[9px] font-black text-slate-400 tabular-nums uppercase">
                            {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed font-medium line-clamp-2">{notif.message}</p>
                        
                        <div className="mt-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter flex items-center gap-1">
                            Click to dismiss <div className="w-1 h-1 rounded-full bg-blue-600" />
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 bg-slate-50/50 border-t border-slate-100">
               <button className="w-full py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-900 transition-colors">
                 View All Activity
               </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
