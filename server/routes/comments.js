const express = require('express');
const rateLimit = require('express-rate-limit');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { wrap, newId, plain, looksLikeSpam } = require('../util');
const S = require('../serializers');

const router = express.Router();
const STATUSES = ['pending', 'approved', 'rejected', 'spam'];

const postLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Has enviado demasiados comentarios. Intenta de nuevo más tarde.' },
});

// Moderación: todos los comentarios (solo docente)
router.get('/', requireAuth, wrap(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM comments ORDER BY created_at DESC');
  res.json(rows.map(S.comment));
}));

// Envío público: siempre entra como "pending" y como visitante.
router.post('/', postLimiter, wrap(async (req, res) => {
  const articleId = String(req.body.articleId || '');
  const content = plain(req.body.content, 2000);
  const authorName = plain(req.body.authorName, 80) || 'Visitante';
  if (content.length < 2) return res.status(400).json({ error: 'El comentario está vacío' });

  const art = await pool.query(
    "SELECT allow_comments FROM articles WHERE id = $1 AND status = 'published'", [articleId]
  );
  if (!art.rows[0]) return res.status(404).json({ error: 'Artículo no encontrado' });
  if (!art.rows[0].allow_comments) return res.status(403).json({ error: 'Los comentarios están desactivados en este artículo' });

  const { rows } = await pool.query(
    `INSERT INTO comments (id, article_id, author_name, author_type, author_badge, school_info, content, status, is_spam_alert)
     VALUES ($1,$2,$3,'guest','Visitante','',$4,'pending',$5) RETURNING *`,
    [newId('comm'), articleId, authorName, content, looksLikeSpam(content)]
  );
  res.status(201).json(S.publicComment(rows[0]));
}));

// Moderar: cambiar estado y/o responder
router.patch('/:id', requireAuth, wrap(async (req, res) => {
  const sets = [];
  const params = [];
  if (req.body.status !== undefined) {
    if (!STATUSES.includes(req.body.status)) return res.status(400).json({ error: 'Estado inválido' });
    params.push(req.body.status); sets.push(`status = $${params.length}`);
  }
  if (req.body.teacherReply !== undefined) {
    params.push(req.body.teacherReply === null ? null : plain(req.body.teacherReply, 2000));
    sets.push(`teacher_reply = $${params.length}`);
  }
  if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });
  params.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE comments SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params
  );
  if (!rows[0]) return res.status(404).json({ error: 'Comentario no encontrado' });
  res.json(S.comment(rows[0]));
}));

router.delete('/:id', requireAuth, wrap(async (req, res) => {
  const r = await pool.query('DELETE FROM comments WHERE id = $1', [req.params.id]);
  r.rowCount ? res.json({ ok: true }) : res.status(404).json({ error: 'Comentario no encontrado' });
}));

module.exports = router;
