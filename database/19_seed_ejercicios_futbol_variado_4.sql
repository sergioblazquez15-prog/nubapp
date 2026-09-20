-- =====================================================================
-- NUBAPP - Banco de ejercicios de Fútbol: cuarta tanda desde la web de
-- referencia de Sergio (ataque ante bloque bajo, rondos posicionales,
-- ataque contra defensa y partidos condicionados)
-- =====================================================================
-- Continuación de 18_seed_ejercicios_futbol_variado_3.sql: siguiente
-- página de alexortizentrenador.com/category/ejercicios (ejercicios 13
-- al 22). Igual que las tandas anteriores, están redactados de nuevo
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
    ('Ataque ante bloque bajo: amplitud e incorporaciones de segunda línea',
     'Veintiún jugadores (10 atacantes contra 9 defensores más portero y un comodín) trabajan en tres cuartos de campo de fútbol 11 el ataque frente a un bloque replegado. El equipo defensor se cierra en zona baja y solo puede puntuar si consigue combinar con el comodín; el equipo atacante únicamente puntúa marcando gol, por lo que debe abrirse en amplitud, buscar el desmarque de ruptura y apoyarse en las incorporaciones desde segunda línea para encontrar huecos en un bloque muy junto.',
     'partido_condicionado', 'tactica', '+U15', 'Tres cuartos de campo 11', '21', 18),

    ('Rondo posicional en banda con centro y remate',
     'Trece jugadores (un 5 contra 5 más 2 comodines y un portero) juegan en un espacio de 20x24m más el área de finalización. Los atacantes buscan mantener la posesión con ayuda de los comodines para habilitar a un jugador de banda y centrar hacia el área, donde esperan compañeros para rematar; los defensores, si recuperan, suman punto completando 5 pases seguidos con los comodines antes de que el equipo atacante pueda volver a presionar.',
     'rondo', 'tactica', '+U13', '20x24m + área de finalización', '13', 15),

    ('Rondo de posesión posicional con cambios de rol',
     'Nueve jugadores repartidos en tres equipos de tres, en un espacio de 24x18m con disposición 2-1, trabajan la posesión en superioridad continua: dos equipos se alían para mantener el balón frente al tercero, que defiende. Encadenar 10 pases seguidos suma un punto; con la pérdida, el equipo que tenía el balón pasa a defender y el que esperaba se incorpora a la posesión, obligando a cambios de rol constantes y a una reorganización posicional rápida.',
     'rondo', 'tactica', '+U13', 'Rectángulo 24x18m', '9', 15),

    ('Ataque contra defensa: conectar zonas superando líneas de presión',
     'Veintiún jugadores (2 equipos de 10 más un comodín) juegan en un campo dividido en tres zonas, donde el equipo atacante debe hacer llegar el balón de la zona de inicio a la de finalización superando las líneas de presión del rival con pases interiores y apoyos del comodín. Un gol tras ataque organizado, llevando el balón progresivamente por las tres zonas, vale 2 puntos; un gol logrado tras una transición rápida tras robo vale 1 punto, primando la paciencia y la conexión entre líneas sobre la verticalidad inmediata.',
     'partido_condicionado', 'tactica', '+U15', 'Campo en 3 zonas', '21', 18),

    ('Ataque contra defensa: basculaciones y ejes de finalización',
     'Catorce jugadores (2 equipos de 6 más 2 comodines) juegan en un espacio de 30x32m un ataque contra defensa donde el equipo defensor debe bascular en bloque para cerrar las líneas de pase hacia los comodines y hacia el delantero. Un gol marcado por un comodín o tras un pase de línea vale 1 punto; un gol marcado directamente por el delantero, que exige superar antes la basculación defensiva, vale 2 puntos, incentivando que el ataque busque distintos ejes de finalización.',
     'partido_condicionado', 'tactica', '+U15', '30x32m', '14', 15),

    ('Partido con restricción de pases por cuadrante: movilidad y circulación',
     'Dieciséis jugadores (2 equipos de 9 más 2 comodines) juegan en un campo de fútbol 7 (o en tres cuartos de un campo de fútbol 11) con la norma de no poder dar más de dos pases seguidos dentro del mismo cuadrante del campo. La restricción obliga a los jugadores a moverse constantemente para ofrecer líneas de pase en cuadrantes distintos y a aumentar la velocidad de circulación del balón, favoreciendo el desmarque de apoyo y la búsqueda de espacios libres antes de que el rival pueda cerrar la zona.',
     'partido_condicionado', 'tactica', '+U15', 'Campo de fútbol 7 o 3/4 de campo 11', '16', 18),

    ('Rondo 3º hombre: posesión en superioridad y conexión de zonas',
     'Doce jugadores (6 en posesión, 4 defensores y 2 comodines) juegan en un espacio de 35x20m dividido en dos zonas laterales con un comodín central de conexión. El equipo en posesión debe trasladar el balón de una zona lateral a la otra pasando siempre por el comodín central, aplicando el concepto de tercer hombre, mientras los defensores tratan de anticipar esa conexión e interceptar el pase de vuelta.',
     'rondo', 'tactica', '+U13', '35x20m en 2 zonas', '12', 15),

    ('Juego de posesión con desmarques y pases al espacio',
     'Dieciséis jugadores (2 equipos de 7 más 2 comodines) juegan en un espacio de 40x30m con cuatro cuadrados marcados en cada esquina. El equipo en posesión suma un punto cada vez que un compañero recibe dentro de uno de esos cuadrados de esquina, para lo cual necesita anticipar el desmarque y ejecutar un pase al espacio en el momento justo, mientras el equipo defensor trata de cerrar el acceso a esas zonas y de presionar la salida del balón.',
     'posesion', 'tactica', '+U13', '40x30m con cuadrados de esquina', '16', 15),

    ('Rondo de posesión con trabajo posicional de mediocentros',
     'Diez jugadores (2 equipos de 4 más 2 comodines que hacen de mediocentros) juegan un rondo en un espacio de 14x14m a tres toques (los comodines a dos). El equipo en posesión suma un punto al encadenar 12 pases seguidos o al conseguir que el balón pase por todos los cuadrantes del espacio, mientras los comodines, siempre a favor del equipo con balón, se colocan buscando ofrecer una salida limpia entre líneas como lo haría un mediocentro posicional.',
     'rondo', 'tactica', '+U13', 'Cuadrado 14x14m', '10', 12),

    ('Partido reducido: circulación en amplitud, basculaciones y deslizamientos',
     'Dos equipos de 9 (esquema 1-3-4-1) juegan en un campo de fútbol 7 con una pica situada en cada banda a la altura del medio campo. Un gol marcado tras un centro lateral vale 2 puntos, rodear la pica de la banda antes de continuar la jugada suma 1 punto, y un gol logrado tras cualquier otro tipo de ataque vale 1 punto, lo que empuja a ambos equipos a circular en amplitud y obliga a la defensa a bascular y deslizarse en bloque para cubrir las bandas.',
     'partido_condicionado', 'tactica', '+U15', 'Campo de fútbol 7', '18', 18)
)
INSERT INTO ejercicios (deporte_id, titulo, descripcion, tipologia, naturaleza, categoria_edad, espacio, num_jugadores, duracion_min)
SELECT df.id, n.titulo, n.descripcion, n.tipologia, n.naturaleza, n.categoria_edad, n.espacio, n.num_jugadores, n.duracion_min
FROM nuevos n, deporte_futbol df
WHERE NOT EXISTS (
    SELECT 1 FROM ejercicios e WHERE e.titulo = n.titulo AND e.deporte_id = df.id
);
