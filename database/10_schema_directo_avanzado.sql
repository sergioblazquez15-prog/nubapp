-- =====================================================================
-- NUBAPP - Directo avanzado (v2)
-- =====================================================================
-- Amplía el marcador en directo a partir del feedback de Sergio con
-- capturas de referencia (app "Picco"): convocatoria/alineación previa
-- para poder atribuir cada acción a un jugador, cronómetro real con
-- partes de duración configurable, más tipos de acción (tiros con
-- "ocasión clara", posesión, faltas y córners a favor/en contra) y
-- resumen de acciones en el descanso.
-- =====================================================================

-- Convocatoria/alineación de un partido concreto: qué deportistas de la
-- plantilla juegan ese partido (para poder asignarles las acciones del
-- directo) y si son titulares o suplentes.
CREATE TABLE IF NOT EXISTS partidos_alineacion (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partido_id      UUID NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
    deportista_id   UUID NOT NULL REFERENCES deportistas(id),
    dorsal          SMALLINT,
    titular         BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (partido_id, deportista_id)
);

-- Cronómetro y configuración de partes. configuracion_partes guarda algo
-- como [{"nombre":"1ª parte","duracionMin":25},{"nombre":"2ª parte","duracionMin":25}],
-- definido por el entrenador al arrancar el directo. parte_actual_indice
-- apunta a la parte en curso dentro de ese array (NULL = todavía no ha
-- arrancado). periodo_iniciado_en es NULL cuando el cronómetro está en
-- pausa (p.ej. en el descanso) y guarda la hora de servidor en la que se
-- puso en marcha cuando está corriendo; periodo_segundos_acumulados es lo
-- ya transcurrido de la parte actual antes de la última puesta en marcha
-- (así una pausa/reanudación no pierde el tiempo ya jugado).
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS configuracion_partes JSONB;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS parte_actual_indice SMALLINT;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS periodo_iniciado_en TIMESTAMPTZ;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS periodo_segundos_acumulados INTEGER NOT NULL DEFAULT 0;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS posesion_actual VARCHAR(10);

-- Eventos: se añade a quién se atribuye la acción (solo tiene sentido
-- para acciones propias, ya que de los rivales no llevamos ficha) y si
-- fue una ocasión clara (solo aplica a tiros). Se amplían los tipos de
-- evento posibles.
ALTER TABLE partidos_eventos ADD COLUMN IF NOT EXISTS ocasion_clara BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE partidos_eventos DROP CONSTRAINT IF EXISTS partidos_eventos_tipo_check;
ALTER TABLE partidos_eventos ADD CONSTRAINT partidos_eventos_tipo_check CHECK (tipo IN (
    'gol_propio', 'gol_rival',
    'tarjeta_amarilla_propio', 'tarjeta_amarilla_rival',
    'tarjeta_roja_propio', 'tarjeta_roja_rival',
    'tiro_propio', 'tiro_rival',
    'falta_favor', 'falta_contra',
    'corner_favor', 'corner_contra',
    'posesion_cambio',
    'otro'
));

CREATE INDEX IF NOT EXISTS idx_partidos_alineacion_partido ON partidos_alineacion (partido_id);
