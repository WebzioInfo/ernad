import 'dotenv/config';
import { db } from '../src/database/db';
import { sql } from 'drizzle-orm';
import { KenbyRouterService } from '../src/modules/ai/kenby-router.service';
import { KenbyRagService } from '../src/modules/ai/kenby-rag.service';
import { KenbyLiveDataService } from '../src/modules/ai/kenby-live-data.service';
import { TtsService } from '../src/modules/ai/tts.service';
import { AiService } from '../src/modules/ai/ai.service';

async function runPhase4Tests() {
  console.log('====================================================');
  console.log('       KENBY AI PHASE 4: BUSINESS SNAPSHOT TESTS    ');
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
    // SECTION 1: BUSINESS SNAPSHOT TOOL VERIFICATION
    // --------------------------------------------------
    console.log('=== SECTION 1: BUSINESS SNAPSHOT TOOL VERIFICATION ===\n');

    const snapshotRes = await liveDataService.getBusinessSnapshot({ period: 'this_month' });
    console.log('Snapshot Period:', snapshotRes.period);
    console.log('Sales Qty:', snapshotRes.sales.quantity);
    console.log('Production Cases:', snapshotRes.production.casesProduced);
    console.log('Current Stock:', snapshotRes.stock.totalCurrentStock);
    console.log('Derived Metrics:', snapshotRes.derivedMetrics);
    console.log('Comparison:', snapshotRes.comparison);
    console.log('Insights Count:', snapshotRes.insights.length);

    assertTest('Snapshot contains valid sales qty', typeof snapshotRes.sales.quantity === 'number');
    assertTest('Snapshot contains valid production cases', typeof snapshotRes.production.casesProduced === 'number');
    assertTest('Snapshot contains valid derived metrics', typeof snapshotRes.derivedMetrics.productionMinusSales === 'number');
    assertTest('Snapshot contains month comparison', !!snapshotRes.comparison);
    console.log('\n');

    // --------------------------------------------------
    // SECTION 2: ROUTER & QUESTION CLASSIFICATION TESTS
    // --------------------------------------------------
    console.log('=== SECTION 2: ROUTER & CLASSIFICATION TESTS ===\n');

    const testCases = [
      { q: 'ഈ മാസം business എങ്ങനെയുണ്ട്?', expectedIntent: 'business_snapshot' },
      { q: 'ഈ മാസത്തെ report പറയൂ', expectedIntent: 'business_snapshot' },
      { q: 'എന്താണ് ശ്രദ്ധിക്കേണ്ടത്?', expectedIntent: 'business_snapshot' },
      { q: 'July-നെക്കാൾ August sales എങ്ങനെയാണ്?', expectedIntent: 'business_snapshot' },
      { q: 'July 12 sales എത്ര?', expectedIntent: 'sales_summary' },
      { q: 'Stock എത്ര?', expectedIntent: 'stock_summary' },
      { q: 'Production എന്താണ്?', expectedIntent: 'knowledge' },
      { q: 'ഹായ്', expectedIntent: 'greeting' },
    ];

    for (const tc of testCases) {
      console.log(`--- Testing Question: "${tc.q}" ---`);
      const intent = await routerService.routeQuestion(tc.q);
      const isMatch = intent.type === tc.expectedIntent;
      assertTest(`Route "${tc.q}" -> ${tc.expectedIntent}`, isMatch, `got ${intent.type}`);

      const resp = await aiService.askQuestion(tc.q);
      console.log('AiService Source:', resp.source);
      console.log('AiService Answer:\n', resp.answer.ml);
      console.log('\n');
    }

    console.log('====================================================');
    console.log(`  PHASE 4 TESTS COMPLETED: ${passedCount}/${totalCount} PASSED`);
    console.log('====================================================');

    if (passedCount === totalCount) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('PHASE 4 TEST ERROR:', err);
    process.exit(1);
  }
}

runPhase4Tests();
