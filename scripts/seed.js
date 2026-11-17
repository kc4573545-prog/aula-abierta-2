// Carga los datos de ejemplo manualmente (npm run seed). Usa --force para repetirlo.
require('dotenv').config();
const { migrate, pool } = require('../server/db');
const { seedDemoData } = require('../server/bootstrap');
(async () => {
  await migrate();
  const did = await seedDemoData({ force: process.argv.includes('--force') });
  console.log(did ? 'Datos de ejemplo cargados.' : 'Ya se habían cargado (usa --force para repetir).');
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
