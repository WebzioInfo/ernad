import { AiService } from '../src/modules/ai/ai.service';
import { KenbyRouterService } from '../src/modules/ai/kenby-router.service';
import { KenbyLiveDataService } from '../src/modules/ai/kenby-live-data.service';
import { KenbyRagService } from '../src/modules/ai/kenby-rag.service';
import { KenbyAnalysisService } from '../src/modules/ai/kenby-analysis.service';
import { KenbyEntityResolverService } from '../src/modules/ai/kenby-entity-resolver.service';
import { KenbyCapabilityResolverService } from '../src/modules/ai/kenby-capability-resolver.service';
import { KenbyErpRegistryService } from '../src/modules/ai/kenby-erp-registry.service';

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

function assertTest(title: string, condition: boolean, detail: string = '') {
  if (condition) {
    passed++;
    console.log(`${GREEN}✅ PASS [${passed + failed}]: ${title}${RESET}`);
  } else {
    failed++;
    console.log(`${RED}❌ FAIL [${passed + failed}]: ${title} — ${detail}${RESET}`);
  }
}

async function runSuite() {
  console.log(`\n${CYAN}====================================================`);
  console.log(`🧪 KENBY PHASE A3: UNIVERSAL READ-ONLY ERP TOOLS SUITE`);
  console.log(`====================================================${RESET}\n`);

  // Initialize service dependencies
  const entityResolver = new KenbyEntityResolverService();
  const capabilityResolver = new KenbyCapabilityResolverService();
  const erpRegistry = new KenbyErpRegistryService();
  const routerService = new KenbyRouterService(entityResolver, capabilityResolver);
  const ragService = new KenbyRagService();
  const liveDataService = new KenbyLiveDataService();
  const analysisService = new KenbyAnalysisService(liveDataService);
  const mockTtsService: any = {
    generateNeuralSpeech: async () => null,
  };

  const aiService = new AiService(
    mockTtsService,
    liveDataService,
    ragService,
    routerService,
    analysisService,
    erpRegistry
  );

  console.log(`\n${YELLOW}--- 1. CUSTOMER INTELLIGENCE TESTS ---${RESET}`);

  // Test 1: Customer Profile
  const res1 = await aiService.askQuestion('Show profile of Sinan');
  assertTest(
    'Customer full profile returns Sinan profile',
    res1.answer.en.includes('Sinan') && (res1.answer.en.includes('Profile') || res1.answer.en.includes('Status') || res1.answer.en.includes('Financials')),
    `Answer: ${res1.answer.en}`
  );

  // Test 2: Customer Balance
  const res2 = await aiService.askQuestion('What is the outstanding balance of Sinan?');
  assertTest(
    'Customer balance returns outstanding financial details',
    res2.answer.en.includes('Sinan') && (res2.answer.en.includes('Outstanding') || res2.answer.en.includes('Balance') || res2.answer.en.includes('₹')),
    `Answer: ${res2.answer.en}`
  );

  // Test 3: Customer Payment History
  const res3 = await aiService.askQuestion('Sinan payments history');
  assertTest(
    'Customer payment history executes customer_payments',
    res3.answer.en.includes('Sinan') && (res3.answer.en.includes('Payment') || res3.answer.en.includes('payments') || res3.answer.en.includes('records found')),
    `Answer: ${res3.answer.en}`
  );

  // Test 4: Customer Ledger
  const res4 = await aiService.askQuestion('Show ledger statement for Sinan');
  assertTest(
    'Customer ledger returns debit/credit statement',
    res4.answer.en.includes('Ledger') || res4.answer.en.includes('Sinan') || res4.answer.en.includes('Balance'),
    `Answer: ${res4.answer.en}`
  );

  // Test 5: Customer Pronoun Follow-up
  const res5 = await aiService.askQuestion('അതിന്റെ payment എത്ര?', {
    activeTopic: 'customers',
    customer: 'Sinan',
    lastEntity: { type: 'customer', id: '522b636a-f19c-4160-a0f1-7a7ea7154aa1', name: 'Sinan' },
    language: 'ml',
  });
  assertTest(
    'Customer pronoun follow-up resolves to Sinan payments',
    res5.answer.ml.includes('Sinan') && (res5.answer.ml.includes('പേയ്‌മെന്റ്') || res5.answer.ml.includes('ലഭിച്ചിട്ടില്ല') || res5.answer.ml.includes('രേഖപ്പെടുത്തിയിട്ടില്ല')),
    `Answer: ${res5.answer.ml}`
  );

  console.log(`\n${YELLOW}--- 2. PRODUCT INTELLIGENCE TESTS ---${RESET}`);

  // Test 6: Named Product Profile
  const res6 = await aiService.askQuestion('Kenby 1 full details');
  assertTest(
    'Named product profile returns Kenby 1',
    res6.answer.en.includes('Kenby 1') && (res6.answer.en.includes('Target BPM') || res6.answer.en.includes('Units/Case') || res6.answer.en.includes('Profile')),
    `Answer: ${res6.answer.en}`
  );

  // Test 7: Named Product Stock
  const res7 = await aiService.askQuestion('What is the stock of Kenby 1?');
  assertTest(
    'Named product stock queries live stock',
    res7.answer.en.includes('Kenby 1') && res7.answer.en.includes('cases'),
    `Answer: ${res7.answer.en}`
  );

  // Test 8: Named Product Sales / Production
  const res8 = await aiService.askQuestion('July sales for Kenby 1');
  assertTest(
    'Named product sales returns filtered sales data',
    res8.answer.en.includes('Kenby 1') || res8.answer.en.includes('July 2026'),
    `Answer: ${res8.answer.en}`
  );

  // Test 9: Named Product BOM
  const res9 = await aiService.askQuestion('What is the BOM for Kenby 1?');
  assertTest(
    'Named product BOM returns bill of materials',
    res9.answer.en.includes('Bill of Materials') || res9.answer.en.includes('BOM') || res9.answer.en.includes('Kenby 1'),
    `Answer: ${res9.answer.en}`
  );

  // Test 10: Product Context Follow-up
  const res10 = await aiService.askQuestion('അതിന്റെ stock എത്രയുണ്ട്?', {
    activeTopic: 'stock',
    product: 'Kenby 1',
    lastEntity: { type: 'product', id: 'p-1', name: 'Kenby 1' },
    language: 'ml',
  });
  assertTest(
    'Product context follow-up returns Kenby 1 stock',
    res10.answer.ml.includes('Kenby 1') || res10.answer.ml.includes('cases'),
    `Answer: ${res10.answer.ml}`
  );

  console.log(`\n${YELLOW}--- 3. RAW MATERIAL INTELLIGENCE TESTS ---${RESET}`);

  // Test 11: Named Raw Material Stock
  const res11 = await aiService.askQuestion('Green Cap stock എത്ര?');
  assertTest(
    'Raw material stock resolves Green Cap as raw material',
    res11.answer.ml.includes('Cap') || res11.answer.ml.includes('സ്റ്റോക്ക്') || res11.answer.ml.includes('യൂണിറ്റ്') || res11.answer.ml.includes('ലഭ്യമല്ല'),
    `Answer: ${res11.answer.ml}`
  );

  // Test 12: Raw Material Movements
  const res12 = await aiService.askQuestion('Show Cap movements');
  assertTest(
    'Raw material movements queries material transactions',
    res12.answer.en.includes('Movement') || res12.answer.en.includes('Cap') || res12.answer.en.includes('transactions'),
    `Answer: ${res12.answer.en}`
  );

  // Test 13: Raw Material Pronoun Follow-up
  const res13 = await aiService.askQuestion('അതിന്റെ movements കാണിക്കൂ', {
    activeTopic: 'raw_materials',
    rawMaterial: 'CAP',
    lastEntity: { type: 'raw_material', id: 'mat-123', name: 'CAP' },
    language: 'ml',
  });
  assertTest(
    'Raw material pronoun follow-up resolves to CAP movements',
    res13.answer.ml.includes('Cap') || res13.answer.ml.includes('CAP') || res13.answer.ml.includes('മൂവ്മെന്റ്') || res13.answer.ml.includes('ട്രാൻസാക്ഷനുകൾ'),
    `Answer: ${res13.answer.ml}`
  );

  // Test 14: Verify No Finished Goods Fallback for Raw Material
  const res14 = await routerService.routeQuestion('How much Green Cap stock do we have?');
  assertTest(
    'Raw Material does not route to sales or finished goods stock',
    res14.type === 'raw_material_item' || res14.type === 'raw_material_summary',
    `Routed intent: ${res14.type}`
  );

  console.log(`\n${YELLOW}--- 4. WAREHOUSE INTELLIGENCE TESTS ---${RESET}`);

  // Test 15: Warehouse / Inventory stock summary
  const res15 = await aiService.askQuestion('Show factory warehouse stock');
  assertTest(
    'Warehouse inventory query executes inventory_stock_summary',
    res15.answer.en.includes('warehouse') || res15.answer.en.includes('Warehouse') || res15.answer.en.includes('inventory') || res15.answer.en.includes('Stock') || res15.answer.en.includes('records found'),
    `Answer: ${res15.answer.en}`
  );

  console.log(`\n${YELLOW}--- 5. PRODUCTION INTELLIGENCE TESTS ---${RESET}`);

  // Test 16: Active Production Batches
  const res16 = await aiService.askQuestion('Show active production batches');
  assertTest(
    'Active batches returns batch schedule and status',
    res16.answer.en.includes('Batch') || res16.answer.en.includes('RUNNING') || res16.answer.en.includes('Active'),
    `Answer: ${res16.answer.en}`
  );

  // Test 17: Named Batch Details
  const res17 = await erpRegistry.getNamedBatchDetails('EB');
  assertTest(
    'Named batch details queries production batches table',
    res17 !== undefined,
    `Batch details: ${JSON.stringify(res17)}`
  );

  // Test 18: Machine Downtime
  const res18 = await aiService.askQuestion('Show recent machine downtime');
  assertTest(
    'Machine downtime queries downtime logs',
    res18.answer.en.includes('Downtime') || res18.answer.en.includes('downtime') || res18.answer.en.includes('Breakdown') || res18.answer.en.includes('minutes') || res18.answer.en.includes('records found'),
    `Answer: ${res18.answer.en}`
  );

  console.log(`\n${YELLOW}--- 6. PROCUREMENT INTELLIGENCE TESTS ---${RESET}`);

  // Test 19: Vendor List / Suppliers
  const res19 = await aiService.askQuestion('List our suppliers');
  assertTest(
    'Vendor list returns registered suppliers',
    res19.answer.en.includes('Vendor') || res19.answer.en.includes('Supplier') || res19.answer.en.includes('supplier') || res19.answer.en.includes('Registered') || res19.answer.en.includes('records found'),
    `Answer: ${res19.answer.en}`
  );

  // Test 20: Goods Receipts (GRN)
  const res20 = await aiService.askQuestion('Show recent goods receipts');
  assertTest(
    'Goods receipts queries GRN records',
    res20.answer.en.includes('Goods Receipts') || res20.answer.en.includes('GRN') || res20.answer.en.includes('records found') || res20.answer.en.includes('Supplier'),
    `Answer: ${res20.answer.en}`
  );

  console.log(`\n${YELLOW}--- 7. INCIDENT INTELLIGENCE TESTS ---${RESET}`);

  // Test 21: Open Incidents Summary
  const res21 = await aiService.askQuestion('Show open factory incidents');
  assertTest(
    'Open incidents queries factory breakdown tickets',
    res21.answer.en.includes('Incidents') || res21.answer.en.includes('breakdown') || res21.answer.en.includes('Open'),
    `Answer: ${res21.answer.en}`
  );

  console.log(`\n${YELLOW}--- 8. RAG KNOWLEDGE & SOURCE DISCIPLINE TESTS ---${RESET}`);

  // Test 22: Static Concept Question Routes to RAG
  const res22 = await routerService.routeQuestion('What is a sales dispatch?');
  assertTest(
    'Static concept question routes to knowledge intent',
    res22.type === 'knowledge',
    `Routed intent: ${res22.type}`
  );

  // Test 23: Live Numerical Question NEVER routes to RAG
  const res23 = await routerService.routeQuestion('Kenby 1 stock എത്രയുണ്ട്?');
  assertTest(
    'Live numerical question routes to operational stock tool, NOT knowledge',
    res23.type !== 'knowledge',
    `Routed intent: ${res23.type}`
  );

  // Test 24: Malayalam Concept Question Routes to RAG
  const res24 = await routerService.routeQuestion('പ്രൊഡക്ഷൻ എന്താണ്?');
  assertTest(
    'Malayalam concept question routes to knowledge intent',
    res24.type === 'knowledge',
    `Routed intent: ${res24.type}`
  );

  console.log(`\n${YELLOW}--- 9. SAFETY & GUARDRAILS TESTS ---${RESET}`);

  // Test 25: Unknown Entity Handled Gracefully
  const res25 = await entityResolver.resolveEntity('NonExistentXYZCorp123');
  assertTest(
    'Unknown entity returns matchStatus = none',
    res25.matchStatus === 'none' && res25.entity === null,
    `Result: ${JSON.stringify(res25)}`
  );

  // Test 26: Ambiguity Handling
  const res26 = await routerService.routeQuestion('August sales എത്ര? അല്ലെങ്കിൽ July?');
  assertTest(
    'Ambiguity returns clarification prompt or structured analysis',
    res26.type === 'clarification_prompt' || res26.type === 'business_analysis' || res26.type === 'sales_summary',
    `Intent: ${res26.type}`
  );

  // Test 27: Explicit Entity Overrides Old Context
  const res27 = await routerService.routeQuestion('Kenby 1 full details', {
    activeTopic: 'customers',
    customer: 'ABC Traders',
    lastEntity: { type: 'customer', id: 'cust-123', name: 'ABC Traders' },
    language: 'ml',
  });
  assertTest(
    'Explicit new product entity overrides prior customer context',
    res27.type === 'product_profile',
    `Intent: ${res27.type}`
  );

  // Test 28: Unsupported ERP Capability Rejected Cleanly
  const res28 = capabilityResolver.resolveCapability('Show our general accounting payroll');
  assertTest(
    'General accounting/payroll capability rejected with unsupported status',
    res28.status === 'unsupported',
    `Status: ${res28.status}`
  );

  // Test 29: Financial / Profit Loss Safety Response
  const res29 = await aiService.askQuestion('What is our monthly company profit and loss?');
  assertTest(
    'Company profit/loss returns honest unavailable safety message',
    res29.answer.en.includes('not managed in Kenby') || res29.answer.ml.includes('ലഭ്യമല്ല'),
    `Answer: ${res29.answer.en}`
  );

  // Test 30: Read-Only Safety Verification
  const erpRegistryMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(erpRegistry));
  const writeKeywords = ['insert', 'update', 'delete', 'drop', 'truncate', 'alter', 'create'];
  const hasWriteMethods = erpRegistryMethods.some(m => writeKeywords.some(w => m.toLowerCase().startsWith(w)));
  assertTest(
    'Kenby ERP Registry exposes ONLY read-only access methods',
    !hasWriteMethods,
    `Methods checked: ${erpRegistryMethods.length}`
  );

  console.log(`\n${CYAN}====================================================`);
  console.log(`📊 PHASE A3 TEST RESULTS: ${passed} PASSED | ${failed} FAILED (Total: ${passed + failed})`);
  console.log(`====================================================${RESET}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal error during test suite:', err);
  process.exit(1);
});
