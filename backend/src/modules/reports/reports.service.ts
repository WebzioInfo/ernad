import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database/drizzle.provider';
import { sql } from 'drizzle-orm';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  async generateShiftReport(shiftId: string) {
    this.logger.log(`Generating shift report for shift ${shiftId}`);
    // Example query using materialized view 
    // const res = await db.execute(sql`SELECT * FROM shift_production_mv WHERE shift_id = ${shiftId}`);
    return { report: 'Shift production data' };
  }

  async getLineEfficiency() {
    this.logger.log('Calculating line efficiency across plant');
    return {
        line1: 94,
        line2: 88
    };
  }

  async getMaterialConsumption(batchId: string) {
      // rule: remaining = issued - used - wasted
      return { issued: 1000, used: 850, wasted: 10, remaining: 140 };
  }
}
