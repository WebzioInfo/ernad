import 'dotenv/config';
import { KenbyRouterService } from '../src/modules/ai/kenby-router.service';
import { KenbyRagService } from '../src/modules/ai/kenby-rag.service';
import { KenbyLiveDataService } from '../src/modules/ai/kenby-live-data.service';
import { TtsService } from '../src/modules/ai/tts.service';
import { AiService } from '../src/modules/ai/ai.service';

async function runPhase2Tests() {
  console.log('====================================================');
  console.log('       KENBY AI PHASE 2: INTENT ROUTER TESTS       ');
  console.log('====================================================\n');

  const routerService = new KenbyRouterService();
  const ragService = new KenbyRagService();
  const liveDataService = new KenbyLiveDataService();
  const ttsService = new TtsService();
  const aiService = new AiService(ttsService, liveDataService, ragService, routerService);

  const testCases = [
    {
      q: 'Sales dispatch എന്താണ്?',
      expectedType: 'knowledge',
    },
    {
      q: 'ഈ മാസം sales എത്രയാണ്?',
      expectedType: 'sales_summary',
      expectedPeriod: 'this_month',
    },
    {
      q: 'July-ൽ എത്ര sales ഉണ്ടായിരുന്നു?',
      expectedType: 'sales_summary',
      expectedPeriod: 'specific_month',
      expectedYear: 2026,
      expectedMonth: 7,
    },
    {
      q: 'July 12-ന് എത്ര sales ഉണ്ടായിരുന്നു?',
      expectedType: 'sales_summary',
      expectedPeriod: 'specific_date',
      expectedDate: '2026-07-12',
    },
    {
      q: 'ഇന്നലെ sales എത്രയാണ്?',
      expectedType: 'sales_summary',
      expectedPeriod: 'yesterday',
    },
    {
      q: 'Production എന്താണ്?',
      expectedType: 'knowledge',
    },
    {
      q: 'Sales return എന്താണ്?',
      expectedType: 'knowledge',
    },
  ];

  let passedCount = 0;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    console.log(`--- TEST ${i + 1}: "${tc.q}" ---`);

    const intent = await routerService.routeQuestion(tc.q);
    console.log('Intent Result:', JSON.stringify(intent, null, 2));

    if (intent.type !== tc.expectedType) {
      console.error(`❌ FAILED: Expected type "${tc.expectedType}" but got "${intent.type}"`);
    } else {
      let argsMatch = true;
      if (tc.expectedPeriod && intent.type === 'sales_summary') {
        if (intent.input.period !== tc.expectedPeriod) argsMatch = false;
        if (tc.expectedYear && intent.input.year !== tc.expectedYear) argsMatch = false;
        if (tc.expectedMonth && intent.input.month !== tc.expectedMonth) argsMatch = false;
        if (tc.expectedDate && intent.input.date !== tc.expectedDate) argsMatch = false;
      }

      if (!argsMatch) {
        console.error(`❌ FAILED: Intent matched but arguments did not match expected values`);
      } else {
        console.log(`✓ PASSED`);
        passedCount++;
      }
    }

    // Execute full AiService pipeline to verify answer generation
    const response = await aiService.askQuestion(tc.q);
    console.log('AiService Response Source:', response.source);
    console.log('AiService Response Answer (ml):', response.answer.ml);
    console.log('\n');
  }

  console.log('====================================================');
  console.log(`  PHASE 2 ROUTER TESTS COMPLETED: ${passedCount}/${testCases.length} PASSED`);
  console.log('====================================================');

  if (passedCount === testCases.length) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPhase2Tests();
