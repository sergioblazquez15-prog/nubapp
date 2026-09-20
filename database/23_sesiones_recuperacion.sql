-- =====================================================================
-- Sesiones de recuperación
-- =====================================================================
-- Una sesión de recuperación es una sesión de entrenamiento fuera del
-- horario habitual, dirigida a UN único deportista (no a toda la
-- plantilla), para recuperar una clase perdida (cancelada por el club o
-- a la que faltó el deportista). Vive en la misma tabla "sesiones" para
-- reutilizar toda la lógica de asistencia que ya existe (tabla
-- "asistencia", resumen de faltas, etc.) — se distingue de una sesión
-- normal del grupo por es_recuperacion = TRUE y solo_deportista_id.
--
-- Pensado sobre todo para monitores de pádel, patinaje y tenis, pero
-- vale para cualquier deporte: tanto administración/dirección deportiva
-- como el propio monitor del equipo pueden crearlas.
-- =====================================================================

ALTER TABLE sesiones
    ADD COLUMN es_recuperacion BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN solo_deportista_id UUID REFERENCES deportistas(id) ON DELETE CASCADE,
    ADD COLUMN recupera_sesion_id UUID REFERENCES sesiones(id) ON DELETE SET NULL;

CREATE INDEX idx_sesiones_recuperacion_deportista ON sesiones (solo_deportista_id) WHERE solo_deportista_id IS NOT NULL;
