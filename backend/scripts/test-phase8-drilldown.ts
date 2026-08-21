import { KenbyLiveDataService } from '../src/modules/ai/kenby-live-data.service';
import { KenbyRouterService } from '../src/modules/ai/kenby-router.service';
import { AiService } from '../src/modules/ai/ai.service';

async function runPhase8Tests() {
  console.log('====================================================');
  console.log('  KENBY AI PHASE 8: OWNER DRILL-DOWN INTELLIGENCE  ');
  console.log('====================================================\n');

  const liveDataService = new KenbyLiveDataService();
  const routerService = new KenbyRouterService();
  let passedCount = 0;
  let totalCount = 16;

  // TEST 1: SALES BREAKDOWN TOOL
  try {
    console.log('--- TEST 1: SALES BREAKDOWN TOOL ---');
    const res = await liveDataService.getSalesBreakdown({ period: 'specific_month', year: 2026, month: 8 });
    if (res && typeof res.totalQuantity === 'number' && Array.isArray(res.products)) {
      console.log(`✓ [PASSED] getSalesBreakdown returned ${res.totalQuantity} cases across ${res.products.length} products`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] getSalesBreakdown result invalid:', res);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 1 Exception:', e.message);
  }

  // TEST 2: RETURN BREAKDOWN TOOL
  try {
    console.log('\n--- TEST 2: RETURN BREAKDOWN TOOL ---');
    const res = await liveDataService.getReturnBreakdown({ period: 'specific_month', year: 2026, month: 8 });
    if (res && res.totalQuantity === 10047 && res.products.length > 0 && res.products[0].quantity === 10047) {
      console.log(`✓ [PASSED] getReturnBreakdown returned exact 10,047 cases for product "${res.products[0].productName}"`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] getReturnBreakdown result invalid:', res);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 2 Exception:', e.message);
  }

  // TEST 3: DAMAGE BREAKDOWN TOOL
  try {
    console.log('\n--- TEST 3: DAMAGE BREAKDOWN TOOL ---');
    const res = await liveDataService.getDamageBreakdown({ period: 'specific_month', year: 2026, month: 8 });
    if (res && typeof res.totalQuantity === 'number' && Array.isArray(res.products)) {
      console.log(`✓ [PASSED] getDamageBreakdown returned ${res.totalQuantity} cases`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] getDamageBreakdown result invalid:', res);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 3 Exception:', e.message);
  }

  // TEST 4: PRODUCTION BREAKDOWN TOOL
  try {
    console.log('\n--- TEST 4: PRODUCTION BREAKDOWN TOOL ---');
    const res = await liveDataService.getProductionBreakdown({ period: 'specific_month', year: 2026, month: 8 });
    if (res && typeof res.totalCases === 'number' && Array.isArray(res.products)) {
      console.log(`✓ [PASSED] getProductionBreakdown returned ${res.totalCases} cases produced`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] getProductionBreakdown result invalid:', res);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 4 Exception:', e.message);
  }

  // TEST 5: PRODUCT FILTERING (Kenby 1)
  try {
    console.log('\n--- TEST 5: PRODUCT FILTERING ---');
    const res = await liveDataService.getReturnBreakdown({ period: 'specific_month', year: 2026, month: 8 }, 'Kenby 1');
    if (res && res.totalQuantity === 10047 && res.products.length === 1 && res.products[0].productName === 'Kenby 1') {
      console.log(`✓ [PASSED] Product filtering for "Kenby 1" cleanly returned 10,047 cases`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] Product filtering result invalid:', res);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 5 Exception:', e.message);
  }

  // TEST 6: JULY SALES PRODUCT-WISE
  try {
    console.log('\n--- TEST 6: JULY SALES PRODUCT-WISE INTENT ---');
    const intent = await routerService.routeQuestion('July sales product-wise പറയൂ');
    if (intent.type === 'sales_breakdown' && intent.input.period === 'specific_month' && intent.input.month === 7) {
      console.log('✓ [PASSED] Query routed to sales_breakdown for July 2026');
      passedCount++;
    } else {
      console.error('✗ [FAILED] July sales product-wise intent incorrect:', intent);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 6 Exception:', e.message);
  }

  // TEST 7: AUGUST RETURNS PRODUCT-WISE
  try {
    console.log('\n--- TEST 7: AUGUST RETURNS PRODUCT-WISE INTENT ---');
    const intent = await routerService.routeQuestion('August returns product-wise');
    if (intent.type === 'return_breakdown' && intent.input.period === 'specific_month' && intent.input.month === 8) {
      console.log('✓ [PASSED] Query routed to return_breakdown for August 2026');
      passedCount++;
    } else {
      console.error('✗ [FAILED] August returns product-wise intent incorrect:', intent);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 7 Exception:', e.message);
  }

  // TEST 8: FOLLOW-UP "ഏതൊക്കെ product?" AFTER RETURN SUMMARY
  try {
    console.log('\n--- TEST 8: FOLLOW-UP "ഏതൊക്കെ product?" ---');
    const intent = await routerService.routeQuestion('ഏതൊക്കെ product?', {
      lastIntent: 'sales_return_summary',
      lastMetric: 'returns',
      lastPeriod: { period: 'specific_month', year: 2026, month: 8 },
    });
    if (intent.type === 'return_breakdown' && intent.input.month === 8) {
      console.log('✓ [PASSED] Follow-up "ഏതൊക്കെ product?" resolved to return_breakdown for August 2026');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Follow-up intent incorrect:', intent);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 8 Exception:', e.message);
  }

  // TEST 9: MALAYALAM QUERY
  try {
    console.log('\n--- TEST 9: MALAYALAM QUERY ---');
    const intent = await routerService.routeQuestion('ഈ മാസം return വന്ന products ഏതാണ്?');
    if (intent.type === 'return_breakdown') {
      console.log('✓ [PASSED] Malayalam question routed to return_breakdown');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Malayalam query intent incorrect:', intent);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 9 Exception:', e.message);
  }

  // TEST 10: ENGLISH QUERY
  try {
    console.log('\n--- TEST 10: ENGLISH QUERY ---');
    const intent = await routerService.routeQuestion('Which products were returned?');
    if (intent.type === 'return_breakdown') {
      console.log('✓ [PASSED] English question routed to return_breakdown');
      passedCount++;
    } else {
      console.error('✗ [FAILED] English query intent incorrect:', intent);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 10 Exception:', e.message);
  }

  // TEST 11: MIXED LANGUAGE QUERY
  try {
    console.log('\n--- TEST 11: MIXED LANGUAGE QUERY ---');
    const intent = await routerService.routeQuestion('July sales product-wise പറയൂ');
    if (intent.type === 'sales_breakdown' && intent.input.month === 7) {
      console.log('✓ [PASSED] Mixed language query routed to sales_breakdown for July');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Mixed language query intent incorrect:', intent);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 11 Exception:', e.message);
  }

  // TEST 12: ZERO-RESULT HANDLING
  try {
    console.log('\n--- TEST 12: ZERO-RESULT HANDLING ---');
    const res = await liveDataService.getReturnBreakdown({ period: 'specific_month', year: 2026, month: 6 });
    if (res && res.totalQuantity === 0 && res.products.length === 0) {
      console.log('✓ [PASSED] Zero-result return breakdown handled cleanly (0 cases)');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Zero-result handling failed:', res);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 12 Exception:', e.message);
  }

  // TEST 13: MULTIPLE-PRODUCT ORDERING
  try {
    console.log('\n--- TEST 13: MULTIPLE-PRODUCT ORDERING ---');
    const res = await liveDataService.getReturnBreakdown({ period: 'specific_month', year: 2026, month: 8 });
    let isOrdered = true;
    for (let i = 0; i < res.products.length - 1; i++) {
      if (res.products[i].quantity < res.products[i + 1].quantity) {
        isOrdered = false;
      }
    }
    if (isOrdered) {
      console.log('✓ [PASSED] Breakdown products correctly ordered by quantity DESC');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Product breakdown not ordered DESC:', res.products);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 13 Exception:', e.message);
  }

  // TEST 14: INVALID / UNKNOWN PRODUCT HANDLING
  try {
    console.log('\n--- TEST 14: UNKNOWN PRODUCT HANDLING ---');
    const res = await liveDataService.getReturnBreakdown({ period: 'specific_month', year: 2026, month: 8 }, 'NonExistentProductXYZ');
    if (res && res.totalQuantity === 0 && res.products.length === 0) {
      console.log('✓ [PASSED] Non-existent product query handled safely without crash');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Unknown product filter test failed:', res);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 14 Exception:', e.message);
  }

  // TEST 15: PRESERVED PHASE 6 CONTEXT RESOLUTION
  try {
    console.log('\n--- TEST 15: PRESERVED PHASE 6 CONTEXT ---');
    const intent = await routerService.routeQuestion('August-ലോ?', {
      lastIntent: 'sales_summary',
      lastMetric: 'sales',
      lastPeriod: { period: 'specific_month', year: 2026, month: 7 },
    });
    if (intent.type === 'sales_summary' && intent.input.month === 8) {
      console.log('✓ [PASSED] Phase 6 period follow-up context preserved');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Phase 6 context failed:', intent);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 15 Exception:', e.message);
  }

  // TEST 16: PRESERVED PHASE 7 PROACTIVE INSIGHT CONTEXT
  try {
    console.log('\n--- TEST 16: PRESERVED PHASE 7 INSIGHT CONTEXT ---');
    const intent = await routerService.routeQuestion('ഇതിൽ ഏതൊക്കെ product ആണ്?', {
      lastIntent: 'business_snapshot',
      lastMetric: 'returns',
      lastPeriod: { period: 'specific_month', year: 2026, month: 8 },
    });
    if (intent.type === 'return_breakdown' && intent.input.month === 8) {
      console.log('✓ [PASSED] Insight click follow-up resolved to return_breakdown for August 2026');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Insight context resolution failed:', intent);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 16 Exception:', e.message);
  }

  console.log('\n====================================================');
  console.log(`  PHASE 8 DRILL-DOWN TESTS COMPLETED: ${passedCount}/${totalCount} PASSED`);
  console.log('====================================================');

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runPhase8Tests();
