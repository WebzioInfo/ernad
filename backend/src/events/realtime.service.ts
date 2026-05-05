import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Pusher from 'pusher';

@Injectable()
export class RealtimeService {
  private pusher: Pusher;
  private readonly logger = new Logger(RealtimeService.name);

  constructor(private configService: ConfigService) {
    const appId = this.configService.get<string>('PUSHER_APP_ID');
    const key = this.configService.get<string>('PUSHER_KEY');
    const secret = this.configService.get<string>('PUSHER_SECRET');
    const cluster = this.configService.get<string>('PUSHER_CLUSTER');

    if (appId && key && secret && cluster) {
      this.pusher = new Pusher({
        appId,
        key,
        secret,
        cluster,
        useTLS: true,
      });
      this.logger.log('Pusher initialized successfully');
    } else {
      this.logger.warn('Pusher credentials missing. Real-time events will be disabled.');
    }
  }

  async emit(channel: string, event: string, data: any) {
    if (!this.pusher) return;
    try {
      await this.pusher.trigger(channel, event, data);
    } catch (err) {
      this.logger.error(`Failed to emit Pusher event [${event}] on channel [${channel}]`, err);
    }
  }
}
