import { Module } from '@nestjs/common';
import { ProductionGateway } from './production.gateway';

import { RealtimeService } from './realtime.service';

@Module({
  providers: [ProductionGateway, RealtimeService],
  exports: [ProductionGateway, RealtimeService],
})
export class EventsModule {}
