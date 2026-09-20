// Ejecuta todos los archivos .sql de database/ en orden numérico contra la
// base de datos configurada en .env. Pensado para arrancar en Docker: se
// ejecuta en cada arranque del contenedor.
//
// Lleva un registro de qué archivos ya se aplicaron (tabla
// _migraciones_aplicadas) para no re-ejecutar los esquemas base (que no son
// idempotentes: usan CREATE TABLE sin IF NOT EXISTS) en cada reinicio. Los
// seeds nuevos sí están escritos de forma idempotente (WHERE NOT EXISTS /
// ON CONFLICT), así que son seguros de re-intentar aunque ya se hayan
// aplicado antes.
//
// IMPORTANTE: un fallo en un archivo (por ejemplo porque su tabla ya
// existía de una versión anterior de este mismo script, antes de que
// hubiera registro) NUNCA debe impedir que arranque el servidor — por eso
// se continúa con el resto de archivos y no se marca el proceso como
// fallido. Los errores quedan igualmente en el log para poder revisarlos.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

// Códigos de Postgres para "esto ya existe" (bootstrap de versiones
// anteriores a este registro, o SQL que no usó IF NOT EXISTS)
const CODIGOS_YA_EXISTE = new Set(['42P07', '42710', '23505']);

async function main() {
  const carpeta = path.join(__dirname, '..', '..', 'database');
  const archivos = fs.readdirSync(carpeta)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migraciones_aplicadas (
      nombre_archivo  VARCHAR(255) PRIMARY KEY,
      aplicada_en     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const { rows } = await pool.query('SELECT nombre_archivo FROM _migraciones_aplicadas');
  const yaAplicadas = new Set(rows.map((r) => r.nombre_archivo));

  for (const archivo of archivos) {
    if (yaAplicadas.has(archivo)) {
      console.log(`Omitiendo ${archivo} (ya aplicada anteriormente)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(carpeta, archivo), 'utf8');
    process.stdout.write(`Aplicando ${archivo}... `);
    try {
      await pool.query(sql);
      console.log('ok');
      await pool.query(
        'INSERT INTO _migraciones_aplicadas (nombre_archivo) VALUES ($1) ON CONFLICT DO NOTHING',
        [archivo],
      );
    } catch (err) {
      if (CODIGOS_YA_EXISTE.has(err.code)) {
        console.log('ya existía en la base de datos, se omite a partir de ahora');
        await pool.query(
          'INSERT INTO _migraciones_aplicadas (nombre_archivo) VALUES ($1) ON CONFLICT DO NOTHING',
          [archivo],
        );
      } else {
        console.log('ERROR (no se detiene el arranque, revisar este archivo)');
        console.error(err.message);
      }
    }
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Fallo inesperado ejecutando migraciones:', err);
  // Nunca bloqueamos el arranque del servidor por esto.
  process.exit(0);
});
