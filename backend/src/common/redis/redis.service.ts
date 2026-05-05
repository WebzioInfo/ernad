import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private isAvailable = false;
  private memoryFallback = new Map<string, Record<string, number>>();

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.client = new Redis({
      host: this.configService.get('REDIS_HOST') || '127.0.0.1',
      port: this.configService.get('REDIS_PORT') || 6379,
      lazyConnect: true,
      maxRetriesPerRequest: 0, // Disable retries to fail fast and use fallback
      retryStrategy: null, // Don't retry on connection failure
      showFriendlyErrorStack: true
    });

    // this.client.on('connect', () => {
    //   this.isAvailable = true;
    //   console.log('✅ Redis speed-layer connected');
    // });

    this.client.on('error', (err) => {
      this.isAvailable = false;
      // Suppress the flood of ECONNREFUSED logs by not re-throwing or logging here
    });

    // Attempt connection with a timeout to avoid hanging the app boot
    const connectPromise = this.client.connect();
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Redis connection timeout')), 2000)
    );

    Promise.race([connectPromise, timeoutPromise])
      .then(() => {
        this.isAvailable = true;
      })
      .catch((err) => {
        // console.warn('🕒 Redis connection timed out or failed. Using Memory Fallback.');
        this.isAvailable = false;
      });
  }

  getAvailability() {
    return this.isAvailable;
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.quit();
    }
  }

  async incrementCounter(batchId: string, station: string, amount: number) {
    const field = station.toLowerCase();
    
    if (this.isAvailable) {
      try {
        const key = `batch:totals:${batchId}`;
        return await this.client.hincrby(key, field, amount);
      } catch (err) {
        this.isAvailable = false;
      }
    }

    // Memory Fallback Logic
    const current = this.memoryFallback.get(batchId) || {};
    const newValue = (Number(current[field]) || 0) + amount;
    this.memoryFallback.set(batchId, { ...current, [field]: newValue });
    return newValue;
  }

  async getBatchTotals(batchId: string) {
    if (this.isAvailable) {
      try {
        const key = `batch:totals:${batchId}`;
        const totals = await this.client.hgetall(key);
        if (totals && Object.keys(totals).length > 0) return totals;
      } catch {
        this.isAvailable = false;
      }
    }
    return this.memoryFallback.get(batchId) || {};
  }

  async setBatchTotals(batchId: string, totals: Record<string, number>) {
    if (this.isAvailable) {
      try {
        const key = `batch:totals:${batchId}`;
        return await this.client.hmset(key, totals);
      } catch {
        this.isAvailable = false;
      }
    }
    this.memoryFallback.set(batchId, totals);
    return 'OK';
  }
}
