-- =====================================================================
-- NUBAPP - Esquema de base de datos - CUOTAS
-- =====================================================================
-- Se crea automáticamente una ficha de cuota por cada deportista dado
-- de alta en un deporte, para la temporada activa.
-- =====================================================================

CREATE TABLE cuotas (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deportista_id       UUID NOT NULL REFERENCES deportistas(id) ON DELETE CASCADE,
    deporte_id          UUID NOT NULL REFERENCES deportes(id),
    temporada_id        UUID NOT NULL REFERENCES temporadas(id),
    importe_cuota       NUMERIC(10,2) NOT NULL DEFAULT 0,
    importe_ropa        NUMERIC(10,2) NOT NULL DEFAULT 0,
    otros_importes      NUMERIC(10,2) NOT NULL DEFAULT 0,   -- derramas, etc.
    descuento_cuota_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    descuento_ropa_pct  NUMERIC(5,2) NOT NULL DEFAULT 0,
    notas               TEXT,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (deportista_id, deporte_id, temporada_id)
);

-- Previsión de cobro mes a mes (para el "Enero...Diciembre" que viste
-- en tu sistema actual) - una fila por mes, más simple de consultar/editar
-- que 12 columnas sueltas
CREATE TABLE cuotas_prevision_mensual (
    cuota_id    UUID NOT NULL REFERENCES cuotas(id) ON DELETE CASCADE,
    mes         SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    importe     NUMERIC(10,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (cuota_id, mes)
);

-- Pagos reales registrados (esto es lo que pediste desde el principio:
-- fecha, importe y método de pago)
CREATE TABLE cuotas_pagos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cuota_id        UUID NOT NULL REFERENCES cuotas(id) ON DELETE CASCADE,
    fecha           DATE NOT NULL,
    descripcion     VARCHAR(255),
    importe         NUMERIC(10,2) NOT NULL,
    forma_pago      VARCHAR(20) NOT NULL CHECK (forma_pago IN
                        ('efectivo', 'domiciliado', 'tpv', 'transferencia')),
    registrado_por  UUID REFERENCES usuarios(id),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cuotas_pagos_cuota ON cuotas_pagos (cuota_id);
CREATE INDEX idx_cuotas_deportista ON cuotas (deportista_id, temporada_id);

-- ---------------------------------------------------------------------
-- Vista de ayuda: total pagado / pendiente por cuota
-- (la barra roja "Pendiente" de tu captura sale directa de aquí)
-- ---------------------------------------------------------------------
CREATE VIEW v_cuotas_resumen AS
SELECT
    c.id AS cuota_id,
    c.deportista_id,
    c.deporte_id,
    c.temporada_id,
    (c.importe_cuota * (1 - c.descuento_cuota_pct/100.0)
     + c.importe_ropa * (1 - c.descuento_ropa_pct/100.0)
     + c.otros_importes) AS total_a_pagar,
    COALESCE(SUM(p.importe), 0) AS total_pagado,
    (c.importe_cuota * (1 - c.descuento_cuota_pct/100.0)
     + c.importe_ropa * (1 - c.descuento_ropa_pct/100.0)
     + c.otros_importes) - COALESCE(SUM(p.importe), 0) AS pendiente
FROM cuotas c
LEFT JOIN cuotas_pagos p ON p.cuota_id = c.id
GROUP BY c.id;
