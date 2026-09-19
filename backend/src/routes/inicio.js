// Dashboard de "Inicio": cumpleaños de la semana, lesionados, resultados
// recientes y faltas sin justificar (3 o más sesiones), todo filtrado
// según el rol — administrador/dirección deportiva ven todo el club;
// coordinador/entrenador/monitor solo lo suyo (sus equipos, vía
// equipo_personal, y los deportistas fichados en ellos).
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { autenticar } = require('../middleware/auth');
const { ACCESO_TOTAL_LECTURA } = require('../middleware/permisos');

function proximaFecha(fechaNacimiento, hoy) {
  const fn = new Date(fechaNacimiento);
  const candidata = new Date(Date.UTC(hoy.getUTCFullYear(), fn.getUTCMonth(), fn.getUTCDate()));
  if (candidata < hoy) candidata.setUTCFullYear(hoy.getUTCFullYear() + 1);
  return candidata;
}

router.get('/resumen', autenticar, async (req, res) => {
  const { roles, id: usuarioId } = req.usuario;
  const tieneAccesoTotal = roles.some((r) => ACCESO_TOTAL_LECTURA.includes(r));

  try {
    const { rows: temporadaRows } = await pool.query(
      'SELECT id, nombre FROM temporadas WHERE es_principal = TRUE ORDER BY fecha_inicio DESC LIMIT 1'
    );
    const temporada = temporadaRows[0] || null;

    // ---- deportistas visibles (cumpleaños y lesionados) ----
    const paramsDep = [];
    const filtroDep = tieneAccesoTotal ? '' : `AND EXISTS (
      SELECT 1 FROM deportista_equipo_temporada det
      JOIN equipo_personal ep ON ep.equipo_id = det.equipo_id
      WHERE det.deportista_id = d.id AND ep.usuario_id = $${paramsDep.push(usuarioId)}
    )`;
    const { rows: deportistas } = await pool.query(
      `SELECT d.id, d.nombre, d.apellidos, d.fecha_nacimiento, d.lesionado, d.lesion_detalle
       FROM deportistas d
       WHERE d.inactivo = FALSE ${filtroDep}`,
      paramsDep
    );

    const hoy = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    const enUnaSemana = new Date(hoy);
    enUnaSemana.setUTCDate(hoy.getUTCDate() + 7);

    const cumpleanosSemana = deportistas
      .filter((d) => d.fecha_nacimiento)
      .map((d) => ({ ...d, proximo: proximaFecha(d.fecha_nacimiento, hoy) }))
      .filter((d) => d.proximo >= hoy && d.proximo <= enUnaSemana)
      .sort((a, b) => a.proximo - b.proximo)
      .map((d) => ({
        deportistaId: d.id,
        nombre: d.nombre,
        apellidos: d.apellidos,
        fecha: d.proximo.toISOString().slice(0, 10),
      }));

    const lesionados = deportistas
      .filter((d) => d.lesionado)
      .map((d) => ({ deportistaId: d.id, nombre: d.nombre, apellidos: d.apellidos, detalle: d.lesion_detalle }));

    // ---- equipos visibles (resultados y faltas): administrador y
    // dirección deportiva ven todos; el resto solo los suyos (parámetro
    // $2 en ambas consultas de abajo, cuando aplica).
    let resultadosRecientes = [];
    let faltasSinJustificar = [];

    if (temporada) {
      const filtroEqResultados = tieneAccesoTotal
        ? ''
        : `AND EXISTS (SELECT 1 FROM equipo_personal ep WHERE ep.equipo_id = e.id AND ep.usuario_id = $2)`;
      const { rows } = await pool.query(
        `SELECT p.fecha, p.rival, p.local_visitante, p.resultado_propio, p.resultado_rival,
                e.nombre AS equipo_nombre
         FROM partidos p
         JOIN equipos e ON e.id = p.equipo_id
         WHERE p.jugado = TRUE AND p.temporada_id = $1 ${filtroEqResultados}
         ORDER BY p.fecha DESC
         LIMIT 8`,
        tieneAccesoTotal ? [temporada.id] : [temporada.id, usuarioId]
      );
      resultadosRecientes = rows.map((f) => ({
        equipoNombre: f.equipo_nombre,
        fecha: f.fecha,
        rival: f.rival,
        localVisitante: f.local_visitante,
        resultadoPropio: f.resultado_propio,
        resultadoRival: f.resultado_rival,
      }));

      const filtroEqFaltas = tieneAccesoTotal
        ? ''
        : `AND EXISTS (SELECT 1 FROM equipo_personal ep WHERE ep.equipo_id = e.id AND ep.usuario_id = $2)`;
      const { rows: faltas } = await pool.query(
        `SELECT d.id AS deportista_id, d.nombre, d.apellidos, e.nombre AS equipo_nombre,
                COUNT(a.id) FILTER (WHERE a.asistio = FALSE AND a.justificada = FALSE) AS faltas
         FROM deportista_equipo_temporada det
         JOIN equipos e ON e.id = det.equipo_id
         JOIN deportistas d ON d.id = det.deportista_id
         JOIN sesiones s ON s.equipo_id = det.equipo_id AND s.temporada_id = det.temporada_id AND s.cancelada = FALSE
         LEFT JOIN asistencia a ON a.sesion_id = s.id AND a.deportista_id = d.id
         WHERE det.temporada_id = $1 AND d.inactivo = FALSE ${filtroEqFaltas}
         GROUP BY d.id, d.nombre, d.apellidos, e.nombre
         HAVING COUNT(a.id) FILTER (WHERE a.asistio = FALSE AND a.justificada = FALSE) >= 3
         ORDER BY faltas DESC`,
        tieneAccesoTotal ? [temporada.id] : [temporada.id, usuarioId]
      );
      faltasSinJustificar = faltas.map((f) => ({
        deportistaId: f.deportista_id,
        nombre: f.nombre,
        apellidos: f.apellidos,
        equipoNombre: f.equipo_nombre,
        faltas: Number(f.faltas),
      }));
    }

    res.json({
      temporada: temporada ? { id: temporada.id, nombre: temporada.nombre } : null,
      cumpleanosSemana,
      lesionados,
      resultadosRecientes,
      faltasSinJustificar,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular el resumen de inicio' });
  }
});

module.exports = router;
