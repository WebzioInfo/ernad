/**
 * KENBY AI: REAL PRODUCTION CHAT ORCHESTRATION TEST SUITE
 * 
 * Verifies the actual Ask Kenby orchestration path executing identical queries
 * sent by the frontend UI (/owner/ai).
 */

import { AiService } from '../src/modules/ai/ai.service';
import { KenbyRouterService } from '../src/modules/ai/kenby-router.service';
import { KenbyLiveDataService } from '../src/modules/ai/kenby-live-data.service';
import { KenbyRagService } from '../src/modules/ai/kenby-rag.service';
import { KenbyAnalysisService } from '../src/modules/ai/kenby-analysis.service';
import { KenbyEntityResolverService } from '../src/modules/ai/kenby-entity-resolver.service';
import { KenbyCapabilityResolverService } from '../src/modules/ai/kenby-capability-resolver.service';
import { KenbyErpRegistryService } from '../src/modules/ai/kenby-erp-registry.service';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

function assertTest(name: string, condition: boolean, details?: string) {
  if (condition) {
    passed++;
    console.log(`${GREEN}✅ PASS [${passed + failed}]: ${name}${RESET}`);
  } else {
    failed++;
    console.log(`${RED}❌ FAIL [${passed + failed}]: ${name}${RESET}`);
    if (details) console.log(`   ${RED}Details: ${details}${RESET}`);
  }
}

