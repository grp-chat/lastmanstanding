// db-sql.js
const { Pool } = require('pg');
require('dotenv').config();

// Initialize the connection pool using your Neon connection string from .env
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for secure Neon connections
    },
    idleTimeoutMillis: 10000,      // Proactively close idle connections after 10 seconds to prevent proxy drops
    connectionTimeoutMillis: 5000, // Return an error after 5s if connection cannot be established
});

// CRITICAL: Prevent pool crashes when Neon resets or drops TCP sockets
pool.on('error', (err, client) => {
    console.error('⚠️ Database pool socket reset caught automatically:', err.message);
});

async function initDB() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS players (
                name VARCHAR(100) PRIMARY KEY,
                life INTEGER DEFAULT 10,
                icon VARCHAR(50) DEFAULT '❤️',
                target NUMERIC(10, 3) DEFAULT 0.000,
                bonus INTEGER DEFAULT 0
            );
        `);
        console.log('✅ Players table verified/created successfully.');

    } catch (err) {
        console.error('❌ Database initialization error:', err);
    } finally {
        client.release();
    }
}

module.exports = { pool, initDB };