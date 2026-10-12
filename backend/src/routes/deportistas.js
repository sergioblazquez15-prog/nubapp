// Ficha general de deportistas (Gestión deportiva > Fichas individuales).
// La ficha general (este archivo) no cambia por temporada: nombre, DNI,
// teléfonos... La ficha técnica (dorsal, posición, valoraciones) vive en
// fichas_tecnicas y se gestiona por equipo/temporada (siguiente bloque).
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const ExcelJS = require('exceljs');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { autenticar } = require('../middleware/auth');
const { requiereRol, ACCESO_TOTAL_LECTURA, GESTION_DEPORTIVA } = require('../middleware/permisos');

const RONDAS_BCRYPT = 10;

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
    usuarioId: fila.usuario_id,
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

// Comprueba si el usuario que pregunta ES este deportista (login propio
// del deportista, no de su entrenador). Así puede abrir su propia ficha
// aunque no tenga ningún equipo_personal asignado.
async function esElMismo(usuarioId, deportistaId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM deportistas WHERE id = $1 AND usuario_id = $2',
    [deportistaId, usuarioId]
  );
  return rows.length > 0;
}

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
    // Personal técnico (coordinador/entrenador/monitor): solo los suyos.
    // Un usuario con rol "deportista" no tiene equipo_personal, así que
    // esta condición sola le devolvería la lista vacía — se añade además
    // "es él mismo" para que un deportista que entra con su propio
    // usuario se vea a sí mismo (y solo a sí mismo) en su ficha.
    const marcadorEquipo = nuevoParametro(usuarioId);
    const marcadorPropio = nuevoParametro(usuarioId);
    condiciones.push(`(
      EXISTS (
        SELECT 1 FROM deportista_equipo_temporada det
        JOIN equipo_personal ep ON ep.equipo_id = det.equipo_id
        WHERE det.deportista_id = d.id AND ep.usuario_id = ${marcadorEquipo}
      )
      OR d.usuario_id = ${marcadorPropio}
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
      const autorizado = (await tieneAccesoPorEquipo(usuarioId, req.params.id)) || (await esElMismo(usuarioId, req.params.id));
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
      const autorizado = (await tieneAccesoPorEquipo(usuarioId, req.params.id)) || (await esElMismo(usuarioId, req.params.id));
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

// GET /api/deportistas/:id/ficha-tecnica - ficha técnica (posición,
// dorsal, valoraciones) de este deportista en cada equipo de la
// temporada activa. La ficha técnica en sí vive por equipo/temporada
// (fichas_tecnicas, ver equipos.js) porque cambia cada año; esto solo la
// reúne por deportista para poder pintar el esquema del campo también
// aquí, en su ficha individual, sin tener que ir a Plantillas.
router.get('/:id/ficha-tecnica', autenticar, async (req, res) => {
  const { roles, id: usuarioId } = req.usuario;
  try {
    if (!roles.some((r) => ACCESO_TOTAL_LECTURA.includes(r))) {
      const autorizado = (await tieneAccesoPorEquipo(usuarioId, req.params.id)) || (await esElMismo(usuarioId, req.params.id));
      if (!autorizado) return res.status(403).json({ error: 'No tienes permiso para esto' });
    }
    const { rows } = await pool.query(
      `SELECT e.id AS "equipoId", e.nombre AS "equipoNombre", dep.nombre AS "deporteNombre",
              det.dorsal, ft.posicion_principal AS "posicionPrincipal", ft.posicion_secundaria AS "posicionSecundaria",
              ft.valoracion_tecnica AS "valoracionTecnica", ft.valoracion_tactica AS "valoracionTactica",
              ft.valoracion_fisica AS "valoracionFisica", ft.valoracion_psicologica AS "valoracionPsicologica",
              ft.valoracion_personalidad AS "valoracionPersonalidad"
       FROM deportista_equipo_temporada det
       JOIN equipos e ON e.id = det.equipo_id
       JOIN deportes dep ON dep.id = e.deporte_id
       JOIN temporadas t ON t.id = det.temporada_id
       LEFT JOIN fichas_tecnicas ft ON ft.deportista_equipo_temp_id = det.id
       WHERE det.deportista_id = $1 AND t.es_principal = TRUE AND e.inactivo = FALSE
       ORDER BY e.nombre`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar la ficha técnica' });
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

// --- Importación masiva desde Excel (plantillas de equipo) -------------
//
// El club lleva las plantillas de cada equipo en un Excel (ver
// "plantilla_deportistas_nubapp.xlsx", entregada aparte con el mismo
// formato que se espera aquí). Una fila = un deportista en UN equipo; si
// practica varios deportes, se repite con el mismo Nº de socio. Por Nº de
// socio: si ya existe, ACTUALIZA la ficha; si no, la CREA. Opcionalmente
// (columnas "Email acceso Mi app" + "Contraseña inicial") crea también su
// login propio, igual que POST /:id/acceso — por eso solo administrador.
const subidaExcelDeportistas = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function normalizarTextoImport(txt) {
  return String(txt ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\*/g, '').trim();
}

const ALIAS_COLUMNAS_IMPORT = {
  numeroSocio: ['n socio', 'nº socio', 'numero socio', 'num socio'],
  nombre: ['nombre'],
  apellidos: ['apellidos', 'apellido'],
  nombreDeportivo: ['nombre deportivo'],
  fechaNacimiento: ['fecha nacimiento'],
  dni: ['dni'],
  email: ['email deportista'],
  telefonoDeportista: ['telefono deportista'],
  telefonoPadre: ['telefono padre'],
  telefonoMadre: ['telefono madre'],
  deporte: ['deporte'],
  equipo: ['equipo / categoria', 'equipo/categoria', 'equipo categoria', 'equipo'],
  tipoDeportista: ['tipo deportista'],
  dorsal: ['dorsal'],
  emailAcceso: ['email acceso mi app'],
  passwordInicial: ['contrasena inicial'],
};

function detectarColumnasImport(filaCabecera) {
  const mapa = {};
  filaCabecera.eachCell((celda, colNumero) => {
    const valor = normalizarTextoImport(celda.value);
    for (const [campo, alias] of Object.entries(ALIAS_COLUMNAS_IMPORT)) {
      if (alias.includes(valor)) mapa[campo] = colNumero;
    }
  });
  return mapa;
}

// Extrae texto plano de una celda de ExcelJS (string, número, fecha,
// fórmula o texto enriquecido) - igual que en routes/cuotas.js.
function celdaTextoImport(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'object') {
    if (Array.isArray(valor.richText)) return valor.richText.map((t) => t.text).join('');
    if (valor.text !== undefined) return String(valor.text);
    if (valor.result !== undefined) return celdaTextoImport(valor.result);
    if (valor instanceof Date) return valor.toISOString();
  }
  return String(valor).trim();
}

// Admite Date (Excel), "dd/mm/aaaa" o "aaaa-mm-dd". Devuelve null si no se
// reconoce (a diferencia del helper de cuotas.js, aquí NO se rellena con
// la fecha de hoy - una fecha de nacimiento mal escrita debe dar error).
function parsearFechaNacimientoImport(valorCelda) {
  if (!valorCelda) return null;
  if (valorCelda instanceof Date) return valorCelda.toISOString().slice(0, 10);
  const texto = celdaTextoImport(valorCelda);
  const conBarras = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (conBarras) {
    const [, d, m, a] = conBarras;
    return `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  return null;
}

