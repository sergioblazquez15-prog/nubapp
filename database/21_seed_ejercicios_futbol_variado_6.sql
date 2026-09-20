-- =====================================================================
-- NUBAPP - Banco de ejercicios de Fútbol: sexta y última tanda desde la
-- web de referencia de Sergio (juego de posesión y salida de balón con
-- presión alta)
-- =====================================================================
-- Continuación de 20_seed_ejercicios_futbol_variado_5.sql: última
-- página de alexortizentrenador.com/category/ejercicios (ejercicios 1
-- y 2, los dos más antiguos del archivo). Con esta tanda se completan
-- las 6 páginas del listado de ejercicios de esa web. Igual que las
-- tandas anteriores, están redactados de nuevo con nuestras propias
-- palabras a partir del planteamiento de cada ejercicio, no copiados
-- literalmente de los artículos originales.
--
-- Idempotente: comprueba por título antes de insertar, así que se puede
-- ejecutar en cada arranque del contenedor sin duplicar nada.
-- =====================================================================

WITH deporte_futbol AS (
    SELECT id FROM deportes WHERE nombre = 'Futbol'
),
nuevos (titulo, descripcion, tipologia, naturaleza, categoria_edad, espacio, num_jugadores, duracion_min) AS (
    VALUES
    ('Juego de posesión con movilidad constante y cambios de rol',
     'Dos equipos de 9 juegan en un espacio de 36x24m, con 5 jugadores de cada equipo dentro de la zona y los otros 4 repartidos por fuera, cada uno en su banda asignada. El equipo en posesión busca la superioridad numérica combinando con los jugadores exteriores; estos no pueden pasarse el balón entre ellos, solo recibir y devolver hacia dentro. Cada vez que un jugador de dentro conecta con un compañero de fuera, ambos intercambian su posición, generando una movilidad constante y líneas de pase continuas. Encadenar 12 pases seguidos suma un punto, y sirve como activación inicial centrada en la circulación y los fundamentos de la posesión.',
     'posesion', 'tecnica', '+U13', '36x24m', '18', 12),

    ('Salida de balón con inicio en zonas y superación de la presión alta',
     'Diecisiete jugadores (3 equipos de 5 más 2 comodines centrales) juegan en un espacio de 44x18m dividido en tres zonas: dos exteriores y una intermedia. El equipo que inicia debe dar 3 o 4 pases en su zona antes de intentar conectar con la zona central, a la que se puede acceder pasando o conduciendo el balón para generar un 2 contra 1; una vez dentro, el balón se dirige a la zona contraria a través de uno de los comodines o del jugador que haya conducido hasta ahí. En la presión solo pueden entrar tres defensores a robar en cada zona, y tras la pérdida el equipo que tenía el balón pasa a defender. El objetivo es superar la presión alta rival aplicando el concepto de tercer hombre y moviéndose para atraer a los defensores y abrir líneas de pase.',
     'salida_presion', 'tactica', '+U15', '44x18m en 3 zonas', '17', 15)
)
INSERT INTO ejercicios (deporte_id, titulo, descripcion, tipologia, naturaleza, categoria_edad, espacio, num_jugadores, duracion_min)
SELECT df.id, n.titulo, n.descripcion, n.tipologia, n.naturaleza, n.categoria_edad, n.espacio, n.num_jugadores, n.duracion_min
FROM nuevos n, deporte_futbol df
WHERE NOT EXISTS (
    SELECT 1 FROM ejercicios e WHERE e.titulo = n.titulo AND e.deporte_id = df.id
);
