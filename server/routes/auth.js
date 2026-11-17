const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { pool } = require('../db');
const { sign, requireAuth } = require('../middleware/auth');
const { wrap } = require('../util');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intenta de nuevo en unos minutos.' },
});

router.post('/login', loginLimiter, wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });

  const { rows } = await pool.query('SELECT id, email, password_hash FROM admin_users WHERE email = $1', [email]);
  const user = rows[0];
  // Comparación siempre (aunque no exista el usuario) para no filtrar qué correos existen
  const hash = user ? user.password_hash : '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const ok = await bcrypt.compare(password, hash);
  if (!user || !ok) return res.status(401).json({ error: 'Credenciales incorrectas' });

  const token = sign({ sub: user.id, email: user.email, role: 'admin' }, !!req.body.remember);
  res.json({ token, user: { email: user.email } });
}));

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: { email: req.user.email } });
});

module.exports = router;
