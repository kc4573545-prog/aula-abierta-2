-- Centro de Herramientas Docentes: documentos de rúbricas, calificaciones, cuestionarios y contabilidad. Idempotente.
CREATE TABLE IF NOT EXISTS tool_docs (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL,
  tool TEXT NOT NULL CHECK (tool IN ('rubrica','calificaciones','cuestionario','contabilidad')),
  title TEXT NOT NULL DEFAULT '', content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_tool_docs_owner ON tool_docs (owner_id, tool, updated_at DESC);
