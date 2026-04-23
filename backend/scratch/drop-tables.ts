import 'dotenv/config';
import postgres from 'postgres';

async function dropTables() {
    const client = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false } });
    
    console.log('🗑️ Dropping all tables...');
    try {
        await client.unsafe(`
            DROP SCHEMA public CASCADE;
            CREATE SCHEMA public;
            GRANT ALL ON SCHEMA public TO postgres;
            GRANT ALL ON SCHEMA public TO public;
        `);
        console.log('✅ Tables dropped successfully.');
    } catch (e) {
        console.error('❌ Failed to drop tables:', e);
    } finally {
        await client.end();
    }
}

dropTables();
