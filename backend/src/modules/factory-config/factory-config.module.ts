import { Module } from '@nestjs/common';
import { FactoryConfigController } from './factory-config.controller';
import { FactoryConfigService } from './factory-config.service';
import { ShiftService } from './shift.service';

@Module({
  controllers: [FactoryConfigController],
  providers: [FactoryConfigService, ShiftService],
  exports: [FactoryConfigService, ShiftService],
})
export class FactoryConfigModule {}

