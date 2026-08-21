import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AiService } from '../src/modules/ai/ai.service';
import { KenbyToolExecutorService } from '../src/modules/ai/tools/kenby-tool-executor.service';
import { KenbyErpRegistryService } from '../src/modules/ai/kenby-erp-registry.service';
import { KenbyLiveDataService } from '../src/modules/ai/kenby-live-data.service';
import { GroqLlmService } from '../src/modules/ai/llm/groq-llm.service';

async function runComprehensiveIntelligenceSuite() {
  console.log('================================================================');
  console.log('🚀 RUNNING KENBY UNIVERSAL ERP ACCURACY & INTELLIGENCE TEST SUITE');
  console.log('================================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const aiService = app.get(AiService);
  const toolExecutor = app.get(KenbyToolExecutorService);
  const erpRegistry = app.get(KenbyErpRegistryService);
  const liveDataService = app.get(KenbyLiveDataService);
  const groqService = app.get(GroqLlmService);

  let passed = 0;
  let failed = 0;

  async function assertTest(name: string, fn: () => Promise<boolean>) {
    try {
      const result = await fn();
      if (result) {
        console.log(`✅ [PASS] ${name}`);
        passed++;
      } else {
        console.error(`❌ [FAIL] ${name}`);
        failed++;
      }
    } catch (err: any) {
      console.error(`❌ [ERROR] ${name}: ${err.message}`);
      failed++;
    }
  }

  // ── TEST 1: STRICT DATE BOUNDARIES & ZERO-DATA HONESTY ──
  console.log('\n--- SUITE 1: STRICT DATE BOUNDARIES & ZERO-DATA HONESTY ---');

  await assertTest('Period normalization for exact ISO date (2026-08-02)', async () => {
    const res = toolExecutor.normalizePeriodInput({ date: '2026-08-02' });
    return res.period === 'specific_date' && res.date === '2026-08-02';
  });

  await assertTest('Period normalization for specific month (2026-06)', async () => {
    const res = toolExecutor.normalizePeriodInput({ period: '2026-06' });
    return res.period === 'specific_month' && res.year === 2026 && res.month === 6;
  });

  await assertTest('Zero sales on August 2 returns 0 quantity and 0 recordsFound', async () => {
    const res = await toolExecutor.executeTool('get_sales_summary', { date: '2026-08-02' });
    return res.success && Number(res.data.totalQuantity) === 0 && res.recordsFound === 0;
  });

  await assertTest('Live sales on August 15 returns exact 1000 quantity', async () => {
    const res = await toolExecutor.executeTool('get_sales_summary', { date: '2026-08-15' });
    return res.success && Number(res.data.totalQuantity) === 1000 && res.recordsFound === 1;
  });

  // ── TEST 2: DYNAMIC DATABASE LISTING TOOLS ──
  console.log('\n--- SUITE 2: DYNAMIC DATABASE LISTING TOOLS ---');

  await assertTest('list_products returns all products from database', async () => {
    const res = await toolExecutor.executeTool('list_products', {});
    return res.success && Array.isArray(res.data) && res.data.length > 0 && res.data.some((p: any) => p.name.includes('Kenby'));
  });

  await assertTest('list_raw_materials returns all raw materials with stock and units', async () => {
    const res = await toolExecutor.executeTool('list_raw_materials', {});
    return res.success && Array.isArray(res.data) && res.data.length > 0 && res.data.some((m: any) => m.materialType);
  });

  await assertTest('list_customers returns real customer records', async () => {
    const res = await toolExecutor.executeTool('list_customers', { limit: 20 });
    return res.success && Array.isArray(res.data) && res.data.length > 0;
  });

  await assertTest('list_vendors executes successfully and returns array', async () => {
    const res = await toolExecutor.executeTool('list_vendors', {});
    return res.success && Array.isArray(res.data);
  });

  await assertTest('list_employees returns active staff members', async () => {
    const res = await toolExecutor.executeTool('list_employees', {});
    return res.success && Array.isArray(res.data) && res.data.length > 0;
  });

  // ── TEST 3: ENTITY RESOLUTION & DISAMBIGUATION ──
  console.log('\n--- SUITE 3: ENTITY RESOLUTION & DISAMBIGUATION ---');

  await assertTest('searchEntities resolves exact match for unique customer (Sinan)', async () => {
    const res = await erpRegistry.searchEntities('Sinan');
    return res.status === 'EXACT_MATCH' || res.status === 'HIGH_CONFIDENCE_MATCH';
  });

  await assertTest('searchEntities identifies multiple matches for ambiguous query (500)', async () => {
    const res = await erpRegistry.searchEntities('500');
    return res.status === 'MULTIPLE_MATCHES' && res.matches.length >= 2;
  });

  await assertTest('searchEntities returns NO_MATCH for non-existent entity', async () => {
    const res = await erpRegistry.searchEntities('XYZ_NONEXISTENT_12345');
    return res.status === 'NO_MATCH' && res.matches.length === 0;
  });

  // ── TEST 4: RAW MATERIAL & INVENTORY INTELLIGENCE ──
  console.log('\n--- SUITE 4: RAW MATERIAL & INVENTORY INTELLIGENCE ---');

  await assertTest('get_raw_material_stock retrieves material profile', async () => {
    const res = await toolExecutor.executeTool('get_raw_material_stock', { material: 'Cap' });
    return res.success && res.data !== null && res.data.material !== undefined;
  });

  await assertTest('get_low_stock_items identifies stock requiring attention', async () => {
    const res = await toolExecutor.executeTool('get_low_stock_items', {});
    return res.success && res.data.negativeRawMaterials !== undefined && res.data.lowInventoryStock !== undefined;
  });

  // ── TEST 5: TRANSACTION HISTORY TOOLS ──
  console.log('\n--- SUITE 5: TRANSACTION HISTORY TOOLS ---');

  await assertTest('get_sales_transactions retrieves recent sales logs', async () => {
    const res = await toolExecutor.executeTool('get_sales_transactions', { limit: 5 });
    return res.success && Array.isArray(res.data) && res.data.length > 0;
  });

  // ── TEST 6: END-TO-END GROQ LLM & SYNTHESIS ORCHESTRATION ──
  console.log('\n--- SUITE 6: END-TO-END GROQ LLM & SYNTHESIS ORCHESTRATION ---');

  await assertTest('Ask AI: "August 2-ന് എത്ര sales ഉണ്ടായിരുന്നു?" -> Strict zero-record answer', async () => {
    const res = await aiService.askQuestion('August 2-ന് എത്ര sales ഉണ്ടായിരുന്നു?');
    const ans = res.answer.ml.toLowerCase();
    return ans.includes('കണ്ടെത്താനായില്ല') || ans.includes('0') || ans.includes('records ഒന്നും');
  });

  await assertTest('Ask AI: "August 15 sales എത്ര" -> Returns 1,000 cases', async () => {
    const res = await aiService.askQuestion('August 15 sales എത്ര');
    const ans = res.answer.ml;
    return ans.includes('1,000') || ans.includes('1000');
  });

  await assertTest('Ask AI: "എല്ലാ products ഏതൊക്കെയാണ്?" -> Lists products', async () => {
    const res = await aiService.askQuestion('എല്ലാ products ഏതൊക്കെയാണ്?');
    const ans = res.answer.ml;
    return ans.includes('Kenby') || ans.includes('ഉൽപ്പന്നങ്ങൾ') || ans.includes('Products');
  });

  await assertTest('Ask AI: Financial guardrail for company profit/loss', async () => {
    const res = await aiService.askQuestion('കമ്പനിയുടെ net profit എത്രയാണ്?');
    const ans = res.answer.ml;
    return ans.includes('ലഭ്യമല്ല') || ans.includes('not managed');
  });

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  await app.close();

  if (failed > 0) {
    process.exit(1);
  }
}

runComprehensiveIntelligenceSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
