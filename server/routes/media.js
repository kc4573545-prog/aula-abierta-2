const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { wrap, newId, plain } = require('../util');
const S = require('../serializers');

const router = express.Router();
router.use(requireAuth);

router.get('/', wrap(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM media ORDER BY created_at DESC');
  res.json(rows.map(S.media));
}));

function clean(b) {
  return [
    plain(b.title, 200),
    plain(b.category, 60),
    String(b.url || '').slice(0, 3_000_000),
    Math.max(parseInt(b.sizeKB, 10) || 0, 0),
    plain(b.dimensions, 30),
    plain(b.altText, 300),
    plain(b.associatedArticle, 200),
  ];
}

router.post('/', wrap(async (req, res) => {
  const v = clean(req.body);
  if (!v[0] || !v[2]) return res.status(400).json({ error: 'Título y URL son obligatorios' });
  const { rows } = await pool.query(
    `INSERT INTO media (id, title, category, url, size_kb, dimensions, alt_text, associated_article)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [newId('media'), ...v]
  );
  res.status(201).json(S.media(rows[0]));
}));

router.put('/:id', wrap(async (req, res) => {
  const v = clean(req.body);
  const { rows } = await pool.query(
    `UPDATE media SET title=$2, category=$3, url=$4, size_kb=$5, dimensions=$6, alt_text=$7, associated_article=$8
     WHERE id = $1 RETURNING *`,
    [req.params.id, ...v]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Elemento no encontrado' });
  res.json(S.media(rows[0]));
}));

router.delete('/:id', wrap(async (req, res) => {
  const r = await pool.query('DELETE FROM media WHERE id = $1', [req.params.id]);
  r.rowCount ? res.json({ ok: true }) : res.status(404).json({ error: 'Elemento no encontrado' });
}));

module.exports = router;
