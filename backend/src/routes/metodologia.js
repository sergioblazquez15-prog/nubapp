// Metodología: documentos de texto libre (principios de juego, objetivos
// por categoría, sistema de entrenamiento...) por deporte, o generales
// para todo el club si no se indica deporte. Primera versión sin
// capturas de referencia de MísterCoach — se afinará más adelante.
// Mismo criterio que el banco de ejercicios: cualquier rol técnico
// consulta, solo dirección deportiva/administrador/coordinador escribe.
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { autenticar } = require('../middleware/auth');
const { requiereRol, GESTION_DEPORTIVA, PERSONAL_TECNICO } = require('../middleware/permisos');

function filaADocumento(fila) {
  return {
    id: fila.id,
    deporteId: fila.deporte_id,
    deporteNombre: fila.deporte_nombre,
    titulo: fila.titulo,
    contenido: fila.contenido,
    orden: fila.orden,
    actualizadoEn: fila.actualizado_en,
  };
}

// GET /api/metodologia?deporteId= - documentos de ese deporte + los
// generales del club (deporte_id NULL). Sin deporteId, solo los generales.
router.get('/', autenticar, requiereRol(...PERSONAL_TECNICO), async (req, res) => {
  const { deporteId } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT m.*, dep.nombre AS deporte_nombre
       FROM metodologia_documentos m
       LEFT JOIN deportes dep ON dep.id = m.deporte_id
       WHERE m.deporte_id IS NULL ${deporteId ? 'OR m.deporte_id = $1' : ''}
       ORDER BY (m.deporte_id IS NULL) DESC, m.orden, m.titulo`,
      deporteId ? [deporteId] : []
    );
    res.json(rows.map(filaADocumento));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar la metodología' });
  }
});

// GET /api/metodologia/:id
router.get('/:id', autenticar, requiereRol(...PERSONAL_TECNICO), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.*, dep.nombre AS deporte_nombre FROM metodologia_documentos m
       LEFT JOIN deportes dep ON dep.id = m.deporte_id WHERE m.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json(filaADocumento(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar el documento' });
  }
});

// POST /api/metodologia - crear documento (deporteId opcional: sin él es
// un documento general del club).
router.post('/', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  const { deporteId, titulo, contenido, orden } = req.body;
  if (!titulo) return res.status(400).json({ error: 'titulo es obligatorio' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO metodologia_documentos (deporte_id, titulo, contenido, orden, creado_por)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [deporteId || null, titulo, contenido || '', orden || 0, req.usuario.id]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el documento' });
  }
});

// PUT /api/metodologia/:id - editar título/contenido/orden.
router.put('/:id', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  const { titulo, contenido, orden } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE metodologia_documentos SET
         titulo = COALESCE($1, titulo),
         contenido = COALESCE($2, contenido),
         orden = COALESCE($3, orden),
         actualizado_en = now()
       WHERE id = $4 RETURNING id`,
      [titulo, contenido, orden, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el documento' });
  }
});

// DELETE /api/metodologia/:id
router.delete('/:id', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM metodologia_documentos WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el documento' });
  }
});

module.exports = router;
