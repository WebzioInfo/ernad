import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import Pusher from 'pusher-js';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY;
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER;

let socket: Socket | null = null;
let pusher: Pusher | null = null;

export const useWebSocket = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // ── Mode 1: Pusher (Production/Vercel) ──
    if (PUSHER_KEY && !pusher) {
      pusher = new Pusher(PUSHER_KEY, {
        cluster: PUSHER_CLUSTER || 'ap2',
      });
      console.log('[Realtime] Pusher Initialized');
    }

    // ── Mode 2: Socket.io (Local Fallback) ──
    if (!PUSHER_KEY && !socket) {
      socket = io(`${SOCKET_URL}/production`);
      socket.on('connect', () => console.log('[Realtime] Socket.io Connected'));
    }

    const handleUpdate = (data: any) => {
      console.log('[Realtime] Update received:', data);
      queryClient.invalidateQueries({ queryKey: ['aiStats'] });
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      queryClient.invalidateQueries({ queryKey: ['batch'] });
    };

    // Bind listeners
    if (pusher) {
      const channel = pusher.subscribe('managers');
      channel.bind('PRODUCTION_UPDATED', handleUpdate);
      channel.bind('global_log_update', handleUpdate);
    }

    if (socket) {
      socket.on('PRODUCTION_UPDATED', handleUpdate);
      socket.on('global_log_update', handleUpdate);
    }

    return () => {
      if (pusher) {
        pusher.unsubscribe('managers');
      }
      if (socket) {
        socket.off('PRODUCTION_UPDATED', handleUpdate);
        socket.off('global_log_update', handleUpdate);
      }
    };
  }, [queryClient]);
};
