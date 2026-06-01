import { db } from './src/database/db';
import { sql } from 'drizzle-orm';

async function main() {
    try {
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "bill_of_materials" (
              "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
              "stock_id" uuid NOT NULL REFERENCES "inventory_stock"("id") ON DELETE CASCADE,
              "quantity_per_unit" numeric(12, 6) NOT NULL,
              "created_at" timestamp NOT NULL DEFAULT now()
            );
        `);
        console.log("SUCCESS: Created bill_of_materials");
    } catch(e) {
        console.error("FAILED", e);
    }
    process.exit(0);
}
main();
