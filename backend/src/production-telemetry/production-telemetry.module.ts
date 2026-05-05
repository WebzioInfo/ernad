import { Module } from '@nestjs/common';
import { ProductionTelemetryController } from './production-telemetry.controller';
import { ProductionTelemetryService } from './production-telemetry.service';
import { TelemetryProcessor } from './telemetry.processor';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProductionManagementModule } from '../production-management/production-management.module';
import { FactoryConfigModule } from '../factory-config/factory-config.module';
import { QueueModule } from '../common/queue/queue.module';

@Module({
  imports: [EventsModule, NotificationsModule, ProductionManagementModule, FactoryConfigModule, QueueModule],
  controllers: [ProductionTelemetryController],
  providers: [ProductionTelemetryService, TelemetryProcessor],
  exports: [ProductionTelemetryService],
})
export class ProductionTelemetryModule { }
