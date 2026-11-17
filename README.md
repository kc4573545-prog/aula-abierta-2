# Aula Abierta — Mi Blog Docente

Espacio educativo propio para un docente: blog público + panel de administración.

- **Frontend**: HTML + Tailwind (exportado de Stitch) en `public/`
- **Backend**: Node.js + Express (`server/`)
- **Base de datos**: PostgreSQL (`server/schema.sql`)
- **Auth**: JWT para el panel docente; lectura pública solo de contenido publicado

## Ejecutar en local
```bash
cp .env.example .env     # edita DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm install
npm start                # http://localhost:3000
```
Al arrancar se crean las tablas, el usuario administrador y (si `SEED_DEMO_DATA=true`) los datos de ejemplo, una sola vez.

## API
| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/auth/login` | público |
| GET | `/api/articles`, `/api/articles/:id`, `/api/articles/:id/comments` | público (solo publicados) |
| POST | `/api/articles/:id/view` | público |
| POST | `/api/comments` | público (entra como pendiente) |
| GET/POST/PUT/DELETE | `/api/articles…`, `/api/media…`, `PATCH/DELETE /api/comments/:id`, `GET /api/comments`, `PUT /api/profile` | docente (token) |
| GET | `/api/profile`, `/api/health` | público |

## Desplegar en Render
1. En Render: **New → Blueprint** y selecciona este repositorio (usa `render.yaml`).
2. Define `ADMIN_EMAIL` y `ADMIN_PASSWORD` cuando lo pida (`JWT_SECRET` y `DATABASE_URL` se generan solos).
3. Cuando ya tengas tu contenido real, cambia `SEED_DEMO_DATA` a `false` y borra los artículos de ejemplo desde el panel.

Panel docente: `/admin-login.html`.

> Nota: el plan gratuito de PostgreSQL en Render expira a los 30 días; para uso continuo, sube a un plan de pago.
