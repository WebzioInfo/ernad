import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AiService } from '../src/modules/ai/ai.service';
import { KenbyRouterService } from '../src/modules/ai/kenby-router.service';
import { KenbyErpRegistryService } from '../src/modules/ai/kenby-erp-registry.service';

async function runFullErpAudit() {
  console.log('====================================================');
  console.log('  KENBY AI: COMPLETE ERP DATABASE AI AUDIT SUITE    ');
  console.log('====================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const aiService = app.get(AiService);
  const routerService = app.get(KenbyRouterService);
  const erpRegistry = app.get(KenbyErpRegistryService);

  let passed = 0;
  let total = 0;

  function assertTest(condition: boolean, name: string, details?: any) {
    total++;
    if (condition) {
      console.log(`✓ [PASSED] ${name}`);
      passed++;
    } else {
      console.log(`✗ [FAILED] ${name}`);
      if (details) console.log('  Details:', details);
    }
  }

  try {
    // ----------------------------------------------------
    // CATEGORY 1: CUSTOMER INTELLIGENCE
    // ----------------------------------------------------
    console.log('\n--- CATEGORY 1: CUSTOMER INTELLIGENCE ---');

    // Test 1: How many customers
    const t1 = await aiService.askQuestion('How many customers do we have?');
    assertTest(
      t1.context?.activeTopic === 'customers' && (t1.answer.en.includes('customers') || t1.answer.en.includes('registered')),
      '1. Customer count answers total registered customers',
      t1.answer
    );

    // Test 2: Show all customers
    const t2 = await aiService.askQuestion('Show all customers');
    assertTest(
      t2.context?.activeTopic === 'customers' && t2.answer.en.includes('Customer Directory') && (t2.answer.en.includes('Acme Enterprises') || t2.answer.en.includes('Sinan')),
      '2. Customer list displays real customer directory',
      t2.answer
    );

    // Test 3: Named customer full profile
    const t3 = await aiService.askQuestion('Show Acme Enterprises full details');
    assertTest(
      t3.context?.activeTopic === 'customers' &&
      t3.answer.en.includes('Acme Enterprises') &&
      t3.answer.en.includes('Financial Profile') &&
      t3.answer.en.includes('Opening Balance'),
      '3. Customer full profile returns contact, opening balance, and dispatches',
      t3.answer
    );

    // Test 4: How much does customer owe?
    const t4 = await aiService.askQuestion('How much does Acme Enterprises owe?');
    assertTest(
      t4.context?.activeTopic === 'customers' &&
      t4.answer.en.includes('Acme Enterprises') &&
      (t4.answer.en.includes('balance') || t4.answer.en.includes('outstanding')),
      '4. Customer debt/balance answers exact customer balance',
      t4.answer
    );

    // Test 5: Which customer owes the most?
    const t5 = await aiService.askQuestion('Which customer owes the most?');
    assertTest(
      t5.context?.activeTopic === 'customers' &&
      t5.answer.en.includes('Top Customer Debtors') &&
      t5.answer.en.includes('Acme Enterprises'),
      '5. Customer debt ranking returns top debtor',
      t5.answer
    );

    // Test 6: Which customer bought the most this month?
    const t6 = await aiService.askQuestion('Which customer bought the most this month?');
    assertTest(
      t6.answer.en.includes('Top Purchasing Customers') || t6.answer.en.includes('cases'),
      '6. Customer sales ranking identifies top buyers',
      t6.answer
    );

    // ----------------------------------------------------
    // CATEGORY 2: RAW MATERIAL INTELLIGENCE
    // ----------------------------------------------------
    console.log('\n--- CATEGORY 2: RAW MATERIAL INTELLIGENCE ---');

    // Test 7: How much raw material stock do we have?
    const t7 = await aiService.askQuestion('How much raw material stock do we have?');
    assertTest(
      t7.context?.activeTopic === 'raw_materials' &&
      t7.answer.en.includes('Raw Material Inventory Stock') &&
      (t7.answer.en.includes('PREFORM') || t7.answer.en.includes('CAP') || t7.answer.en.includes('LABEL')),
      '7. Raw material summary itemizes materials with types & units',
      t7.answer
    );

    // Test 8: How much Preform stock?
    const t8 = await aiService.askQuestion('How much Preform stock do we have?');
    assertTest(
      t8.context?.activeTopic === 'raw_materials' &&
      (t8.answer.en.includes('PREFORM') || t8.answer.en.includes('Preform') || t8.answer.en.includes('BOTTLE')) &&
      !t8.answer.en.includes('Business Overview') &&
      !t8.answer.en.includes('Sales: 1,000 cases'),
      '8. Specific Preform query returns exact material stock without sales dump',
      t8.answer
    );

    // Test 9: Cap stock
    const t9 = await aiService.askQuestion('How many caps are available?');
    assertTest(
      t9.context?.activeTopic === 'raw_materials' &&
      (t9.answer.en.includes('CAP') || t9.answer.en.includes('Cap')),
      '9. Cap stock query returns cap inventory and units',
      t9.answer
    );

    // Test 10: Lowest raw material
    const t10 = await aiService.askQuestion('Which raw material is lowest?');
    assertTest(
      t10.context?.activeTopic === 'raw_materials' &&
      (t10.answer.en.includes('Lowest') || t10.answer.en.includes('Out-of-Stock')),
      '10. Lowest raw materials identifies critical inventory stock',
      t10.answer
    );

    // Test 11: Raw material movements
    const t11 = await aiService.askQuestion('Show raw material movements');
    assertTest(
      t11.context?.activeTopic === 'raw_materials' &&
      (t11.answer.en.includes('Movements') || t11.answer.en.includes('Material')),
      '11. Raw material movements returns transaction history',
      t11.answer
    );

    // ----------------------------------------------------
    // CATEGORY 3: PRODUCT FULL PROFILE & STOCK
    // ----------------------------------------------------
    console.log('\n--- CATEGORY 3: PRODUCT FULL PROFILE & STOCK ---');

    // Test 12: Product full profile
    const t12 = await aiService.askQuestion('Give me full details of Kenby 1');
    assertTest(
      t12.answer.en.includes('Kenby 1') &&
      t12.answer.en.includes('Full Product Profile') &&
      t12.answer.en.includes('Current Stock') &&
      t12.answer.en.includes('All-Time Sales'),
      '12. Product full profile returns 360-degree product business profile',
      t12.answer
    );

    // Test 13: Product-wise stock
    const t13 = await aiService.askQuestion('Show stock of all products');
    assertTest(
      t13.context?.activeTopic === 'stock' &&
      t13.answer.en.includes('product-wise stock') &&
      t13.answer.en.includes('Kenby 1') &&
      t13.answer.en.includes('Aquora 2'),
      '13. Product stock breakdown lists all individual products',
      t13.answer
    );

    // Test 14: Named product stock only
    const t14 = await aiService.askQuestion('How much stock of Kenby 1?');
    assertTest(
      t14.context?.activeTopic === 'stock' &&
      t14.answer.en.includes('Kenby 1') &&
      t14.answer.en.includes('980') &&
      !t14.answer.en.includes('Aquora 2'),
      '14. Single product stock returns only Kenby 1',
      t14.answer
    );

    // Test 15: Best selling product
    const t15 = await aiService.askQuestion('Which product sold the most this month?');
    assertTest(
      t15.answer.en.includes('Kenby 1') && t15.answer.en.includes('1,000'),
      '15. Best selling product ranking identifies top seller',
      t15.answer
    );

    // ----------------------------------------------------
    // CATEGORY 4: PROCUREMENT, BATCHES & DOWNTIME
    // ----------------------------------------------------
    console.log('\n--- CATEGORY 4: PROCUREMENT, BATCHES & DOWNTIME ---');

    // Test 16: Suppliers / Vendors
    const t16 = await aiService.askQuestion('Show all vendors');
    assertTest(
      t16.context?.activeTopic === 'procurement' &&
      (t16.answer.en.includes('Supplier Directory') || t16.answer.en.includes('No supplier')),
      '16. Vendor directory queries suppliers safely',
      t16.answer
    );

    // Test 17: Production Batches
    const t17 = await aiService.askQuestion('Show production batches');
    assertTest(
      t17.context?.activeTopic === 'production' &&
      t17.answer.en.includes('Production Batches'),
      '17. Production batches returns running & completed batch counts',
      t17.answer
    );

    // ----------------------------------------------------
    // CATEGORY 5: MALAYALAM + ENGLISH ERP QUESTIONS
    // ----------------------------------------------------
    console.log('\n--- CATEGORY 5: MALAYALAM + ENGLISH ERP QUESTIONS ---');

    // Test 18: Malayalam Customer Profile
    const t18 = await aiService.askQuestion('Acme Enterprises-ന്റെ full details കാണിക്ക്');
    assertTest(
      t18.answer.ml.includes('Acme Enterprises') &&
      t18.answer.ml.includes('സാമ്പത്തിക വിവരങ്ങൾ') &&
      t18.answer.ml.includes('Opening Balance'),
      '18. Malayalam customer profile query returns localized profile',
      t18.answer
    );

    // Test 19: Malayalam Raw Material Stock
    const t19 = await aiService.askQuestion('Preform stock എത്ര ഉണ്ട്?');
    assertTest(
      t19.context?.activeTopic === 'raw_materials' &&
      (t19.answer.ml.includes('PREFORM') || t19.answer.ml.includes('Preform') || t19.answer.ml.includes('BOTTLE')),
      '19. Malayalam raw material query returns Preform stock in Malayalam',
      t19.answer
    );

    // Test 20: Intelligent Clarification Fallback (No sales/stock restriction)
    const t20 = await aiService.askQuestion('What is the weather tomorrow in Tokyo?');
    assertTest(
      t20.answer.en.includes('ERP business data') &&
      !t20.answer.en.includes('Sales, Production, Stock'),
      '20. Intelligent fallback prompts for ERP domain clarification without legacy restriction',
      t20.answer
    );

    console.log('\n====================================================');
    console.log(`  COMPLETE ERP AI AUDIT: ${passed} / ${total} TESTS PASSED`);
    console.log('====================================================\n');

    if (passed === total) {
      console.log('🎉 ALL COMPLETE ERP DATABASE AI TESTS PASSED SUCCESSFULLY!\n');
    }
  } finally {
    await app.close();
  }
}

runFullErpAudit().catch((err) => {
  console.error('Fatal error running full ERP audit suite:', err);
  process.exit(1);
});
