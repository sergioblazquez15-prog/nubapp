// Catálogo de competiciones por equipo y temporada (ligas, copas, torneos,
// amistosos). Antes un partido solo tenía un campo de texto libre; esto
// permite gestionar la competición como una entidad propia y así agrupar
// partidos, o simplemente etiquetar tandas de amistosos.
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { autenticar } = require('../middleware/auth');
const { requiereRol, GESTION_DEPORTIVA } = require('../middleware/permisos');

function filaACompeticion(fila) {
  return {
    id: fila.id,
    equipoId: fila.equipo_id,
    temporadaId: fila.temporada_id,
    nombre: fila.nombre,
    tipo: fila.tipo,
    creadoEn: fila.creado_en,
  };
}

async function usuarioEsPersonalDelEquipo(usuarioId, equipoId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM equipo_personal WHERE equipo_id = $1 AND usuario_id = $2',
    [equipoId, usuarioId]
  );
  return rows.length > 0;
}

// GET /api/competiciones?equipoId=&temporadaId=
router.get('/', autenticar, async (req, res) => {
  const { equipoId, temporadaId } = req.query;
  if (!equipoId) return res.status(400).json({ error: 'equipoId es obligatorio' });
  const condiciones = ['equipo_id = $1'];
  const parametros = [equipoId];
  if (temporadaId) {
    parametros.push(temporadaId);
    condiciones.push(`temporada_id = $${parametros.length}`);
  }
  try {
    const { rows } = await pool.query(
      `SELECT * FROM competiciones WHERE ${condiciones.join(' AND ')} ORDER BY creado_en DESC`,
      parametros
    );
    res.json(rows.map(filaACompeticion));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar las competiciones' });
  }
});

// POST /api/competiciones - crear (dirección deportiva/admin/coordinador,
// o el propio personal técnico del equipo).
router.post('/', autenticar, async (req, res) => {
  const { roles, id: usuarioId } = req.usuario;
  const { equipoId, temporadaId, nombre, tipo } = req.body;
  if (!equipoId || !temporadaId || !nombre) {
    return res.status(400).json({ error: 'equipoId, temporadaId y nombre son obligatorios' });
  }
  const tiposValidos = ['liga', 'copa', 'torneo', 'amistoso'];
  if (!roles.some((r) => GESTION_DEPORTIVA.includes(r))) {
    const autorizado = await usuarioEsPersonalDelEquipo(usuarioId, equipoId);
    if (!autorizado) return res.status(403).json({ error: 'No tienes permiso para esto' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO competiciones (equipo_id, temporada_id, nombre, tipo, creado_por)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [equipoId, temporadaId, nombre, tiposValidos.includes(tipo) ? tipo : 'liga', usuarioId]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una competición con ese nombre para este equipo y temporada' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear la competición' });
  }
});

// PUT /api/competiciones/:id - editar nombre/tipo.
router.put('/:id', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  const { nombre, tipo } = req.body;
  const tiposValidos = ['liga', 'copa', 'torneo', 'amistoso'];
  try {
    const { rows } = await pool.query(
      `UPDATE competiciones SET
         nombre = COALESCE($1, nombre),
         tipo   = COALESCE($2, tipo)
       WHERE id = $3
       RETURNING id`,
      [nombre || null, tiposValidos.includes(tipo) ? tipo : null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Competición no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la competición' });
  }
});

// DELETE /api/competiciones/:id - los partidos que la usaban se quedan
// sin competición (ON DELETE SET NULL), no se borran.
router.delete('/:id', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM competiciones WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Competición no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la competición' });
  }
});

module.exports = router;
