import { Module } from '@nestjs/common';
import { ProductionEventsService } from './production.gateway';
import { RealtimeService } from './realtime.service';

@Module({
  providers: [ProductionEventsService, RealtimeService],
  exports: [ProductionEventsService, RealtimeService],
})
export class EventsModule {}
