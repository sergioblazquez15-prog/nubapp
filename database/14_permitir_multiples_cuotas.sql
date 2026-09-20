-- =====================================================================
-- NUBAPP - Permitir varias cuotas del mismo deporte por deportista
-- =====================================================================
-- Hasta ahora solo se podía dar de alta UNA cuota por deportista+deporte+
-- temporada. Sergio necesita poder crear varias (ej: "Septiembre",
-- "Octubre", "Segundo trimestre", "Liga de pádel") para el mismo deporte
-- y temporada. Se añade un campo "concepto" que identifica cada cuota, y
-- se cambia la restricción de unicidad para que sea por
-- deportista+deporte+temporada+concepto en lugar de solo
-- deportista+deporte+temporada. Así, dar de alta dos veces el mismo
-- concepto (ej. reeditar "Septiembre" desde la edición grupal) actualiza
-- la cuota existente, pero conceptos distintos crean cuotas distintas.
-- Migración idempotente: se puede volver a ejecutar sin romper nada.
-- =====================================================================

ALTER TABLE cuotas ADD COLUMN IF NOT EXISTS concepto VARCHAR(120);

-- Cuotas creadas antes de este cambio no tenían concepto: se rellenan
-- con lo que hubiera en "notas", o "Cuota" si no había nada.
UPDATE cuotas SET concepto = COALESCE(NULLIF(TRIM(notas), ''), 'Cuota') WHERE concepto IS NULL;

ALTER TABLE cuotas ALTER COLUMN concepto SET DEFAULT 'Cuota';
ALTER TABLE cuotas ALTER COLUMN concepto SET NOT NULL;

-- Quita la restricción antigua (una sola cuota por deportista+deporte+temporada)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cuotas_deportista_id_deporte_id_temporada_id_key'
    ) THEN
        ALTER TABLE cuotas DROP CONSTRAINT cuotas_deportista_id_deporte_id_temporada_id_key;
    END IF;
END $$;

-- Nueva restricción: una cuota por deportista+deporte+temporada+concepto
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cuotas_deportista_deporte_temporada_concepto_key'
    ) THEN
        ALTER TABLE cuotas ADD CONSTRAINT cuotas_deportista_deporte_temporada_concepto_key
            UNIQUE (deportista_id, deporte_id, temporada_id, concepto);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cuotas_deporte_temporada ON cuotas (deporte_id, temporada_id);
