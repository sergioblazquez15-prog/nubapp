-- =====================================================================
-- NUBAPP - Banco de ejercicios de Fútbol: segunda tanda desde la web de
-- referencia de Sergio (posesión, rondos, partido condicionado, rueda
-- de pase y transiciones)
-- =====================================================================
-- Continuación de 16_seed_ejercicios_futbol_variado.sql: siguiente
-- página de alexortizentrenador.com/category/ejercicios (ejercicios 33
-- al 42). Igual que la tanda anterior, están redactados de nuevo con
-- nuestras propias palabras a partir del planteamiento de cada
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
    ('Posesión con 5 comodines en superioridad',
     'Dos equipos de 6 juegan una posesión en superioridad con la ayuda de 5 comodines fijos en sus zonas (4 exteriores y 1 interior), que solo pueden tocar el balón una vez. El resto de jugadores juega a dos toques. El equipo en posesión suma un punto cuando consigue conectar con los cinco comodines sin perder el balón; si pierde la posesión, los roles se invierten.',
     'posesion', 'tecnica', '+U13', 'Cuadrado 38x38m', '17', 15),

    ('Partido condicionado: alturas de mediocentros y conexión de líneas',
     'Partido condicionado 9 contra 9 (esquema 1-4-2-2) más un comodín ofensivo que juega siempre con el equipo en posesión, en un espacio de 60x45m. Se juega a tres toques (dos para el comodín) y los dos mediocentros de cada equipo deben situarse a alturas distintas del campo, nunca en el mismo carril, para ofrecer líneas de pase claras y superar las líneas de presión rival hasta finalizar en la portería contraria.',
     'partido_condicionado', 'tactica', '+U15', 'Campo 60x45m', '19', 18),

    ('Transiciones ofensivas: amplitud tras robo y centros laterales',
     'Se inicia con un rondo 4x2 en una zona central de 12x10m, jugado a dos toques. En cuanto los defensores recuperan el balón, deben dirigirlo hacia una banda; el lateral defensor de esa banda espera a que el balón salga del rondo antes de presionar. A partir de ahí se activa la fase de ataque en amplitud: delantero, mediocentros y extremo ocupan posiciones de remate y de rechace para aprovechar el centro lateral, mientras el resto de defensores y un atacante del rondo defienden esa llegada.',
     'transiciones', 'tactica', '+U15', 'Tres cuartos de campo 11', '14', 15),

    ('Rondo doble 5x2 con cambio de zona y bonificación defensiva',
     'Dos zonas de 18x20m, cada una con un rondo 5 contra 2 y un comodín que ayuda a temporizar con hasta tres toques (los demás juegan a un toque). Tras intervenir, cada jugador se desplaza rápido a la otra zona para seguir participando; si pierde el balón, cambia de rol con el defensor que lo ha robado en esa misma zona. Como premio a una buena defensa, si los defensores evitan que el equipo rival encadene 20 pases seguidos, se libran de cambiar de rol un turno más.',
     'rondo', 'tecnica', '+U13', 'Dos cuadrados de 18x20m', '14', 15),

    ('Posesión con 4 equipos y alianzas cambiantes',
     'Cuatro equipos de 5 jugadores, cada uno de un color, juegan a dos toques máximo. El entrenador decide qué dos colores se alían para mantener la posesión frente a los otros dos, cambiando las alianzas cada 30-40 segundos. El equipo (o alianza) en posesión suma un punto cada vez que encadena 12 pases seguidos; con la pérdida del balón o el cambio de alianza, el contador de pases se reinicia.',
     'posesion', 'tecnica', '+U13', 'Campo 45x40m', '20', 15),

    ('Juego de posición: superioridad interior y amplitud con comodines',
     'Dos equipos de 4 (2 centrales y 2 laterales cada uno) más 3 comodines interiores fijos en sus subzonas, en un espacio de 22x26m. Los jugadores de equipo juegan a dos toques y los comodines a uno. El equipo en posesión aprovecha la superioridad de los comodines para mantener el balón y debe abrirse en amplitud; al perder la posesión, el equipo que pasa a defender cierra el interior mientras el otro se despliega por fuera. Cada racha de 12 pases seguidos suma un punto.',
     'posesion', 'tactica', '+U13', 'Rectángulo 22x26m', '11', 12),

    ('Partido reducido: salida jugando y ataque en inferioridad',
     'Partido de 11 contra 11 en un campo de 54x36m dividido en dos zonas: para el equipo en posesión, la zona 1 es de inicio (7 contra 4) y la zona 2 de finalización (4 contra 7). Ningún jugador puede cambiar de zona salvo uno del equipo en posesión, que puede conducir el balón cruzando de la zona 1 a la 2. En la zona 1 se juega a dos toques máximo y en la zona 2 a toque libre; si el balón se recupera ya en la otra zona, se puede finalizar directamente. El equipo atacante debe llegar a la zona 2 y resolver rápido pese a jugar en inferioridad numérica, mientras el rival presiona arriba para impedir la conexión entre zonas.',
     'partido_condicionado', 'tactica', '+U15', 'Campo 54x36m dividido en 2 zonas', '22', 18),

    ('Rueda de pase con toma de decisión en el inicio de juego',
     'Rueda de pase de 14 jugadores en un espacio de 30x30m centrada en la toma de decisiones del central al iniciar la jugada: tras recibir de él, el siguiente jugador debe elegir entre tres opciones según la posición de unos defensores pasivos —pase directo al lateral en espacio libre, pase al interior que descarga al mediocentro para que este busque al lateral, o pase directo al mediocentro orientado que distribuye al lateral—. Desde ahí la secuencia continúa con un pase medio y un control orientado hasta devolver el balón al central y reiniciar el circuito.',
     'tecnico', 'tactica', '+U13', 'Campo 30x30m', '14', 12),

    ('Posesión: filtrar pase y conectar con comodines interiores',
     'Dos equipos de 4 juegan dentro de un cuadrado de 26x26m con 6 comodines de apoyo: dos fijos en la zona central y cuatro repartidos en los vértices, todos con un máximo de dos toques. El equipo en posesión debe moverse para atraer defensores y abrir líneas de pase que atraviesen a dos rivales y conecten con los comodines del interior, sumando un punto cada vez que lo consigue. Los comodines centrales no pueden salir de su zona, aunque cualquier jugador puede invadirla para presionar; tras una pérdida o robo, los equipos intercambian roles.',
     'posesion', 'tactica', '+U13', 'Cuadrado 26x26m', '14', 15),

    ('Juego de posición: conectar zonas y buscar al tercer hombre',
     'Dos equipos de 6 más 2 comodines y los dos porteros, en un campo de 28x45m dividido en zonas donde se enfrentan 2 contra 2 en cada una. Los comodines pueden moverse libremente entre zonas y finalizar, mientras los jugadores de campo están confinados a la suya. El equipo que inicia juega desde su portero y debe llevar el balón hasta la zona de finalización (pudiendo pasar o no por la zona intermedia), buscando siempre hombres libres y el apoyo del tercer hombre; con la pérdida, los equipos cambian de rol, y si el balón sale, reinicia el portero correspondiente.',
     'posesion', 'tactica', '+U15', 'Campo 28x45m con zonas', '16', 18)
)
INSERT INTO ejercicios (deporte_id, titulo, descripcion, tipologia, naturaleza, categoria_edad, espacio, num_jugadores, duracion_min)
SELECT df.id, n.titulo, n.descripcion, n.tipologia, n.naturaleza, n.categoria_edad, n.espacio, n.num_jugadores, n.duracion_min
FROM nuevos n, deporte_futbol df
WHERE NOT EXISTS (
    SELECT 1 FROM ejercicios e WHERE e.titulo = n.titulo AND e.deporte_id = df.id
);
