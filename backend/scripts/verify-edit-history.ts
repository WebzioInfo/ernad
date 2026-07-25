import { db } from '../src/database/db';
import { recordEditHistory } from '../src/database/schema/history';
import { desc } from 'drizzle-orm';

async function main() {
  console.log('Testing record_edit_history database table...');

  try {
    // 1. Insert test record
    const [inserted] = await db.insert(recordEditHistory).values({
      module: 'Customers',
      tableName: 'customers',
      recordId: 'TEST-REC-001',
      fieldName: 'phone',
      oldValue: '9999999999',
      newValue: '8888888888',
      editedByName: 'Verification Script',
      editedByRole: 'ADMIN',
      reason: 'Automated verification check',
    }).returning();

    console.log('✅ Successfully inserted test record into record_edit_history:', inserted);

    // 2. Query record_edit_history
    const records = await db.select().from(recordEditHistory).orderBy(desc(recordEditHistory.editedAt)).limit(5);
    console.log(`✅ Successfully queried record_edit_history (${records.length} records returned):`);
    console.log(JSON.stringify(records, null, 2));

    process.exit(0);
  } catch (err: any) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  }
}

main();
