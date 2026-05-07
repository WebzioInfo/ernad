import { db } from './src/database/db';
import { 
  warehouseLocations, 
  materialCategories, 
  inventoryStock, 
  packagingConfigurations,
  products
} from './src/database/schema';
import { eq } from 'drizzle-orm';

async function seed() {
  try {
    const factoryId = '63342f66-77d0-4e5e-b66c-5e33ecdaa9f4';

    // 1. Warehouses
    console.log('Seeding warehouses...');
    const [rmStore] = await db.insert(warehouseLocations).values({
      factoryId,
      name: 'Raw Material Store',
      type: 'RAW_MATERIAL'
    }).returning();

    const [fgStore] = await db.insert(warehouseLocations).values({
      factoryId,
      name: 'Finished Goods Yard',
      type: 'FINISHED_GOODS'
    }).returning();

    // 2. Categories
    console.log('Seeding categories...');
    const [catPreforms] = await db.insert(materialCategories).values({ name: 'Preforms' }).returning();
    const [catCaps] = await db.insert(materialCategories).values({ name: 'Caps' }).returning();
    const [catLabels] = await db.insert(materialCategories).values({ name: 'Labels' }).returning();
    const [catShrink] = await db.insert(materialCategories).values({ name: 'Shrink Rolls' }).returning();

    // 3. Stock
    console.log('Seeding stock...');
    await db.insert(inventoryStock).values([
      {
        factoryId,
        warehouseId: rmStore.id,
        categoryId: catPreforms.id,
        itemName: 'Kenley 1L Preforms',
        sku: 'PRE-KEN-1L',
        unit: 'Pcs',
        quantity: '50000',
        minimumStock: '5000',
        valuationRate: '2.5'
      },
      {
        factoryId,
        warehouseId: rmStore.id,
        categoryId: catCaps.id,
        itemName: 'Standard Blue Caps',
        sku: 'CAP-BLUE-STD',
        unit: 'Pcs',
        quantity: '100000',
        minimumStock: '10000',
        valuationRate: '0.8'
      },
      {
        factoryId,
        warehouseId: rmStore.id,
        categoryId: catLabels.id,
        itemName: 'Kenley 1L BOPP labels',
        sku: 'LAB-KEN-1L',
        unit: 'Pcs',
        quantity: '25000',
        minimumStock: '2000',
        valuationRate: '1.2'
      }
    ]);

    // 4. Packaging Configurations
    console.log('Seeding packaging configurations...');
    const kenley1L = await db.select().from(products).where(eq(products.sku, 'KEN-1L')).limit(1);
    if (kenley1L.length) {
      await db.insert(packagingConfigurations).values([
        {
          productId: kenley1L[0].id,
          name: '12 Bottle Case',
          bottlesPerCase: 12,
          shrinkWeightPerCaseKg: '0.0150',
          cartonsPerCase: 1
        },
        {
          productId: kenley1L[0].id,
          name: '6 Bottle Pack',
          bottlesPerCase: 6,
          shrinkWeightPerCaseKg: '0.0080',
          cartonsPerCase: 0
        }
      ]);
    }

    console.log('✅ Inventory Seeding Complete!');
  } catch (err) {
    console.error('❌ Seeding Failed:', err);
  } finally {
    process.exit(0);
  }
}

seed();
