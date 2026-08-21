import { KenbyProactiveInsightService } from '../src/modules/ai/kenby-proactive-insight.service';
import { BusinessSnapshotResult } from '../src/modules/ai/kenby-live-data.service';

async function runPhase7Tests() {
  console.log('====================================================');
  console.log('  KENBY AI PHASE 7: PROACTIVE INSIGHT ENGINE TESTS  ');
  console.log('====================================================\n');

  const insightService = new KenbyProactiveInsightService();
  let passedCount = 0;
  let totalCount = 12;

  // Helper mock builder for snapshots
  const createBaseSnapshot = (overrides?: Partial<BusinessSnapshotResult>): BusinessSnapshotResult => ({
    period: { type: 'this_month', startDate: '2026-08-01', endDate: '2026-09-01' },
    sales: { quantity: 1000, transactionCount: 5 },
    production: { casesProduced: 1000, finishedGoodsProduced: 12000, wastage: 0, logCount: 5 },
    stock: { totalCurrentStock: 980, productsCount: 1 },
    returns: { quantity: 0, transactionCount: 0 },
    damage: { quantity: 0, transactionCount: 0 },
    derivedMetrics: { productionMinusSales: 0, returnRate: 0, damageRate: 0 },
    comparison: null,
    insights: [],
    dataQuality: { status: 'ok', issues: [] },
    ...overrides,
  });

  // TEST 1: SALES INCREASE (July = 130, August = 1000)
  try {
    console.log('--- TEST 1: SALES INCREASE ---');
    const snap1 = createBaseSnapshot({
      sales: { quantity: 1000, transactionCount: 5 },
      comparison: {
        currentPeriod: { year: 2026, month: 8, label: 'August 2026' },
        previousPeriod: { year: 2026, month: 7, label: 'July 2026' },
        salesChangeQuantity: 870,
        salesChangePercent: 669.23,
        productionChangeQuantity: 0,
        productionChangePercent: null,
        returnChangeQuantity: 0,
        damageChangeQuantity: 0,
      },
    });

    const insights1 = insightService.generateProactiveInsights(snap1);
    const salesInc = insights1.find((i) => i.type === 'sales_increase');

    if (
      salesInc &&
      salesInc.data?.difference === 870 &&
      salesInc.data?.percentage === 669.23 &&
      salesInc.message.ml.includes('870 cases കൂടുതലാണ്')
    ) {
      console.log('✓ [PASSED] Sales Increase correctly generated: +870 cases (+669.23%)');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Sales Increase insight incorrect:', salesInc);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 1 Exception:', e.message);
  }

  // TEST 2: SALES DECREASE
  try {
    console.log('\n--- TEST 2: SALES DECREASE ---');
    const snap2 = createBaseSnapshot({
      sales: { quantity: 500, transactionCount: 2 },
      comparison: {
        currentPeriod: { year: 2026, month: 8, label: 'August 2026' },
        previousPeriod: { year: 2026, month: 7, label: 'July 2026' },
        salesChangeQuantity: -200,
        salesChangePercent: -28.57,
        productionChangeQuantity: 0,
        productionChangePercent: null,
        returnChangeQuantity: 0,
        damageChangeQuantity: 0,
      },
    });

    const insights2 = insightService.generateProactiveInsights(snap2);
    const salesDec = insights2.find((i) => i.type === 'sales_decrease');

    if (salesDec && salesDec.data?.difference === 200 && salesDec.message.ml.includes('200 cases കുറഞ്ഞിട്ടുണ്ട്')) {
      console.log('✓ [PASSED] Sales Decrease correctly generated: -200 cases');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Sales Decrease insight incorrect:', salesDec);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 2 Exception:', e.message);
  }

  // TEST 3: PRODUCTION > SALES
  try {
    console.log('\n--- TEST 3: PRODUCTION > SALES ---');
    const snap3 = createBaseSnapshot({
      sales: { quantity: 500, transactionCount: 2 },
      production: { casesProduced: 800, finishedGoodsProduced: 9600, wastage: 0, logCount: 2 },
    });

    const insights3 = insightService.generateProactiveInsights(snap3);
    const gap3 = insights3.find((i) => i.type === 'production_gap' && i.reason === 'production_cases > sales_cases');

    if (gap3 && gap3.data?.difference === 300 && gap3.message.ml.includes('production sales-നേക്കാൾ 300 cases കൂടുതലാണ്')) {
      console.log('✓ [PASSED] Production > Sales gap correctly generated (+300 cases)');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Production > Sales gap insight incorrect:', gap3);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 3 Exception:', e.message);
  }

  // TEST 4: SALES > PRODUCTION
  try {
    console.log('\n--- TEST 4: SALES > PRODUCTION ---');
    const snap4 = createBaseSnapshot({
      sales: { quantity: 1000, transactionCount: 5 },
      production: { casesProduced: 10, finishedGoodsProduced: 120, wastage: 0, logCount: 1 },
    });

    const insights4 = insightService.generateProactiveInsights(snap4);
    const gap4 = insights4.find((i) => i.type === 'production_gap' && i.reason === 'sales_cases > production_cases');

    if (gap4 && gap4.data?.difference === 990 && gap4.message.ml.includes('sales production-നേക്കാൾ 990 cases കൂടുതലാണ്')) {
      console.log('✓ [PASSED] Sales > Production gap correctly generated (+990 cases)');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Sales > Production gap insight incorrect:', gap4);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 4 Exception:', e.message);
  }

  // TEST 5: HIGH RETURNS (Returns 10,047 > Sales 1,000)
  try {
    console.log('\n--- TEST 5: HIGH RETURNS WARNING ---');
    const snap5 = createBaseSnapshot({
      sales: { quantity: 1000, transactionCount: 5 },
      returns: { quantity: 10047, transactionCount: 10 },
      dataQuality: {
        status: 'warning',
        issues: ['Returns recorded during this period exceed sales dispatches recorded during the same period.'],
      },
    });

    const insights5 = insightService.generateProactiveInsights(snap5);
    const highRet = insights5.find((i) => i.type === 'high_returns');

    if (
      highRet &&
      highRet.severity === 'important' &&
      highRet.message.ml.includes('10,047 cases returns ആയി രേഖപ്പെടുത്തിയിട്ടുണ്ട്') &&
      highRet.message.ml.includes('Return records പരിശോധിക്കുന്നത് നല്ലതാണ്')
    ) {
      console.log('✓ [PASSED] High Returns warning correctly generated with severity=important');
      passedCount++;
    } else {
      console.error('✗ [FAILED] High Returns insight incorrect:', highRet);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 5 Exception:', e.message);
  }

  // TEST 6: DAMAGE > 0
  try {
    console.log('\n--- TEST 6: DAMAGE > 0 ---');
    const snap6 = createBaseSnapshot({
      damage: { quantity: 25, transactionCount: 2 },
    });

    const insights6 = insightService.generateProactiveInsights(snap6);
    const dmg = insights6.find((i) => i.type === 'damage');

    if (dmg && dmg.severity === 'warning' && dmg.message.ml.includes('25 cases damage ആയി രേഖപ്പെടുത്തിയിട്ടുണ്ട്')) {
      console.log('✓ [PASSED] Damage insight correctly generated for 25 cases');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Damage insight incorrect:', dmg);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 6 Exception:', e.message);
  }

  // TEST 7: DAMAGE = 0
  try {
    console.log('\n--- TEST 7: DAMAGE = 0 ---');
    const snap7 = createBaseSnapshot({
      damage: { quantity: 0, transactionCount: 0 },
    });

    const insights7 = insightService.generateProactiveInsights(snap7);
    const dmg7 = insights7.find((i) => i.type === 'damage');

    if (!dmg7) {
      console.log('✓ [PASSED] No damage warning generated when damage = 0');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Damage warning incorrectly generated when damage = 0:', dmg7);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 7 Exception:', e.message);
  }

  // TEST 8: NO LOW-STOCK THRESHOLD IN DB
  try {
    console.log('\n--- TEST 8: NO DB THRESHOLD (Fact-based Stock Report) ---');
    const snap8 = createBaseSnapshot({
      stock: { totalCurrentStock: 980, productsCount: 1 },
    });

    const insights8 = insightService.generateProactiveInsights(snap8);
    const lowStockAlert = insights8.find((i) => i.type === 'low_stock');
    const factualStock = insights8.find((i) => i.type === 'high_stock' || i.reason === 'no_db_threshold_reporting_current_stock');

    if (!lowStockAlert && factualStock && factualStock.message.ml.includes('980 cases stock ലഭ്യമാണ്')) {
      console.log('✓ [PASSED] No arbitrary low-stock warning generated; factual stock reported cleanly');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Low stock threshold test failed:', { lowStockAlert, factualStock });
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 8 Exception:', e.message);
  }

  // TEST 9: MULTIPLE INSIGHTS MAXIMUM LIMIT (MAX 4)
  try {
    console.log('\n--- TEST 9: MULTIPLE INSIGHTS MAXIMUM 4 ---');
    const snap9 = createBaseSnapshot({
      sales: { quantity: 1000, transactionCount: 5 },
      production: { casesProduced: 10, finishedGoodsProduced: 120, wastage: 0, logCount: 1 },
      returns: { quantity: 10047, transactionCount: 10 },
      damage: { quantity: 25, transactionCount: 2 },
      stock: { totalCurrentStock: 980, productsCount: 1 },
      comparison: {
        currentPeriod: { year: 2026, month: 8, label: 'August 2026' },
        previousPeriod: { year: 2026, month: 7, label: 'July 2026' },
        salesChangeQuantity: 870,
        salesChangePercent: 669.23,
        productionChangeQuantity: 0,
        productionChangePercent: null,
        returnChangeQuantity: 0,
        damageChangeQuantity: 0,
      },
    });

    const insights9 = insightService.generateProactiveInsights(snap9);

    if (insights9.length <= 4) {
      console.log(`✓ [PASSED] Output capped at ${insights9.length} insights (Maximum 4 enforced)`);
      passedCount++;
    } else {
      console.error(`✗ [FAILED] Output exceeded maximum limit of 4 (got ${insights9.length})`);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 9 Exception:', e.message);
  }

  // TEST 10: INSIGHT RANKING (Important > Warning > Info)
  try {
    console.log('\n--- TEST 10: INSIGHT RANKING ---');
    const snap10 = createBaseSnapshot({
      sales: { quantity: 1000, transactionCount: 5 },
      production: { casesProduced: 500, finishedGoodsProduced: 6000, wastage: 0, logCount: 2 },
      returns: { quantity: 10047, transactionCount: 10 }, // important
      damage: { quantity: 25, transactionCount: 2 },     // warning
      comparison: {                                        // info
        currentPeriod: { year: 2026, month: 8, label: 'August 2026' },
        previousPeriod: { year: 2026, month: 7, label: 'July 2026' },
        salesChangeQuantity: 870,
        salesChangePercent: 669.23,
        productionChangeQuantity: 0,
        productionChangePercent: null,
        returnChangeQuantity: 0,
        damageChangeQuantity: 0,
      },
    });

    const insights10 = insightService.generateProactiveInsights(snap10);
    const ranks = insights10.map((i) => i.severity);

    // Verify first item is important, second is warning
    if (ranks[0] === 'important' && ranks[1] === 'warning') {
      console.log('✓ [PASSED] Insights ranked correctly by severity: important (1) > warning (2) > info (3)');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Insight ranking incorrect:', ranks);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 10 Exception:', e.message);
  }

  // TEST 11: DATA QUALITY WARNING PRIORITY
  try {
    console.log('\n--- TEST 11: DATA QUALITY WARNING PRIORITY ---');
    const snap11 = createBaseSnapshot({
      sales: { quantity: 1000, transactionCount: 5 },
      returns: { quantity: 10047, transactionCount: 10 },
      dataQuality: { status: 'warning', issues: ['Returns exceed dispatches'] },
      comparison: {
        currentPeriod: { year: 2026, month: 8, label: 'August 2026' },
        previousPeriod: { year: 2026, month: 7, label: 'July 2026' },
        salesChangeQuantity: 870,
        salesChangePercent: 669.23,
        productionChangeQuantity: 0,
        productionChangePercent: null,
        returnChangeQuantity: 0,
        damageChangeQuantity: 0,
      },
    });

    const insights11 = insightService.generateProactiveInsights(snap11);

    if (insights11[0].type === 'high_returns' && insights11[0].severity === 'important') {
      console.log('✓ [PASSED] Data quality return warning placed at top priority (Rank 1)');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Data quality warning priority test failed:', insights11[0]);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 11 Exception:', e.message);
  }

  // TEST 12: UNSUPPORTED CLAIMS SAFETY AUDIT
  try {
    console.log('\n--- TEST 12: UNSUPPORTED CLAIMS AUDIT ---');
    const snap12 = createBaseSnapshot({
      sales: { quantity: 1000, transactionCount: 5 },
      production: { casesProduced: 10, finishedGoodsProduced: 120, wastage: 0, logCount: 1 },
      returns: { quantity: 10047, transactionCount: 10 },
      damage: { quantity: 25, transactionCount: 2 },
    });

    const insights12 = insightService.generateProactiveInsights(snap12);
    const forbiddenTerms = [
      'demand', 'customer preference', 'fraud', 'market', 'profit', 'revenue',
      'prescribe', 'പ്രൊഡക്ഷൻ കൂട്ടണം', 'പ്രൊഡക്ഷൻ കുറയ്ക്കണം', 'കസ്റ്റമർ'
    ];

    let hasForbidden = false;
    insights12.forEach((ins) => {
      const fullText = (ins.message.ml + ' ' + ins.message.en + ' ' + ins.reason).toLowerCase();
      forbiddenTerms.forEach((term) => {
        if (fullText.includes(term.toLowerCase())) {
          hasForbidden = true;
          console.error(`Forbidden term "${term}" found in insight:`, ins);
        }
      });
    });

    if (!hasForbidden) {
      console.log('✓ [PASSED] Proactive Insights contain ZERO speculative/unsupported claims or prescriptions');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Speculative terms found in proactive insights!');
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 12 Exception:', e.message);
  }

  console.log('\n====================================================');
  console.log(`  PHASE 7 PROACTIVE INSIGHT TESTS COMPLETED: ${passedCount}/${totalCount} PASSED`);
  console.log('====================================================');

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runPhase7Tests();
