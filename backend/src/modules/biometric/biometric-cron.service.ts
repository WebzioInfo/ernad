import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BiometricService } from './biometric.service';
import { db } from '../../database/db';
import { biometricDevices } from '../../database/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class BiometricCronService {
  private readonly logger = new Logger(BiometricCronService.name);
  private isSyncing = false;

  constructor(private readonly biometricService: BiometricService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleSync() {
    if (this.isSyncing) {
      this.logger.debug('Sync already in progress, skipping...');
      return;
    }

    this.isSyncing = true;
    this.logger.log('Starting scheduled biometric sync for all active devices...');

    try {
      const activeDevices = await db.select()
        .from(biometricDevices)
        .where(eq(biometricDevices.isActive, true));

      for (const device of activeDevices) {
        try {
          this.logger.log(`Syncing device: ${device.name} (${device.ipAddress})`);
          const result = await this.biometricService.syncLogs(device.id);
          this.logger.log(`Device ${device.name} sync result: ${result.imported} new, ${result.skipped} skipped`);
        } catch (err) {
          this.logger.error(`Failed to sync device ${device.name}: ${err.message}`);
        }
      }
    } catch (err) {
      this.logger.error(`Critical error in biometric sync cron: ${err.message}`);
    } finally {
      this.isSyncing = false;
      this.logger.log('Scheduled biometric sync completed.');
    }
  }
}
