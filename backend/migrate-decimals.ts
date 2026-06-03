import postgres from 'postgres';
import 'dotenv/config';

const client = postgres(process.env.DATABASE_URL!, { ssl: { rejectUnauthorized: false } });

async function migrate() {
  console.log('Migrating columns to decimal...');
  try {
    await client`ALTER TABLE raw_materials ALTER COLUMN current_stock TYPE decimal(12,2) USING current_stock::numeric`;
    await client`ALTER TABLE raw_material_transactions ALTER COLUMN quantity_change TYPE decimal(12,2) USING quantity_change::numeric`;
    await client`ALTER TABLE raw_material_transactions ALTER COLUMN balance_after TYPE decimal(12,2) USING balance_after::numeric`;
    
    await client`ALTER TABLE product_stock_transactions ALTER COLUMN quantity_change TYPE decimal(12,2) USING quantity_change::numeric`;
    await client`ALTER TABLE product_stock_transactions ALTER COLUMN balance_after TYPE decimal(12,2) USING balance_after::numeric`;

    await client`ALTER TABLE production_stock ALTER COLUMN current_stock TYPE decimal(12,2) USING current_stock::numeric`;
    await client`ALTER TABLE production_stock ALTER COLUMN total_produced TYPE decimal(12,2) USING total_produced::numeric`;
    await client`ALTER TABLE production_stock ALTER COLUMN total_dispatched TYPE decimal(12,2) USING total_dispatched::numeric`;

    console.log('Successfully altered columns to decimal(12,2)');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

migrate();
