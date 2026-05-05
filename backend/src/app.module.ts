import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { ProductionTelemetryModule } from './production-telemetry/production-telemetry.module';
import { ProductionManagementModule } from './production-management/production-management.module';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FactoryConfigModule } from './factory-config/factory-config.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { MediaModule } from './media/media.module';
import { EventsModule } from './events/events.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OneSignalModule } from './firebase/onesignal.module';
import { AttendanceModule } from './attendance/attendance.module';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from './common/queue/queue.module';
import { RedisModule } from './common/redis/redis.module';
import { InventoryModule } from './inventory/inventory.module';
import { OperatorSessionModule } from './operator-session/operator-session.module';
import { DataLifecycleModule } from './data-lifecycle/data-lifecycle.module';

import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    QueueModule,
    AuthModule, 
    UsersModule, 
    FactoryConfigModule, 
    AnalyticsModule, 
    HealthModule, 
    MailModule, 
    MediaModule, 
    EventsModule, 
    NotificationsModule, 
    OneSignalModule, 
    AttendanceModule,
    ProductionTelemetryModule,
    ProductionManagementModule,
    InventoryModule,
    OperatorSessionModule,
    DataLifecycleModule,
  ],

  controllers: [
    AppController,
    ReportsController,
  ],
   providers: [
    ReportsService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*');
  }
}
