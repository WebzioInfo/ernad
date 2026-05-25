import 'dotenv/config';
import { db } from '../src/database/db';
import {
  productionLines, productBrands, products,
  inventoryStock, billOfMaterials, productionBatches
} from '../src/database/schema';
import { eq, and, sql } from 'drizzle-orm';

function matchesMaterialType(stockItemName: string, itemType: string): boolean {
  const sin = stockItemName.toLowerCase();
  const it = itemType.toLowerCase();
  if (it.includes('preform') || it.includes('blowing')) {
    return sin.includes('preform');
  }
  if (it.includes('cap') || it.includes('filling')) {
    return sin.includes('cap');
  }
  if (it.includes('label') || it.includes('sticker') || it.includes('bopp') || it.includes('labeling')) {
    return sin.includes('label') || sin.includes('sticker') || sin.includes('bopp');
  }
  if (it.includes('shrink') || it.includes('film') || it.includes('roll') || it.includes('packing')) {
    return sin.includes('shrink') || sin.includes('film') || sin.includes('roll') || sin.includes('wrap');
  }
  if (it.includes('ink')) {
    return sin.includes('ink');
  }
  if (it.includes('solvent') || it.includes('makeup')) {
    return sin.includes('solvent') || sin.includes('makeup') || sin.includes('make-up');
  }
  return false;
}

async function resolveStock(tx: any, factoryId: string, item: { name: string; category: string }, dto: { selectedStockId?: string; productId?: string }, activeBatchProductId?: string) {
  let stock;

  // Priority 1: BOM Auto-consumption (already resolved to exact stock ID in item.name)
  if (item.category === 'BOM_AUTO') {
    const results = await tx.select().from(inventoryStock)
      .where(eq(inventoryStock.id, item.name));
    stock = results[0];
  }

  // Priority 2: Explicitly passed selectedStockId (if it matches item type)
  if (!stock && dto.selectedStockId) {
    const results = await tx.select().from(inventoryStock)
      .where(eq(inventoryStock.id, dto.selectedStockId));
    const candidate = results[0];
    if (candidate && matchesMaterialType(candidate.itemName, item.name)) {
      stock = candidate;
    }
  }

  // Priority 3: Active Product BOM mapping lookup
  if (!stock) {
    const activeProductId = dto.productId || activeBatchProductId;
    if (activeProductId) {
      const bomStocks = await tx.select({
        stock: inventoryStock
      })
      .from(billOfMaterials)
      .innerJoin(inventoryStock, eq(billOfMaterials.stockId, inventoryStock.id))
      .where(and(
        eq(billOfMaterials.productId, activeProductId),
        eq(inventoryStock.factoryId, factoryId)
      ));

      for (const row of bomStocks) {
        if (matchesMaterialType(row.stock.itemName, item.name)) {
          stock = row.stock;
          break;
        }
      }
    }
  }

  // Priority 4: Exact Name Match
  if (!stock) {
    const stockItems = await tx.select()
      .from(inventoryStock)
      .where(and(
        eq(inventoryStock.factoryId, factoryId),
        eq(inventoryStock.itemName, item.name)
      ));
    if (stockItems.length > 0) {
      stock = stockItems[0];
    }
  }

  // Priority 5: Fuzzy ILIKE Match
  if (!stock) {
    let searchPattern = '';
    const it = item.name.toLowerCase();
    if (it.includes('preform')) searchPattern = '%preform%';
    else if (it.includes('cap')) searchPattern = '%cap%';
    else if (it.includes('label') || it.includes('sticker') || it.includes('bopp')) searchPattern = '%label%';
    else if (it.includes('shrink') || it.includes('film') || it.includes('roll')) searchPattern = '%shrink%';
    else if (it.includes('ink')) searchPattern = '%ink%';
    else if (it.includes('solvent') || it.includes('makeup')) searchPattern = '%solvent%';

    if (searchPattern) {
      const fuzzyStocks = await tx.select()
        .from(inventoryStock)
        .where(and(
          eq(inventoryStock.factoryId, factoryId),
          sql`lower(${inventoryStock.itemName}) LIKE ${searchPattern}`
        ));

      if (fuzzyStocks.length > 0) {
        stock = fuzzyStocks.find((s: any) => Number(s.quantity) > 0) || fuzzyStocks[0];
      }
    }
  }

  return stock;
}

async function validateStartBatch(tx: any, productId: string, factoryId: string) {
  const bomItems = await tx.select()
    .from(billOfMaterials)
    .where(eq(billOfMaterials.productId, productId));

  if (bomItems.length > 0) {
    for (const bom of bomItems) {
      const [stock] = await tx.select()
        .from(inventoryStock)
        .where(and(
          eq(inventoryStock.id, bom.stockId),
          eq(inventoryStock.factoryId, factoryId)
        ))
        .limit(1);

      if (!stock) {
        throw new Error(`Cannot start production. Mapped stock item (ID: ${bom.stockId}) not found in the factory.`);
      }
      if (Number(stock.quantity) <= 0) {
        throw new Error(`Cannot start production. Insufficient stock for BOM item: ${stock.itemName} (Available: ${stock.quantity} ${stock.unit}). Please assign or update stock in Operator Panel.`);
      }
    }
  }
}

