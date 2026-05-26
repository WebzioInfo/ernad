const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

async function run() {
  try {
    console.log('Connecting to database...');
    const result = await sql`SELECT count(*)::int as total FROM production_logs`;
    console.log('Total production logs:', result[0].total);

    const samples = await sql`
      SELECT id, batch_id, line_id, user_id, station, primary_count, wastage_count, logged_at, deleted_at, status 
      FROM production_logs 
      ORDER BY logged_at DESC 
      LIMIT 10
    `;
    console.log('Latest 10 logs in DB:');
    console.table(samples);

    const users = await sql`
      SELECT u.id, u.name, u.username, u.email, r.slug as role
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      LIMIT 20
    `;
    console.log('Users in DB:');
    console.table(users);

    const batches = await sql`SELECT id, batch_code, status, start_time, end_time FROM production_batches LIMIT 10`;
    console.log('Batches in DB:');
    console.table(batches);
  } catch (error) {
    console.error('Error running query:', error);
  } finally {
    await sql.end();
  }
}

run();
