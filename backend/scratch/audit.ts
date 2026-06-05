import { db } from '../src/database/db';
import { productionStock, products, productStockTransactions, productionLogs, dispatchLogs, productionBatches } from '../src/database/schema';
import { eq } from 'drizzle-orm';

async function audit() {
  const stock = await db.select().from(productionStock).innerJoin(products, eq(productionStock.productId, products.id));
  console.log("Stock:", stock.map(s => ({
    name: s.products.name,
    totalProduced: s.production_stock.totalProduced,
    totalDispatched: s.production_stock.totalDispatched,
    currentStock: s.production_stock.currentStock,
    productId: s.production_stock.productId
  })));
  process.exit(0);
}
audit().catch(console.error);
