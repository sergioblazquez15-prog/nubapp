// Equipos: uno por deporte y temporada (ej: "Cadete" de fútbol en
// 2026/2027). Aquí se gestiona el equipo en sí, quién es su personal
// (entrenador/coordinador/monitor) y qué deportistas tiene esa
// temporada, con su dorsal y su ficha técnica.
//
// Mismo patrón de permisos que en deportistas.js: administrador y
// dirección deportiva ven y gestionan todos los equipos; coordinador
// también puede gestionar (dar de alta equipos, mover jugadores...);
// entrenador/monitor solo ven y editan la ficha técnica de SUS equipos
// (los que tienen asignados en equipo_personal).
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { autenticar } = require('../middleware/auth');
const { requiereRol, ACCESO_TOTAL_LECTURA, GESTION_DEPORTIVA } = require('../middleware/permisos');

function filaAEquipo(fila) {
  return {
    id: fila.id,
    temporadaId: fila.temporada_id,
    temporadaNombre: fila.temporada_nombre,
    deporteId: fila.deporte_id,
    deporteNombre: fila.deporte_nombre,
    deporteTipo: fila.deporte_tipo,
    nombre: fila.nombre,
    categoria: fila.categoria,
    clubNombre: fila.club_nombre,
    inactivo: fila.inactivo,
    numeroDeportistas: fila.numero_deportistas !== undefined ? Number(fila.numero_deportistas) : undefined,
  };
}

const CONSULTA_LISTADO = `
  SELECT e.*, t.nombre AS temporada_nombre, dep.nombre AS deporte_nombre, dep.tipo AS deporte_tipo,
    COUNT(det.id) FILTER (WHERE det.id IS NOT NULL) AS numero_deportistas
  FROM equipos e
  JOIN temporadas t ON t.id = e.temporada_id
  JOIN deportes dep ON dep.id = e.deporte_id
  LEFT JOIN deportista_equipo_temporada det ON det.equipo_id = e.id
`;

async function usuarioEsPersonalDelEquipo(usuarioId, equipoId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM equipo_personal WHERE equipo_id = $1 AND usuario_id = $2 LIMIT 1',
    [equipoId, usuarioId]
  );
  return rows.length > 0;
}

// GET /api/equipos?temporadaId=&deporteId=&estado=activo|inactivo|todos
router.get('/', autenticar, async (req, res) => {
  const { roles, id: usuarioId } = req.usuario;
  const { temporadaId, deporteId, estado } = req.query;

  const condiciones = [];
  const parametros = [];
  const nuevoParametro = (valor) => {
    parametros.push(valor);
    return `$${parametros.length}`;
  };

  if (estado === 'inactivo') {
    condiciones.push('e.inactivo = TRUE');
  } else if (estado !== 'todos') {
    condiciones.push('e.inactivo = FALSE');
  }

  if (temporadaId) {
    condiciones.push(`e.temporada_id = ${nuevoParametro(temporadaId)}`);
  }
  if (deporteId) {
    condiciones.push(`e.deporte_id = ${nuevoParametro(deporteId)}`);
  }
  if (!roles.some((r) => ACCESO_TOTAL_LECTURA.includes(r))) {
    const marcador = nuevoParametro(usuarioId);
    condiciones.push(`EXISTS (SELECT 1 FROM equipo_personal ep WHERE ep.equipo_id = e.id AND ep.usuario_id = ${marcador})`);
  }

  const clausulaWhere = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const consulta = `${CONSULTA_LISTADO} ${clausulaWhere} GROUP BY e.id, t.nombre, dep.nombre, dep.tipo ORDER BY dep.nombre, e.nombre`;

  try {
    const { rows } = await pool.query(consulta, parametros);
    res.json(rows.map(filaAEquipo));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar los equipos' });
  }
});

