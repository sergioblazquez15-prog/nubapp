-- =====================================================================
-- NUBAPP - Banco de ejercicios de Fútbol: quinta tanda desde la web de
-- referencia de Sergio (posesión con comodines, rondos, defensa
-- organizada, ruedas de pase y partido reducido)
-- =====================================================================
-- Continuación de 19_seed_ejercicios_futbol_variado_4.sql: siguiente
-- página de alexortizentrenador.com/category/ejercicios (ejercicios 3
-- al 12). Igual que las tandas anteriores, están redactados de nuevo
-- con nuestras propias palabras a partir del planteamiento de cada
-- ejercicio, no copiados literalmente de los artículos originales.
--
-- Idempotente: comprueba por título antes de insertar, así que se puede
-- ejecutar en cada arranque del contenedor sin duplicar nada.
-- =====================================================================

WITH deporte_futbol AS (
    SELECT id FROM deportes WHERE nombre = 'Futbol'
),
nuevos (titulo, descripcion, tipologia, naturaleza, categoria_edad, espacio, num_jugadores, duracion_min) AS (
    VALUES
    ('Posesión con comodín, defensa y miniporterías: movilidad y activación tras pérdida',
     'Dieciocho jugadores repartidos en tres equipos de seis rotan por tres roles (posesión, defensa y comodín) en un espacio de 40x30m con seis miniporterías repartidas por el perímetro. El equipo en posesión juega a dos toques (el comodín a uno) y suma un punto cada vez que encadena 12 pases seguidos con ayuda del comodín; al perder el balón, pasa de inmediato a defender e intenta evitar que el nuevo equipo poseedor remate en cualquier miniportería, mientras el equipo que roba presiona con intensidad y, tras un pase previo, busca finalizar en la miniportería que prefiera.',
     'posesion', 'tactica', '+U13', '40x30m con 6 miniporterías', '18', 15),

    ('Rondo hexagonal con permuta de posiciones',
     'Trece jugadores (2 equipos de 6 más un comodín) juegan un rondo en un espacio hexagonal de 28x26m, con tres jugadores de cada equipo dentro de la zona y los otros tres repartidos por fuera en los lados alternos. Se juega a tres toques (el comodín a dos) y cuando un jugador de dentro combina con un compañero situado en uno de los lados exteriores, ambos intercambian su posición. El equipo en posesión puntúa al completar 12 pases o al conseguir que los tres jugadores de fuera hayan rotado dentro de la misma posesión; el equipo defensor debe evitar las combinaciones interiores y el triángulo defensivo, y con la pérdida del balón los roles se invierten.',
     'rondo', 'tactica', '+U15', 'Hexágono 28x26m', '13', 15),

    ('Defensa organizada: despejes tras centro lateral y salida en transición',
     'Dieciséis jugadores (8 contra 6 más portero) trabajan en medio campo un ciclo completo de juego. El equipo en superioridad mantiene la posesión con sus centrocampistas —limitados a tres toques para no depender del regate— buscando el juego interior o generar un 2 contra 1 en banda que termine en centro lateral; los defensores, obligados a despejar hacia zonas prefijadas y a salir rápido para evitar el rechace, deben además combinar entre ellos para intentar superar la primera línea de presión rival con un balón a las bandas si consiguen recuperar, lanzando así una transición ofensiva con jugadores incorporados desde atrás.',
     'defensivo', 'tactica', '+U15', 'Medio campo', '16', 15),

    ('Rueda de pase concepto de tercer hombre (II): saltar línea y conectar con el intermedio',
     'Rueda de pase de 12 jugadores en un espacio de 28x15m con una secuencia de seis acciones encadenadas: el primer jugador inicia con balón, el segundo hace un amago antes de ofrecerse en apoyo, el primero pasa a un tercero que elige línea horizontal o vertical según el movimiento del segundo, el segundo cambia de dirección buscando un nuevo apoyo esta vez al poseedor actual, este se la devuelve de cara para que el segundo quede orientado a portería, y desde ahí controla y da un pase medio a un cuarto jugador para reiniciar el circuito con rotación alfabética.',
     'tecnico', 'tactica', '+U13', '28x15m', '12', 12),

    ('Rondo de posesión con finalización en dos zonas: encontrar el eje de penetración',
     'Once jugadores (10 de campo más portero) juegan en dos zonas contiguas de 18x20m con una portería situada en el punto medio, manteniendo en cada zona una relación 5 contra 2. Antes de poder rematar hace falta completar un mínimo de 6 pases; tras un gol, los dos defensores de esa zona cambian rápido a la zona contraria, y si el remate se para o se falla, el rematador y el defensor con menos tiempo defendiendo son los que cambian de zona, manteniendo siempre la estructura de superioridad 5 contra 2.',
     'rondo', 'tactica', '+U15', '2 zonas de 18x20m con portería central', '11', 15),

    ('Juego de posesión en cuatro zonas: circulación y mover para atraer',
     'Veinte jugadores (2 equipos de 8 más 4 comodines, uno por zona) juegan en un espacio de 36x36m dividido en cuatro cuadrantes de 18x18m. Los comodines solo pueden dar un toque; el equipo en posesión puntúa completando 12 pases seguidos o consiguiendo combinar con los comodines de las cuatro zonas, moviéndose para atraer rivales y así abrir líneas de pase hacia compañeros libres, ya sea cercanos o alejados. La pérdida del balón, o que este salga de los límites de zona, provoca el cambio de roles entre los dos equipos.',
     'posesion', 'tactica', '+U15', '36x36m en 4 zonas de 18x18m', '20', 15),

    ('Rondo en dos zonas con superioridad numérica: atraer para mover',
     'Diez jugadores juegan un rondo en un espacio de 20x12m dividido en dos zonas de 10x12m, manteniendo una superioridad 5 contra 2 en la zona activa; solo pueden cambiar de zona los jugadores en posesión que ocupan las bandas, y los defensores llevan un peto en la mano para facilitar el cambio de rol al perder. Se juega a toque y medio (si un jugador da dos toques, el siguiente solo puede dar uno) y únicamente dos defensores pueden entrar a robar en la zona activa; el equipo en posesión trabaja la orientación corporal y busca atraer rivales para después enviar el balón a la zona con menos ocupación, mientras los defensores intentan cerrar el interior y orientar la posesión rival.',
     'rondo', 'tactica', '+U13', '20x12m en 2 zonas', '10', 12),

    ('Partido reducido con tercer hombre y marcaje individual',
     'Diecisiete jugadores (2 equipos de 8 más un comodín interior) juegan un partido reducido de 36x24m con marcaje individual: cada defensor es responsable de un rival concreto. Los atacantes pueden combinar con jugadores situados junto a la portería contraria haciendo una pared o usándolos como tercer hombre; los comodines exteriores juegan a un toque y el comodín interior a dos, sin poder marcar gol directamente. Cada vez que se encaja un gol, el defensor responsable de la marca que no lo evitó cambia su posición con uno de los comodines, generando presión añadida sobre la responsabilidad defensiva individual.',
     'partido_condicionado', 'tactica', '+U15', '36x24m', '17', 15),

    ('Juego de posición con comodines: posesión en superioridad y cambios de rol',
     'Once jugadores (2 equipos de 4 más 3 comodines: uno central y dos de banda) juegan en un espacio de 24x16m. Los comodines de banda juegan a dos toques, el comodín central a uno, y los dos comodines de banda no pueden pasarse el balón directamente entre ellos. Un comodín se asocia con uno de los equipos para ayudarle a mantener la posesión de un extremo a otro del espacio, buscando siempre líneas de pase abiertas gracias a la superioridad numérica y a la máxima amplitud; con la pérdida del balón, se produce un cambio de rol y de funciones, pasando el equipo que defendía a mantener la posesión y a mostrar amplitud.',
     'posesion', 'tactica', '+U13', '24x16m', '11', 12),

    ('Rueda de pase concepto de tercer hombre (I): finta y desmarque',
     'Rueda de pase de 8 a 12 jugadores (2-3 por posta) en un espacio de 12x18m, pensada como activación previa a sesiones centradas en el tercer hombre. Un jugador inicia con balón mientras un segundo se ofrece en apoyo simulando estar marcado; el primero pasa a un tercero en vez de al segundo, ya que este quedaría de espaldas a portería, y el segundo repite el desmarque de apoyo pero ahora hacia el nuevo poseedor, que le devuelve el balón ya orientado hacia portería para que lo controle y lo devuelva a un toque, reiniciando la secuencia por el lado contrario con rotación de jugadores. El entrenador puede pedir "cambio" para invertir el sentido de la rueda.',
     'tecnico', 'tecnica', '+U11', '12x18m', '10', 10)
)
INSERT INTO ejercicios (deporte_id, titulo, descripcion, tipologia, naturaleza, categoria_edad, espacio, num_jugadores, duracion_min)
SELECT df.id, n.titulo, n.descripcion, n.tipologia, n.naturaleza, n.categoria_edad, n.espacio, n.num_jugadores, n.duracion_min
FROM nuevos n, deporte_futbol df
WHERE NOT EXISTS (
    SELECT 1 FROM ejercicios e WHERE e.titulo = n.titulo AND e.deporte_id = df.id
);
