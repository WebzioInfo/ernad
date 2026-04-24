import { Module } from '@nestjs/common';
import { OperatorLogsModule } from './operator-logs/operator-logs.module';
import { ProductionBatchModule } from './production-batch/production-batch.module';
import { ChangeoverController } from './changeover/changeover.controller';
import { ChangeoverService } from './changeover/changeover.service';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MasterDataModule } from './master-data/master-data.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { MediaModule } from './media/media.module';
import { EventsModule } from './events/events.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OneSignalModule } from './firebase/onesignal.module';
import { AttendanceModule } from './attendance/attendance.module';

import { AppController } from './app.controller';

@Module({
  imports: [
    AuthModule, 
    UsersModule, 
    MasterDataModule, 
    AnalyticsModule, 
    HealthModule, 
    MailModule, 
    MediaModule, 
    EventsModule, 
    NotificationsModule, 
    OneSignalModule, 
    AttendanceModule,
    OperatorLogsModule,
    ProductionBatchModule
  ],

  controllers: [
    AppController,
    ChangeoverController,
    ReportsController,
  ],
  providers: [
    ChangeoverService,
    ReportsService,
  ],
})
export class AppModule {}
