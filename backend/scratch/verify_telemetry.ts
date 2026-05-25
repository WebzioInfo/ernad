import 'dotenv/config';
import { TelemetryProcessor } from '../src/modules/telemetry/telemetry.processor';
import { ProcessingService } from '../src/modules/telemetry/services/processing.service';
import { RedisService } from '../src/providers/redis/redis.service';
import { NonRetryableBusinessError } from '../src/common/errors/non-retryable-business.error';
import { AuditService } from '../src/modules/audit/audit.service';
import { BadRequestException } from '@nestjs/common';
import { Job } from 'bullmq';

async function main() {
  console.log("Mocking dependencies for TelemetryProcessor unit test...");
  
  // 1. Mock ProcessingService
  const mockProcessingService = {
    handleTelemetryLog: async (userId: string, dto: any) => {
      if (dto.triggerStockError) {
        throw new NonRetryableBusinessError("Material stock not found for Caps. Please assign stock in the Operator Panel.");
      }
      if (dto.triggerFlowError) {
        throw new BadRequestException("FLOW_VIOLATION: Filling count (8) cannot exceed Blowing output (0)");
      }
      return { success: true };
    }
  } as unknown as ProcessingService;

  // 2. Mock RedisService
  let redisDLQ: any[] = [];
  const mockRedisService = {
    getAvailability: () => true,
    getClient: () => ({
      lpush: async (key: string, value: string) => {
        console.log(`=> Redis LPUSH called on key: ${key}`);
        return 1;
      }
    }),
    lpush: async (key: string, value: string) => {
      console.log(`=> Resilient Redis LPUSH called on key: ${key}`);
      redisDLQ.push(JSON.parse(value));
      return 1;
    }
  } as unknown as RedisService;

  // 3. Mock AuditService
  let auditLogsWritten: any[] = [];
  const mockAuditService = {
    logAction: async (ctx: any) => {
      console.log(`=> AuditService logAction called for: ${ctx.action}`);
      auditLogsWritten.push(ctx);
    }
  } as unknown as AuditService;

  const processor = new TelemetryProcessor(mockProcessingService, mockRedisService, mockAuditService);

  // Test Case 1: Permanent Stock Error (NonRetryableBusinessError) (Should fail on 1st attempt and discard)
  console.log("\n--- TEST 1: Permanent Stock Error (NonRetryableBusinessError) ---");
  let discard1Called = false;
  const job1 = {
    id: 'job-1',
    attemptsMade: 0,
    data: {
      userId: 'user-1',
      dto: { requestId: 'req-1', triggerStockError: true }
    },
    discard: async () => { discard1Called = true; }
  } as unknown as Job;

  try {
    await processor.process(job1);
  } catch (err: any) {
    console.log(`Caught error: ${err.message}`);
    console.log(`Discard called: ${discard1Called} (expected: true)`);
  }

  // Test Case 2: Transient Flow Error (Should NOT discard on 1st attempt)
  console.log("\n--- TEST 2: Transient Flow Error (Attempt 1) ---");
  let discard2Called = false;
  const job2 = {
    id: 'job-2',
    attemptsMade: 0,
    data: {
      userId: 'user-2',
      dto: { requestId: 'req-2', triggerFlowError: true }
    },
    discard: async () => { discard2Called = true; }
  } as unknown as Job;

  try {
    await processor.process(job2);
  } catch (err: any) {
    console.log(`Caught error: ${err.message}`);
    console.log(`Discard called: ${discard2Called} (expected: false)`);
  }

  // Test Case 3: Transient Flow Error (Attempt 5 - exhausted)
  console.log("\n--- TEST 3: Transient Flow Error (Attempt 5 - Final) ---");
  let discard3Called = false;
  const job3 = {
    id: 'job-3',
    attemptsMade: 4, // 5th attempt
    data: {
      userId: 'user-3',
      dto: { requestId: 'req-3', triggerFlowError: true }
    },
    discard: async () => { discard3Called = true; }
  } as unknown as Job;

  try {
    await processor.process(job3);
  } catch (err: any) {
    console.log(`Caught error: ${err.message}`);
    console.log(`Discard called: ${discard3Called} (expected: true)`);
  }

  console.log(`\nDLQ Content count: ${redisDLQ.length} (expected: 2)`);
  console.log("DLQ item 1 error:", redisDLQ[0]?.error);
  console.log("DLQ item 2 error:", redisDLQ[1]?.error);
  console.log(`Audit logs written: ${auditLogsWritten.length} (expected: 2)`);
  
  if (discard1Called && !discard2Called && discard3Called && redisDLQ.length === 2 && auditLogsWritten.length === 2) {
    console.log("\nTelemetry processor unit tests PASSED successfully!");
    process.exit(0);
  } else {
    console.error("\nTelemetry processor unit tests FAILED!");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
