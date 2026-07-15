const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres.jkczuqjmmslmvvoglogd:Webzio%402026@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  console.log('Connected to DB');
  
  try {
    await client.query('ALTER TABLE products ADD COLUMN units_per_case integer DEFAULT 24 NOT NULL');
    console.log('Added units_per_case to products');
  } catch (e) {
    console.error('Error (might already exist):', e.message);
  }
  
  await client.end();
}

run();
