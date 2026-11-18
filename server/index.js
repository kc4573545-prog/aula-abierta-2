require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { pool } = require('./db');
const { bootstrap } = require('./bootstrap');
const { themeMiddleware } = require('./theme');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1); // Render está detrás de un proxy (necesario para rate-limit por IP)
// CSP desactivada porque el frontend usa Tailwind CDN, scripts inline y fuentes de Google.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// Mismo origen por defecto (el frontend lo sirve este mismo servidor).
// CORS_ORIGIN permite habilitar un dominio externo, p. ej. un frontend en otro host.
if (process.env.CORS_ORIGIN) {
  app.use('/api', cors({ origin: process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) }));
}

app.use(express.json({ limit: '8mb' })); // portadas/fotos pueden venir como data URL

// ── API ──
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'db_unavailable' });
  }
});
app.use('/api/auth', require('./routes/auth'));
app.use('/api/articles', require('./routes/articles'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/media', require('./routes/media'));
app.use('/api/profile', require('./routes/profile'));
const lessonPlans = require('./routes/lessonPlans'); // Centro de Herramientas Docentes
app.use('/api/lesson-plans', lessonPlans);
const toolDocs = require('./routes/toolDocs');
app.use('/api/tool-docs', toolDocs);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// ── Frontend estático ──
const publicDir = path.join(__dirname, '..', 'public');
// Rediseño visual: las páginas HTML se sirven con el tema aplicado (solo presentación).
const themed = themeMiddleware(publicDir);
app.use(themed);
app.use(express.static(publicDir, { extensions: ['html'], maxAge: '1h' }));
app.get('*', (req, res) => {
  req.url = '/';
  themed(req, res, () => res.sendFile(path.join(publicDir, 'index.html')));
});

// ── Errores ──
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'El contenido es demasiado grande' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  console.error('[error]', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

bootstrap()
  .then(() => lessonPlans.ensureSchema())
  .then(() => toolDocs.ensureSchema())
  .then(() => app.listen(PORT, () => console.log(`Aula Abierta escuchando en el puerto ${PORT}`)))
  .catch((e) => {
    console.error('[bootstrap] Falló el arranque:', e);
    process.exit(1);
  });
