import { db } from '../src/database/db';
import { users } from '../src/database/schema';
import { isNull, ilike, or, and } from 'drizzle-orm';

async function main() {
  console.log('Inspecting users in database for authentication...');

  const allUsers = await db.select().from(users);

  console.log(`Total users in DB: ${allUsers.length}`);

  // Test lookup by username
  for (const u of allUsers) {
    const trimmedIdentity = String(u.username || '').trim();
    const [found] = await db.select().from(users).where(
      and(
        isNull(users.deletedAt),
        or(
          ilike(users.username, trimmedIdentity),
          ilike(users.email, trimmedIdentity)
        )
      )
    );
    console.log(`User ID ${u.id} | Name "${u.name}" | Username "${u.username}" | Email "${u.email}" | Active: ${u.isActive} | Deleted: ${u.deletedAt} | Found: ${found ? 'YES' : 'NO'}`);
  }

  process.exit(0);
}

main();
