import { db } from '../src/db/db';
import { productionLines, userLines, users } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function debug() {
    console.log('--- DATABASE DIAGNOSTICS ---');
    try {
      const lines = await db.select().from(productionLines);
      console.log('Production Lines in DB:', lines.length);
      console.log('Lines Sample:', JSON.stringify(lines.slice(0, 3), null, 2));

      const assignments = await db.select().from(userLines);
      console.log('User Assignments in DB:', assignments.length);

      const operators = await db.select({ id: users.id, name: users.name, role: users.role }).from(users);
      console.log('Users Sample:', JSON.stringify(operators.slice(0, 3), null, 2));
    } catch (e) {
      console.error('Diagnostic error:', e);
    }
}

debug().catch(console.error);
