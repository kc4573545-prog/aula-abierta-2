const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const isProd = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[db] Falta la variable DATABASE_URL.');
}

// Render Postgres (URL interna) no exige SSL; la URL externa sí.
// DATABASE_SSL=true fuerza SSL; DATABASE_SSL=false lo desactiva.
function sslConfig() {
  const flag = (process.env.DATABASE_SSL || '').toLowerCase();
  if (flag === 'true') return { rejectUnauthorized: false };
  if (flag === 'false') return false;
  if (connectionString && /render\.com|sslmode=require/.test(connectionString)) {
    return { rejectUnauthorized: false };
  }
  return isProd ? { rejectUnauthorized: false } : false;
}

const pool = new Pool({
  connectionString,
  ssl: sslConfig(),
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => console.error('[db] Error inesperado en el pool:', err.message));

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

module.exports = { pool, migrate };
