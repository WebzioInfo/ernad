const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:Webzio%402026@db.jkczuqjmmslmvvoglogd.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('Connected to DB successfully.');

    // 1. Clean up existing users and user_roles to ensure ONLY the 4 requested users exist
    await client.query('DELETE FROM user_roles');
    await client.query('DELETE FROM users');
    console.log('Cleaned up existing users and user_roles.');

    // 2. Ensure roles exist in roles table
    const rolesData = [
      { name: 'Administrator', slug: 'ADMIN', description: 'System Administrator' },
      { name: 'Production Manager', slug: 'MANAGER', description: 'Plant Manager' },
      { name: 'Accountant', slug: 'ACCOUNTANT', description: 'Finance and Accounting' },
      { name: 'Operator', slug: 'OPERATOR', description: 'Generic Plant Operator' }
    ];

    const roleMap = {}; // mapping slug -> role_id

    for (const r of rolesData) {
      const checkRole = await client.query('SELECT id FROM roles WHERE slug = $1', [r.slug]);
      let roleId;
      if (checkRole.rows.length > 0) {
        roleId = checkRole.rows[0].id;
      } else {
        const insertRole = await client.query(
          'INSERT INTO roles (id, name, slug, description) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id',
          [r.name, r.slug, r.description]
        );
        roleId = insertRole.rows[0].id;
      }
      roleMap[r.slug] = roleId;
    }

    // 3. Define the 4 users with standard defaults
    const usersData = [
      {
        name: 'System Admin',
        username: 'admin',
        email: 'admin@ernad.com',
        password: 'adminadmin',
        pin: '1234',
        role: 'ADMIN'
      },
      {
        name: 'Plant Manager',
        username: 'manager',
        email: 'manager@ernad.com',
        password: 'adminadmin',
        pin: '1234',
        role: 'MANAGER'
      },
      {
        name: 'Finance Accountant',
        username: 'accountant',
        email: 'accountant@ernad.com',
        password: 'adminadmin',
        pin: '1234',
        role: 'ACCOUNTANT'
      },
      {
        name: 'Plant Operator',
        username: 'operator',
        email: 'operator@ernad.com',
        password: 'adminadmin',
        pin: '1234',
        role: 'OPERATOR'
      }
    ];

    // 4. Hash passwords/PINs and insert users
    for (const u of usersData) {
      const passwordHash = await bcrypt.hash(u.password, 10);
      const pinHash = await bcrypt.hash(u.pin, 10);

      const insertUser = await client.query(
        `INSERT INTO users (id, name, username, email, password_hash, pin_code, is_active) 
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true) RETURNING id`,
        [u.name, u.username, u.email, passwordHash, pinHash]
      );
      
      const userId = insertUser.rows[0].id;
      const roleId = roleMap[u.role];

      await client.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
        [userId, roleId]
      );

      console.log(`Successfully seeded user: ${u.username} (${u.role}) -> ID: ${userId}`);
    }

    // 5. Final Verification
    const finalUsersCount = await client.query('SELECT count(*) FROM users');
    console.log(`Verification: Total user count in new database is now: ${finalUsersCount.rows[0].count}`);

  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await client.end();
  }
}

run();
