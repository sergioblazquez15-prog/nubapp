// Catálogo de deportes (fútbol, baloncesto, muay thai, patinaje, pádel,
// tenis, gimnasia rítmica...). Cualquier usuario logueado puede consultarlo
// (hace falta para pintar los checkboxes de "deporte que practica" en la
// ficha del deportista); solo gestión deportiva puede dar de alta uno nuevo.
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { autenticar } = require('../middleware/auth');
const { requiereRol, GESTION_DEPORTIVA } = require('../middleware/permisos');

router.get('/', autenticar, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nombre, tipo, activo FROM deportes WHERE activo = TRUE ORDER BY nombre'
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

module.exports = router;
