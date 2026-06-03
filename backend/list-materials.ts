import { db } from './src/database/db';
import { rawMaterials } from './src/database/schema';

async function listMaterials() {
  try {
    const materials = await db.select().from(rawMaterials);
    console.log(materials.map(m => ({ id: m.id, name: m.name, unit: m.unit })));
  } catch (err) {
    console.error('Failed:', err);
  }
  process.exit(0);
}

listMaterials();
