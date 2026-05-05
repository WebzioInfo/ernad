import { Module } from '@nestjs/common';
import { OperatorSessionController } from './operator-session.controller';
import { OperatorSessionService } from './operator-session.service';
import { SessionCleanupService } from './session-cleanup.service';

@Module({
  controllers: [OperatorSessionController],
  providers: [OperatorSessionService, SessionCleanupService],
  exports: [OperatorSessionService],
})
export class OperatorSessionModule {}
