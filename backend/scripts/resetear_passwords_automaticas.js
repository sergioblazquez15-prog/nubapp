// Script de un solo uso: pone la contraseña 1234 (y marca
// debe_cambiar_contrasena = TRUE) a las cuentas de deportista/familia que
// YA existían antes del cambio a contraseña inicial fija, para que a
// partir de ahora todo el mundo (las de siempre y las nuevas) entren la
// primera vez con el mismo "1234" y la app les obligue a cambiarla.
//
// Solo toca cuentas con el rol "deportista" y que tengan contraseña (si
// alguna familia ya había cambiado la suya, SE SOBRESCRIBE también a
// propósito, para poder comunicar "tu contraseña es 1234" de forma
// uniforme a todo el club, tal y como se pidió). No toca las cuentas de
// personal del club (administrador, dirección deportiva, entrenador...).
//
// CÓMO EJECUTARLO (una sola vez, después de desplegar este cambio):
//   docker-compose exec backend node scripts/resetear_passwords_automaticas.js --confirmar
//
// Sin "--confirmar" solo hace una simulación: cuenta y lista a quién
// afectaría, pero no cambia nada en la base de datos.
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../src/config/db');

const PASSWORD_INICIAL_AUTOMATICA = '1234';
const RONDAS_BCRYPT = 10;
const CONFIRMAR = process.argv.includes('--confirmar');

async function main() {
  const { rows: afectados } = await pool.query(`
    SELECT u.id, u.email, u.nombre_completo
    FROM usuarios u
    JOIN usuario_roles ur ON ur.usuario_id = u.id
    JOIN roles r ON r.id = ur.rol_id
    WHERE r.nombre = 'deportista' AND u.password_hash IS NOT NULL
    ORDER BY u.nombre_completo
  `);

  console.log(`Cuentas de deportista/familia encontradas: ${afectados.length}`);
  for (const u of afectados) {
    console.log(`  - ${u.nombre_completo} <${u.email}>`);
  }

  if (!CONFIRMAR) {
    console.log('\nEsto era solo una simulación (no se ha cambiado nada).');
    console.log('Vuelve a ejecutar con --confirmar para aplicar el cambio de verdad.');
    await pool.end();
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD_INICIAL_AUTOMATICA, RONDAS_BCRYPT);
  const { rowCount } = await pool.query(
    `UPDATE usuarios u
     SET password_hash = $1, debe_cambiar_contrasena = TRUE
     FROM usuario_roles ur
     JOIN roles r ON r.id = ur.rol_id
     WHERE ur.usuario_id = u.id
       AND r.nombre = 'deportista'
       AND u.password_hash IS NOT NULL`,
    [passwordHash]
  );

  console.log(`\nListo: ${rowCount} cuentas puestas a la contraseña inicial "1234" (pendientes de cambiarla en su próximo acceso).`);
  await pool.end();
}

main().catch((err) => {
  console.error('Error al ejecutar el script:', err);
  process.exit(1);
});
