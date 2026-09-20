-- =====================================================================
-- NUBAPP - Banco de ejercicios inicial para Fútbol
-- =====================================================================
-- El banco de ejercicios estaba vacío (se crea desde la app, pero hace
-- falta un punto de partida). Esta migración añade una primera tanda de
-- ejercicios reales, cubriendo las tipologías ya contempladas en
-- 03_schema_ejercicios.sql (calentamiento, rondo, partido_condicionado,
-- juego_reducido, tecnico, fisico, posesion, finalizacion, transiciones).
--
-- Idempotente: comprueba por título antes de insertar, así que se puede
-- ejecutar en cada arranque del contenedor sin duplicar nada. Los
-- entrenadores pueden seguir añadiendo, editando o borrando ejercicios
-- libremente desde la app; esto es solo la semilla inicial.
-- =====================================================================

WITH deporte_futbol AS (
    SELECT id FROM deportes WHERE nombre = 'Futbol'
),
nuevos (titulo, descripcion, tipologia, naturaleza, categoria_edad, espacio, num_jugadores, duracion_min) AS (
    VALUES
    -- Calentamiento
    ('Activación con balón y movilidad',
     'Cada jugador con balón: conducción libre variando ritmo (suave/rápido) y superficie de contacto (interior, exterior, planta) por todo el espacio. Cada 30-40s, parar y hacer 2-3 movilizaciones articulares (tobillo, cadera, rodilla) sin soltar el balón. Terminar con toques de balón parado (10 con cada pierna).',
     'calentamiento', 'fisica', '+U9', 'Medio campo', '8-20', 10),

    ('Rondo de activación 5x2 a ritmo controlado',
     'Rondo clásico en espacio amplio (8-10m de lado) para activar la circulación de balón y la orientación corporal antes de la parte principal. Se juega a dos toques, sin presión intensa, priorizando la calidad del primer control y del pase. Rotar a los dos "topos" cada 2 minutos.',
     'rondo', 'tecnica', '+U11', 'Cuadrado 10x10m', '7', 8),

    -- Rondo
    ('Rondo 4x1 a un toque',
     'Cuatro jugadores forman un cuadrado de 6x6m con un defensor en el centro. Un toque obligatorio para los atacantes; el defensor que recupera cambia con quien perdió el balón. Trabaja el control orientado previo (con el cuerpo ya perfilado) y la velocidad de circulación.',
     'rondo', 'tecnica', '+U13', 'Cuadrado 6x6m', '5', 12),

    ('Rondo 6x2 con salida a portería',
     'Rondo posicional 6 contra 2 en un espacio de 12x12m; cuando los atacantes encadenan 6 pases seguidos, el jugador que recibe el sexto pase puede salir conduciendo hacia una portería pequeña colocada fuera del rondo y rematar. Combina posesión con transición a finalización.',
     'rondo', 'tactica', '+U13', 'Cuadrado 12x12m + 1 portería pequeña', '8', 12),

    -- Partido condicionado
    ('Partido a dos toques',
     'Partido normal en campo reducido con la única condición de que ningún jugador puede dar más de dos toques seguidos al balón. Fomenta la velocidad de decisión, el apoyo constante de los compañeros y la calidad del primer control.',
     'partido_condicionado', 'tecnica', '+U13', 'Campo reducido (40x30m)', '14-18', 15),

    ('Partido con gol validado tras 3 pases',
     'Partido condicionado donde un gol solo cuenta si el equipo ha completado al menos 3 pases seguidos antes del disparo. Obliga a construir el ataque con paciencia en vez de buscar la verticalidad inmediata, y a los defensores a decidir cuándo presionar la salida de balón.',
     'partido_condicionado', 'tactica', '+U15', 'Campo reducido (50x35m)', '14-20', 20),

    -- Juego reducido
    ('4 contra 4 + porteros en espacio reducido',
     'Formato reducido con dos porterías pequeñas y portero en cada una, en un espacio de unos 25x20m. Genera muchas situaciones de 1v1, decisiones rápidas de pase-conducción y transiciones constantes al perder/recuperar. Ideal para repetir principios tácticos con muchas repeticiones por jugador.',
     'juego_reducido', 'tactica', '+U11', 'Espacio 25x20m + 2 porterías', '8-10', 15),

    ('3 contra 3 con comodín exterior',
     'Dos equipos de 3 juegan en un rectángulo con un comodín que juega siempre a favor del equipo que tiene el balón, situado en el lateral del espacio. El comodín no puede ser presionado dentro del área exterior marcada. Facilita la superioridad numérica y la circulación rápida en amplitud.',
     'juego_reducido', 'tactica', '+U13', 'Rectángulo 20x15m + banda exterior', '7', 12),

    -- Técnico
    ('Circuito de conducción y cambios de dirección',
     'Circuito con conos marcando 4-5 cambios de dirección (en forma de zigzag, eslalon y giro de 180º). Los jugadores lo recorren conduciendo el balón, alternando pierna dominante y no dominante en tandas sucesivas. Terminar cada pasada con un pase o disparo a portería pequeña.',
     'tecnico', 'tecnica', '+U9', 'Pasillo de 15m con conos', '6-12', 12),

    ('Golpeo y control orientado por parejas',
     'Por parejas, separadas 10-12m: pase raso, control orientado hacia un lado (marcado con conos) y devolución. Cada 5 repeticiones se cambia el lado de control y, más adelante, se introduce un defensor pasivo que obliga a decidir el lado de control en función de su posición.',
     'tecnico', 'tecnica', '+U11', 'Espacio abierto, parejas separadas', '8-16', 15),

    -- Físico
    ('Circuito de velocidad y cambios de ritmo',
     'Series de 15-20m combinando arrancada, frenada y cambio de dirección a máxima intensidad, con balón en la mitad de las repeticiones y sin balón en la otra mitad para comparar la pérdida de velocidad al conducir. Recuperación completa entre series (1:4 esfuerzo-descanso).',
     'fisico', 'fisica', '+U15', 'Pasillo de 20m', '8-16', 15),

    ('Trabajo de fuerza-resistencia con balón',
     'Circuito de estaciones (plancha, zancadas, salto a dos piernas, skipping) intercalado con una estación técnica con balón (toques, conducción corta) para mantener la activación neuromuscular específica del fútbol mientras se trabaja fuerza-resistencia de tren inferior y core.',
     'fisico', 'fisica', 'Senior', 'Zona de circuito con 5-6 estaciones', '10-16', 20),

    -- Posesión
    ('Posesión 5 contra 5 más 3 comodines',
     'Dos equipos de 5 juegan la posesión con 3 comodines neutrales que siempre juegan con el equipo que tiene el balón (superioridad 8v5). Objetivo: mantener el balón un número mínimo de pases marcado por el entrenador antes de poder buscar portería (si hay porterías) o simplemente contar pases.',
     'posesion', 'tactica', '+U15', 'Campo reducido (35x25m)', '13', 15),

    ('Rondo posicional 8 contra 8 en dos líneas',
     'Juego de posición con dos equipos de 8 organizados en líneas (defensa-medio-ataque) dentro de un espacio grande dividido en 3 carriles. Limitar el número de jugadores por carril obliga a buscar líneas de pase entre líneas y a los rivales a decidir a quién presionar. Muy útil para trabajar el modelo de juego con balón.',
     'posesion', 'tactica', 'Senior', 'Campo grande dividido en 3 carriles', '16', 20),

    -- Finalización
    ('Finalización tras centro lateral',
     'Un jugador conduce por banda y centra hacia el área, donde 2-3 delanteros atacan el primer y segundo palo con desmarques cruzados mientras un defensor (o dos) intenta despejar. Rotar las posiciones (banda, área, defensa) cada 4-5 repeticiones.',
     'finalizacion', 'tecnica', '+U13', 'Media área + banda', '6-10', 15),

    ('1 contra 1 con finalización tras conducción',
     'El atacante recibe de espaldas o de cara, encara al defensor en conducción y busca un regate o un cambio de ritmo para llegar a rematar a portería. El defensor parte con una ligera ventaja de posición para ajustar la dificultad según el nivel del grupo.',
     'finalizacion', 'tecnica', '+U11', 'Media área con portería', '4-10', 12),

    -- Transiciones
    ('4 contra 4 con transición ofensiva-defensiva',
     'Juego reducido con dos porterías donde, en el momento de la pérdida o recuperación del balón, el entrenador da una señal (silbato/voz) que obliga a un cambio de roles inmediato: el equipo que ataca debe replegar y el que defendía debe atacar rápido antes de que el rival se reorganice.',
     'transiciones', 'tactica', '+U13', 'Espacio 30x20m + 2 porterías', '8-10', 15),

    ('Transición 3 contra 3 más 3 tras recuperación',
     'Se enfrentan 3 contra 3 en un espacio central; al recuperar el balón, el equipo recuperador puede sumar a 3 compañeros que esperan fuera del espacio, generando una superioridad momentánea (6v3) para atacar rápido dos porterías situadas a ambos lados antes de que el rival se replantee la defensa.',
     'transiciones', 'tactica', '+U15', 'Espacio central + 2 porterías laterales', '9', 18)
)
INSERT INTO ejercicios (deporte_id, titulo, descripcion, tipologia, naturaleza, categoria_edad, espacio, num_jugadores, duracion_min)
SELECT deporte_futbol.id, nuevos.titulo, nuevos.descripcion, nuevos.tipologia, nuevos.naturaleza,
       nuevos.categoria_edad, nuevos.espacio, nuevos.num_jugadores, nuevos.duracion_min
FROM nuevos, deporte_futbol
WHERE NOT EXISTS (
    SELECT 1 FROM ejercicios e
    WHERE e.titulo = nuevos.titulo AND e.deporte_id = deporte_futbol.id
);
