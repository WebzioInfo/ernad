const postgres = require('postgres');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: 'd:/Webzio/ernad/backend/.env' });

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

async function run() {
  try {
    const hashed = await bcrypt.hash('adminadmin', 10);
    console.log('Hashed password:', hashed);
    const result = await sql`
      UPDATE users 
      SET password_hash = ${hashed} 
      WHERE id = '6f7f4e37-045b-466b-80d8-d58aeacd70c7'
      RETURNING id, name, username, password_hash
    `;
    console.log('Updated user:', result);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}
run();
