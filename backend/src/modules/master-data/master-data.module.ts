import { Module } from '@nestjs/common';
import { MasterDataController } from './master-data.controller';
import { MasterDataService } from './master-data.service';
import { ShiftService } from './shift.service';
import { EventsModule } from '../../realtime/events.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [EventsModule, AuditModule],
  controllers: [MasterDataController],
  providers: [MasterDataService, ShiftService],
  exports: [MasterDataService, ShiftService],
})
export class MasterDataModule {}
