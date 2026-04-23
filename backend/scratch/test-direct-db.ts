import postgres from 'postgres';
import 'dotenv/config';

// The pooler is failing. Constructing the Truly Direct URL.
const PROJECT_REF = 'tjswseczwirsnydfhgxq';
const PASSWORD = 'WeBzIoWeBzI';
const DIRECT_URL = `postgres://postgres.${PROJECT_REF}:${PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres?sslmode=require`;

async function testTrulyDirect() {
    console.log('Testing Truly Direct Connection to Supabase...');
    const client = postgres(DIRECT_URL, { ssl: { rejectUnauthorized: false }, connect_timeout: 10 });
    try {
        const result = await client`SELECT now()`;
        console.log('✅ Truly Direct Success:', result[0].now);
    } catch (e: any) {
        console.error('❌ Truly Direct Failed:', e.message);
    } finally {
        await client.end();
    }
}

testTrulyDirect();
