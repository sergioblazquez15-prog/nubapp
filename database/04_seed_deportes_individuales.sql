-- =====================================================================
-- NUBAPP - Añade los deportes individuales al catálogo
-- =====================================================================
-- Solo hace falta ejecutar esto si ya habías corrido 01_schema_nucleo.sql
-- ANTES de que incluyera estos deportes en su INSERT inicial. Es seguro
-- ejecutarlo aunque ya existan: no duplica nada (nombre es UNIQUE).
-- =====================================================================

INSERT INTO deportes (nombre, tipo) VALUES
    ('Muay Thai', 'individual'),
    ('Patinaje', 'individual'),
    ('Padel', 'individual'),
    ('Tenis', 'individual'),
    ('Gimnasia Ritmica', 'individual')
ON CONFLICT (nombre) DO NOTHING;
