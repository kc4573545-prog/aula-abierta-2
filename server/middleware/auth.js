const jwt = require('jsonwebtoken');

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error('JWT_SECRET no está configurado (mínimo 16 caracteres).');
  }
  return s;
}

function sign(payload, remember) {
  return jwt.sign(payload, secret(), { expiresIn: remember ? '30d' : '12h' });
}

function readToken(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

// Si hay un token válido, rellena req.user; si no, continúa como visitante.
function optionalAuth(req, _res, next) {
  const token = readToken(req);
  if (token) {
    try { req.user = jwt.verify(token, secret()); } catch { /* visitante */ }
  }
  next();
}

function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    req.user = jwt.verify(token, secret());
    next();
  } catch {
    res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

module.exports = { sign, optionalAuth, requireAuth };
