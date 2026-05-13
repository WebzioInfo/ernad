import { Module } from '@nestjs/common';
import { ForensicsController } from './forensics.controller';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [AnalyticsModule],
  controllers: [ForensicsController],
})
export class ForensicsModule {}
