import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Pusher from 'pusher-js';
import { QK } from './useApi';

const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY || 'c9cd65cc0ed26c24ff13';
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER || 'ap2';

let pusher: Pusher | null = null;

export const useWebSocket = (lineId?: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // ── Pusher-Only Realtime (Enterprise Standard) ──
    if (!pusher) {
      pusher = new Pusher(PUSHER_KEY, {
        cluster: PUSHER_CLUSTER,
      });
      console.log('[Realtime] Pusher Engine Active');
      
      // Monitor connection states
      pusher.connection.bind('state_change', (states: { previous: string; current: string }) => {
        console.log(`[Realtime] Connection State Changed: ${states.previous} -> ${states.current}`);
      });
      
      pusher.connection.bind('error', (err: any) => {
        console.error('[Realtime] Connection Error:', err);
      });
    }

    const handleUpdate = (data: any) => {
      console.log('[Realtime] Global/Line Signal:', data);
      
      // Atomic Invalidations
      queryClient.invalidateQueries({ queryKey: QK.LINES });
      queryClient.invalidateQueries({ queryKey: ['active-batch'] });
      queryClient.invalidateQueries({ queryKey: ['line-performance-detail'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: QK.KPIS });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['station-log-history'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['production-logs-all'] });
      queryClient.invalidateQueries({ queryKey: ['production-batches-all'] });
    };

    const handleDataChanged = (data: any) => {
      console.log('[Realtime] Data Signal:', data);

      if (!data?.domain || data.domain === 'inventory') {
        queryClient.invalidateQueries({ queryKey: QK.STOCK });
        queryClient.invalidateQueries({ queryKey: QK.RAW_MATERIALS_STOCK });
        queryClient.invalidateQueries({ queryKey: ['raw-material-ledger'] });
        queryClient.invalidateQueries({ queryKey: QK.PRODUCTION_STOCK });
        queryClient.invalidateQueries({ queryKey: ['product-ledger'] });
      }

      if (!data?.domain || data.domain === 'products') {
        queryClient.invalidateQueries({ queryKey: QK.PRODUCTS });
        queryClient.invalidateQueries({ queryKey: QK.PRODUCTION_STOCK });
        queryClient.invalidateQueries({ queryKey: ['product-ledger'] });
      }

      if (!data?.domain || data.domain === 'users') {
        queryClient.invalidateQueries({ queryKey: QK.USERS });
        queryClient.invalidateQueries({ queryKey: ['attendance'] });
      }

      if (!data?.domain || data.domain === 'incidents') {
        queryClient.invalidateQueries({ queryKey: ['incidents'] });
        queryClient.invalidateQueries({ queryKey: ['incident-analytics'] });
      }
    };

    const channels: { name: string; channel: any }[] = [];

    // Subscribe to global managers channel
    const managersChannel = pusher.subscribe('managers');
    managersChannel.bind('PRODUCTION_UPDATED', handleUpdate);
    managersChannel.bind('global_log_update', handleUpdate);
    managersChannel.bind('DATA_CHANGED', handleDataChanged);
    managersChannel.bind('INVENTORY_UPDATED', handleDataChanged);
    managersChannel.bind('PRODUCTS_UPDATED', handleDataChanged);
    managersChannel.bind('USERS_UPDATED', handleDataChanged);
    managersChannel.bind('INCIDENTS_UPDATED', handleDataChanged);
    channels.push({ name: 'managers', channel: managersChannel });

    // Subscribe to global operators channel
    const operatorsChannel = pusher.subscribe('operators');
    operatorsChannel.bind('NEW_NOTIFICATION', (notif: any) => {
      console.log('[Realtime] New Notification:', notif);
      queryClient.invalidateQueries({ queryKey: QK.NOTIFICATIONS });
    });
    channels.push({ name: 'operators', channel: operatorsChannel });

    // Subscribe to line-specific channel if lineId is active
    if (lineId) {
      const lineChannel = pusher.subscribe(`line_${lineId}`);
      lineChannel.bind('new_log', handleUpdate);
      lineChannel.bind('line_status', handleUpdate);
      lineChannel.bind('efficiency_alert', handleUpdate);
      lineChannel.bind('PRODUCTION_UPDATED', handleUpdate);
      channels.push({ name: `line_${lineId}`, channel: lineChannel });
      console.log(`[Realtime] Subscribed to line_${lineId}`);
    }

    return () => {
      if (pusher) {
        channels.forEach((c) => {
          pusher!.unsubscribe(c.name);
          console.log(`[Realtime] Unsubscribed from ${c.name}`);
        });
      }
    };
  }, [queryClient, lineId]);
};
