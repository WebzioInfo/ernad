import 'dotenv/config';
import { db } from '../src/database/db';
import { billOfMaterials } from '../src/database/schema';

async function main() {
  const bom = await db.select().from(billOfMaterials);
  console.log("Current BOM mappings in DB:");
  console.table(bom);
  process.exit(0);
}

main().catch(console.error);
