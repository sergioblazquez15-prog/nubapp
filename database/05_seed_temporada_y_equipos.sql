-- =====================================================================
-- Migración idempotente: módulo de Equipos
-- =====================================================================
-- Añade la baja lógica a equipos (igual que en deportistas/usuarios) y
-- crea una primera temporada si todavía no existe ninguna, para poder
-- empezar a crear equipos sin tener que dar de alta la temporada a mano.
-- Segura de ejecutar aunque ya la hayas corrido antes.
-- =====================================================================

ALTER TABLE equipos ADD COLUMN IF NOT EXISTS inactivo BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO temporadas (nombre, fecha_inicio, fecha_fin, es_principal, activa)
SELECT '2026/2027', '2026-09-01', '2027-06-30', TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM temporadas);
