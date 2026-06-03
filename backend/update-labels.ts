import { db } from './src/database/db';
import { rawMaterials } from './src/database/schema';

async function updateLabels() {
  console.log('Updating label stickers to use PCS instead of KG...');
  try {
    const materials = await db.select().from(rawMaterials);
    let updatedCount = 0;
    for (const m of materials) {
      if (m.name.toLowerCase().includes('label sticker')) {
        await db.update(rawMaterials).set({ unit: 'PCS' }).where({ id: m.id } as any);
        console.log(`Updated ${m.name} to PCS`);
        updatedCount++;
      }
    }
    console.log(`Updated ${updatedCount} materials.`);
  } catch (err) {
    console.error('Failed:', err);
  }
  process.exit(0);
}

updateLabels();
