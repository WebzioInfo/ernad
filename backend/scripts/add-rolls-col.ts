import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  const sql = postgres(databaseUrl, {
    prepare: false,
    ssl: process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    console.log('Adding rolls_used column...');
    await sql.unsafe(`ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "rolls_used" integer DEFAULT 0;`);
    console.log('Column added successfully.');
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
