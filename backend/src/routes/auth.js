// Login de la aplicación. No hay registro público: los usuarios los da de
// alta un administrador desde Gestión de NUBAPP (ver routes/usuarios.js).
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const JWT_EXPIRACION = '12h';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.password_hash, u.nombre_completo, u.inactivo,
              COALESCE(array_agg(r.nombre) FILTER (WHERE r.nombre IS NOT NULL), '{}') AS roles
       FROM usuarios u
       LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
       LEFT JOIN roles r ON r.id = ur.rol_id
       WHERE u.email = $1
       GROUP BY u.id`,
      [email.toLowerCase().trim()]
    );

    const usuario = rows[0];

    // Mismo mensaje tanto si el email no existe como si la contraseña es
    // incorrecta, para no dar pistas a quien intenta entrar.
    if (!usuario || !usuario.password_hash) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    if (usuario.inactivo) {
      return res.status(401).json({ error: 'Usuario inactivo, contacta con el club' });
    }

    const passwordCorrecta = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordCorrecta) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign({ usuarioId: usuario.id }, process.env.JWT_SECRET, {
      expiresIn: JWT_EXPIRACION,
    });

    pool.query('UPDATE usuarios SET ultimo_acceso = now() WHERE id = $1', [usuario.id])
      .catch(err => console.error('No se pudo actualizar ultimo_acceso:', err));

    res.json({
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombreCompleto: usuario.nombre_completo,
        roles: usuario.roles,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// GET /api/auth/yo - devuelve el usuario autenticado (útil para el frontend
// al arrancar la sesión con un token guardado)
router.get('/yo', require('../middleware/auth').autenticar, (req, res) => {
  res.json({
    id: req.usuario.id,
    email: req.usuario.email,
    nombreCompleto: req.usuario.nombre_completo,
    roles: req.usuario.roles,
  });
});

module.exports = router;
