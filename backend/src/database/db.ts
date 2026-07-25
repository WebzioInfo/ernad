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
const useSSL = env.DATABASE_URL.includes('sslmode=require') || 
               env.DATABASE_URL.includes('pooler.supabase.com') || 
               env.DATABASE_URL.includes('supabase.co');

const client = postgres(env.DATABASE_URL, { 
    prepare: false,
    ssl: useSSL ? { rejectUnauthorized: false } : undefined,
    max: isProduction ? 15 : 30, // Optimized for serverless Vercel limits
    idle_timeout: 10,
    connect_timeout: 10,
    max_lifetime: 60 * 5, // 5 minutes to prevent zombie connections in Vercel
});

export const db = drizzle(client, { schema });
export type DbClient = typeof db;
