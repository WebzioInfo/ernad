import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { OperatorSessionService } from './operator-session.service';

@Injectable()
export class SessionCleanupService implements OnModuleInit {
  private readonly logger = new Logger(SessionCleanupService.name);

  constructor(private readonly sessionService: OperatorSessionService) {}

  onModuleInit() {
    this.logger.log('Session Cleanup Service Initialized. Starting interval...');
    // Run cleanup every 15 minutes
    setInterval(async () => {
      try {
        const count = await this.sessionService.cleanupStaleSessions();
        if (count > 0) {
          this.logger.log(`Auto-cleaned ${count} stale operator sessions.`);
        }
      } catch (err) {
        this.logger.error(`Session cleanup failed: ${err.message}`);
      }
    }, 15 * 60 * 1000);
  }
}
