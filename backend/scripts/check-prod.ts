import { db } from '../src/database/db';
import { productStockTransactions } from '../src/database/schema/inventory';

async function main() {
  const res = await db.select().from(productStockTransactions).limit(5);
  console.log("Stock Txs:", res.map(r => ({
    id: r.id,
    stockAfter: r.stockBalanceAfter,
    producedAfter: r.producedBalanceAfter,
    dispatchedAfter: r.dispatchedBalanceAfter
  })));
  process.exit(0);
}
main();
