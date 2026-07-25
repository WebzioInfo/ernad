import { Module } from '@nestjs/common';
import { TelemetryController } from './telemetry.controller';
import { IngestionService } from './services/ingestion.service';
import { ProcessingService } from './services/processing.service';
import { ProductionReconciliationService } from './services/production-reconciliation.service';
import { ProductionModule } from '../production/production.module';
import { BullModule } from '@nestjs/bullmq';
import { TelemetryProcessor } from './telemetry.processor';

import { OperatorSessionsModule } from '../operator-sessions/operator-sessions.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsModule } from '../../realtime/events.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    ProductionModule,
    OperatorSessionsModule,
    MasterDataModule,
    NotificationsModule,
    EventsModule,
    InventoryModule,
    BullModule.registerQueue({
      name: 'telemetry',
    }),
  ],
  controllers: [TelemetryController],
  providers: [
    IngestionService, 
    ProcessingService, 
    ProductionReconciliationService,
    // TelemetryProcessor - Disabled background worker to prevent idle Redis polling/quota exhaustion. 
    // Ingestion is processed synchronous-inline, so no background telemetry queuing is active.
  ],
  exports: [IngestionService],
})
export class TelemetryModule {}
