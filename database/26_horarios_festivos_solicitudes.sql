-- =====================================================================
-- Actualización combinada: horario de entrenamiento + generación de
-- sesiones, días festivos, y solicitudes de alta por enlace de equipo.
-- =====================================================================

-- Horario semanal de un equipo. Si deportista_id es NULL, es un horario
-- de TODO el equipo (ej. fútbol, baloncesto: lunes y miércoles 18:00).
-- Si deportista_id está informado, es el horario propio de UN deportista
-- concreto dentro de ese equipo (pensado para deportes individuales como
-- pádel, donde cada uno puede entrenar un día/hora distinto). Lo define
-- siempre el club (administrador, dirección deportiva, coordinador o el
-- propio entrenador/monitor asignado a ese equipo) - nunca el deportista.
-- A partir de este horario se generan las sesiones con el botón
-- "Generar sesiones" (no se generan solas al guardar el horario).
CREATE TABLE horarios_entrenamiento (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipo_id       UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    deportista_id   UUID REFERENCES deportistas(id) ON DELETE CASCADE, -- NULL = todo el equipo
    dia_semana      SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 7), -- 1=lunes ... 7=domingo
    hora_inicio     TIME NOT NULL,
    titulo          VARCHAR(150),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un mismo equipo no puede repetir el mismo día/hora para "todo el
-- equipo" (deportista_id NULL); un mismo deportista no puede repetir el
-- mismo día/hora para su horario individual (da igual el equipo).
CREATE UNIQUE INDEX idx_horario_equipo_unico
  ON horarios_entrenamiento (equipo_id, dia_semana, hora_inicio)
  WHERE deportista_id IS NULL;

CREATE UNIQUE INDEX idx_horario_deportista_unico
  ON horarios_entrenamiento (deportista_id, dia_semana, hora_inicio)
  WHERE deportista_id IS NOT NULL;

CREATE INDEX idx_horario_equipo ON horarios_entrenamiento (equipo_id);

-- Días festivos del club: no se entrena. Al crearlo, el administrador
-- marca a qué equipos afecta (un puente, por ejemplo, puede afectar solo
-- a algunos equipos y no a otros). Las sesiones ya existentes en esa
-- fecha para esos equipos se cancelan automáticamente (motivo
-- "Festivo: <descripción>"); las que se generen después para esa fecha
-- también salen ya canceladas. Si algún equipo SÍ entrena ese día, se
-- reactiva su sesión a mano con el botón "Reactivar" que ya existe.
CREATE TABLE festivos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha           DATE NOT NULL,
    descripcion     VARCHAR(150) NOT NULL,
    creado_por      UUID REFERENCES usuarios(id),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE festivo_equipos (
    festivo_id      UUID NOT NULL REFERENCES festivos(id) ON DELETE CASCADE,
    equipo_id       UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    PRIMARY KEY (festivo_id, equipo_id)
);

CREATE INDEX idx_festivos_fecha ON festivos (fecha);

-- Enlace público de alta por equipo: cada equipo lleva un token único
-- (no es su id, para no poder adivinarlo ni enumerarlos) que forma la
-- URL pública /alta/<token>. Quien la abre manda una solicitud sin
-- necesidad de tener cuenta; el administrador la revisa y, si procede,
-- crea la ficha de deportista real y lo ficha en el equipo.
ALTER TABLE equipos ADD COLUMN token_alta UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4();

CREATE TABLE solicitudes_alta (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipo_id       UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    nombre          VARCHAR(80) NOT NULL,
    apellidos       VARCHAR(120) NOT NULL,
    email           VARCHAR(150),
    telefono        VARCHAR(20),
    estado          VARCHAR(12) NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
    deportista_id   UUID REFERENCES deportistas(id), -- se rellena al aprobar
    revisado_por    UUID REFERENCES usuarios(id),
    revisado_en     TIMESTAMPTZ,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_solicitudes_equipo ON solicitudes_alta (equipo_id, estado);
