import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

// Default to same origin if not set
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let socket: Socket | null = null;

export const useWebSocket = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) {
      socket = io(`${SOCKET_URL}/production`, {
        transports: ['websocket'],
      });

      socket.on('connect', () => {
        console.log('Connected to Production WebSocket');
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from Production WebSocket');
      });
    }

    // Listener for real-time production updates
    const handleProductionUpdate = (data: any) => {
      console.log('Real-time production update received:', data);
      // Invalidate AI stats, line performance, etc.
      queryClient.invalidateQueries({ queryKey: ['aiStats'] });
      queryClient.invalidateQueries({ queryKey: ['lines'] });
    };

    socket.on('PRODUCTION_UPDATED', handleProductionUpdate);

    return () => {
      if (socket) {
        socket.off('PRODUCTION_UPDATED', handleProductionUpdate);
      }
    };
  }, [queryClient]);
};
