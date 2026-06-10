import Dexie, { Table } from 'dexie';
import axios from 'axios';

export interface OfflineLog {
  id?: number;
  requestId: string;
  batchId: string;
  lineId: string;
  brandId: string;
  productId: string;
  shiftId: string;
  station: string;
  primaryCount: number;
  splitValues: number[];
  wastageCount: number;
  isRework: boolean;
  eventType: string;
  remarks: string;
  materials: any[];
  loggedAt: string;
  synced: number; // 0 = no, 1 = yes
}

export class MESDatabase extends Dexie {
  offlineLogs!: Table<OfflineLog>;

  constructor() {
    super('MESOfflineDB');
    this.version(3).stores({
      offlineLogs: '++id, requestId, synced, batchId, brandId, productId'
    });
  }
}

export const db = new MESDatabase();

export const syncOfflineLogs = async () => {
  const unsynced = await db.offlineLogs.where('synced').equals(0).toArray();

  if (unsynced.length === 0) return;

  // Syncing logs quietly

  for (const log of unsynced) {
    try {
      const baseURL = import.meta.env.VITE_API_URL || 'https://eranadapi.webziointernational.in/api';
      await axios.post(`${baseURL}/telemetry`, log, {
        withCredentials: true,
      });

      await db.offlineLogs.update(log.id!, { synced: 1 });
      // Synced successfully
    } catch (error) {
      console.error(`Failed to sync log ${log.requestId}:`, error);
      break;
    }
  }
};
