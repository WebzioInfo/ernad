import { db } from '../src/database/db';
import * as schema from '../src/database/schema';
import { eq, ilike } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function updateUnitsPerCase() {
  const products = await db.select().from(schema.products).where(ilike(schema.products.name, '%300ML%'));
  if (!products.length) return console.log('Product not found');

  const product = products[0];
  console.log(`Updating ${product.name} unitsPerCase from ${product.unitsPerCase} to 35...`);

  await db.update(schema.products)
    .set({ unitsPerCase: 35 })
    .where(eq(schema.products.id, product.id));

  console.log('Update complete.');
}

updateUnitsPerCase().catch(console.error).then(() => process.exit(0));
