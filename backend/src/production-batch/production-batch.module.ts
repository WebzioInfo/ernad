import { Module } from '@nestjs/common';
import { ProductionBatchController } from './production-batch.controller';
import { ProductionBatchService } from './production-batch.service';

@Module({
  controllers: [ProductionBatchController],
  providers: [ProductionBatchService],
  exports: [ProductionBatchService],
})
export class ProductionBatchModule {}
