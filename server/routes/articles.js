const express = require('express');
const { pool } = require('../db');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { wrap, newId, plain, richHtml } = require('../util');
const S = require('../serializers');

const router = express.Router();
const STATUSES = ['published', 'draft', 'scheduled', 'trash'];

// Normaliza y valida el cuerpo recibido del editor
function clean(body) {
  const status = STATUSES.includes(body.status) ? body.status : 'draft';
  const tags = Array.isArray(body.tags)
    ? body.tags.map((t) => plain(t, 40)).filter(Boolean).slice(0, 15)
    : [];
  return {
    title: plain(body.title, 200),
    summary: plain(body.summary, 600),
    subject: plain(body.subject, 80),
    grade: plain(body.grade, 80),
    read_time: Math.min(Math.max(parseInt(body.readTime, 10) || 5, 1), 600),
    status,
    cover_image: String(body.coverImage || '').slice(0, 3_000_000),
    cover_alt: plain(body.coverAlt, 300),
    author: plain(body.author, 120),
    role: plain(body.role, 120),
    content: richHtml(body.content),
    tags: JSON.stringify(tags),
    allow_comments: body.allowComments !== false,
    featured: !!body.featured,
  };
}

// Listado: visitantes solo ven publicados; el docente autenticado ve todo
router.get('/', optionalAuth, wrap(async (req, res) => {
  const isAdmin = !!req.user;
  const params = [];
  let where = '';
  if (!isAdmin) {
    where = "WHERE status = 'published'";
  } else if (req.query.status && STATUSES.includes(req.query.status)) {
    params.push(req.query.status);
    where = 'WHERE status = $1';
  }
  const { rows } = await pool.query(`SELECT * FROM articles ${where} ORDER BY created_at DESC`, params);
  res.json(rows.map(S.article));
}));

router.get('/:id', optionalAuth, wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM articles WHERE id = $1', [req.params.id]);
  const a = rows[0];
  if (!a || (a.status !== 'published' && !req.user)) return res.status(404).json({ error: 'Artículo no encontrado' });
  res.json(S.article(a));
}));

// Comentarios aprobados de un artículo (públicos). Con sesión y ?all=1 se devuelven todos.
router.get('/:id/comments', optionalAuth, wrap(async (req, res) => {
  const all = !!req.user && req.query.all === '1';
  const { rows } = await pool.query(
    `SELECT * FROM comments WHERE article_id = $1 ${all ? '' : "AND status = 'approved'"} ORDER BY created_at DESC`,
    [req.params.id]
  );
  res.json(rows.map(all ? S.comment : S.publicComment));
}));

// Contador de vistas (público, atómico, solo artículos publicados)
router.post('/:id/view', wrap(async (req, res) => {
  const { rows } = await pool.query(
    "UPDATE articles SET views = views + 1 WHERE id = $1 AND status = 'published' RETURNING views",
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Artículo no encontrado' });
  res.json({ views: rows[0].views });
}));

// Crear
router.post('/', requireAuth, wrap(async (req, res) => {
  const d = clean(req.body);
  if (!d.title) return res.status(400).json({ error: 'El título es obligatorio' });
  const id = newId('art');
  const { rows } = await pool.query(
    `INSERT INTO articles (id, title, summary, subject, grade, read_time, status, cover_image, cover_alt,
       author, role, content, tags, allow_comments, featured)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15) RETURNING *`,
    [id, d.title, d.summary, d.subject, d.grade, d.read_time, d.status, d.cover_image, d.cover_alt,
     d.author, d.role, d.content, d.tags, d.allow_comments, d.featured]
  );
  res.status(201).json(S.article(rows[0]));
}));

// Actualizar (o crear con id conocido, útil para el autoguardado del editor)
router.put('/:id', requireAuth, wrap(async (req, res) => {
  const d = clean(req.body);
  if (!d.title && !d.content) return res.status(400).json({ error: 'El artículo está vacío' });
  const { rows } = await pool.query(
    `INSERT INTO articles (id, title, summary, subject, grade, read_time, status, cover_image, cover_alt,
       author, role, content, tags, allow_comments, featured)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15)
     ON CONFLICT (id) DO UPDATE SET
       title=EXCLUDED.title, summary=EXCLUDED.summary, subject=EXCLUDED.subject, grade=EXCLUDED.grade,
       read_time=EXCLUDED.read_time, status=EXCLUDED.status, cover_image=EXCLUDED.cover_image,
       cover_alt=EXCLUDED.cover_alt, author=EXCLUDED.author, role=EXCLUDED.role, content=EXCLUDED.content,
       tags=EXCLUDED.tags, allow_comments=EXCLUDED.allow_comments, featured=EXCLUDED.featured,
       updated_at=now()
     RETURNING *`,
    [req.params.id, d.title || 'Sin título', d.summary, d.subject, d.grade, d.read_time, d.status,
     d.cover_image, d.cover_alt, d.author, d.role, d.content, d.tags, d.allow_comments, d.featured]
  );
  res.json(S.article(rows[0]));
}));

// Mover a la papelera (borrado lógico)
router.delete('/:id', requireAuth, wrap(async (req, res) => {
  if (req.query.permanent === 'true') {
    const r = await pool.query('DELETE FROM articles WHERE id = $1', [req.params.id]);
    return r.rowCount ? res.json({ ok: true }) : res.status(404).json({ error: 'Artículo no encontrado' });
  }
  const { rows } = await pool.query(
    `UPDATE articles SET previous_status = status, status = 'trash', trashed_at = now(), updated_at = now()
     WHERE id = $1 AND status <> 'trash' RETURNING *`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Artículo no encontrado' });
  res.json({ ok: true });
}));

router.post('/:id/restore', requireAuth, wrap(async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE articles SET status = COALESCE(previous_status, 'draft'), previous_status = NULL,
       trashed_at = NULL, updated_at = now()
     WHERE id = $1 AND status = 'trash' RETURNING *`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Artículo no encontrado en la papelera' });
  res.json(S.article(rows[0]));
}));

module.exports = router;
