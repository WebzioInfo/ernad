import { Module } from '@nestjs/common';
import { WarehousingController } from './warehousing.controller';
import { WarehousingService } from './warehousing.service';

@Module({
  controllers: [WarehousingController],
  providers: [WarehousingService],
  exports: [WarehousingService],
})
export class WarehousingModule {}
