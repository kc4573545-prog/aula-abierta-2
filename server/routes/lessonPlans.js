'use strict';
// Planificador de clases: CRUD privado del docente autenticado. No toca ninguna tabla existente.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const sanitizeHtml = require('sanitize-html');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const TYPES = ['diaria', 'semanal', 'unidad'];
const STATUS = ['borrador', 'final'];
const TEXT_FIELDS = ['school', 'teacher', 'period', 'situacion', 'competencias', 'resultados', 'indicadores',
  'contenidos', 'estrategias', 'recursos', 'tecnicas', 'instrumentos', 'evaluacion', 'observaciones'];
const MOMENTS = ['inicio', 'desarrollo', 'cierre'];

// Texto plano: quita etiquetas y deja los símbolos tal cual (la página los muestra con textContent).
function txt(v, max = 4000) {
  const s = sanitizeHtml(String(v ?? ''), { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return s.trim().slice(0, max);
}
const mins = (v) => Math.max(0, Math.min(1000, parseInt(v, 10) || 0));

function clean(body = {}) {
  const c = {};
  const src = body.content && typeof body.content === 'object' ? body.content : {};
  TEXT_FIELDS.forEach((k) => { c[k] = txt(src[k], ['school', 'teacher', 'period'].includes(k) ? 200 : 4000); });
  c.momentos = {};
  MOMENTS.forEach((m) => {
    const x = (src.momentos && src.momentos[m]) || {};
    c.momentos[m] = { minutos: mins(x.minutos), actividades: txt(x.actividades, 6000) };
  });
  const sum = MOMENTS.reduce((a, m) => a + c.momentos[m].minutos, 0);
  return {
    plan_type: TYPES.includes(body.plan_type) ? body.plan_type : 'diaria',
    status: STATUS.includes(body.status) ? body.status : 'borrador',
    title: txt(body.title, 200),
    subject: txt(body.subject, 120),
    grade: txt(body.grade, 80),
    total_minutes: mins(body.total_minutes) || sum,
    content: c,
  };
}

const owner = (req) => String(req.user.sub ?? req.user.id ?? req.user.email ?? 'docente');
const row = (r) => ({ id: r.id, plan_type: r.plan_type, status: r.status, title: r.title, subject: r.subject,
  grade: r.grade, total_minutes: r.total_minutes, content: r.content, created_at: r.created_at, updated_at: r.updated_at });

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, plan_type, status, title, subject, grade, total_minutes, content->>'period' AS period, updated_at
         FROM lesson_plans WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT 500`, [owner(req)]);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM lesson_plans WHERE id = $1 AND owner_id = $2', [req.params.id, owner(req)]);
    if (!rows[0]) return res.status(404).json({ error: 'Planificación no encontrada' });
    res.json(row(rows[0]));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const d = clean(req.body);
    const { rows } = await pool.query(
      `INSERT INTO lesson_plans (id, owner_id, plan_type, status, title, subject, grade, total_minutes, content)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [crypto.randomUUID(), owner(req), d.plan_type, d.status, d.title, d.subject, d.grade, d.total_minutes, JSON.stringify(d.content)]);
    res.status(201).json(row(rows[0]));
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const d = clean(req.body);
    const { rows } = await pool.query(
      `UPDATE lesson_plans SET plan_type=$3, status=$4, title=$5, subject=$6, grade=$7, total_minutes=$8,
              content=$9, updated_at=now() WHERE id=$1 AND owner_id=$2 RETURNING *`,
      [req.params.id, owner(req), d.plan_type, d.status, d.title, d.subject, d.grade, d.total_minutes, JSON.stringify(d.content)]);
    if (!rows[0]) return res.status(404).json({ error: 'Planificación no encontrada' });
    res.json(row(rows[0]));
  } catch (e) { next(e); }
});

router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `INSERT INTO lesson_plans (id, owner_id, plan_type, status, title, subject, grade, total_minutes, content)
       SELECT $3, owner_id, plan_type, 'borrador', left('Copia de ' || title, 200), subject, grade, total_minutes, content
         FROM lesson_plans WHERE id=$1 AND owner_id=$2 RETURNING *`,
      [req.params.id, owner(req), crypto.randomUUID()]);
    if (!rows[0]) return res.status(404).json({ error: 'Planificación no encontrada' });
    res.status(201).json(row(rows[0]));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await pool.query('DELETE FROM lesson_plans WHERE id=$1 AND owner_id=$2', [req.params.id, owner(req)]);
    if (!r.rowCount) return res.status(404).json({ error: 'Planificación no encontrada' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Crea la tabla si hace falta (idempotente). Se llama una vez al arrancar el servidor.
router.ensureSchema = () => pool.query(fs.readFileSync(path.join(__dirname, '..', 'lesson-plans.sql'), 'utf8'));
router.clean = clean;
module.exports = router;
