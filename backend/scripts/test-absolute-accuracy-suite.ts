import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AiService } from '../src/modules/ai/ai.service';
import { KenbyDateResolverService } from '../src/modules/ai/dates/kenby-date-resolver.service';
import { KenbyGroundingValidatorService } from '../src/modules/ai/grounding/kenby-grounding-validator.service';
import { KenbyToolExecutorService } from '../src/modules/ai/tools/kenby-tool-executor.service';
import { KenbyEntityResolverService } from '../src/modules/ai/kenby-entity-resolver.service';
import { AnswerEvidence } from '../src/modules/ai/grounding/kenby-grounding.interface';

async function runAbsoluteAccuracySuite() {
  console.log('================================================================');
  console.log('🚀 RUNNING KENBY ABSOLUTE DATA ACCURACY & EVIDENCE TEST SUITE');
  console.log('================================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const aiService = app.get(AiService);
  const dateResolver = app.get(KenbyDateResolverService);
  const groundingValidator = app.get(KenbyGroundingValidatorService);
  const toolExecutor = app.get(KenbyToolExecutorService);
  const entityResolver = app.get(KenbyEntityResolverService);

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  // ──────────────────────────────────────────────────────────
  // SUITE 1: DETERMINISTIC DATE RESOLUTION & ZERO-DATA HONESTY
  // ──────────────────────────────────────────────────────────
  console.log('\n--- SUITE 1: DETERMINISTIC DATE RESOLUTION & ZERO DATA HONESTY ---');

  const aug2Bound = dateResolver.resolveDateBounds({ date: '2026-08-02' });
  assert(
    aug2Bound.isExactDate && aug2Bound.exactDate === '2026-08-02',
    'DateResolver resolves ISO date 2026-08-02 to exact date boundary'
  );

  const naturalAug2 = dateResolver.resolveDateBounds({ period: 'August 2' });
  assert(
    naturalAug2.isExactDate && naturalAug2.exactDate === '2026-08-02',
    'DateResolver resolves "August 2" to exact 2026-08-02'
  );

  const prevMonthMath = dateResolver.resolveDateBounds({ question: 'July-ന് മുമ്പുള്ള മാസം' });
  assert(
    prevMonthMath.year === 2026 && prevMonthMath.month === 6,
    'DateResolver resolves "July-ന് മുമ്പുള്ള മാസം" to June 2026'
  );

  // Exact DB query for August 2 (0 sales in DB)
  const aug2Result = await toolExecutor.executeTool('get_sales_summary', { period: 'specific_date', date: '2026-08-02' });
  assert(
    aug2Result.success && aug2Result.recordsFound === 0 && aug2Result.data.totalQuantity === 0,
    'Database returns exactly 0 quantity and 0 records for August 2',
    `got qty=${aug2Result.data?.totalQuantity}`
  );

  // Exact DB query for August 15 (1000 sales in DB)
  const aug15Result = await toolExecutor.executeTool('get_sales_summary', { period: 'specific_date', date: '2026-08-15' });
  assert(
    aug15Result.success && aug15Result.data.totalQuantity === 1000,
    'Database returns exactly 1,000 cases for August 15',
    `got qty=${aug15Result.data?.totalQuantity}`
  );

  // ──────────────────────────────────────────────────────────
  // SUITE 2: ANSWER EVIDENCE & GROUNDING VALIDATION
  // ──────────────────────────────────────────────────────────
  console.log('\n--- SUITE 2: ANSWER EVIDENCE & GROUNDING VALIDATION ---');

  const validEvidence: AnswerEvidence = {
    source: 'DATABASE',
    toolsExecuted: ['get_sales_summary'],
    queryPeriod: { type: 'exact_date', exactDate: '2026-08-15', label: 'August 15, 2026' },
    entities: [],
    recordCount: 1,
    extractedNumbers: [1000, 1],
    resultData: { totalQuantity: 1000, transactionCount: 1 },
    isValidated: true,
  };

  const validAnswer = {
    ml: '2026-08-15-ൽ ആകെ 1,000 യൂണിറ്റ് sales dispatch ചെയ്തിട്ടുണ്ട് (1 ഇടപാടുകൾ).',
    en: 'Total 1,000 units dispatched on 2026-08-15 across 1 transactions.',
  };

  const validCheck = groundingValidator.validateAnswer(validAnswer, validEvidence);
  assert(validCheck.isValid, 'GroundingValidator approves factually grounded answer containing verified numbers');

  // NEGATIVE TEST: Injected fabricated number
  const fabricatedAnswer = {
    ml: '2026-08-15-ൽ ആകെ 99,999 യൂണിറ്റ് sales നടന്നു.',
    en: 'Total 99,999 units were sold on 2026-08-15.',
  };

  const fabricatedCheck = groundingValidator.validateAnswer(fabricatedAnswer, validEvidence);
  assert(
    !fabricatedCheck.isValid && fabricatedCheck.violations.some((v) => v.includes('UNGROUNDED_NUMBER')),
    'GroundingValidator REJECTS answer containing fabricated number (99,999)'
  );

  // ZERO-DATA HONESTY ENFORCEMENT TEST
  const zeroEvidence: AnswerEvidence = {
    source: 'DATABASE',
    toolsExecuted: ['get_sales_summary'],
    queryPeriod: { type: 'exact_date', exactDate: '2026-08-02', label: 'August 2, 2026' },
    entities: [],
    recordCount: 0,
    extractedNumbers: [0],
    resultData: { totalQuantity: 0, transactionCount: 0 },
    isValidated: true,
  };

  const hallucinatedPositiveAnswer = {
    ml: '2026-08-02-ൽ 1000 കേസുകൾ വിറ്റു.',
    en: '1000 cases were sold on 2026-08-02.',
  };

  const zeroCheck = groundingValidator.validateAnswer(hallucinatedPositiveAnswer, zeroEvidence);
  assert(
    !zeroCheck.isValid && !!zeroCheck.enforcedAnswer,
    'GroundingValidator BLOCKS positive quantity on zero-record date and enforces zero-data response'
  );

  // ──────────────────────────────────────────────────────────
  // SUITE 3: DYNAMIC ERP LISTING & DETAIL TOOLS
  // ──────────────────────────────────────────────────────────
  console.log('\n--- SUITE 3: DYNAMIC DATABASE LISTING TOOLS ---');

  const prodList = await toolExecutor.executeTool('list_products', {});
  assert(prodList.success && Array.isArray(prodList.data) && prodList.data.length > 0, 'list_products returns products from database');

  const rawList = await toolExecutor.executeTool('list_raw_materials', {});
  assert(rawList.success && Array.isArray(rawList.data) && rawList.data.length > 0, 'list_raw_materials returns raw materials with stock');

  const custList = await toolExecutor.executeTool('list_customers', {});
  assert(custList.success && Array.isArray(custList.data), 'list_customers returns real customer records');

  const vendList = await toolExecutor.executeTool('list_vendors', {});
  assert(vendList.success && Array.isArray(vendList.data), 'list_vendors executes successfully');

  const empList = await toolExecutor.executeTool('list_employees', {});
  assert(empList.success && Array.isArray(empList.data), 'list_employees returns active staff directory');

  // ──────────────────────────────────────────────────────────
  // SUITE 4: SAFE ENTITY RESOLUTION & DISAMBIGUATION
  // ──────────────────────────────────────────────────────────
  console.log('\n--- SUITE 4: SAFE ENTITY RESOLUTION & DISAMBIGUATION ---');

  const exactCustomer = await entityResolver.resolveEntity('Sinan');
  assert(
    exactCustomer.matchStatus === 'exact' || exactCustomer.matchStatus === 'partial',
    'EntityResolver resolves customer "Sinan"'
  );

  const ambiguousEntity = await entityResolver.resolveEntity('500');
  assert(
    ambiguousEntity.matchStatus === 'ambiguous' || (ambiguousEntity.ambiguousCandidates?.length || 0) > 0,
    'EntityResolver identifies ambiguity for generic query "500" without silently guessing'
  );

  const noMatch = await entityResolver.resolveEntity('NonExistentBrandXYZ');
  assert(noMatch.matchStatus === 'none', 'EntityResolver returns "none" for non-existent entity');

  // ──────────────────────────────────────────────────────────
  // SUITE 5: TRANSACTION HISTORY & MULTI-TURN DRILL-DOWN
  // ──────────────────────────────────────────────────────────
  console.log('\n--- SUITE 5: TRANSACTION HISTORY & MULTI-TURN DRILL-DOWN ---');

  const txLogs = await toolExecutor.executeTool('get_sales_transactions', { limit: 5 });
  assert(txLogs.success && Array.isArray(txLogs.data), 'get_sales_transactions retrieves transaction logs');

  const custBal = await toolExecutor.executeTool('get_customer_balance', { customer: 'Sinan' });
  assert(custBal.success && custBal.data !== null, 'get_customer_balance retrieves customer financial ledger');

  // ──────────────────────────────────────────────────────────
  // SUITE 6: END-TO-END AI ORCHESTRATION WITH REAL GROQ LLM
  // ──────────────────────────────────────────────────────────
  console.log('\n--- SUITE 6: END-TO-END AI ORCHESTRATION & PROVENANCE ---');

  // Case 1: Exact Date 0 Records
  const q1 = await aiService.askQuestion('August 2-ന് എത്ര sales ഉണ്ടായിരുന്നു?', { language: 'ml' });
  console.log(`Q: "August 2-ന് എത്ര sales ഉണ്ടായിരുന്നു?" -> A: "${q1.answer.ml}" [Source: ${q1.source}]`);
  assert(
    q1.answer.ml.includes('ഒന്നും') || q1.answer.ml.includes('0') || q1.answer.ml.includes('കണ്ടെത്താനായില്ല') || q1.answer.en.includes('No sales') || q1.answer.en.includes('0'),
    'Ask AI: Exact Date August 2 produces strict zero-record answer',
    q1.answer.ml
  );

  // Case 2: Exact Date 1000 Cases
  const q2 = await aiService.askQuestion('August 15 sales എത്ര', { language: 'ml' });
  console.log(`Q: "August 15 sales എത്ര" -> A: "${q2.answer.ml}" [Source: ${q2.source}]`);
  assert(
    q2.answer.ml.includes('1,000') || q2.answer.ml.includes('1000') || q2.answer.en.includes('1,000') || q2.answer.en.includes('1000'),
    'Ask AI: Exact Date August 15 produces verified 1,000 cases',
    q2.answer.ml
  );

  // Case 3: List Products
  const q3 = await aiService.askQuestion('എല്ലാ products ഏതൊക്കെയാണ്?', { language: 'ml' });
  console.log(`Q: "എല്ലാ products ഏതൊക്കെയാണ്?" -> A: "${q3.answer.ml.substring(0, 100)}..." [Source: ${q3.source}]`);
  assert(
    q3.answer.ml.includes('Kenby') || q3.answer.en.includes('Kenby') || q3.answer.ml.includes('ഉൽപ്പന്നങ്ങൾ') || q3.answer.en.includes('Products'),
    'Ask AI: Universal product list returns registered products',
    q3.answer.ml
  );

  // Case 4: Unsupported Financial Guardrail
  const q4 = await aiService.askQuestion('കമ്പനിയുടെ net profit എത്രയാണ്?', { language: 'ml' });
  console.log(`Q: "കമ്പനിയുടെ net profit എത്രയാണ്?" -> A: "${q4.answer.ml}" [Source: ${q4.source}]`);
  assert(
    q4.answer.ml.includes('ലഭ്യമല്ല') || q4.answer.en.includes('not managed') || q4.answer.en.includes('not available'),
    'Ask AI: Unsupported financial query triggers honest guardrail message'
  );

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  await app.close();

  if (failed > 0) {
    process.exit(1);
  }
}

runAbsoluteAccuracySuite().catch((err) => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
