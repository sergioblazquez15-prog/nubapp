-- =====================================================================
-- NUBAPP - Esquema de base de datos - NÚCLEO
-- Club: AD Nuevo Baztán
-- =====================================================================
-- Este archivo crea las tablas fundacionales: temporadas, usuarios,
-- roles, deportes, deportistas y fichas técnicas.
--
-- IMPORTANTE: Todo lo que pueda variar entre temporadas lleva
-- SIEMPRE una columna temporada_id. Esto es lo que permite:
--   - Consultar datos de temporadas anteriores sin mezclarlos
--   - Traspasar equipos/jugadores de una temporada a otra
--   - Cerrar una temporada sin perder su histórico
-- =====================================================================

-- ---------------------------------------------------------------------
-- EXTENSIONES
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- TEMPORADAS
-- ---------------------------------------------------------------------
CREATE TABLE temporadas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(50) NOT NULL UNIQUE,   -- ej: "2026/2027"
    fecha_inicio    DATE NOT NULL,
    fecha_fin       DATE NOT NULL,
    es_principal    BOOLEAN NOT NULL DEFAULT FALSE, -- la temporada activa "por defecto"
    activa          BOOLEAN NOT NULL DEFAULT TRUE,
    cerrada         BOOLEAN NOT NULL DEFAULT FALSE, -- true = temporada finalizada, solo lectura
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Solo puede haber UNA temporada marcada como principal
CREATE UNIQUE INDEX idx_temporada_principal_unica
    ON temporadas (es_principal)
    WHERE es_principal = TRUE;

-- Primera temporada, para poder crear equipos sin tener que darla de
-- alta a mano. Cambia las fechas si tu curso empieza en otro mes.
INSERT INTO temporadas (nombre, fecha_inicio, fecha_fin, es_principal, activa) VALUES
    ('2026/2027', '2026-09-01', '2027-06-30', TRUE, TRUE);

-- ---------------------------------------------------------------------
-- ROLES (catálogo fijo, no editable desde la app salvo por super-admin)
-- ---------------------------------------------------------------------
CREATE TABLE roles (
    id      SMALLINT PRIMARY KEY,
    nombre  VARCHAR(30) NOT NULL UNIQUE
);

INSERT INTO roles (id, nombre) VALUES
    (1, 'administrador'),
    (2, 'direccion_deportiva'),
    (3, 'coordinador'),
    (4, 'entrenador'),
    (5, 'monitor'),
    (6, 'deportista');

-- ---------------------------------------------------------------------
-- USUARIOS (todo el que puede hacer login: personal + deportistas)
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email               VARCHAR(150) UNIQUE,        -- puede ser NULL si el deportista no tiene login propio
    password_hash       VARCHAR(255),
    nombre_completo      VARCHAR(150) NOT NULL,
    telefono            VARCHAR(20),
    inactivo            BOOLEAN NOT NULL DEFAULT FALSE,
    ultimo_acceso       TIMESTAMPTZ,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un usuario puede tener varios roles (ej: Chechu es coordinador Y supervisor,
-- como viste en tu sistema actual)
CREATE TABLE usuario_roles (
    usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    rol_id      SMALLINT NOT NULL REFERENCES roles(id),
    PRIMARY KEY (usuario_id, rol_id)
);

-- ---------------------------------------------------------------------
-- DEPORTES (catálogo ampliable: futbol, baloncesto, padel, tenis, muay thai...)
-- ---------------------------------------------------------------------
CREATE TABLE deportes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(50) NOT NULL UNIQUE,
    tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('equipo', 'individual')),
    activo          BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO deportes (nombre, tipo) VALUES
    ('Futbol', 'equipo'),
    ('Baloncesto', 'equipo'),
    ('Muay Thai', 'individual'),
    ('Patinaje', 'individual'),
    ('Padel', 'individual'),
    ('Tenis', 'individual'),
    ('Gimnasia Ritmica', 'individual');
    -- El resto de deportes individuales que se vayan sumando en el futuro
    -- se dan de alta desde la app (o con un POST /api/deportes), no hace
    -- falta tocar este esquema para añadirlos

-- ---------------------------------------------------------------------
-- EQUIPOS (por temporada y por deporte)
-- ---------------------------------------------------------------------
CREATE TABLE equipos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    temporada_id    UUID NOT NULL REFERENCES temporadas(id),
    deporte_id      UUID NOT NULL REFERENCES deportes(id),
    nombre          VARCHAR(80) NOT NULL,          -- ej: "Cadete", "Senior"
    categoria       VARCHAR(50),                   -- ej: "Cadete", "Regional A"
    club_nombre     VARCHAR(120),                  -- ej: "UD Villar del Olmo"
    inactivo        BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (temporada_id, deporte_id, nombre)
);

