import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  const sql = postgres(databaseUrl, {
    prepare: false,
    ssl: process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    console.log('Fetching database tables...');
    const result = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    console.log('Tables:');
    console.table(result);
  } catch (error) {
    console.error(error);
  } finally {
    await sql.end();
  }
}

main();
