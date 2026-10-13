// Enlace público de alta por equipo (SIN login): el club comparte la URL
// /alta/<token> de un equipo (ver equipos.token_alta y el botón
// "Enlace de alta" en la ficha del equipo) con futuras familias. Quien
// la abre ve el nombre del equipo/deporte y manda una solicitud con sus
// datos básicos; un administrador la revisa después (ver routes/
// solicitudes.js) y, si procede, crea la ficha real y lo ficha al
// equipo. No requiere token "nuevo" por solicitud: el del equipo es
// fijo (no es secreto de un solo uso, solo evita adivinar/enumerar
// equipos por id).
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/alta-publica/:token - datos públicos mínimos del equipo para
// pintar el formulario (nada sensible: solo nombre/deporte/categoría).
router.get('/:token', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.nombre, e.categoria, dep.nombre AS deporte_nombre
       FROM equipos e
       JOIN deportes dep ON dep.id = e.deporte_id
       WHERE e.token_alta = $1 AND e.inactivo = FALSE`,
      [req.params.token]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Enlace no válido o equipo dado de baja' });
    res.json({
      equipoId: rows[0].id,
      nombre: rows[0].nombre,
      categoria: rows[0].categoria,
      deporteNombre: rows[0].deporte_nombre,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar el enlace' });
  }
});

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/alta-publica/:token - { nombre, apellidos, email, telefono }
// Guarda una solicitud PENDIENTE; no crea ninguna ficha ni cuenta
// todavía (eso lo hace un administrador al aprobarla). El email es
// obligatorio: al aprobar la solicitud se usa como acceso a "Mi app"
// del nuevo deportista, y si no lo da la familia, el club tendría que
// inventarle uno que esa persona no conocería para entrar.
router.post('/:token', async (req, res) => {
  const { nombre, apellidos, email, telefono } = req.body;
  if (!nombre?.trim() || !apellidos?.trim()) {
    return res.status(400).json({ error: 'Nombre y apellidos son obligatorios' });
  }
  const emailLimpio = email?.trim() || '';
  if (!emailLimpio) {
    return res.status(400).json({ error: 'El email es obligatorio: se usará para el acceso a "Mi app"' });
  }
  if (!EMAIL_VALIDO.test(emailLimpio)) {
    return res.status(400).json({ error: 'El email no parece válido' });
  }
  try {
    const { rows: equipo } = await pool.query(
      'SELECT id FROM equipos WHERE token_alta = $1 AND inactivo = FALSE',
      [req.params.token]
    );
    if (!equipo[0]) return res.status(404).json({ error: 'Enlace no válido o equipo dado de baja' });

    await pool.query(
      `INSERT INTO solicitudes_alta (equipo_id, nombre, apellidos, email, telefono)
       VALUES ($1, $2, $3, $4, $5)`,
      [equipo[0].id, nombre.trim(), apellidos.trim(), emailLimpio, telefono?.trim() || null]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar la solicitud' });
  }
});

module.exports = router;
