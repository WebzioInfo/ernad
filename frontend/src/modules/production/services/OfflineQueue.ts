import { api } from '../../../services/api-client';
import { toast } from 'sonner';
import { ENDPOINTS } from '../../../constants/endpoints';

const QUEUE_KEY = 'ernad_offline_telemetry_queue';

export interface QueuedTelemetry {
  id: string;
  payload: any;
  timestamp: number;
}

export class OfflineQueueService {
  static getQueue(): QueuedTelemetry[] {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  static enqueue(payload: any) {
    const queue = this.getQueue();
    const item: QueuedTelemetry = {
      id: payload.requestId || crypto.randomUUID(),
      payload,
      timestamp: Date.now()
    };
    
    queue.push(item);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    
    // Optional Event Dispatch for UI indicators
    window.dispatchEvent(new CustomEvent('telemetry-queued', { detail: queue.length }));
  }

  static async syncQueue() {
    const queue = this.getQueue();
    if (queue.length === 0) return;

    if (!navigator.onLine) return; // Still offline

    let successCount = 0;
    const remainingQueue = [...queue];

    for (const item of queue) {
      try {
        await api.post(ENDPOINTS.TELEMETRY.LOGS, item.payload);
        // Remove from remaining queue on success
        const index = remainingQueue.findIndex(q => q.id === item.id);
        if (index > -1) remainingQueue.splice(index, 1);
        successCount++;
      } catch (error: any) {
        // If it's a validation error (400), we probably shouldn't retry it forever
        if (error.response && error.response.status === 400) {
          const index = remainingQueue.findIndex(q => q.id === item.id);
          if (index > -1) remainingQueue.splice(index, 1);
          console.error('Dropped invalid offline payload:', item.payload);
        }
        // Otherwise, keep it in the queue for later retry
      }
    }

    localStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));
    window.dispatchEvent(new CustomEvent('telemetry-queued', { detail: remainingQueue.length }));

    if (successCount > 0) {
      toast.success(`Synchronized ${successCount} offline logs successfully.`);
    }
  }
  
  static clear() {
    localStorage.removeItem(QUEUE_KEY);
    window.dispatchEvent(new CustomEvent('telemetry-queued', { detail: 0 }));
  }
}
