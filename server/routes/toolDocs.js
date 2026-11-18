'use strict';
// Documentos de las herramientas docentes (rúbricas, calificaciones, cuestionarios, contabilidad). Privados por docente.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const express = require('express'), sanitizeHtml = require('sanitize-html');
const { pool } = require('../db'); const { requireAuth } = require('../middleware/auth');
const router = express.Router();
const TOOLS = ['rubrica', 'calificaciones', 'cuestionario', 'contabilidad'];
const txt = (v, max = 5000) => sanitizeHtml(String(v), { allowedTags: [], allowedAttributes: {} })
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").slice(0, max);
// Sanea recursivamente: solo texto plano, números, booleanos, listas y objetos de tamaño limitado.
function deep(v, d = 0) {
  if (d > 7 || v == null) return null;
  if (typeof v === 'string') return txt(v);
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.slice(0, 500).map((x) => deep(x, d + 1));
  if (typeof v === 'object') { const o = {}; Object.keys(v).slice(0, 80).forEach((k) => { o[txt(k, 60)] = deep(v[k], d + 1); }); return o; }
  return null;
}
function clean(b = {}) {
  const content = deep(b.content && typeof b.content === 'object' ? b.content : {}) || {};
  if (JSON.stringify(content).length > 400000) { const e = new Error('Documento demasiado grande'); e.status = 413; throw e; }
  return { title: txt(b.title || '', 200).trim(), content };
}
const owner = (req) => String(req.user.sub ?? req.user.id ?? req.user.email ?? 'docente');
const out = (r) => ({ id: r.id, tool: r.tool, title: r.title, content: r.content, created_at: r.created_at, updated_at: r.updated_at });
const fail = (e, res, next) => (e.status ? res.status(e.status).json({ error: e.message }) : next(e));
router.use(requireAuth);
router.get('/', async (req, res, next) => {
  try {
    if (!TOOLS.includes(req.query.tool)) return res.status(400).json({ error: 'Herramienta no válida' });
    const { rows } = await pool.query('SELECT id, tool, title, updated_at FROM tool_docs WHERE owner_id=$1 AND tool=$2 ORDER BY updated_at DESC LIMIT 500', [owner(req), req.query.tool]);
    res.json(rows);
  } catch (e) { next(e); }
});
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tool_docs WHERE id=$1 AND owner_id=$2', [req.params.id, owner(req)]);
    if (!rows[0]) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json(out(rows[0]));
  } catch (e) { next(e); }
});
router.post('/', async (req, res, next) => {
  try {
    if (!TOOLS.includes(req.body && req.body.tool)) return res.status(400).json({ error: 'Herramienta no válida' });
    const d = clean(req.body);
    const { rows } = await pool.query('INSERT INTO tool_docs (id, owner_id, tool, title, content) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [crypto.randomUUID(), owner(req), req.body.tool, d.title, JSON.stringify(d.content)]);
    res.status(201).json(out(rows[0]));
  } catch (e) { fail(e, res, next); }
});
router.put('/:id', async (req, res, next) => {
  try {
    const d = clean(req.body);
    const { rows } = await pool.query('UPDATE tool_docs SET title=$3, content=$4, updated_at=now() WHERE id=$1 AND owner_id=$2 RETURNING *',
      [req.params.id, owner(req), d.title, JSON.stringify(d.content)]);
    if (!rows[0]) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json(out(rows[0]));
  } catch (e) { fail(e, res, next); }
});
router.delete('/:id', async (req, res, next) => {
  try {
    const r = await pool.query('DELETE FROM tool_docs WHERE id=$1 AND owner_id=$2', [req.params.id, owner(req)]);
    if (!r.rowCount) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
router.ensureSchema = () => pool.query(fs.readFileSync(path.join(__dirname, '..', 'tool-docs.sql'), 'utf8'));
router.deep = deep; router.TOOLS = TOOLS;
module.exports = router;
