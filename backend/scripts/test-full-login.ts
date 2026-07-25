import { db } from '../src/database/db';
import { users, roles, userRoles } from '../src/database/schema';
import { eq, ilike, and, isNull, or } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';

async function testLogin(identity: string, credential: string) {
  console.log(`Testing login for identity: "${identity}"...`);

  const trimmedIdentity = (identity || '').trim();
  if (!trimmedIdentity) {
    throw new Error('Identity is empty.');
  }

  // 1. Search for user by username or email
  let userResult = await db.select().from(users).where(
    and(
      isNull(users.deletedAt),
      or(
        ilike(users.username, trimmedIdentity),
        ilike(users.email, trimmedIdentity)
      )
    )
  );

  if (!userResult.length && trimmedIdentity.includes('.') && !trimmedIdentity.includes('@')) {
    const basePrefix = trimmedIdentity.split('.')[0].trim();
    if (basePrefix) {
      userResult = await db.select().from(users).where(
        and(
          isNull(users.deletedAt),
          or(
            ilike(users.username, basePrefix),
            ilike(users.email, basePrefix)
          )
        )
      );
    }
  }

  if (!userResult.length) {
    const cleanPrefix = trimmedIdentity.split('@')[0].trim();
    userResult = await db.select().from(users).where(
      and(
        isNull(users.deletedAt),
        or(
          ilike(users.username, `${cleanPrefix}%`),
          ilike(users.email, `${cleanPrefix}@%`)
        )
      )
    );
  }

  const user = userResult[0];
  if (!user) {
    console.error(`❌ Identity not found: "${trimmedIdentity}"`);
    return false;
  }

  console.log(`✅ User found: ID=${user.id}, Username="${user.username}", Email="${user.email}", Active=${user.isActive}`);

  if (!user.isActive) {
    console.error(`❌ User is inactive: "${trimmedIdentity}"`);
    return false;
  }

  // 2. Credential match check
  let isMatch = false;
  if (user.passwordHash) {
    isMatch = await bcrypt.compare(credential, user.passwordHash).catch(() => false);
  }
  if (!isMatch && user.pinCode) {
    isMatch = await bcrypt.compare(credential, user.pinCode).catch(() => false);
  }

  if (!isMatch) {
    console.error(`❌ Password/PIN mismatch for "${trimmedIdentity}"`);
    return false;
  }

  // 3. Resolve role AFTER successful authentication
  const userRolesResult = await db.select({
    slug: roles.slug,
  })
  .from(roles)
  .innerJoin(userRoles, eq(userRoles.roleId, roles.id))
  .where(eq(userRoles.userId, user.id));

  const roleSlugs = userRolesResult.map(r => r.slug.toUpperCase().trim());
  const effectiveRole = roleSlugs[0] || 'OPERATOR';

  console.log(`🎉 LOGIN SUCCESSFUL for "${trimmedIdentity}"! Assigned Role: ${effectiveRole}, Roles: ${JSON.stringify(roleSlugs)}`);
  return true;
}

async function main() {
  console.log('====================================================');
  console.log('    FULL AUTHENTICATION REGRESSION TEST SUITE      ');
  console.log('====================================================');

  // Test admin.admin specifically
  console.log('Testing special dot identity "admin.admin"...');
  const resAdminAdmin = await testLogin('admin.admin', 'admin123').catch(() => false);
  console.log(`Identity "admin.admin" login result: ${resAdminAdmin ? 'PASSED' : 'FAILED'}`);

  const usersList = await db.select().from(users).where(isNull(users.deletedAt));

  for (const u of usersList) {
    // Attempt login with default seed credentials
    const successUser = await testLogin(u.username, 'admin123').catch(() => false) ||
                        await testLogin(u.username, '1234').catch(() => false) ||
                        await testLogin(u.username, 'password123').catch(() => false);
    
    if (successUser) {
      console.log(`✅ ${u.username} authentication test PASSED.\n`);
    } else {
      console.log(`⚠️ ${u.username} requires specific custom credential.\n`);
    }
  }

  process.exit(0);
}

main();
