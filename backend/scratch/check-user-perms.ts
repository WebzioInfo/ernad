import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, userRoles, roles, permissions, rolePermissions } from '../src/db/schema';
import { eq, or } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

async function check() {
    console.log('--- User Permissions Detailed Check ---');
    const allUsers = await db.select().from(users);
    for (const user of allUsers) {
        console.log(`User: ${user.username} (${user.id})`);
        
        const uRoles = await db.select({
            id: roles.id,
            slug: roles.slug
        })
        .from(roles)
        .innerJoin(userRoles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, user.id));
        
        console.log(`  Roles: ${uRoles.map(r => r.slug).join(', ')}`);
        
        if (uRoles.length > 0) {
            const perms = await db.select({
                slug: permissions.slug
            })
            .from(permissions)
            .innerJoin(rolePermissions, eq(rolePermissions.permissionId, permissions.id))
            .where(or(...uRoles.map(r => eq(rolePermissions.roleId, r.id))));
            
            console.log(`  Permissions: ${perms.map(p => p.slug).join(', ')}`);
        } else {
            console.log(`  Permissions: NONE`);
        }
    }
    process.exit(0);
}

check();
