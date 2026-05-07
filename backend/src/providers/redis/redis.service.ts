import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('RedisService');
  private client: Redis | null = null;
  private isAvailable = false;
  private memoryFallback = new Map<string, any>();

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get('REDIS_URL');
    const isProduction = process.env.NODE_ENV === 'production';
    const isLocal = redisUrl && (redisUrl.includes('127.0.0.1') || redisUrl.includes('localhost'));

    if (!redisUrl) {
      this.logger.log('🕒 Redis URL not provided. Operating in Memory Fallback mode.');
      this.isAvailable = false;
      return;
    }

    if (isProduction && isLocal) {
      this.logger.warn('🚫 Localhost Redis detected in Production. Bypassing to prevent crash.');
      this.isAvailable = false;
      return;
    }

    try {
      this.client = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 0,
        connectTimeout: 10000,
        disconnectTimeout: 2000,
        commandTimeout: 5000,
        tls: redisUrl.startsWith('rediss://') ? {} : undefined,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.warn(`Redis connection retry limit reached. Using memory fallback.`);
            return null;
          }
          return Math.min(times * 200, 2000);
        }
      });

      this.client.on('error', (err) => {
        if (this.isAvailable) {
          this.logger.error(`Redis Runtime Error: ${err.message}`);
          this.isAvailable = false;
        }
      });

      this.client.on('connect', () => {
        this.logger.log('🚀 Enterprise Redis (ioredis) connected successfully.');
        this.isAvailable = true;
      });

      await this.client.connect().catch(err => {
        this.logger.warn(`Redis failed to connect: ${err.message}. Stable fallback active.`);
        this.isAvailable = false;
      });
    } catch (err: any) {
      this.logger.error(`Redis Initialization Failed: ${err.message}`);
      this.isAvailable = false;
    }
  }

  getAvailability() {
    return this.isAvailable;
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.quit();
    }
  }

  // --- Resilient API ---

  async set(key: string, value: string, mode?: 'EX', duration?: number) {
    if (this.isAvailable && this.client) {
      try {
        if (mode === 'EX' && duration) {
          return await this.client.set(key, value, mode, duration);
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
        return await this.client.get(key);
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
        return await this.client.hmset(key, totals);
      } catch {
        this.isAvailable = false;
      }
    }
    this.memoryFallback.set(key, totals);
    return 'OK';
  }
}
