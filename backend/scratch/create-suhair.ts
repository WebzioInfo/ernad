import { db } from '../src/database/db';
import { users, roles, userRoles } from '../src/database/schema';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('Creating user Suhar bachu...');
  
  const username = 'suhair.bachu';
  const email = 'suhair.bachu@example.com';
  const name = 'Suhar bachu';
  const password = 'adminadmin';

  try {
    // 1. Hash the password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // 2. Find or Create Admin Role
    let [adminRole] = await db.select().from(roles).where(eq(roles.slug, 'ADMIN'));
    if (!adminRole) {
      console.log('ADMIN role not found. Creating one...');
      [adminRole] = await db.insert(roles).values({
        name: 'Administrator',
        slug: 'ADMIN',
        description: 'System Administrator',
      }).returning();
    }
    
    // 3. Create User
    const [user] = await db.insert(users).values({
      name,
      username,
      email,
      passwordHash,
      isActive: true,
    }).returning();
    
    console.log('User created:', user.id);
    
    // 4. Assign Role
    await db.insert(userRoles).values({
      userId: user.id,
      roleId: adminRole.id,
    });
    
    console.log('Role assigned successfully!');
  } catch (err) {
    console.error('Error creating user:', err);
  } finally {
    process.exit(0);
  }
}

main();
