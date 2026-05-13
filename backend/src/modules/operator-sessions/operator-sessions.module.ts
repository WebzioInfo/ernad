import { Module } from '@nestjs/common';
import { OperatorSessionsController } from './operator-sessions.controller';
import { OperatorSessionsService } from './operator-sessions.service';
import { SessionCleanupService } from './session-cleanup.service';

@Module({
  controllers: [OperatorSessionsController],
  providers: [OperatorSessionsService, SessionCleanupService],
  exports: [OperatorSessionsService],
})
export class OperatorSessionsModule {}
