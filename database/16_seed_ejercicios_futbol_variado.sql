-- =====================================================================
-- NUBAPP - Banco de ejercicios de Fútbol: rondos, rueda de pase,
-- juego de posición, salida de presión y transiciones
-- =====================================================================
-- Sergio también pasó el enlace a una web de un entrenador
-- (alexortizentrenador.com/category/ejercicios) con decenas de
-- ejercicios publicados. Esta migración añade una primera tanda de 9,
-- redactados de nuevo con nuestras propias palabras a partir del
-- planteamiento de cada ejercicio (no son una copia literal de los
-- artículos originales) y adaptados al formato del banco de la app.
-- Quedan más ejercicios en esa web para futuras tandas si Sergio quiere
-- seguir ampliando el banco.
--
-- Idempotente: comprueba por título antes de insertar, así que se puede
-- ejecutar en cada arranque del contenedor sin duplicar nada.
-- =====================================================================

WITH deporte_futbol AS (
    SELECT id FROM deportes WHERE nombre = 'Futbol'
),
nuevos (titulo, descripcion, tipologia, naturaleza, categoria_edad, espacio, num_jugadores, duracion_min) AS (
    VALUES
    ('Trabajo defensivo individualizado: centrales ante centros laterales',
     'Con 10 jugadores en mediocampo (2 centrales, 2 laterales, 1 mediocentro, 2 extremos, 2 delanteros), se encadenan centros laterales que los centrales deben rechazar con despejes orientados. Después, el mediocentro conduce el balón generando una situación de defensa en inferioridad (3 atacantes contra 2 centrales) que estos deben resolver. La secuencia se repite después por el lado contrario.',
     'defensivo', 'tactica', '+U15', 'Mediocampo', '10', 15),

    ('Rondo cuadrado en 4 zonas 12x5',
     'Cuadrado de 26x26m dividido en 4 zonas, con 3 atacantes fijos en cada una (12 en total) frente a 5 defensores que se mueven libremente por todo el espacio. Los atacantes no pueden salir de su zona y deben hacer circular el balón entre zonas para atraer a los defensores y generar superioridad en las zonas más despejadas. El objetivo es encadenar un número alto de pases seguidos sin que los defensores corten la circulación.',
     'rondo', 'tecnica', '+U15', 'Cuadrado 26x26m con 4 zonas', '17', 15),

    ('Doble rondo cuadrado 6x2',
     'Dos cuadrados de 14x14m funcionando a la vez, cada uno con un rondo de 6 atacantes contra 2 defensores. En cuanto un jugador recibe y da continuidad al balón, se desplaza corriendo al otro cuadrado para seguir ofreciendo apoyo allí, manteniendo un movimiento constante entre ambas zonas. Si los defensores de un cuadrado recuperan el balón, cambian de rol con el atacante que lo perdió.',
     'rondo', 'tecnica', '+U13', 'Dos cuadrados de 14x14m', '16', 12),

    ('Rueda de pase con conceptos técnicos encadenados',
     'Cuadrado de 25x25m con 10 jugadores realizando una secuencia continua de pases y movimientos: control orientado, pase de cara, apoyo, pared y giro, avisando en voz alta cada acción (ej. "de cara", "gira"). Cada jugador rota siguiendo un orden fijo tras su intervención, repitiendo el circuito para automatizar los conceptos técnicos individuales encadenados.',
     'tecnico', 'tecnica', '+U11', 'Cuadrado 25x25m', '10', 12),

    ('Rondo cuadrado 7x3 con miniporterías',
     'Espacio de 18x24m con miniporterías repartidas que dividen la zona. Siete atacantes mantienen la posesión a un máximo de dos toques frente a tres defensores, de los que solo dos pueden estar a la vez cerca del balón. Cada pase que atraviesa una minipotería suma un punto para los atacantes; también existe una variante en la que los defensores, al robar, pueden marcar en esas mismas porterías.',
     'rondo', 'tactica', '+U13', 'Rectángulo 18x24m con miniporterías', '10', 12),

    ('Rueda de pase en hexágono con 3 variantes',
     'Doce jugadores distribuidos en los seis vértices de un hexágono de 25x18m, ejecutando tres secuencias de pase de dificultad creciente: una circulación simple de vértice en vértice, una variante con pases en diagonal y control orientado, y una tercera que añade desmarques de apoyo y combinaciones cruzadas. Se prioriza la precisión del pase y del control antes de aumentar el ritmo.',
     'tecnico', 'tecnica', '+U11', 'Hexágono 25x18m', '12', 12),

    ('Juego de posición: ataque en superioridad y ocupación de espacios',
     'En tres cuartos de un campo de fútbol 7, nueve atacantes (2-3-1-3) juegan contra ocho defensores (3-3-2), iniciando los centrales atacantes con el balón. El equipo atacante busca circular el balón, encontrar jugadores libres de cara y atacar los espacios que deja el bloque defensivo, sumando puntos al recibir en una zona marcada (con regla de fuera de juego) o al marcar gol desde ahí. El equipo defensor, al recuperar, puede finalizar en tres miniporterías repartidas por el campo.',
     'posesion', 'tactica', '+U15', 'Tres cuartos de campo de fútbol 7', '17', 18),

    ('Transiciones ofensivas: ataque rápido en superioridad y defensa aérea',
     'Campo de 60x45m con tres equipos de 4 jugadores más 2 apoyos y un comodín ofensivo. El equipo en ataque juega contra una defensa de 4, pudiendo sumar al comodín si un atacante se retrasa a la zona media para no perder el equilibrio. Tras gol, robo, balón fuera o parada del portero, se cambia rápidamente de equipo atacante para practicar el contraataque inmediato, la ocupación de las zonas de remate y rechace, y la defensa del área ante centros.',
     'transiciones', 'tactica', '+U15', 'Campo 60x45m', '15', 15),

    ('Salida de balón bajo presión alta y conexión con jugadores alejados',
     'Campo de 65x50m dividido en dos zonas con una franja central "prohibida" donde no se puede recibir ni conducir, solo transitar. Cada equipo juega con 9 jugadores de campo y portero (10 contra 10 en total) y puede desplazar libremente a un jugador de una zona a otra, generando superioridades variables (6x4, 6x3, 7x4). El equipo que inicia debe encontrar el momento de enviar el balón a la otra zona mediante un pase tenso a un compañero que ya haya cruzado la franja central, un balón al espacio, o un balón dividido para pelear la segunda jugada; los reinicios son siempre desde la portería.',
     'salida_presion', 'tactica', '+U15', 'Campo 65x50m dividido en 2 zonas', '20', 18)
)
INSERT INTO ejercicios (deporte_id, titulo, descripcion, tipologia, naturaleza, categoria_edad, espacio, num_jugadores, duracion_min)
SELECT df.id, n.titulo, n.descripcion, n.tipologia, n.naturaleza, n.categoria_edad, n.espacio, n.num_jugadores, n.duracion_min
FROM nuevos n, deporte_futbol df
WHERE NOT EXISTS (
    SELECT 1 FROM ejercicios e WHERE e.titulo = n.titulo AND e.deporte_id = df.id
);
