// Días festivos del club (no se entrena). Al crear uno, quien lo da de
// alta marca a qué equipos afecta (un puente, por ejemplo, puede afectar
// solo a algunos equipos). Las sesiones ya existentes en esa fecha para
// esos equipos se cancelan automáticamente; las que se generen después
// para esa fecha (ver POST /equipos/:id/horarios/generar-sesiones) salen
// ya creadas como canceladas. Gestión deportiva: administrador, dirección
// deportiva o coordinador — igual que el resto de catálogos del club.
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { autenticar } = require('../middleware/auth');
const { requiereRol, GESTION_DEPORTIVA } = require('../middleware/permisos');

function filaAFestivo(fila) {
  return {
    id: fila.id,
    fecha: fila.fecha,
    descripcion: fila.descripcion,
    creadoEn: fila.creado_en,
    equipos: fila.equipos || [],
  };
}

// GET /api/festivos - todos los festivos, con los equipos a los que
// afecta cada uno (para poder enseñarlos y para poder borrarlos)
router.get('/', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT f.*,
        COALESCE(
          json_agg(json_build_object('id', e.id, 'nombre', e.nombre)) FILTER (WHERE e.id IS NOT NULL),
          '[]'
        ) AS equipos
      FROM festivos f
      LEFT JOIN festivo_equipos fe ON fe.festivo_id = f.id
      LEFT JOIN equipos e ON e.id = fe.equipo_id
      GROUP BY f.id
      ORDER BY f.fecha DESC
    `);
    res.json(rows.map(filaAFestivo));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar los festivos' });
  }
});

// POST /api/festivos - { fecha, descripcion, equipoIds: [...] }
// Cancela de inmediato (si no lo estaban ya) las sesiones de esos equipos
// en esa fecha, y deja constancia del festivo para que las que se
// generen más adelante para esa fecha salgan ya canceladas.
router.post('/', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  const { fecha, descripcion, equipoIds } = req.body;
  if (!fecha || !descripcion || !Array.isArray(equipoIds) || equipoIds.length === 0) {
    return res.status(400).json({ error: 'Fecha, descripción y al menos un equipo son obligatorios' });
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows } = await cliente.query(
      'INSERT INTO festivos (fecha, descripcion, creado_por) VALUES ($1, $2, $3) RETURNING id',
      [fecha, descripcion, req.usuario.id]
    );
    const festivoId = rows[0].id;

    for (const equipoId of equipoIds) {
      await cliente.query(
        'INSERT INTO festivo_equipos (festivo_id, equipo_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [festivoId, equipoId]
      );
    }

    const { rowCount: canceladas } = await cliente.query(
      `UPDATE sesiones SET cancelada = TRUE, motivo_cancelacion = $1
       WHERE equipo_id = ANY($2::uuid[]) AND fecha = $3 AND cancelada = FALSE`,
      [`Festivo: ${descripcion}`, equipoIds, fecha]
    );

    await cliente.query('COMMIT');
    res.status(201).json({ id: festivoId, sesionesCanceladas: canceladas });
  } catch (err) {
    await cliente.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al crear el festivo' });
  } finally {
    cliente.release();
  }
});

// DELETE /api/festivos/:id - quita el festivo del calendario. OJO: no
// reactiva las sesiones que canceló (podrían haberse cancelado también
// por otro motivo mientras tanto) — si alguna sí debe jugarse, se
// reactiva a mano con el botón "Reactivar" de esa sesión.
router.delete('/:id', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM festivos WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Festivo no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el festivo' });
  }
});

module.exports = router;
