-- =====================================================================
-- NUBAPP - Estadísticas de partidos (deportes de equipo: fútbol/baloncesto)
-- =====================================================================
-- Un partido es siempre de un equipo concreto (y por tanto de un deporte
-- y una temporada concretos, a través del equipo). El resultado se guarda
-- como "resultado_propio"/"resultado_rival" en genérico (goles o puntos,
-- según el deporte) para no tener que duplicar la tabla por deporte.
-- =====================================================================

CREATE TABLE IF NOT EXISTS partidos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipo_id       UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    temporada_id    UUID NOT NULL REFERENCES temporadas(id),
    fecha           DATE NOT NULL,
    hora            TIME,
    rival           VARCHAR(120) NOT NULL,
    local_visitante VARCHAR(10) NOT NULL DEFAULT 'local'
                        CHECK (local_visitante IN ('local', 'visitante')),
    competicion     VARCHAR(120),
    jornada         VARCHAR(20),
    -- Goles (fútbol) o puntos (baloncesto) — mismo campo, distinto sentido
    -- según el deporte del equipo.
    resultado_propio SMALLINT,
    resultado_rival  SMALLINT,
    -- jugado = ya tiene resultado cargado; permite crear el partido antes
    -- de que se juegue (para tenerlo en el calendario) y rellenar el
    -- resultado después.
    jugado          BOOLEAN NOT NULL DEFAULT FALSE,
    notas           TEXT,
    creado_por      UUID REFERENCES usuarios(id),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partidos_equipo_fecha ON partidos (equipo_id, fecha);

-- Vista de ayuda: jugados/ganados/empatados/perdidos y goles/puntos a
-- favor y en contra, por equipo. Es la base de la pantalla de
-- estadísticas ("Estadísticas de equipo" del README).
CREATE OR REPLACE VIEW v_partidos_resumen AS
SELECT
    equipo_id,
    temporada_id,
    COUNT(*) FILTER (WHERE jugado)                                          AS jugados,
    COUNT(*) FILTER (WHERE jugado AND resultado_propio > resultado_rival)   AS ganados,
    COUNT(*) FILTER (WHERE jugado AND resultado_propio = resultado_rival)   AS empatados,
    COUNT(*) FILTER (WHERE jugado AND resultado_propio < resultado_rival)   AS perdidos,
    COALESCE(SUM(resultado_propio) FILTER (WHERE jugado), 0)               AS favor,
    COALESCE(SUM(resultado_rival) FILTER (WHERE jugado), 0)                AS contra
FROM partidos
GROUP BY equipo_id, temporada_id;
