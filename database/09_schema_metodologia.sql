-- =====================================================================
-- NUBAPP - Metodología
-- =====================================================================
-- Primera versión, sin capturas de referencia todavía: documentos de
-- texto libre (principios de juego, objetivos por categoría, sistema de
-- entrenamiento...) organizados por deporte, o generales para todo el
-- club si deporte_id es NULL. Se afinará en cuanto tengamos las capturas
-- de MísterCoach de este apartado.
-- =====================================================================

CREATE TABLE IF NOT EXISTS metodologia_documentos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deporte_id      UUID REFERENCES deportes(id),  -- NULL = aplica a todo el club
    titulo          VARCHAR(150) NOT NULL,
    contenido       TEXT,
    orden           SMALLINT NOT NULL DEFAULT 0,
    creado_por      UUID REFERENCES usuarios(id),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metodologia_deporte ON metodologia_documentos (deporte_id, orden);
