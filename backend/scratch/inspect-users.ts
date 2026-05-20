import { db } from '../src/database/db';
import { users, userRoles, roles } from '../src/database/schema';
import { eq } from 'drizzle-orm';

async function run() {
  try {
    const allUsers = await db.select().from(users);
    console.log(`Found ${allUsers.length} users. Analyzing roles...`);
    
    for (const u of allUsers) {
      const uRoles = await db.select({
        slug: roles.slug,
        name: roles.name,
      })
      .from(roles)
      .innerJoin(userRoles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, u.id));
      
      console.log(`User: ${u.username} (${u.name})`);
      console.log(`  Roles: ${uRoles.map(r => r.slug).join(', ')}`);
      console.log(`  Has Password: ${!!u.passwordHash}, Has PIN: ${!!u.pinCode}`);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
