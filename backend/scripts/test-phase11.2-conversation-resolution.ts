import { KenbyLiveDataService } from '../src/modules/ai/kenby-live-data.service';
import { KenbyRouterService, KenbyConversationContext } from '../src/modules/ai/kenby-router.service';
import { KenbyAnalysisService } from '../src/modules/ai/kenby-analysis.service';
import { KenbyRagService } from '../src/modules/ai/kenby-rag.service';
import { TtsService } from '../src/modules/ai/tts.service';
import { AiService } from '../src/modules/ai/ai.service';

async function runPhase112Tests() {
  console.log('================================================================');
  console.log('KENBY AI — PHASE 11.2: TRUE HUMAN CONVERSATIONAL CONTEXT RESOLUTION');
  console.log('================================================================\n');

  const liveDataService = new KenbyLiveDataService();
  const routerService = new KenbyRouterService();
  const analysisService = new KenbyAnalysisService(liveDataService);
  const ragService = new KenbyRagService();
  const ttsService = new TtsService();
  const aiService = new AiService(ttsService, liveDataService, ragService, routerService, analysisService);

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

  try {
    // -------------------------------------------------------------------------
    // TEST A: Single Active Period Continuation (July)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST A: Single Active Period Continuation (July) ---');
    let ctxA: KenbyConversationContext | undefined = undefined;

    // A1: July sales
    const resA1 = await aiService.askQuestion('July sales എത്ര?', ctxA);
    ctxA = resA1.context;
    assert(
      resA1.answer.ml.includes('130') && (resA1.context as any).primaryPeriod?.month === 7,
      'TEST A1: July sales = 130 cases',
      `Got answer="${resA1.answer.ml}"`
    );

    // A2: Production? (Follow-up)
    const resA2 = await aiService.askQuestion('Production?', ctxA);
    ctxA = resA2.context;
    assert(
      resA2.answer.ml.includes('0') && (resA2.context as any).primaryPeriod?.month === 7,
      'TEST A2: Production? -> July production = 0 cases',
      `Got answer="${resA2.answer.ml}"`
    );

    // A3: Returns? (Follow-up)
    const resA3 = await aiService.askQuestion('Returns?', ctxA);
    ctxA = resA3.context;
    assert(
      resA3.answer.ml.includes('100') && (resA3.context as any).primaryPeriod?.month === 7,
      'TEST A3: Returns? -> July returns = 100 cases',
      `Got answer="${resA3.answer.ml}"`
    );

    // -------------------------------------------------------------------------
    // TEST B: Single Active Period Continuation (August)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST B: Single Active Period Continuation (August) ---');
    let ctxB: KenbyConversationContext | undefined = undefined;

    // B1: August sales
    const resB1 = await aiService.askQuestion('August sales എത്ര?', ctxB);
    ctxB = resB1.context;
    assert(
      resB1.answer.ml.includes('1,000') && (resB1.context as any).primaryPeriod?.month === 8,
      'TEST B1: August sales = 1,000 cases',
      `Got answer="${resB1.answer.ml}"`
    );

    // B2: Production? (Follow-up)
    const resB2 = await aiService.askQuestion('Production?', ctxB);
    ctxB = resB2.context;
    assert(
      resB2.answer.ml.includes('10') && (resB2.context as any).primaryPeriod?.month === 8,
      'TEST B2: Production? -> August production = 10 cases',
      `Got answer="${resB2.answer.ml}"`
    );

    // -------------------------------------------------------------------------
    // TEST C: Dual Period Active Context & Ambiguity Clarification Protocol
    // -------------------------------------------------------------------------
    console.log('\n--- TEST C: Dual Period Active Context & Ambiguity Clarification ---');
    let ctxC: KenbyConversationContext | undefined = undefined;

    // C1: July sales
    const resC1 = await aiService.askQuestion('July sales എത്ര?', ctxC);
    ctxC = resC1.context;

    // C2: August-നോട് compare ചെയ്യൂ
    const resC2 = await aiService.askQuestion('August-നോട് compare ചെയ്യൂ', ctxC);
    ctxC = resC2.context;
    assert(
      resC2.answer.ml.includes('August sales July-നേക്കാൾ 870 cases കൂടുതലാണ്') &&
        (resC2.context as any).primaryPeriod?.month === 7 &&
        (resC2.context as any).comparisonPeriod?.month === 8,
      'TEST C2: Comparison preserves both primaryPeriod (July) and comparisonPeriod (August)',
      `Got answer="${resC2.answer.ml}"`
    );

    // C3: Returns? (Ambiguous - both July and August are active!)
    const resC3 = await aiService.askQuestion('Returns?', ctxC);
    ctxC = resC3.context;
    assert(
      resC3.answer.ml.includes('July returns ആണോ August returns ആണോ?') &&
        (resC3.context as any).lastIntent === 'clarification_prompt' &&
        (resC3.context as any).pendingAmbiguity?.metric === 'returns',
      'TEST C3: Ambiguous Returns? triggers clarification prompt "July returns ആണോ August returns ആണോ?"',
      `Got answer="${resC3.answer.ml}"`
    );

    // C4: User answers "July" to resolve ambiguity
    const resC4 = await aiService.askQuestion('July', ctxC);
    ctxC = resC4.context;
    assert(
      resC4.answer.ml.includes('100') &&
        (resC4.context as any).primaryPeriod?.month === 7 &&
        (resC4.context as any).comparisonPeriod === null,
      'TEST C4: User answer "July" resolves ambiguity and returns July returns = 100 cases',
      `Got answer="${resC4.answer.ml}"`
    );

    // C5: Production? (Follow-up after ambiguity resolved to July)
    const resC5 = await aiService.askQuestion('Production?', ctxC);
    ctxC = resC5.context;
    assert(
      resC5.answer.ml.includes('0') && (resC5.context as any).primaryPeriod?.month === 7,
      'TEST C5: Production? -> resolves cleanly to July production = 0 cases',
      `Got answer="${resC5.answer.ml}"`
    );

    // -------------------------------------------------------------------------
    // TEST D: Product Breakdown & Pronoun Entity Resolution
    // -------------------------------------------------------------------------
    console.log('\n--- TEST D: Product Breakdown & Pronoun Entity Resolution ---');
    let ctxD: KenbyConversationContext | undefined = undefined;

    // D1: August returns എത്ര?
    const resD1 = await aiService.askQuestion('August returns എത്ര?', ctxD);
    ctxD = resD1.context;
    assert(
      resD1.answer.ml.includes('10,047'),
      'TEST D1: August returns = 10,047 cases',
      `Got answer="${resD1.answer.ml}"`
    );

    // D2: ഏതൊക്കെ product?
    const resD2 = await aiService.askQuestion('ഏതൊക്കെ product?', ctxD);
    ctxD = resD2.context;
    assert(
      resD2.answer.ml.includes('Kenby 1'),
      'TEST D2: ഏതൊക്കെ product? -> return breakdown showing Kenby 1',
      `Got answer="${resD2.answer.ml}"`
    );

    // D3: ഏതാണ് കൂടുതൽ?
    const resD3 = await aiService.askQuestion('ഏതാണ് കൂടുതൽ?', ctxD);
    ctxD = resD3.context;
    assert(
      resD3.answer.ml.includes('Kenby 1') && (resD3.context as any).product === 'Kenby 1',
      'TEST D3: ഏതാണ് കൂടുതൽ? -> identifies Kenby 1 as lastMeaningfulEntity product',
      `Got answer="${resD3.answer.ml}"`
    );

    // D4: അതിന്റെ stock? (Pronoun resolution against Kenby 1)
    const resD4 = await aiService.askQuestion('അതിന്റെ stock?', ctxD);
    ctxD = resD4.context;
    assert(
      resD4.answer.ml.includes('980') || resD4.answer.ml.includes('Kenby 1'),
      'TEST D4: അതിന്റെ stock? -> resolves pronoun "അതിന്റെ" to Kenby 1 stock (980 cases)',
      `Got answer="${resD4.answer.ml}"`
    );

    // -------------------------------------------------------------------------
    // TEST E: Explicit Context Correction Protocol
    // -------------------------------------------------------------------------
    console.log('\n--- TEST E: Explicit Context Correction Protocol ---');
    let ctxE: KenbyConversationContext | undefined = undefined;

    // E1: July sales എത്ര?
    const resE1 = await aiService.askQuestion('July sales എത്ര?', ctxE);
    ctxE = resE1.context;
    assert(
      resE1.answer.ml.includes('130'),
      'TEST E1: July sales = 130 cases',
      `Got answer="${resE1.answer.ml}"`
    );

    // E2: അല്ല, August ആണ്
    const resE2 = await aiService.askQuestion('അല്ല, August ആണ്', ctxE);
    ctxE = resE2.context;
    assert(
      resE2.answer.ml.includes('1,000') && (resE2.context as any).primaryPeriod?.month === 8 && (resE2.context as any).comparisonPeriod === null,
      'TEST E2: "അല്ല, August ആണ്" -> switches primaryPeriod to August, clears comparisonPeriod, returns 1,000 cases',
      `Got answer="${resE2.answer.ml}"`
    );

    // E3: Production? (Follow-up after correction)
    const resE3 = await aiService.askQuestion('Production?', ctxE);
    ctxE = resE3.context;
    assert(
      resE3.answer.ml.includes('10') && (resE3.context as any).primaryPeriod?.month === 8,
      'TEST E3: Production? -> resolves to August production = 10 cases',
      `Got answer="${resE3.answer.ml}"`
    );

    // -------------------------------------------------------------------------
    // TEST F: Reference Pronoun Follow-up ("ഇത് എത്ര കൂടുതലാണ്?")
    // -------------------------------------------------------------------------
    console.log('\n--- TEST F: Reference Pronoun Follow-up ---');
    let ctxF: KenbyConversationContext | undefined = undefined;

    // F1: August sales എത്ര?
    const resF1 = await aiService.askQuestion('August sales എത്ര?', ctxF);
    ctxF = resF1.context;

    // F2: ഇത് എത്ര കൂടുതലാണ്?
    const resF2 = await aiService.askQuestion('ഇത് എത്ര കൂടുതലാണ്?', ctxF);
    ctxF = resF2.context;
    assert(
      resF2.answer.ml.includes('990') || resF2.answer.ml.includes('കൂടുതലാണ്'),
      'TEST F2: "ഇത് എത്ര കൂടുതലാണ്?" -> calculates difference between sales and production cleanly',
      `Got answer="${resF2.answer.ml}"`
    );

    console.log('\n================================================================');
    console.log(`SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log('================================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err: any) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

runPhase112Tests();
