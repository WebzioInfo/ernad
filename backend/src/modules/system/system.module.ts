import { Module } from '@nestjs/common';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { DiagnosticsController } from './diagnostics.controller';

@Module({
  controllers: [SystemController, DiagnosticsController],
  providers: [SystemService],
  exports: [SystemService],
})
export class SystemModule {}
