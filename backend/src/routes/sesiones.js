// Sesiones de entrenamiento y control de asistencia. Pensado sobre todo
// para los deportes individuales (Muay Thai, pádel, tenis...), donde no
// hay "partidos" y la asistencia es la métrica que de verdad importa —
// pero funciona igual para cualquier equipo, de equipo o individual.
//
// Mismo criterio de visibilidad que en equipos.js/partidos.js:
// administrador/dirección deportiva/coordinador ven y gestionan todo;
// entrenador/monitor solo lo suyo (equipo_personal).
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { autenticar } = require('../middleware/auth');
const { ACCESO_TOTAL_LECTURA, GESTION_DEPORTIVA } = require('../middleware/permisos');

function filaASesion(fila) {
  return {
    id: fila.id,
    equipoId: fila.equipo_id,
    temporadaId: fila.temporada_id,
    fecha: fila.fecha,
    horaInicio: fila.hora_inicio,
    titulo: fila.titulo,
    cancelada: fila.cancelada,
    motivoCancelacion: fila.motivo_cancelacion,
  };
}

function filaAAsistencia(fila) {
  return {
    deportistaId: fila.deportista_id,
    nombre: fila.nombre,
    apellidos: fila.apellidos,
    asistio: fila.asistio,
    justificada: fila.justificada,
    confirmacionPrevia: fila.confirmacion_previa,
  };
}

async function usuarioEsPersonalDelEquipo(usuarioId, equipoId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM equipo_personal WHERE equipo_id = $1 AND usuario_id = $2 LIMIT 1',
    [equipoId, usuarioId]
  );
  return rows.length > 0;
}

async function puedeGestionarEquipo(req, equipoId) {
  const { roles, id: usuarioId } = req.usuario;
  if (roles.some((r) => GESTION_DEPORTIVA.includes(r))) return true;
  return usuarioEsPersonalDelEquipo(usuarioId, equipoId);
}

async function puedeVerEquipo(req, equipoId) {
  const { roles, id: usuarioId } = req.usuario;
  if (roles.some((r) => ACCESO_TOTAL_LECTURA.includes(r))) return true;
  return usuarioEsPersonalDelEquipo(usuarioId, equipoId);
}

// GET /api/sesiones?equipoId=&temporadaId=
router.get('/', autenticar, async (req, res) => {
  const { equipoId, temporadaId } = req.query;
  if (!equipoId) return res.status(400).json({ error: 'equipoId es obligatorio' });
  if (!(await puedeVerEquipo(req, equipoId))) {
    return res.status(403).json({ error: 'No tienes permiso para esto' });
  }
  const condiciones = ['s.equipo_id = $1'];
  const parametros = [equipoId];
  if (temporadaId) {
    parametros.push(temporadaId);
    condiciones.push(`s.temporada_id = $${parametros.length}`);
  }
  try {
    const { rows } = await pool.query(
      `SELECT s.* FROM sesiones s WHERE ${condiciones.join(' AND ')} ORDER BY s.fecha DESC, s.hora_inicio DESC NULLS LAST`,
      parametros
    );
    res.json(rows.map(filaASesion));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar las sesiones' });
  }
});

