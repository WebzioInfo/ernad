import { KenbyRouterService, KenbyConversationContext } from '../src/modules/ai/kenby-router.service';
import { AiService } from '../src/modules/ai/ai.service';
import { KenbyLiveDataService } from '../src/modules/ai/kenby-live-data.service';
import { KenbyRagService } from '../src/modules/ai/kenby-rag.service';
import { TtsService } from '../src/modules/ai/tts.service';

async function runPhase6Tests() {
  console.log('====================================================');
  console.log('  KENBY AI — PHASE 6 CONVERSATIONAL CONTEXT TEST SUITE');
  console.log('====================================================\n');

  // Mock TTS service to avoid network delays during unit testing
  const mockTtsService = {
    generateNeuralSpeech: async () => null,
  } as unknown as TtsService;

  // Mock Live Data Service
  const mockLiveDataService = {
    getSalesSummary: async (input: any) => ({
      period: input,
      totalQuantity: 100,
      transactionCount: 2,
    }),
    getProductionSummary: async (input: any) => ({
      period: input,
      totalCasesProduced: 50,
      logCount: 1,
    }),
    getCurrentStock: async (filter?: string) => ({
      totalCurrentStock: 980,
      products: filter ? [{ productName: filter, currentStock: 980 }] : [],
    }),
    getSalesReturnSummary: async (input: any) => ({
      period: input,
      totalQuantity: 10,
      transactionCount: 1,
    }),
    getDamageSummary: async (input: any) => ({
      period: input,
      totalQuantity: 0,
      transactionCount: 0,
    }),
    getBusinessSnapshot: async (input: any) => ({
      period: input || { startDate: '2026-08-01', endDate: '2026-08-15' },
      sales: { quantity: 1000, transactionCount: 1 },
      production: { casesProduced: 10, logCount: 1 },
      stock: { totalCurrentStock: 980 },
      returns: { quantity: 10 },
      damage: { quantity: 0 },
      insights: [{ id: '1', text: { ml: 'Sales നല്ല നിലയിലാണ്.', en: 'Sales performance is good.' } }],
    }),
  } as unknown as KenbyLiveDataService;

  // Mock RAG Service
  const mockRagService = {
    retrieveKnowledge: async (query: string) => {
      if (query.toLowerCase().includes('sales dispatch')) {
        return { title: 'Sales Dispatch', content: 'വാഹനത്തിലേക്ക് ഉൽപ്പന്നങ്ങൾ കയറ്റി അയക്കുന്ന പ്രക്രിയ' };
      }
      if (query.toLowerCase().includes('return')) {
        return { title: 'Sales Return', content: 'ഉപഭോക്താവ് ഉൽപ്പന്നം തിരികെ നൽകുന്നത്' };
      }
      return null;
    },
  } as unknown as KenbyRagService;

  const kenbyRouterService = new KenbyRouterService();
  const aiService = new AiService(
    mockTtsService,
    mockLiveDataService,
    mockRagService,
    kenbyRouterService
  );

  let passedCount = 0;
  let failedCount = 0;

  function assertTest(testNum: number, description: string, condition: boolean, detail: string) {
    if (condition) {
      console.log(`[PASS] Test ${testNum}: ${description}`);
      passedCount++;
    } else {
      console.log(`[FAIL] Test ${testNum}: ${description} — Detail: ${detail}`);
      failedCount++;
    }
  }

  try {
    // 1. "July sales എത്ര?"
    let res1 = await aiService.askQuestion('July sales എത്ര?');
    assertTest(
      1,
      '"July sales എത്ര?" -> sales_summary, July',
      res1.context?.lastIntent === 'sales_summary' && res1.context?.lastPeriod?.month === 7,
      JSON.stringify(res1.context)
    );

    // 2. "August-ലോ?" after Test 1
    let res2 = await aiService.askQuestion('August-ലോ?', res1.context);
    assertTest(
      2,
      '"August-ലോ?" -> sales_summary, August',
      res2.context?.lastIntent === 'sales_summary' && res2.context?.lastPeriod?.month === 8,
      JSON.stringify(res2.context)
    );

    // 3. "Production?" after Test 2
    let res3 = await aiService.askQuestion('Production?', res2.context);
    assertTest(
      3,
      '"Production?" -> production_summary, August',
      res3.context?.lastIntent === 'production_summary' && res3.context?.lastPeriod?.month === 8,
      JSON.stringify(res3.context)
    );

    // 4. "July-ലോ?" after Test 3
    let res4 = await aiService.askQuestion('July-ലോ?', res3.context);
    assertTest(
      4,
      '"July-ലോ?" -> production_summary, July',
      res4.context?.lastIntent === 'production_summary' && res4.context?.lastPeriod?.month === 7,
      JSON.stringify(res4.context)
    );

    // 5. "Stock?" after Test 4
    let res5 = await aiService.askQuestion('Stock?', res4.context);
    assertTest(
      5,
      '"Stock?" -> stock_summary',
      res5.context?.lastIntent === 'stock_summary',
      JSON.stringify(res5.context)
    );

    // 6. "Kenby 1 stock എത്ര?"
    let res6 = await aiService.askQuestion('Kenby 1 stock എത്ര?');
    assertTest(
      6,
      '"Kenby 1 stock എത്ര?" -> stock_summary, Kenby 1',
      res6.context?.lastIntent === 'stock_summary' && res6.context?.lastProduct === 'Kenby 1',
      JSON.stringify(res6.context)
    );

    // 7. "അതിന്റെ July sales?" after Test 6
    let res7 = await aiService.askQuestion('അതിന്റെ July sales?', res6.context);
    assertTest(
      7,
      '"അതിന്റെ July sales?" -> sales_summary, Kenby 1, July',
      res7.context?.lastIntent === 'sales_summary' && res7.context?.lastProduct === 'Kenby 1' && res7.context?.lastPeriod?.month === 7,
      JSON.stringify(res7.context)
    );

    // 8. "ഈ മാസം business എങ്ങനെയുണ്ട്?"
    let res8 = await aiService.askQuestion('ഈ മാസം business എങ്ങനെയുണ്ട്?');
    assertTest(
      8,
      '"ഈ മാസം business എങ്ങനെയുണ്ട്?" -> business_snapshot',
      res8.context?.lastIntent === 'business_snapshot',
      JSON.stringify(res8.context)
    );

    // 9. "Sales?" after Test 8
    let res9 = await aiService.askQuestion('Sales?', res8.context);
    assertTest(
      9,
      '"Sales?" -> sales_summary, same month',
      res9.context?.lastIntent === 'sales_summary',
      JSON.stringify(res9.context)
    );

    // 10. "എന്താണ് ശ്രദ്ധിക്കേണ്ടത്?" after Test 8
    let res10 = await aiService.askQuestion('എന്താണ് ശ്രദ്ധിക്കേണ്ടത്?', res8.context);
    assertTest(
      10,
      '"എന്താണ് ശ്രദ്ധിക്കേണ്ടത്?" -> business_snapshot insights',
      res10.context?.lastIntent === 'business_snapshot',
      JSON.stringify(res10.context)
    );

    // 11. "Sales dispatch എന്താണ്?"
    let res11 = await aiService.askQuestion('Sales dispatch എന്താണ്?');
    assertTest(
      11,
      '"Sales dispatch എന്താണ്?" -> knowledge',
      res11.context?.lastIntent === 'knowledge',
      JSON.stringify(res11.context)
    );

    // 12. "Return എന്താണ്?" after Test 11
    let res12 = await aiService.askQuestion('Return എന്താണ്?', res11.context);
    assertTest(
      12,
      '"Return എന്താണ്?" after knowledge -> knowledge',
      res12.context?.lastIntent === 'knowledge',
      JSON.stringify(res12.context)
    );

    // 13. "Hi"
    let res13 = await aiService.askQuestion('Hi', res12.context);
    assertTest(
      13,
      '"Hi" -> greeting (context reset)',
      res13.context?.lastIntent === 'greeting',
      JSON.stringify(res13.context)
    );

    // 14. "ഹായ്"
    let res14 = await aiService.askQuestion('ഹായ്');
    assertTest(
      14,
      '"ഹായ്" -> greeting',
      res14.context?.lastIntent === 'greeting',
      JSON.stringify(res14.context)
    );

    // 15. "July sales എത്ര?" then "August production എത്ര?" (Explicit overrides context)
    let res15a = await aiService.askQuestion('July sales എത്ര?');
    let res15b = await aiService.askQuestion('August production എത്ര?', res15a.context);
    assertTest(
      15,
      'Explicit question overrides context ("August production എത്ര?" -> production_summary, August)',
      res15b.context?.lastIntent === 'production_summary' && res15b.context?.lastPeriod?.month === 8,
      JSON.stringify(res15b.context)
    );

    // 16. "How about August?" after July sales
    let res16a = await aiService.askQuestion('July sales koliko?');
    let res16b = await aiService.askQuestion('How about August?', res16a.context);
    assertTest(
      16,
      '"How about August?" -> sales_summary, August',
      res16b.context?.lastIntent === 'sales_summary' && res16b.context?.lastPeriod?.month === 8,
      JSON.stringify(res16b.context)
    );

    // 17. "And stock?" after August production
    let res17a = await aiService.askQuestion('August production berapa?');
    let res17b = await aiService.askQuestion('And stock?', res17a.context);
    assertTest(
      17,
      '"And stock?" -> stock_summary',
      res17b.context?.lastIntent === 'stock_summary',
      JSON.stringify(res17b.context)
    );

    // 18. "Yesterday?" after sales question
    let res18a = await aiService.askQuestion('July sales എത്ര?');
    let res18b = await aiService.askQuestion('Yesterday?', res18a.context);
    assertTest(
      18,
      '"Yesterday?" -> sales_summary, yesterday',
      res18b.context?.lastIntent === 'sales_summary' && res18b.context?.lastPeriod?.period === 'yesterday',
      JSON.stringify(res18b.context)
    );

  } catch (err: any) {
    console.error('Test execution exception:', err);
  } finally {
    console.log('\n----------------------------------------------------');
    console.log(`TEST SUMMARY: ${passedCount} PASSED / ${failedCount} FAILED`);
    console.log('----------------------------------------------------');

    if (failedCount > 0) {
      process.exit(1);
    }
  }
}

runPhase6Tests();
