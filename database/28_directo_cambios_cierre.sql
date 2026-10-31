-- =====================================================================
-- NUBAPP - Directo v3: cambios, asistencias, motivo de tarjeta y cierre
-- =====================================================================
-- A partir del feedback de Sergio tras usar el Directo en un partido real:
--   - Nuevo tipo de evento "cambio" (sustitución), con quién entra
--     (deportista_id, igual que el resto de eventos propios) y quién sale
--     (deportista_sale_id, columna nueva).
--   - En los goles propios, además de quién lo mete (deportista_id, que
--     ya existía) se puede apuntar opcionalmente quién da la asistencia
--     (asistencia_deportista_id). Nunca es obligatorio: no siempre hay.
--   - El motivo de una tarjeta propia se guarda en la columna
--     "descripcion" que ya existía (no hace falta columna nueva).
--   - Al finalizar el partido, el entrenador deja un comentario de cierre
--     (comentario_cierre, en "partidos" — distinto de "notas", que son
--     las observaciones previas al partido).
-- =====================================================================

ALTER TABLE partidos_eventos DROP CONSTRAINT IF EXISTS partidos_eventos_tipo_check;
ALTER TABLE partidos_eventos ADD CONSTRAINT partidos_eventos_tipo_check CHECK (tipo IN (
    'gol_propio', 'gol_rival',
    'tarjeta_amarilla_propio', 'tarjeta_amarilla_rival',
    'tarjeta_roja_propio', 'tarjeta_roja_rival',
    'tiro_propio', 'tiro_rival',
    'falta_favor', 'falta_contra',
    'corner_favor', 'corner_contra',
    'posesion_cambio',
    'cambio',
    'otro'
));

ALTER TABLE partidos_eventos ADD COLUMN IF NOT EXISTS asistencia_deportista_id UUID REFERENCES deportistas(id);
ALTER TABLE partidos_eventos ADD COLUMN IF NOT EXISTS deportista_sale_id UUID REFERENCES deportistas(id);

ALTER TABLE partidos ADD COLUMN IF NOT EXISTS comentario_cierre TEXT;
