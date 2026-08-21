import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AiService } from '../src/modules/ai/ai.service';
import { KenbyQueryScopeService } from '../src/modules/ai/scope/kenby-query-scope.service';
import { GroqLlmService } from '../src/modules/ai/llm/groq-llm.service';

async function runRoutingAccuracySuite() {
  console.log('================================================================');
  console.log('🛡️  RUNNING KENBY ROUTING ACCURACY & NEGATIVE TEST SUITE');
  console.log('================================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const aiService = app.get(AiService);
  const scopeService = app.get(KenbyQueryScopeService);
  const groqService = app.get(GroqLlmService);

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

  function assertNeverStockFallback(answerEn: string, answerMl: string, testName: string) {
    const isStockMl = answerMl.includes('1,980 കേസുകൾ സ്റ്റോക്കിലുണ്ട്') || answerMl.includes('നിലവിൽ ആകെ 1,980');
    const isStockEn = answerEn.includes('1,980 cases in stock') || answerEn.includes('Current stock is 1,980');
    assert(!isStockMl && !isStockEn, `${testName} -> NEVER falls back to default stock (1,980 cases)`, `En: "${answerEn.substring(0, 100)}" | Ml: "${answerMl.substring(0, 100)}"`);
  }

  // ──────────────────────────────────────────────────────────
  // 1. DAMAGE ROUTING & NEGATIVE STOCK TESTS
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 1. DAMAGE ROUTING TESTS ---');

  const scopeDamage1 = await scopeService.resolveScope('case damage എത്ര?');
  assert(scopeDamage1.domains.includes('damage'), 'Scope: "case damage എത്ര?" resolves to domain "damage"');

  const scopeDamage2 = await scopeService.resolveScope('damage cases');
  assert(scopeDamage2.domains.includes('damage'), 'Scope: "damage cases" resolves to domain "damage"');

  const planDamage = await groqService.generatePlan('case damage എത്ര?');
  assert(
    planDamage.tasks.some((t) => t.tool === 'get_damage_summary'),
    'Plan: "case damage എത്ര?" selects get_damage_summary'
  );
  assert(
    !planDamage.tasks.some((t) => t.tool === 'get_finished_goods_stock' || t.tool === 'get_product_stock'),
    'Plan: "case damage എത്ര?" NEVER selects stock tools'
  );

  const resDamage = await aiService.askQuestion('case damage എത്ര?', { language: 'ml' });
  console.log(`Damage answer (ml): "${resDamage.answer.ml}"`);
  assertNeverStockFallback(resDamage.answer.en, resDamage.answer.ml, 'AI Ask: "case damage എത്ര?"');
  assert(resDamage.answer.ml.includes('damage') || resDamage.answer.ml.includes('ഡാമേജ്'), 'AI Ask: "case damage എത്ര?" returns damage answer');

  // ──────────────────────────────────────────────────────────
  // 2. SALES RETURN ROUTING & NEGATIVE STOCK TESTS
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 2. SALES RETURN ROUTING TESTS ---');

  const scopeReturn = await scopeService.resolveScope('sales return എത്ര?');
  assert(scopeReturn.domains.includes('returns'), 'Scope: "sales return എത്ര?" resolves to domain "returns"');

  const resReturn = await aiService.askQuestion('sales return എത്ര?', { language: 'en' });
  console.log(`Return answer (en): "${resReturn.answer.en}"`);
  assertNeverStockFallback(resReturn.answer.en, resReturn.answer.ml, 'AI Ask: "sales return എത്ര?"');
  assert(resReturn.answer.en.includes('return') || resReturn.answer.en.includes('Return'), 'AI Ask: "sales return എത്ര?" returns return answer');

  // ──────────────────────────────────────────────────────────
  // 3. RAW MATERIAL ROUTING & NON-PRODUCT STOCK TESTS
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 3. RAW MATERIAL ROUTING TESTS ---');

  const scopeRaw1 = await scopeService.resolveScope('Green Cap stock എത്ര?');
  assert(scopeRaw1.domains.includes('raw_materials'), 'Scope: "Green Cap stock എത്ര?" resolves to domain "raw_materials"');

  const resRaw1 = await aiService.askQuestion('Green Cap stock എത്ര?', { language: 'en' });
  console.log(`Green Cap stock (en): "${resRaw1.answer.en}"`);
  assertNeverStockFallback(resRaw1.answer.en, resRaw1.answer.ml, 'AI Ask: "Green Cap stock എത്ര?"');
  assert(resRaw1.answer.en.includes('Green Cap') || resRaw1.answer.en.includes('BOX'), 'AI Ask: "Green Cap stock" answers about Green Cap');

  const resRaw2 = await aiService.askQuestion('all raw materials', { language: 'en' });
  console.log(`All raw materials (en): "${resRaw2.answer.en.substring(0, 100)}..."`);
  assertNeverStockFallback(resRaw2.answer.en, resRaw2.answer.ml, 'AI Ask: "all raw materials"');
  assert(resRaw2.answer.en.includes('Raw Materials') || resRaw2.answer.en.includes('Cap'), 'AI Ask: "all raw materials" lists materials');

  // ──────────────────────────────────────────────────────────
  // 4. CUSTOMER SALES HISTORY TESTS
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 4. CUSTOMER SALES HISTORY TESTS ---');

  const scopeCustSales = await scopeService.resolveScope('Sinan sales history');
  assert(scopeCustSales.intent === 'TRANSACTION_HISTORY', 'Scope: "Sinan sales history" resolves to TRANSACTION_HISTORY');

  const resCustSales = await aiService.askQuestion('Sinan sales history', { language: 'en' });
  console.log(`Sinan sales history (en): "${resCustSales.answer.en.substring(0, 100)}..."`);
  assertNeverStockFallback(resCustSales.answer.en, resCustSales.answer.ml, 'AI Ask: "Sinan sales history"');
  assert(!resCustSales.answer.en.includes('outstanding balance is ₹0'), 'AI Ask: "Sinan sales history" is NOT customer balance');

  // ──────────────────────────────────────────────────────────
  // 5. PRODUCTION QUERY TESTS
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 5. PRODUCTION QUERY TESTS ---');

  const scopeProd = await scopeService.resolveScope('yesterday production details');
  assert(scopeProd.domains.includes('production'), 'Scope: "yesterday production details" resolves to domain "production"');

  const resProd = await aiService.askQuestion('yesterday production details', { language: 'en' });
  console.log(`Yesterday production (en): "${resProd.answer.en}"`);
  assertNeverStockFallback(resProd.answer.en, resProd.answer.ml, 'AI Ask: "yesterday production details"');

  // ──────────────────────────────────────────────────────────
  // 6. TOTAL / ALL DATA COMPOSITE SUMMARY TESTS
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 6. TOTAL DATA COMPOSITE SUMMARY TESTS ---');

  const scopeTotal = await scopeService.resolveScope('August month total data');
  assert(scopeTotal.intent === 'FULL_ERP_SUMMARY', 'Scope: "August month total data" resolves to FULL_ERP_SUMMARY');
  assert(scopeTotal.requiresMultiDomainExecution, 'Scope: "August month total data" requires multi-domain execution');

  const resTotal = await aiService.askQuestion('August month total data', { language: 'en' });
  console.log(`August total data (en):\n${resTotal.answer.en}\n`);
  assert(
    resTotal.answer.en.includes('Sales') &&
      resTotal.answer.en.includes('Returns') &&
      resTotal.answer.en.includes('Production') &&
      resTotal.answer.en.includes('Inventory'),
    'AI Ask: "August month total data" returns composite multi-domain summary'
  );

  // ──────────────────────────────────────────────────────────
  // 7. CONTEXT OVERRIDE TESTS (PREVENTS OLD CONTEXT HIJACKING)
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 7. CONTEXT OVERRIDE TESTS ---');

  // Step 1: User asks for stock
  const turn1 = await aiService.askQuestion('നിലവിൽ stock എത്ര?', { language: 'ml' });
  console.log(`Turn 1 (Stock): "${turn1.answer.ml}"`);
  assert(turn1.answer.ml.includes('1,980') || turn1.answer.ml.includes('കേസുകൾ'), 'Turn 1 answers stock correctly');

  // Step 2: User explicitly asks for case damage with previous stock context
  const turn2 = await aiService.askQuestion('case damage എത്ര?', { ...turn1.context, language: 'ml' });
  console.log(`Turn 2 (Damage with old context): "${turn2.answer.ml}"`);
  assertNeverStockFallback(turn2.answer.en, turn2.answer.ml, 'Turn 2: "case damage എത്ര?" with previous stock context');
  assert(turn2.answer.ml.includes('damage') || turn2.answer.ml.includes('ഡാമേജ്'), 'Turn 2 explicit damage intent overrides old stock context');

  // ──────────────────────────────────────────────────────────
  // 8. UNKNOWN / AMBIGUOUS INTENT CLARIFICATION TESTS
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 8. UNKNOWN / AMBIGUOUS INTENT CLARIFICATION TESTS ---');

  const scopeUnknown = await scopeService.resolveScope('qwertyuiop xyz 12345');
  assert(
    scopeUnknown.intent === 'CLARIFICATION_REQUIRED' && scopeUnknown.requiresClarification,
    'Scope: Random unknown query resolves to CLARIFICATION_REQUIRED'
  );

  const resUnknown = await aiService.askQuestion('qwertyuiop xyz 12345', { language: 'en' });
  console.log(`Unknown query response (en): "${resUnknown.answer.en}"`);
  assertNeverStockFallback(resUnknown.answer.en, resUnknown.answer.ml, 'AI Ask: Random unknown query');
  assert(
    resUnknown.answer.en.includes('specify') || resUnknown.answer.en.includes('understand') || resUnknown.answer.en.includes('Sales, Production, Stock'),
    'AI Ask: Random unknown query returns clarification message'
  );

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  await app.close();

  if (failed > 0) {
    process.exit(1);
  }
}

runRoutingAccuracySuite().catch((err) => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