async function runRealChatOrchestrationTests() {
  console.log(`\n${CYAN}====================================================${RESET}`);
  console.log(`${CYAN}🧪 KENBY AI: REAL CHAT ORCHESTRATION TEST SUITE${RESET}`);
  console.log(`${CYAN}====================================================\n${RESET}`);

  // Instantiate real services
  const entityResolver = new KenbyEntityResolverService();
  const capabilityResolver = new KenbyCapabilityResolverService();
  const router = new KenbyRouterService(entityResolver, capabilityResolver);
  const liveData = new KenbyLiveDataService();
  const analysis = new KenbyAnalysisService(liveData);
  const rag = new KenbyRagService();
  const erpRegistry = new KenbyErpRegistryService();
  const ttsMock = { generateNeuralSpeech: async () => null } as any;

  const aiService = new AiService(ttsMock, liveData, rag, router, analysis, erpRegistry);

  const GENERIC_FALLBACK_TEXT = 'ആ ചോദ്യത്തിന് ERP ഡേറ്റയിൽ നിന്ന് ഉത്തരം കണ്ടെത്താനായില്ല';

  // ----------------------------------------------------
  // TEST 1: Current Month Sales Dispatch
  // ----------------------------------------------------
  console.log(`\n${YELLOW}--- 1. CURRENT MONTH SALES DISPATCH ---${RESET}`);
  const q1 = 'ഈ മാസം എത്ര sales dispatch ചെയ്തു?';
  const res1 = await aiService.askQuestion(q1, { year: 2026, month: 8 } as any);
  assertTest(
    'Current month sales dispatch executes live ERP sales summary',
    !res1.answer.ml.includes(GENERIC_FALLBACK_TEXT) &&
    res1.source === 'sales_transactions' &&
    res1.answer.ml.includes('1,000') &&
    res1.data?.totalQuantity === 1000,
    `Source: ${res1.source}, Answer: ${res1.answer.ml}`
  );

  // ----------------------------------------------------
  // TEST 2: Previous Month Sales Dispatch
  // ----------------------------------------------------
  console.log(`\n${YELLOW}--- 2. PREVIOUS MONTH SALES DISPATCH ---${RESET}`);
  const q2 = 'കഴിഞ്ഞ മാസം sales dispatch എത്ര?';
  const res2 = await aiService.askQuestion(q2, { year: 2026, month: 8 } as any);
  assertTest(
    'Previous month sales dispatch resolves July 2026 period correctly',
    !res2.answer.ml.includes(GENERIC_FALLBACK_TEXT) &&
    res2.source === 'sales_transactions' &&
    res2.answer.ml.includes('130') &&
    res2.data?.totalQuantity === 130,
    `Source: ${res2.source}, Answer: ${res2.answer.ml}`
  );

  // ----------------------------------------------------
  // TEST 2B: Phonetic Dialect Previous Month ("കടഞ്ഞ മാസം")
  // ----------------------------------------------------
  console.log(`\n${YELLOW}--- 2B. PHONETIC DIALECT PREVIOUS MONTH ---${RESET}`);
  const q2b = 'കടഞ്ഞ മാസം sales dispatch എത്ര';
  const res2b = await aiService.askQuestion(q2b, { year: 2026, month: 8 } as any);
  assertTest(
    'Phonetic variation "കടഞ്ഞ മാസം" resolves to previous month (130 units)',
    !res2b.answer.ml.includes(GENERIC_FALLBACK_TEXT) &&
    res2b.source === 'sales_transactions' &&
    res2b.answer.ml.includes('130'),
    `Source: ${res2b.source}, Answer: ${res2b.answer.ml}`
  );

  // ----------------------------------------------------
  // TEST 3: Generic Customer Query (Clarification Prompt)
  // ----------------------------------------------------
  console.log(`\n${YELLOW}--- 3. GENERIC CUSTOMER QUERY ---${RESET}`);
  const q3 = 'കസ്റ്റമർ വിവരങ്ങൾ';
  const res3 = await aiService.askQuestion(q3);
  assertTest(
    'Generic customer details query returns helpful clarification prompt, NOT old generic fallback',
    !res3.answer.ml.includes(GENERIC_FALLBACK_TEXT) &&
    (res3.answer.ml.includes('ഏത് customer') || res3.answer.ml.includes('Sinan')),
    `Answer: ${res3.answer.ml}`
  );

  // ----------------------------------------------------
  // TEST 4: Finished Goods Stock Query
  // ----------------------------------------------------
  console.log(`\n${YELLOW}--- 4. FINISHED GOODS STOCK QUERY ---${RESET}`);
  const q4 = 'ഹോ finished goods stock';
  const res4 = await aiService.askQuestion(q4, { year: 2026, month: 8 } as any);
  assertTest(
    'Finished goods stock query executes stock summary',
    !res4.answer.ml.includes(GENERIC_FALLBACK_TEXT) &&
    (res4.answer.ml.includes('സ്റ്റോക്ക്') || res4.answer.ml.includes('ലഭ്യമാണ്') || res4.answer.ml.includes('cases')),
    `Answer: ${res4.answer.ml}`
  );

  // ----------------------------------------------------
  // TEST 5: Named Product Stock (Kenby 1)
  // ----------------------------------------------------
  console.log(`\n${YELLOW}--- 5. NAMED PRODUCT STOCK ---${RESET}`);
  const q5 = 'Kenby 1 stock എത്ര?';
  const res5 = await aiService.askQuestion(q5);
  assertTest(
    'Named product stock executes product_stock_named with 980 cases',
    !res5.answer.ml.includes(GENERIC_FALLBACK_TEXT) &&
    res5.source === 'production_stock' &&
    res5.answer.ml.includes('980'),
    `Source: ${res5.source}, Answer: ${res5.answer.ml}`
  );

  // ----------------------------------------------------
  // TEST 6: Named Raw Material Stock (Green Cap)
  // ----------------------------------------------------
  console.log(`\n${YELLOW}--- 6. NAMED RAW MATERIAL STOCK ---${RESET}`);
  const q6 = 'Green Cap stock എത്ര?';
  const res6 = await aiService.askQuestion(q6);
  assertTest(
    'Named raw material stock executes raw_material_item',
    !res6.answer.ml.includes(GENERIC_FALLBACK_TEXT) &&
    res6.source === 'raw_materials' &&
    (res6.answer.ml.includes('Green Cap') || res6.answer.ml.includes('CAP')),
    `Source: ${res6.source}, Answer: ${res6.answer.ml}`
  );

  // ----------------------------------------------------
  // TEST 7: Static Concept Definition (RAG Knowledge)
  // ----------------------------------------------------
  console.log(`\n${YELLOW}--- 7. RAG KNOWLEDGE DEFINITION ---${RESET}`);
  const q7 = 'sales dispatch എന്താണ്?';
  const res7 = await aiService.askQuestion(q7);
  assertTest(
    'Static concept question routes to RAG knowledge',
    !res7.answer.ml.includes(GENERIC_FALLBACK_TEXT) &&
    res7.source === 'kenby_ai_documents' &&
    (res7.answer.ml.includes('Sales Dispatch') || res7.answer.ml.includes('വിൽപ്പന') || res7.answer.ml.includes('കസ്റ്റമർ')),
    `Source: ${res7.source}, Answer: ${res7.answer.ml}`
  );

  // ----------------------------------------------------
  // TEST 8: Hybrid Query (Live Metric + RAG Concept)
  // ----------------------------------------------------
  console.log(`\n${YELLOW}--- 8. HYBRID QUERY ---${RESET}`);
  const q8 = 'ഈ മാസം sales dispatch എത്ര, sales dispatch എന്താണ്?';
  const res8 = await aiService.askQuestion(q8);
  assertTest(
    'Hybrid query combines live operational number and RAG concept',
    !res8.answer.ml.includes(GENERIC_FALLBACK_TEXT) &&
    res8.source === 'hybrid' &&
    res8.answer.ml.includes('1,000') &&
    (res8.answer.ml.includes('വിശദീകരണം') || res8.answer.ml.includes('Concept Definition')),
    `Source: ${res8.source}, Answer: ${res8.answer.ml}`
  );

  // ----------------------------------------------------
  // TEST 9: Unsupported Accounting / Profit-Loss Guardrail
  // ----------------------------------------------------
  console.log(`\n${YELLOW}--- 9. UNSUPPORTED FINANCIAL GUARDRAIL ---${RESET}`);
  const q9 = 'കമ്പനിയുടെ ഈ മാസത്തെ net profit എത്ര?';
  const res9 = await aiService.askQuestion(q9);
  assertTest(
    'Company profit/loss returns honest unavailable safety message',
    res9.answer.ml.includes('സാമ്പത്തിക / പേയ്‌മെന്റ് വിവരങ്ങൾ') || res9.answer.ml.includes('ലഭ്യമല്ല'),
    `Answer: ${res9.answer.ml}`
  );

  console.log(`\n${CYAN}====================================================${RESET}`);
  console.log(`${CYAN}📊 CHAT ORCHESTRATION RESULTS: ${passed} PASSED | ${failed} FAILED (Total: ${passed + failed})${RESET}`);
  console.log(`${CYAN}====================================================\n${RESET}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runRealChatOrchestrationTests().catch((e) => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
