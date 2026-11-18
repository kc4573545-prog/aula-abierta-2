-- Planificador de clases (Centro de Herramientas Docentes). Idempotente: solo crea si no existe.
CREATE TABLE IF NOT EXISTS lesson_plans (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL,
  plan_type     TEXT NOT NULL DEFAULT 'diaria' CHECK (plan_type IN ('diaria','semanal','unidad')),
  status        TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador','final')),
  title         TEXT NOT NULL DEFAULT '',
  subject       TEXT NOT NULL DEFAULT '',
  grade         TEXT NOT NULL DEFAULT '',
  total_minutes INTEGER NOT NULL DEFAULT 0,
  content       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_owner ON lesson_plans (owner_id, updated_at DESC);
