const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');

let pool;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL.includes('sslmode=require') 
      ? { rejectUnauthorized: false } 
      : false,
  });
} else {
  pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'shopyaro',
  });
}

// Function to initialize tables and verify connection
async function initDB() {
  try {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL successfully.');

    // Auto-create users table if not exists
    const createUsersTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'customer',
        phone VARCHAR(50),
        address TEXT,
        city VARCHAR(100),
        zip_code VARCHAR(50),
        country VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
    `;

    await client.query(createUsersTableQuery);
    client.release();
    console.log('PostgreSQL "users" table verified/created.');
  } catch (err) {
    console.error('PostgreSQL connection warning/error:', err.message);
    console.warn('Tip: Please ensure PostgreSQL is running and check your credentials in server/.env');
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  initDB,
};
