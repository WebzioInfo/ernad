import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { ForensicsController } from './forensics.controller';

@Global()
@Module({
  providers: [AuditService],
  controllers: [ForensicsController],
  exports: [AuditService],
})
export class ObservabilityModule {}
