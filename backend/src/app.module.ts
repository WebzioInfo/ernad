import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthGuard } from './modules/auth/auth.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { ProductionTelemetryModule } from './modules/production-telemetry/production-telemetry.module';
import { ProductionManagementModule } from './modules/production-management/production-management.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { FactoryConfigModule } from './modules/factory-config/factory-config.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { HealthModule } from './modules/health/health.module';
import { MailModule } from './providers/mail/mail.module';
import { MediaModule } from './providers/media/media.module';
import { EventsModule } from './realtime/events.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OneSignalModule } from './integrations/onesignal.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from './providers/queue/queue.module';
import { RedisModule } from './providers/redis/redis.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OperatorSessionModule } from './modules/operator-session/operator-session.module';
import { DataLifecycleModule } from './modules/data-lifecycle/data-lifecycle.module';
import { NotesModule } from './modules/notes/notes.module';
import { BiometricModule } from './modules/biometric/biometric.module';
import { TallyModule } from './modules/tally/tally.module';
import { ObservabilityModule } from './modules/observability/observability.module';

import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    QueueModule,
    ObservabilityModule,
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
    NotesModule,
    BiometricModule,
    TallyModule,
    ReportsModule,
    ScheduleModule.forRoot(),
  ],

  controllers: [
    AppController,
  ],
   providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
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
