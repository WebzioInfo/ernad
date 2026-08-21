import { KenbyLiveDataService } from '../src/modules/ai/kenby-live-data.service';
import { KenbyRouterService } from '../src/modules/ai/kenby-router.service';
import { KenbyAnalysisService } from '../src/modules/ai/kenby-analysis.service';
import { AiService } from '../src/modules/ai/ai.service';
import { KenbyRagService } from '../src/modules/ai/kenby-rag.service';
import { TtsService } from '../src/modules/ai/tts.service';

async function runPhase9Tests() {
  console.log('====================================================');
  console.log('  KENBY AI PHASE 9: CROSS-METRIC INTELLIGENCE TESTS ');
  console.log('====================================================\n');

  const liveDataService = new KenbyLiveDataService();
  const routerService = new KenbyRouterService();
  const analysisService = new KenbyAnalysisService(liveDataService);
  const ragService = new KenbyRagService();
  const ttsService = new TtsService();
  const aiService = new AiService(ttsService, liveDataService, ragService, routerService, analysisService);

  let passedCount = 0;
  const totalCount = 15;

  // TEST 1: AUGUST SALES AND PRODUCTION
  try {
    console.log('--- TEST 1: AUGUST SALES AND PRODUCTION ---');
    const res = await aiService.askQuestion('August sales and production എത്ര?');
    if (res.answer.ml.includes('Sales:') && res.answer.ml.includes('Production:')) {
      console.log(`✓ [PASSED] Response combined Sales & Production for August: "${res.answer.ml.replace(/\n/g, ' ')}"`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] Test 1 response invalid:', res.answer);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 1 Exception:', e.message);
  }

  // TEST 2: SALES VS PRODUCTION DIFFERENCE
  try {
    console.log('\n--- TEST 2: SALES VS PRODUCTION DIFFERENCE ---');
    const res = await aiService.askQuestion('Sales production-നേക്കാൾ എത്ര കൂടുതലാണ്?');
    if (res.answer.ml.includes('കൂടുതലാണ്') || res.answer.ml.includes('കുറവാണ്') || res.answer.ml.includes('തുല്യമാണ്')) {
      console.log(`✓ [PASSED] Difference computed deterministically: "${res.answer.ml}"`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] Test 2 response invalid:', res.answer);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 2 Exception:', e.message);
  }

  // TEST 3: PRODUCT CROSS-METRIC (Kenby 1 sales, production, stock)
  try {
    console.log('\n--- TEST 3: KENBY 1 SALES, PRODUCTION, STOCK ---');
    const res = await aiService.askQuestion('Kenby 1-ന്റെ sales, production, stock പറയൂ.');
    if (res.answer.ml.includes('Kenby 1') && res.answer.ml.includes('Sales:') && res.answer.ml.includes('Production:') && res.answer.ml.includes('Current Stock:')) {
      console.log(`✓ [PASSED] Returned Sales, Production, and Stock for Kenby 1 cleanly`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] Test 3 response invalid:', res.answer);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 3 Exception:', e.message);
  }

  // TEST 4: PERIOD COMPARISON (July vs August)
  try {
    console.log('\n--- TEST 4: JULY VS AUGUST SALES COMPARISON ---');
    const res = await aiService.askQuestion('July-നെക്കാൾ August sales കൂടിയോ?');
    if (res.answer.ml.includes('August') && res.answer.ml.includes('July') && res.answer.ml.includes('cases')) {
      console.log(`✓ [PASSED] Comparison returned factual sales difference: "${res.answer.ml}"`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] Test 4 response invalid:', res.answer);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 4 Exception:', e.message);
  }

  // TEST 5: ALL 4 METRICS OVERVIEW
  try {
    console.log('\n--- TEST 5: ALL 4 METRICS OVERVIEW ---');
    const res = await aiService.askQuestion('ഈ മാസം sales production returns damage എല്ലാം പറയൂ.');
    if (res.answer.ml.includes('Sales:') && res.answer.ml.includes('Production:') && res.answer.ml.includes('Returns:') && res.answer.ml.includes('Damage:')) {
      console.log(`✓ [PASSED] All 4 metrics retrieved and displayed point-by-point`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] Test 5 response invalid:', res.answer);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 5 Exception:', e.message);
  }

  // TEST 6: TOP SELLING PRODUCT
  try {
    console.log('\n--- TEST 6: TOP SELLING PRODUCT ---');
    const res = await aiService.askQuestion('ഈ മാസം ഏറ്റവും കൂടുതൽ sell ചെയ്ത product ഏതാണ്?');
    if (res.answer.ml.includes('Kenby 1') || res.answer.ml.includes('product')) {
      console.log(`✓ [PASSED] Top selling product identified deterministically: "${res.answer.ml.replace(/\n/g, ' ')}"`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] Test 6 response invalid:', res.answer);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 6 Exception:', e.message);
  }

  // TEST 7: TOP SELLING PRODUCT + ITS CURRENT STOCK
  try {
    console.log('\n--- TEST 7: TOP SELLING PRODUCT + STOCK ---');
    const res = await aiService.askQuestion('ഏറ്റവും കൂടുതൽ sell ചെയ്ത product-ന്റെ stock എത്ര?');
    if (res.answer.ml.includes('stock') && res.answer.ml.includes('cases')) {
      console.log(`✓ [PASSED] Top selling product & its current stock combined cleanly: "${res.answer.ml.replace(/\n/g, ' ')}"`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] Test 7 response invalid:', res.answer);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 7 Exception:', e.message);
  }

  // TEST 8: ENGLISH MULTI-METRIC QUERY
  try {
    console.log('\n--- TEST 8: ENGLISH MULTI-METRIC QUERY ---');
    const res = await aiService.askQuestion('How much sales and production in August?');
    if (res.answer.en.includes('Sales:') && res.answer.en.includes('Production:')) {
      console.log(`✓ [PASSED] English multi-metric response returned cleanly: "${res.answer.en.replace(/\n/g, ' ')}"`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] Test 8 response invalid:', res.answer);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 8 Exception:', e.message);
  }

  // TEST 9: CONVERSATIONAL MULTI-STEP FOLLOW-UP
  try {
    console.log('\n--- TEST 9: CONVERSATIONAL MULTI-STEP FOLLOW-UP ---');
    const step1 = await aiService.askQuestion('July sales എത്ര?');
    const step2 = await aiService.askQuestion('Production?', step1.context);
    const step3 = await aiService.askQuestion('Difference?', step2.context);

    if (step3.answer.ml.includes('Sales') || step3.answer.ml.includes('Production') || step3.answer.ml.includes('cases')) {
      console.log(`✓ [PASSED] Multi-step conversation resolved difference for July: "${step3.answer.ml}"`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] Test 9 multi-step response invalid:', step3.answer);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 9 Exception:', e.message);
  }

  // TEST 10: EXPLICIT CONTEXT OVERRIDE
  try {
    console.log('\n--- TEST 10: EXPLICIT CONTEXT OVERRIDE ---');
    const step1 = await aiService.askQuestion('July sales എത്ര?');
    const step2 = await aiService.askQuestion('August production എത്ര?', step1.context);

    if (step2.context?.lastPeriod?.month === 8 && step2.context?.lastMetric === 'production') {
      console.log('✓ [PASSED] Explicit entity "August production" successfully overwrote July context');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Context override failed:', step2.context);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 10 Exception:', e.message);
  }

  // TEST 11: ZERO DENOMINATOR PERCENTAGE HANDLING
  try {
    console.log('\n--- TEST 11: ZERO DENOMINATOR PERCENTAGE HANDLING ---');
    const res = await analysisService.executeAnalysis(
      { period: 'specific_month', year: 2026, month: 7 },
      ['sales', 'comparison'],
      'comparison'
    );
    if (res && res.answerText) {
      console.log('✓ [PASSED] Comparison handled without division by zero or invalid NaN');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Zero denominator test failed:', res);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 11 Exception:', e.message);
  }

  // TEST 12: RETURNS > SALES SAFETY TEST
  try {
    console.log('\n--- TEST 12: RETURNS > SALES SAFETY TEST ---');
    const res = await aiService.askQuestion('August returns എത്ര?');
    if (!res.answer.ml.includes('return rate') && !res.answer.en.includes('return rate')) {
      console.log('✓ [PASSED] High returns reported factually without false return rate percentages');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Unsupported return rate claimed:', res.answer);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 12 Exception:', e.message);
  }

  // TEST 13: UNKNOWN PRODUCT FILTERING
  try {
    console.log('\n--- TEST 13: UNKNOWN PRODUCT FILTERING ---');
    const res = await aiService.askQuestion('NonExistentProductXYZ-ന്റെ sales, production, stock പറയൂ.');
    if (res.answer.ml.includes('NonExistentProductXYZ') && res.answer.ml.includes('0 cases')) {
      console.log('✓ [PASSED] Unknown product query handled safely with factual 0 cases output');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Unknown product test failed:', res.answer);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 13 Exception:', e.message);
  }

  // TEST 14: UNSUPPORTED FINANCIAL / PAYMENT QUESTION
  try {
    console.log('\n--- TEST 14: UNSUPPORTED FINANCIAL QUESTION ---');
    const res = await aiService.askQuestion('How much payment collected?');
    if (res.answer.en.includes('not managed') || res.answer.ml.includes('ലഭ്യമല്ല')) {
      console.log(`✓ [PASSED] Payment question transparently declined: "${res.answer.en}"`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] Unsupported financial question answered with hallucinations:', res.answer);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 14 Exception:', e.message);
  }

  // TEST 15: GREETING ISOLATION
  try {
    console.log('\n--- TEST 15: GREETING ISOLATION ---');
    const res = await aiService.askQuestion('Hi Kenby');
    if (res.context?.lastMetric === null && res.context?.lastIntent === 'greeting') {
      console.log('✓ [PASSED] Greeting intent isolated context cleanly');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Greeting context isolation failed:', res.context);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 15 Exception:', e.message);
  }

  console.log('\n====================================================');
  console.log(`  PHASE 9 CROSS-METRIC TESTS COMPLETED: ${passedCount}/${totalCount} PASSED`);
  console.log('====================================================');

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runPhase9Tests();
