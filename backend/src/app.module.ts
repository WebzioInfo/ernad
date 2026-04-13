import { Module } from '@nestjs/common';
import { ProductionBatchController } from './production-batch/production-batch.controller';
import { ProductionBatchService } from './production-batch/production-batch.service';
import { OperatorLogsController } from './operator-logs/operator-logs.controller';
import { OperatorLogsService } from './operator-logs/operator-logs.service';
import { ChangeoverController } from './changeover/changeover.controller';
import { ChangeoverService } from './changeover/changeover.service';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [
    ProductionBatchController, 
    OperatorLogsController,
    ChangeoverController,
    ReportsController
  ],
  providers: [
    ProductionBatchService,
    OperatorLogsService,
    ChangeoverService,
    ReportsService
  ],
})
export class AppModule {}
