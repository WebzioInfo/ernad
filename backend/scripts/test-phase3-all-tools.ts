import 'dotenv/config';
import { db } from '../src/database/db';
import { sql } from 'drizzle-orm';
import { KenbyRouterService } from '../src/modules/ai/kenby-router.service';
import { KenbyRagService } from '../src/modules/ai/kenby-rag.service';
import { KenbyLiveDataService } from '../src/modules/ai/kenby-live-data.service';
import { TtsService } from '../src/modules/ai/tts.service';
import { AiService } from '../src/modules/ai/ai.service';

async function runPhase3Tests() {
  console.log('====================================================');
  console.log('       KENBY AI PHASE 3: LIVE TOOLS & SQL VERIFY   ');
  console.log('====================================================\n');

  const routerService = new KenbyRouterService();
  const ragService = new KenbyRagService();
  const liveDataService = new KenbyLiveDataService();
  const ttsService = new TtsService();
  const aiService = new AiService(ttsService, liveDataService, ragService, routerService);

  let passedCount = 0;
  let totalCount = 0;

  // Helper assertion
  const assertTest = (name: string, condition: boolean, details?: string) => {
    totalCount++;
    if (condition) {
      console.log(`✓ [PASSED] ${name}`);
      passedCount++;
    } else {
      console.error(`❌ [FAILED] ${name} ${details ? `(${details})` : ''}`);
    }
  };

  try {
    // --------------------------------------------------
    // SECTION 1: TOOL VS DIRECT SQL VERIFICATION
    // --------------------------------------------------
    console.log('=== SECTION 1: DIRECT DATABASE SQL VERIFICATION ===\n');

    // 1. Production Tool vs Direct SQL
    console.log('--- 1.1 PRODUCTION TOOL VERIFICATION (July 2026) ---');
    const prodToolRes = await liveDataService.getProductionSummary({
      period: 'specific_month',
      year: 2026,
      month: 7,
    });

    const directProdSql = await db.execute(sql`
      SELECT coalesce(sum(coalesce(pl.cases_produced, pl.primary_count, 0)), 0)::int as total_cases
      FROM production_logs pl
      JOIN production_batches pb ON pb.id = pl.batch_id AND pb.deleted_at IS NULL
      WHERE pl.deleted_at IS NULL AND pl.station = 'PACKING'
        AND extract(year from pl.logged_at) = 2026 AND extract(month from pl.logged_at) = 7
    `);
    const directProdCases = Number(directProdSql[0]?.total_cases || 0);

    console.log('Production Tool Result:', prodToolRes.totalCasesProduced);
    console.log('Direct SQL Result:', directProdCases);
    assertTest('Production Tool matches Direct SQL', prodToolRes.totalCasesProduced === directProdCases);
    console.log('\n');

    // 2. Stock Tool vs Direct SQL
    console.log('--- 1.2 CURRENT STOCK TOOL VERIFICATION ---');
    const stockToolRes = await liveDataService.getCurrentStock();
    const directStockSql = await db.execute(sql`
      SELECT coalesce(sum(coalesce(ps.current_stock, 0)), 0)::numeric as total_stock
      FROM products p
      LEFT JOIN production_stock ps ON ps.product_id = p.id
    `);
    const directStockVal = Number(directStockSql[0]?.total_stock || 0);

    console.log('Stock Tool Result:', stockToolRes.totalCurrentStock);
    console.log('Direct SQL Result:', directStockVal);
    assertTest('Stock Tool matches Direct SQL', stockToolRes.totalCurrentStock === directStockVal);
    console.log('\n');

    // 3. Sales Return Tool vs Direct SQL
    console.log('--- 1.3 SALES RETURN TOOL VERIFICATION (July 2026) ---');
    const returnToolRes = await liveDataService.getSalesReturnSummary({
      period: 'specific_month',
      year: 2026,
      month: 7,
    });
    const directReturnSql = await db.execute(sql`
      SELECT coalesce(sum(quantity), 0)::int as total_return
      FROM sales_transactions
      WHERE type = 'RETURN' AND extract(year from sales_date) = 2026 AND extract(month from sales_date) = 7
    `);
    const directReturnQty = Number(directReturnSql[0]?.total_return || 0);

    console.log('Return Tool Result:', returnToolRes.totalQuantity);
    console.log('Direct SQL Result:', directReturnQty);
    assertTest('Sales Return Tool matches Direct SQL', returnToolRes.totalQuantity === directReturnQty);
    console.log('\n');

    // 4. Damage Tool vs Direct SQL
    console.log('--- 1.4 DAMAGE TOOL VERIFICATION (July 2026) ---');
    const damageToolRes = await liveDataService.getDamageSummary({
      period: 'specific_month',
      year: 2026,
      month: 7,
    });
    const directDamageSql = await db.execute(sql`
      SELECT coalesce(sum(quantity), 0)::int as total_damage
      FROM sales_transactions
      WHERE type = 'DAMAGE' AND extract(year from sales_date) = 2026 AND extract(month from sales_date) = 7
    `);
    const directDamageQty = Number(directDamageSql[0]?.total_damage || 0);

    console.log('Damage Tool Result:', damageToolRes.totalQuantity);
    console.log('Direct SQL Result:', directDamageQty);
    assertTest('Damage Tool matches Direct SQL', damageToolRes.totalQuantity === directDamageQty);
    console.log('\n');

    // --------------------------------------------------
    // SECTION 2: ROUTER & INTENT FLOW TESTS
    // --------------------------------------------------
    console.log('=== SECTION 2: ROUTER & INTENT FLOW TESTS ===\n');

    const routerCases = [
      { q: 'ഈ മാസം production എത്രയാണ്?', expectedIntent: 'production_summary' },
      { q: 'July-ൽ production എത്ര?', expectedIntent: 'production_summary' },
      { q: 'July 12-ന് production എത്ര?', expectedIntent: 'production_summary' },
      { q: 'ഇപ്പോൾ stock എത്ര?', expectedIntent: 'stock_summary' },
      { q: 'Kenby 1 stock എത്ര?', expectedIntent: 'stock_summary', expectedFilter: 'Kenby 1' },
      { q: 'ഈ മാസം return എത്ര?', expectedIntent: 'sales_return_summary' },
      { q: 'July-ൽ return എത്ര?', expectedIntent: 'sales_return_summary' },
      { q: 'ഈ മാസം damage എത്ര?', expectedIntent: 'damage_summary' },
      { q: 'July-ൽ damage എത്ര?', expectedIntent: 'damage_summary' },
      { q: 'Production എന്താണ്?', expectedIntent: 'knowledge' },
      { q: 'Stock എന്താണ്?', expectedIntent: 'knowledge' },
      { q: 'Damage എന്താണ്?', expectedIntent: 'knowledge' },
      { q: 'Sales return എന്താണ്?', expectedIntent: 'knowledge' },
    ];

    for (const rc of routerCases) {
      console.log(`--- Testing Question: "${rc.q}" ---`);
      const intent = await routerService.routeQuestion(rc.q);
      const isMatch = intent.type === rc.expectedIntent;
      let extraMatch = true;
      if (rc.expectedFilter && intent.type === 'stock_summary') {
        extraMatch = intent.productFilter === rc.expectedFilter;
      }
      assertTest(
        `Route "${rc.q}" -> ${rc.expectedIntent}`,
        isMatch && extraMatch,
        `got ${intent.type}`
      );

      const resp = await aiService.askQuestion(rc.q);
      console.log('AiService Source:', resp.source);
      console.log('AiService Answer:', resp.answer.ml);
      console.log('\n');
    }

    console.log('====================================================');
    console.log(`  PHASE 3 ALL TESTS COMPLETED: ${passedCount}/${totalCount} PASSED`);
    console.log('====================================================');

    if (passedCount === totalCount) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('PHASE 3 TEST ERROR:', err);
    process.exit(1);
  }
}

runPhase3Tests();
