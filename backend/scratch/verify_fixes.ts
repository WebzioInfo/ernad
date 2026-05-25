import 'dotenv/config';
import { db } from '../src/database/db';
import { operatorSessions, users, productionLines, productionBatches } from '../src/database/schema';
import { eq, and } from 'drizzle-orm';
import { OperatorSessionsService } from '../src/modules/operator-sessions/operator-sessions.service';
import { RedisService } from '../src/providers/redis/redis.service';
import { AuditService } from '../src/modules/audit/audit.service';

async function main() {
  console.log("Starting verification checks...");
  
  // Fetch some records to work with
  const activeLine = await db.select().from(productionLines).limit(1);
  const operators = await db.select().from(users).limit(2);
  const activeBatch = await db.select().from(productionBatches).limit(1);
  
  if (activeLine.length === 0 || operators.length < 2) {
    console.error("Missing test data. Make sure lines and users exist.");
    process.exit(1);
  }
  
  const lineId = activeLine[0].id;
  const operator1 = operators[0].id;
  const operator2 = operators[1].id;
  const station = 'FILLING';
  
  console.log(`Using Line: ${lineId}`);
  console.log(`Using Operator 1: ${operator1}`);
  console.log(`Using Operator 2: ${operator2}`);

  // Construct Services manually
  const mockConfigService = {
    get: (key: string) => process.env[key]
  } as any;
  const redisService = new RedisService(mockConfigService);
  const auditService = new AuditService();
  const sessionService = new OperatorSessionsService(redisService, auditService);
  
  // Force clean existing active sessions on this station to avoid interference
  await db.update(operatorSessions).set({ isActive: false }).where(and(eq(operatorSessions.lineId, lineId), eq(operatorSessions.station, station)));
  
  // Test 1: Start session for Operator 1
  console.log("\n--- TEST 1: Starting Session for Operator 1 ---");
  const s1 = await sessionService.startSession(operator1, lineId, station, undefined, false);
  console.log(`Operator 1 session created: ${s1.id}, isActive: ${s1.isActive}`);
  
  // Test 2: Start session for Operator 2 (Concurrent on same station)
  console.log("\n--- TEST 2: Starting Concurrent Session for Operator 2 ---");
  const s2 = await sessionService.startSession(operator2, lineId, station, undefined, false);
  console.log(`Operator 2 concurrent session created: ${s2.id}, isActive: ${s2.isActive}`);
  
  // Test 3: Idempotent session reuse
  console.log("\n--- TEST 3: Idempotent Session Reuse ---");
  const s3 = await sessionService.startSession(operator2, lineId, station, undefined, false);
  console.log(`Operator 2 session reused: ${s3.id === s2.id ? 'SUCCESS' : 'FAILED'}`);
  
  // Test 4: Force Takeover
  console.log("\n--- TEST 4: Force Takeover ---");
  // Deactivate Operator 1's session first to simulate a clean login takeover
  await db.update(operatorSessions)
    .set({ isActive: false })
    .where(and(
      eq(operatorSessions.userId, operator1),
      eq(operatorSessions.lineId, lineId),
      eq(operatorSessions.station, station)
    ));

  const s4 = await sessionService.startSession(operator1, lineId, station, undefined, true);
  console.log(`Operator 1 takeover session: ${s4.id}, isActive: ${s4.isActive}`);
  
  // Check if Operator 2's session was closed
  const [op2Session] = await db.select().from(operatorSessions).where(eq(operatorSessions.id, s2.id));
  console.log(`Operator 2 session active status after takeover: ${op2Session.isActive} (expected: false)`);
  console.log(`Operator 2 session endReason: ${op2Session.endReason} (expected: forced_takeover)`);
  
  // Cleanup test sessions
  await db.update(operatorSessions).set({ isActive: false }).where(and(eq(operatorSessions.lineId, lineId), eq(operatorSessions.station, station)));
  console.log("\nVerification checks completed successfully!");
  process.exit(0);
}

main().catch(err => {
  console.error("Verification failed with error:", err);
  process.exit(1);
});
