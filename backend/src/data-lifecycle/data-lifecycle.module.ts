import { Module } from '@nestjs/common';
import { DataLifecycleService } from './data-lifecycle.service';
import { DataLifecycleController } from './data-lifecycle.controller';

@Module({
  controllers: [DataLifecycleController],
  providers: [DataLifecycleService],
  exports: [DataLifecycleService],
})
export class DataLifecycleModule {}
