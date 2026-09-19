-- =====================================================================
-- NUBAPP - Esquema de base de datos - EJERCICIOS Y SESIONES
-- =====================================================================
-- Cada deporte tiene su propio banco de ejercicios, completamente
-- independiente. La tabla se filtra siempre por deporte_id, así que
-- ampliar el banco de un deporte nunca afecta al del otro, y el día
-- de mañana añadir un tercer deporte con banco propio es solo una fila
-- nueva en "deportes", sin tocar esta estructura.
-- =====================================================================

CREATE TABLE ejercicios (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deporte_id      UUID NOT NULL REFERENCES deportes(id),
    titulo          VARCHAR(150) NOT NULL,
    descripcion     TEXT,
    -- Categorías tipo tus capturas: "Posesión / Técnica", "Físico / Física"...
    tipologia       VARCHAR(40),      -- calentamiento, rondo, partido_condicionado,
                                      -- juego_reducido, tecnico, fisico, posesion,
                                      -- finalizacion, transiciones... (ampliable)
    naturaleza      VARCHAR(20),      -- fisica, tecnica, tactica
    categoria_edad  VARCHAR(20),      -- ej: "+U11", "+U9"
    espacio         VARCHAR(80),      -- ej: "Medio campo"
    num_jugadores   VARCHAR(20),      -- ej: "11-19" (rango en texto, como en tu app)
    duracion_min    SMALLINT,
    imagen_url      VARCHAR(255),     -- visual esquemática (pizarra táctica)
    creado_por      UUID REFERENCES usuarios(id),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ejercicios_deporte ON ejercicios (deporte_id);
CREATE INDEX idx_ejercicios_tipologia ON ejercicios (deporte_id, tipologia);
CREATE INDEX idx_ejercicios_naturaleza ON ejercicios (deporte_id, naturaleza);

-- Vídeos vinculados a un ejercicio (Instagram/TikTok, como en tu captura
-- de "Vídeos" con Reproducir/Editar/Enlazar/Duplicar/Borrar)
CREATE TABLE ejercicios_videos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ejercicio_id    UUID NOT NULL REFERENCES ejercicios(id) ON DELETE CASCADE,
    titulo          VARCHAR(150),
    url_original    VARCHAR(500) NOT NULL,   -- link de Instagram/TikTok
    plataforma      VARCHAR(20) CHECK (plataforma IN ('instagram', 'tiktok', 'otro')),
    autor           VARCHAR(80),             -- ej: "Chechu"
    -- procesado_estado: pendiente / procesado / fallido
    -- (para cuando conectemos la conversión a visual esquemática, fase aparte)
    procesado_estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    imagen_generada_url VARCHAR(255),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- SESIONES (el entrenador las crea usando ejercicios del banco)
-- ---------------------------------------------------------------------
CREATE TABLE sesiones (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipo_id       UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    temporada_id    UUID NOT NULL REFERENCES temporadas(id),
    fecha           DATE NOT NULL,
    hora_inicio     TIME,
    titulo          VARCHAR(150),
    creado_por      UUID REFERENCES usuarios(id),
    cancelada       BOOLEAN NOT NULL DEFAULT FALSE,
    motivo_cancelacion TEXT,
    publicada_a_deportistas BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sesiones_equipo_fecha ON sesiones (equipo_id, fecha);

-- Ejercicios incluidos en una sesión, con orden y duración concreta ese día
CREATE TABLE sesion_ejercicios (
    sesion_id       UUID NOT NULL REFERENCES sesiones(id) ON DELETE CASCADE,
    ejercicio_id    UUID NOT NULL REFERENCES ejercicios(id),
    orden           SMALLINT NOT NULL,
    duracion_min    SMALLINT,
    notas           TEXT,
    PRIMARY KEY (sesion_id, ejercicio_id, orden)
);

-- ---------------------------------------------------------------------
-- ASISTENCIA (a sesiones, deportes de equipo E individuales)
-- ---------------------------------------------------------------------
CREATE TABLE asistencia (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sesion_id       UUID NOT NULL REFERENCES sesiones(id) ON DELETE CASCADE,
    deportista_id   UUID NOT NULL REFERENCES deportistas(id) ON DELETE CASCADE,
    -- confirmado por el propio deportista antes de la sesión
    confirmacion_previa VARCHAR(20) CHECK (confirmacion_previa IN
                        ('pendiente', 'confirmado', 'rechazado')) DEFAULT 'pendiente',
    -- marcado real por el monitor/entrenador el día de la sesión
    asistio         BOOLEAN,
    justificada     BOOLEAN NOT NULL DEFAULT FALSE,
    registrado_por  UUID REFERENCES usuarios(id),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (sesion_id, deportista_id)
);

CREATE INDEX idx_asistencia_deportista ON asistencia (deportista_id);

-- ---------------------------------------------------------------------
-- PLANIFICACIÓN MENSUAL (coordinador -> entrenador)
-- ---------------------------------------------------------------------
CREATE TABLE planificaciones_mensuales (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipo_id       UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    temporada_id    UUID NOT NULL REFERENCES temporadas(id),
    anio            SMALLINT NOT NULL,
    mes             SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    contenido       TEXT,            -- objetivos/planificación en texto
    creado_por      UUID REFERENCES usuarios(id),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (equipo_id, temporada_id, anio, mes)
);
