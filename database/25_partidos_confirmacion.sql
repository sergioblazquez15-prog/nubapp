-- Confirmación previa de asistencia a PARTIDOS por parte del propio
-- deportista (desde "Mi app"), en paralelo a asistencia.confirmacion_previa
-- que ya existe para las sesiones de entrenamiento (ver
-- 24_asistencia_confirmacion_motivo.sql). Es una tabla aparte (no la misma
-- "asistencia", que está atada a sesiones) porque un partido no es una
-- sesión: tiene su propio ciclo (convocatoria, directo...).
--
-- Mismo criterio que en asistencia: esto es SOLO lo que marca el deportista
-- antes del partido (confirmado/rechazado + motivo). No tiene nada que ver
-- con la convocatoria real (partidos_alineacion, que decide el
-- entrenador) ni con las estadísticas de partidos jugados.
CREATE TABLE IF NOT EXISTS partidos_confirmacion (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partido_id          UUID NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
    deportista_id       UUID NOT NULL REFERENCES deportistas(id) ON DELETE CASCADE,
    confirmacion_previa VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                        CHECK (confirmacion_previa IN ('pendiente', 'confirmado', 'rechazado')),
    motivo              VARCHAR(20) CHECK (motivo IN ('enfermo', 'lesion', 'trabajo', 'otro')),
    motivo_texto        TEXT,
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (partido_id, deportista_id)
);

CREATE INDEX IF NOT EXISTS idx_partidos_confirmacion_partido ON partidos_confirmacion (partido_id);
CREATE INDEX IF NOT EXISTS idx_partidos_confirmacion_deportista ON partidos_confirmacion (deportista_id);
