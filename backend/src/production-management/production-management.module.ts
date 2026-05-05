import { Module } from '@nestjs/common';
import { ProductionManagementController } from './production-management.controller';
import { ProductionManagementService } from './production-management.service';
import { ChangeoverController } from './changeover.controller';
import { ChangeoverService } from './changeover.service';

@Module({
  controllers: [ProductionManagementController, ChangeoverController],
  providers: [ProductionManagementService, ChangeoverService],
  exports: [ProductionManagementService, ChangeoverService],
})
export class ProductionManagementModule {}
