-- =====================================================================
-- NUBAPP - Banco de ejercicios de Fútbol: tercera tanda desde la web de
-- referencia de Sergio (partido condicionado, rondos, rueda de pase,
-- juego de posición y acciones combinadas)
-- =====================================================================
-- Continuación de 17_seed_ejercicios_futbol_variado_2.sql: siguiente
-- página de alexortizentrenador.com/category/ejercicios (ejercicios 23
-- al 32). Igual que las tandas anteriores, están redactados de nuevo
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
    ('Juego de posición: amplitud, profundidad y conexión con comodines de banda',
     'Dos equipos de 7 más 2 comodines situados en los extremos laterales, en un espacio de 40x35m. El equipo en posesión circula el balón en amplitud y profundidad para alcanzar al comodín del lado opuesto; al recuperar, el equipo defensor elige con qué comodín combinar para atacar en profundidad. Se juega a tres toques (los comodines, fijos en su banda, a dos) y sí se puede robar a los comodines. Se suma un punto al llevar el balón de un comodín a otro y otro por cada racha de 12 pases seguidos, pudiendo acumularse ambos en la misma posesión.',
     'posesion', 'tactica', '+U13', 'Campo 40x35m', '16', 15),

    ('Rondo de posesión con 3 equipos y superación de la primera oleada',
     'Tres equipos de 5 jugadores en un espacio de 36x25m: dos equipos empiezan en posesión mientras el tercero defiende, con 3 jugadores en la zona activa y 2 en la zona intermedia tratando de interceptar el pase hacia el otro lado. Se juega a dos toques y hacen falta 7 pases seguidos antes de poder enviar el balón a la zona contraria. Cuando el equipo en posesión pierde el balón, se envía un balón nuevo a la zona contraria: el equipo que lo perdió pasa a defender y el que esperaba empieza a atacar, trabajando la búsqueda de hombres libres, el concepto de tercer hombre y la defensa en inferioridad con triángulo defensivo.',
     'posesion', 'tactica', '+U13', 'Campo 36x25m', '15', 15),

    ('Rondo posicional con salida en juego directo',
     'Con 21 jugadores en tres cuartos de campo, se combinan una zona de rondo en superioridad (con el portero iniciando la posesión a dos toques) y otra de juego directo, donde esperan 5 defensores más portero frente a 4 atacantes. Cuando el rondo encuentra un receptor libre, envía un balón largo a la zona de juego directo; en ese momento se suman tres jugadores más (dos atacantes y un defensor), convirtiendo el 5x4 en un 6x6 a toque libre, buscando superar la primera línea, lanzar a zonas prefijadas y aprovechar la segunda jugada. Si los defensores recuperan en la zona de rondo pueden finalizar directamente; si reciben ya en la zona de juego directo, los atacantes deben recuperar el balón antes de que salga.',
     'rondo', 'tactica', '+U15', 'Tres cuartos de campo 11', '21', 18),

    ('Ataque contra defensa: superar la primera línea de presión',
     'Un equipo de 6 juega en superioridad contra otro de 5 más portero, en un campo de 40x45m dividido en dos zonas. El equipo atacante circula el balón en la zona 1 buscando superar la primera línea de presión con una pared, una conducción o un pase con dejada; solo un atacante puede pasar a la zona 2, donde los defensores (que no pueden salir de su zona y marcan al hombre) se ven en inferioridad 4 contra 3 y deben evitar la finalización. Si pierden el balón antes de progresar, el entrenador introduce un balón nuevo en la zona 1 para reiniciar.',
     'partido_condicionado', 'tactica', '+U13', 'Campo 40x45m dividido en 2 zonas', '12', 15),

    ('Acciones combinadas: tercer hombre, centro lateral y remate',
     'Con 22 jugadores en tres cuartos de campo se trabajan dos secuencias combinadas de ataque en paralelo: una central, con una pared y un desdoblamiento que termina en un pase en profundidad para centrar desde banda; y otra por el lado contrario, con un apoyo, un cambio de orientación, una dejada y un desmarque de ruptura que termina también en centro y remate, incluyendo una salida y reentrada del rematador para llegar de nuevo al área. El objetivo es automatizar el concepto de tercer hombre, los desmarques de ruptura y la finalización tras centro lateral.',
     'tecnico', 'tactica', '+U15', 'Tres cuartos de campo 11', '22', 15),

    ('Juego de posición: circulación en amplitud y profundidad',
     'Dos equipos de 7 más 3 comodines, uno por cada zona horizontal, en un espacio de 40x30m jugando a tres toques. El equipo en posesión debe mantener siempre una relación 2 contra 2 en la zona central mientras los comodines se mueven solo por ahí y los jugadores de banda no pueden abandonar su zona; el equipo defensor se compacta y presiona la zona activa, cambiando de rol al recuperar el balón. Encadenar 12 pases seguidos suma un punto, buscando la circulación en amplitud y profundidad con una ocupación racional del espacio central.',
     'posesion', 'tactica', '+U15', 'Campo 40x30m', '17', 15),

    ('Posesión con conexión al comodín central (portero)',
     'Dos equipos de 6 más dos comodines, con el portero situado en un cuadrado central dentro de un espacio de 40x36m dividido en tres zonas (exterior para el atacante, intermedia para el defensor y central para el portero). El equipo en posesión, en la zona exterior, debe combinar hasta encontrar una línea de pase que conecte con el portero, mientras el equipo defensor cierra esas líneas desde la zona intermedia; se juega a tres toques máximo. Cada pase completado al portero suma un punto, y si los defensores lo interceptan, ambos equipos intercambian sus roles.',
     'posesion', 'tactica', '+U13', 'Campo 40x36m en 3 zonas', '15', 15),

    ('Rueda de pase: orientación corporal y líneas de pase con dos balones',
     'Rueda de pase de 10 jugadores colocados en seis postas (A a F) en un espacio de 30x30m, trabajando con dos balones a la vez desde dos puntos distintos del circuito. La secuencia combina un toque directo, un cambio de ritmo en conducción superando un cono, y una línea de pase previa simulando desmarcarse de un rival antes de dar el pase, todo con rotación alfabética de los jugadores tras cada intervención.',
     'tecnico', 'tecnica', '+U11', 'Campo 30x30m', '10', 12),

    ('Rondo con posiciones específicas y concepto de tercer hombre',
     'Dos equipos de 4 más 3 comodines fijos en sus zonas, en un espacio de 28x20m, jugando todos a dos toques. El equipo en posesión debe circular el balón con la máxima amplitud posible, llevándolo de una zona horizontal a otra y apoyándose en los comodines para aplicar el concepto de tercer hombre; cada 10 pases seguidos suma un punto. Con la pérdida de balón o si este sale del terreno, los equipos cambian de rol.',
     'rondo', 'tactica', '+U13', 'Campo 28x20m', '11', 12),

    ('Partido condicionado: centros laterales y ocupación de segunda jugada',
     'Dos equipos de 9 (esquema 1-3-3-2) más 2 comodines exteriores que juegan siempre con el equipo en posesión y no pueden ser robados, en un campo de 60x50m con marcas junto a ambas porterías para anticipar rechaces. Se juega a tres toques (dos los comodines), sin saques de banda ni de esquina —todo se reinicia desde portería— y se prima el juego por fuera: un gol tras centro lateral vale 2 puntos, y un gol tras segunda jugada vale 1.',
     'partido_condicionado', 'tactica', '+U15', 'Campo 60x50m', '20', 18)
)
INSERT INTO ejercicios (deporte_id, titulo, descripcion, tipologia, naturaleza, categoria_edad, espacio, num_jugadores, duracion_min)
SELECT df.id, n.titulo, n.descripcion, n.tipologia, n.naturaleza, n.categoria_edad, n.espacio, n.num_jugadores, n.duracion_min
FROM nuevos n, deporte_futbol df
WHERE NOT EXISTS (
    SELECT 1 FROM ejercicios e WHERE e.titulo = n.titulo AND e.deporte_id = df.id
);
