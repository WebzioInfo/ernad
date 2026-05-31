import 'dotenv/config';
import postgres from 'postgres';

const CONFIRMATION = 'KEEP_USERS_PRODUCTS_RAW_MATERIALS';

const preservedTables = [
  'permissions',
  'product_brands',
  'products',
  'raw_materials',
  'material_categories',
  'role_permissions',
  'roles',
  'user_roles',
  'users',
];

async function main() {
  if (process.env.CONFIRM_CLEAN_DB !== CONFIRMATION) {
    throw new Error(`Refusing to clean database. Set CONFIRM_CLEAN_DB=${CONFIRMATION} to continue.`);
  }

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
    const rows = await sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
        and table_name != all(${preservedTables})
      order by table_name
    ` as Array<{ table_name: string }>;

    if (rows.length === 0) {
      console.log('No non-preserved tables found.');
      return;
    }

    const tableNames = rows.map((row) => row.table_name);
    console.log(`Cleaning ${tableNames.length} tables: ${tableNames.join(', ')}`);

    await sql.begin(async (tx) => {
      await tx.unsafe(
        `truncate table ${tableNames.map((name) => `"public"."${name.replace(/"/g, '""')}"`).join(', ')} restart identity cascade`
      );
    });

    console.log(`Database cleaned. Preserved tables: ${preservedTables.join(', ')}`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
