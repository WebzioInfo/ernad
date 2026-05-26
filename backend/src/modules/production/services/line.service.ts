import { Injectable, BadRequestException } from '@nestjs/common';
import { db } from '../../../database/db';
import { productionLines } from '../../../database/schema';
import { eq } from 'drizzle-orm';
import { ProductionEventsService } from '../../../realtime/production.gateway';

@Injectable()
export class LineService {
  constructor(private eventsService: ProductionEventsService) {}

  async toggleMaintenance(lineId: string, userId: string) {
     const [line] = await db.select().from(productionLines).where(eq(productionLines.id, lineId)).limit(1);
     if (!line) throw new BadRequestException('Line not found');

     const newStatus = line.status === 'MAINTENANCE' ? 'IDLE' : 'MAINTENANCE';
     if (newStatus === 'MAINTENANCE' && line.status === 'RUNNING') {
        throw new BadRequestException('Stop production before maintenance.');
     }

     const [updated] = await db.update(productionLines)
       .set({ status: newStatus, updatedAt: new Date() })
       .where(eq(productionLines.id, lineId))
       .returning();
     
     await this.eventsService.emitLineStatus(lineId, newStatus);
     return updated;
  }
}
