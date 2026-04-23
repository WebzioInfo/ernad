import { Module } from '@nestjs/common';
import { ProductionGateway } from './production.gateway';

@Module({
  providers: [ProductionGateway],
  exports: [ProductionGateway],
})
export class EventsModule {}
