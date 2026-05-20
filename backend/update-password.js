const postgres = require('postgres');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: __dirname + '/.env' });

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

async function run() {
  try {
    const hashed = await bcrypt.hash('adminadmin', 10);
    console.log('Hashed password:', hashed);
    const result = await sql`
      UPDATE users 
      SET password_hash = ${hashed} 
      WHERE username = 'pranesh.manager'
      RETURNING id, name, username
    `;
    console.log('Updated user:', result);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}
run();
