import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Pusher from 'pusher-js';

const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY || 'c9cd65cc0ed26c24ff13';
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER || 'ap2';

let pusher: Pusher | null = null;

export const useWebSocket = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // ── Pusher-Only Realtime (Enterprise Standard) ──
    if (!pusher) {
      pusher = new Pusher(PUSHER_KEY, {
        cluster: PUSHER_CLUSTER,
      });
      console.log('[Realtime] Pusher Engine Active');
    }

    const handleUpdate = (data: any) => {
      console.log('[Realtime] Global Signal:', data);
      
      // Atomic Invalidations
      queryClient.invalidateQueries({ queryKey: ['production-lines'] });
      queryClient.invalidateQueries({ queryKey: ['active-batch'] });
      queryClient.invalidateQueries({ queryKey: ['line-performance-detail'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['station-log-history'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    };

    const channel = pusher.subscribe('managers');
    channel.bind('PRODUCTION_UPDATED', handleUpdate);
    channel.bind('global_log_update', handleUpdate);
    channel.bind('NEW_NOTIFICATION', (notif: any) => {
       console.log('[Realtime] New Notification:', notif);
       queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    return () => {
      if (pusher) {
        pusher.unsubscribe('managers');
      }
    };
  }, [queryClient]);
};
