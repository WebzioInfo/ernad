import { db } from '../src/database/db';
import { users, userRoles, roles } from '../src/database/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const allUsers = await db.select({
    id: users.id,
    name: users.name,
    username: users.username
  }).from(users);

  for (const user of allUsers) {
    const r = await db.select({ slug: roles.slug })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(userRoles.userId, user.id));
    console.log(`User: ${user.username} Roles: ${r.map(x => x.slug).join(', ')}`);
  }
}
main().catch(console.error).finally(() => process.exit(0));
