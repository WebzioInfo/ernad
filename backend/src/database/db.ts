import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from './env';

/**
 * Senior Architect Strategy:
 * 1. Use 'postgres' (postgres.js) as it's more efficient for serverless/Supabase.
 * 2. Set 'prepare: false' to ensure compatibility with Supavisor in transaction mode (port 6543).
 * 3. Use 'DATABASE_URL' (Pooler) validated via Zod.
 */

const isProduction = process.env.NODE_ENV === 'production';

const client = postgres(env.DATABASE_URL, { 
    prepare: false,
    ssl: isProduction ? { rejectUnauthorized: false } : (process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false),
    max: isProduction ? 10 : 5, // Prevent single-query blockage in dev
    idle_timeout: 20,
    connect_timeout: 10,
});

export const db = drizzle(client, { schema });
export type DbClient = typeof db;
