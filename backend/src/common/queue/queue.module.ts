import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

const isProduction = process.env.NODE_ENV === 'production';
const redisHost = process.env.REDIS_HOST;
const redisUrl = process.env.REDIS_URL;

const isLocalhost = (redisHost === '127.0.0.1' || redisHost === 'localhost' || (redisUrl && redisUrl.includes('127.0.0.1')));
const redisIsConfigured = !!(redisHost || redisUrl) && !(isProduction && isLocalhost);

@Module({
  imports: redisIsConfigured
    ? [
        BullModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => {
            const url = configService.get('REDIS_URL');
            const host = configService.get('REDIS_HOST');
            const isLocal = host === 'localhost' || host === '127.0.0.1';
            const useTls = (host && !isLocal) || (url && url.startsWith('rediss://'));

            return {
              connection: url ? url : {
                host: host || '127.0.0.1',
                port: configService.get('REDIS_PORT') || 6379,
                password: configService.get('REDIS_PASSWORD'),
                tls: useTls ? {} : undefined,
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
