// Catálogo de deportes (fútbol, baloncesto, muay thai, patinaje, pádel,
// tenis, gimnasia rítmica...). Cualquier usuario logueado puede consultarlo
// (hace falta para pintar los checkboxes de "deporte que practica" en la
// ficha del deportista); solo gestión deportiva puede dar de alta uno nuevo.
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { autenticar } = require('../middleware/auth');
const { requiereRol, GESTION_DEPORTIVA } = require('../middleware/permisos');

// ?estado=todos devuelve también los dados de baja (para la pantalla de
// gestión, donde hace falta poder reactivarlos); sin ese parámetro se
// comporta como siempre (solo los activos, para los selectores normales).
router.get('/', autenticar, async (req, res) => {
  try {
    const { rows } = await pool.query(
      req.query.estado === 'todos'
        ? 'SELECT id, nombre, tipo, activo FROM deportes ORDER BY nombre'
        : 'SELECT id, nombre, tipo, activo FROM deportes WHERE activo = TRUE ORDER BY nombre'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar los deportes' });
  }
});

// POST /api/deportes - alta de un deporte nuevo (ej. si el club añade una
// disciplina). tipo: 'equipo' (necesita equipos/plantilla) o 'individual'
// (solo necesita control de asistencia).
router.post('/', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  const { nombre, tipo } = req.body;

  if (!nombre || !['equipo', 'individual'].includes(tipo)) {
    return res.status(400).json({ error: 'Nombre y tipo ("equipo" o "individual") son obligatorios' });
  }

  try {
    const { rows } = await pool.query(
      'INSERT INTO deportes (nombre, tipo) VALUES ($1, $2) RETURNING id',
      [nombre, tipo]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un deporte con ese nombre' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear el deporte' });
  }
});

// PUT /api/deportes/:id - corrige el nombre de un deporte ya creado (p.ej.
// un typo). El "tipo" (equipo/individual) NO se puede cambiar aquí a
// propósito: una vez hay equipos o sesiones colgando de un deporte,
// cambiarle el tipo rompería esa lógica (equipos de un deporte vs control
// de asistencia individual) - si hace falta, se da de baja (activo=false)
// y se crea uno nuevo con el tipo correcto.
router.put('/:id', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  const { nombre, activo } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE deportes SET
         nombre = COALESCE($1, nombre),
         activo = COALESCE($2, activo)
       WHERE id = $3 RETURNING id`,
      [nombre || null, typeof activo === 'boolean' ? activo : null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Deporte no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un deporte con ese nombre' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el deporte' });
  }
});

// DELETE /api/deportes/:id - baja lógica (no se borra: lo usan equipos,
// deportistas, sesiones... ya existentes). Deja de verse en los
// selectores para dar de alta cosas nuevas.
router.delete('/:id', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  try {
    const { rows } = await pool.query('UPDATE deportes SET activo = FALSE WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Deporte no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al dar de baja el deporte' });
  }
});

module.exports = router;
