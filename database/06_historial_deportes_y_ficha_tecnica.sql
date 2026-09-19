-- =====================================================================
-- Migración idempotente: histórico de altas/bajas por deporte + ficha
-- técnica con posiciones fijas (fútbol/baloncesto) y foto del deportista
-- =====================================================================
-- Antes, deportista_deportes solo guardaba "practica este deporte sí/no"
-- (una fila por pareja deportista-deporte). Ahora guarda periodos con
-- fecha de alta y de baja, para poder ver desde cuándo hasta cuándo
-- practicó cada deporte (y darle de alta otra vez más adelante sin
-- perder el historial anterior).
-- =====================================================================

ALTER TABLE deportista_deportes ADD COLUMN IF NOT EXISTS id UUID DEFAULT uuid_generate_v4();
ALTER TABLE deportista_deportes ADD COLUMN IF NOT EXISTS fecha_alta DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE deportista_deportes ADD COLUMN IF NOT EXISTS fecha_baja DATE;

-- La antigua clave primaria (deportista_id, deporte_id) impedía tener más
-- de una fila por pareja, así que no valía para guardar historial. La
-- sustituimos por un id propio.
ALTER TABLE deportista_deportes DROP CONSTRAINT IF EXISTS deportista_deportes_pkey;
ALTER TABLE deportista_deportes ADD PRIMARY KEY (id);

-- Solo puede haber UN periodo abierto (sin fecha_baja) por deportista y
-- deporte a la vez; así "practica actualmente" sigue siendo una consulta
-- simple aunque ahora haya historial debajo.
DROP INDEX IF EXISTS idx_deportista_deporte_periodo_abierto;
CREATE UNIQUE INDEX idx_deportista_deporte_periodo_abierto
    ON deportista_deportes (deportista_id, deporte_id)
    WHERE fecha_baja IS NULL;

-- Ficha técnica: posición principal/secundaria fijas (antes eran listas
-- de texto libre) para poder marcarlas sobre el esquema del campo/pista.
ALTER TABLE fichas_tecnicas ADD COLUMN IF NOT EXISTS posicion_principal VARCHAR(40);
ALTER TABLE fichas_tecnicas ADD COLUMN IF NOT EXISTS posicion_secundaria VARCHAR(40);
