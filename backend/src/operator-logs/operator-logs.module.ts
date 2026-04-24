import { Module } from '@nestjs/common';
import { OperatorLogsController } from './operator-logs.controller';
import { OperatorLogsService } from './operator-logs.service';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProductionBatchModule } from '../production-batch/production-batch.module';
import { MasterDataModule } from '../master-data/master-data.module';

@Module({
  imports: [EventsModule, NotificationsModule, ProductionBatchModule, MasterDataModule],
  controllers: [OperatorLogsController],
  providers: [OperatorLogsService],
  exports: [OperatorLogsService],
})
export class OperatorLogsModule { }
