import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as OneSignal from '@onesignal/node-onesignal';

@Injectable()
export class OneSignalService implements OnModuleInit {
  private readonly logger = new Logger(OneSignalService.name);
  private client: OneSignal.DefaultApi | null = null;
  private appId: string | null = null;

  onModuleInit() {
    this.appId = process.env.ONESIGNAL_APP_ID || null;
    const restApiKey = process.env.ONESIGNAL_REST_API_KEY || null;

    if (!this.appId || !restApiKey) {
      this.logger.warn('OneSignal keys missing – push notifications disabled.');
      return;
    }

    const configuration = OneSignal.createConfiguration({
      restApiKey: restApiKey,
    });

    this.client = new OneSignal.DefaultApi(configuration);
    this.logger.log('OneSignal SDK initialized successfully.');
  }

  /**
   * Send a push notification targeting users by their database `user_id`
   * (which maps to OneSignal's `external_id`).
   */
  async sendToUsers(userIds: string[], title: string, body: string, data?: Record<string, string>): Promise<boolean> {
    if (!this.client || !this.appId || userIds.length === 0) return false;

    const notification = new OneSignal.Notification();
    notification.app_id = this.appId;
    notification.headings = { en: title };
    notification.contents = { en: body };
    notification.data = data;
    notification.target_channel = 'push';
    notification.include_aliases = {
      external_id: userIds,
    };

    try {
      const response = await this.client.createNotification(notification);
      this.logger.log(`OneSignal Push Sent [ID: ${response.id}] to ${userIds.length} users.`);
      return true;
    } catch (error: any) {
      this.logger.error(`OneSignal Push Failed: ${error.message || error}`);
      return false;
    }
  }
}
