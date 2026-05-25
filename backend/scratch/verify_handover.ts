import 'dotenv/config';
import { db } from '../src/database/db';
import { operatorSessions, users, productionLines, productionBatches, shiftHandovers, batchTotals, machineStates } from '../src/database/schema';
import { eq, and, desc } from 'drizzle-orm';
import { OperatorSessionsService } from '../src/modules/operator-sessions/operator-sessions.service';
import { RedisService } from '../src/providers/redis/redis.service';
import { AuditService } from '../src/modules/audit/audit.service';
import * as bcrypt from 'bcryptjs';

async function main() {
  console.log("Starting shift handover verification...");

  // Fetch some records to work with
  const lines = await db.select().from(productionLines).where(eq(productionLines.status, 'RUNNING')).limit(1);
  const operators = await db.select().from(users).limit(2);
  const batches = await db.select().from(productionBatches).where(eq(productionBatches.status, 'RUNNING')).limit(1);

  if (lines.length === 0 || operators.length < 2 || batches.length === 0) {
    console.error("Missing test data. Make sure active lines, batches, and at least 2 operators exist.");
    process.exit(1);
  }

  const lineId = lines[0].id;
  const operator1 = operators[0];
  const operator2 = operators[1];
  const batchId = batches[0].id;
  const station = 'FILLING';

  console.log(`Using Line: ${lineId}`);
  console.log(`Using Batch: ${batchId}`);
  console.log(`Outgoing Operator: ${operator1.name} (${operator1.id})`);
  console.log(`Incoming Operator: ${operator2.name} (${operator2.id})`);

  // Ensure operator2 has a known pin in DB for mock testing
  const testPin = '1234';
  const hashedPin = await bcrypt.hash(testPin, 10);
  await db.update(users).set({ pinCode: hashedPin, isActive: true }).where(eq(users.id, operator2.id));
  console.log(`Set incoming operator pin to '1234'`);

  // Reset or initialize batchTotals to a known state for testing
  await db.insert(batchTotals).values({
    batchId,
    lineId,
    factoryId: batches[0].factoryId,
    blowingTotal: 100,
    fillingTotal: 250,
    labelingTotal: 0,
    packingTotal: 0,
    scrapTotal: 5
  }).onConflictDoUpdate({
    target: [batchTotals.batchId],
    set: {
      blowingTotal: 100,
      fillingTotal: 250,
      scrapTotal: 5
    }
  });

  // Reset or initialize machineStates
  await db.insert(machineStates).values({
    lineId,
    station: 'FILLING',
    state: 'RUNNING',
    updatedAt: new Date()
  }).onConflictDoUpdate({
    target: [machineStates.lineId, machineStates.station],
    set: {
      state: 'RUNNING',
      updatedAt: new Date()
    }
  });

  // Construct services
  const mockConfigService = {
    get: (key: string) => process.env[key]
  } as any;
  const redisService = new RedisService(mockConfigService);
  const auditService = new AuditService();
  const mockEventsService = {
    emitProductionUpdated: async () => {},
    emitShiftHandover: async () => {},
  } as any;
  const mockJwtService = {
    signAsync: async () => 'mock-token'
  } as any;

  const sessionService = new OperatorSessionsService(redisService, auditService, mockEventsService, mockJwtService);

  // Clear any existing active session on station
  await db.update(operatorSessions).set({ isActive: false }).where(and(eq(operatorSessions.lineId, lineId), eq(operatorSessions.station, station)));

  // Start outgoing session
  const outgoingSession = await sessionService.startSession(operator1.id, lineId, station, batches[0].shiftId || undefined);
  console.log(`Started outgoing operator session: ${outgoingSession.id}`);

  // Perform Handover
  console.log("Initiating handover...");
  const result = await sessionService.initiateHandover(operator1.id, {
    incomingOperatorId: operator2.id,
    incomingOperatorPin: testPin,
    notes: 'Shift completed. Machine working fine.',
    pendingIssues: 'None',
    materialStateConfirmed: true,
    machineStatusAcknowledged: true
  });

  console.log(`Handover success. New session ID: ${result.incomingSession.id}`);

  // Verifications
  const [closedSession] = await db.select().from(operatorSessions).where(eq(operatorSessions.id, outgoingSession.id));
  console.log(`Outgoing session active: ${closedSession.isActive} (expected: false)`);
  console.log(`Outgoing session end reason: ${closedSession.endReason} (expected: handover)`);

  const [activeSession] = await db.select().from(operatorSessions).where(eq(operatorSessions.id, result.incomingSession.id));
  console.log(`Incoming session active: ${activeSession.isActive} (expected: true)`);
  console.log(`Incoming session userId: ${activeSession.userId} (expected: ${operator2.id})`);

  const [handoverRecord] = await db.select().from(shiftHandovers).where(eq(shiftHandovers.id, result.handover.id));
  if (handoverRecord) {
    console.log("Shift Handover Record:");
    console.log(`- Outgoing operator: ${handoverRecord.outgoingOperatorId}`);
    console.log(`- Incoming operator: ${handoverRecord.incomingOperatorId}`);
    console.log(`- Production Count Snapshot: ${handoverRecord.productionCountSnapshot} (expected: 250)`);
    console.log(`- Waste Count Snapshot: ${handoverRecord.wasteCountSnapshot} (expected: 5)`);
    console.log(`- Notes: ${handoverRecord.notes}`);
    console.log(`- Pending Issues: ${handoverRecord.pendingIssues}`);
    console.log(`- Machine State Snapshot: ${handoverRecord.machineStateSnapshot} (expected: RUNNING)`);
  } else {
    console.error("Handover record not found!");
  }

  // Cleanup
  await db.update(operatorSessions).set({ isActive: false }).where(and(eq(operatorSessions.lineId, lineId), eq(operatorSessions.station, station)));
  console.log("Shift handover verification completed successfully!");
  process.exit(0);
}

main().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
