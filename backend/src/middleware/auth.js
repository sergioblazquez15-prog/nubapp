// Verifica el token JWT enviado por el frontend y carga el usuario
// (con sus roles) en req.usuario para que las rutas y el middleware
// de permisos puedan usarlo.
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

async function autenticar(req, res, next) {
  const cabecera = req.headers.authorization;
  if (!cabecera || !cabecera.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const token = cabecera.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await pool.query(
      `SELECT u.id, u.nombre_completo, u.email, u.inactivo,
              array_agg(r.nombre) AS roles
       FROM usuarios u
       JOIN usuario_roles ur ON ur.usuario_id = u.id
       JOIN roles r ON r.id = ur.rol_id
       WHERE u.id = $1
       GROUP BY u.id`,
      [payload.usuarioId]
    );

    const usuario = rows[0];
    if (!usuario || usuario.inactivo) {
      return res.status(401).json({ error: 'Usuario no válido' });
    }

    req.usuario = usuario;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o caducado' });
  }
}

module.exports = { autenticar };
