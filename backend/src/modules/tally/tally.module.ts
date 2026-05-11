import { Module } from '@nestjs/common';
import { TallyController } from './tally.controller';
import { TallySyncService } from './tally-sync.service';
import { TallyComparisonService } from './tally-comparison.service';

@Module({
  controllers: [TallyController],
  providers: [TallySyncService, TallyComparisonService],
  exports: [TallySyncService],
})
export class TallyModule {}
