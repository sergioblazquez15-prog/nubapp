// Crea el primer usuario administrador desde la terminal. Hace falta
// porque para crear usuarios desde la app (routes/usuarios.js) ya hace
// falta estar logueado como administrador — alguien tiene que ser el primero.
//
// Uso:
//   node scripts/crear_admin.js "Nombre Apellidos" email@club.com contraseñaSegura
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../src/config/db');

async function main() {
  const [nombreCompleto, email, password] = process.argv.slice(2);

  if (!nombreCompleto || !email || !password) {
    console.error('Uso: node scripts/crear_admin.js "Nombre Apellidos" email@club.com contraseña');
    process.exitCode = 1;
    return;
  }

  if (password.length < 8) {
    console.error('La contraseña debe tener al menos 8 caracteres');
    process.exitCode = 1;
    return;
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    const passwordHash = await bcrypt.hash(password, 10);

    const { rows } = await cliente.query(
      `INSERT INTO usuarios (email, password_hash, nombre_completo)
       VALUES ($1, $2, $3) RETURNING id`,
      [email.toLowerCase().trim(), passwordHash, nombreCompleto]
    );
    const usuarioId = rows[0].id;

    const { rows: rolAdmin } = await cliente.query(
      `SELECT id FROM roles WHERE nombre = 'administrador'`
    );
    if (!rolAdmin[0]) {
      throw new Error('No existe el rol "administrador" — ¿has ejecutado 01_schema_nucleo.sql?');
    }

    await cliente.query(
      'INSERT INTO usuario_roles (usuario_id, rol_id) VALUES ($1, $2)',
      [usuarioId, rolAdmin[0].id]
    );

    await cliente.query('COMMIT');
    console.log(`Administrador creado correctamente (id ${usuarioId})`);
  } catch (err) {
    await cliente.query('ROLLBACK');
    console.error('Error al crear el administrador:', err.message);
    process.exitCode = 1;
  } finally {
    cliente.release();
    await pool.end();
  }
}

main();
