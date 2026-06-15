import { db } from './src/database';
import { inventoryStock, billOfMaterials, products, productionBatches, productionLogs } from './src/database/schema';
import { eq, inArray, between } from 'drizzle-orm';

async function main() {
  const stock = await db.select().from(inventoryStock);
  console.log("Stock Items:", stock.map(s => ({ name: s.itemName, sku: s.sku, type: s.materialType })));

  const bom = await db.select({
    product: products.name,
    item: inventoryStock.itemName,
    type: inventoryStock.materialType,
    qty: billOfMaterials.quantityPerUnit
  }).from(billOfMaterials)
    .innerJoin(products, eq(billOfMaterials.productId, products.id))
    .innerJoin(inventoryStock, eq(billOfMaterials.stockId, inventoryStock.id));
  
  console.log("BOM Mapping:", bom);
}

main().catch(console.error).finally(() => process.exit(0));
