-- =====================================================================
-- NUBAPP - Gestión de competición (ligas, copas, torneos, amistosos)
-- =====================================================================
-- Hasta ahora un partido solo tenía un campo de texto libre "competicion".
-- Esto añade un catálogo real por equipo y temporada (ej: "Liga Infantil
-- Grupo 3", "Copa Federación", "Amistosos pretemporada"), para poder
-- filtrar/agrupar partidos por competición y no depender de que todo el
-- mundo escriba el nombre igual.
--
-- El campo de texto "competicion" en partidos se mantiene (por si hay
-- partidos ya creados con él, o para amistosos sueltos sin competición
-- formal); competicion_id es la referencia nueva, opcional.
-- =====================================================================

CREATE TABLE IF NOT EXISTS competiciones (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipo_id       UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    temporada_id    UUID NOT NULL REFERENCES temporadas(id),
    nombre          VARCHAR(120) NOT NULL,
    tipo            VARCHAR(20) NOT NULL DEFAULT 'liga'
                    CHECK (tipo IN ('liga', 'copa', 'torneo', 'amistoso')),
    creado_por      UUID REFERENCES usuarios(id),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (equipo_id, temporada_id, nombre)
);

CREATE INDEX IF NOT EXISTS idx_competiciones_equipo ON competiciones (equipo_id, temporada_id);

ALTER TABLE partidos ADD COLUMN IF NOT EXISTS competicion_id UUID REFERENCES competiciones(id) ON DELETE SET NULL;
