import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { OeeService } from './services/oee.service';

@Module({
  imports: [NotificationsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, OeeService],
  exports: [AnalyticsService, OeeService],
})
export class AnalyticsModule {}
