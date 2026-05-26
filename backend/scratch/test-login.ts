import { db } from '../src/database/db';
import { users, roles, userRoles } from '../src/database/schema';
import { eq, or } from 'drizzle-orm';

function normalizeRole(roleSlug: string): string {
  const r = (roleSlug || '').toUpperCase().trim();
  if (r === 'GENERIC OPERATOR') return 'OPERATOR';
  if (r === 'PRODUCTION MANAGER') return 'MANAGER';
  if (r.includes('ADMIN')) return 'ADMIN';
  if (r.includes('MANAGER')) return 'MANAGER';
  return 'OPERATOR';
}

async function test(username: string) {
  console.log(`\nTesting user: ${username}`);
  const userResult = await db.select().from(users).where(eq(users.username, username));
  if (userResult.length === 0) {
    console.log(`User ${username} not found!`);
    return;
  }
  const user = userResult[0];
  console.log(`Found user: ${user.name} (id: ${user.id})`);

  const userRolesResult = await db.select({
    id: roles.id,
    slug: roles.slug,
    name: roles.name,
  })
  .from(roles)
  .innerJoin(userRoles, eq(userRoles.roleId, roles.id))
  .where(eq(userRoles.userId, user.id));

  console.log('Roles from DB:', userRolesResult);

  const roleSlugs = Array.from(new Set(userRolesResult.map(r => normalizeRole(r.slug))));
  console.log('Normalized role slugs:', roleSlugs);
}

async function run() {
  await test('pranesh.manager');
  await test('sujith.blower');
  await test('danish.filling');
  process.exit(0);
}

run();
