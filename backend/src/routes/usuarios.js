// Gestión de usuarios (parte de "Gestión de NUBAPP", solo administradores).
// Aquí se dan de alta TODOS los usuarios con login (personal del club y
// deportistas que tengan acceso propio) y se les asignan sus roles.
//
// Los deportistas sin login propio (los que solo tienen ficha, sin acceder
// a la app) se crean desde el módulo de Gestión deportiva, no desde aquí.
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { autenticar } = require('../middleware/auth');
const { requiereRol, ACCESO_TOTAL_LECTURA } = require('../middleware/permisos');

const RONDAS_BCRYPT = 10;

function filaAUsuario(fila) {
  return {
    id: fila.id,
    email: fila.email,
    nombreCompleto: fila.nombre_completo,
    telefono: fila.telefono,
    inactivo: fila.inactivo,
    ultimoAcceso: fila.ultimo_acceso,
    creadoEn: fila.creado_en,
    roles: fila.roles,
  };
}

const CONSULTA_BASE = `
  SELECT u.id, u.email, u.nombre_completo, u.telefono, u.inactivo,
         u.ultimo_acceso, u.creado_en,
         COALESCE(array_agg(r.nombre) FILTER (WHERE r.nombre IS NOT NULL), '{}') AS roles
  FROM usuarios u
  LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
  LEFT JOIN roles r ON r.id = ur.rol_id
`;

// GET /api/usuarios - listado completo (administrador y dirección deportiva)
router.get('/', autenticar, requiereRol(...ACCESO_TOTAL_LECTURA), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `${CONSULTA_BASE} GROUP BY u.id ORDER BY u.nombre_completo`
    );
    res.json(rows.map(filaAUsuario));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
});

// GET /api/usuarios/:id
router.get('/:id', autenticar, requiereRol(...ACCESO_TOTAL_LECTURA), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `${CONSULTA_BASE} WHERE u.id = $1 GROUP BY u.id`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(filaAUsuario(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar el usuario' });
  }
});

// POST /api/usuarios - crear usuario nuevo con sus roles (solo administrador)
router.post('/', autenticar, requiereRol('administrador'), async (req, res) => {
  const { email, password, nombreCompleto, telefono, roles } = req.body;

  if (!nombreCompleto || !Array.isArray(roles) || roles.length === 0) {
    return res.status(400).json({ error: 'Nombre completo y al menos un rol son obligatorios' });
  }

  // Un usuario puede no tener login propio (ej. deportista sin acceso a la
  // app todavía), en cuyo caso no lleva email ni contraseña.
  const tieneLogin = Boolean(email);
  if (tieneLogin && (!password || password.length < 8)) {
    return res.status(400).json({ error: 'Si el usuario tiene email, la contraseña debe tener al menos 8 caracteres' });
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    const passwordHash = tieneLogin ? await bcrypt.hash(password, RONDAS_BCRYPT) : null;

    const { rows } = await cliente.query(
      `INSERT INTO usuarios (email, password_hash, nombre_completo, telefono)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [tieneLogin ? email.toLowerCase().trim() : null, passwordHash, nombreCompleto, telefono || null]
    );
    const usuarioId = rows[0].id;

    const { rows: filasRoles } = await cliente.query(
      'SELECT id FROM roles WHERE nombre = ANY($1::text[])',
      [roles]
    );
    if (filasRoles.length !== roles.length) {
      throw Object.assign(new Error('Alguno de los roles indicados no existe'), { status: 400 });
    }

    for (const rol of filasRoles) {
      await cliente.query(
        'INSERT INTO usuario_roles (usuario_id, rol_id) VALUES ($1, $2)',
        [usuarioId, rol.id]
      );
    }

    await cliente.query('COMMIT');
    res.status(201).json({ id: usuarioId });
  } catch (err) {
    await cliente.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Error al crear el usuario' });
  } finally {
    cliente.release();
  }
});

// PUT /api/usuarios/:id - editar datos básicos (solo administrador)
router.put('/:id', autenticar, requiereRol('administrador'), async (req, res) => {
  const { nombreCompleto, telefono, email, inactivo } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE usuarios
       SET nombre_completo = COALESCE($1, nombre_completo),
           telefono        = COALESCE($2, telefono),
           email           = COALESCE($3, email),
           inactivo        = COALESCE($4, inactivo)
       WHERE id = $5
       RETURNING id`,
      [
        nombreCompleto ?? null,
        telefono ?? null,
        email ? email.toLowerCase().trim() : null,
        typeof inactivo === 'boolean' ? inactivo : null,
        req.params.id,
      ]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el usuario' });
  }
});

// PUT /api/usuarios/:id/password - cambiar contraseña.
// La puede cambiar un administrador (a cualquiera) o el propio usuario (la suya).
router.put('/:id/password', autenticar, async (req, res) => {
  const esUnoMismo = req.usuario.id === req.params.id;
  const esAdmin = req.usuario.roles.includes('administrador');
  if (!esUnoMismo && !esAdmin) {
    return res.status(403).json({ error: 'No tienes permiso para esto' });
  }

  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, RONDAS_BCRYPT);
    const { rows } = await pool.query(
      'UPDATE usuarios SET password_hash = $1 WHERE id = $2 RETURNING id',
      [passwordHash, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cambiar la contraseña' });
  }
});

// PUT /api/usuarios/:id/roles - reemplaza el conjunto de roles de un usuario
// (solo administrador; así se añaden nuevos administradores)
router.put('/:id/roles', autenticar, requiereRol('administrador'), async (req, res) => {
  const { roles } = req.body;
  if (!Array.isArray(roles) || roles.length === 0) {
    return res.status(400).json({ error: 'Debes indicar al menos un rol' });
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    const { rows: filasRoles } = await cliente.query(
      'SELECT id FROM roles WHERE nombre = ANY($1::text[])',
      [roles]
    );
    if (filasRoles.length !== roles.length) {
      throw Object.assign(new Error('Alguno de los roles indicados no existe'), { status: 400 });
    }

    await cliente.query('DELETE FROM usuario_roles WHERE usuario_id = $1', [req.params.id]);
    for (const rol of filasRoles) {
      await cliente.query(
        'INSERT INTO usuario_roles (usuario_id, rol_id) VALUES ($1, $2)',
        [req.params.id, rol.id]
      );
    }

    await cliente.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await cliente.query('ROLLBACK');
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Error al actualizar los roles' });
  } finally {
    cliente.release();
  }
});

// DELETE /api/usuarios/:id - baja lógica (nunca se borra físicamente a
// nadie, para no perder el histórico de asistencia/cuotas/etc.)
router.delete('/:id', autenticar, requiereRol('administrador'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE usuarios SET inactivo = TRUE WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al dar de baja al usuario' });
  }
});

module.exports = router;
