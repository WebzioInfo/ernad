import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { EventsModule } from '../../realtime/events.module';
import { OneSignalModule } from '../../integrations/onesignal.module';

@Module({
  imports: [EventsModule, OneSignalModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
