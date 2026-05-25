import 'dotenv/config';
import { db } from '../src/database/db';
import { productionLogs } from '../src/database/schema';

async function main() {
  const logs = await db.select().from(productionLogs).limit(10);
  console.log("Telemetry logs in DB (first 10):");
  console.table(logs.map(l => ({
    id: l.id,
    batchId: l.batchId,
    station: l.station,
    primaryCount: l.primaryCount,
    loggedAt: l.loggedAt,
    deletedAt: l.deletedAt
  })));
  process.exit(0);
}

main().catch(console.error);
