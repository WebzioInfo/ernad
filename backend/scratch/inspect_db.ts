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

    console.log('\nChecking Roles and Permissions...');
    const roleData = await client.query(`
      SELECT r.slug as role, p.slug as permission
      FROM roles r
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON p.id = rp.permission_id
      ORDER BY r.slug, p.slug
    `);
    
    const roleMap: Record<string, string[]> = {};
    roleData.rows.forEach(row => {
      if (!roleMap[row.role]) roleMap[row.role] = [];
      roleMap[row.role].push(row.permission);
    });
    
    Object.entries(roleMap).forEach(([role, perms]) => {
      console.log(`Role [${role}]: ${perms.join(', ')}`);
    });

    console.log('\nAll Available Permissions:');
    console.log('\nFixing permissions: Adding settings:view...');
    try {
      // 1. Ensure permission exists
      await client.query("INSERT INTO permissions (id, name, slug) VALUES (gen_random_uuid(), 'View Settings', 'settings:view') ON CONFLICT (slug) DO NOTHING");
      
      const rolesToGrant = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATOR', 'OPERATOR_BLOWING', 'OPERATOR_FILLING', 'OPERATOR_LABELING', 'OPERATOR_PACKING'];
      
      for (const roleSlug of rolesToGrant) {
        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          SELECT r.id, p.id
          FROM roles r, permissions p
          WHERE r.slug = $1 AND p.slug = 'settings:view'
          ON CONFLICT DO NOTHING
        `, [roleSlug]);
        console.log(`- Granted settings:view to ${roleSlug}`);
      }
      
      console.log('✅ Permissions fixed.');
    } catch (e: any) {
      console.error('❌ Failed to fix permissions:', e.message);
    }

  } catch (err) {
    console.error('Inspection failed:', err);
  } finally {
    await client.end();
  }
}

inspectSchema();
