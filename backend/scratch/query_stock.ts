import 'dotenv/config';
import { db } from '../src/database/db';
import { inventoryStock } from '../src/database/schema';

async function main() {
  const stock = await db.select().from(inventoryStock);
  console.log("Current inventory stock items in DB:");
  console.table(stock.map(s => ({
    id: s.id,
    itemName: s.itemName,
    sku: s.sku,
    quantity: s.quantity,
    factoryId: s.factoryId
  })));
  process.exit(0);
}

main().catch(console.error);
