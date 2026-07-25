import postgres from 'postgres';

async function setup() {
  console.log('Connecting to local Postgres on port 5433...');
  const sql = postgres('postgresql://postgres:postgres@localhost:5433/postgres', {
    connect_timeout: 3,
  });

  try {
    // Check if database ernad exists
    const dbs = await sql`SELECT datname FROM pg_database WHERE datname = 'ernad'`;
    if (dbs.length === 0) {
      console.log('Database ernad does not exist. Creating it...');
      await sql`CREATE DATABASE ernad`;
      console.log('Database ernad created successfully.');
    } else {
      console.log('Database ernad already exists.');
    }
  } catch (err: any) {
    console.error('Failed to setup database:', err.message);
  } finally {
    await sql.end();
  }
}

setup();
