import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const queryClient = postgres(process.env.DIRECT_URL!, { ssl: 'require' });
const db = drizzle(queryClient);

async function main() {
  try {
    console.log('Testing connection...');
    const result = await db.execute('SELECT 1');
    console.log('Connection successful:', result);
    
    console.log('Listing tables...');
    const tables = await db.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tables:', tables);
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await queryClient.end();
  }
}

main();
