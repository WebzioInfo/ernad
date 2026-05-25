import { Module } from '@nestjs/common';
import { OperatorSessionsController } from './operator-sessions.controller';
import { OperatorSessionsService } from './operator-sessions.service';
import { SessionCleanupService } from './session-cleanup.service';
import { UsersModule } from '../users/users.module';
import { EventsModule } from '../../realtime/events.module';

@Module({
  imports: [UsersModule, EventsModule],
  controllers: [OperatorSessionsController],
  providers: [OperatorSessionsService, SessionCleanupService],
  exports: [OperatorSessionsService],
})
export class OperatorSessionsModule {}
