import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

const redisUrl = process.env.REDIS_URL;
const isProduction = process.env.NODE_ENV === 'production';
const isLocal = redisUrl && (redisUrl.includes('127.0.0.1') || redisUrl.includes('localhost'));
const redisIsConfigured = !!redisUrl && !(isProduction && isLocal);

@Module({
  imports: redisIsConfigured
    ? [
        BullModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => {
            const url = configService.get('REDIS_URL');
            return {
              connection: {
                url,
                tls: url?.startsWith('rediss://') ? {} : undefined,
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
                offlineQueue: true,
                retryStrategy: (times: number) => Math.min(times * 500, 30000),
              },
            };
          },
        }),
        BullModule.registerQueue({ name: 'telemetry' }),
      ]
    : [],
  exports: [BullModule],
})
export class QueueModule {}
