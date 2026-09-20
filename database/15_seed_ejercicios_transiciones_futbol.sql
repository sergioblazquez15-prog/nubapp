-- =====================================================================
-- NUBAPP - Banco de ejercicios de Fútbol: transiciones en espacio reducido
-- =====================================================================
-- Sergio pasó un ebook de referencia sobre transiciones ofensivas y
-- defensivas en espacio reducido (contraataque). Esta migración añade 20
-- ejercicios de tipología "transiciones" a partir de esa idea, redactados
-- de nuevo con nuestras propias palabras (no es una copia literal del
-- documento original) y adaptados al formato del banco de ejercicios de
-- la app.
--
-- Idempotente: comprueba por título antes de insertar, así que se puede
-- ejecutar en cada arranque del contenedor sin duplicar nada.
-- =====================================================================

WITH deporte_futbol AS (
    SELECT id FROM deportes WHERE nombre = 'Futbol'
),
nuevos (titulo, descripcion, tipologia, naturaleza, categoria_edad, espacio, num_jugadores, duracion_min) AS (
    VALUES
    ('Rondo 5x3 con finalización',
     'Rondo de posesión 5x3: cinco atacantes rodean un cuadrado (uno de ellos simulando de mediapunta) mientras tres defensores intentan robar el balón en el interior. En cuanto lo consiguen, deben atacar la portería lo antes posible; los atacantes más cercanos pasan a defender, generando una transición 3x3 hacia portería.',
     'transiciones', 'tactica', '+U13', 'Área/zona de finalización', '9', 12),

    ('Transición 3x2 con repliegue defensivo',
     'Oleadas de ataque 3x2 en las que, nada más iniciar el atacante la conducción, un tercer defensor sale corriendo a repliegue para intentar frenarlo antes de que el equipo atacante llegue con superioridad a la finalización; si no llega a tiempo, se suma a los otros dos defensores que ya esperan la oleada.',
     'transiciones', 'tactica', '+U13', 'Medio campo reducido', '7', 10),

    ('Cambio de orientación y finalización 2x2',
     'El atacante de un lado inicia un cambio de juego hacia el compañero del lado contrario, que recibe presionado por el defensor que le sigue. El defensor del lado que originó el pase intenta evitar el cambio de orientación; si no lo consigue, recupera posición para defender al jugador que inició la jugada.',
     'transiciones', 'tactica', '+U11', 'Doble área', '5', 10),

    ('Pared y transición 3x2',
     'Se inicia con una pared del equipo atacante que finaliza en la portería contraria. Nada más rematar, esos dos jugadores pasan a defender el contraataque de tres rivales que arrancan desde la portería donde se produjo el disparo, generando una transición 3x2 inmediata.',
     'transiciones', 'tactica', '+U13', 'Doble área', '7', 12),

    ('Transición 2x2 con dos comodines',
     'Un comodín exterior inicia la jugada buscando el apoyo de dos atacantes situados en el interior; en cuanto se combinan, se suman los dos comodines para atacar con superioridad 4x2, mientras los defensores intentan cortar antes esa conexión interior.',
     'transiciones', 'tactica', '+U13', 'Doble área', '7', 10),

    ('Transición 2x2 con comodines y doble contraataque',
     'Continuación del ejercicio de comodines: tras acabar la jugada de ataque con superioridad, el portero saca rápido con los jugadores que antes defendían, que ahora aprovechan a los mismos comodines para atacar con superioridad numérica la portería contraria.',
     'transiciones', 'tactica', '+U15', 'Doble área', '9', 12),

    ('Ataque en superioridad y transición 3x2',
     'El ataque arranca en superioridad, aunque el jugador que inicia la jugada es perseguido por un defensor que intenta igualar el número de atacantes antes de que finalicen. Al acabar la jugada, un jugador del equipo defensor sale rápido desde la banda para sumarse a sus compañeros y atacar con un 3x2 a los dos atacantes anteriores, que ahora deben defender.',
     'transiciones', 'tactica', '+U13', 'Doble área', '7', 10),

    ('Transición 4x3 con búsqueda de juego interior',
     'Ejercicio con formato de partido en tres zonas: el portero inicia jugando con sus defensas bajo la presión de tres atacantes rivales, buscando un pase interior hacia la zona media donde esperan tres compañeros más y un comodín. Si el balón llega, se lanza un contraataque de 4x3 hacia la portería contraria; si hay pérdida, robo o parada, se juega en directo, y tras cada finalización se intercambian los roles de presión y espera entre los dos equipos.',
     'transiciones', 'tactica', '+U15', 'Campo dividido en 3 zonas', '15', 15),

    ('Transiciones múltiples 5x3',
     'Ambos equipos se colocan en la zona de saque del portero. El equipo que ataca cuenta con el apoyo de comodines para generar una superioridad 5x3 y buscar la finalización con el menor número de toques posible. Cada vez que se finaliza en una portería, salen tres jugadores nuevos de esa zona y el equipo que atacaba pasa a defender.',
     'transiciones', 'tactica', '+U15', 'Doble área + comodines', '12', 15),

    ('Conservación en zona intermedia y transición 4x2',
     'Campo dividido en tres zonas, con el juego arrancando siempre en la zona media, donde un equipo debe mantener la posesión. Si el equipo que defiende roba el balón, lanza un contraataque hacia la zona de finalización con ayuda de dos comodines de banda, pero solo participan los dos atacantes más adelantados, defendidos por los dos centrales más cercanos a portería. Si el equipo que mantiene la posesión completa 10 pases sin que se la corten, puede atacar directamente la portería contraria.',
     'transiciones', 'tactica', '+U15', 'Campo dividido en 3 zonas', '12', 15),

    ('Ataque en superioridad 2x1 y transición 3x2',
     'El equipo atacante juega primero en superioridad buscando gol. En el momento en que marcan, deben recuperarse rápido para defender, ya que dos jugadores de banda se suman al defensor inicial para atacar la portería contraria, convirtiendo la jugada en una transición 3x2.',
     'transiciones', 'tactica', '+U11', 'Doble área', '6', 10),

    ('Juego interior y transición 5x3',
     'El portero juega con uno de sus defensas bajo la presión de un atacante rival, buscando enviar un pase al delantero situado en la otra zona. Si el delantero recibe, ataca junto a cuatro comodines cercanos la portería de esa zona, donde le esperan tres defensores rivales. Si se finaliza, los equipos intercambian roles; si hay robo, pérdida o parada del portero, se continúa jugando en directo.',
     'transiciones', 'tactica', '+U15', 'Campo dividido en 2 zonas', '13', 15),

    ('Rondo 4x3 y transición 5x3 en zona contraria',
     'El portero y tres compañeros arman un rondo frente a tres defensores. Si consiguen encadenar varios pases seguidos, pueden salir a atacar la otra zona, donde dos delanteros propios esperan defendidos por tres centrales, generando una transición 5x3. Si en cambio pierden el rondo, deben defender de inmediato el ataque en su propia portería.',
     'transiciones', 'tactica', '+U15', 'Campo dividido en 2 zonas', '11', 15),

    ('Finalización individual y transición 3x2',
     'El atacante debe rematar antes de superar una línea de conos, mientras un defensor sale a impedir el disparo en cuanto arranca la conducción. Desde esa portería salen entonces dos jugadores del equipo que defendía para atacar la portería contraria junto al defensor que evitó el disparo, generando una transición 3x2 con la ayuda de otro defensor que se suma por el lado izquierdo.',
     'transiciones', 'tactica', '+U13', 'Doble área', '6', 10),

    ('Transición 2x2 con salida sorpresa',
     'Un equipo decide de antemano por qué lado saldrá en conducción, y justo al iniciar la jugada salen dos defensores para formar un 2x2 que el equipo atacante debe resolver con rapidez. Nada más finalizar, el portero juega con los dos defensores de esa fase para atacar la portería contraria, intercambiándose los roles entre ambos equipos.',
     'transiciones', 'tactica', '+U13', 'Doble área', '9', 10),

    ('Ataque y defensa 1x1 con apoyos',
     'La jugada arranca con un pase entre dos compañeros situados a un lado. El jugador de la zona central da continuidad hacia el lado contrario, desde donde llega un centro para que el compañero remate a puerta, defendido en un 1x1 por el jugador central, que debe evitar la finalización; si roba el balón, puede rematar él mismo en la portería contraria.',
     'transiciones', 'tecnica', '+U9', 'Doble área', '4', 8),

    ('Transición 1x1 con engaño del atacante',
     'En zona central, un jugador cede el balón a su rival directo, que decide libremente a qué portería atacar mientras es defendido por el mismo compañero que le ha dado el pase. Se fomenta el uso de amagos y cambios de dirección para sorprender al defensor y atacar la portería contraria a la esperada.',
     'transiciones', 'tecnica', '+U9', 'Zona central', '2', 8),

    ('Transición 2x2 con obstáculo',
     'Un jugador combina con su portero, que envía el balón largo hacia la banda que elija. Dos atacantes deben llegar antes que sus marcadores para finalizar en la portería contraria. Como dificultad añadida, todos deben rodear unos conos antes de salir a por el balón, arrancando en el momento en que se produce el primer pase al portero.',
     'transiciones', 'tactica', '+U11', 'Doble área', '5', 10),

    ('Salida de presión 2x1 y transición 3x2',
     'El portero juega con uno de sus defensas, que busca de inmediato al delantero situado en la otra zona. En cuanto el delantero controla, se suman dos compañeros de banda para atacar en un 3x2 a los dos centrales de esa zona. Si el balón se pierde, el equipo contrario ataca de vuelta con su delantero y sus dos jugadores de banda.',
     'transiciones', 'tactica', '+U13', 'Campo dividido en 2 zonas', '9', 12),

    ('Salida de presión y transición 4x2',
     'El portero juega con el jugador de su zona. En cuanto saca, dos rivales llegan corriendo desde banda para evitar que conecte con sus cuatro compañeros de la otra zona; si lo consigue, se lanza un contraataque 4x2 contra los dos centrales que esperan allí. Al finalizar la jugada, el portero de esa portería combina con sus centrales buscando un pase a la zona de origen, donde se genera un nuevo 2x1 contra el jugador que presionó al principio.',
     'transiciones', 'tactica', '+U15', 'Campo dividido en 2 zonas', '13', 15)
)
INSERT INTO ejercicios (deporte_id, titulo, descripcion, tipologia, naturaleza, categoria_edad, espacio, num_jugadores, duracion_min)
SELECT df.id, n.titulo, n.descripcion, n.tipologia, n.naturaleza, n.categoria_edad, n.espacio, n.num_jugadores, n.duracion_min
FROM nuevos n, deporte_futbol df
WHERE NOT EXISTS (
    SELECT 1 FROM ejercicios e WHERE e.titulo = n.titulo AND e.deporte_id = df.id
);
