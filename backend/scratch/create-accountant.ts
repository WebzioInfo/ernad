import { db } from '../src/database/db';
import { users, roles, userRoles } from '../src/database/schema';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

async function main() {
  const username = 'accountant.ernad';
  const email = 'accountant.ernad@example.com';
  const name = 'Accountant Ernad';
  const password = '1108';

  console.log(`Creating accountant user ${username}...`);

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    let [accountantRole] = await db.select().from(roles).where(eq(roles.slug, 'ACCOUNTANT'));
    if (!accountantRole) {
      console.log('ACCOUNTANT role not found. Creating one...');
      [accountantRole] = await db.insert(roles).values({
        name: 'Accountant',
        slug: 'ACCOUNTANT',
        description: 'Sales and inventory accountant',
      }).returning();
    }

    const [user] = await db.insert(users).values({
      name,
      username,
      email,
      passwordHash,
      isActive: true,
    }).returning();

    await db.insert(userRoles).values({
      userId: user.id,
      roleId: accountantRole.id,
    });

    console.log('Accountant created successfully!');
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
  } catch (err) {
    console.error('Failed to create accountant user:', err);
  } finally {
    process.exit(0);
  }
}

main();
