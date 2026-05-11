import { Module } from '@nestjs/common';
import { ProductionTelemetryController } from './production-telemetry.controller';
import { TelemetryProcessor } from './telemetry.processor';
import { EventsModule } from '../../realtime/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProductionManagementModule } from '../production-management/production-management.module';
import { FactoryConfigModule } from '../factory-config/factory-config.module';
import { QueueModule } from '../../providers/queue/queue.module';
import { OperatorSessionModule } from '../operator-session/operator-session.module';
import { InventoryModule } from '../inventory/inventory.module';
import { IngestionService } from './services/ingestion.service';
import { ProcessingService } from './services/processing.service';
import { ProductionReconciliationService } from './services/production-reconciliation.service';

@Module({
  imports: [
    EventsModule,
    NotificationsModule,
    ProductionManagementModule,
    FactoryConfigModule,
    QueueModule,
    OperatorSessionModule,
    InventoryModule
  ],
  controllers: [ProductionTelemetryController],
  providers: [
    IngestionService,
    ProcessingService,
    ProductionReconciliationService,
    TelemetryProcessor,
  ],
  exports: [IngestionService, ProcessingService, ProductionReconciliationService],
})
export class ProductionTelemetryModule { }
