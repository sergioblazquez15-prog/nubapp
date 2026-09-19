// Ejecuta todos los archivos .sql de database/ en orden numérico contra la
// base de datos configurada en .env. Pensado para arrancar en Docker: se
// puede ejecutar en cada arranque del contenedor sin problema porque todas
// las migraciones son idempotentes (IF NOT EXISTS / ON CONFLICT DO NOTHING).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

async function main() {
  const carpeta = path.join(__dirname, '..', '..', 'database');
  const archivos = fs.readdirSync(carpeta)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const archivo of archivos) {
    const sql = fs.readFileSync(path.join(carpeta, archivo), 'utf8');
    process.stdout.write(`Aplicando ${archivo}... `);
    try {
      await pool.query(sql);
      console.log('ok');
    } catch (err) {
      console.log('ERROR');
      console.error(err.message);
      process.exitCode = 1;
      break;
    }
  }
  await pool.end();
}

main();
