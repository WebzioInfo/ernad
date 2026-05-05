import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DIRECT_URL!, { ssl: 'require' });

async function main() {
  try {
    console.log('Fixing foreign key constraints to support cascading deletes...');

    const tablesInDb = await sql.unsafe(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
    const existingTables = tablesInDb.map(t => t.table_name);
    console.log('Existing tables in DB:', existingTables.join(', '));

    const checkAndFix = async (childTable: string, parentTable: string, constraintName: string, columnName: string) => {
      if (existingTables.includes(childTable)) {
        try {
          console.log(`Updating constraint ${constraintName} on ${childTable}...`);
          await sql.unsafe(`ALTER TABLE "${childTable}" DROP CONSTRAINT IF EXISTS "${constraintName}";`);
          await sql.unsafe(`ALTER TABLE "${childTable}" ADD CONSTRAINT "${constraintName}" FOREIGN KEY ("${columnName}") REFERENCES "${parentTable}"("id") ON DELETE CASCADE;`);
          console.log(`✅ Success: ${constraintName} updated.`);
        } catch (e) {
          console.error(`❌ Failed to update ${constraintName}:`, e.message);
        }
      } else {
        console.log(`Skipping ${childTable} (table does not exist yet).`);
      }
    };

    await checkAndFix('production_batches', 'production_lines', 'production_batches_line_id_production_lines_id_fk', 'line_id');
    await checkAndFix('production_batches', 'product_brands', 'production_batches_brand_id_product_brands_id_fk', 'brand_id');
    await checkAndFix('production_batches', 'products', 'production_batches_product_id_products_id_fk', 'product_id');
    await checkAndFix('production_batches', 'shifts', 'production_batches_shift_id_shifts_id_fk', 'shift_id');
    
    await checkAndFix('production_logs', 'production_lines', 'production_logs_line_id_production_lines_id_fk', 'line_id');
    await checkAndFix('production_logs', 'shifts', 'production_logs_shift_id_shifts_id_fk', 'shift_id');
    await checkAndFix('production_logs', 'product_brands', 'production_logs_brand_id_product_brands_id_fk', 'brand_id');
    await checkAndFix('production_logs', 'products', 'production_logs_product_id_products_id_fk', 'product_id');
    
    await checkAndFix('batch_totals', 'production_lines', 'batch_totals_line_id_production_lines_id_fk', 'line_id');
    await checkAndFix('products', 'product_brands', 'products_brand_id_product_brands_id_fk', 'brand_id');
    await checkAndFix('stock_transactions', 'raw_materials', 'stock_transactions_material_id_raw_materials_id_fk', 'material_id');

    console.log('✅ Constraint update process finished.');
  } catch (error) {
    console.error('❌ Critical failure in fix script:', error);
  } finally {
    await sql.end();
  }
}

main();
