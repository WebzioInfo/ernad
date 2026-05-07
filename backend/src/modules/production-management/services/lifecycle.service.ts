import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { db } from '../../../database/db';
import { 
  productionBatches, batchTotals, productionLines, factories,
  qualityChecks, packagingLogs, dispatchLogs, materialFlows,
  rawMaterials, stockTransactions, roles, userRoles, operatorSessions
} from '../../../database/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { ProductionEventsService } from '../../../realtime/production.gateway';
import { OperatorSessionService } from '../../operator-session/operator-session.service';

@Injectable()
export class LifecycleService {
  private readonly logger = new Logger(LifecycleService.name);

  constructor(
    private eventsService: ProductionEventsService,
    private sessionService: OperatorSessionService
  ) {}

  private async getFactoryContext(factoryId?: string): Promise<string> {
    if (factoryId) return factoryId;
    const [factory] = await db.select().from(factories).limit(1);
    if (!factory) throw new BadRequestException('No factory configured in system.');
    return factory.id;
  }

  async closeBatch(batchId: string, reqUserId: string, remarks?: string, endTime?: string, materialReturn?: any) {
    const factoryId = await this.getFactoryContext();

    const result = await db.transaction(async (tx) => {
      const [batch] = await tx.select().from(productionBatches)
        .where(and(eq(productionBatches.id, batchId), eq(productionBatches.factoryId, factoryId)))
        .for('update');
      
      if (!batch) throw new BadRequestException('Batch not found.');
      if (!['RUNNING', 'CHANGEOVER'].includes(batch.status)) {
        throw new BadRequestException(`Invalid transition from ${batch.status} to QC_PENDING.`);
      }

      const flows = await tx.select().from(materialFlows).where(eq(materialFlows.batchId, batchId));
      
      const closerRoles = await tx.select({ slug: roles.slug })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, reqUserId));
      
      const isSuperAdmin = closerRoles.some(r => r.slug === 'SUPER_ADMIN');

      for (const flow of flows) {
        if (flow.used > 0 || flow.wasted > 0) {
          const totalDeduction = flow.used + flow.wasted;
          
          const [material] = await tx.select().from(rawMaterials)
            .where(and(eq(rawMaterials.name, flow.materialName), eq(rawMaterials.factoryId, factoryId)))
            .for('update');
          
          if (material) {
            const current = Number(material.currentStock);
            if (current < totalDeduction && !isSuperAdmin) {
               throw new BadRequestException(`Insufficient inventory for ${material.name}. Available: ${current}, Required: ${totalDeduction}`);
            }

            await tx.insert(stockTransactions).values({
              materialId: material.id,
              factoryId,
              type: 'OUT',
              quantity: totalDeduction.toString(),
              referenceId: batchId,
              remarks: `Consumption for Batch ${batch.batchCode}${isSuperAdmin ? ' (Forced by Admin)' : ''}`,
              createdAt: new Date(),
            });

            await tx.update(rawMaterials)
              .set({ currentStock: sql`${rawMaterials.currentStock} - ${totalDeduction}` })
              .where(eq(rawMaterials.id, material.id));
          }
        }
      }

      const [updatedBatch] = await tx.update(productionBatches)
        .set({ 
          status: 'QC_PENDING', 
          endTime: endTime ? new Date(endTime) : new Date(), 
          updatedBy: reqUserId,
          remarks: remarks ? sql`COALESCE(${productionBatches.remarks}, '') || '\n[CLOSE]: ' || ${remarks}` : productionBatches.remarks,
          materialReturn: materialReturn || null
        })
        .where(eq(productionBatches.id, batchId))
        .returning();
      
      await tx.update(productionLines)
        .set({ status: 'IDLE' })
        .where(eq(productionLines.id, batch.lineId));
      
      const boundSessions = await tx.select().from(operatorSessions).where(and(eq(operatorSessions.batchId, batchId), eq(operatorSessions.isActive, true)));
      for (const session of boundSessions) {
        await this.sessionService.endSession(session.userId, reqUserId, 'batch_closed');
      }

      return updatedBatch;
    });

    await this.eventsService.emitLineStatus(result.lineId, 'IDLE');
    await this.eventsService.emitProductionUpdated(result.id, result.lineId);
    
    return result;
  }

  async submitQualityCheck(batchId: string, inspectorId: string, result: 'PASS' | 'FAIL', params: Record<string, any>, remarks?: string) {
    const factoryId = await this.getFactoryContext();
    return await db.transaction(async (tx) => {
      const [batch] = await tx.select().from(productionBatches).where(eq(productionBatches.id, batchId)).for('update');
      if (!batch) throw new BadRequestException('Batch not found.');
      if (batch.status !== 'QC_PENDING') {
        throw new BadRequestException(`Invalid state for QC: ${batch.status}. Batch must be QC_PENDING.`);
      }

      const check = await tx.insert(qualityChecks).values({
        batchId,
        factoryId,
        inspectorId,
        checkType: 'PRODUCTION_SAMPLE',
        result,
        parameters: params,
        remarks: remarks,
        checkedAt: new Date(),
      }).returning();

      if (result === 'PASS') {
        await tx.update(productionBatches)
          .set({ status: 'COMPLETED' })
          .where(and(eq(productionBatches.id, batchId), eq(productionBatches.status, 'QC_PENDING')));
      }

      return check[0];
    });
  }

  async logPackaging(batchId: string, operatorId: string, packType: string, quantity: number, unitsPerPack: number, remarks?: string) {
    const factoryId = await this.getFactoryContext();
    
    return await db.transaction(async (tx) => {
      const [batch] = await tx.select().from(productionBatches).where(eq(productionBatches.id, batchId)).for('update');
      if (!batch) throw new BadRequestException('Batch not found.');
      if (!['RUNNING', 'CHANGEOVER', 'QC_PENDING', 'COMPLETED'].includes(batch.status)) {
         throw new BadRequestException(`Cannot log packaging for batch in ${batch.status} state.`);
      }

      const res = await tx.insert(packagingLogs).values({
        batchId,
        factoryId,
        operatorId,
        packType,
        quantity,
        unitsPerPack,
        remarks: remarks,
        createdAt: new Date(),
      }).returning();

      await tx.update(batchTotals)
        .set({ packingTotal: sql`${batchTotals.packingTotal} + ${quantity * unitsPerPack}` })
        .where(eq(batchTotals.batchId, batchId));

      return res[0];
    });
  }

  async logDispatch(batchId: string, managerId: string, destination: string, quantity: number, vehicle: string, remarks?: string) {
    const factoryId = await this.getFactoryContext();
    
    return await db.transaction(async (tx) => {
      const [batch] = await tx.select().from(productionBatches).where(eq(productionBatches.id, batchId)).for('update');
      if (!batch) throw new BadRequestException('Batch not found.');
      if (batch.status !== 'COMPLETED' && batch.status !== 'QC_PENDING') {
         throw new BadRequestException('Batch must be at least QC_PENDING or COMPLETED to dispatch.');
      }

      const res = await tx.insert(dispatchLogs).values({
        batchId,
        factoryId,
        dispatchManagerId: managerId,
        destination,
        quantity,
        vehicleNumber: vehicle,
        remarks: remarks,
        dispatchedAt: new Date(),
      }).returning();
      
      return res[0];
    });
  }

  async getLifecycleLogs(type?: 'qc' | 'packaging' | 'dispatch') {
    const factoryId = await this.getFactoryContext();
    if (type === 'qc') {
      return await db.select().from(qualityChecks)
        .where(eq(qualityChecks.factoryId, factoryId))
        .orderBy(desc(qualityChecks.checkedAt)).limit(50);
    } else if (type === 'packaging') {
      return await db.select().from(packagingLogs)
        .where(eq(packagingLogs.factoryId, factoryId))
        .orderBy(desc(packagingLogs.createdAt)).limit(50);
    } else {
      return await db.select().from(dispatchLogs)
        .where(eq(dispatchLogs.factoryId, factoryId))
        .orderBy(desc(dispatchLogs.dispatchedAt)).limit(50);
    }
  }
}
