import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { db } from '../../../database/db';
import { machineStates, productionBatches } from '../../../database/schema';
import { eq, and, desc } from 'drizzle-orm';
import { ProductionEventsService } from '../../../realtime/production.gateway';

@Injectable()
export class MachineStateService {
  private readonly logger = new Logger(MachineStateService.name);

  constructor(private eventsService: ProductionEventsService) {}

  async getMachineState(lineId: string, station: string): Promise<string> {
    const targetStation = station.toUpperCase();

    // Query current machine state
    const [existing] = await db.select().from(machineStates)
      .where(and(
        eq(machineStates.lineId, lineId),
        eq(machineStates.station, targetStation)
      ))
      .limit(1);

    if (existing) {
      return existing.state;
    }

    // Default status logic if entry doesn't exist yet:
    // If there is an active running batch on this line, default to 'RUNNING', else 'STOPPED'
    const [activeBatch] = await db.select().from(productionBatches)
      .where(and(
        eq(productionBatches.lineId, lineId),
        eq(productionBatches.status, 'RUNNING')
      ))
      .limit(1);

    const defaultState = activeBatch ? 'RUNNING' : 'STOPPED';

    try {
      const [inserted] = await db.insert(machineStates).values({
        lineId,
        station: targetStation,
        state: defaultState,
        updatedAt: new Date()
      }).returning();

      return inserted.state;
    } catch (e: any) {
      // Handle potential race condition unique constraint violation by querying again
      const [retryExisting] = await db.select().from(machineStates)
        .where(and(
          eq(machineStates.lineId, lineId),
          eq(machineStates.station, targetStation)
        ))
        .limit(1);
      if (retryExisting) {
        return retryExisting.state;
      }
      throw e;
    }
  }

  async updateMachineState(lineId: string, station: string, state: string): Promise<string> {
    const targetStation = station.toUpperCase();
    const targetState = state.toUpperCase();

    const allowedStates = ['RUNNING', 'STOPPED', 'CHANGEOVER', 'MAINTENANCE', 'FAULT'];
    if (!allowedStates.includes(targetState)) {
      throw new BadRequestException(`Invalid machine state: ${state}`);
    }

    const [updated] = await db.insert(machineStates)
      .values({
        lineId,
        station: targetStation,
        state: targetState,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [machineStates.lineId, machineStates.station],
        set: {
          state: targetState,
          updatedAt: new Date()
        }
      })
      .returning();

    this.logger.log(`[MACHINE_STATE] Line ${lineId} station ${targetStation} updated to ${targetState}`);

    // Emit update event via Pusher
    try {
      await this.eventsService.emitProductionUpdated('', lineId);
    } catch (err) {
      this.logger.error('Failed to broadcast machine state update via Pusher', err);
    }

    return updated.state;
  }
}
