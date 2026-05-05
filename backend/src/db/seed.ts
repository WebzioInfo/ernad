import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
  users, userRoles, productionLines, shifts, productBrands, products, 
  rawMaterials, factories, roles, permissions, rolePermissions 
} from './schema';
import { eq, and, sql } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

async function seed() {
    console.log('🏗️ Starting MES Infrastructure Seed (Multi-Station Support)...');

    // 1. Seed Factory
    console.log('🏭 Establishing Factory Context...');
    let factoryId: string;
    const existingFactories = await db.select().from(factories).where(eq(factories.name, 'Nairobi Main Plant')).limit(1);
    
    if (existingFactories.length > 0) {
        factoryId = existingFactories[0].id;
    } else {
        const [newFactory] = await db.insert(factories).values({
            name: 'Nairobi Main Plant',
            location: 'Industrial Area, Nairobi',
            contactInfo: '+254 20 1234567'
        }).returning();
        factoryId = newFactory.id;
    }

    // 2. Seed Roles (Granular Operator Roles)
    console.log('🔐 Seeding Granular RBAC Matrix...');
    const rolesToSeed = [
        { slug: 'SUPER_ADMIN', name: 'Super Administrator' },
        { slug: 'ADMIN', name: 'System Administrator' },
        { slug: 'MANAGER', name: 'Production Manager' },
        { slug: 'OPERATOR_BLOWING', name: 'Blowing Operator' },
        { slug: 'OPERATOR_FILLING', name: 'Filling Operator' },
        { slug: 'OPERATOR_LABELING', name: 'Labeling/Batching Operator' },
        { slug: 'OPERATOR_PACKING', name: 'Packing Operator' },
        { slug: 'OPERATOR', name: 'Generic Operator' },
    ];

    for (const r of rolesToSeed) {
        await db.insert(roles).values(r).onConflictDoUpdate({
            target: roles.slug,
            set: { name: r.name }
        });
    }

    // 3. Seed Permissions
    console.log('🔑 Seeding Permissions Matrix...');
    const perms = [
        { slug: 'users:view', name: 'View Personnel', category: 'Personnel' },
        { slug: 'users:manage', name: 'Manage Personnel', category: 'Personnel' },
        { slug: 'production:start', name: 'Start/Manage Batches', category: 'Production' },
        { slug: 'production:close', name: 'Close/Complete Batches', category: 'Production' },
        { slug: 'telemetry:log', name: 'Log Telemetry Data', category: 'Production' },
        { slug: 'inventory:view', name: 'View Inventory', category: 'Inventory' },
        { slug: 'inventory:update', name: 'Update Inventory', category: 'Inventory' },
        { slug: 'settings:manage', name: 'Manage Factory Config', category: 'Master Data' },
        { slug: 'reports:view', name: 'View Reports', category: 'Analytics' },
        { slug: 'notifications:view', name: 'View Notifications', category: 'Communication' },
    ];

    for (const p of perms) {
        await db.insert(permissions).values(p).onConflictDoUpdate({
            target: permissions.slug,
            set: { name: p.name, category: p.category }
        });
    }

    // 4. Map Permissions to Roles
    console.log('🔗 Mapping Permissions to Roles...');
    const roleMapping: Record<string, string[]> = {
        'SUPER_ADMIN': perms.map(p => p.slug),
        'ADMIN': perms.map(p => p.slug),
        'MANAGER': [
            'users:view', 'users:manage', 
            'production:start', 'production:close', 
            'telemetry:log', 'inventory:view', 'inventory:update',
            'reports:view', 'notifications:view'
        ],
        'OPERATOR_BLOWING': ['production:start', 'telemetry:log', 'notifications:view'],
        'OPERATOR_FILLING': ['production:start', 'telemetry:log', 'notifications:view'],
        'OPERATOR_LABELING': ['production:start', 'telemetry:log', 'notifications:view'],
        'OPERATOR_PACKING': ['production:start', 'telemetry:log', 'notifications:view'],
        'OPERATOR': ['production:start', 'telemetry:log', 'notifications:view'],
    };

    for (const [roleSlug, permSlugs] of Object.entries(roleMapping)) {
        const [roleObj] = await db.select().from(roles).where(eq(roles.slug, roleSlug)).limit(1);
        if (!roleObj) continue;

        // Clear old mapping
        await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleObj.id));

        for (const pSlug of permSlugs) {
            const [pObj] = await db.select().from(permissions).where(eq(permissions.slug, pSlug)).limit(1);
            if (pObj) {
                await db.insert(rolePermissions).values({
                    roleId: roleObj.id,
                    permissionId: pObj.id
                }).onConflictDoNothing();
            }
        }
    }

    // 5. Seed Users with multi-station assignments
    console.log('👥 Seeding Specialized Personnel...');
    const hashedPass = await bcrypt.hash('password123', 10);
    const hashedPin = await bcrypt.hash('1234', 10);

    const personnel = [
        {
            username: 'sarah.chen',
            name: 'Sarah Chen',
            email: 's.chen@ernad.com',
            passwordHash: hashedPass,
            roles: ['SUPER_ADMIN'],
            factoryId: null
        },
        {
            username: 'marcus.admin',
            name: 'Marcus Rodriguez',
            email: 'm.rodriguez@ernad.com',
            passwordHash: hashedPass,
            roles: ['ADMIN'],
            factoryId
        },
        {
            username: 'david.blowing',
            name: 'David Kim',
            email: 'd.blowing@ernad.com',
            pinCode: hashedPin,
            roles: ['OPERATOR_BLOWING'],
            factoryId
        },
        {
            username: 'elena.multi',
            name: 'Elena Rossi',
            email: 'e.multi@ernad.com',
            pinCode: hashedPin,
            roles: ['OPERATOR_FILLING', 'OPERATOR_LABELING'], // Multi-station operator
            factoryId
        },
        {
            username: 'john.packing',
            name: 'John Doe',
            email: 'j.packing@ernad.com',
            pinCode: hashedPin,
            roles: ['OPERATOR_PACKING'],
            factoryId
        },
        {
            username: 'musa.manager',
            name: 'Musa Mwaniki',
            email: 'musa.manager@ernad.com',
            passwordHash: hashedPass,
            roles: ['MANAGER'],
            factoryId
        }
    ];

    for (const p of personnel) {
        const { roles: userRoleSlugs, ...userData } = p;
        const [userRecord] = await db.insert(users).values(userData).onConflictDoUpdate({
            target: users.username,
            set: userData
        }).returning();

        // Clear old roles for re-seed
        await db.delete(userRoles).where(eq(userRoles.userId, userRecord.id));

        for (const slug of userRoleSlugs) {
            const [roleRecord] = await db.select().from(roles).where(eq(roles.slug, slug)).limit(1);
            if (roleRecord) {
                await db.insert(userRoles).values({
                    userId: userRecord.id,
                    roleId: roleRecord.id
                }).onConflictDoNothing();
            }
        }
    }

    // 4. Seed Production Lines
    console.log('🏭 Seeding Production Lines...');
    const lines = [
        { name: 'Line 1', description: 'Primary High-Speed Line', status: 'IDLE', factoryId },
        { name: 'Line 2', description: 'Secondary Utility Line', status: 'IDLE', factoryId },
    ];

    for (const l of lines) {
        await db.insert(productionLines).values(l).onConflictDoUpdate({
            target: [productionLines.name, productionLines.factoryId],
            set: { description: l.description, status: l.status }
        });
    }

    console.log('✅ Multi-Station Seed Complete!');
    process.exit(0);
}

seed().catch(err => {
    console.error('❌ Seed Failed:', err);
    process.exit(1);
});
