import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('RedisService');
  private client: Redis | null = null;
  private isAvailable = false;
  private memoryFallback = new Map<string, any>();
  private localCache = new Map<string, { value: any; expiresAt: number }>();

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const rawUrl = this.configService.get('REDIS_URL');
    const redisUrl = rawUrl?.trim();

    if (!redisUrl || redisUrl === 'undefined') {
      this.logger.log('🕒 Redis missing. Stable Memory Fallback active.');
      this.isAvailable = false;
      return;
    }

    try {
      this.logger.log(`📡 Initializing Redis connection to: ${redisUrl.split('@')[1] || 'private-host'}`);
      
      this.client = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 0,
        connectTimeout: 2000,
        commandTimeout: 1000,
        enableOfflineQueue: false,
        tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
        retryStrategy: (times) => {
          if (times > 1) {
            this.logger.warn(`Redis unreachable. Using memory fallback.`);
            return null;
          }
          return 500;
        }
      });

      this.client.on('error', (err) => {
        if (!this.isAvailable && (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND'))) {
           return; 
        }
        if (this.isAvailable) {
          this.logger.error(`Redis Runtime Error: ${err.message}`);
          this.isAvailable = false;
        }
      });

      this.client.on('connect', () => {
        this.logger.log('🚀 Enterprise Redis (ioredis) connected successfully.');
        this.isAvailable = true;
      });

      this.client.connect().catch(err => {
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
    const now = Date.now();
    let ttl = 10000; // default 10s local cache
    if (mode === 'EX' && duration) {
      ttl = duration * 1000;
    } else if (key.startsWith('user:status:')) {
      ttl = 30000; // 30s local cache
    } else if (key.startsWith('operator_session:')) {
      ttl = 10000; // 10s local cache
    }

    this.localCache.set(key, { value, expiresAt: now + ttl });

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
    const now = Date.now();
    const cached = this.localCache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    let value: string | null = null;
    if (this.isAvailable && this.client) {
      try {
        value = await this.client.get(key);
      } catch {
        this.isAvailable = false;
      }
    }

    if (value === null) {
      value = this.memoryFallback.get(key) || null;
    }

    let ttl = 5000; // default 5s local cache for get
    if (key.startsWith('user:status:')) {
      ttl = 30000; // 30s
    } else if (key.startsWith('operator_session:')) {
      ttl = 10000; // 10s
    }

    this.localCache.set(key, { value, expiresAt: now + ttl });
    return value;
  }

  async del(key: string) {
    this.localCache.delete(key);
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

  getClient(): Redis | null {
    return this.client;
  }

  async lpush(key: string, value: string) {
    if (this.isAvailable && this.client) {
      try {
        return await this.client.lpush(key, value);
      } catch (err) {
        this.isAvailable = false;
      }
    }
    return 0;
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