// GET /api/sesiones/resumen-asistencia?equipoId=&temporadaId= - por cada
// deportista de la plantilla: sesiones convocado, asistidas y faltas sin
// justificar. Es la base del futuro aviso de "faltas sin justificar" en
// el dashboard de Inicio.
router.get('/resumen-asistencia', autenticar, async (req, res) => {
  const { equipoId, temporadaId } = req.query;
  if (!equipoId || !temporadaId) return res.status(400).json({ error: 'equipoId y temporadaId son obligatorios' });
  if (!(await puedeVerEquipo(req, equipoId))) {
    return res.status(403).json({ error: 'No tienes permiso para esto' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT d.id AS deportista_id, d.nombre, d.apellidos,
              COUNT(a.id) FILTER (WHERE a.id IS NOT NULL) AS convocado,
              COUNT(a.id) FILTER (WHERE a.asistio = TRUE) AS asistidas,
              COUNT(a.id) FILTER (WHERE a.asistio = FALSE AND a.justificada = FALSE) AS faltas_sin_justificar
       FROM deportista_equipo_temporada det
       JOIN deportistas d ON d.id = det.deportista_id
       JOIN sesiones s ON s.equipo_id = det.equipo_id AND s.temporada_id = det.temporada_id AND s.cancelada = FALSE
       LEFT JOIN asistencia a ON a.sesion_id = s.id AND a.deportista_id = d.id
       WHERE det.equipo_id = $1 AND det.temporada_id = $2
       GROUP BY d.id, d.nombre, d.apellidos
       ORDER BY d.apellidos, d.nombre`,
      [equipoId, temporadaId]
    );
    res.json(rows.map((f) => ({
      deportistaId: f.deportista_id,
      nombre: f.nombre,
      apellidos: f.apellidos,
      convocado: Number(f.convocado),
      asistidas: Number(f.asistidas),
      faltasSinJustificar: Number(f.faltas_sin_justificar),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular el resumen de asistencia' });
  }
});

// POST /api/sesiones - crear sesión (fecha/hora/título).
router.post('/', autenticar, async (req, res) => {
  const { equipoId, temporadaId, fecha, horaInicio, titulo } = req.body;
  if (!equipoId || !temporadaId || !fecha) {
    return res.status(400).json({ error: 'equipoId, temporadaId y fecha son obligatorios' });
  }
  if (!(await puedeGestionarEquipo(req, equipoId))) {
    return res.status(403).json({ error: 'No tienes permiso para esto' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO sesiones (equipo_id, temporada_id, fecha, hora_inicio, titulo, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [equipoId, temporadaId, fecha, horaInicio || null, titulo || null, req.usuario.id]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear la sesión' });
  }
});

// PUT /api/sesiones/:id - editar datos, o cancelarla (con motivo).
router.put('/:id', autenticar, async (req, res) => {
  try {
    const { rows: actual } = await pool.query('SELECT equipo_id FROM sesiones WHERE id = $1', [req.params.id]);
    if (!actual[0]) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (!(await puedeGestionarEquipo(req, actual[0].equipo_id))) {
      return res.status(403).json({ error: 'No tienes permiso para esto' });
    }
    const { fecha, horaInicio, titulo, cancelada, motivoCancelacion } = req.body;
    const { rows } = await pool.query(
      `UPDATE sesiones SET
         fecha = COALESCE($1, fecha),
         hora_inicio = COALESCE($2, hora_inicio),
         titulo = COALESCE($3, titulo),
         cancelada = COALESCE($4, cancelada),
         motivo_cancelacion = COALESCE($5, motivo_cancelacion)
       WHERE id = $6 RETURNING id`,
      [fecha, horaInicio, titulo, cancelada, motivoCancelacion, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Sesión no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la sesión' });
  }
});

// DELETE /api/sesiones/:id - eliminar sesión mal creada (con su
// asistencia asociada, por el ON DELETE CASCADE).
router.delete('/:id', autenticar, async (req, res) => {
  try {
    const { rows: actual } = await pool.query('SELECT equipo_id FROM sesiones WHERE id = $1', [req.params.id]);
    if (!actual[0]) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (!(await puedeGestionarEquipo(req, actual[0].equipo_id))) {
      return res.status(403).json({ error: 'No tienes permiso para esto' });
    }
    await pool.query('DELETE FROM sesiones WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la sesión' });
  }
});

// GET /api/sesiones/:id/asistencia - asistencia de TODA la plantilla del
// equipo de esa sesión (con o sin fila de asistencia todavía).
router.get('/:id/asistencia', autenticar, async (req, res) => {
  try {
    const { rows: sesion } = await pool.query('SELECT * FROM sesiones WHERE id = $1', [req.params.id]);
    if (!sesion[0]) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (!(await puedeVerEquipo(req, sesion[0].equipo_id))) {
      return res.status(403).json({ error: 'No tienes permiso para esto' });
    }
    const { rows } = await pool.query(
      `SELECT d.id AS deportista_id, d.nombre, d.apellidos,
              a.asistio, a.justificada, a.confirmacion_previa
       FROM deportista_equipo_temporada det
       JOIN deportistas d ON d.id = det.deportista_id
       LEFT JOIN asistencia a ON a.sesion_id = $1 AND a.deportista_id = d.id
       WHERE det.equipo_id = $2 AND det.temporada_id = $3
       ORDER BY d.apellidos, d.nombre`,
      [req.params.id, sesion[0].equipo_id, sesion[0].temporada_id]
    );
    res.json({ sesion: filaASesion(sesion[0]), asistencia: rows.map(filaAAsistencia) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar la asistencia' });
  }
});

// PUT /api/sesiones/:id/asistencia/:deportistaId - marcar/actualizar la
// asistencia de un deportista a esa sesión (asistió sí/no, justificada).
router.put('/:id/asistencia/:deportistaId', autenticar, async (req, res) => {
  const { asistio, justificada } = req.body;
  try {
    const { rows: sesion } = await pool.query('SELECT equipo_id FROM sesiones WHERE id = $1', [req.params.id]);
    if (!sesion[0]) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (!(await puedeGestionarEquipo(req, sesion[0].equipo_id))) {
      return res.status(403).json({ error: 'No tienes permiso para esto' });
    }
    await pool.query(
      `INSERT INTO asistencia (sesion_id, deportista_id, asistio, justificada, registrado_por)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (sesion_id, deportista_id) DO UPDATE SET
         asistio = EXCLUDED.asistio,
         justificada = EXCLUDED.justificada,
         registrado_por = EXCLUDED.registrado_por`,
      [req.params.id, req.params.deportistaId, asistio ?? null, justificada || false, req.usuario.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar la asistencia' });
  }
});

module.exports = router;
