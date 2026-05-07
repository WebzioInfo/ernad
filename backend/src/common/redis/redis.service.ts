import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

@Injectable()
export class RedisService implements OnModuleInit {
  private readonly logger = new Logger('RedisService');
  private client: Redis | null = null;
  private isAvailable = false;
  private memoryFallback = new Map<string, any>();

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const url = this.configService.get('UPSTASH_REDIS_REST_URL') || this.configService.get('REDIS_URL');
    const token = this.configService.get('UPSTASH_REDIS_REST_TOKEN');

    if (!url || !token) {
      // Check if we can extract from REDIS_URL (legacy/compatibility)
      if (url && url.startsWith('rediss://') && !token) {
         this.logger.warn('⚠️ Upstash REST Token missing. Attempting TCP fallback (ioredis).');
         // We might need to keep ioredis as a fallback, but user specifically asked for REST use.
      }
      
      this.logger.log('🕒 Upstash REST not fully configured. Using Memory Fallback.');
      this.isAvailable = false;
      return;
    }

    try {
      this.client = new Redis({
        url: url.startsWith('http') ? url : `https://${url.split('@')[1]?.split(':')[0]}`, // Smart extract if URL is TCP format
        token: token,
      });

      // Verify connection (Ping)
      await this.client.ping();
      this.isAvailable = true;
      this.logger.log('🚀 Upstash REST Redis connected successfully.');
    } catch (err: any) {
      this.logger.error(`Upstash REST Initialization Failed: ${err.message}`);
      this.isAvailable = false;
    }
  }

  getAvailability() {
    return this.isAvailable;
  }

  // --- Resilient API ---

  async set(key: string, value: string, mode?: 'EX', duration?: number) {
    if (this.isAvailable && this.client) {
      try {
        if (mode === 'EX' && duration) {
          return await this.client.set(key, value, { ex: duration });
        }
        return await this.client.set(key, value);
      } catch (err) {
        this.isAvailable = false;
      }
    }
    this.memoryFallback.set(key, value);
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    if (this.isAvailable && this.client) {
      try {
        const val = await this.client.get(key);
        return typeof val === 'string' ? val : JSON.stringify(val);
      } catch {
        this.isAvailable = false;
      }
    }
    return this.memoryFallback.get(key) || null;
  }

  async del(key: string) {
    if (this.isAvailable && this.client) {
      try {
        return await this.client.del(key);
      } catch {
        this.isAvailable = false;
      }
    }
    this.memoryFallback.delete(key);
    return 1;
  }

  // --- Specialized MES Methods ---

  async incrementCounter(batchId: string, station: string, amount: number) {
    const field = station.toLowerCase();
    const key = `batch:totals:${batchId}`;
    
    if (this.isAvailable && this.client) {
      try {
        return await this.client.hincrby(key, field, amount);
      } catch (err) {
        this.isAvailable = false;
      }
    }

    // Memory Fallback Logic
    const current = this.memoryFallback.get(key) || {};
    const newValue = (Number(current[field]) || 0) + amount;
    const updated = { ...current, [field]: newValue };
    this.memoryFallback.set(key, updated);
    return newValue;
  }

  async getBatchTotals(batchId: string) {
    const key = `batch:totals:${batchId}`;
    if (this.isAvailable && this.client) {
      try {
        const totals = await this.client.hgetall(key);
        if (totals && Object.keys(totals).length > 0) return totals;
      } catch {
        this.isAvailable = false;
      }
    }
    return this.memoryFallback.get(key) || {};
  }

  async setBatchTotals(batchId: string, totals: Record<string, number>) {
    const key = `batch:totals:${batchId}`;
    if (this.isAvailable && this.client) {
      try {
        return await this.client.hset(key, totals);
      } catch {
        this.isAvailable = false;
      }
    }
    this.memoryFallback.set(key, totals);
    return 'OK';
  }
}
