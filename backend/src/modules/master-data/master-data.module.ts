import { Module } from '@nestjs/common';
import { MasterDataController } from './master-data.controller';
import { MasterDataService } from './master-data.service';
import { ShiftService } from './shift.service';

@Module({
  controllers: [MasterDataController],
  providers: [MasterDataService, ShiftService],
  exports: [MasterDataService, ShiftService],
})
export class MasterDataModule {}
