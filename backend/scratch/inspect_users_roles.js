const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:Webzio%402026@db.jkczuqjmmslmvvoglogd.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    
    // Fetch roles
    const roles = await client.query('SELECT * FROM roles');
    console.log('--- Roles ---');
    console.log(roles.rows);

    // Fetch users with their roles
    const users = await client.query(`
      SELECT u.id, u.name, u.username, u.email, r.slug as role_slug
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
    `);
    console.log('--- Users ---');
    console.log(users.rows);

  } catch (err) {
    console.error('Failed to query DB:', err);
  } finally {
    await client.end();
  }
}

run();
