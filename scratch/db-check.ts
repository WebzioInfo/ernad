import { db } from './backend/src/database/db';
import { users, roles, userRoles } from './backend/src/database/schema';

async function check() {
  const allUsers = await db.select().from(users);
  console.log('--- USERS ---');
  console.table(allUsers.map(u => ({ id: u.id, username: u.username })));

  const allRoles = await db.select().from(roles);
  console.log('--- ROLES ---');
  console.table(allRoles);

  const relations = await db.select().from(userRoles);
  console.log('--- USER ROLES ---');
  console.table(relations);
}

check().catch(console.error);
