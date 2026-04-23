import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import 'dotenv/config';

async function test() {
    console.log('Testing connection to:', process.env.DIRECT_URL);
    const sql = postgres(process.env.DIRECT_URL!, { ssl: { rejectUnauthorized: false } });
    try {
        const result = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
        console.log('Tables found:', result.map(r => r.table_name));
    } catch (e) {
        console.error('Connection failed:', e);
    } finally {
        await sql.end();
    }
}

test();
