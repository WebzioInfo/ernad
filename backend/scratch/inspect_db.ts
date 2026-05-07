import 'dotenv/config';
import { Client } from 'pg';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function inspectSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'operator_sessions'
    `);
    console.log('Columns in operator_sessions:');
    res.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));
    
    const batches = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'production_batches'
    `);
    console.log('\nColumns in production_batches:');
    batches.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));

    console.log('\nTesting failing insert query...');
    try {
      const params = [
        'KB-TEST-99', 
        '094da561-e622-42c6-b7a1-99102bf5bc0f', 
        'ad725e67-e8a3-4bee-aefb-335779708d62', 
        '94c4f69e-20a8-436d-aafd-571f836c0e7a', 
        'ff7d4636-5d6e-4162-9d2d-e28f6075af41', 
        '63342f66-77d0-4e5e-b66c-5e33ecdaa9f4', 
        new Date(), 
        'RUNNING', 
        '15b5c75c-255d-46db-b21b-5a3b661411c6', 
        ''
      ];
      await client.query('insert into "production_batches" ("batch_code", "line_id", "brand_id", "product_id", "shift_id", "factory_id", "start_time", "status", "created_by", "remarks") values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', params);
      console.log('✅ Insert worked in manual test!');
    } catch (e: any) {
      console.error('❌ Insert failed in manual test:', e.message);
      console.error('Error details:', e);
    }

  } catch (err) {
    console.error('Inspection failed:', err);
  } finally {
    await client.end();
  }
}

inspectSchema();
