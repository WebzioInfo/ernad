import 'dotenv/config';
import { get_sales_summary } from '../src/modules/ai/kenby-live-data.service';

async function runTests() {
  console.log('====================================================');
  console.log('      KENBY LIVE DATA TOOL: get_sales_summary()     ');
  console.log('====================================================\n');

  try {
    // Test 1: specific_date ("2026-07-12")
    console.log('--- TEST 1: specific_date (2026-07-12) ---');
    const res1 = await get_sales_summary({
      period: 'specific_date',
      date: '2026-07-12',
    });
    console.log(JSON.stringify(res1, null, 2));
    console.log('\n');

    // Test 2: specific_month (year: 2026, month: 7)
    console.log('--- TEST 2: specific_month (2026-07) ---');
    const res2 = await get_sales_summary({
      period: 'specific_month',
      year: 2026,
      month: 7,
    });
    console.log(JSON.stringify(res2, null, 2));
    console.log('\n');

    // Test 3: this_month
    console.log('--- TEST 3: this_month ---');
    const res3 = await get_sales_summary({
      period: 'this_month',
    });
    console.log(JSON.stringify(res3, null, 2));
    console.log('\n');

    console.log('====================================================');
    console.log('  ALL get_sales_summary() TESTS COMPLETED SUCCESSFULLY');
    console.log('====================================================');
    process.exit(0);
  } catch (error: any) {
    console.error('TEST ERROR:', error);
    process.exit(1);
  }
}

runTests();
