const postgres = require('postgres');
async function run() {
  const sql = postgres('postgresql://postgres:postgres@localhost:5432/postgres', {prepare:false});
  try {
    await sql`CREATE DATABASE ernad`;
    console.log('Created ernad database');
  } catch (e) {
    console.error(e.message);
  } finally {
    await sql.end();
  }
}
run();
