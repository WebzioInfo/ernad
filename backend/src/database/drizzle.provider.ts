import { db } from './db';

// Re-export the optimized db instance for backward compatibility and NestJS providers
export { db };
export const DRIZZLE_PROVIDER = 'DRIZZLE_PROVIDER';

export const drizzleProvider = {
  provide: DRIZZLE_PROVIDER,
  useValue: db,
};
