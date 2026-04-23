import 'dotenv/config';
import postgres from 'postgres';

async function migrate() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, ssl: { rejectUnauthorized: false } });
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS device_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        platform VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT now() NOT NULL
      );
    `;
    console.log('✅ device_tokens table ready.');
  } finally {
    await sql.end();
  }
}

migrate().catch(console.error);
