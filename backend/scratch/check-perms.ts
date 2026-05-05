import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { roles, permissions, rolePermissions } from '../src/db/schema';
import { eq } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

async function check() {
    console.log('--- Roles and Permissions Check ---');
    const allRoles = await db.select().from(roles);
    for (const role of allRoles) {
        console.log(`Role: ${role.slug} (${role.id})`);
        const perms = await db.select({
            slug: permissions.slug
        })
        .from(permissions)
        .innerJoin(rolePermissions, eq(rolePermissions.permissionId, permissions.id))
        .where(eq(rolePermissions.roleId, role.id));
        
        console.log(`  Permissions: ${perms.map(p => p.slug).join(', ')}`);
    }
    process.exit(0);
}

check();
