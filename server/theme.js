'use strict';
// Rediseño visual de Aula Abierta: se aplica al servir las páginas HTML.
// Solo cambia la presentación (colores de Tailwind, CSS y decoración); no toca
// formularios, scripts de la app, rutas, API ni base de datos.
const fs = require('fs');
const path = require('path');

const MAP = {
  '#000922': '#0b1f5c', '#0f2042': '#14307f', '#7988b0': '#c3d3ff', '#b6c6f1': '#b8c8f8', '#d9e2ff': '#dde6ff',
  '#006398': '#2a63c9', '#5bb8fe': '#7cc4f5', '#cce5ff': '#d4ecff', '#93ccff': '#9bd3fb', '#00476e': '#0e3f7a',
  '#004b73': '#1c4a8c', '#f7f9fb': '#f3f6ff', '#f2f4f6': '#eaf0ff', '#eceef0': '#e3eafc', '#e6e8ea': '#dce4fa',
  '#e0e3e5': '#d6def6', '#d8dadc': '#ccd5ee', '#4f5e83': '#4a5fa8', '#191c1e': '#14183a', '#45464e': '#484d78',
  '#75777f': '#7a80ab', '#c5c6cf': '#cfd5ee', '#6ffbbe': '#e4d9ff', '#4edea3': '#c9b6f7', '#002113': '#2a1660',
  '#005236': '#4b2fa0', '#000d06': '#2a1660', '#002718': '#3d2a85', '#009c6b': '#d6c8fb', '#081a3c': '#0b1f5c',
  '#37466a': '#2e4590', '#001d31': '#0b1f5c', '#2d3133': '#1f2550', '#eff1f3': '#eef1ff',
};
const EXTRA = '"gold": "#d4a62a", "gold-light": "#f6e3a1", "violet": "#7d6bd0", "violet-soft": "#ece6ff", "error": "';

function retheme(cfg) {
  let t = cfg.replace(/"([a-z0-9-]+)": "(#[0-9a-fA-F]{6})"/g, (_m, k, v) => `"${k}": "${MAP[v.toLowerCase()] || v}"`);
  t = t.replace('"error": "', EXTRA);
  return t.replace('"lg": "0.5rem", "xl": "0.75rem"', '"lg": "0.75rem", "xl": "1.25rem"');
}

function transform(html) {
  if (html.includes('aula-theme.css')) return html;
  let s = html.replace(/tailwind\.config = \{[\s\S]*?\}\s*\};?<\/script>|tailwind\.config = \{[\s\S]*?\n\}\s*<\/script>/, retheme);
  s = s.split('%236750A4').join('%237d6bd0').split('#000922').join('#0b1f5c');
  s = s.replace('</head>', '<link rel="stylesheet" href="aula-theme.css"/></head>');
  s = s.replace('</body>', '<script src="aula-theme.js" defer></script></body>');
  return s;
}

function themeMiddleware(publicDir) {
  const root = path.resolve(publicDir);
  const cache = new Map();
  return function theme(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    let p;
    try { p = decodeURIComponent(req.path || '/'); } catch { return next(); }
    if (p === '/' || p === '') p = '/index.html';
    else if (!path.extname(p)) p += '.html';
    else if (!p.endsWith('.html')) return next();
    const file = path.join(root, p);
    if (!file.startsWith(root + path.sep)) return next();
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) return next();
      const send = (html) => {
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.set('Cache-Control', 'no-cache');
        res.send(html);
      };
      const hit = cache.get(file);
      if (hit && hit.mtime === st.mtimeMs) return send(hit.html);
      fs.readFile(file, 'utf8', (e, raw) => {
        if (e) return next();
        const html = transform(raw);
        cache.set(file, { mtime: st.mtimeMs, html });
        send(html);
      });
    });
  };
}

module.exports = { transform, themeMiddleware };
