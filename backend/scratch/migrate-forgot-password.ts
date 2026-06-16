import { db } from '../src/database/db';
import { sql } from 'drizzle-orm';

async function runMigration() {
  try {
    console.log('Creating password_reset_tokens table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token_hash" varchar(255) NOT NULL,
        "expires_at" timestamp NOT NULL,
        "used_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
      
      CREATE INDEX IF NOT EXISTS "idx_pwd_reset_token_hash" ON "password_reset_tokens" ("token_hash");
      CREATE INDEX IF NOT EXISTS "idx_pwd_reset_user_id" ON "password_reset_tokens" ("user_id");
    `);
    console.log('Table password_reset_tokens created successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

runMigration();
