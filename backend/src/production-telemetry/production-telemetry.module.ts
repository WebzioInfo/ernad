import { Module } from '@nestjs/common';
import { ProductionTelemetryController } from './production-telemetry.controller';
import { ProductionTelemetryService } from './production-telemetry.service';
import { TelemetryProcessor } from './telemetry.processor';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProductionManagementModule } from '../production-management/production-management.module';
import { FactoryConfigModule } from '../factory-config/factory-config.module';
import { QueueModule } from '../common/queue/queue.module';
import { OperatorSessionModule } from '../operator-session/operator-session.module';

const redisUrl = process.env.REDIS_URL;
const isProduction = process.env.NODE_ENV === 'production';
const isLocal = redisUrl && (redisUrl.includes('127.0.0.1') || redisUrl.includes('localhost'));
const redisIsConfigured = !!redisUrl && !(isProduction && isLocal);

@Module({
  imports: [
    EventsModule,
    NotificationsModule,
    ProductionManagementModule,
    FactoryConfigModule,
    // Only import QueueModule (BullMQ) if Redis is actually configured
    ...(redisIsConfigured ? [QueueModule] : []),
    OperatorSessionModule
  ],
  controllers: [ProductionTelemetryController],
  // TelemetryProcessor creates a BullMQ Worker — only include if Redis is available
  providers: redisIsConfigured
    ? [ProductionTelemetryService, TelemetryProcessor]
    : [ProductionTelemetryService],
  exports: [ProductionTelemetryService],
})
export class ProductionTelemetryModule { }
