// Temporadas: cada equipo, ficha técnica, etc. cuelga de una temporada
// (ver decisiones clave en el README). Cualquier usuario logueado puede
// consultarlas (las necesita para los selectores); solo dirección
// deportiva/coordinador pueden crear o cerrar una.
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { autenticar } = require('../middleware/auth');
const { requiereRol, GESTION_DEPORTIVA } = require('../middleware/permisos');

function filaATemporada(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    fechaInicio: fila.fecha_inicio,
    fechaFin: fila.fecha_fin,
    esPrincipal: fila.es_principal,
    activa: fila.activa,
    cerrada: fila.cerrada,
  };
}

router.get('/', autenticar, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM temporadas ORDER BY fecha_inicio DESC'
    );
    res.json(rows.map(filaATemporada));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar las temporadas' });
  }
});

router.post('/', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  const { nombre, fechaInicio, fechaFin } = req.body;
  if (!nombre || !fechaInicio || !fechaFin) {
    return res.status(400).json({ error: 'Nombre, fecha de inicio y fecha de fin son obligatorios' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO temporadas (nombre, fecha_inicio, fecha_fin) VALUES ($1, $2, $3) RETURNING id',
      [nombre, fechaInicio, fechaFin]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una temporada con ese nombre' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear la temporada' });
  }
});

// Marca esta temporada como la principal (la que se propone por defecto
// al crear equipos nuevos) y se la quita a las demás.
router.put('/:id/principal', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('UPDATE temporadas SET es_principal = FALSE WHERE es_principal = TRUE');
    const { rowCount } = await cliente.query(
      'UPDATE temporadas SET es_principal = TRUE WHERE id = $1',
      [req.params.id]
    );
    if (rowCount === 0) {
      await cliente.query('ROLLBACK');
      return res.status(404).json({ error: 'Temporada no encontrada' });
    }
    await cliente.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await cliente.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al marcar la temporada como principal' });
  } finally {
    cliente.release();
  }
});

// Cierra la temporada: pasa a ser de solo consulta (histórico). No borra
// nada, simplemente dejamos de proponerla para altas nuevas.
router.put('/:id/cerrar', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE temporadas SET cerrada = TRUE, activa = FALSE WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Temporada no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cerrar la temporada' });
  }
});

// POST /api/temporadas/:id/traspaso - traspasa equipos, su personal y su
// plantilla (deportistas activos) desde otra temporada a esta. Pensado
// para el cambio de curso: en vez de recrear cada equipo a mano, se copian
// los de la temporada anterior. Es seguro repetirlo (un equipo que ya
// exista en destino con el mismo nombre/deporte no se duplica, y un
// deportista ya fichado tampoco). Deliberadamente NO copia fichas
// técnicas ni dorsales si se pide así: cada temporada empieza con la
// valoración en blanco, para no arrastrar datos de un año a otro.
router.post('/:id/traspaso', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  const temporadaDestinoId = req.params.id;
  const { temporadaOrigenId, incluirDorsales } = req.body;
  if (!temporadaOrigenId) return res.status(400).json({ error: 'temporadaOrigenId es obligatorio' });
  if (temporadaOrigenId === temporadaDestinoId) {
    return res.status(400).json({ error: 'La temporada de origen y la de destino no pueden ser la misma' });
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    const destino = await cliente.query('SELECT id FROM temporadas WHERE id = $1', [temporadaDestinoId]);
    const origen = await cliente.query('SELECT id FROM temporadas WHERE id = $1', [temporadaOrigenId]);
    if (!destino.rows[0] || !origen.rows[0]) {
      await cliente.query('ROLLBACK');
      return res.status(404).json({ error: 'Temporada de origen o destino no encontrada' });
    }

    const { rows: equiposOrigen } = await cliente.query(
      'SELECT * FROM equipos WHERE temporada_id = $1 AND inactivo = FALSE',
      [temporadaOrigenId]
    );

    let equiposCreados = 0;
    let equiposYaExistian = 0;
    let personalAsignado = 0;
    let deportistasFichados = 0;

    for (const eq of equiposOrigen) {
      const existente = await cliente.query(
        'SELECT id FROM equipos WHERE temporada_id = $1 AND deporte_id = $2 AND nombre = $3',
        [temporadaDestinoId, eq.deporte_id, eq.nombre]
      );
      let nuevoEquipoId;
      if (existente.rows[0]) {
        nuevoEquipoId = existente.rows[0].id;
        equiposYaExistian += 1;
      } else {
        const creado = await cliente.query(
          `INSERT INTO equipos (temporada_id, deporte_id, nombre, categoria, club_nombre)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [temporadaDestinoId, eq.deporte_id, eq.nombre, eq.categoria, eq.club_nombre]
        );
        nuevoEquipoId = creado.rows[0].id;
        equiposCreados += 1;
      }

      const { rows: personal } = await cliente.query(
        'SELECT usuario_id, rol_en_equipo FROM equipo_personal WHERE equipo_id = $1',
        [eq.id]
      );
      for (const p of personal) {
        const resultado = await cliente.query(
          `INSERT INTO equipo_personal (equipo_id, usuario_id, rol_en_equipo)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [nuevoEquipoId, p.usuario_id, p.rol_en_equipo]
        );
        personalAsignado += resultado.rowCount;
      }

      const { rows: plantilla } = await cliente.query(
        `SELECT det.deportista_id, det.dorsal
         FROM deportista_equipo_temporada det
         JOIN deportistas d ON d.id = det.deportista_id
         WHERE det.equipo_id = $1 AND d.inactivo = FALSE`,
        [eq.id]
      );
      for (const j of plantilla) {
        const resultado = await cliente.query(
          `INSERT INTO deportista_equipo_temporada (deportista_id, equipo_id, temporada_id, dorsal)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (deportista_id, equipo_id, temporada_id) DO NOTHING`,
          [j.deportista_id, nuevoEquipoId, temporadaDestinoId, incluirDorsales ? j.dorsal : null]
        );
        deportistasFichados += resultado.rowCount;
      }
    }

    await cliente.query('COMMIT');
    res.json({ ok: true, equiposCreados, equiposYaExistian, personalAsignado, deportistasFichados });
  } catch (err) {
    await cliente.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al traspasar la temporada' });
  } finally {
    cliente.release();
  }
});

module.exports = router;
