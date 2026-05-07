import { Module } from '@nestjs/common';
import { ProductionManagementController } from './production-management.controller';
import { ChangeoverController } from './changeover.controller';
import { ChangeoverService } from './changeover.service';
import { EventsModule } from '../../realtime/events.module';
import { OperatorSessionModule } from '../operator-session/operator-session.module';

import { BatchService } from './services/batch.service';
import { LineService } from './services/line.service';
import { LifecycleService } from './services/lifecycle.service';

@Module({
  imports: [EventsModule, OperatorSessionModule],
  controllers: [ProductionManagementController, ChangeoverController],
  providers: [
    ChangeoverService,
    BatchService,
    LineService,
    LifecycleService,
  ],
  exports: [
    ChangeoverService,
    BatchService,
    LineService,
    LifecycleService,
  ],
})
export class ProductionManagementModule {}

