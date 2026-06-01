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
      const warnings: any[] = [];
      if (dto.triggerFlowError) {
        warnings.push({
          severity: 'WARNING',
          type: 'FLOW_VIOLATION',
          message: "FLOW_VIOLATION: Filling count (8) cannot exceed Blowing output (0)"
        });
      }
      return { log: { success: true }, warnings };
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

  // Test Case 2: Flow Warning (Should succeed on 1st attempt and NOT discard)
  console.log("\n--- TEST 2: Flow Warning (Attempt 1) ---");
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
    const res = await processor.process(job2);
    console.log(`Job 2 processed successfully, returned:`, JSON.stringify(res));
    console.log(`Discard called: ${discard2Called} (expected: false)`);
  } catch (err: any) {
    console.log(`Caught error: ${err.message}`);
  }

  // Test Case 3: Flow Warning (Attempt 5 - Final)
  console.log("\n--- TEST 3: Flow Warning (Attempt 5 - Final) ---");
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
    const res = await processor.process(job3);
    console.log(`Job 3 processed successfully, returned:`, JSON.stringify(res));
    console.log(`Discard called: ${discard3Called} (expected: false)`);
  } catch (err: any) {
    console.log(`Caught error: ${err.message}`);
  }

  console.log(`\nDLQ Content count: ${redisDLQ.length} (expected: 1)`);
  console.log("DLQ item 1 error:", redisDLQ[0]?.error);
  console.log(`Audit logs written: ${auditLogsWritten.length} (expected: 1)`);
  
  if (discard1Called && !discard2Called && !discard3Called && redisDLQ.length === 1 && auditLogsWritten.length === 1) {
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
