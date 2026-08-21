import { KenbyEntityResolverService } from '../src/modules/ai/kenby-entity-resolver.service';
import { KenbyCapabilityResolverService } from '../src/modules/ai/kenby-capability-resolver.service';
import { KenbyRouterService } from '../src/modules/ai/kenby-router.service';

async function runPhaseA2Tests() {
  console.log('====================================================');
  console.log('🧪 KENBY PHASE A2: ENTITY & CAPABILITY ENGINE TEST SUITE');
  console.log('====================================================\n');

  const entityResolver = new KenbyEntityResolverService();
  const capabilityResolver = new KenbyCapabilityResolverService();
  const router = new KenbyRouterService(entityResolver, capabilityResolver);

  let passed = 0;
  let failed = 0;

  function assertTest(name: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name} — ${details || 'Assertion failed'}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // 1. ENTITY RESOLVER TESTS
  // ----------------------------------------------------
  console.log('\n--- 1. ENTITY RESOLVER TESTS ---');

  // Test Raw Material Entity Match
  const rawMatRes = await entityResolver.resolveEntity('Cap');
  assertTest(
    'Resolve Raw Material (Cap)',
    rawMatRes.matchStatus === 'exact' || rawMatRes.matchStatus === 'partial',
    `Result: ${JSON.stringify(rawMatRes)}`
  );

  // Test Product Entity Match
  const prodRes = await entityResolver.resolveEntity('Kenby 1');
  assertTest(
    'Resolve Product (Kenby 1)',
    prodRes.matchStatus === 'exact' || prodRes.matchStatus === 'partial',
    `Result: ${JSON.stringify(prodRes)}`
  );

  // Test Unknown Entity
  const unknownRes = await entityResolver.resolveEntity('xyz-nonexistent-entity-9999');
  assertTest(
    'Resolve Unknown Entity (Returns none)',
    unknownRes.matchStatus === 'none' && unknownRes.entity === null,
    `Result: ${JSON.stringify(unknownRes)}`
  );

  // ----------------------------------------------------
  // 2. NO SALES BIAS ROUTING TESTS
  // ----------------------------------------------------
  console.log('\n--- 2. NO SALES BIAS ROUTING TESTS ---');

  // Question 1: Raw Material Stock (Must NOT route to sales or finished goods)
  const q1Intent = await router.routeQuestion('How much Green Cap stock do we have?');
  assertTest(
    'Raw Material Stock: "How much Green Cap stock do we have?" -> raw_material_item',
    q1Intent.type === 'raw_material_item',
    `Got intent: ${q1Intent.type}`
  );

  // Question 2: Malayalam Raw Material Stock
  const q2Intent = await router.routeQuestion('ക്യാപ് സ്റ്റോക്ക് എത്രയുണ്ട്?');
  assertTest(
    'Malayalam Cap Stock: "ക്യാപ് സ്റ്റോക്ക് എത്രയുണ്ട്?" -> raw_material_item',
    q2Intent.type === 'raw_material_item',
    `Got intent: ${q2Intent.type}`
  );

  // Question 3: Customer Details (Must NOT route to sales)
  const q3Intent = await router.routeQuestion('Show profile of ABC Traders');
  assertTest(
    'Customer Profile: "Show profile of ABC Traders" -> customer_profile',
    q3Intent.type === 'customer_profile',
    `Got intent: ${q3Intent.type}`
  );

  // Question 4: Vendor List (Must NOT route to sales)
  const q4Intent = await router.routeQuestion('List our suppliers');
  assertTest(
    'Vendor List: "List our suppliers" -> vendor_list',
    q4Intent.type === 'vendor_list',
    `Got intent: ${q4Intent.type}`
  );

  // Question 5: Named Product Stock (Must route to named stock, not all products)
  const q5Intent = await router.routeQuestion('What is the stock of 20L Jar?');
  assertTest(
    'Named Product Stock: "What is the stock of 20L Jar?" -> product_stock_named',
    q5Intent.type === 'product_stock_named',
    `Got intent: ${q5Intent.type}`
  );

  // ----------------------------------------------------
  // 3. PRONOUN & CONVERSATION CONTEXT TESTS
  // ----------------------------------------------------
  console.log('\n--- 3. PRONOUN & CONVERSATION CONTEXT TESTS ---');

  // Follow-up on Customer using Pronoun
  const customerContext = {
    activeTopic: 'customers' as const,
    customer: 'ABC Traders',
    lastEntity: {
      type: 'customer' as const,
      id: 'cust-123',
      name: 'ABC Traders',
    },
    language: 'ml' as const,
  };

  const pronounPaymentIntent = await router.routeQuestion('അതിന്റെ payment എത്ര?', customerContext);
  assertTest(
    'Pronoun Customer Payment: "അതിന്റെ payment എത്ര?" -> customer_payments',
    pronounPaymentIntent.type === 'customer_payments',
    `Got intent: ${pronounPaymentIntent.type}`
  );

  const pronounLedgerIntent = await router.routeQuestion('Show their ledger statement', customerContext);
  assertTest(
    'Pronoun Customer Ledger: "Show their ledger statement" -> customer_ledger',
    pronounLedgerIntent.type === 'customer_ledger',
    `Got intent: ${pronounLedgerIntent.type}`
  );

  // Follow-up on Raw Material using Pronoun
  const rawMatContext = {
    activeTopic: 'raw_materials' as const,
    rawMaterial: 'CAP',
    lastEntity: {
      type: 'raw_material' as const,
      id: 'mat-123',
      name: 'CAP',
    },
    language: 'ml' as const,
  };

  const pronounMaterialIntent = await router.routeQuestion('അതിന്റെ movements കാണിക്കൂ', rawMatContext);
  assertTest(
    'Pronoun Material Movements: "അതിന്റെ movements കാണിക്കൂ" -> raw_material_movements',
    pronounMaterialIntent.type === 'raw_material_movements',
    `Got intent: ${pronounMaterialIntent.type}`
  );

  // Explicit new entity overrides old entity
  const overrideIntent = await router.routeQuestion('20L Jar full details', customerContext);
  assertTest(
    'Explicit new entity overrides previous customer context -> product_profile',
    overrideIntent.type === 'product_profile',
    `Got intent: ${overrideIntent.type}`
  );

  // ----------------------------------------------------
  // 4. CAPABILITY SELECTION TESTS
  // ----------------------------------------------------
  console.log('\n--- 4. CAPABILITY SELECTION TESTS ---');

  const bomIntent = await router.routeQuestion('What is the BOM for 1L Bottle?');
  assertTest(
    'Product BOM capability: "What is the BOM for 1L Bottle?" -> product_bom',
    bomIntent.type === 'product_bom',
    `Got intent: ${bomIntent.type}`
  );

  const activeBatchIntent = await router.routeQuestion('Show active production batches');
  assertTest(
    'Production batches capability: "Show active production batches" -> production_batches',
    activeBatchIntent.type === 'production_batches',
    `Got intent: ${activeBatchIntent.type}`
  );

  const topDebtorIntent = await router.routeQuestion('Who owes the most balance?');
  assertTest(
    'Customer debtors capability: "Who owes the most balance?" -> customer_ranking_debt',
    topDebtorIntent.type === 'customer_ranking_debt',
    `Got intent: ${topDebtorIntent.type}`
  );

  // ----------------------------------------------------
  // 5. SAFETY & GUARDRAILS
  // ----------------------------------------------------
  console.log('\n--- 5. SAFETY & GUARDRAILS ---');

  const payrollCap = capabilityResolver.resolveCapability('Show payroll expenses', null);
  assertTest(
    'Unsupported Accounting/Payroll Rejected Cleanly',
    payrollCap.status === 'unsupported',
    `Status: ${payrollCap.status}`
  );

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED | ${failed} FAILED (Total: ${passed + failed})`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhaseA2Tests().catch((err) => {
  console.error('Error running tests:', err);
  process.exit(1);
});
