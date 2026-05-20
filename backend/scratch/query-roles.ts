import { db } from '../src/database/db';
import { roles } from '../src/database/schema';

async function run() {
  try {
    const allRoles = await db.select().from(roles);
    console.log('Roles in database:');
    console.log(JSON.stringify(allRoles, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
