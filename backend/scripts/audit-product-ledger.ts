import { sql } from 'drizzle-orm';
import { db } from '../src/database/db';

async function main() {
  const productId = process.argv[2];
  const filter = productId ? sql`WHERE p.id = ${productId}` : sql``;

  const products = await db.execute(sql`
    SELECT p.id, p.name,
      ps.current_stock, ps.total_produced, ps.total_dispatched,
      (SELECT count(*) FROM product_stock_transactions t WHERE t.product_id = p.id) manual_count,
      (SELECT count(*) FROM production_logs l WHERE l.product_id = p.id AND l.station = 'PACKING' AND l.deleted_at IS NULL) production_count,
      (SELECT count(*) FROM dispatch_logs d JOIN production_batches b ON b.id = d.batch_id WHERE b.product_id = p.id AND b.deleted_at IS NULL) dispatch_count,
      (SELECT count(*) FROM sales_transactions s WHERE s.product_id = p.id) sales_count
    FROM products p
    LEFT JOIN production_stock ps ON ps.product_id = p.id
    ${filter}
    ORDER BY p.name
  `);

  const integrity = await db.execute(sql`
    SELECT source, count(*)::int AS rows,
      count(*) FILTER (WHERE quantity IS NULL)::int AS null_quantities,
      count(*) FILTER (WHERE quantity = 0)::int AS zero_quantities,
      count(*) FILTER (WHERE performed_by IS NULL)::int AS null_users,
      count(*) FILTER (WHERE user_id IS NULL)::int AS orphan_users,
      count(*) FILTER (WHERE stock_after IS NULL OR produced_after IS NULL OR dispatched_after IS NULL)::int AS missing_snapshots
    FROM (
      SELECT 'manual' source, quantity_change::numeric quantity, performed_by,
        u.id user_id, stock_balance_after stock_after, produced_balance_after produced_after,
        dispatched_balance_after dispatched_after
      FROM product_stock_transactions t LEFT JOIN users u ON u.id = t.performed_by
      UNION ALL
      SELECT 'production', cases_produced::numeric, user_id, u.id,
        stock_balance_after, produced_balance_after, dispatched_balance_after
      FROM production_logs l LEFT JOIN users u ON u.id = l.user_id
      WHERE l.station = 'PACKING' AND l.deleted_at IS NULL
      UNION ALL
      SELECT 'dispatch', quantity::numeric, dispatch_manager_id, u.id,
        stock_balance_after, produced_balance_after, dispatched_balance_after
      FROM dispatch_logs d LEFT JOIN users u ON u.id = d.dispatch_manager_id
      UNION ALL
      SELECT 'sales', quantity::numeric, performed_by, u.id,
        stock_balance_after, produced_balance_after, dispatched_balance_after
      FROM sales_transactions s LEFT JOIN users u ON u.id = s.performed_by
    ) ledger
    GROUP BY source ORDER BY source
  `);

  console.log(JSON.stringify({ products, integrity }, null, 2));
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
