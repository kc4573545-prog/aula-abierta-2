const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { wrap, plain } = require('../util');
const S = require('../serializers');

const router = express.Router();

// La foto puede ser una URL http(s) o una imagen subida (data URL). Nada más.
const PHOTO_RE = /^(https?:\/\/\S+|data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+)$/i;

router.get('/', wrap(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM teacher_profile WHERE id = 1');
  res.json(S.profile(rows[0]));
}));

router.put('/', requireAuth, wrap(async (req, res) => {
  const b = req.body;
  const photo = String(b.photoUrl || '').trim();
  if (photo && (photo.length > 1_500_000 || !PHOTO_RE.test(photo))) {
    return res.status(400).json({ error: 'La foto debe ser una URL http(s) o una imagen válida (máx. ~1 MB)' });
  }
  const title = plain(b.title, 20);
  const name = S.stripTitle(plain(b.name, 120)) || 'Docente';
  const role = plain(b.role, 120);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const prev = (await client.query('SELECT name, title FROM teacher_profile WHERE id = 1 FOR UPDATE')).rows[0];

    const { rows } = await client.query(
      `UPDATE teacher_profile SET
         name = $1, title = $2, role = $3, specialty = $4, school = $5,
         years_experience = $6, bio = $7, photo_url = $8, updated_at = now()
       WHERE id = 1 RETURNING *`,
      [name, title, role, plain(b.specialty, 160), plain(b.school, 160),
       Math.min(Math.max(parseInt(b.yearsExperience, 10) || 0, 0), 80), plain(b.bio, 400), photo]
    );

    // Los artículos publicados con el nombre anterior del docente pasan a mostrar el nuevo.
    // (No se tocan los artículos de otros autores.)
    const oldPlain = S.stripTitle(prev.name);
    const oldNames = [...new Set([prev.name, oldPlain, prev.title ? `${prev.title} ${oldPlain}` : oldPlain])].filter(Boolean);
    await client.query('UPDATE articles SET author = $1, role = $2 WHERE author = ANY($3::text[])', [name, role, oldNames]);

    await client.query('COMMIT');
    res.json(S.profile(rows[0]));
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

module.exports = router;
