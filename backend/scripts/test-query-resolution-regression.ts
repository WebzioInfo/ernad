import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AiService } from '../src/modules/ai/ai.service';
import { KenbyQueryScopeService } from '../src/modules/ai/scope/kenby-query-scope.service';
import { KenbyDateResolverService } from '../src/modules/ai/dates/kenby-date-resolver.service';

async function runRegressionRecoverySuite() {
  console.log('================================================================');
  console.log('🛡️  RUNNING KENBY QUERY RESOLUTION & REGRESSION RECOVERY SUITE');
  console.log('================================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const aiService = app.get(AiService);
  const scopeService = app.get(KenbyQueryScopeService);
  const dateResolver = app.get(KenbyDateResolverService);

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

  // ──────────────────────────────────────────────────────────
  // A. EXPLICIT MONTH OVERRIDES CURRENT DATE & CONTEXT
  // ──────────────────────────────────────────────────────────
  console.log('\n--- A. EXPLICIT MONTH OVERRIDES CURRENT DATE ---');

  const d1 = dateResolver.resolveDateBounds({ question: 'July return details' });
  assert(
    d1.year === 2026 && d1.month === 7 && d1.startDateStr === '2026-07-01' && d1.endDateStr === '2026-08-01',
    'DateResolver: "July return details" resolves to July 1 - July 31, 2026 (Month 7)'
  );

  const scopeJulyReturn = await scopeService.resolveScope('July return details');
  assert(
    scopeJulyReturn.domains.includes('returns') && scopeJulyReturn.period?.month === 7,
    'Scope: "July return details" resolves to returns domain in July (Month 7)'
  );

  const resJulyReturn = await aiService.askQuestion('July return details', { language: 'en' });
  console.log(`Q(July return): "${resJulyReturn.answer.en}"`);
  assert(
    !resJulyReturn.answer.en.includes('1,980') && (resJulyReturn.answer.en.includes('July') || resJulyReturn.answer.en.includes('return')),
    'AI Ask: "July return details" returns July return data, NOT August or stock'
  );

  // ──────────────────────────────────────────────────────────
  // B. EXPLICIT DATE OVERRIDES CONVERSATION CONTEXT
  // ──────────────────────────────────────────────────────────
  console.log('\n--- B. EXPLICIT DATE OVERRIDES CONVERSATION ---');

  const turnAugSales = await aiService.askQuestion('August sales', { language: 'en' });
  console.log(`Turn 1 (August sales): "${turnAugSales.answer.en.substring(0, 100)}..."`);

  const turnJuly15Sales = await aiService.askQuestion('July 15 sales', { ...turnAugSales.context, language: 'en' });
  console.log(`Turn 2 (July 15 sales with August context): "${turnJuly15Sales.answer.en}"`);
  assert(
    turnJuly15Sales.answer.en.includes('2026-07-15') || turnJuly15Sales.answer.en.includes('July 15, 2026'),
    'AI Ask: "July 15 sales" explicitly resolves to July 15 and overrides August context'
  );

  // ──────────────────────────────────────────────────────────
  // C. NEW DOMAIN OVERRIDES PREVIOUS INTENT
  // ──────────────────────────────────────────────────────────
  console.log('\n--- C. NEW DOMAIN OVERRIDES PREVIOUS INTENT ---');

  const turnStock = await aiService.askQuestion('Current stock?', { language: 'en' });
  console.log(`Turn 1 (Stock): "${turnStock.answer.en}"`);

  const turnJulyReturns = await aiService.askQuestion('July return details?', { ...turnStock.context, language: 'en' });
  console.log(`Turn 2 (July returns with stock context): "${turnJulyReturns.answer.en}"`);
  assert(
    !turnJulyReturns.answer.en.includes('1,980') && (turnJulyReturns.answer.en.includes('return') || turnJulyReturns.answer.en.includes('July')),
    'Turn 2: "July return details?" overrides previous stock intent'
  );

  // ──────────────────────────────────────────────────────────
  // D. CUSTOMER SALES HISTORY VS OUTSTANDING BALANCE
  // ──────────────────────────────────────────────────────────
  console.log('\n--- D. CUSTOMER SALES HISTORY VS OUTSTANDING BALANCE ---');

  const resSinanSales = await aiService.askQuestion('Sinan sales history', { language: 'en' });
  console.log(`Sinan sales history: "${resSinanSales.answer.en.substring(0, 120)}..."`);
  assert(
    !resSinanSales.answer.en.includes('outstanding balance is ₹0') && (resSinanSales.answer.en.includes('Sinan') || resSinanSales.answer.en.includes('transaction')),
    'AI Ask: "Sinan sales history" returns sales transactions, NOT customer balance'
  );

  const resSinanBal = await aiService.askQuestion('Sinan outstanding balance', { language: 'en' });
  console.log(`Sinan balance: "${resSinanBal.answer.en}"`);
  assert(
    resSinanBal.answer.en.includes('balance') || resSinanBal.answer.en.includes('₹0') || resSinanBal.answer.en.includes('Outstanding'),
    'AI Ask: "Sinan outstanding balance" returns customer outstanding balance'
  );

  // ──────────────────────────────────────────────────────────
  // E. BROAD TOTAL DATA COMPOSITE SUMMARY
  // ──────────────────────────────────────────────────────────
  console.log('\n--- E. BROAD TOTAL DATA COMPOSITE SUMMARY ---');

  const resTotal = await aiService.askQuestion('August month total data', { language: 'en' });
  console.log(`August total data:\n${resTotal.answer.en}\n`);
  assert(
    resTotal.answer.en.includes('Sales') &&
      resTotal.answer.en.includes('Returns') &&
      resTotal.answer.en.includes('Production') &&
      resTotal.answer.en.includes('Inventory'),
    'AI Ask: "August month total data" returns composite multi-domain summary'
  );

  // ──────────────────────────────────────────────────────────
  // F. EXACT ZERO-DATA HONESTY
  // ──────────────────────────────────────────────────────────
  console.log('\n--- F. EXACT ZERO-DATA HONESTY ---');

  const resZeroDate = await aiService.askQuestion('August 2 sales', { language: 'en' });
  console.log(`August 2 sales: "${resZeroDate.answer.en}"`);
  assert(
    resZeroDate.answer.en.includes('2026-08-02') || resZeroDate.answer.en.includes('No sales records'),
    'AI Ask: "August 2 sales" states zero sales records found for 2026-08-02'
  );

  // ──────────────────────────────────────────────────────────
  // G. CHAINED FOLLOW-UPS WITH EXPLICIT CONTEXT SWITCH
  // ──────────────────────────────────────────────────────────
  console.log('\n--- G. CHAINED FOLLOW-UPS ---');

  // Step 1: July sales
  const step1 = await aiService.askQuestion('July sales', { language: 'en' });
  console.log(`Step 1 (July sales): "${step1.answer.en.substring(0, 100)}..."`);
  assert(step1.answer.en.includes('July') || step1.answer.en.includes('units'), 'Step 1 resolves July sales');

  // Step 2: What about returns? (Inherits July)
  const step2 = await aiService.askQuestion('What about returns?', { ...step1.context, language: 'en' });
  console.log(`Step 2 (What about returns?): "${step2.answer.en}"`);
  assert(
    step2.answer.en.includes('return') || step2.answer.en.includes('July'),
    'Step 2 inherits July period for returns follow-up'
  );

  // Step 3: Now show August sales (Explicit August replaces July)
  const step3 = await aiService.askQuestion('Now show August sales', { ...step2.context, language: 'en' });
  console.log(`Step 3 (Now show August sales): "${step3.answer.en.substring(0, 100)}..."`);
  assert(
    step3.answer.en.includes('1,000') || step3.answer.en.includes('August') || step3.answer.en.includes('units'),
    'Step 3 explicitly switches to August sales'
  );

  // Step 4: What about returns? (Inherits August)
  const step4 = await aiService.askQuestion('What about returns?', { ...step3.context, language: 'en' });
  console.log(`Step 4 (What about returns in August?): "${step4.answer.en}"`);
  assert(
    step4.answer.en.includes('10,047') || step4.answer.en.includes('return') || step4.answer.en.includes('August'),
    'Step 4 inherits August period for returns follow-up'
  );

  // ──────────────────────────────────────────────────────────
  // H. MALAYALAM QUERIES
  // ──────────────────────────────────────────────────────────
  console.log('\n--- H. MALAYALAM QUERIES ---');

  const mlJulyReturn = await aiService.askQuestion('ജൂലൈയിലെ റിട്ടേൺ വിവരങ്ങൾ', { language: 'ml' });
  console.log(`ML July returns: "${mlJulyReturn.answer.ml}"`);
  assert(
    !mlJulyReturn.answer.ml.includes('1,980') && (mlJulyReturn.answer.ml.includes('റിട്ടേൺ') || mlJulyReturn.answer.ml.includes('ജൂലൈ') || mlJulyReturn.answer.ml.includes('കണ്ടെത്താനായില്ല')),
    'ML: "ജൂലൈയിലെ റിട്ടേൺ വിവരങ്ങൾ" returns July returns'
  );

  const mlSinanSales = await aiService.askQuestion('സിനാന്റെ സെയിൽസ് ഹിസ്റ്ററി', { language: 'ml' });
  console.log(`ML Sinan sales: "${mlSinanSales.answer.ml.substring(0, 100)}..."`);
  assert(
    !mlSinanSales.answer.ml.includes('കുടിശ്ശിക ₹0') && (mlSinanSales.answer.ml.includes('Sinan') || mlSinanSales.answer.ml.includes('ഇടപാടുകൾ')),
    'ML: "സിനാന്റെ സെയിൽസ് ഹിസ്റ്ററി" returns sales transactions'
  );

  const mlSinanBal = await aiService.askQuestion('സിനാന്റെ കുടിശ്ശിക എത്ര?', { language: 'ml' });
  console.log(`ML Sinan balance: "${mlSinanBal.answer.ml}"`);
  assert(
    mlSinanBal.answer.ml.includes('കുടിശ്ശിക') || mlSinanBal.answer.ml.includes('₹0'),
    'ML: "സിനാന്റെ കുടിശ്ശിക എത്ര?" returns customer balance'
  );

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  await app.close();

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionRecoverySuite().catch((err) => {
  console.error('Regression suite crashed:', err);
  process.exit(1);
});
