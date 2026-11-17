// Tareas de arranque: migración, administrador inicial y datos de ejemplo (una sola vez).
const bcrypt = require('bcryptjs');
const { pool, migrate } = require('./db');
const seedData = require('./seed-data.json');

async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) {
    const { rows } = await pool.query('SELECT 1 FROM admin_users LIMIT 1');
    if (!rows.length) console.warn('[bootstrap] ADMIN_EMAIL / ADMIN_PASSWORD no definidos: no hay ningún administrador.');
    return;
  }
  if (password.length < 8) throw new Error('ADMIN_PASSWORD debe tener al menos 8 caracteres.');
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO admin_users (email, password_hash) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [email, hash]
  );
  console.log(`[bootstrap] Administrador listo: ${email}`);
}

async function seedDemoData({ force = false } = {}) {
  const done = await pool.query("SELECT 1 FROM meta WHERE key = 'demo_seeded'");
  if (done.rows.length && !force) return false;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const a of seedData.articles) {
      await client.query(
        `INSERT INTO articles (id,title,summary,subject,grade,read_time,status,cover_image,cover_alt,author,role,
           views,content,tags,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,to_timestamp($15/1000.0))
         ON CONFLICT (id) DO NOTHING`,
        [a.id, a.title, a.summary, a.subject, a.grade, a.readTime, a.status, a.coverImage, a.coverAlt,
         a.author, a.role, a.views || 0, a.content, JSON.stringify(a.tags || []), a.createdAt]
      );
    }
    for (const c of seedData.comments) {
      await client.query(
        `INSERT INTO comments (id,article_id,author_name,author_type,author_badge,school_info,content,status,
           is_spam_alert,teacher_reply,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,to_timestamp($11/1000.0))
         ON CONFLICT (id) DO NOTHING`,
        [c.id, c.articleId, c.authorName, c.authorType, c.authorBadge || '', c.schoolInfo || '', c.content,
         c.status, !!c.isSpamAlert, c.teacherReply, c.createdAt]
      );
    }
    for (const m of seedData.media) {
      await client.query(
        `INSERT INTO media (id,title,category,url,size_kb,dimensions,alt_text,associated_article,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,to_timestamp($9/1000.0)) ON CONFLICT (id) DO NOTHING`,
        [m.id, m.title, m.category, m.url, m.sizeKB, m.dimensions, m.altText, m.associatedArticle, m.createdAt]
      );
    }
    const p = seedData.settings.find((s) => s.key === 'teacherProfile');
    if (p) {
      await client.query(
        `UPDATE teacher_profile SET name=$1,title=$2,role=$3,specialty=$4,school=$5,years_experience=$6,bio=$7,photo_url=$8
         WHERE id = 1`,
        [p.name, p.title, p.role, p.specialty, p.school, p.yearsExperience, p.bio, p.photoUrl || '']
      );
    }
    await client.query("INSERT INTO meta (key, value) VALUES ('demo_seeded', now()::text) ON CONFLICT (key) DO NOTHING");
    await client.query('COMMIT');
    console.log('[bootstrap] Datos de ejemplo cargados.');
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function bootstrap() {
  await migrate();
  await ensureAdmin();
  if ((process.env.SEED_DEMO_DATA || '').toLowerCase() === 'true') await seedDemoData();
}

module.exports = { bootstrap, seedDemoData, ensureAdmin };
