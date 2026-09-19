// Ficha general de deportistas (Gestión deportiva > Fichas individuales).
// La ficha general (este archivo) no cambia por temporada: nombre, DNI,
// teléfonos... La ficha técnica (dorsal, posición, valoraciones) vive en
// fichas_tecnicas y se gestiona por equipo/temporada (siguiente bloque).
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('../config/db');
const { autenticar } = require('../middleware/auth');
const { requiereRol, ACCESO_TOTAL_LECTURA, GESTION_DEPORTIVA } = require('../middleware/permisos');

// ---- subida de foto del deportista ----
const CARPETA_FOTOS = path.join(__dirname, '..', '..', 'uploads', 'deportistas');
fs.mkdirSync(CARPETA_FOTOS, { recursive: true });

const almacenFotos = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CARPETA_FOTOS),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname) || '.jpg';
    cb(null, `${req.params.id}-${Date.now()}${extension}`);
  },
});
const subidaFoto = multer({
  storage: almacenFotos,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('El archivo debe ser una imagen'));
    cb(null, true);
  },
});

function filaADeportista(fila) {
  return {
    id: fila.id,
    numeroSocio: fila.numero_socio,
    nombreDeportivo: fila.nombre_deportivo,
    nombre: fila.nombre,
    apellidos: fila.apellidos,
    fechaNacimiento: fila.fecha_nacimiento,
    email: fila.email,
    telefonoDeportista: fila.telefono_deportista,
    telefonoPadre: fila.telefono_padre,
    telefonoMadre: fila.telefono_madre,
    dni: fila.dni,
    fotoUrl: fila.foto_url,
    lesionado: fila.lesionado,
    lesionDetalle: fila.lesion_detalle,
    lesionFechaAltaPrevista: fila.lesion_fecha_alta_prevista,
    inactivo: fila.inactivo,
    creadoEn: fila.creado_en,
    deportes: fila.deportes || [],
  };
}

// Selecciona la ficha + los deportes que practica ACTUALMENTE (periodo
// abierto, sin fecha de baja) en un único viaje a la base de datos
// (json_agg agrupado por deportista). El historial completo (con las
// bajas) se consulta aparte, en GET /:id/historial-deportes.
const CONSULTA_BASE = `
  SELECT d.*,
    COALESCE(
      json_agg(
        json_build_object('id', dep.id, 'nombre', dep.nombre, 'tipo', dep.tipo, 'tipoDeportista', dd.tipo_deportista)
      ) FILTER (WHERE dep.id IS NOT NULL),
      '[]'
    ) AS deportes
  FROM deportistas d
  LEFT JOIN deportista_deportes dd ON dd.deportista_id = d.id AND dd.fecha_baja IS NULL
  LEFT JOIN deportes dep ON dep.id = dd.deporte_id
`;

// Comprueba si un entrenador/coordinador tiene a este deportista en
// alguno de sus equipos (mismo criterio que el filtrado del listado).
async function tieneAccesoPorEquipo(usuarioId, deportistaId) {
  const { rows } = await pool.query(
    `SELECT 1
     FROM deportista_equipo_temporada det
     JOIN equipo_personal ep ON ep.equipo_id = det.equipo_id
     WHERE det.deportista_id = $1 AND ep.usuario_id = $2
     LIMIT 1`,
    [deportistaId, usuarioId]
  );
  return rows.length > 0;
}

