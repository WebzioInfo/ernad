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
    const redisHost = this.configService.get('REDIS_HOST');
    
    // Safety check for localhost in production (Vercel)
    const isLocalhost = (redisHost === '127.0.0.1' || redisHost === 'localhost' || (redisUrl && redisUrl.includes('127.0.0.1')));
    const isProduction = process.env.NODE_ENV === 'production';

    if (!redisUrl && !redisHost) {
      this.logger.log('🕒 Redis not configured. Using Memory Fallback.');
      this.isAvailable = false;
      return;
    }

    if (isProduction && isLocalhost) {
      this.logger.warn('🚫 Localhost Redis detected in Production environment. Bypassing to prevent ECONNREFUSED.');
      this.isAvailable = false;
      return;
    }

    try {
      const options = redisUrl ? redisUrl : {
        host: redisHost || '127.0.0.1',
        port: Number(this.configService.get('REDIS_PORT')) || 6379,
      };

      this.client = new Redis(options as any, {
        lazyConnect: true,
        maxRetriesPerRequest: 0,
        connectTimeout: 5000,
        retryStrategy: (times) => {
          if (times > 3) return null; // Stop retrying after 3 attempts
          return Math.min(times * 100, 2000);
        }
      });

      this.client.on('error', (err) => {
        if (this.isAvailable) {
          this.logger.error(`Redis Error: ${err.message}`);
          this.isAvailable = false;
        }
      });

      this.client.on('connect', () => {
        this.logger.log('🚀 Redis connected successfully.');
        this.isAvailable = true;
      });

      // Attempt initial connection
      await this.client.connect().catch(err => {
        this.logger.warn(`Redis connection failed: ${err.message}. Using Memory Fallback.`);
        this.isAvailable = false;
      });
    } catch (err) {
      this.logger.error(`Failed to initialize Redis: ${err.message}`);
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

  getClient() {
    return this.isAvailable ? this.client : null;
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
