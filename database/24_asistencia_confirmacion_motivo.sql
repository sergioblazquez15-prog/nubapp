-- =====================================================================
-- Motivo de la confirmación previa del deportista
-- =====================================================================
-- La app del deportista permite marcar "no asisto" a una sesión de la
-- semana en curso o la siguiente, con un motivo (enfermo/lesión/trabajo/
-- otro, con texto libre si es "otro"). Esto se guarda junto a la
-- confirmacion_previa que ya existía en "asistencia" - son datos que
-- pone el propio deportista, y nunca tocan asistio/justificada (eso lo
-- sigue marcando solo el monitor/entrenador el día de la sesión).
-- =====================================================================

ALTER TABLE asistencia
    ADD COLUMN motivo VARCHAR(20) CHECK (motivo IN ('enfermo', 'lesion', 'trabajo', 'otro')),
    ADD COLUMN motivo_texto TEXT;