// GET /api/deportistas?q=&deporteId=&estado=activo|inactivo|todos
// - administrador / direccion_deportiva -> ven TODOS los deportistas
// - coordinador / entrenador -> solo los deportistas de los equipos donde
//   están asignados como personal
// - q: busca por nombre, apellidos o número de socio
// - deporteId: solo deportistas que practican ese deporte
// - estado: "activo" (por defecto), "inactivo" o "todos"
router.get('/', autenticar, async (req, res) => {
  const { roles, id: usuarioId } = req.usuario;
  const { q, deporteId, estado } = req.query;

  const condiciones = [];
  const parametros = [];
  const nuevoParametro = (valor) => {
    parametros.push(valor);
    return `$${parametros.length}`;
  };

  if (estado === 'inactivo') {
    condiciones.push('d.inactivo = TRUE');
  } else if (estado !== 'todos') {
    condiciones.push('d.inactivo = FALSE'); // por defecto solo activos
  }

  if (q) {
    const marcador = nuevoParametro(`%${q}%`);
    condiciones.push(`(d.nombre ILIKE ${marcador} OR d.apellidos ILIKE ${marcador} OR d.numero_socio ILIKE ${marcador})`);
  }

  if (deporteId) {
    const marcador = nuevoParametro(deporteId);
    condiciones.push(`EXISTS (
      SELECT 1 FROM deportista_deportes dd2
      WHERE dd2.deportista_id = d.id AND dd2.deporte_id = ${marcador} AND dd2.fecha_baja IS NULL
    )`);
  }

  if (!roles.some((r) => ACCESO_TOTAL_LECTURA.includes(r))) {
    const marcador = nuevoParametro(usuarioId);
    condiciones.push(`EXISTS (
      SELECT 1 FROM deportista_equipo_temporada det
      JOIN equipo_personal ep ON ep.equipo_id = det.equipo_id
      WHERE det.deportista_id = d.id AND ep.usuario_id = ${marcador}
    )`);
  }

  const clausulaWhere = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const consulta = `${CONSULTA_BASE} ${clausulaWhere} GROUP BY d.id ORDER BY d.apellidos`;

  try {
    const { rows } = await pool.query(consulta, parametros);
    res.json(rows.map(filaADeportista));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar deportistas' });
  }
});

