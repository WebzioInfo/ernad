import { KenbyLiveDataService } from '../src/modules/ai/kenby-live-data.service';
import { KenbyRouterService } from '../src/modules/ai/kenby-router.service';
import { KenbyAnalysisService } from '../src/modules/ai/kenby-analysis.service';
import { KenbyRagService } from '../src/modules/ai/kenby-rag.service';
import { TtsService } from '../src/modules/ai/tts.service';
import { AiService } from '../src/modules/ai/ai.service';

async function runPhase10VoiceIntegrationTests() {
  console.log('====================================================');
  console.log('  KENBY AI PHASE 10: REAL-TIME VOICE INTEGRATION    ');
  console.log('====================================================\n');

  const liveDataService = new KenbyLiveDataService();
  const routerService = new KenbyRouterService();
  const analysisService = new KenbyAnalysisService(liveDataService);
  const ragService = new KenbyRagService();
  const ttsService = new TtsService();
  const aiService = new AiService(ttsService, liveDataService, ragService, routerService, analysisService);

  let passedCount = 0;
  const totalCount = 13;

  // TEST 1: MALAYALAM VOICE QUESTION PIPELINE
  try {
    console.log('--- TEST 1: MALAYALAM VOICE QUESTION PIPELINE ---');
    const res = await aiService.askQuestion('ഈ മാസം sales എത്രയാണ്?');
    if (res.answer.ml && res.audioUrl && res.audioUrl.startsWith('data:audio/mp3;base64,')) {
      console.log(`✓ [PASSED] Malayalam question processed cleanly & audio URI generated: "${res.answer.ml}"`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] Test 1 failed:', res);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 1 Exception:', e.message);
  }

  // TEST 2: ENGLISH VOICE QUESTION PIPELINE
  try {
    console.log('\n--- TEST 2: ENGLISH VOICE QUESTION PIPELINE ---');
    const res = await aiService.askQuestion('How much sales in July?');
    if (res.answer.en && res.audioUrl && res.audioUrl.startsWith('data:audio/mp3;base64,')) {
      console.log(`✓ [PASSED] English question processed cleanly & audio URI generated: "${res.answer.en}"`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] Test 2 failed:', res);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 2 Exception:', e.message);
  }

  // TEST 3: MIXED LANGUAGE VOICE QUESTION PIPELINE
  try {
    console.log('\n--- TEST 3: MIXED LANGUAGE VOICE QUESTION PIPELINE ---');
    const res = await aiService.askQuestion('August-ൽ production എത്രയാണ്?');
    if (res.answer.ml && res.audioUrl) {
      console.log(`✓ [PASSED] Mixed language voice question processed: "${res.answer.ml}"`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] Test 3 failed:', res);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 3 Exception:', e.message);
  }

  // TEST 4: VOICE CONVERSATION CONTEXT PERSISTENCE
  try {
    console.log('\n--- TEST 4: VOICE CONVERSATION CONTEXT PERSISTENCE ---');
    const step1 = await aiService.askQuestion('July sales എത്ര?');
    const step2 = await aiService.askQuestion('Production?', step1.context);
    const step3 = await aiService.askQuestion('Difference?', step2.context);

    if (step3.answer.ml.includes('Sales production-നേക്കാൾ') && step3.audioUrl) {
      console.log(`✓ [PASSED] Voice conversation context preserved across 3 steps: "${step3.answer.ml}"`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] Test 4 context persistence failed:', step3);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 4 Exception:', e.message);
  }

  // TEST 5: KNOWLEDGE VOICE QUESTION (RAG)
  try {
    console.log('\n--- TEST 5: KNOWLEDGE VOICE QUESTION (RAG) ---');
    const res = await aiService.askQuestion('Sales dispatch എന്താണ്?');
    if (res.source === 'kenby_ai_documents' && res.audioUrl) {
      console.log(`✓ [PASSED] Knowledge voice question routed via RAG with TTS audio URI: "${res.answer.ml.substring(0, 50)}..."`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] Test 5 failed:', res);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 5 Exception:', e.message);
  }

  // TEST 6: SALES LIVE DATA VOICE QUESTION
  try {
    console.log('\n--- TEST 6: SALES LIVE DATA VOICE QUESTION ---');
    const res = await aiService.askQuestion('July sales എത്ര?');
    if (res.source === 'sales_transactions' && res.answer.ml.includes('130') && res.audioUrl) {
      console.log(`✓ [PASSED] Live sales voice question returned 130 cases with TTS audio`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] Test 6 failed:', res);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 6 Exception:', e.message);
  }

  // TEST 7: PRODUCTION LIVE DATA VOICE QUESTION
  try {
    console.log('\n--- TEST 7: PRODUCTION LIVE DATA VOICE QUESTION ---');
    const res = await aiService.askQuestion('August production എത്ര?');
    if (res.source === 'production_logs' && res.answer.ml.includes('10') && res.audioUrl) {
      console.log(`✓ [PASSED] Live production voice question returned 10 cases with TTS audio`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] Test 7 failed:', res);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 7 Exception:', e.message);
  }

  // TEST 8: MULTI-METRIC VOICE QUESTION (PHASE 9)
  try {
    console.log('\n--- TEST 8: MULTI-METRIC VOICE QUESTION (PHASE 9) ---');
    const res = await aiService.askQuestion('ഈ മാസം sales production returns damage എല്ലാം പറയൂ.');
    if (res.source === 'kenby_multi_tool_analysis' && res.audioUrl) {
      console.log(`✓ [PASSED] Phase 9 multi-tool voice question returned point-by-point data with TTS audio`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] Test 8 failed:', res);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 8 Exception:', e.message);
  }

  // TEST 9: PRODUCT DRILL-DOWN VOICE QUESTION (PHASE 8)
  try {
    console.log('\n--- TEST 9: PRODUCT DRILL-DOWN VOICE QUESTION (PHASE 8) ---');
    const res = await aiService.askQuestion('August returns product-wise');
    if (res.context?.lastIntent === 'return_breakdown' && res.audioUrl) {
      console.log(`✓ [PASSED] Phase 8 product breakdown voice question returned breakdown with TTS audio`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] Test 9 failed:', res);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 9 Exception:', e.message);
  }

  // TEST 10: GREETING VOICE QUESTION
  try {
    console.log('\n--- TEST 10: GREETING VOICE QUESTION ---');
    const res = await aiService.askQuestion('Hi Kenby');
    if (res.context?.lastIntent === 'greeting' && res.audioUrl) {
      console.log(`✓ [PASSED] Greeting voice question returned polite response with TTS audio`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] Test 10 failed:', res);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 10 Exception:', e.message);
  }

  // TEST 11: UNSUPPORTED FINANCIAL VOICE QUESTION
  try {
    console.log('\n--- TEST 11: UNSUPPORTED FINANCIAL VOICE QUESTION ---');
    const res = await aiService.askQuestion('Payment എത്ര കിട്ടി?');
    if (res.answer.ml.includes('ലഭ്യമല്ല') && res.audioUrl) {
      console.log(`✓ [PASSED] Unsupported financial voice question transparently declined: "${res.answer.ml}"`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] Test 11 failed:', res);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 11 Exception:', e.message);
  }

  // TEST 12: VALID TTS AUDIO URL GENERATION
  try {
    console.log('\n--- TEST 12: VALID TTS AUDIO URL GENERATION ---');
    const audioUrl = await ttsService.generateNeuralSpeech('ഓഗസ്റ്റ് മാസത്തിൽ 1000 cases sales dispatch ചെയ്തിട്ടുണ്ട്.', 'ml');
    if (audioUrl && audioUrl.startsWith('data:audio/mp3;base64,')) {
      console.log('✓ [PASSED] Valid Base64 MP3 Audio Data URI generated by Neural TTS engine');
      passedCount++;
    } else {
      console.error('✗ [FAILED] Test 12 failed:', audioUrl);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 12 Exception:', e.message);
  }

  // TEST 13: TTS TEXT SANITIZATION ACCURACY
  try {
    console.log('\n--- TEST 13: TTS TEXT SANITIZATION ACCURACY ---');
    const rawMarkdown = '### August Sales\n• Sales: 1,000 cases\n• Production: 10 cases 👋';
    const sanitized = ttsService.prepareSpeechText(rawMarkdown, 'ml');
    if (
      !sanitized.includes('#') &&
      !sanitized.includes('•') &&
      !sanitized.includes('👋') &&
      sanitized.includes('1000 cases')
    ) {
      console.log(`✓ [PASSED] TTS Sanitizer cleanly prepared text: "${sanitized}"`);
      passedCount++;
    } else {
      console.error('✗ [FAILED] Test 13 sanitization failed:', sanitized);
    }
  } catch (e: any) {
    console.error('✗ [FAILED] Test 13 Exception:', e.message);
  }

  console.log('\n====================================================');
  console.log(`  PHASE 10 VOICE INTEGRATION TESTS: ${passedCount}/${totalCount} PASSED`);
  console.log('====================================================');

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runPhase10VoiceIntegrationTests();
