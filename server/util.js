const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html');

// Envuelve handlers async para enviar los errores al middleware de errores
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const newId = (prefix) => `${prefix}-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;

// Texto plano: elimina cualquier etiqueta HTML
const plain = (s, max = 500) =>
  sanitizeHtml(String(s ?? ''), { allowedTags: [], allowedAttributes: {} }).trim().slice(0, max);

// HTML enriquecido del cuerpo del artículo (solo lo escribe el docente autenticado,
// aun así se sanea: sin scripts, iframes ni manejadores de eventos).
const RICH_TAGS = sanitizeHtml.defaults.allowedTags.concat([
  'img', 'h1', 'h2', 'h3', 'h4', 'figure', 'figcaption', 'u', 'mark', 'cite', 'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);
const richHtml = (html) =>
  sanitizeHtml(String(html ?? ''), {
    allowedTags: RICH_TAGS,
    allowedAttributes: {
      '*': ['style', 'class'],
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    allowedStyles: undefined,
  });

const SPAM_RE = /(https?:\/\/|hxxps?:\/\/|www\.)|\b(gratis|ganen puntos|casino|apuestas|viagra)\b/i;
const looksLikeSpam = (text) => SPAM_RE.test(text);

module.exports = { wrap, newId, plain, richHtml, looksLikeSpam };