// GET /api/deportistas/:id - ficha general de un deportista concreto
router.get('/:id', autenticar, async (req, res) => {
  const { roles, id: usuarioId } = req.usuario;

  try {
    if (!roles.some((r) => ACCESO_TOTAL_LECTURA.includes(r))) {
      const autorizado = await tieneAccesoPorEquipo(usuarioId, req.params.id);
      if (!autorizado) return res.status(403).json({ error: 'No tienes permiso para esto' });
    }

    const { rows } = await pool.query(
      `${CONSULTA_BASE} WHERE d.id = $1 GROUP BY d.id`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Deportista no encontrado' });
    res.json(filaADeportista(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar el deportista' });
  }
});

// POST /api/deportistas - alta de ficha general (+ deportes que practica,
// opcional). Quien lo asigna a un equipo concreto es un paso aparte
// (deportista_equipo_temporada), en el módulo de equipos.
router.post('/', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  const {
    nombre,
    apellidos,
    fechaNacimiento,
    numeroSocio,
    nombreDeportivo,
    email,
    telefonoDeportista,
    telefonoPadre,
    telefonoMadre,
    dni,
    deportes, // opcional: [{ deporteId, tipoDeportista }]
  } = req.body;

  if (!nombre || !apellidos || !fechaNacimiento) {
    return res.status(400).json({ error: 'Nombre, apellidos y fecha de nacimiento son obligatorios' });
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    const { rows } = await cliente.query(
      `INSERT INTO deportistas
         (nombre, apellidos, fecha_nacimiento, numero_socio, nombre_deportivo,
          email, telefono_deportista, telefono_padre, telefono_madre, dni)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [
        nombre,
        apellidos,
        fechaNacimiento,
        numeroSocio || null,
        nombreDeportivo || null,
        email || null,
        telefonoDeportista || null,
        telefonoPadre || null,
        telefonoMadre || null,
        dni || null,
      ]
    );
    const deportistaId = rows[0].id;

    if (Array.isArray(deportes)) {
      for (const d of deportes) {
        if (!d?.deporteId) continue;
        await cliente.query(
          `INSERT INTO deportista_deportes (deportista_id, deporte_id, tipo_deportista)
           VALUES ($1, $2, $3)`,
          [deportistaId, d.deporteId, d.tipoDeportista || null]
        );
      }
    }

    await cliente.query('COMMIT');
    res.status(201).json({ id: deportistaId });
  } catch (err) {
    await cliente.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un deportista con ese número de socio' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear el deportista' });
  } finally {
    cliente.release();
  }
});

// PUT /api/deportistas/:id - editar ficha general (administrador,
// dirección deportiva o coordinador)
router.put('/:id', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  const {
    nombre,
    apellidos,
    fechaNacimiento,
    numeroSocio,
    nombreDeportivo,
    email,
    telefonoDeportista,
    telefonoPadre,
    telefonoMadre,
    dni,
    inactivo,
  } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE deportistas SET
         nombre               = COALESCE($1, nombre),
         apellidos            = COALESCE($2, apellidos),
         fecha_nacimiento     = COALESCE($3, fecha_nacimiento),
         numero_socio         = COALESCE($4, numero_socio),
         nombre_deportivo     = COALESCE($5, nombre_deportivo),
         email                = COALESCE($6, email),
         telefono_deportista  = COALESCE($7, telefono_deportista),
         telefono_padre       = COALESCE($8, telefono_padre),
         telefono_madre       = COALESCE($9, telefono_madre),
         dni                  = COALESCE($10, dni),
         inactivo             = COALESCE($11, inactivo)
       WHERE id = $12
       RETURNING id`,
      [
        nombre ?? null,
        apellidos ?? null,
        fechaNacimiento ?? null,
        numeroSocio ?? null,
        nombreDeportivo ?? null,
        email ?? null,
        telefonoDeportista ?? null,
        telefonoPadre ?? null,
        telefonoMadre ?? null,
        dni ?? null,
        typeof inactivo === 'boolean' ? inactivo : null,
        req.params.id,
      ]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Deportista no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un deportista con ese número de socio' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el deportista' });
  }
});

// PUT /api/deportistas/:id/deportes - fija qué deportes practica ACTUALMENTE
// (administrador, dirección deportiva o coordinador). No borra nada: a los
// que ya no están en la lista se les cierra su periodo (fecha_baja = hoy) y
// a los nuevos se les abre uno (fecha_alta = hoy), así queda guardado el
// historial. Para dar de alta o de baja con una fecha concreta (no "hoy"),
// usa /:id/historial-deportes.
router.put('/:id/deportes', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  const { deportes } = req.body;

  if (!Array.isArray(deportes)) {
    return res.status(400).json({ error: 'Debes indicar la lista de deportes (puede ir vacía)' });
  }

  const deportistaId = req.params.id;
  const idsNuevos = deportes.map((d) => d?.deporteId).filter(Boolean);

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    if (idsNuevos.length > 0) {
      await cliente.query(
        `UPDATE deportista_deportes SET fecha_baja = CURRENT_DATE
         WHERE deportista_id = $1 AND fecha_baja IS NULL AND deporte_id <> ALL($2::uuid[])`,
        [deportistaId, idsNuevos]
      );
    } else {
      await cliente.query(
        `UPDATE deportista_deportes SET fecha_baja = CURRENT_DATE
         WHERE deportista_id = $1 AND fecha_baja IS NULL`,
        [deportistaId]
      );
    }

    for (const d of deportes) {
      if (!d?.deporteId) continue;
      await cliente.query(
        `INSERT INTO deportista_deportes (deportista_id, deporte_id, tipo_deportista)
         VALUES ($1, $2, $3)
         ON CONFLICT (deportista_id, deporte_id) WHERE fecha_baja IS NULL DO NOTHING`,
        [deportistaId, d.deporteId, d.tipoDeportista || null]
      );
    }

    await cliente.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await cliente.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar los deportes del deportista' });
  } finally {
    cliente.release();
  }
});

// GET /api/deportistas/:id/historial-deportes - todos los periodos
// (altas y bajas) de cada deporte que ha practicado, para ver su
// trayectoria completa (no solo lo que practica ahora).
router.get('/:id/historial-deportes', autenticar, async (req, res) => {
  const { roles, id: usuarioId } = req.usuario;
  try {
    if (!roles.some((r) => ACCESO_TOTAL_LECTURA.includes(r))) {
      const autorizado = await tieneAccesoPorEquipo(usuarioId, req.params.id);
      if (!autorizado) return res.status(403).json({ error: 'No tienes permiso para esto' });
    }
    const { rows } = await pool.query(
      `SELECT dd.id, dd.deporte_id AS "deporteId", dep.nombre AS "deporteNombre",
              dd.fecha_alta AS "fechaAlta", dd.fecha_baja AS "fechaBaja",
              dd.tipo_deportista AS "tipoDeportista"
       FROM deportista_deportes dd
       JOIN deportes dep ON dep.id = dd.deporte_id
       WHERE dd.deportista_id = $1
       ORDER BY dd.fecha_alta DESC, dep.nombre`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar el historial de deportes' });
  }
});

// POST /api/deportistas/:id/historial-deportes - añade un periodo con
// fechas concretas (p.ej. dar de alta con fecha pasada, con o sin baja ya
// conocida). Para el alta/baja "de hoy" es más rápido usar PUT /:id/deportes.
router.post('/:id/historial-deportes', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  const { deporteId, fechaAlta, fechaBaja, tipoDeportista } = req.body;
  if (!deporteId || !fechaAlta) {
    return res.status(400).json({ error: 'deporteId y fechaAlta son obligatorios' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO deportista_deportes (deportista_id, deporte_id, fecha_alta, fecha_baja, tipo_deportista)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [req.params.id, deporteId, fechaAlta, fechaBaja || null, tipoDeportista || null]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya hay un periodo abierto (sin fecha de baja) para ese deporte; ciérralo primero' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al añadir el periodo' });
  }
});

