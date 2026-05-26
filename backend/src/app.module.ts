import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { SalesModule } from './modules/sales/sales.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { WarehousingModule } from './modules/warehousing/warehousing.module';
import { AuditModule } from './modules/audit/audit.module';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthGuard } from './modules/auth/auth.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { TelemetryModule } from './modules/telemetry/telemetry.module';
import { ProductionModule } from './modules/production/production.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { HealthModule } from './modules/health/health.module';
import { MailModule } from './providers/mail/mail.module';
import { MediaModule } from './providers/media/media.module';
import { EventsModule } from './realtime/events.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OneSignalModule } from './integrations/onesignal.module';

import { ConfigModule } from '@nestjs/config';
import { QueueModule } from './providers/queue/queue.module';
import { RedisModule } from './providers/redis/redis.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OperatorSessionsModule } from './modules/operator-sessions/operator-sessions.module';
import { SystemModule } from './modules/system/system.module';
import { NotesModule } from './modules/notes/notes.module';

import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    QueueModule,
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
  
    TelemetryModule,
    ProductionModule,
    InventoryModule,
    OperatorSessionsModule,
    SystemModule,
    NotesModule,

    ReportsModule,
    SalesModule,
    ProcurementModule,
    WarehousingModule,
    AuditModule,
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
