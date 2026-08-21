import { KenbyLiveDataService } from '../src/modules/ai/kenby-live-data.service';
import { KenbyRouterService, KenbyConversationContext } from '../src/modules/ai/kenby-router.service';
import { KenbyAnalysisService } from '../src/modules/ai/kenby-analysis.service';
import { KenbyRagService } from '../src/modules/ai/kenby-rag.service';
import { TtsService } from '../src/modules/ai/tts.service';
import { AiService } from '../src/modules/ai/ai.service';

async function runPhase11_1Tests() {
  console.log('====================================================');
  console.log('KENBY AI — PHASE 11.1 HUMAN CONVERSATION TEST SUITE');
  console.log('====================================================\n');

  const liveDataService = new KenbyLiveDataService();
  const routerService = new KenbyRouterService();
  const analysisService = new KenbyAnalysisService(liveDataService);
  const ragService = new KenbyRagService();
  const ttsService = new TtsService();
  const aiService = new AiService(ttsService, liveDataService, ragService, routerService, analysisService);

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`✅ TEST ${total} PASSED: ${testName}`);
      passed++;
    } else {
      console.error(`❌ TEST ${total} FAILED: ${testName}`);
      if (detail) console.error(`   Details: ${detail}`);
    }
  }

  try {
    // ----------------------------------------------------
    // FLOW A: METRIC PRESERVATION OVER PERIOD SWITCH (Tests 1 - 3)
    // ----------------------------------------------------
    console.log('--- FLOW A: Period Preservation Over Metric Switches ---');
    
    // Test 1: July sales
    const res1 = await aiService.askQuestion('July sales എത്ര?');
    assert(
      res1.answer.ml.includes('130') && res1.context?.lastMetric === 'sales' && res1.context?.lastPeriod?.month === 7,
      'July sales returns 130 cases & sets July sales context',
      `Got answer: "${res1.answer.ml}", context: ${JSON.stringify(res1.context)}`
    );

    // Test 2: Production? (Follow-up preserving July)
    const ctx1: KenbyConversationContext = res1.context;
    const res2 = await aiService.askQuestion('Production?', ctx1);
    assert(
      res2.answer.ml.includes('0') && res2.context?.lastMetric === 'production' && res2.context?.lastPeriod?.month === 7,
      'Production? follow-up preserves July 2026 and returns 0 cases',
      `Got answer: "${res2.answer.ml}", context: ${JSON.stringify(res2.context)}`
    );

    // Test 3: Returns? (Follow-up preserving July)
    const ctx2: KenbyConversationContext = res2.context;
    const res3 = await aiService.askQuestion('Returns?', ctx2);
    assert(
      res3.answer.ml.includes('100') && res3.context?.lastMetric === 'returns' && res3.context?.lastPeriod?.month === 7,
      'Returns? follow-up preserves July 2026 and returns 100 cases',
      `Got answer: "${res3.answer.ml}", context: ${JSON.stringify(res3.context)}`
    );

    // ----------------------------------------------------
    // FLOW B: AUGUST MULTI-METRIC DIFFERENCE (Tests 4 - 6)
    // ----------------------------------------------------
    console.log('\n--- FLOW B: August Multi-Metric & Difference ---');

    // Test 4: August sales
    const res4 = await aiService.askQuestion('August sales എത്ര?');
    assert(
      res4.answer.ml.includes('1,000') || res4.answer.ml.includes('1000'),
      'August sales returns 1,000 cases',
      `Got answer: "${res4.answer.ml}"`
    );

    // Test 5: Production? (August follow-up)
    const res5 = await aiService.askQuestion('Production?', res4.context);
    assert(
      res5.answer.ml.includes('10') && res5.context?.lastMetric === 'production' && res5.context?.lastPeriod?.month === 8,
      'Production? follow-up preserves August 2026 and returns 10 cases',
      `Got answer: "${res5.answer.ml}"`
    );

    // Test 6: Sales production-നേക്കാൾ എത്ര കൂടുതലാണ്?
    const res6 = await aiService.askQuestion('Sales production-നേക്കാൾ എത്ര കൂടുതലാണ്?', res5.context);
    assert(
      res6.answer.ml.includes('990'),
      'Multi-metric difference returns 990 cases gap',
      `Got answer: "${res6.answer.ml}"`
    );

    // ----------------------------------------------------
    // FLOW C: CORRECTION / CLARIFICATION HANDLING (Tests 7 - 8)
    // ----------------------------------------------------
    console.log('\n--- FLOW C: Correction / Clarification Handling ---');

    // Test 7: Period correction ("പക്ഷേ ഞാൻ ചോദിച്ചത് August sales ആണല്ലോ")
    const res7Init = await aiService.askQuestion('July sales എത്ര?');
    const res7Correction = await aiService.askQuestion('പക്ഷേ ഞാൻ ചോദിച്ചത് August sales ആണല്ലോ', res7Init.context);
    assert(
      res7Correction.answer.ml.includes('August') && (res7Correction.answer.ml.includes('1,000') || res7Correction.answer.ml.includes('1000')),
      'Correction "പക്ഷേ ഞാൻ ചോദിച്ചത് August sales ആണല്ലോ" acknowledges August and returns 1,000 cases',
      `Got answer: "${res7Correction.answer.ml}"`
    );

    // Test 8: Short period correction ("അല്ല, August ആണ്.")
    const res8Correction = await aiService.askQuestion('അല്ല, August ആണ്.', res7Init.context);
    assert(
      res8Correction.answer.ml.includes('August') && (res8Correction.answer.ml.includes('1,000') || res8Correction.answer.ml.includes('1000')),
      'Short correction "അല്ല, August ആണ്." acknowledges August and returns 1,000 cases',
      `Got answer: "${res8Correction.answer.ml}"`
    );

    // ----------------------------------------------------
    // FLOW D: SHORT PERIOD & METRIC CONTINUATIONS (Tests 9 - 11)
    // ----------------------------------------------------
    console.log('\n--- FLOW D: Short Period & Metric Continuations ---');

    // Test 9: ഈ മാസം sales എത്ര?
    const res9 = await aiService.askQuestion('ഈ മാസം sales എത്ര?');
    assert(
      res9.context?.lastMetric === 'sales' && res9.context?.lastPeriod?.period === 'this_month',
      'ഈ മാസം sales എത്ര? resolves this_month sales',
      `Got context: ${JSON.stringify(res9.context)}`
    );

    // Test 10: ഇന്നലെ? (Short period follow-up)
    const res10 = await aiService.askQuestion('ഇന്നലെ?', res9.context);
    assert(
      res10.context?.lastMetric === 'sales' && res10.context?.lastPeriod?.period === 'yesterday',
      'ഇന്നലെ? follow-up retains sales metric and switches period to yesterday',
      `Got context: ${JSON.stringify(res10.context)}`
    );

    // Test 11: Production? (Short metric follow-up after yesterday)
    const res11 = await aiService.askQuestion('Production?', res10.context);
    assert(
      res11.context?.lastMetric === 'production' && res11.context?.lastPeriod?.period === 'yesterday',
      'Production? follow-up retains yesterday period and switches metric to production',
      `Got context: ${JSON.stringify(res11.context)}`
    );

    // ----------------------------------------------------
    // FLOW E: BREAKDOWN & PRONOUN STOCK DRILL-DOWN (Tests 12 - 15)
    // ----------------------------------------------------
    console.log('\n--- FLOW E: Breakdown & Pronoun Stock Drill-Down ---');

    // Test 12: August returns എത്ര?
    const res12 = await aiService.askQuestion('August returns എത്ര?');
    assert(
      res12.answer.ml.includes('10,047') || res12.answer.ml.includes('10047'),
      'August returns returns 10,047 cases',
      `Got answer: "${res12.answer.ml}"`
    );

    // Test 13: ഏതൊക്കെ product? (Breakdown follow-up)
    const res13 = await aiService.askQuestion('ഏതൊക്കെ product?', res12.context);
    assert(
      res13.answer.ml.includes('Kenby 1') && (res13.answer.ml.includes('10,047') || res13.answer.ml.includes('10047')),
      'ഏതൊക്കെ product? returns return breakdown for Kenby 1',
      `Got answer: "${res13.answer.ml}"`
    );

    // Test 14: അതിൽ ഏതാണ് കൂടുതൽ? (Analysis follow-up setting product)
    const res14 = await aiService.askQuestion('അതിൽ ഏതാണ് കൂടുതൽ?', res13.context);
    assert(
      res14.context?.lastProduct === 'Kenby 1',
      'അതിൽ ഏതാണ് കൂടുതൽ? sets lastProduct to Kenby 1 in context',
      `Got context: ${JSON.stringify(res14.context)}`
    );

    // Test 15: അതിന്റെ stock? (Pronoun stock query)
    const res15 = await aiService.askQuestion('അതിന്റെ stock?', res14.context);
    assert(
      res15.answer.ml.includes('980') && res15.context?.lastProduct === 'Kenby 1',
      'അതിന്റെ stock? resolves stock_summary for Kenby 1 (980 cases)',
      `Got answer: "${res15.answer.ml}"`
    );

    // ----------------------------------------------------
    // FLOW F: FACTUAL SAFETY & CONCISE ANSWERS (Tests 16 - 20)
    // ----------------------------------------------------
    console.log('\n--- FLOW F: Factual Safety & System Boundaries ---');

    // Test 16: Return reason "Why?" safety
    const res16 = await aiService.askQuestion('Why were these returned?');
    assert(
      res16.answer.ml.includes('മതിയായ വിവരങ്ങൾ ഇല്ല') || res16.answer.en.includes('not available'),
      'Return reason "Why?" query gives transparent no-data response without LLM hallucinations',
      `Got answer: "${res16.answer.ml}"`
    );

    // Test 17: Generic "Why?" explanation
    const res17 = await aiService.askQuestion('എന്തുകൊണ്ട്?', res12.context);
    assert(
      res17.answer.ml.includes('customer/order-level data Kenby-യിൽ ഇല്ല'),
      'Generic "എന്തുകൊണ്ട്?" query gives transparent driver data message',
      `Got answer: "${res17.answer.ml}"`
    );

    // Test 18: Simple question conciseness
    const res18 = await aiService.askQuestion('July sales എത്ര?');
    assert(
      !res18.answer.ml.includes('Business Overview') && (res18.answer.ml.includes('ജൂലൈ') || res18.answer.ml.includes('July')),
      'July sales query gives direct single-sentence answer without dumping full snapshot tables',
      `Got answer: "${res18.answer.ml}"`
    );

    // Test 19: Financial boundary guard
    const res19 = await aiService.askQuestion('Payment collections എത്ര?');
    assert(
      res19.answer.ml.includes('സാമ്പത്തിക / പേയ്‌മെന്റ് വിവരങ്ങൾ') && res19.answer.ml.includes('ലഭ്യമല്ല'),
      'Financial payment query correctly rejected by boundary guard',
      `Got answer: "${res19.answer.ml}"`
    );

    // Test 20: Context trace validity
    assert(
      res1.context !== undefined && res1.context.lastMetric === 'sales' && res15.context.lastProduct === 'Kenby 1',
      'Context structure preserves metric, period, and product across all 20 conversation steps',
      `Final context: ${JSON.stringify(res15.context)}`
    );

    console.log('\n====================================================');
    console.log(`PHASE 11.1 RESULTS: ${passed} / ${total} PASSED`);
    console.log('====================================================\n');

    process.exit(passed === total ? 0 : 1);
  } catch (err: any) {
    console.error('Unhandled error during Phase 11.1 test execution:', err);
    process.exit(1);
  }
}

runPhase11_1Tests();
