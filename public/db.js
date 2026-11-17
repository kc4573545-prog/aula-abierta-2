/**
 * AULA ABIERTA — Mi Blog Docente
 * db.js — Cliente de la API REST (reemplaza al almacenamiento local IndexedDB).
 *
 * Mantiene la MISMA interfaz que la versión anterior (window.AulaAbiertaDB), de modo que
 * las páginas no necesitan cambios: ahora los datos viven en PostgreSQL vía Express.
 *
 * - Páginas públicas: solo lectura de contenido publicado + envío de comentarios.
 * - Páginas de administración: requieren sesión (token JWT); sin ella redirigen al login.
 */
(function () {
  'use strict';

  const API = (window.AULA_API_BASE || '') + '/api';
  const TOKEN_KEY = 'aa_token';
  const ADMIN_PAGES = ['panel', 'gestion', 'editor', 'biblioteca', 'moderacion', 'perfil'];

  const currentPage = () => {
    const f = location.pathname.split('/').pop() || 'index.html';
    return f.replace(/\.html$/, '') || 'index';
  };
  const isAdminPage = () => ADMIN_PAGES.includes(currentPage());

  // ── Sesión ──
  const Auth = {
    getToken() {
      try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null; }
      catch (e) { return null; }
    },
    setToken(token, remember) {
      this.clear();
      try { (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token); } catch (e) { /* modo privado */ }
    },
    clear() {
      try { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* noop */ }
    },
    redirectToLogin() {
      const next = encodeURIComponent(currentPage() + '.html' + location.search);
      location.replace('admin-login.html?next=' + next);
    },
  };

  // Guardia: las páginas de administración exigen sesión
  if (isAdminPage() && !Auth.getToken()) Auth.redirectToLogin();

  async function request(method, path, body, opts) {
    opts = opts || {};
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    // En páginas públicas no se envía el token (para ver exactamente lo que ve un visitante),
    // salvo que se pida explícitamente (p. ej. vista previa de un borrador).
    const token = Auth.getToken();
    if (token && (isAdminPage() || opts.auth)) headers.Authorization = 'Bearer ' + token;

    let res;
    try {
      res = await fetch(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch (e) {
      throw new Error('No se pudo conectar con el servidor');
    }
    if (res.status === 401 && token && !opts.noRedirect) {
      Auth.clear();
      if (isAdminPage()) Auth.redirectToLogin();
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* sin cuerpo */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || 'Error ' + res.status);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  const STORE_PATHS = { articles: '/articles', comments: '/comments', media: '/media' };

  class StorageService {
    constructor() {
      // Compatibilidad: las páginas hacen `await AulaAbiertaDB._initPromise`
      this._initPromise = Promise.resolve();
    }

    // ── Autenticación ──
    async login(email, password, remember) {
      const data = await request('POST', '/auth/login', { email, password, remember: !!remember }, { noRedirect: true });
      Auth.setToken(data.token, remember);
      return data.user;
    }
    logout() { Auth.clear(); location.href = 'admin-login.html'; }
    isLoggedIn() { return !!Auth.getToken(); }

    // ── CRUD genérico (compatibilidad con la API anterior) ──
    async getAll(storeName) {
      const path = STORE_PATHS[storeName];
      if (!path) {
        if (storeName === 'settings') return [await this.getTeacherProfile()];
        throw new Error('Colección desconocida: ' + storeName);
      }
      return request('GET', path);
    }
    async get(storeName, key) {
      if (storeName === 'settings' && key === 'teacherProfile') return this.getTeacherProfile();
      const path = STORE_PATHS[storeName];
      if (!path) throw new Error('Colección desconocida: ' + storeName);
      try { return await request('GET', path + '/' + encodeURIComponent(key), undefined, { auth: true }); }
      catch (e) { if (e.status === 404) return null; throw e; }
    }
    async count(storeName) { return (await this.getAll(storeName)).length; }

    // ── Artículos ──
    async getPublishedArticles() { return request('GET', '/articles?status=published'); }

    async getArticleById(id) {
      try { return await request('GET', '/articles/' + encodeURIComponent(id), undefined, { auth: true }); }
      catch (e) { if (e.status === 404) return null; throw e; }
    }

    async saveArticle(articleData) {
      if (articleData.id) return request('PUT', '/articles/' + encodeURIComponent(articleData.id), articleData);
      return request('POST', '/articles', articleData);
    }

    // Las vistas las incrementa el servidor de forma atómica (público); el resto requiere sesión.
    async updateArticle(id, updates) {
      const keys = Object.keys(updates || {});
      if (keys.length === 1 && keys[0] === 'views') {
        const r = await request('POST', '/articles/' + encodeURIComponent(id) + '/view');
        return { id, views: r.views };
      }
      const current = await this.getArticleById(id);
      if (!current) return null;
      return this.saveArticle(Object.assign({}, current, updates));
    }

    async deleteArticle(id) { // papelera (borrado lógico)
      await request('DELETE', '/articles/' + encodeURIComponent(id));
      return true;
    }
    async restoreArticle(id) { return request('POST', '/articles/' + encodeURIComponent(id) + '/restore'); }
    async permanentDeleteArticle(id) {
      await request('DELETE', '/articles/' + encodeURIComponent(id) + '?permanent=true');
      return true;
    }
    async getTrashedArticles() {
      return (await request('GET', '/articles?status=trash')).sort((a, b) => (b.trashedAt || 0) - (a.trashedAt || 0));
    }

    // ── Comentarios ──
    async getCommentsByArticle(articleId, onlyApproved = true) {
      const q = onlyApproved ? '' : '?all=1';
      return request('GET', '/articles/' + encodeURIComponent(articleId) + '/comments' + q, undefined, { auth: !onlyApproved });
    }
    async addComment(commentData) { return request('POST', '/comments', commentData); }
    async updateCommentStatus(id, newStatus, replyText = null) {
      const body = { status: newStatus };
      if (replyText !== null) body.teacherReply = replyText;
      return request('PATCH', '/comments/' + encodeURIComponent(id), body);
    }
    async deleteComment(id) {
      await request('DELETE', '/comments/' + encodeURIComponent(id));
      return true;
    }

    // ── Biblioteca multimedia ──
    async getAllMedia() { return request('GET', '/media'); }
    async saveMedia(mediaData) {
      if (mediaData.id) return request('PUT', '/media/' + encodeURIComponent(mediaData.id), mediaData);
      return request('POST', '/media', mediaData);
    }
    async deleteMedia(id) {
      await request('DELETE', '/media/' + encodeURIComponent(id));
      return true;
    }

    // ── Perfil docente ──
    async getTeacherProfile() { return request('GET', '/profile'); }
    async updateTeacherProfile(updates) {
      const current = await this.getTeacherProfile();
      return request('PUT', '/profile', Object.assign({}, current, updates));
    }
  }

  window.AulaAbiertaDB = new StorageService();

  // ── Botón "Cerrar sesión" discreto en las páginas de administración ──
  if (isAdminPage()) {
    document.addEventListener('DOMContentLoaded', () => {
      const b = document.createElement('button');
      b.type = 'button';
      b.title = 'Cerrar sesión';
      b.setAttribute('aria-label', 'Cerrar sesión');
      b.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px">logout</span>';
      b.style.cssText = 'position:fixed;left:12px;bottom:80px;width:40px;height:40px;border-radius:9999px;border:0;' +
        'background:#0f2042;color:#fff;display:flex;align-items:center;justify-content:center;opacity:.75;' +
        'box-shadow:0 2px 8px rgba(0,0,0,.2);z-index:60;cursor:pointer';
      b.addEventListener('click', () => { if (confirm('¿Cerrar la sesión del panel docente?')) window.AulaAbiertaDB.logout(); });
      document.body.appendChild(b);

      if (currentPage() !== 'perfil') {
        const p = document.createElement('a');
        p.href = 'perfil.html';
        p.title = 'Editar mi perfil';
        p.setAttribute('aria-label', 'Editar mi perfil');
        p.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px">manage_accounts</span>';
        p.style.cssText = 'position:fixed;left:12px;bottom:128px;width:40px;height:40px;border-radius:9999px;' +
          'background:#0f2042;color:#fff;display:flex;align-items:center;justify-content:center;opacity:.75;' +
          'box-shadow:0 2px 8px rgba(0,0,0,.2);z-index:60;text-decoration:none';
        document.body.appendChild(p);
      }
    });
  }
})();

// === Utilidades de saneamiento XSS (sin cambios respecto a la versión anterior) ===

// Sanea HTML enriquecido — elimina scripts, iframes, manejadores de eventos y etiquetas peligrosas
function sanitizeHTML(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll('script, iframe, object, embed, form, input').forEach(el => el.remove());
  div.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on') || attr.value.trim().toLowerCase().startsWith('javascript:')) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return div.innerHTML;
}
window.sanitizeHTML = sanitizeHTML;

// Escapa texto plano para insertarlo de forma segura en plantillas HTML
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escapeHTML = escapeHTML;

// === Notificación toast no bloqueante ===
window.showToast = function (message, type) {
  if (typeof type === 'string' && !['success', 'error', 'warning', 'info'].includes(type)) type = 'info';
  const toast = document.createElement('div');
  toast.className = 'toast-notification toast-' + (type || 'info');
  toast.textContent = message;
  toast.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:12px 24px;border-radius:8px;color:#fff;font-size:14px;z-index:9999;animation:fadeIn .3s ease;max-width:400px;box-shadow:0 4px 12px rgba(0,0,0,.15);';
  toast.style.backgroundColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6';
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity .3s'; setTimeout(() => toast.remove(), 300); }, 3000);
};
