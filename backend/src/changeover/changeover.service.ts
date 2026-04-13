import { Injectable, Logger } from '@nestjs/common';
import { db } from '../db/drizzle.provider';
import { changeoverLogs, productionBatches } from '../db/drizzle-schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class ChangeoverService {
  private readonly logger = new Logger(ChangeoverService.name);

  async finishChangeover(batchId: string, leftoverMaterials: any, wastedMaterials: any) {
    this.logger.log(`Finishing changeover for batch ${batchId}`);
    
    // Update batch status to RUNNING
    await db.update(productionBatches).set({ status: 'RUNNING' }).where(eq(productionBatches.id, batchId));

    // Log the changeover leftovers by updating the existing changeover log
    await db.update(changeoverLogs)
      .set({
        leftoverMaterials: leftoverMaterials,
        wastedMaterials: wastedMaterials,
        endTime: new Date()
      })
      .where(eq(changeoverLogs.batchId, batchId));

    return { success: true, message: 'Changeover finished successfully.' };
  }
}
