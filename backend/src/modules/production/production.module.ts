import { Module, forwardRef } from '@nestjs/common';
import { ProductionController } from './production.controller';
import { TerminalsController } from './terminals.controller';
import { ChangeoverController } from './changeover.controller';
import { BatchService } from './services/batch.service';
import { LineService } from './services/line.service';
import { LifecycleService } from './services/lifecycle.service';
import { ChangeoverService } from './changeover.service';
import { TerminalService } from './services/terminal.service';
import { VerificationService } from './services/verification.service';

import { EventsModule } from '../../realtime/events.module';

import { OperatorSessionsModule } from '../operator-sessions/operator-sessions.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [EventsModule, OperatorSessionsModule, forwardRef(() => AuthModule), forwardRef(() => UsersModule)],
  controllers: [ProductionController, ChangeoverController, TerminalsController],
  providers: [
    BatchService, 
    LineService, 
    LifecycleService, 
    ChangeoverService, 
    TerminalService,
    VerificationService
  ],
  exports: [
    BatchService, 
    LineService, 
    LifecycleService, 
    ChangeoverService, 
    TerminalService,
    VerificationService
  ],
})
export class ProductionModule {}
