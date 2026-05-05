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

const redisIsConfigured = !!(process.env.REDIS_HOST || process.env.REDIS_URL);

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
