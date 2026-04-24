import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { productBrands, products } from '../src/db/schema';

async function seedProducts() {
    const client = postgres(process.env.DIRECT_URL!, { ssl: { rejectUnauthorized: false } });
    const db = drizzle(client);

    try {
        console.log('📦 Seeding Products & Brands...');
        const [brand] = await db.insert(productBrands).values({ name: 'ERNAD' }).onConflictDoNothing().returning();
        const brandId = brand?.id || (await db.select().from(productBrands).limit(1))[0].id;

        await db.insert(products).values([
            { name: '500ml Still Water', brandId, sku: 'W-500-STILL', category: 'Water' },
            { name: '2L Carbonated Water', brandId, sku: 'W-2000-CARB', category: 'Water' }
        ]).onConflictDoNothing();

        console.log('✅ Products & Brands Seeded.');
    } catch (err: any) {
        console.error('❌ Product Seeding failed:', err.message);
    } finally {
        await client.end();
    }
}

seedProducts();
