const postgres = require('postgres');

async function main() {
  const url = 'postgresql://postgres:postgres@localhost:5432/postgres';
  const sql = postgres(url, { prepare: false });
  try {
    console.log('Listing all databases:');
    const dbs = await sql`SELECT datname FROM pg_database WHERE datistemplate = false`;
    console.table(dbs);

    for (const dbRow of dbs) {
      const dbName = dbRow.datname;
      console.log(`\n--- Inspecting database: ${dbName} ---`);
      const dbUrl = `postgresql://postgres:postgres@localhost:5432/${dbName}`;
      const dbSql = postgres(dbUrl, { prepare: false });
      try {
        const tables = await dbSql`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
        `;
        console.log(`Database ${dbName} tables:`);
        console.table(tables);

        const hasUsers = tables.some(t => t.table_name === 'users');
        if (hasUsers) {
          console.log(`Users table in ${dbName} exists! Columns:`);
          const columns = await dbSql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
          `;
          console.table(columns);

          console.log('Querying first 5 users:');
          const users = await dbSql`SELECT id, name, username, email FROM users LIMIT 5`;
          console.table(users);
        }
      } catch (err) {
        console.error(`Failed to inspect database ${dbName}:`, err.message);
      } finally {
        await dbSql.end();
      }
    }
  } catch (err) {
    console.error('Failed to list databases:', err.message);
  } finally {
    await sql.end();
  }
}

main();
