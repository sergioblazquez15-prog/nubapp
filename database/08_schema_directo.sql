-- =====================================================================
-- NUBAPP - Marcador en directo
-- =====================================================================
-- Añade a "partidos" el estado de seguimiento en directo (si se está
-- jugando ahora mismo y en qué parte/periodo va) y una tabla de eventos
-- (goles, tarjetas...) para llevar un feed cronológico del partido. Los
-- goles ahí registrados son los que mueven resultado_propio/resultado_rival
-- — así el marcador del partido siempre coincide con la suma de sus goles.
-- =====================================================================

ALTER TABLE partidos ADD COLUMN IF NOT EXISTS en_directo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS periodo VARCHAR(30);

CREATE TABLE IF NOT EXISTS partidos_eventos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partido_id      UUID NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
    minuto          SMALLINT,
    tipo            VARCHAR(30) NOT NULL CHECK (tipo IN (
                        'gol_propio', 'gol_rival',
                        'tarjeta_amarilla_propio', 'tarjeta_amarilla_rival',
                        'tarjeta_roja_propio', 'tarjeta_roja_rival',
                        'otro'
                    )),
    deportista_id   UUID REFERENCES deportistas(id),
    descripcion     TEXT,
    creado_por      UUID REFERENCES usuarios(id),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partidos_eventos_partido ON partidos_eventos (partido_id, creado_en);
