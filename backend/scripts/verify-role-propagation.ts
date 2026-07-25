import { db } from '../src/database/db';
import { users, roles, userRoles } from '../src/database/schema';
import { eq, ilike } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';

async function verifyUserRole(userId: string, expectedRole: string) {
  const userRolesResult = await db.select({
    id: roles.id,
    slug: roles.slug,
    name: roles.name,
  })
  .from(roles)
  .innerJoin(userRoles, eq(userRoles.roleId, roles.id))
  .where(eq(userRoles.userId, userId));

  const roleSlugs = userRolesResult.map(r => r.slug.toUpperCase().trim());
  console.log(`[VERIFY DB] User ${userId} database roles:`, roleSlugs);

  if (roleSlugs.length !== 1 || roleSlugs[0] !== expectedRole) {
    throw new Error(`Role mismatch! Expected strictly ['${expectedRole}'], got ${JSON.stringify(roleSlugs)}`);
  }

  console.log(`✅ Role verification PASSED for ${expectedRole}`);
}

async function assignRole(userId: string, targetRoleSlug: string) {
  const roleSlug = targetRoleSlug.toUpperCase().trim();
  console.log(`[ASSIGN ROLE] Setting role to ${roleSlug} for user ${userId}...`);

  const [roleObj] = await db.select().from(roles).where(ilike(roles.slug, roleSlug));
  if (!roleObj) {
    throw new Error(`Role "${roleSlug}" not found in database roles table.`);
  }

  await db.delete(userRoles).where(eq(userRoles.userId, userId));
  await db.insert(userRoles).values({ userId: userId, roleId: roleObj.id });
}

async function main() {
  console.log('====================================================');
  console.log('   ROLE & PERMISSION PROPAGATION AUDIT TEST SCRIPT   ');
  console.log('====================================================');

  const testUsername = 'anees_account_test';
  
  // Find or create test user
  let [user] = await db.select().from(users).where(eq(users.username, testUsername)).limit(1);
  if (!user) {
    const hashed = await bcrypt.hash('password123', 10);
    [user] = await db.insert(users).values({
      name: 'Anees Account',
      username: testUsername,
      email: 'anees.test@ernad.com',
      passwordHash: hashed,
      pinCode: hashed,
      isActive: true,
    }).returning();
    console.log('Created test user Anees Account:', user.id);
  } else {
    console.log('Found existing test user Anees Account:', user.id);
  }

  // 1. Assign OPERATOR
  await assignRole(user.id, 'OPERATOR');
  await verifyUserRole(user.id, 'OPERATOR');

  // 2. Change role to ACCOUNTANT
  await assignRole(user.id, 'ACCOUNTANT');
  await verifyUserRole(user.id, 'ACCOUNTANT');

  // 3. Change role to ADMIN
  await assignRole(user.id, 'ADMIN');
  await verifyUserRole(user.id, 'ADMIN');

  // 4. Change role to MANAGER
  await assignRole(user.id, 'MANAGER');
  await verifyUserRole(user.id, 'MANAGER');

  console.log('====================================================');
  console.log('🎉 ALL ROLE PROPAGATION VERIFICATIONS PASSED 100%!');
  console.log('====================================================');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Role propagation audit failed:', err);
  process.exit(1);
});