-- Entrenadores/coordinadores/monitores asignados a un equipo
CREATE TABLE equipo_personal (
    equipo_id       UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    rol_en_equipo   VARCHAR(20) NOT NULL CHECK (rol_en_equipo IN
                        ('entrenador', 'coordinador', 'monitor')),
    PRIMARY KEY (equipo_id, usuario_id, rol_en_equipo)
);

-- ---------------------------------------------------------------------
-- DEPORTISTAS - FICHA GENERAL (datos personales, NO cambia por temporada)
-- ---------------------------------------------------------------------
CREATE TABLE deportistas (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id          UUID REFERENCES usuarios(id), -- NULL si el deportista no tiene login propio
    numero_socio        VARCHAR(20) UNIQUE,
    nombre_deportivo    VARCHAR(80),                    -- alias/apodo, opcional
    nombre              VARCHAR(80) NOT NULL,
    apellidos           VARCHAR(120) NOT NULL,
    fecha_nacimiento    DATE NOT NULL,
    email               VARCHAR(150),
    telefono_deportista VARCHAR(20),
    telefono_padre      VARCHAR(20),
    telefono_madre      VARCHAR(20),
    dni                 VARCHAR(20),
    foto_url            VARCHAR(255),
    lesionado           BOOLEAN NOT NULL DEFAULT FALSE,
    lesion_detalle      TEXT,
    lesion_fecha_alta_prevista DATE,
    inactivo            BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deportistas_apellidos ON deportistas (apellidos);

-- Relación deportista <-> deporte practicado, CON HISTORIAL (puede
-- practicar varios, y puede tener varios periodos de alta/baja en el
-- mismo deporte a lo largo de los años).
CREATE TABLE deportista_deportes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deportista_id   UUID NOT NULL REFERENCES deportistas(id) ON DELETE CASCADE,
    deporte_id      UUID NOT NULL REFERENCES deportes(id),
    tipo_deportista VARCHAR(30),  -- campo libre según lo que definas (federado, escuela, etc.)
    fecha_alta      DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_baja      DATE          -- NULL = lo sigue practicando actualmente
);

-- Solo puede haber UN periodo abierto (sin fecha_baja) por deportista y
-- deporte a la vez; así "qué practica ahora mismo" sigue siendo una
-- consulta simple aunque debajo haya todo el histórico.
CREATE UNIQUE INDEX idx_deportista_deporte_periodo_abierto
    ON deportista_deportes (deportista_id, deporte_id)
    WHERE fecha_baja IS NULL;

-- Asignación del deportista a un equipo, POR TEMPORADA (esto es lo que
-- permite el traspaso entre temporadas sin duplicar la ficha general)
CREATE TABLE deportista_equipo_temporada (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deportista_id   UUID NOT NULL REFERENCES deportistas(id) ON DELETE CASCADE,
    equipo_id       UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    temporada_id    UUID NOT NULL REFERENCES temporadas(id),
    dorsal          SMALLINT,
    UNIQUE (deportista_id, equipo_id, temporada_id)
);

-- ---------------------------------------------------------------------
-- FICHA TÉCNICA (solo edita entrenador/coordinador/admin)
-- Se guarda POR TEMPORADA porque dorsal, posición, valoraciones... cambian
-- cada año. Los campos específicos por deporte (posiciones de fútbol vs
-- baloncesto) van en JSONB para que cada deporte amplíe sin tocar el
-- esquema de otro deporte.
-- ---------------------------------------------------------------------
CREATE TABLE fichas_tecnicas (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deportista_equipo_temp_id   UUID NOT NULL UNIQUE
                                REFERENCES deportista_equipo_temporada(id) ON DELETE CASCADE,
    lateralidad                 VARCHAR(20) CHECK (lateralidad IN
                                ('derecho', 'zurdo', 'ambidiestro', 'desconocido')),
    genero                      VARCHAR(20),
    posicion_principal          VARCHAR(40),  -- ej futbol: "lateral"; baloncesto: "base"
    posicion_secundaria         VARCHAR(40),
    posiciones_principales       JSONB DEFAULT '[]',  -- en desuso, se mantiene por compatibilidad
    posiciones_alternativas      JSONB DEFAULT '[]',  -- en desuso, se mantiene por compatibilidad
    valoracion_tecnica          NUMERIC(4,2),
    valoracion_tactica          NUMERIC(4,2),
    valoracion_fisica           NUMERIC(4,2),
    valoracion_psicologica      NUMERIC(4,2),
    valoracion_personalidad     NUMERIC(4,2),
    datos_extra                 JSONB DEFAULT '{}',  -- para campos futuros específicos de un deporte
    actualizado_en              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN fichas_tecnicas.datos_extra IS
    'Campos específicos de un deporte que aún no tienen columna propia (ej: altura de salto en baloncesto). Se puede promover a columna real más adelante sin migrar datos.';
