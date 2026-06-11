import { db } from './src/database/db';

async function run() {
  try {
    await db.execute('ALTER TABLE production_logs RENAME COLUMN makeup_usage_ml TO makeup_usage_qty');
    await db.execute('ALTER TABLE production_logs ALTER COLUMN makeup_usage_qty TYPE integer USING makeup_usage_qty::integer');
    console.log('Done');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
