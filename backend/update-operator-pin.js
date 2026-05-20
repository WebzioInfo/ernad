const postgres = require('postgres');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: 'd:/Webzio/ernad/backend/.env' });

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

async function run() {
  try {
    const hashed = await bcrypt.hash('1234', 10);
    console.log('Hashed PIN:', hashed);
    const result = await sql`
      UPDATE users 
      SET pin_code = ${hashed} 
      WHERE username = 'sujith.blower'
      RETURNING id, name, username, pin_code
    `;
    console.log('Updated user:', result);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}
run();
