-- =====================================================================
-- NUBAPP - Banco de ejercicios inicial para el resto de deportes
-- =====================================================================
-- Igual que 11_seed_ejercicios_futbol.sql, pero para los demás deportes
-- del club: Baloncesto (con banco amplio, es deporte de equipo como
-- fútbol) y un punto de partida más pequeño para los deportes
-- individuales (Muay Thai, Pádel, Tenis, Patinaje, Gimnasia Rítmica),
-- que hasta ahora tenían el banco completamente vacío.
--
-- Idempotente igual que la anterior: comprueba por título + deporte antes
-- de insertar, así que se puede ejecutar en cada arranque sin duplicar.
-- =====================================================================

WITH nuevos (deporte_nombre, titulo, descripcion, tipologia, naturaleza, categoria_edad, espacio, num_jugadores, duracion_min) AS (
    VALUES
    -- ============================= BALONCESTO =============================
    ('Baloncesto', 'Activación con balón: bote y coordinación',
     'Cada jugador con balón: bote con mano dominante y no dominante alternando, bote bajo/alto, y bote entre las piernas caminando. Cada 30s cambiar de ejercicio. Termina con 10 tiros libres de activación por jugador.',
     'calentamiento', 'fisica', '+U9', 'Media pista', '6-15', 10),

    ('Baloncesto', 'Rondo de pases de activación (piedra)',
     'En grupos de 5-6, un defensor en el centro intenta tocar el balón mientras el resto se pasa en un círculo de 5-6m. Un toque o intercepción cambia al defensor con quien perdió el balón. Solo pase de pecho y picado, sin bote.',
     'rondo', 'tecnica', '+U11', 'Círculo de 6m', '6', 8),

    ('Baloncesto', '3 contra 3 con bote de mano no dominante',
     'Partido de 3x3 a media pista donde solo se puede botar con la mano no dominante (o alternando). Obliga a mejorar el manejo de balón débil y a buscar más el pase que el bote individual.',
     'partido_condicionado', 'tecnica', '+U13', 'Media pista', '6-8', 15),

    ('Baloncesto', '2 contra 2 con bloqueo directo (pick and roll)',
     'Trabajo de bloqueo directo en media pista: un atacante bloquea para el balón y sale a canasta (roll) mientras el otro decide entre tirar, penetrar o pasar al que corta. Empezar sin defensa, luego con defensa pasiva y por último con defensa real.',
     'juego_reducido', 'tactica', '+U15', 'Media pista', '4', 15),

    ('Baloncesto', 'Circuito de bote con cambios de mano',
     'Circuito con conos: cambios de mano por delante, entre las piernas y por la espalda, encadenados en un recorrido en zigzag. Repetir a velocidad progresiva, terminando cada pasada con una entrada a canasta.',
     'tecnico', 'tecnica', '+U9', 'Pasillo con conos', '6-12', 12),

    ('Baloncesto', 'Tiro tras bote y parada en un tiempo',
     'Por parejas o de forma individual: recepción del balón en movimiento, bote de progresión, parada en un tiempo y tiro a canasta. Repetir desde varias posiciones (frontal, ambos laterales) y distancias.',
     'tecnico', 'tecnica', '+U11', 'Media pista', '4-10', 15),

    ('Baloncesto', 'Circuito de agilidad y salto',
     'Circuito con escalera de coordinación, conos para cambios de dirección y una estación de salto vertical (sin balón). Trabaja la base atlética necesaria para defender y saltar a rebotear.',
     'fisico', 'fisica', '+U13', 'Pasillo de 15m', '6-14', 15),

    ('Baloncesto', 'Fuerza-resistencia con balón medicinal',
     'Circuito de lanzamientos de balón medicinal (pecho, por encima de la cabeza, rotación de tronco) combinado con desplazamientos defensivos laterales, para trabajar fuerza de tren superior/core junto con la base defensiva.',
     'fisico', 'fisica', 'Senior', 'Zona de circuito', '8-14', 18),

    ('Baloncesto', 'Rondo de posesión 5 contra 2 en media pista',
     'Cinco atacantes mantienen la posesión frente a dos defensores en media pista, con pase y bote libres. Cambiar a los defensores cada pérdida o cada 90 segundos. Trabaja la lectura de espacios y el pase bajo presión.',
     'posesion', 'tactica', '+U13', 'Media pista', '7', 12),

    ('Baloncesto', 'Bandejas tras contraataque',
     'En parejas, salida desde el poste bajo con pase de béisbol al compañero que corre la banda, terminando en bandeja. Alternar lado izquierdo y derecho, y bandeja con mano dominante y no dominante.',
     'finalizacion', 'tecnica', '+U11', 'Pista completa', '4-10', 12),

    ('Baloncesto', '1 contra 1 hacia el aro con bote de protección',
     'El atacante recibe de espaldas o de cara a 4-5m de canasta y encara al defensor buscando un bote de protección (cuerpo entre balón y defensor) para finalizar. El defensor ajusta la presión según el nivel del grupo.',
     'finalizacion', 'tecnica', '+U13', 'Media pista', '4-8', 12),

    ('Baloncesto', 'Contraataque 3 contra 2 tras rebote',
     'Tres atacantes salen a la contra tras un rebote defensivo tocado por el entrenador, frente a dos defensores que deben replegar desde el otro extremo. Trabaja la superioridad numérica y la decisión de cuándo pasar o finalizar.',
     'transiciones', 'tactica', '+U13', 'Pista completa', '5', 15),

    ('Baloncesto', 'Transición defensiva 4 contra 4 tras pérdida',
     'Juego 4x4 en pista completa donde, tras cada pérdida de balón, el entrenador pita para forzar un repliegue defensivo inmediato del equipo que atacaba, evaluando quién llega primero a proteger el aro.',
     'transiciones', 'tactica', '+U15', 'Pista completa', '8', 15),

    -- ============================= MUAY THAI =============================
    ('Muay Thai', 'Movilidad articular y sombra',
     'Movilidad de cuello, hombros, cadera y tobillos, seguida de 3 rounds de 2 minutos de sombra (boxeo al aire) a ritmo suave, centrando la atención en la guardia y el desplazamiento, no en la potencia.',
     'calentamiento', 'fisica', '+U11', 'Zona de tatami/ring', '4-16', 10),

    ('Muay Thai', 'Combinaciones básicas de puños',
     'Por parejas con paos o en el aire: combinaciones jab-cross, jab-cross-hook, repetidas en series de 10, alternando lado y aumentando el ritmo en la última serie. Énfasis en volver a la guardia después de cada golpe.',
     'tecnico', 'tecnica', '+U13', 'Zona de tatami/ring', '4-16', 15),

    ('Muay Thai', 'Rodillazos y codazos con paos',
     'Trabajo por parejas con paos: rodillazo directo, rodillazo cruzado y codazo horizontal, en series cortas con foco en la cadera (no solo el brazo o la pierna) y en mantener el equilibrio tras cada golpe.',
     'tecnico', 'tecnica', 'Senior', 'Zona de tatami/ring', '4-16', 15),

    ('Muay Thai', 'Circuito de resistencia con saco',
     'Rounds de 2 minutos golpeando el saco a intensidad media-alta, con 1 minuto de descanso activo (movilidad, respiración) entre rounds. 4-5 rounds según nivel, trabajando resistencia específica de combate.',
     'fisico', 'fisica', 'Senior', 'Zona de sacos', '4-10', 15),

    -- ============================= PÁDEL =============================
    ('Padel', 'Peloteo de activación de fondo',
     'Peloteo cruzado desde el fondo de la pista, priorizando la consistencia y la altura por encima de la red, no la potencia. Ir aumentando el ritmo progresivamente durante 8-10 minutos.',
     'calentamiento', 'fisica', '+U11', 'Pista de pádel', '2-4', 10),

    ('Padel', 'Volea de derecha y revés contra pared',
     'Por parejas en la red: series de voleas de derecha y revés sin dejar botar la bola, buscando mantener el peloteo el máximo número de golpes seguidos. Aumentar la distancia entre jugadores progresivamente.',
     'tecnico', 'tecnica', '+U13', 'Pista de pádel', '2-4', 12),

    ('Padel', 'Globos y remates desde el fondo',
     'Un jugador en la red provoca situaciones de globo; el jugador de fondo debe decidir entre globo defensivo o bandeja/remate según la altura de la bola. Rotar posiciones cada 8-10 repeticiones.',
     'finalizacion', 'tecnica', 'Senior', 'Pista de pádel', '2-4', 12),

    ('Padel', 'Desplazamientos laterales con conos',
     'Circuito de desplazamientos laterales y hacia atrás (sin cruzar los pies) marcado con conos junto a las paredes, simulando los movimientos típicos de defensa en pádel, con y sin pala en la mano.',
     'fisico', 'fisica', '+U13', 'Pista de pádel', '2-6', 12),

    -- ============================= TENIS =============================
    ('Tenis', 'Peloteo progresivo de fondo de pista',
     'Peloteo cruzado de derecha y revés desde el fondo, empezando corto y aumentando la profundidad progresivamente. Objetivo: series de al menos 10 golpes seguidos sin error antes de subir el ritmo.',
     'calentamiento', 'fisica', '+U11', 'Pista de tenis', '2-4', 10),

    ('Tenis', 'Derecha y revés cruzados con cesto de bolas',
     'El entrenador alimenta bolas desde el cesto alternando derecha y revés; el jugador busca golpear cruzado con continuidad de swing y buen equilibrio, volviendo al centro de la pista entre golpe y golpe.',
     'tecnico', 'tecnica', '+U13', 'Pista de tenis', '1-4', 15),

    ('Tenis', 'Saque y resto dirigido',
     'Series de saques alternando al cuadro derecho e izquierdo, buscando una zona marcada con conos. El compañero practica el resto dirigido a una zona concreta de la pista. Rotar cada 10 saques.',
     'tecnico', 'tecnica', 'Senior', 'Pista de tenis', '2', 15),

    ('Tenis', 'Circuito de agilidad y cambios de dirección',
     'Circuito con conos simulando desplazamientos típicos de un punto de tenis (laterales, hacia la red y hacia atrás), sin bola, enfocado en el primer paso explosivo y la recuperación al centro.',
     'fisico', 'fisica', '+U13', 'Pista de tenis o pista polideportiva', '2-8', 12),

    -- ============================= PATINAJE =============================
    ('Patinaje', 'Movilidad de tobillo y equilibrio sobre patines',
     'Ejercicios de equilibrio estático y dinámico sobre los patines (apoyo a una pierna, pequeños saltos) junto con movilidad de tobillo, para activar la propiocepción antes de trabajar técnica o velocidad.',
     'calentamiento', 'fisica', '+U9', 'Pista de patinaje', '6-20', 10),

    ('Patinaje', 'Frenada y cambios de dirección en slalom',
     'Recorrido de conos en slalom trabajando el cambio de filo y la frenada controlada al final de cada tramo. Repetir aumentando progresivamente la velocidad según el control técnico de cada patinador.',
     'tecnico', 'tecnica', '+U11', 'Pista de patinaje', '6-16', 15),

    ('Patinaje', 'Cruzados en curva',
     'Trabajo específico de pasos cruzados en las curvas de la pista, primero a baja velocidad centrando la atención en la colocación del pie de apoyo, después aumentando el ritmo en series cortas.',
     'tecnico', 'tecnica', '+U13', 'Pista de patinaje', '6-16', 15),

    ('Patinaje', 'Circuito de resistencia sobre pista',
     'Series de vueltas a ritmo submáximo con recuperación activa entre serie y serie (patinaje suave, nunca parado), ajustando número de series y distancia según edad y nivel del grupo.',
     'fisico', 'fisica', 'Senior', 'Pista de patinaje', '6-20', 15),

    -- ============================= GIMNASIA RÍTMICA =============================
    ('Gimnasia Ritmica', 'Movilidad articular y estiramiento activo',
     'Rutina de movilidad articular completa (cuello, hombros, cadera, tobillos) seguida de estiramientos activos de piernas y espalda, preparando el cuerpo para el trabajo técnico y de flexibilidad posterior.',
     'calentamiento', 'fisica', '+U9', 'Sala de gimnasia', '4-16', 12),

    ('Gimnasia Ritmica', 'Manejo de aparato: lanzamientos y recepciones básicas',
     'Trabajo individual con cuerda o aro: lanzamientos verticales de poca altura con recepción a dos manos, progresando a recepción a una mano y con pequeño desplazamiento tras el lanzamiento.',
     'tecnico', 'tecnica', '+U11', 'Sala de gimnasia', '4-12', 15),

    ('Gimnasia Ritmica', 'Equilibrios y giros sobre eje',
     'Progresión de equilibrios sobre una pierna (retiré, arabesque) sostenidos varios segundos, seguida de giros simples sobre el eje, primero apoyándose en una pared y después de forma libre.',
     'tecnico', 'tecnica', '+U13', 'Sala de gimnasia', '4-12', 15),

    ('Gimnasia Ritmica', 'Circuito de flexibilidad y control corporal',
     'Circuito de estaciones: spagat (progresión con apoyos), puente, y control de piernas en suelo, manteniendo cada posición varios segundos con respiración controlada, sin forzar más allá del rango cómodo de cada gimnasta.',
     'fisico', 'fisica', 'Senior', 'Sala de gimnasia', '4-16', 15)
)
INSERT INTO ejercicios (deporte_id, titulo, descripcion, tipologia, naturaleza, categoria_edad, espacio, num_jugadores, duracion_min)
SELECT dep.id, n.titulo, n.descripcion, n.tipologia, n.naturaleza, n.categoria_edad, n.espacio, n.num_jugadores, n.duracion_min
FROM nuevos n
JOIN deportes dep ON dep.nombre = n.deporte_nombre
WHERE NOT EXISTS (
    SELECT 1 FROM ejercicios e WHERE e.titulo = n.titulo AND e.deporte_id = dep.id
);
