import { Module } from '@nestjs/common';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsModule } from '../../realtime/events.module';

@Module({
  imports: [NotificationsModule, EventsModule],
  controllers: [IncidentsController],
  providers: [IncidentsService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
