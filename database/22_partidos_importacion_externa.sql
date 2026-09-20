-- =====================================================================
-- NUBAPP - Importación del calendario de competición desde una URL
-- externa (por ahora, RFFM - Real Federación de Fútbol de Madrid)
-- =====================================================================
-- Un equipo puede guardar la URL pública de su calendario en la RFFM
-- (ej. https://www.rffm.es/competicion/calendario?...) para poder
-- re-sincronizarla con un clic más adelante (nuevos partidos, cambios de
-- fecha/hora, etc.) sin tener que volver a pegar el enlace cada vez.
--
-- Cada partido importado guarda de dónde viene (fuente_externa) y su
-- identificador en esa fuente (id_externo), para poder reconocer que un
-- partido ya se había importado antes y actualizarlo en vez de
-- duplicarlo. También guarda el escudo del rival (URL de la imagen tal
-- cual la sirve la fuente externa - no se descarga/aloja en NUBAPP en
-- esta primera versión).
-- =====================================================================

ALTER TABLE equipos ADD COLUMN IF NOT EXISTS calendario_externo_url VARCHAR(500);

-- Cómo aparece EL PROPIO CLUB (no el rival) en los datos de la fuente
-- externa (ej. "AD Nuevo Baztán" tal cual lo escribe la RFFM) - hace
-- falta para poder distinguir, dentro de cada partido importado, cuál de
-- los dos equipos somos nosotros y cuál es el rival. Es un campo
-- distinto de club_nombre (que ya existía con otro uso).
ALTER TABLE equipos ADD COLUMN IF NOT EXISTS nombre_club_competicion VARCHAR(120);

ALTER TABLE partidos ADD COLUMN IF NOT EXISTS escudo_rival VARCHAR(500);
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS id_externo VARCHAR(150);
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS fuente_externa VARCHAR(30);

-- Un mismo partido de una fuente externa no se debe importar dos veces
-- para el mismo equipo (pero id_externo puede repetirse entre fuentes
-- distintas o ser NULL para partidos metidos a mano).
CREATE UNIQUE INDEX IF NOT EXISTS idx_partidos_externo_unico
    ON partidos (equipo_id, fuente_externa, id_externo)
    WHERE id_externo IS NOT NULL;
