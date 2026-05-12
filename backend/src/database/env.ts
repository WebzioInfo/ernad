import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(16),
  PORT: z.string().default('4000'),
  FRONTEND_URL: z.string().default('https://ernad.vercel.app'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('⚠️ [CRITICAL_ENV_WARNING] Invalid environment variables detected. The system may fail at runtime:');
  console.error(JSON.stringify(_env.error.format(), null, 2));
  // DO NOT process.exit(1) on Vercel - let the app try to start and report real errors
}

export const env = _env.data || (process.env as any);
