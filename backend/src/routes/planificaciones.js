// Planificación mensual: coordinador (o dirección deportiva/admin) fija
// los objetivos/contenido de cada mes para un equipo; el entrenador de
// ese equipo lo consulta. Una fila por equipo/temporada/año/mes — ver
// `planificaciones_mensuales` en database/03_schema_ejercicios.sql.
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { autenticar } = require('../middleware/auth');
const { ACCESO_TOTAL_LECTURA, GESTION_DEPORTIVA } = require('../middleware/permisos');

function filaAPlanificacion(fila) {
  return {
    id: fila.id,
    equipoId: fila.equipo_id,
    temporadaId: fila.temporada_id,
    anio: fila.anio,
    mes: fila.mes,
    contenido: fila.contenido,
  };
}

async function usuarioEsPersonalDelEquipo(usuarioId, equipoId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM equipo_personal WHERE equipo_id = $1 AND usuario_id = $2 LIMIT 1',
    [equipoId, usuarioId]
  );
  return rows.length > 0;
}

async function puedeVerEquipo(req, equipoId) {
  const { roles, id: usuarioId } = req.usuario;
  if (roles.some((r) => ACCESO_TOTAL_LECTURA.includes(r))) return true;
  return usuarioEsPersonalDelEquipo(usuarioId, equipoId);
}

// GET /api/planificaciones?equipoId=&temporadaId= - los meses ya
// planificados de ese equipo/temporada.
router.get('/', autenticar, async (req, res) => {
  const { equipoId, temporadaId } = req.query;
  if (!equipoId || !temporadaId) return res.status(400).json({ error: 'equipoId y temporadaId son obligatorios' });
  if (!(await puedeVerEquipo(req, equipoId))) {
    return res.status(403).json({ error: 'No tienes permiso para esto' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT * FROM planificaciones_mensuales WHERE equipo_id = $1 AND temporada_id = $2 ORDER BY anio, mes',
      [equipoId, temporadaId]
    );
    res.json(rows.map(filaAPlanificacion));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar la planificación' });
  }
});

// PUT /api/planificaciones - fija (crea o actualiza) el contenido de un
// mes concreto. Solo dirección deportiva/administrador/coordinador.
router.put('/', autenticar, async (req, res) => {
  const { roles, id: usuarioId } = req.usuario;
  const { equipoId, temporadaId, anio, mes, contenido } = req.body;
  if (!equipoId || !temporadaId || !anio || !mes) {
    return res.status(400).json({ error: 'equipoId, temporadaId, anio y mes son obligatorios' });
  }
  if (mes < 1 || mes > 12) return res.status(400).json({ error: 'mes debe estar entre 1 y 12' });
  if (!roles.some((r) => GESTION_DEPORTIVA.includes(r))) {
    return res.status(403).json({ error: 'Solo dirección deportiva, administrador o coordinador pueden fijar la planificación' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO planificaciones_mensuales (equipo_id, temporada_id, anio, mes, contenido, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (equipo_id, temporada_id, anio, mes) DO UPDATE SET
         contenido = EXCLUDED.contenido
       RETURNING id`,
      [equipoId, temporadaId, anio, mes, contenido || '', usuarioId]
    );
    res.json({ id: rows[0].id, ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar la planificación' });
  }
});

// DELETE /api/planificaciones/:id - borrar el contenido de un mes.
router.delete('/:id', autenticar, async (req, res) => {
  const { roles } = req.usuario;
  if (!roles.some((r) => GESTION_DEPORTIVA.includes(r))) {
    return res.status(403).json({ error: 'No tienes permiso para esto' });
  }
  try {
    const { rows } = await pool.query('DELETE FROM planificaciones_mensuales WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'No encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la planificación' });
  }
});

module.exports = router;
