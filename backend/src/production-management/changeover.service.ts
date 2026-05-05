import { Injectable, Logger } from '@nestjs/common';
import { db } from '../db/db';
import { changeoverLogs, productionBatches } from '../db/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class ChangeoverService {
  private readonly logger = new Logger(ChangeoverService.name);

  async finishChangeover(batchId: string, leftoverMaterials: any, wastedMaterials: any) {
    this.logger.log(`Finishing changeover for batch ${batchId}`);
    
    // Update batch status to RUNNING
    await db.update(productionBatches).set({ status: 'RUNNING' }).where(eq(productionBatches.id, batchId));

    // Log the changeover leftovers by updating the existing changeover log
    const endTime = new Date();
    const [log] = await db.update(changeoverLogs)
      .set({
        leftoverMaterials: leftoverMaterials,
        wastedMaterials: wastedMaterials,
        endTime: endTime
      })
      .where(eq(changeoverLogs.batchId, batchId))
      .returning();

    const durationMinutes = log && log.startTime 
      ? Math.round((endTime.getTime() - new Date(log.startTime).getTime()) / 60000)
      : 0;

    return { 
      success: true, 
      message: 'Changeover finished successfully.',
      durationMinutes
    };
  }
}
