import { db } from './src/database/db';
import { rawMaterials } from './src/database/schema/inventory';
import { eq, like } from 'drizzle-orm';

async function fix() {
  await db.update(rawMaterials).set({ materialType: 'CAP' }).where(like(rawMaterials.name, 'Cap%'));
  await db.update(rawMaterials).set({ materialType: 'PREFORM' }).where(like(rawMaterials.name, 'Preform%'));
  await db.update(rawMaterials).set({ materialType: 'LABEL' }).where(like(rawMaterials.name, 'Label%'));
  await db.update(rawMaterials).set({ materialType: 'SHRINK' }).where(like(rawMaterials.name, 'Shrink%'));
  console.log('Fixed material types based on names!');
}

fix().catch(console.error).finally(() => process.exit(0));
