import postgres from 'postgres';

async function testLocal() {
  console.log('--- TESTING LOCAL POSTGRES ON PORT 5433 ---');
  
  // Try default postgres DB
  try {
    const sql = postgres('postgresql://postgres:postgres@localhost:5433/postgres', {
      connect_timeout: 2,
    });
    const result = await sql`SELECT NOW()`;
    console.log('Success connecting to local postgres (5433):', result);
    
    console.log('Listing all databases:');
    const dbs = await sql`SELECT datname FROM pg_database WHERE datistemplate = false`;
    console.table(dbs);
    
    await sql.end();
  } catch (err) {
    console.error('Local Postgres (5433) error:');
    console.dir(err, { depth: null });
  }

  // Try postgres DB tables
  try {
    const sql = postgres('postgresql://postgres:postgres@localhost:5433/postgres', {
      connect_timeout: 2,
    });
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log('postgres DB tables:');
    console.table(tables);
    await sql.end();
  } catch (err) {
    console.error('Failed to list postgres tables:', err);
  }

  // Try Aquora DB tables
  try {
    const sql = postgres('postgresql://postgres:postgres@localhost:5433/Aquora', {
      connect_timeout: 2,
    });
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log('Aquora DB tables:');
    console.table(tables);

    const hasUsers = tables.some((t: any) => t.table_name === 'users');
    if (hasUsers) {
      const users = await sql`SELECT COUNT(*) FROM users`;
      console.log('Aquora users count:', users);
      const sample = await sql`SELECT id, name, username, email FROM users LIMIT 3`;
      console.log('Aquora sample users:', sample);
    }
    await sql.end();
  } catch (err) {
    console.error('Failed to list Aquora tables:', err);
  }
  
  // Try Webzio@2026 password just in case
  try {
    const sql = postgres('postgresql://postgres:Webzio%402026@localhost:5433/postgres', {
      connect_timeout: 2,
    });
    const result = await sql`SELECT NOW()`;
    console.log('Success connecting with Webzio@2026 password (5433):', result);
    await sql.end();
  } catch (err) {
    // ignore
  }
}

testLocal();
