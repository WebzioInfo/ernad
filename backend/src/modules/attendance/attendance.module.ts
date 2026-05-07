import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { EsslSyncService } from './essl-sync.service';

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService, EsslSyncService],
  exports: [AttendanceService, EsslSyncService],
})
export class AttendanceModule {}