async function main() {
  console.log("=== RUNNING DATABASE TESTS FOR STOCK FLOW FIXES ===");

  await db.transaction(async (tx) => {
    // 1. Fetch factoryId from existing inventory stock
    const [existingStockItem] = await tx.select().from(inventoryStock).limit(1);
    if (!existingStockItem) {
      console.log("No inventory stock records exist in DB. Test cannot proceed.");
      return;
    }
    const factoryId = existingStockItem.factoryId;
    console.log(`Factory ID: ${factoryId}`);

    // --- TEST RESOLUTION CASCADE ---
    console.log("\n--- Testing Stock Resolution Cascade ---");
    
    // Scenario A: General material category 'Preforms' (no selectedStockId, no productId)
    // Should fuzzy match to 'Kenley 1L Preforms'
    const resolvedPreforms = await resolveStock(tx, factoryId, { name: 'Preforms', category: 'Preforms' }, {}, undefined);
    console.log(`Fuzzy matching 'Preforms' resolved: ${resolvedPreforms?.itemName} (ID: ${resolvedPreforms?.id})`);
    if (resolvedPreforms?.itemName === 'Kenley 1L Preforms') {
      console.log("✓ Success: Fuzzy matched 'Preforms' to 'Kenley 1L Preforms'");
    } else {
      console.log("❌ Failed: Preforms did not fuzzy match to 'Kenley 1L Preforms'");
    }

    // Scenario B: Selected Stock ID explicitly provided
    const dummyStockId = 'c208c71e-b934-46c2-b818-a925371c1435'; // Kenley 1L BOPP labels
    const resolvedLabels = await resolveStock(tx, factoryId, { name: 'Labels', category: 'Labels' }, { selectedStockId: dummyStockId }, undefined);
    console.log(`Explicitly matching selectedStockId resolved: ${resolvedLabels?.itemName}`);
    if (resolvedLabels?.id === dummyStockId) {
      console.log("✓ Success: Resolved explicitly chosen stock batch.");
    } else {
      console.log("❌ Failed: Explicit stock batch not resolved.");
    }

    // Scenario C: BOM mapping resolution
    // Let's create dummy product and map it to standard blue caps in BOM
    const [brand] = await tx.select().from(productBrands).limit(1);
    if (brand) {
      const [testProd] = await tx.insert(products).values({
        name: 'Temporary Test SKU Product',
        brandId: brand.id,
        targetBPM: 100,
      }).returning();
      
      const [capStock] = await tx.select().from(inventoryStock).where(eq(inventoryStock.itemName, 'Standard Blue Caps')).limit(1);
      if (capStock) {
        await tx.insert(billOfMaterials).values({
          productId: testProd.id,
          stockId: capStock.id,
          quantityPerUnit: '1.000000'
        });
        
        // Resolve stock with product ID provided
        const resolvedCaps = await resolveStock(tx, factoryId, { name: 'Caps', category: 'Caps' }, { productId: testProd.id }, undefined);
        console.log(`BOM-based matching resolved: ${resolvedCaps?.itemName}`);
        if (resolvedCaps?.id === capStock.id) {
          console.log("✓ Success: Resolved stock via BOM mapping!");
        } else {
          console.log("❌ Failed: BOM stock mapping was not resolved.");
        }

        // --- TEST FAIL-EARLY VALIDATION ---
        console.log("\n--- Testing Fail-Early Validation ---");
        
        // Try starting validation with valid stock (quantity > 0)
        try {
          await validateStartBatch(tx, testProd.id, factoryId);
          console.log("✓ Success: validation passed for positive stock.");
        } catch (e: any) {
          console.log("❌ Failed: validation failed for positive stock:", e.message);
        }

        // Create zero stock item and map in BOM
        const [zeroStock] = await tx.insert(inventoryStock).values({
          itemName: 'Zero Stock Caps',
          sku: `CAP-ZERO-${Date.now()}`,
          quantity: '0.00',
          minimumStock: '10.00',
          unit: 'Pcs',
          factoryId,
          warehouseId: existingStockItem.warehouseId
        }).returning();

        const [testProdZero] = await tx.insert(products).values({
          name: 'Zero Qty Product',
          brandId: brand.id,
          targetBPM: 100
        }).returning();

        await tx.insert(billOfMaterials).values({
          productId: testProdZero.id,
          stockId: zeroStock.id,
          quantityPerUnit: '1.000000'
        });

        try {
          await validateStartBatch(tx, testProdZero.id, factoryId);
          console.log("❌ Failed: validation passed but should have failed for zero stock.");
        } catch (e: any) {
          console.log(`✓ Success: validation correctly blocked batch start: "${e.message}"`);
        }

        // Cleanup
        await tx.delete(billOfMaterials).where(eq(billOfMaterials.productId, testProd.id));
        await tx.delete(products).where(eq(products.id, testProd.id));
        await tx.delete(billOfMaterials).where(eq(billOfMaterials.productId, testProdZero.id));
        await tx.delete(products).where(eq(products.id, testProdZero.id));
        await tx.delete(inventoryStock).where(eq(inventoryStock.id, zeroStock.id));
      }
    }
    
    // Rollback so we don't dirty the database
    throw new Error('ROLLBACK_FOR_TEST');
  }).catch((err) => {
    if (err.message === 'ROLLBACK_FOR_TEST') {
      console.log("\nTests completed. Database state rolled back cleanly.");
    } else {
      console.error("Test execution failed:", err);
    }
  });

  process.exit(0);
}

main().catch(console.error);
