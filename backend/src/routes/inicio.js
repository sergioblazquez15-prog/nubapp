// Dashboard de "Inicio": cumpleaños de la semana, lesionados, resultados
// recientes y faltas sin justificar (3 o más sesiones), todo filtrado
// según el rol — administrador/dirección deportiva ven todo el club;
// coordinador/entrenador/monitor solo lo suyo (sus equipos, vía
// equipo_personal, y los deportistas fichados en ellos).
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { autenticar } = require('../middleware/auth');
const { ACCESO_TOTAL_LECTURA, PERSONAL_TECNICO } = require('../middleware/permisos');

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

    // ---- equipos visibles (resultados, próximo partido y faltas):
    // administrador y dirección deportiva ven todos; el resto solo los
    // suyos (parámetro $2 en estas consultas, cuando aplica - todas
    // llevan como mucho temporada + usuario, así que $2 es seguro aquí).
    let resultadosRecientes = [];
    let proximoPartido = null;
    let faltasSinJustificar = [];

    if (temporada) {
      const filtroEqResultados = tieneAccesoTotal
        ? ''
        : `AND EXISTS (SELECT 1 FROM equipo_personal ep WHERE ep.equipo_id = e.id AND ep.usuario_id = $2)`;
      const { rows } = await pool.query(
        `SELECT p.id, p.fecha, p.rival, p.local_visitante, p.resultado_propio, p.resultado_rival,
                e.nombre AS equipo_nombre
         FROM partidos p
         JOIN equipos e ON e.id = p.equipo_id
         WHERE p.jugado = TRUE AND p.temporada_id = $1 ${filtroEqResultados}
         ORDER BY p.fecha DESC
         LIMIT 8`,
        tieneAccesoTotal ? [temporada.id] : [temporada.id, usuarioId]
      );
      resultadosRecientes = rows.map((f) => ({
        id: f.id,
        equipoNombre: f.equipo_nombre,
        fecha: f.fecha,
        rival: f.rival,
        localVisitante: f.local_visitante,
        resultadoPropio: f.resultado_propio,
        resultadoRival: f.resultado_rival,
      }));

      // Próximo partido (el que esté más cerca en el tiempo, aunque sea
      // del mes que viene - por eso es una consulta aparte de
      // "partidosDelMes", que solo mira el mes en curso para el
      // calendario visual). Mismo filtro de "mis equipos" que el resto.
      const { rows: proximoRows } = await pool.query(
        `SELECT p.id, p.fecha, p.hora, p.rival, p.local_visitante, e.nombre AS equipo_nombre
         FROM partidos p
         JOIN equipos e ON e.id = p.equipo_id
         WHERE p.jugado = FALSE AND p.temporada_id = $1 AND p.fecha >= CURRENT_DATE ${filtroEqResultados}
         ORDER BY p.fecha ASC, p.hora ASC NULLS LAST
         LIMIT 1`,
        tieneAccesoTotal ? [temporada.id] : [temporada.id, usuarioId]
      );
      if (proximoRows[0]) {
        const p = proximoRows[0];
        proximoPartido = {
          id: p.id,
          equipoNombre: p.equipo_nombre,
          fecha: p.fecha,
          hora: p.hora,
          rival: p.rival,
          localVisitante: p.local_visitante,
        };
      }

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

    // ---- contadores para las tarjetas de arriba (deportistas activos,
    // equipos) y sesiones del mes para el calendario visual ----
    let totalEquipos = 0;
    let sesionesDelMes = [];
    let sesionesEstaSemana = 0;
    let partidosDelMes = [];

    if (temporada) {
      // OJO: el marcador de posición de "ep.usuario_id" depende de cuántos
      // parámetros lleve ya cada consulta antes de él - $2 en la de
      // totalEquipos (solo temporada antes), pero $4 en las de sesiones y
      // partidos del mes (temporada + fecha desde + fecha hasta antes). Se
      // usan dos variantes para no reutilizar por error el mismo número en
      // consultas con distinto número de parámetros (eso causaba un error
      // "operator does not exist: uuid = date", ya que $2 apuntaba a la
      // fecha de inicio de mes en vez de al usuario).
      const filtroEqPropioSoloTemporada = tieneAccesoTotal
        ? ''
        : `AND EXISTS (SELECT 1 FROM equipo_personal ep WHERE ep.equipo_id = e.id AND ep.usuario_id = $2)`;
      const filtroEqPropioConFechas = tieneAccesoTotal
        ? ''
        : `AND EXISTS (SELECT 1 FROM equipo_personal ep WHERE ep.equipo_id = e.id AND ep.usuario_id = $4)`;

      const { rows: equiposRows } = await pool.query(
        `SELECT COUNT(*)::int AS total FROM equipos e
         WHERE e.temporada_id = $1 AND e.inactivo = FALSE ${filtroEqPropioSoloTemporada}`,
        tieneAccesoTotal ? [temporada.id] : [temporada.id, usuarioId]
      );
      totalEquipos = equiposRows[0]?.total || 0;

      const inicioMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
      const finMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0));
      const { rows: sesionesRows } = await pool.query(
        `SELECT s.fecha, s.titulo, e.nombre AS equipo_nombre
         FROM sesiones s
         JOIN equipos e ON e.id = s.equipo_id
         WHERE s.temporada_id = $1 AND s.cancelada = FALSE
           AND s.fecha BETWEEN $2 AND $3 ${filtroEqPropioConFechas}
         ORDER BY s.fecha`,
        tieneAccesoTotal
          ? [temporada.id, inicioMes.toISOString().slice(0, 10), finMes.toISOString().slice(0, 10)]
          : [temporada.id, inicioMes.toISOString().slice(0, 10), finMes.toISOString().slice(0, 10), usuarioId]
      );
      sesionesDelMes = sesionesRows.map((s) => ({
        fecha: s.fecha,
        titulo: s.titulo,
        equipoNombre: s.equipo_nombre,
      }));
      sesionesEstaSemana = sesionesDelMes.filter((s) => {
        const f = new Date(s.fecha);
        return f >= hoy && f <= enUnaSemana;
      }).length;

      // Partidos del mes (incluye los importados del calendario de
      // competición, con su escudo del rival si lo trajo la importación),
      // para que también se vean en el calendario visual de Inicio.
      const { rows: partidosRows } = await pool.query(
        `SELECT p.fecha, p.rival, p.local_visitante, p.escudo_rival, p.jugado,
                p.resultado_propio, p.resultado_rival, e.nombre AS equipo_nombre
         FROM partidos p
         JOIN equipos e ON e.id = p.equipo_id
         WHERE p.temporada_id = $1
           AND p.fecha BETWEEN $2 AND $3 ${filtroEqPropioConFechas}
         ORDER BY p.fecha`,
        tieneAccesoTotal
          ? [temporada.id, inicioMes.toISOString().slice(0, 10), finMes.toISOString().slice(0, 10)]
          : [temporada.id, inicioMes.toISOString().slice(0, 10), finMes.toISOString().slice(0, 10), usuarioId]
      );
      partidosDelMes = partidosRows.map((p) => ({
        fecha: p.fecha,
        rival: p.rival,
        localVisitante: p.local_visitante,
        escudoRival: p.escudo_rival,
        jugado: p.jugado,
        resultadoPropio: p.resultado_propio,
        resultadoRival: p.resultado_rival,
        equipoNombre: p.equipo_nombre,
      }));
    }

    // ---- rotación de ejercicios: solo para quien tiene acceso al banco
    // (el monitor no entra al banco de ejercicios, así que no se le manda) ----
    let rotacionEjercicios = [];
    if (roles.some((r) => PERSONAL_TECNICO.includes(r))) {
      const { rows } = await pool.query(
        `SELECT e.id, e.titulo, e.tipologia, e.naturaleza, dep.nombre AS deporte_nombre
         FROM ejercicios e
         JOIN deportes dep ON dep.id = e.deporte_id
         ORDER BY random() LIMIT 4`
      );
      rotacionEjercicios = rows.map((e) => ({
        id: e.id,
        titulo: e.titulo,
        tipologia: e.tipologia,
        naturaleza: e.naturaleza,
        deporteNombre: e.deporte_nombre,
      }));
    }

    res.json({
      temporada: temporada ? { id: temporada.id, nombre: temporada.nombre } : null,
      totalDeportistasActivos: deportistas.length,
      totalEquipos,
      sesionesEstaSemana,
      sesionesDelMes,
      partidosDelMes,
      cumpleanosSemana,
      lesionados,
      resultadosRecientes,
      proximoPartido,
      faltasSinJustificar,
      rotacionEjercicios,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular el resumen de inicio' });
  }
});

module.exports = router;
