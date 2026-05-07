import { Module } from '@nestjs/common';
import { ProductionTelemetryController } from './production-telemetry.controller';
import { TelemetryProcessor } from './telemetry.processor';
import { EventsModule } from '../../realtime/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProductionManagementModule } from '../production-management/production-management.module';
import { FactoryConfigModule } from '../factory-config/factory-config.module';
import { QueueModule } from '../../providers/queue/queue.module';
import { OperatorSessionModule } from '../operator-session/operator-session.module';

const redisUrl = process.env.REDIS_URL;
const isProduction = process.env.NODE_ENV === 'production';
const isLocal = redisUrl && (redisUrl.includes('127.0.0.1') || redisUrl.includes('localhost'));
const redisIsConfigured = !!redisUrl && !(isProduction && isLocal);

import { IngestionService } from './services/ingestion.service';
import { ProcessingService } from './services/processing.service';

@Module({
  imports: [
    EventsModule,
    NotificationsModule,
    ProductionManagementModule,
    FactoryConfigModule,
    ...(redisIsConfigured ? [QueueModule] : []),
    OperatorSessionModule
  ],
  controllers: [ProductionTelemetryController],
  providers: [
    IngestionService,
    ProcessingService,
    ...(redisIsConfigured ? [TelemetryProcessor] : []),
  ],
  exports: [IngestionService, ProcessingService],
})
export class ProductionTelemetryModule { }
