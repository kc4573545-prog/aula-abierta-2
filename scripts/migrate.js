require('dotenv').config();
const { migrate, pool } = require('../server/db');
migrate().then(() => { console.log('Migración aplicada.'); return pool.end(); })
  .catch((e) => { console.error(e); process.exit(1); });
