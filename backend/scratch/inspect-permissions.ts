import { db } from '../src/database/db';
import { permissions, roles, rolePermissions } from '../src/database/schema';

async function run() {
  try {
    const allPerms = await db.select().from(permissions);
    console.log(`Found ${allPerms.length} permissions:`);
    for (const p of allPerms) {
      console.log(` - ${p.slug} (${p.name})`);
    }

    const allRolePerms = await db.select().from(rolePermissions);
    console.log(`Found ${allRolePerms.length} role-permission mappings.`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
