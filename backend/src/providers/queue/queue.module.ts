import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = configService.get('REDIS_URL');
        const isProduction = process.env.NODE_ENV === 'production';
        const isLocal = url && (url.includes('127.0.0.1') || url.includes('localhost'));
        
        // If no URL or local Redis in production/Vercel, we return a config that won't connect to 127.0.0.1
        if (!url || (isProduction && isLocal)) {
          return {
            connection: {
              host: 'disabled-redis-host', // Purposefully invalid to prevent default localhost connection
              port: 6379,
              offlineQueue: false,
              maxRetriesPerRequest: 0,
            },
          };
        }

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
  ],
  exports: [BullModule],
})
export class QueueModule {}
