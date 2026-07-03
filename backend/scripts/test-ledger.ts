import { db } from '../src/database/db';
import { InventoryService } from '../src/modules/inventory/inventory.service';

async function test() {
  const svc = new InventoryService(undefined as any, undefined as any);
  const ledger = await svc.getProductLedger('c9bcc4eb-5445-4974-8820-da5a801ef12e');
  console.log(JSON.stringify(ledger, null, 2));
  process.exit(0);
}
test().catch(console.error);
