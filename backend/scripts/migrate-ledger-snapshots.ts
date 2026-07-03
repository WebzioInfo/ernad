import { db } from '../src/database/db';
import { 
  productStockTransactions
} from '../src/database/schema/inventory';
import { salesTransactions } from '../src/database/schema/sales';
import { products } from '../src/database/schema/master-data';
import { dispatchLogs, productionLogs } from '../src/database/schema/logs';
import { productionBatches } from '../src/database/schema/production';
import { eq, isNull, and } from 'drizzle-orm';

async function migrate() {
  console.log('Starting Ledger Snapshots Migration...');

  const allProducts = await db.select({ id: products.id }).from(products);
  
  for (const prod of allProducts) {
    const productId = prod.id;
    console.log(`Processing product: ${productId}`);

    // Fetch all history for this product
    const [manualTxs, packingLogs, dispatches, salesTxs] = await Promise.all([
      db.select({
        id: productStockTransactions.id,
        type: productStockTransactions.type,
        quantityChange: productStockTransactions.quantityChange,
        createdAt: productStockTransactions.createdAt,
      })
      .from(productStockTransactions)
      .where(eq(productStockTransactions.productId, productId)),

      db.select({
        id: productionLogs.id,
        casesProduced: productionLogs.casesProduced,
        createdAt: productionLogs.loggedAt,
      })
      .from(productionLogs)
      .leftJoin(productionBatches, eq(productionLogs.batchId, productionBatches.id))
      .where(and(
        eq(productionLogs.productId, productId),
        eq(productionLogs.station, 'PACKING'),
        isNull(productionLogs.deletedAt)
      )),

      db.select({
        id: dispatchLogs.id,
        quantity: dispatchLogs.quantity,
        createdAt: dispatchLogs.dispatchedAt,
      })
      .from(dispatchLogs)
      .innerJoin(productionBatches, eq(dispatchLogs.batchId, productionBatches.id))
      .where(and(
        eq(productionBatches.productId, productId),
        isNull(productionBatches.deletedAt)
      )),

      db.select({
        id: salesTransactions.id,
        type: salesTransactions.type,
        quantity: salesTransactions.quantity,
        salesDate: salesTransactions.salesDate,
        createdAt: salesTransactions.createdAt,
      })
      .from(salesTransactions)
      .where(eq(salesTransactions.productId, productId))
    ]);

    const ledgerEntries: any[] = [];

    salesTxs.forEach(t => {
      let typeLabel = '';
      let quantityChange = 0;
      let impact = { stock: 0, produced: 0, dispatched: 0 };
      
      if (t.type === 'RETURN') {
        typeLabel = 'RETURN';
        quantityChange = t.quantity;
        impact = { stock: t.quantity, produced: 0, dispatched: 0 };
      } else if (t.type === 'SALES_DISPATCH') {
        typeLabel = 'SALES_DISPATCH';
        quantityChange = -t.quantity;
        impact = { stock: -t.quantity, produced: 0, dispatched: t.quantity };
      } else if (t.type === 'DAMAGE') {
        typeLabel = 'DAMAGE';
        quantityChange = -t.quantity;
        impact = { stock: -t.quantity, produced: 0, dispatched: 0 };
      }

      ledgerEntries.push({
        id: t.id,
        table: 'sales_transactions',
        createdAt: t.salesDate,
        impact,
      });
    });

    manualTxs.forEach(t => {
      let impact = { stock: 0, produced: 0, dispatched: 0 };
      const qty = parseFloat(t.quantityChange as any);
      if (isNaN(qty)) return;
      
      if (t.type === 'MANUAL_PRODUCED_ADJUST') {
        impact = { stock: 0, produced: qty, dispatched: 0 };
      } else if (t.type === 'MANUAL_DISPATCH_ADJUST') {
        impact = { stock: 0, produced: 0, dispatched: qty };
      } else {
        impact = { stock: qty, produced: 0, dispatched: 0 };
      }

      ledgerEntries.push({
        id: t.id,
        table: 'product_stock_transactions',
        createdAt: t.createdAt,
        impact,
      });
    });

    packingLogs.forEach(l => {
      const casesProduced = parseFloat(l.casesProduced as any);
      if (isNaN(casesProduced) || casesProduced <= 0) return;
      ledgerEntries.push({
        id: l.id,
        table: 'production_logs',
        createdAt: l.createdAt,
        impact: { stock: casesProduced, produced: casesProduced, dispatched: 0 },
      });
    });

    dispatches.forEach(d => {
      const quantity = parseFloat(d.quantity as any);
      if (isNaN(quantity)) return;
      ledgerEntries.push({
        id: d.id,
        table: 'dispatch_logs',
        createdAt: d.createdAt,
        impact: { stock: -quantity, produced: 0, dispatched: quantity },
      });
    });

    // Sort ascending by date to chronologically replay
    ledgerEntries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let runningStock = 0;
    let runningProduced = 0;
    let runningDispatched = 0;

    for (const entry of ledgerEntries) {
      runningStock += entry.impact.stock;
      runningProduced += entry.impact.produced;
      runningDispatched += entry.impact.dispatched;

      // Update database row directly!
      if (entry.table === 'product_stock_transactions') {
        await db.update(productStockTransactions)
          .set({
            stockBalanceAfter: runningStock.toString(),
            producedBalanceAfter: runningProduced.toString(),
            dispatchedBalanceAfter: runningDispatched.toString()
          })
          .where(eq(productStockTransactions.id, entry.id));
      } else if (entry.table === 'production_logs') {
        await db.update(productionLogs)
          .set({
            stockBalanceAfter: runningStock.toString(),
            producedBalanceAfter: runningProduced.toString(),
            dispatchedBalanceAfter: runningDispatched.toString()
          })
          .where(eq(productionLogs.id, entry.id));
      } else if (entry.table === 'dispatch_logs') {
        await db.update(dispatchLogs)
          .set({
            stockBalanceAfter: runningStock.toString(),
            producedBalanceAfter: runningProduced.toString(),
            dispatchedBalanceAfter: runningDispatched.toString()
          })
          .where(eq(dispatchLogs.id, entry.id));
      } else if (entry.table === 'sales_transactions') {
        await db.update(salesTransactions)
          .set({
            stockBalanceAfter: runningStock.toString(),
            producedBalanceAfter: runningProduced.toString(),
            dispatchedBalanceAfter: runningDispatched.toString()
          })
          .where(eq(salesTransactions.id, entry.id));
      }
    }
    
    console.log(`Updated ${ledgerEntries.length} records for product ${productId}.`);
  }
  
  console.log('Migration complete!');
  process.exit(0);
}

migrate().catch(console.error);
