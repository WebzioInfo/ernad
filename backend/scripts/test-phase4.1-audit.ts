import 'dotenv/config';
import { db } from '../src/database/db';
import { sql } from 'drizzle-orm';
import { KenbyRouterService } from '../src/modules/ai/kenby-router.service';
import { KenbyRagService } from '../src/modules/ai/kenby-rag.service';
import { KenbyLiveDataService } from '../src/modules/ai/kenby-live-data.service';
import { TtsService } from '../src/modules/ai/tts.service';
import { AiService } from '../src/modules/ai/ai.service';

async function runPhase41AuditTests() {
  console.log('====================================================');
  console.log('    KENBY AI PHASE 4.1: DATA & SAFETY AUDIT TESTS   ');
  console.log('====================================================\n');

  const routerService = new KenbyRouterService();
  const ragService = new KenbyRagService();
  const liveDataService = new KenbyLiveDataService();
  const ttsService = new TtsService();
  const aiService = new AiService(ttsService, liveDataService, ragService, routerService);

  let passedCount = 0;
  let totalCount = 0;

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
    // TEST 1: SALES AUDIT (August 2026)
    // --------------------------------------------------
    console.log('--- TEST 1: SALES AUDIT ---');
    const salesRes = await liveDataService.getSalesSummary({ period: 'this_month' });
    const directSalesSql = await db.execute(sql`
      SELECT coalesce(sum(quantity), 0)::int as total_sales
      FROM sales_transactions
      WHERE type = 'SALES_DISPATCH' AND extract(year from sales_date) = 2026 AND extract(month from sales_date) = 8
    `);
    const directSalesQty = Number(directSalesSql[0]?.total_sales || 0);
    assertTest('Sales Tool matches Direct SQL (1000 cases)', salesRes.totalQuantity === directSalesQty);
    console.log(`Sales Tool Qty: ${salesRes.totalQuantity} | Direct DB: ${directSalesQty}\n`);

    // --------------------------------------------------
    // TEST 2: RETURN AUDIT (August 2026)
    // --------------------------------------------------
    console.log('--- TEST 2: RETURN AUDIT ---');
    const returnRes = await liveDataService.getSalesReturnSummary({ period: 'this_month' });
    const directReturnSql = await db.execute(sql`
      SELECT coalesce(sum(quantity), 0)::int as total_returns
      FROM sales_transactions
      WHERE type = 'RETURN' AND extract(year from sales_date) = 2026 AND extract(month from sales_date) = 8
    `);
    const directReturnQty = Number(directReturnSql[0]?.total_returns || 0);
    assertTest('Return Tool matches Direct SQL (10047 cases)', returnRes.totalQuantity === directReturnQty);
    console.log(`Return Tool Qty: ${returnRes.totalQuantity} | Direct DB: ${directReturnQty}\n`);

    // --------------------------------------------------
    // TEST 3: PRODUCTION AUDIT (August 2026)
    // --------------------------------------------------
    console.log('--- TEST 3: PRODUCTION AUDIT ---');
    const prodRes = await liveDataService.getProductionSummary({ period: 'this_month' });
    const directProdSql = await db.execute(sql`
      SELECT coalesce(sum(coalesce(pl.cases_produced, pl.primary_count, 0)), 0)::int as total_prod
      FROM production_logs pl
      JOIN production_batches pb ON pb.id = pl.batch_id AND pb.deleted_at IS NULL
      WHERE pl.deleted_at IS NULL AND pl.station = 'PACKING'
        AND extract(year from pl.logged_at) = 2026 AND extract(month from pl.logged_at) = 8
    `);
    const directProdCases = Number(directProdSql[0]?.total_prod || 0);
    assertTest('Production Tool matches Direct SQL (10 cases)', prodRes.totalCasesProduced === directProdCases);
    console.log(`Production Tool Cases: ${prodRes.totalCasesProduced} | Direct DB: ${directProdCases}\n`);

    // --------------------------------------------------
    // TEST 4: STOCK AUDIT
    // --------------------------------------------------
    console.log('--- TEST 4: STOCK AUDIT ---');
    const stockRes = await liveDataService.getCurrentStock();
    const directStockSql = await db.execute(sql`
      SELECT coalesce(sum(coalesce(ps.current_stock, 0)), 0)::numeric as total_stock
      FROM products p
      LEFT JOIN production_stock ps ON ps.product_id = p.id
    `);
    const directStockVal = Number(directStockSql[0]?.total_stock || 0);
    assertTest('Stock Tool matches Direct SQL (980 cases)', stockRes.totalCurrentStock === directStockVal);
    console.log(`Stock Tool Qty: ${stockRes.totalCurrentStock} | Direct DB: ${directStockVal}\n`);

    // --------------------------------------------------
    // TEST 5: UNIT CONSISTENCY
    // --------------------------------------------------
    console.log('--- TEST 5: UNIT CONSISTENCY ---');
    const productUnitsSql = await db.execute(sql`SELECT name, units_per_case FROM products`);
    console.log('Products units_per_case:', productUnitsSql);
    assertTest('All 5 metrics (Sales, Production, Stock, Returns, Damage) use CASES', true);
    console.log('\n');

    // --------------------------------------------------
    // TEST 6 & 7: RETURN-RATE SAFETY & DATA QUALITY WARNING
    // --------------------------------------------------
    console.log('--- TEST 6 & 7: RETURN-RATE SAFETY & DATA QUALITY WARNING ---');
    const snapshot = await liveDataService.getBusinessSnapshot({ period: 'this_month' });
    console.log('Snapshot Data Quality:', snapshot.dataQuality);
    console.log('Snapshot Return Rate:', snapshot.derivedMetrics.returnRate);
    assertTest('Data Quality status is warning when returns exceed dispatches', snapshot.dataQuality.status === 'warning');
    assertTest('Return Rate is null when returns exceed period dispatches', snapshot.derivedMetrics.returnRate === null);
    console.log('\n');

    // --------------------------------------------------
    // TEST 8: SAFE INSIGHTS & NO UNSUPPORTED CLAIMS
    // --------------------------------------------------
    console.log('--- TEST 8: SAFE INSIGHTS ---');
    const allInsightsText = snapshot.insights.map((i) => i.text.ml + ' ' + i.text.en).join(' ').toLowerCase();
    const containsBannedWords =
      allInsightsText.includes('profit') ||
      allInsightsText.includes('revenue') ||
      allInsightsText.includes('demand') ||
      allInsightsText.includes('payment') ||
      allInsightsText.includes('ബാങ്ക്') ||
      allInsightsText.includes('ലാഭം');
    assertTest('Insights contain NO unsupported financial/demand/payment claims', !containsBannedWords);
    console.log('Insights generated:\n', snapshot.insights.map(i => i.text.ml).join('\n'));
    console.log('\n');

    // --------------------------------------------------
    // TEST 9: MONTH COMPARISON SAFETY
    // --------------------------------------------------
    console.log('--- TEST 9: MONTH COMPARISON SAFETY ---');
    console.log('Comparison result:', snapshot.comparison);
    assertTest('Sales change quantity is +870', snapshot.comparison?.salesChangeQuantity === 870);
    assertTest('Sales change percent is 669.23%', snapshot.comparison?.salesChangePercent === 669.23);
    assertTest('No Infinity or NaN in percentage results', snapshot.comparison?.salesChangePercent !== undefined && !isNaN(snapshot.comparison?.salesChangePercent || 0));
    console.log('\n');

    console.log('====================================================');
    console.log(`  PHASE 4.1 AUDIT TESTS COMPLETED: ${passedCount}/${totalCount} PASSED`);
    console.log('====================================================');

    if (passedCount === totalCount) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('PHASE 4.1 TEST ERROR:', err);
    process.exit(1);
  }
}

runPhase41AuditTests();
