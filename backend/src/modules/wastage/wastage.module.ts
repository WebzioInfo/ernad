import { Module } from '@nestjs/common';
import { WastageController } from './wastage.controller';
import { WastageService } from './wastage.service';

@Module({
  controllers: [WastageController],
  providers: [WastageService],
  exports: [WastageService]
})
export class WastageModule {}
