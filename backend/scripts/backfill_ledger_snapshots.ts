import { db } from '../src/database/db';
import { eq, isNull, and } from 'drizzle-orm';
import { 
  products, 
  productStockTransactions, 
  productionLogs, 
  dispatchLogs, 
  salesTransactions, 
  productionBatches 
} from '../src/database/schema';

async function run() {
  console.log('Starting Ledger Snapshots Backfill...');

  const allProducts = await db.select().from(products);
  
  let totalUpdated = 0;

  for (const product of allProducts) {
    const productId = product.id;
    console.log(`Processing Product: ${product.name} (ID: ${productId})`);

    // Fetch all history
    const [manualTxs, packingLogs, dispatches, salesTxs] = await Promise.all([
      db.select().from(productStockTransactions).where(eq(productStockTransactions.productId, productId)),
      db.select({
        id: productionLogs.id,
        casesProduced: productionLogs.casesProduced,
        loggedAt: productionLogs.loggedAt
      })
      .from(productionLogs)
      .where(and(
        eq(productionLogs.productId, productId),
        eq(productionLogs.station, 'PACKING'),
        isNull(productionLogs.deletedAt)
      )),
      db.select({
        id: dispatchLogs.id,
        quantity: dispatchLogs.quantity,
        dispatchedAt: dispatchLogs.dispatchedAt
      })
      .from(dispatchLogs)
      .innerJoin(productionBatches, eq(dispatchLogs.batchId, productionBatches.id))
      .where(and(
        eq(productionBatches.productId, productId),
        isNull(productionBatches.deletedAt)
      )),
      db.select().from(salesTransactions).where(eq(salesTransactions.productId, productId))
    ]);

    const ledgerEntries: any[] = [];

    salesTxs.forEach(t => {
      let impact = { stock: 0, produced: 0, dispatched: 0 };
      if (t.type === 'RETURN') impact = { stock: t.quantity, produced: 0, dispatched: 0 };
      else if (t.type === 'SALES_DISPATCH') impact = { stock: -t.quantity, produced: 0, dispatched: t.quantity };
      else if (t.type === 'DAMAGE') impact = { stock: -t.quantity, produced: 0, dispatched: 0 };

      ledgerEntries.push({
        table: 'sales',
        id: t.id,
        createdAt: t.salesDate || t.createdAt,
        impact
      });
    });

    manualTxs.forEach(t => {
      let impact = { stock: 0, produced: 0, dispatched: 0 };
      const qty = Number(t.quantityChange);
      if (t.type === 'MANUAL_PRODUCED_ADJUST') impact = { stock: 0, produced: qty, dispatched: 0 };
      else if (t.type === 'MANUAL_DISPATCH_ADJUST') impact = { stock: 0, produced: 0, dispatched: qty };
      else impact = { stock: qty, produced: 0, dispatched: 0 };

      ledgerEntries.push({
        table: 'manual',
        id: t.id,
        createdAt: t.createdAt,
        impact
      });
    });

    packingLogs.forEach(l => {
      const qty = Number(l.casesProduced || 0);
      if (qty <= 0) return;
      ledgerEntries.push({
        table: 'production',
        id: l.id,
        createdAt: l.loggedAt,
        impact: { stock: qty, produced: qty, dispatched: 0 }
      });
    });

    dispatches.forEach(d => {
      ledgerEntries.push({
        table: 'dispatch',
        id: d.id,
        createdAt: d.dispatchedAt,
        impact: { stock: -d.quantity, produced: 0, dispatched: d.quantity }
      });
    });

    // Sort ascending by date
    ledgerEntries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let runningStock = 0;
    let runningProduced = 0;
    let runningDispatched = 0;

    for (const entry of ledgerEntries) {
      runningStock += entry.impact.stock;
      runningProduced += entry.impact.produced;
      runningDispatched += entry.impact.dispatched;

      const updates = {
        stockBalanceAfter: String(runningStock),
        producedBalanceAfter: String(runningProduced),
        dispatchedBalanceAfter: String(runningDispatched)
      };

      if (entry.table === 'sales') {
        await db.update(salesTransactions).set(updates).where(eq(salesTransactions.id, entry.id));
      } else if (entry.table === 'manual') {
        await db.update(productStockTransactions).set(updates).where(eq(productStockTransactions.id, entry.id));
      } else if (entry.table === 'production') {
        await db.update(productionLogs).set(updates).where(eq(productionLogs.id, entry.id));
      } else if (entry.table === 'dispatch') {
        await db.update(dispatchLogs).set(updates).where(eq(dispatchLogs.id, entry.id));
      }
      totalUpdated++;
    }
  }

  console.log(`Backfill complete. Updated ${totalUpdated} records.`);
  process.exit(0);
}

run().catch(console.error);
