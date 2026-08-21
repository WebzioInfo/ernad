import 'dotenv/config';
import { db } from '../src/database/db';
import { sql } from 'drizzle-orm';
import { salesTransactions, products, productionLogs, productionStock } from '../src/database/schema';

async function runAudit() {
  console.log('====================================================');
  console.log('       KENBY AI PHASE 4.1: DATA & SAFETY AUDIT      ');
  console.log('====================================================\n');

  // 1. AUDIT SALES (August 2026)
  console.log('=== STEP 1: SALES AUDIT (August 2026) ===');
  const salesRecords = await db.execute(sql`
    SELECT
      st.id,
      st.type,
      st.quantity,
      st.sales_date,
      st.unit_price,
      st.remarks,
      st.created_at,
      p.name as product_name,
      p.units_per_case
    FROM sales_transactions st
    JOIN products p ON p.id = st.product_id
    WHERE st.type = 'SALES_DISPATCH'
      AND st.sales_date >= '2026-08-01'
      AND st.sales_date < '2026-09-01'
    ORDER BY st.sales_date, st.created_at
  `);

  console.log(`Total SALES_DISPATCH records in August 2026: ${salesRecords.length}`);
  let totalSalesQty = 0;
  salesRecords.forEach((r: any, idx: number) => {
    totalSalesQty += Number(r.quantity);
    console.log(`  ${idx + 1}. ID: ${r.id} | Product: ${r.product_name} | Qty: ${r.quantity} | Date: ${r.sales_date} | Price: ${r.unit_price} | Created: ${r.created_at}`);
  });
  console.log(`Sum of Sales Quantity: ${totalSalesQty}\n`);

  // 2. AUDIT RETURNS (August 2026)
  console.log('=== STEP 2: RETURNS AUDIT (August 2026) ===');
  const returnRecords = await db.execute(sql`
    SELECT
      st.id,
      st.type,
      st.quantity,
      st.sales_date,
      st.unit_price,
      st.remarks,
      st.customer_id,
      st.created_at,
      p.name as product_name,
      p.units_per_case
    FROM sales_transactions st
    JOIN products p ON p.id = st.product_id
    WHERE st.type = 'RETURN'
      AND st.sales_date >= '2026-08-01'
      AND st.sales_date < '2026-09-01'
    ORDER BY st.sales_date, st.created_at
  `);

  console.log(`Total RETURN records in August 2026: ${returnRecords.length}`);
  let totalReturnQty = 0;
  returnRecords.forEach((r: any, idx: number) => {
    totalReturnQty += Number(r.quantity);
    console.log(`  ${idx + 1}. ID: ${r.id} | Product: ${r.product_name} (UnitsPerCase: ${r.units_per_case}) | Qty: ${r.quantity} | Date: ${r.sales_date} | Remarks: "${r.remarks}" | Created: ${r.created_at}`);
  });
  console.log(`Sum of Return Quantity: ${totalReturnQty}\n`);

  // 3. AUDIT PRODUCTION (August 2026)
  console.log('=== STEP 3: PRODUCTION AUDIT (August 2026) ===');
  const prodRecords = await db.execute(sql`
    SELECT
      pl.id,
      pl.batch_id,
      pl.station,
      pl.primary_count,
      pl.cases_produced,
      pl.finished_goods_produced,
      pl.wastage_count,
      pl.status,
      pl.logged_at,
      pl.deleted_at,
      p.name as product_name
    FROM production_logs pl
    JOIN products p ON p.id = pl.product_id
    WHERE pl.deleted_at IS NULL
      AND date(pl.logged_at) >= '2026-08-01'
      AND date(pl.logged_at) < '2026-09-01'
    ORDER BY pl.logged_at
  `);

  console.log(`Total production_logs records in August 2026: ${prodRecords.length}`);
  let totalProdCasesPacking = 0;
  prodRecords.forEach((r: any, idx: number) => {
    const cases = Number(r.cases_produced || r.primary_count || 0);
    if (r.station === 'PACKING') totalProdCasesPacking += cases;
    console.log(`  ${idx + 1}. ID: ${r.id} | Station: ${r.station} | Product: ${r.product_name} | PrimaryCount: ${r.primary_count} | CasesProduced: ${r.cases_produced} | FinishedGoods: ${r.finished_goods_produced} | Wastage: ${r.wastage_count} | LoggedAt: ${r.logged_at}`);
  });
  console.log(`Sum of Production Cases (Station PACKING): ${totalProdCasesPacking}\n`);

  // 4. AUDIT STOCK
  console.log('=== STEP 4: STOCK AUDIT ===');
  const stockRecords = await db.execute(sql`
    SELECT
      ps.id,
      p.name as product_name,
      p.sku,
      p.units_per_case,
      ps.current_stock,
      ps.total_produced,
      ps.total_dispatched,
      ps.updated_at
    FROM products p
    LEFT JOIN production_stock ps ON ps.product_id = p.id
  `);

  console.log(`Total Products in Stock: ${stockRecords.length}`);
  let totalStockVal = 0;
  stockRecords.forEach((r: any, idx: number) => {
    const stock = Number(r.current_stock || 0);
    totalStockVal += stock;
    console.log(`  ${idx + 1}. Product: ${r.product_name} (SKU: ${r.sku}, UnitsPerCase: ${r.units_per_case}) | Stock: ${r.current_stock} | TotalProduced: ${r.total_produced} | TotalDispatched: ${r.total_dispatched}`);
  });
  console.log(`Sum of Current Stock: ${totalStockVal}\n`);

  process.exit(0);
}

runAudit();
