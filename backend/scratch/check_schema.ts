import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.DATABASE_URL || '';

async function check() {
    const sql = postgres(url, { ssl: { rejectUnauthorized: false } });
    const qcColumns = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'quality_checks'
    `;
    console.log('Quality Checks Columns:');
    console.table(qcColumns);

    process.exit(0);
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