// GET /api/equipos/:id - ficha del equipo con su plantilla (personal +
// deportistas de esta temporada, con dorsal)
router.get('/:id', autenticar, async (req, res) => {
  const { roles, id: usuarioId } = req.usuario;
  const equipoId = req.params.id;

  try {
    if (!roles.some((r) => ACCESO_TOTAL_LECTURA.includes(r))) {
      const autorizado = await usuarioEsPersonalDelEquipo(usuarioId, equipoId);
      if (!autorizado) return res.status(403).json({ error: 'No tienes permiso para esto' });
    }

    const { rows } = await pool.query(
      `SELECT e.*, t.nombre AS temporada_nombre, dep.nombre AS deporte_nombre, dep.tipo AS deporte_tipo
       FROM equipos e
       JOIN temporadas t ON t.id = e.temporada_id
       JOIN deportes dep ON dep.id = e.deporte_id
       WHERE e.id = $1`,
      [equipoId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Equipo no encontrado' });

    const { rows: personal } = await pool.query(
      `SELECT ep.usuario_id AS "usuarioId", ep.rol_en_equipo AS "rolEnEquipo", u.nombre_completo AS "nombreCompleto"
       FROM equipo_personal ep
       JOIN usuarios u ON u.id = ep.usuario_id
       WHERE ep.equipo_id = $1
       ORDER BY u.nombre_completo`,
      [equipoId]
    );

    const { rows: deportistas } = await pool.query(
      `SELECT det.id AS "detId", det.dorsal, d.id, d.nombre, d.apellidos, d.numero_socio AS "numeroSocio",
         d.lesionado, d.inactivo, d.foto_url AS "fotoUrl",
         ft.id AS "fichaTecnicaId", ft.lateralidad, ft.genero,
         ft.posicion_principal AS "posicionPrincipal",
         ft.posicion_secundaria AS "posicionSecundaria",
         ft.valoracion_tecnica AS "valoracionTecnica",
         ft.valoracion_tactica AS "valoracionTactica",
         ft.valoracion_fisica AS "valoracionFisica",
         ft.valoracion_psicologica AS "valoracionPsicologica",
         ft.valoracion_personalidad AS "valoracionPersonalidad"
       FROM deportista_equipo_temporada det
       JOIN deportistas d ON d.id = det.deportista_id
       LEFT JOIN fichas_tecnicas ft ON ft.deportista_equipo_temp_id = det.id
       WHERE det.equipo_id = $1
       ORDER BY det.dorsal NULLS LAST, d.apellidos`,
      [equipoId]
    );

    res.json({ ...filaAEquipo(rows[0]), personal, deportistas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar el equipo' });
  }
});

// POST /api/equipos - crear equipo (administrador, dirección deportiva o
// coordinador)
router.post('/', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  const { nombre, categoria, clubNombre, deporteId, temporadaId } = req.body;

  if (!nombre || !deporteId) {
    return res.status(400).json({ error: 'Nombre y deporte son obligatorios' });
  }

  try {
    let temporada = temporadaId;
    if (!temporada) {
      const { rows } = await pool.query('SELECT id FROM temporadas WHERE es_principal = TRUE');
      if (!rows[0]) return res.status(400).json({ error: 'No hay ninguna temporada marcada como principal; indica temporadaId' });
      temporada = rows[0].id;
    }

    const { rows } = await pool.query(
      `INSERT INTO equipos (temporada_id, deporte_id, nombre, categoria, club_nombre)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [temporada, deporteId, nombre, categoria || null, clubNombre || null]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un equipo con ese nombre en esa temporada y deporte' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear el equipo' });
  }
});

// PUT /api/equipos/:id - editar datos básicos
router.put('/:id', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  const { nombre, categoria, clubNombre, inactivo } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE equipos SET
         nombre      = COALESCE($1, nombre),
         categoria   = COALESCE($2, categoria),
         club_nombre = COALESCE($3, club_nombre),
         inactivo    = COALESCE($4, inactivo)
       WHERE id = $5
       RETURNING id`,
      [nombre ?? null, categoria ?? null, clubNombre ?? null, typeof inactivo === 'boolean' ? inactivo : null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Equipo no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el equipo' });
  }
});

// DELETE /api/equipos/:id - baja lógica (no se borra: se pierde el
// histórico de esa temporada)
router.delete('/:id', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  try {
    const { rows } = await pool.query('UPDATE equipos SET inactivo = TRUE WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Equipo no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al dar de baja el equipo' });
  }
});

// POST /api/equipos/:id/personal - asignar entrenador/coordinador/monitor
router.post('/:id/personal', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  const { usuarioId, rolEnEquipo } = req.body;
  if (!usuarioId || !['entrenador', 'coordinador', 'monitor'].includes(rolEnEquipo)) {
    return res.status(400).json({ error: 'usuarioId y rolEnEquipo ("entrenador", "coordinador" o "monitor") son obligatorios' });
  }
  try {
    await pool.query(
      `INSERT INTO equipo_personal (equipo_id, usuario_id, rol_en_equipo) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [req.params.id, usuarioId, rolEnEquipo]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al asignar personal al equipo' });
  }
});

// DELETE /api/equipos/:id/personal/:usuarioId/:rolEnEquipo - quitar
router.delete('/:id/personal/:usuarioId/:rolEnEquipo', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM equipo_personal WHERE equipo_id = $1 AND usuario_id = $2 AND rol_en_equipo = $3',
      [req.params.id, req.params.usuarioId, req.params.rolEnEquipo]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al quitar personal del equipo' });
  }
});

// POST /api/equipos/:id/deportistas - fichar a un deportista por este
// equipo, en la temporada del equipo (dorsal opcional)
router.post('/:id/deportistas', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  const { deportistaId, dorsal } = req.body;
  if (!deportistaId) return res.status(400).json({ error: 'deportistaId es obligatorio' });

  try {
    const { rows: equipos } = await pool.query('SELECT temporada_id FROM equipos WHERE id = $1', [req.params.id]);
    if (!equipos[0]) return res.status(404).json({ error: 'Equipo no encontrado' });

    const { rows } = await pool.query(
      `INSERT INTO deportista_equipo_temporada (deportista_id, equipo_id, temporada_id, dorsal)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [deportistaId, req.params.id, equipos[0].temporada_id, dorsal || null]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ese deportista ya está en este equipo esta temporada' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al fichar al deportista por el equipo' });
  }
});

// PUT /api/equipos/:id/deportistas/:deportistaId - cambiar el dorsal
router.put('/:id/deportistas/:deportistaId', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  const { dorsal } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE deportista_equipo_temporada SET dorsal = $1
       WHERE equipo_id = $2 AND deportista_id = $3 RETURNING id`,
      [dorsal ?? null, req.params.id, req.params.deportistaId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Ese deportista no está en este equipo' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el dorsal' });
  }
});

// DELETE /api/equipos/:id/deportistas/:deportistaId - quitar del equipo
// esta temporada (no toca la ficha general del deportista)
router.delete('/:id/deportistas/:deportistaId', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM deportista_equipo_temporada WHERE equipo_id = $1 AND deportista_id = $2',
      [req.params.id, req.params.deportistaId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al quitar al deportista del equipo' });
  }
});

// PUT /api/equipos/:id/deportistas/:deportistaId/ficha-tecnica - crea o
// actualiza la ficha técnica (dorsal aparte, esto es posición y
// valoraciones). También la puede tocar el entrenador/coordinador/monitor
// de ESE equipo, no solo dirección deportiva.
// Posiciones fijas por deporte, para validar lo que llega del esquema de
// campo/pista del frontend (ver frontend/src/pages/Equipos.jsx). Si el
// deporte no tiene un catálogo definido (deportes individuales), no se
// valida: sencillamente no se les pide posición desde la interfaz.
const POSICIONES_POR_DEPORTE = {
  Futbol: ['portero', 'central', 'lateral', 'medio_centro', 'interior', 'extremo', 'delantero'],
  Baloncesto: ['base', 'escolta', 'alero', 'ala_pivot', 'pivot'],
};

router.put('/:id/deportistas/:deportistaId/ficha-tecnica', autenticar, async (req, res) => {
  const { roles, id: usuarioId } = req.usuario;
  const {
    lateralidad,
    genero,
    posicionPrincipal,
    posicionSecundaria,
    valoracionTecnica,
    valoracionTactica,
    valoracionFisica,
    valoracionPsicologica,
    valoracionPersonalidad,
  } = req.body;

  try {
    if (!roles.some((r) => ACCESO_TOTAL_LECTURA.includes(r))) {
      const autorizado = await usuarioEsPersonalDelEquipo(usuarioId, req.params.id);
      if (!autorizado) return res.status(403).json({ error: 'No tienes permiso para esto' });
    }

    const { rows: det } = await pool.query(
      `SELECT det.id, dep.nombre AS deporte_nombre
       FROM deportista_equipo_temporada det
       JOIN equipos e ON e.id = det.equipo_id
       JOIN deportes dep ON dep.id = e.deporte_id
       WHERE det.equipo_id = $1 AND det.deportista_id = $2`,
      [req.params.id, req.params.deportistaId]
    );
    if (!det[0]) return res.status(404).json({ error: 'Ese deportista no está en este equipo' });

    const catalogo = POSICIONES_POR_DEPORTE[det[0].deporte_nombre];
    if (catalogo) {
      if (posicionPrincipal && !catalogo.includes(posicionPrincipal)) {
        return res.status(400).json({ error: `Posición principal no válida para ${det[0].deporte_nombre}` });
      }
      if (posicionSecundaria && !catalogo.includes(posicionSecundaria)) {
        return res.status(400).json({ error: `Posición secundaria no válida para ${det[0].deporte_nombre}` });
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO fichas_tecnicas
         (deportista_equipo_temp_id, lateralidad, genero, posicion_principal, posicion_secundaria,
          valoracion_tecnica, valoracion_tactica, valoracion_fisica, valoracion_psicologica, valoracion_personalidad)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (deportista_equipo_temp_id) DO UPDATE SET
         lateralidad = EXCLUDED.lateralidad,
         genero = EXCLUDED.genero,
         posicion_principal = EXCLUDED.posicion_principal,
         posicion_secundaria = EXCLUDED.posicion_secundaria,
         valoracion_tecnica = EXCLUDED.valoracion_tecnica,
         valoracion_tactica = EXCLUDED.valoracion_tactica,
         valoracion_fisica = EXCLUDED.valoracion_fisica,
         valoracion_psicologica = EXCLUDED.valoracion_psicologica,
         valoracion_personalidad = EXCLUDED.valoracion_personalidad,
         actualizado_en = now()
       RETURNING id`,
      [
        det[0].id,
        lateralidad || null,
        genero || null,
        posicionPrincipal || null,
        posicionSecundaria || null,
        valoracionTecnica ?? null,
        valoracionTactica ?? null,
        valoracionFisica ?? null,
        valoracionPsicologica ?? null,
        valoracionPersonalidad ?? null,
      ]
    );
    res.json({ id: rows[0].id, ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar la ficha técnica' });
  }
});

module.exports = router;
