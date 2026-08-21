import { KenbyLiveDataService } from '../src/modules/ai/kenby-live-data.service';
import { KenbyRouterService } from '../src/modules/ai/kenby-router.service';
import { AiService } from '../src/modules/ai/ai.service';
import { TtsService } from '../src/modules/ai/tts.service';
import { KenbyRagService } from '../src/modules/ai/kenby-rag.service';
import { KenbyAnalysisService } from '../src/modules/ai/kenby-analysis.service';

async function runAuditSuite() {
  console.log('====================================================');
  console.log('  KENBY AI: COMPREHENSIVE DATA & INTELLIGENCE AUDIT ');
  console.log('====================================================\n');

  const liveDataService = new KenbyLiveDataService();
  const routerService = new KenbyRouterService();
  const ttsService = new TtsService();
  const ragService = new KenbyRagService();
  const analysisService = new KenbyAnalysisService(liveDataService);
  const aiService = new AiService(
    ttsService,
    liveDataService,
    ragService,
    routerService,
    analysisService
  );

  let passed = 0;
  let total = 0;

  function assert(name: string, condition: boolean, details?: any) {
    total++;
    if (condition) {
      console.log(`✓ [PASSED] ${name}`);
      passed++;
    } else {
      console.error(`✗ [FAILED] ${name}`);
      if (details) console.error('  Details:', details);
    }
  }

  console.log('--- CATEGORY 1: PERIOD ISOLATION & ACCURACY ---');
  // 1. July Sales Isolation
  try {
    const res = await aiService.askQuestion('How much did we sell in July?');
    const isJuly = res.answer.en.includes('July') || (res.context?.lastPeriod?.month === 7);
    const notAugust = !res.answer.en.includes('August') && res.context?.lastPeriod?.month !== 8;
    const onlySales = !res.answer.en.includes('Production:') && !res.answer.en.includes('Stock:');
    assert('July sales returns July values and only sales metric', isJuly && notAugust && onlySales, {
      answer: res.answer,
      context: res.context,
    });
  } catch (e: any) {
    assert('July sales exception: ' + e.message, false);
  }

  // 2. August Sales Isolation
  try {
    const res = await aiService.askQuestion('August 2026 sales');
    const isAug = res.answer.en.includes('August') || (res.context?.lastPeriod?.month === 8);
    const notJuly = !res.answer.en.includes('July') && res.context?.lastPeriod?.month !== 7;
    assert('August sales returns August values only', isAug && notJuly, {
      answer: res.answer,
      context: res.context,
    });
  } catch (e: any) {
    assert('August sales exception: ' + e.message, false);
  }

  // 3. July followed by August (No period leakage)
  try {
    const res1 = await aiService.askQuestion('How much did we sell in July?');
    const res2 = await aiService.askQuestion('What about August?', res1.context);
    const isAug = res2.context?.lastPeriod?.month === 8;
    const isSales = res2.context?.lastMetric === 'sales';
    assert('July followed by "What about August?" updates to August sales cleanly', isAug && isSales, {
      answer: res2.answer,
      context: res2.context,
    });
  } catch (e: any) {
    assert('Period follow-up exception: ' + e.message, false);
  }

  console.log('\n--- CATEGORY 2: SINGLE METRIC PRECISION (ZERO UNSOLICITED DUMPS) ---');
  // 4. Sales question has NO production / stock / damage
  try {
    const res = await aiService.askQuestion('How much did we sell this month?');
    const hasNoProduction = !res.answer.en.includes('production output') && !res.answer.en.includes('Production:');
    const hasNoStock = !res.answer.en.includes('stock as available') && !res.answer.en.includes('Stock:');
    assert('Sales query answers only sales without production/stock dump', hasNoProduction && hasNoStock, {
      answer: res.answer,
    });
  } catch (e: any) {
    assert('Sales metric exception: ' + e.message, false);
  }

  // 5. Stock question has NO sales / production dump
  try {
    const res = await aiService.askQuestion('How much stock do we have?');
    const isStock = res.context?.lastMetric === 'stock';
    const noSales = !res.answer.en.includes('sales dispatch') && !res.answer.en.includes('Sales:');
    assert('Stock query answers stock only', isStock && noSales, {
      answer: res.answer,
    });
  } catch (e: any) {
    assert('Stock metric exception: ' + e.message, false);
  }

  // 6. Returns question has NO sales / production dump
  try {
    const res = await aiService.askQuestion('How much was returned in August?');
    const isReturn = res.context?.lastMetric === 'returns';
    const noProd = !res.answer.en.includes('Production:') && !res.answer.en.includes('production output');
    assert('Returns query answers returns only', isReturn && noProd, {
      answer: res.answer,
    });
  } catch (e: any) {
    assert('Returns metric exception: ' + e.message, false);
  }

  // 7. Damage question has NO sales / production dump
  try {
    const res = await aiService.askQuestion('How much damage in August?');
    const isDamage = res.context?.lastMetric === 'damage';
    const noSales = !res.answer.en.includes('Sales:') && !res.answer.en.includes('dispatched across');
    assert('Damage query answers damage only', isDamage && noSales, {
      answer: res.answer,
    });
  } catch (e: any) {
    assert('Damage metric exception: ' + e.message, false);
  }

  console.log('\n--- CATEGORY 3: PRODUCT-LEVEL BREAKDOWNS & UNIT HANDLING ---');
  // 8. Product-wise stock
  try {
    const res = await aiService.askQuestion('How much of each product is in stock?');
    const isBreakdown = res.context?.lastIntent === 'stock_breakdown';
    const listsProducts = res.answer.en.includes('•') || res.data?.products?.length > 0;
    assert('Product-wise stock returns individual product items', isBreakdown && listsProducts, {
      answer: res.answer,
    });
  } catch (e: any) {
    assert('Product stock exception: ' + e.message, false);
  }

  // 9. Product-wise sales in August
  try {
    const res = await aiService.askQuestion('August product-wise sales');
    const isBreakdown = res.context?.lastIntent === 'sales_breakdown';
    const listsProducts = res.answer.en.includes('Product-wise') || res.data?.products?.length > 0;
    assert('Product-wise sales returns individual product sales', isBreakdown && listsProducts, {
      answer: res.answer,
    });
  } catch (e: any) {
    assert('Product sales exception: ' + e.message, false);
  }

  console.log('\n--- CATEGORY 4: CONTEXT SWITCHING & NO LEAKAGE ---');
  // 10. July Sales -> "How much stock do we have now?" -> Resets to current stock (NOT July)
  try {
    const res1 = await aiService.askQuestion('How much did we sell in July?');
    const res2 = await aiService.askQuestion('How much stock do we have now?', res1.context);
    const isStock = res2.context?.lastMetric === 'stock';
    const isCurrent = res2.context?.lastPeriod?.period === 'this_month' || !res2.answer.en.includes('July');
    assert('Stock query following July sales resolves current stock independently', isStock && isCurrent, {
      answer: res2.answer,
      context: res2.context,
    });
  } catch (e: any) {
    assert('Stock context switch exception: ' + e.message, false);
  }

  // 11. July Sales -> "What about returns?" -> Inherits July for returns
  try {
    const res1 = await aiService.askQuestion('How much did we sell in July?');
    const res2 = await aiService.askQuestion('What about returns?', res1.context);
    const isReturns = res2.context?.lastMetric === 'returns';
    const isJuly = res2.context?.lastPeriod?.month === 7 || res2.answer.en.includes('July');
    assert('"What about returns?" inherits July period from previous question', isReturns && isJuly, {
      answer: res2.answer,
      context: res2.context,
    });
  } catch (e: any) {
    assert('Follow-up returns exception: ' + e.message, false);
  }

  console.log('\n--- CATEGORY 5: MALAYALAM + ENGLISH CODE-SWITCHING ---');
  // 12. Malayalam + English mixed
  try {
    const res = await aiService.askQuestion('ജൂലൈ മാസം എത്ര sales dispatch ചെയ്തു?');
    const isSales = res.context?.lastMetric === 'sales';
    const isJuly = res.context?.lastPeriod?.month === 7;
    assert('Malayalam question with English business terms resolves July sales', isSales && isJuly, {
      answer: res.answer,
    });
  } catch (e: any) {
    assert('Malayalam code-switching exception: ' + e.message, false);
  }

  // 13. Malayalam stock breakdown
  try {
    const res = await aiService.askQuestion('ഓരോ product-ന്റെയും stock എത്രയാണ്?');
    const isBreakdown = res.context?.lastIntent === 'stock_breakdown';
    assert('Malayalam question for each product stock resolves stock_breakdown', isBreakdown, {
      answer: res.answer,
    });
  } catch (e: any) {
    assert('Malayalam stock breakdown exception: ' + e.message, false);
  }

  console.log('\n--- CATEGORY 6: TEXT-TO-SPEECH CHUNKING & NORMALIZATION ---');
  // 14. Long text TTS normalization & multi-chunk concatenation
  try {
    const longText =
      '2026 ജൂലൈ മാസത്തിൽ ആകെ 130 കേസുകൾ sales dispatch ചെയ്തിട്ടുണ്ട്. അതിൽ 20L Jar 80 എണ്ണവും 1L Bottle 30 കേസുകളും 500ml Bottle 20 കേസുകളും ഉൾപ്പെടുന്നു.';
    const audioUrl = await ttsService.generateNeuralSpeech(longText, 'ml');
    const hasAudio = audioUrl && audioUrl.startsWith('data:audio/mp3;base64,') && audioUrl.length > 500;
    assert('TTS generates multi-chunk neural MP3 stream without 180-char cutoff', !!hasAudio, {
      audioLength: audioUrl?.length,
    });
  } catch (e: any) {
    assert('TTS stream exception: ' + e.message, false);
  }

  console.log('\n====================================================');
  console.log(`  AUDIT SUITE SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log('====================================================');

  if (passed === total) {
    console.log('\n🎉 ALL KENBY AI AUDIT TESTS PASSED SUCCESSFULLY!');
  } else {
    process.exitCode = 1;
  }
}

runAuditSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
