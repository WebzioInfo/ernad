import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AiService } from '../src/modules/ai/ai.service';
import { KenbyQueryScopeService } from '../src/modules/ai/scope/kenby-query-scope.service';
import { KenbyToolExecutorService } from '../src/modules/ai/tools/kenby-tool-executor.service';

async function runUniversalQueryScopeSuite() {
  console.log('================================================================');
  console.log('🚀 RUNNING KENBY UNIVERSAL QUERY SCOPE & REAL-DATA VERIFICATION');
  console.log('================================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const aiService = app.get(AiService);
  const scopeService = app.get(KenbyQueryScopeService);
  const toolExecutor = app.get(KenbyToolExecutorService);

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

  function assertNoRawJson(text: string, testName: string) {
    const isRaw =
      text.startsWith('Data:') ||
      text.startsWith('data:') ||
      text.includes('Data retrieved:') ||
      (text.includes('{') && text.includes('}') && text.includes('"id":')) ||
      (text.includes('[') && text.includes(']') && text.includes('"type":'));
    assert(!isRaw, `No raw JSON in: ${testName}`, isRaw ? text : undefined);
  }

  // ──────────────────────────────────────────────────────────
  // 1. QUERY SCOPE CLASSIFICATION TESTS
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 1. QUERY SCOPE CLASSIFIER TESTS ---');

  const scopeFullData = await scopeService.resolveScope('August month total data');
  assert(
    scopeFullData.intent === 'FULL_ERP_SUMMARY' && scopeFullData.requiresMultiDomainExecution,
    'Scope: "August month total data" resolves to FULL_ERP_SUMMARY with multi-domain execution'
  );

  const scopeSalesHistory = await scopeService.resolveScope('Sinan sales history');
  assert(
    scopeSalesHistory.intent === 'TRANSACTION_HISTORY' && scopeSalesHistory.domains.includes('sales'),
    'Scope: "Sinan sales history" resolves to TRANSACTION_HISTORY for sales'
  );

  const scopeYesterdayProd = await scopeService.resolveScope('yesterday production details');
  assert(
    scopeYesterdayProd.domains.includes('production') && scopeYesterdayProd.period?.periodType === 'yesterday',
    'Scope: "yesterday production details" resolves to production domain with yesterday period'
  );

  const scopeProdList = await scopeService.resolveScope('all products');
  assert(
    scopeProdList.intent === 'ENTITY_LIST' && scopeProdList.domains.includes('inventory'),
    'Scope: "all products" resolves to ENTITY_LIST'
  );

  // ──────────────────────────────────────────────────────────
  // 2. TOOL EXECUTION TESTS: FULL ERP SUMMARY & TRANSACTIONS
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 2. FULL ERP SUMMARY & TRANSACTION TOOL TESTS ---');

  const fullSummary = await toolExecutor.executeTool('get_full_erp_summary', { period: 'specific_month', year: 2026, month: 8 });
  assert(
    fullSummary.success &&
      fullSummary.data.sales !== undefined &&
      fullSummary.data.production !== undefined &&
      fullSummary.data.inventory !== undefined &&
      fullSummary.data.rawMaterials !== undefined,
    'get_full_erp_summary retrieves multi-domain summary (sales, production, inventory, raw materials)'
  );

  const salesTx = await toolExecutor.executeTool('get_sales_transactions', { limit: 5 });
  assert(salesTx.success && Array.isArray(salesTx.data), 'get_sales_transactions executes cleanly');

  // ──────────────────────────────────────────────────────────
  // 3. END-TO-END AI CHAT & ZERO RAW-JSON VERIFICATION
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 3. END-TO-END AI CHAT & ZERO RAW-JSON VERIFICATION ---');

  // Test 1: "sales history"
  const q1 = await aiService.askQuestion('sales history', { language: 'en' });
  console.log(`Q1: "sales history" -> "${q1.answer.en.substring(0, 120)}..."`);
  assert(q1.answer.en.includes('transaction') || q1.answer.en.includes('sales') || q1.answer.en.includes('No sales'), 'Q1: "sales history" produces formatted transaction text');
  assertNoRawJson(q1.answer.en, 'Q1 English');
  assertNoRawJson(q1.answer.ml, 'Q1 Malayalam');

  // Test 2: "Sinan sales history"
  const q2 = await aiService.askQuestion('Sinan sales history', { language: 'en' });
  console.log(`Q2: "Sinan sales history" -> "${q2.answer.en.substring(0, 120)}..."`);
  assert(
    !q2.answer.en.includes('outstanding balance is ₹0') && (q2.answer.en.includes('Sinan') || q2.answer.en.includes('transaction')),
    'Q2: "Sinan sales history" queries sales transactions and NOT customer balance'
  );
  assertNoRawJson(q2.answer.en, 'Q2 English');

  // Test 3: "yesterday production details"
  const q3 = await aiService.askQuestion('yesterday production details', { language: 'en' });
  console.log(`Q3: "yesterday production details" -> "${q3.answer.en}"`);
  assert(
    q3.answer.en.includes('production') || q3.answer.en.includes('Production') || q3.answer.en.includes('No production records'),
    'Q3: "yesterday production details" produces readable production summary'
  );
  assertNoRawJson(q3.answer.en, 'Q3 English');

  // Test 4: "August month total data" (Full Multi-Domain Summary)
  const q4 = await aiService.askQuestion('August month total data', { language: 'en' });
  console.log(`Q4: "August month total data" ->\n${q4.answer.en}\n`);
  assert(
    (q4.answer.en.includes('Sales') || q4.answer.en.includes('sales')) &&
      (q4.answer.en.includes('Production') || q4.answer.en.includes('production')) &&
      (q4.answer.en.includes('Inventory') || q4.answer.en.includes('stock') || q4.answer.en.includes('Raw Materials')),
    'Q4: "August month total data" returns FULL MULTI-DOMAIN ERP SUMMARY across all modules'
  );
  assertNoRawJson(q4.answer.en, 'Q4 English');

  // Test 5: "all raw materials"
  const q5 = await aiService.askQuestion('all raw materials', { language: 'en' });
  console.log(`Q5: "all raw materials" -> "${q5.answer.en.substring(0, 120)}..."`);
  assert(q5.answer.en.includes('Raw Materials') || q5.answer.en.includes('Cap') || q5.answer.en.includes('Preform'), 'Q5: "all raw materials" lists materials');
  assertNoRawJson(q5.answer.en, 'Q5 English');

  // Test 6: "all products"
  const q6 = await aiService.askQuestion('all products', { language: 'en' });
  console.log(`Q6: "all products" -> "${q6.answer.en.substring(0, 120)}..."`);
  assert(q6.answer.en.includes('Kenby 1') || q6.answer.en.includes('Aquora') || q6.answer.en.includes('Products'), 'Q6: "all products" lists registered products');
  assertNoRawJson(q6.answer.en, 'Q6 English');

  // Test 7: Context Override: Q1 = "Sinan outstanding", Q2 = "Sinan sales history"
  const q7_1 = await aiService.askQuestion("What is Sinan's outstanding?", { language: 'en' });
  const q7_2 = await aiService.askQuestion("Show Sinan's sales history", { ...q7_1.context, language: 'en' });
  console.log(`Q7_2 (Context Override): "${q7_2.answer.en.substring(0, 120)}..."`);
  assert(
    !q7_2.answer.en.includes('outstanding balance is ₹0'),
    'Q7: Explicit current domain (sales history) overrides previous context (outstanding balance)'
  );

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  await app.close();

  if (failed > 0) {
    process.exit(1);
  }
}

runUniversalQueryScopeSuite().catch((err) => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
