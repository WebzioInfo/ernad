import { Module } from '@nestjs/common';
import { ProductionManagementController } from './production-management.controller';
import { ProductionManagementService } from './production-management.service';
import { ChangeoverController } from './changeover.controller';
import { ChangeoverService } from './changeover.service';
import { EventsModule } from '../events/events.module';
import { OperatorSessionModule } from '../operator-session/operator-session.module';

@Module({
  imports: [EventsModule, OperatorSessionModule],
  controllers: [ProductionManagementController, ChangeoverController],
  providers: [ProductionManagementService, ChangeoverService],
  exports: [ProductionManagementService, ChangeoverService],
})
export class ProductionManagementModule {}

