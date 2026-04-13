import { Injectable, Logger } from '@nestjs/common';
import { db } from '../db/drizzle.provider';
import { operatorBlowingLogs, operatorFillingLogs, operatorLabelingLogs, operatorPackingLogs } from '../db/drizzle-schema';

@Injectable()
export class OperatorLogsService {
  private readonly logger = new Logger(OperatorLogsService.name);

  async logBlowing(dto: any) {
    this.logger.log('Inserted blowing log');
    await db.insert(operatorBlowingLogs).values({...dto, loggedAt: new Date()});
    return { success: true };
  }

  async logFilling(dto: any) {
    this.logger.log('Inserted filling log');
    await db.insert(operatorFillingLogs).values({...dto, loggedAt: new Date()});
    return { success: true };
  }

  async logLabeling(dto: any) {
    this.logger.log('Inserted labeling log');
    await db.insert(operatorLabelingLogs).values({...dto, loggedAt: new Date()});
    return { success: true };
  }

  async logPacking(dto: any) {
    this.logger.log('Inserted packing log');
    await db.insert(operatorPackingLogs).values({...dto, loggedAt: new Date()});
    return { success: true };
  }
}