// PUT /api/deportistas/:id/historial-deportes/:historialId - corrige las
// fechas de un periodo ya existente (p.ej. cerrarlo con una fecha de baja,
// o arreglar una fecha mal puesta)
router.put('/:id/historial-deportes/:historialId', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  const { fechaAlta, fechaBaja } = req.body;
  if (!fechaAlta) return res.status(400).json({ error: 'fechaAlta es obligatoria' });
  try {
    const { rows } = await pool.query(
      `UPDATE deportista_deportes SET fecha_alta = $1, fecha_baja = $2
       WHERE id = $3 AND deportista_id = $4
       RETURNING id`,
      [fechaAlta, fechaBaja || null, req.params.historialId, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Periodo no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya hay otro periodo abierto para ese deporte' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el periodo' });
  }
});

// DELETE /api/deportistas/:id/historial-deportes/:historialId - elimina
// un periodo por completo (para corregir un alta metida por error)
router.delete('/:id/historial-deportes/:historialId', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM deportista_deportes WHERE id = $1 AND deportista_id = $2',
      [req.params.historialId, req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Periodo no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el periodo' });
  }
});

// POST /api/deportistas/:id/foto - sube/reemplaza la foto del deportista
// (campo de formulario "foto", multipart/form-data)
router.post('/:id/foto', autenticar, requiereRol(...GESTION_DEPORTIVA), (req, res) => {
  subidaFoto.single('foto')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Error al subir la foto' });
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo de la foto (campo "foto")' });

    const fotoUrl = `/uploads/deportistas/${req.file.filename}`;
    try {
      const { rows } = await pool.query(
        'UPDATE deportistas SET foto_url = $1 WHERE id = $2 RETURNING id',
        [fotoUrl, req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Deportista no encontrado' });
      res.json({ fotoUrl });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al guardar la foto' });
    }
  });
});

// PUT /api/deportistas/:id/lesion - marcar/actualizar lesión. A diferencia
// del resto de la ficha, esto también lo puede tocar el entrenador o
// coordinador de ESE deportista (es del día a día del equipo), no solo
// administración.
router.put('/:id/lesion', autenticar, async (req, res) => {
  const { roles, id: usuarioId } = req.usuario;
  const { lesionado, lesionDetalle, lesionFechaAltaPrevista } = req.body;

  if (typeof lesionado !== 'boolean') {
    return res.status(400).json({ error: 'Falta indicar si está lesionado (true/false)' });
  }

  try {
    if (!roles.some((r) => ACCESO_TOTAL_LECTURA.includes(r))) {
      const autorizado = await tieneAccesoPorEquipo(usuarioId, req.params.id);
      if (!autorizado) return res.status(403).json({ error: 'No tienes permiso para esto' });
    }

    const { rows } = await pool.query(
      `UPDATE deportistas SET
         lesionado = $1,
         lesion_detalle = $2,
         lesion_fecha_alta_prevista = $3
       WHERE id = $4
       RETURNING id`,
      [lesionado, lesionado ? lesionDetalle || null : null, lesionado ? lesionFechaAltaPrevista || null : null, req.params.id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Deportista no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la lesión' });
  }
});

// DELETE /api/deportistas/:id - baja lógica (nunca se borra físicamente,
// para no perder histórico de cuotas/asistencia/estadísticas)
router.delete('/:id', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE deportistas SET inactivo = TRUE WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Deportista no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al dar de baja al deportista' });
  }
});

module.exports = router;
