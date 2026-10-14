require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Ensures compatibility with cloud Postgres providers like Neon
  }
});

async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('Database connection successful! 🎉');
    console.log('Current database timestamp:', result.rows[0].now);
    client.release();
  } catch (err) {
    console.error('Database connection failed ❌:', err.message);
  } finally {
    await pool.end();
  }
}

testConnection();