// POST /api/deportistas/importar - multipart: campo "archivo" (el Excel)
// + temporadaId (a qué temporada se asignan los equipos de cada fila).
router.post('/importar', autenticar, requiereRol('administrador'), subidaExcelDeportistas.single('archivo'), async (req, res) => {
  const { temporadaId } = req.body;
  if (!req.file) return res.status(400).json({ error: 'Falta el archivo Excel (campo "archivo")' });
  if (!temporadaId) return res.status(400).json({ error: 'temporadaId es obligatorio' });

  let libro;
  try {
    libro = new ExcelJS.Workbook();
    await libro.xlsx.load(req.file.buffer);
  } catch (err) {
    return res.status(400).json({ error: 'No se ha podido leer el archivo. ¿Es un Excel (.xlsx) válido?' });
  }

  const hoja = libro.worksheets.find((h) => normalizarTextoImport(h.name) === 'plantilla') || libro.worksheets[0];
  if (!hoja) return res.status(400).json({ error: 'El Excel no tiene ninguna hoja de datos' });

  let columnas = null;
  let numeroFilaCabecera = 0;
  for (let i = 1; i <= Math.min(hoja.rowCount, 10); i++) {
    const mapa = detectarColumnasImport(hoja.getRow(i));
    if (mapa.numeroSocio && mapa.nombre && mapa.apellidos) {
      columnas = mapa;
      numeroFilaCabecera = i;
      break;
    }
  }
  if (!columnas) {
    return res.status(400).json({ error: 'No se han reconocido las columnas de la plantilla. Usa la plantilla oficial sin cambiar los nombres de las cabeceras.' });
  }

  const { rows: deportesDb } = await pool.query('SELECT id, nombre FROM deportes');
  const { rows: equiposDb } = await pool.query('SELECT id, nombre, deporte_id FROM equipos WHERE temporada_id = $1', [temporadaId]);

  const creados = [];
  const actualizados = [];
  const accesosCreados = [];
  const errores = [];

  for (let i = numeroFilaCabecera + 1; i <= hoja.rowCount; i++) {
    const fila = hoja.getRow(i);
    const valor = (campo) => (columnas[campo] ? celdaTextoImport(fila.getCell(columnas[campo]).value) : '');

    const numeroSocio = valor('numeroSocio');
    const nombre = valor('nombre');
    const apellidos = valor('apellidos');
    if (!numeroSocio && !nombre && !apellidos) continue; // fila en blanco

    const etiquetaFila = `Fila ${i}${nombre || apellidos ? ` (${[nombre, apellidos].filter(Boolean).join(' ')})` : ''}`;
    try {
      if (!numeroSocio || !nombre || !apellidos) {
        errores.push(`${etiquetaFila}: faltan datos obligatorios (Nº socio, nombre o apellidos)`);
        continue;
      }
      const fechaNacimiento = parsearFechaNacimientoImport(columnas.fechaNacimiento ? fila.getCell(columnas.fechaNacimiento).value : null);
      if (!fechaNacimiento) {
        errores.push(`${etiquetaFila}: fecha de nacimiento obligatoria y no reconocida (usa dd/mm/aaaa)`);
        continue;
      }
      const nombreDeporte = valor('deporte');
      const nombreEquipo = valor('equipo');
      if (!nombreDeporte || !nombreEquipo) {
        errores.push(`${etiquetaFila}: faltan "Deporte" o "Equipo / Categoría"`);
        continue;
      }
      const deporte = deportesDb.find((d) => normalizarTextoImport(d.nombre) === normalizarTextoImport(nombreDeporte));
      if (!deporte) {
        errores.push(`${etiquetaFila}: no se reconoce el deporte "${nombreDeporte}" (revisa la hoja "Deportes y equipos")`);
        continue;
      }
      const equipo = equiposDb.find((e) => e.deporte_id === deporte.id && normalizarTextoImport(e.nombre) === normalizarTextoImport(nombreEquipo));
      if (!equipo) {
        errores.push(`${etiquetaFila}: no se reconoce el equipo "${nombreEquipo}" en ${nombreDeporte} para esta temporada`);
        continue;
      }

      const nombreDeportivo = valor('nombreDeportivo') || null;
      const dni = valor('dni') || null;
      const email = valor('email') || null;
      const telefonoDeportista = valor('telefonoDeportista') || null;
      const telefonoPadre = valor('telefonoPadre') || null;
      const telefonoMadre = valor('telefonoMadre') || null;
      const tipoDeportista = valor('tipoDeportista') || null;
      const dorsalTexto = valor('dorsal');
      const dorsal = dorsalTexto !== '' && !Number.isNaN(Number(dorsalTexto)) ? Number(dorsalTexto) : null;
      const emailAcceso = valor('emailAcceso');
      const passwordInicial = valor('passwordInicial');

      let deportistaId;
      let esNuevo = false;
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const { rows: existente } = await cliente.query(
          'SELECT id, usuario_id FROM deportistas WHERE numero_socio = $1 FOR UPDATE',
          [numeroSocio]
        );
        if (existente[0]) {
          deportistaId = existente[0].id;
          await cliente.query(
            `UPDATE deportistas SET
               nombre = $1, apellidos = $2, fecha_nacimiento = $3,
               nombre_deportivo = COALESCE($4, nombre_deportivo),
               dni = COALESCE($5, dni), email = COALESCE($6, email),
               telefono_deportista = COALESCE($7, telefono_deportista),
               telefono_padre = COALESCE($8, telefono_padre),
               telefono_madre = COALESCE($9, telefono_madre)
             WHERE id = $10`,
            [nombre, apellidos, fechaNacimiento, nombreDeportivo, dni, email, telefonoDeportista, telefonoPadre, telefonoMadre, deportistaId]
          );
        } else {
          esNuevo = true;
          const { rows: nuevo } = await cliente.query(
            `INSERT INTO deportistas
               (numero_socio, nombre, apellidos, fecha_nacimiento, nombre_deportivo, dni, email,
                telefono_deportista, telefono_padre, telefono_madre)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
            [numeroSocio, nombre, apellidos, fechaNacimiento, nombreDeportivo, dni, email, telefonoDeportista, telefonoPadre, telefonoMadre]
          );
          deportistaId = nuevo[0].id;
        }

        const { rows: periodoAbierto } = await cliente.query(
          'SELECT id FROM deportista_deportes WHERE deportista_id = $1 AND deporte_id = $2 AND fecha_baja IS NULL',
          [deportistaId, deporte.id]
        );
        if (periodoAbierto[0]) {
          if (tipoDeportista) {
            await cliente.query('UPDATE deportista_deportes SET tipo_deportista = $1 WHERE id = $2', [tipoDeportista, periodoAbierto[0].id]);
          }
        } else {
          await cliente.query(
            'INSERT INTO deportista_deportes (deportista_id, deporte_id, tipo_deportista) VALUES ($1, $2, $3)',
            [deportistaId, deporte.id, tipoDeportista]
          );
        }

        await cliente.query(
          `INSERT INTO deportista_equipo_temporada (deportista_id, equipo_id, temporada_id, dorsal)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (deportista_id, equipo_id, temporada_id)
           DO UPDATE SET dorsal = COALESCE(EXCLUDED.dorsal, deportista_equipo_temporada.dorsal)`,
          [deportistaId, equipo.id, temporadaId, dorsal]
        );

        await cliente.query('COMMIT');
      } catch (err) {
        await cliente.query('ROLLBACK');
        throw err;
      } finally {
        cliente.release();
      }

      if (esNuevo) creados.push(`${nombre} ${apellidos} (Nº ${numeroSocio})`);
      else actualizados.push(`${nombre} ${apellidos} (Nº ${numeroSocio})`);

      // Acceso opcional a "Mi app" - solo si se ha rellenado el email Y
      // el deportista no tenía ya uno (igual que POST /:id/acceso, no se
      // sobrescribe sin más un acceso existente).
      if (emailAcceso) {
        const { rows: actual } = await pool.query('SELECT usuario_id FROM deportistas WHERE id = $1', [deportistaId]);
        if (actual[0]?.usuario_id) {
          errores.push(`${etiquetaFila}: ya tenía acceso propio a Mi app, no se ha tocado (cámbialo desde su ficha si hace falta)`);
        } else if (!passwordInicial || passwordInicial.length < 8) {
          errores.push(`${etiquetaFila}: para crear el acceso a Mi app falta "Contraseña inicial" (mínimo 8 caracteres)`);
        } else {
          const clienteAcceso = await pool.connect();
          try {
            await clienteAcceso.query('BEGIN');
            const passwordHash = await bcrypt.hash(passwordInicial, RONDAS_BCRYPT);
            const emailFinal = emailAcceso.toLowerCase().trim();
            const { rows: nuevoUsuario } = await clienteAcceso.query(
              'INSERT INTO usuarios (email, password_hash, nombre_completo) VALUES ($1, $2, $3) RETURNING id',
              [emailFinal, passwordHash, `${nombre} ${apellidos}`]
            );
            const usuarioId = nuevoUsuario[0].id;
            const { rows: rolDeportista } = await clienteAcceso.query(`SELECT id FROM roles WHERE nombre = 'deportista'`);
            await clienteAcceso.query('INSERT INTO usuario_roles (usuario_id, rol_id) VALUES ($1, $2)', [usuarioId, rolDeportista[0].id]);
            await clienteAcceso.query('UPDATE deportistas SET usuario_id = $1 WHERE id = $2', [usuarioId, deportistaId]);
            await clienteAcceso.query('COMMIT');
            accesosCreados.push(`${nombre} ${apellidos} (${emailFinal})`);
          } catch (err) {
            await clienteAcceso.query('ROLLBACK');
            if (err.code === '23505') errores.push(`${etiquetaFila}: ya existe un usuario con el email "${emailAcceso}"`);
            else { console.error(err); errores.push(`${etiquetaFila}: error inesperado al crear el acceso a Mi app`); }
          } finally {
            clienteAcceso.release();
          }
        }
      }
    } catch (err) {
      if (err.code === '23505') {
        errores.push(`${etiquetaFila}: ya existe otro deportista con ese número de socio`);
      } else {
        console.error(err);
        errores.push(`${etiquetaFila}: error inesperado al procesar la fila`);
      }
    }
  }

  res.json({
    ok: true,
    creados: creados.length,
    actualizados: actualizados.length,
    accesosCreados: accesosCreados.length,
    detalleCreados: creados,
    detalleActualizados: actualizados,
    detalleAccesos: accesosCreados,
    errores,
  });
});

// --- Acceso propio a la app (login del deportista) ---------------------

// POST /api/deportistas/:id/acceso - crea un usuario de login con rol
// "deportista" y lo enlaza a esta ficha (deportistas.usuario_id), para que
// pueda entrar a "Mi app" con su propio email/contraseña. Solo
// administrador (es dar de alta una cuenta, igual que en Usuarios). Si el
// deportista ya tenía un acceso propio, hay que quitárselo primero (no se
// sobrescribe sin más, para no perder sin querer la cuenta anterior).
router.post('/:id/acceso', autenticar, requiereRol('administrador'), async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'email y contraseña (mínimo 8 caracteres) son obligatorios' });
  }
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows: actual } = await cliente.query(
      'SELECT usuario_id, nombre, apellidos FROM deportistas WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );
    if (!actual[0]) { await cliente.query('ROLLBACK'); return res.status(404).json({ error: 'Deportista no encontrado' }); }
    if (actual[0].usuario_id) {
      await cliente.query('ROLLBACK');
      return res.status(409).json({ error: 'Este deportista ya tiene un acceso propio' });
    }

    const passwordHash = await bcrypt.hash(password, RONDAS_BCRYPT);
    const nombreCompleto = `${actual[0].nombre} ${actual[0].apellidos}`;
    const { rows: nuevoUsuario } = await cliente.query(
      `INSERT INTO usuarios (email, password_hash, nombre_completo) VALUES ($1, $2, $3) RETURNING id`,
      [email.toLowerCase().trim(), passwordHash, nombreCompleto]
    );
    const usuarioId = nuevoUsuario[0].id;

    const { rows: rolDeportista } = await cliente.query(`SELECT id FROM roles WHERE nombre = 'deportista'`);
    await cliente.query('INSERT INTO usuario_roles (usuario_id, rol_id) VALUES ($1, $2)', [usuarioId, rolDeportista[0].id]);
    await cliente.query('UPDATE deportistas SET usuario_id = $1 WHERE id = $2', [usuarioId, req.params.id]);

    await cliente.query('COMMIT');
    res.status(201).json({ usuarioId, email: email.toLowerCase().trim() });
  } catch (err) {
    await cliente.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear el acceso' });
  } finally {
    cliente.release();
  }
});

// DELETE /api/deportistas/:id/acceso - revoca el acceso propio: desenlaza
// la ficha de su usuario y deja ese usuario inactivo (no se borra, para no
// perder histórico de quién hizo qué). Solo administrador.
router.delete('/:id/acceso', autenticar, requiereRol('administrador'), async (req, res) => {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows: actual } = await cliente.query('SELECT usuario_id FROM deportistas WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!actual[0]) { await cliente.query('ROLLBACK'); return res.status(404).json({ error: 'Deportista no encontrado' }); }
    if (!actual[0].usuario_id) { await cliente.query('ROLLBACK'); return res.status(404).json({ error: 'Este deportista no tiene acceso propio' }); }

    await cliente.query('UPDATE deportistas SET usuario_id = NULL WHERE id = $1', [req.params.id]);
    await cliente.query('UPDATE usuarios SET inactivo = TRUE WHERE id = $1', [actual[0].usuario_id]);

    await cliente.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await cliente.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al revocar el acceso' });
  } finally {
    cliente.release();
  }
});

// --- Estadísticas (para "Mi app" del deportista) ------------------------

// GET /api/deportistas/:id/estadisticas - resumen por cada deporte que
// practica ACTUALMENTE: en deportes de equipo (fútbol, baloncesto) los
// partidos jugados/convocatorias/goles/tarjetas (de partidos_alineacion +
// partidos_eventos) más la asistencia a entrenamientos de esa temporada;
// en deportes individuales, solo la asistencia. Mismo criterio de acceso
// que el resto de la ficha: administración ve cualquiera, personal técnico
// solo los suyos, y el propio deportista solo lo suyo.
router.get('/:id/estadisticas', autenticar, async (req, res) => {
  const { roles, id: usuarioId } = req.usuario;
  try {
    if (!roles.some((r) => ACCESO_TOTAL_LECTURA.includes(r))) {
      const autorizado = (await tieneAccesoPorEquipo(usuarioId, req.params.id)) || (await esElMismo(usuarioId, req.params.id));
      if (!autorizado) return res.status(403).json({ error: 'No tienes permiso para esto' });
    }

    const { rows: equipos } = await pool.query(
      `SELECT DISTINCT e.id AS equipo_id, e.nombre AS equipo_nombre,
              dep.id AS deporte_id, dep.nombre AS deporte_nombre, dep.tipo AS deporte_tipo,
              det.temporada_id
       FROM deportista_equipo_temporada det
       JOIN equipos e ON e.id = det.equipo_id
       JOIN deportes dep ON dep.id = e.deporte_id
       JOIN temporadas t ON t.id = det.temporada_id
       WHERE det.deportista_id = $1 AND t.es_principal = TRUE AND e.inactivo = FALSE
       ORDER BY dep.nombre, e.nombre`,
      [req.params.id]
    );

    const porDeporte = [];
    for (const eq of equipos) {
      const { rows: asistenciaRows } = await pool.query(
        `SELECT COUNT(a.id) FILTER (WHERE a.id IS NOT NULL) AS convocado,
                COUNT(a.id) FILTER (WHERE a.asistio = TRUE) AS asistidas
         FROM sesiones s
         LEFT JOIN asistencia a ON a.sesion_id = s.id AND a.deportista_id = $1
         WHERE s.equipo_id = $2 AND s.temporada_id = $3 AND s.cancelada = FALSE
           AND (s.solo_deportista_id IS NULL OR s.solo_deportista_id = $1)`,
        [req.params.id, eq.equipo_id, eq.temporada_id]
      );
      const convocado = Number(asistenciaRows[0].convocado);
      const asistidas = Number(asistenciaRows[0].asistidas);

      let partidos = null;
      if (eq.deporte_tipo === 'equipo') {
        const { rows: partidosRows } = await pool.query(
          `SELECT
             COUNT(DISTINCT pa.partido_id) AS convocatorias,
             COUNT(DISTINCT pa.partido_id) FILTER (WHERE p.jugado) AS jugados,
             COALESCE(SUM(CASE WHEN pe.tipo = 'gol_propio' THEN 1 ELSE 0 END), 0) AS goles,
             COALESCE(SUM(CASE WHEN pe.tipo = 'tarjeta_amarilla_propio' THEN 1 ELSE 0 END), 0) AS amarillas,
             COALESCE(SUM(CASE WHEN pe.tipo = 'tarjeta_roja_propio' THEN 1 ELSE 0 END), 0) AS rojas
           FROM partidos_alineacion pa
           JOIN partidos p ON p.id = pa.partido_id AND p.equipo_id = $2
           LEFT JOIN partidos_eventos pe ON pe.partido_id = pa.partido_id AND pe.deportista_id = pa.deportista_id
           WHERE pa.deportista_id = $1`,
          [req.params.id, eq.equipo_id]
        );
        const pr = partidosRows[0];
        partidos = {
          convocatorias: Number(pr.convocatorias),
          jugados: Number(pr.jugados),
          goles: Number(pr.goles),
          amarillas: Number(pr.amarillas),
          rojas: Number(pr.rojas),
        };
      }

      porDeporte.push({
        deporteId: eq.deporte_id,
        deporteNombre: eq.deporte_nombre,
        tipo: eq.deporte_tipo,
        equipoId: eq.equipo_id,
        equipoNombre: eq.equipo_nombre,
        temporadaId: eq.temporada_id,
        partidos,
        asistencia: {
          convocado,
          asistidas,
          porcentaje: convocado > 0 ? Math.round((asistidas / convocado) * 100) : null,
        },
      });
    }

    res.json({ porDeporte });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular las estadísticas' });
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
