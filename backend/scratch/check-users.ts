import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, userRoles, roles } from '../src/db/schema';
import { eq } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

async function check() {
    console.log('--- Users and Roles Check ---');
    const allUsers = await db.select().from(users);
    for (const user of allUsers) {
        console.log(`User: ${user.username} (${user.id})`);
        const uRoles = await db.select({
            slug: roles.slug
        })
        .from(roles)
        .innerJoin(userRoles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, user.id));
        
        console.log(`  Roles: ${uRoles.map(r => r.slug).join(', ')}`);
    }
    process.exit(0);
}

check();
