-- Aula Abierta — esquema PostgreSQL (idempotente)

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS articles (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  summary         TEXT NOT NULL DEFAULT '',
  subject         TEXT NOT NULL DEFAULT '',
  grade           TEXT NOT NULL DEFAULT '',
  read_time       INTEGER NOT NULL DEFAULT 5,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('published','draft','scheduled','trash')),
  cover_image     TEXT NOT NULL DEFAULT '',
  cover_alt       TEXT NOT NULL DEFAULT '',
  author          TEXT NOT NULL DEFAULT '',
  role            TEXT NOT NULL DEFAULT '',
  views           INTEGER NOT NULL DEFAULT 0,
  content         TEXT NOT NULL DEFAULT '',
  tags            JSONB NOT NULL DEFAULT '[]'::jsonb,
  allow_comments  BOOLEAN NOT NULL DEFAULT TRUE,
  featured        BOOLEAN NOT NULL DEFAULT FALSE,
  previous_status TEXT,
  trashed_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_articles_status  ON articles (status);
CREATE INDEX IF NOT EXISTS idx_articles_subject ON articles (subject);
CREATE INDEX IF NOT EXISTS idx_articles_created ON articles (created_at DESC);

CREATE TABLE IF NOT EXISTS comments (
  id            TEXT PRIMARY KEY,
  article_id    TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  author_name   TEXT NOT NULL,
  author_type   TEXT NOT NULL DEFAULT 'guest'
                CHECK (author_type IN ('teacher','family','student','guest')),
  author_badge  TEXT NOT NULL DEFAULT '',
  school_info   TEXT NOT NULL DEFAULT '',
  content       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected','spam')),
  is_spam_alert BOOLEAN NOT NULL DEFAULT FALSE,
  teacher_reply TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_article ON comments (article_id);
CREATE INDEX IF NOT EXISTS idx_comments_status  ON comments (status);

CREATE TABLE IF NOT EXISTS media (
  id                 TEXT PRIMARY KEY,
  title              TEXT NOT NULL,
  category           TEXT NOT NULL DEFAULT '',
  url                TEXT NOT NULL,
  size_kb            INTEGER NOT NULL DEFAULT 0,
  dimensions         TEXT NOT NULL DEFAULT '',
  alt_text           TEXT NOT NULL DEFAULT '',
  associated_article TEXT NOT NULL DEFAULT '',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_media_category ON media (category);

-- Perfil docente: una sola fila (id = 1)
CREATE TABLE IF NOT EXISTS teacher_profile (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  name             TEXT NOT NULL DEFAULT 'Docente',
  title            TEXT NOT NULL DEFAULT '',
  role             TEXT NOT NULL DEFAULT '',
  specialty        TEXT NOT NULL DEFAULT '',
  school           TEXT NOT NULL DEFAULT '',
  years_experience INTEGER NOT NULL DEFAULT 0,
  bio              TEXT NOT NULL DEFAULT '',
  photo_url        TEXT NOT NULL DEFAULT '',
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO teacher_profile (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
