import { Injectable, BadRequestException } from '@nestjs/common';
import { db } from '../../../database/db';
import { productionLines, factories } from '../../../database/schema';
import { eq, and } from 'drizzle-orm';
import { ProductionEventsService } from '../../../realtime/production.gateway';

@Injectable()
export class LineService {
  constructor(private eventsService: ProductionEventsService) {}

  async getFactoryContext(factoryId?: string): Promise<string> {
    if (factoryId) return factoryId;
    const [factory] = await db.select().from(factories).limit(1);
    if (!factory) throw new BadRequestException('No factory configured in system.');
    return factory.id;
  }

  async toggleMaintenance(lineId: string, userId: string) {
     const factoryId = await this.getFactoryContext();
     const [line] = await db.select().from(productionLines).where(eq(productionLines.id, lineId)).limit(1);
     if (!line) throw new BadRequestException('Line not found');

     const newStatus = line.status === 'MAINTENANCE' ? 'IDLE' : 'MAINTENANCE';
     if (newStatus === 'MAINTENANCE' && line.status === 'RUNNING') {
        throw new BadRequestException('Stop production before maintenance.');
     }

     const [updated] = await db.update(productionLines)
       .set({ status: newStatus, updatedAt: new Date() })
       .where(and(eq(productionLines.id, lineId), eq(productionLines.factoryId, factoryId)))
       .returning();
     
     await this.eventsService.emitLineStatus(lineId, newStatus);
     return updated;
  }
}
