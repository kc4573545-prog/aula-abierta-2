const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { wrap, plain } = require('../util');
const S = require('../serializers');

const router = express.Router();

router.get('/', wrap(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM teacher_profile WHERE id = 1');
  res.json(S.profile(rows[0]));
}));

router.put('/', requireAuth, wrap(async (req, res) => {
  const b = req.body;
  const { rows } = await pool.query(
    `UPDATE teacher_profile SET
       name = $1, title = $2, role = $3, specialty = $4, school = $5,
       years_experience = $6, bio = $7, photo_url = $8, updated_at = now()
     WHERE id = 1 RETURNING *`,
    [
      plain(b.name, 120) || 'Docente',
      plain(b.title, 20),
      plain(b.role, 120),
      plain(b.specialty, 160),
      plain(b.school, 160),
      Math.min(Math.max(parseInt(b.yearsExperience, 10) || 0, 0), 80),
      plain(b.bio, 400),
      String(b.photoUrl || '').slice(0, 3_000_000),
    ]
  );
  res.json(S.profile(rows[0]));
}));

module.exports = router;
