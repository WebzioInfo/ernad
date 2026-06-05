import { db } from '../src/database/db';
import { billOfMaterials, inventoryStock, rawMaterials } from '../src/database/schema';

async function test() {
  const boms = await db.select().from(billOfMaterials).limit(5);
  console.log("BOMs:", boms);

  const stock = await db.select().from(inventoryStock).limit(5);
  console.log("Stock:", stock);

  const raws = await db.select().from(rawMaterials).limit(5);
  console.log("Raw Mats:", raws);

  process.exit(0);
}

test().catch(console.error);
