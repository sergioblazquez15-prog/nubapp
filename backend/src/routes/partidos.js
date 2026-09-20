// Estadísticas de equipo: partidos y resultados (deportes de equipo:
// fútbol, baloncesto...). Mismo criterio de visibilidad que en
// equipos.js: administrador/dirección deportiva ven y gestionan todos los
// partidos; coordinador también gestiona; entrenador/monitor solo ven y
// editan los partidos de SU equipo (los que tiene asignados en
// equipo_personal).
//
// Directo (v2, a partir de las capturas de referencia que pasó Sergio):
// además del feed de eventos, ahora hay una convocatoria/alineación por
// partido (para poder atribuir cada acción a un jugador), un cronómetro
// real con partes de duración configurable por el entrenador, más tipos
// de acción (tiros con "ocasión clara", posesión, faltas y córners a
// favor/en contra) y un resumen agregado (para el descanso o cuando se
// quiera). El minuto de cada evento se calcula en el servidor a partir
// del cronómetro — el entrenador no lo escribe a mano, solo pulsa el
// botón de la acción en el momento en que ocurre.
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { autenticar } = require('../middleware/auth');
const { requiereRol, ACCESO_TOTAL_LECTURA, GESTION_DEPORTIVA } = require('../middleware/permisos');

function filaAPartido(fila) {
  return {
    id: fila.id,
    equipoId: fila.equipo_id,
    temporadaId: fila.temporada_id,
    fecha: fila.fecha,
    hora: fila.hora,
    rival: fila.rival,
    localVisitante: fila.local_visitante,
    competicion: fila.competicion,
    competicionId: fila.competicion_id,
    competicionNombre: fila.competicion_nombre,
    jornada: fila.jornada,
    resultadoPropio: fila.resultado_propio,
    resultadoRival: fila.resultado_rival,
    jugado: fila.jugado,
    notas: fila.notas,
    enDirecto: fila.en_directo,
    periodo: fila.periodo,
    configuracionPartes: fila.configuracion_partes,
    parteActualIndice: fila.parte_actual_indice,
    periodoIniciadoEn: fila.periodo_iniciado_en,
    periodoSegundosAcumulados: fila.periodo_segundos_acumulados,
    posesionActual: fila.posesion_actual,
    minutoActual: calcularMinutoActual(fila),
  };
}

function filaAEvento(fila) {
  return {
    id: fila.id,
    partidoId: fila.partido_id,
    minuto: fila.minuto,
    tipo: fila.tipo,
    ocasionClara: fila.ocasion_clara,
    deportistaId: fila.deportista_id,
    deportistaNombre: fila.deportista_nombre,
    descripcion: fila.descripcion,
    creadoEn: fila.creado_en,
  };
}

function filaAConvocado(fila) {
  return {
    id: fila.id,
    deportistaId: fila.deportista_id,
    nombre: fila.nombre,
    apellidos: fila.apellidos,
    dorsal: fila.dorsal,
    titular: fila.titular,
  };
}

// Minuto de partido a partir del cronómetro: suma la duración configurada
// de las partes ya terminadas más lo transcurrido en la parte actual (que
// sigue corriendo mientras periodo_iniciado_en no sea null).
function calcularMinutoActual(partido) {
  const partes = partido.configuracion_partes;
  const indice = partido.parte_actual_indice;
  if (!Array.isArray(partes) || indice == null || !partes[indice]) return null;
  let segundosPrevios = 0;
  for (let i = 0; i < indice; i++) {
    segundosPrevios += (Number(partes[i].duracionMin) || 0) * 60;
  }
  let segundosParteActual = partido.periodo_segundos_acumulados || 0;
  if (partido.periodo_iniciado_en) {
    segundosParteActual += Math.floor((Date.now() - new Date(partido.periodo_iniciado_en).getTime()) / 1000);
  }
  return Math.floor((segundosPrevios + segundosParteActual) / 60) + 1;
}

const TIPOS_EVENTO = [
  'gol_propio', 'gol_rival',
  'tarjeta_amarilla_propio', 'tarjeta_amarilla_rival',
  'tarjeta_roja_propio', 'tarjeta_roja_rival',
  'tiro_propio', 'tiro_rival',
  'falta_favor', 'falta_contra',
  'corner_favor', 'corner_contra',
  'posesion_cambio',
  'otro',
];

async function usuarioEsPersonalDelEquipo(usuarioId, equipoId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM equipo_personal WHERE equipo_id = $1 AND usuario_id = $2 LIMIT 1',
    [equipoId, usuarioId]
  );
  return rows.length > 0;
}

async function puedeVerEquipo(req, equipoId) {
  const { roles, id: usuarioId } = req.usuario;
  if (roles.some((r) => ACCESO_TOTAL_LECTURA.includes(r))) return true;
  return usuarioEsPersonalDelEquipo(usuarioId, equipoId);
}

// Devuelve el partido si el usuario puede GESTIONARLO (dirección
// deportiva/administrador/coordinador, o personal de ese equipo), o
// lanza {status, mensaje} si no.
async function partidoYPermisoGestion(req, partidoId) {
  const { rows } = await pool.query('SELECT * FROM partidos WHERE id = $1', [partidoId]);
  if (!rows[0]) {
    const err = new Error('Partido no encontrado');
    err.status = 404;
    throw err;
  }
  const { roles, id: usuarioId } = req.usuario;
  if (!roles.some((r) => GESTION_DEPORTIVA.includes(r))) {
    const autorizado = await usuarioEsPersonalDelEquipo(usuarioId, rows[0].equipo_id);
    if (!autorizado) {
      const err = new Error('No tienes permiso para esto');
      err.status = 403;
      throw err;
    }
  }
  return rows[0];
}

// GET /api/partidos?equipoId=&temporadaId= - listado, ordenado por fecha.
router.get('/', autenticar, async (req, res) => {
  const { equipoId, temporadaId } = req.query;
  if (!equipoId) return res.status(400).json({ error: 'equipoId es obligatorio' });
  if (!(await puedeVerEquipo(req, equipoId))) {
    return res.status(403).json({ error: 'No tienes permiso para esto' });
  }
  const condiciones = ['p.equipo_id = $1'];
  const parametros = [equipoId];
  if (temporadaId) {
    parametros.push(temporadaId);
    condiciones.push(`p.temporada_id = $${parametros.length}`);
  }
  try {
    const { rows } = await pool.query(
      `SELECT p.*, c.nombre AS competicion_nombre FROM partidos p
       LEFT JOIN competiciones c ON c.id = p.competicion_id
       WHERE ${condiciones.join(' AND ')} ORDER BY p.fecha DESC, p.hora DESC NULLS LAST`,
      parametros
    );
    res.json(rows.map(filaAPartido));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar los partidos' });
  }
});

// GET /api/partidos/estadisticas?equipoId=&temporadaId= - jugados,
// ganados/empatados/perdidos y goles/puntos a favor y en contra.
router.get('/estadisticas', autenticar, async (req, res) => {
  const { equipoId, temporadaId } = req.query;
  if (!equipoId || !temporadaId) return res.status(400).json({ error: 'equipoId y temporadaId son obligatorios' });
  if (!(await puedeVerEquipo(req, equipoId))) {
    return res.status(403).json({ error: 'No tienes permiso para esto' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT * FROM v_partidos_resumen WHERE equipo_id = $1 AND temporada_id = $2',
      [equipoId, temporadaId]
    );
    const r = rows[0] || { jugados: 0, ganados: 0, empatados: 0, perdidos: 0, favor: 0, contra: 0 };
    res.json({
      jugados: Number(r.jugados),
      ganados: Number(r.ganados),
      empatados: Number(r.empatados),
      perdidos: Number(r.perdidos),
      favor: Number(r.favor),
      contra: Number(r.contra),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular las estadísticas' });
  }
});

// GET /api/partidos/:id - detalle de un partido concreto (para el
// marcador en directo).
router.get('/:id', autenticar, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM partidos WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Partido no encontrado' });
    if (!(await puedeVerEquipo(req, rows[0].equipo_id))) {
      return res.status(403).json({ error: 'No tienes permiso para esto' });
    }
    res.json(filaAPartido(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar el partido' });
  }
});

// --- Convocatoria / alineación --------------------------------------

// GET /api/partidos/:id/alineacion - convocados a este partido.
router.get('/:id/alineacion', autenticar, async (req, res) => {
  try {
    const { rows: partido } = await pool.query('SELECT equipo_id FROM partidos WHERE id = $1', [req.params.id]);
    if (!partido[0]) return res.status(404).json({ error: 'Partido no encontrado' });
    if (!(await puedeVerEquipo(req, partido[0].equipo_id))) {
      return res.status(403).json({ error: 'No tienes permiso para esto' });
    }
    const { rows } = await pool.query(
      `SELECT pa.*, d.nombre, d.apellidos FROM partidos_alineacion pa
       JOIN deportistas d ON d.id = pa.deportista_id
       WHERE pa.partido_id = $1
       ORDER BY pa.titular DESC, pa.dorsal NULLS LAST, d.apellidos`,
      [req.params.id]
    );
    res.json(rows.map(filaAConvocado));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar la convocatoria' });
  }
});

// PUT /api/partidos/:id/alineacion - sustituye la convocatoria completa.
// body: { convocados: [{ deportistaId, dorsal, titular }, ...] }
router.put('/:id/alineacion', autenticar, async (req, res) => {
  const { convocados } = req.body;
  if (!Array.isArray(convocados)) return res.status(400).json({ error: 'convocados debe ser una lista' });
  const cliente = await pool.connect();
  try {
    await partidoYPermisoGestion(req, req.params.id);
    await cliente.query('BEGIN');
    await cliente.query('DELETE FROM partidos_alineacion WHERE partido_id = $1', [req.params.id]);
    for (const jugador of convocados) {
      if (!jugador.deportistaId) continue;
      await cliente.query(
        `INSERT INTO partidos_alineacion (partido_id, deportista_id, dorsal, titular)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (partido_id, deportista_id) DO UPDATE SET dorsal = $3, titular = $4`,
        [req.params.id, jugador.deportistaId, jugador.dorsal || null, jugador.titular !== false]
      );
    }
    await cliente.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await cliente.query('ROLLBACK');
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error al guardar la convocatoria' });
  } finally {
    cliente.release();
  }
});

// --- Directo: cronómetro y partes ------------------------------------

// PUT /api/partidos/:id/directo/iniciar - arranca el directo: fija la
// configuración de partes (si se manda; si no, reutiliza la que ya
// hubiera) y pone en marcha el cronómetro de la primera parte.
// body: { configuracionPartes: [{ nombre, duracionMin }, ...] }
router.put('/:id/directo/iniciar', autenticar, async (req, res) => {
  const { configuracionPartes } = req.body;
  try {
    const partido = await partidoYPermisoGestion(req, req.params.id);
    const partes = Array.isArray(configuracionPartes) && configuracionPartes.length > 0
      ? configuracionPartes
      : partido.configuracion_partes;
    if (!Array.isArray(partes) || partes.length === 0) {
      return res.status(400).json({ error: 'configuracionPartes es obligatorio (al menos una parte con nombre y duracionMin)' });
    }
    const { rows } = await pool.query(
      `UPDATE partidos SET
         configuracion_partes = $1,
         parte_actual_indice = 0,
         periodo = $2,
         periodo_segundos_acumulados = 0,
         periodo_iniciado_en = now(),
         en_directo = TRUE,
         posesion_actual = COALESCE(posesion_actual, 'propio')
       WHERE id = $3 RETURNING *`,
      [JSON.stringify(partes), partes[0].nombre, req.params.id]
    );
    res.json(filaAPartido(rows[0]));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar el directo' });
  }
});

// PUT /api/partidos/:id/directo/pausar - para el cronómetro (queda lo
// transcurrido guardado, listo para reanudar más tarde).
router.put('/:id/directo/pausar', autenticar, async (req, res) => {
  try {
    const partido = await partidoYPermisoGestion(req, req.params.id);
    if (!partido.periodo_iniciado_en) return res.json(filaAPartido(partido));
    const segundosNuevos = partido.periodo_segundos_acumulados
      + Math.floor((Date.now() - new Date(partido.periodo_iniciado_en).getTime()) / 1000);
    const { rows } = await pool.query(
      `UPDATE partidos SET periodo_segundos_acumulados = $1, periodo_iniciado_en = NULL
       WHERE id = $2 RETURNING *`,
      [segundosNuevos, req.params.id]
    );
    res.json(filaAPartido(rows[0]));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error al pausar el directo' });
  }
});

// PUT /api/partidos/:id/directo/reanudar - vuelve a poner en marcha el
// cronómetro de la parte actual.
router.put('/:id/directo/reanudar', autenticar, async (req, res) => {
  try {
    const partido = await partidoYPermisoGestion(req, req.params.id);
    if (!partido.en_directo || partido.parte_actual_indice == null) {
      return res.status(400).json({ error: 'El directo todavía no se ha iniciado' });
    }
    const { rows } = await pool.query(
      `UPDATE partidos SET periodo_iniciado_en = now() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json(filaAPartido(rows[0]));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error al reanudar el directo' });
  }
});

// PUT /api/partidos/:id/directo/siguiente-parte - cierra la parte actual
// (contabilizando lo transcurrido) y pasa a la siguiente en pausa, lista
// para que el entrenador la arranque cuando quiera. Si ya no quedan más
// partes configuradas, da el partido por finalizado y jugado.
router.put('/:id/directo/siguiente-parte', autenticar, async (req, res) => {
  try {
    const partido = await partidoYPermisoGestion(req, req.params.id);
    const partes = partido.configuracion_partes;
    if (!Array.isArray(partes) || partido.parte_actual_indice == null) {
      return res.status(400).json({ error: 'El directo todavía no se ha iniciado' });
    }
    const siguienteIndice = partido.parte_actual_indice + 1;
    let rows;
    if (siguienteIndice < partes.length) {
      ({ rows } = await pool.query(
        `UPDATE partidos SET
           parte_actual_indice = $1,
           periodo = $2,
           periodo_segundos_acumulados = 0,
           periodo_iniciado_en = NULL
         WHERE id = $3 RETURNING *`,
        [siguienteIndice, partes[siguienteIndice].nombre, req.params.id]
      ));
    } else {
      ({ rows } = await pool.query(
        `UPDATE partidos SET
           periodo = 'Finalizado',
           en_directo = FALSE,
           jugado = TRUE,
           periodo_iniciado_en = NULL
         WHERE id = $1 RETURNING *`,
        [req.params.id]
      ));
    }
    res.json(filaAPartido(rows[0]));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error al avanzar de parte' });
  }
});

// PUT /api/partidos/:id/directo/anadir-parte - añade una parte extra al
// final de la configuración (p.ej. una prórroga decidida sobre la
// marcha). body: { nombre, duracionMin }
router.put('/:id/directo/anadir-parte', autenticar, async (req, res) => {
  const { nombre, duracionMin } = req.body;
  if (!nombre || !duracionMin) return res.status(400).json({ error: 'nombre y duracionMin son obligatorios' });
  try {
    const partido = await partidoYPermisoGestion(req, req.params.id);
    const partes = Array.isArray(partido.configuracion_partes) ? [...partido.configuracion_partes] : [];
    partes.push({ nombre, duracionMin: Number(duracionMin) });
    const { rows } = await pool.query(
      'UPDATE partidos SET configuracion_partes = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(partes), req.params.id]
    );
    res.json(filaAPartido(rows[0]));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error al añadir la parte' });
  }
});

// PUT /api/partidos/:id/directo/posesion - fija quién tiene la posesión
// ahora mismo (un botón por lado en el frontend). body: { valor: 'propio'|'rival' }
router.put('/:id/directo/posesion', autenticar, async (req, res) => {
  const { valor } = req.body;
  if (!['propio', 'rival'].includes(valor)) return res.status(400).json({ error: "valor debe ser 'propio' o 'rival'" });
  try {
    const partido = await partidoYPermisoGestion(req, req.params.id);
    if (partido.posesion_actual !== valor) {
      await pool.query('UPDATE partidos SET posesion_actual = $1 WHERE id = $2', [valor, req.params.id]);
      const minuto = calcularMinutoActual({ ...partido, posesion_actual: valor });
      await pool.query(
        `INSERT INTO partidos_eventos (partido_id, minuto, tipo, descripcion, creado_por)
         VALUES ($1, $2, 'posesion_cambio', $3, $4)`,
        [req.params.id, minuto, valor === 'propio' ? 'Pasa a nosotros' : 'Pasa al rival', req.usuario.id]
      );
    }
    res.json({ ok: true, posesionActual: valor });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error al cambiar la posesión' });
  }
});

// GET /api/partidos/:id/resumen - recuento agregado de eventos (para el
// resumen del descanso o para consultarlo en cualquier momento).
router.get('/:id/resumen', autenticar, async (req, res) => {
  try {
    const { rows: partido } = await pool.query('SELECT equipo_id FROM partidos WHERE id = $1', [req.params.id]);
    if (!partido[0]) return res.status(404).json({ error: 'Partido no encontrado' });
    if (!(await puedeVerEquipo(req, partido[0].equipo_id))) {
      return res.status(403).json({ error: 'No tienes permiso para esto' });
    }
    const { rows } = await pool.query(
      `SELECT tipo, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE ocasion_clara)::int AS ocasiones_claras
       FROM partidos_eventos WHERE partido_id = $1 GROUP BY tipo`,
      [req.params.id]
    );
    const resumen = {};
    for (const t of TIPOS_EVENTO) resumen[t] = { total: 0, ocasionesClaras: 0 };
    for (const fila of rows) {
      resumen[fila.tipo] = { total: fila.total, ocasionesClaras: fila.ocasiones_claras };
    }
    res.json(resumen);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular el resumen' });
  }
});

// --- Eventos -----------------------------------------------------------

// GET /api/partidos/:id/eventos - feed cronológico (goles, tarjetas...).
router.get('/:id/eventos', autenticar, async (req, res) => {
  try {
    const { rows: partido } = await pool.query('SELECT equipo_id FROM partidos WHERE id = $1', [req.params.id]);
    if (!partido[0]) return res.status(404).json({ error: 'Partido no encontrado' });
    if (!(await puedeVerEquipo(req, partido[0].equipo_id))) {
      return res.status(403).json({ error: 'No tienes permiso para esto' });
    }
    const { rows } = await pool.query(
      `SELECT ev.*, d.nombre || ' ' || d.apellidos AS deportista_nombre
       FROM partidos_eventos ev
       LEFT JOIN deportistas d ON d.id = ev.deportista_id
       WHERE ev.partido_id = $1 ORDER BY ev.creado_en ASC`,
      [req.params.id]
    );
    res.json(rows.map(filaAEvento));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar los eventos del partido' });
  }
});

// POST /api/partidos/:id/eventos - registrar un evento. El minuto se
// calcula solo a partir del cronómetro del partido (no se escribe a
// mano). Un gol suma al momento en el marcador
// (resultado_propio/resultado_rival).
router.post('/:id/eventos', autenticar, async (req, res) => {
  const { tipo, deportistaId, descripcion, ocasionClara } = req.body;
  if (!TIPOS_EVENTO.includes(tipo)) {
    return res.status(400).json({ error: `tipo debe ser una de: ${TIPOS_EVENTO.join(', ')}` });
  }
  try {
    const partido = await partidoYPermisoGestion(req, req.params.id);
    const minuto = calcularMinutoActual(partido);

    const { rows } = await pool.query(
      `INSERT INTO partidos_eventos (partido_id, minuto, tipo, deportista_id, descripcion, ocasion_clara, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [req.params.id, minuto, tipo, deportistaId || null, descripcion || null, ocasionClara === true, req.usuario.id]
    );

    if (tipo === 'gol_propio') {
      await pool.query('UPDATE partidos SET resultado_propio = COALESCE(resultado_propio, 0) + 1 WHERE id = $1', [req.params.id]);
    } else if (tipo === 'gol_rival') {
      await pool.query('UPDATE partidos SET resultado_rival = COALESCE(resultado_rival, 0) + 1 WHERE id = $1', [req.params.id]);
    }

    res.status(201).json({ id: rows[0].id, minuto });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error al registrar el evento' });
  }
});

// DELETE /api/partidos/eventos/:eventoId - corregir un evento mal metido
// (si era gol, resta del marcador sin bajar de 0).
router.delete('/eventos/:eventoId', autenticar, async (req, res) => {
  const { roles, id: usuarioId } = req.usuario;
  try {
    const { rows: evento } = await pool.query(
      `SELECT ev.*, p.equipo_id FROM partidos_eventos ev JOIN partidos p ON p.id = ev.partido_id WHERE ev.id = $1`,
      [req.params.eventoId]
    );
    if (!evento[0]) return res.status(404).json({ error: 'Evento no encontrado' });
    if (!roles.some((r) => GESTION_DEPORTIVA.includes(r))) {
      const autorizado = await usuarioEsPersonalDelEquipo(usuarioId, evento[0].equipo_id);
      if (!autorizado) return res.status(403).json({ error: 'No tienes permiso para esto' });
    }

    await pool.query('DELETE FROM partidos_eventos WHERE id = $1', [req.params.eventoId]);

    if (evento[0].tipo === 'gol_propio') {
      await pool.query('UPDATE partidos SET resultado_propio = GREATEST(COALESCE(resultado_propio, 0) - 1, 0) WHERE id = $1', [evento[0].partido_id]);
    } else if (evento[0].tipo === 'gol_rival') {
      await pool.query('UPDATE partidos SET resultado_rival = GREATEST(COALESCE(resultado_rival, 0) - 1, 0) WHERE id = $1', [evento[0].partido_id]);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el evento' });
  }
});

// POST /api/partidos - crear partido (con o sin resultado todavía).
router.post('/', autenticar, async (req, res) => {
  const { roles, id: usuarioId } = req.usuario;
  const {
    equipoId, temporadaId, fecha, hora, rival, localVisitante,
    competicion, competicionId, jornada, resultadoPropio, resultadoRival, notas,
  } = req.body;
  if (!equipoId || !temporadaId || !fecha || !rival) {
    return res.status(400).json({ error: 'equipoId, temporadaId, fecha y rival son obligatorios' });
  }
  if (!roles.some((r) => GESTION_DEPORTIVA.includes(r))) {
    const autorizado = await usuarioEsPersonalDelEquipo(usuarioId, equipoId);
    if (!autorizado) return res.status(403).json({ error: 'No tienes permiso para esto' });
  }
  const jugado = resultadoPropio !== undefined && resultadoPropio !== null
    && resultadoRival !== undefined && resultadoRival !== null;
  try {
    const { rows } = await pool.query(
      `INSERT INTO partidos (equipo_id, temporada_id, fecha, hora, rival, local_visitante,
                              competicion, competicion_id, jornada, resultado_propio, resultado_rival, jugado, notas, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        equipoId, temporadaId, fecha, hora || null, rival, localVisitante || 'local',
        competicion || null, competicionId || null, jornada || null,
        resultadoPropio ?? null, resultadoRival ?? null, jugado, notas || null, usuarioId,
      ]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el partido' });
  }
});

// PUT /api/partidos/:id - editar datos del partido y/o cargar el
// resultado (jugado pasa a true en cuanto llegan los dos resultados).
router.put('/:id', autenticar, async (req, res) => {
  const { roles, id: usuarioId } = req.usuario;
  try {
    const { rows: actual } = await pool.query('SELECT equipo_id FROM partidos WHERE id = $1', [req.params.id]);
    if (!actual[0]) return res.status(404).json({ error: 'Partido no encontrado' });
    if (!roles.some((r) => GESTION_DEPORTIVA.includes(r))) {
      const autorizado = await usuarioEsPersonalDelEquipo(usuarioId, actual[0].equipo_id);
      if (!autorizado) return res.status(403).json({ error: 'No tienes permiso para esto' });
    }

    const {
      fecha, hora, rival, localVisitante, competicion, jornada,
      resultadoPropio, resultadoRival, notas,
    } = req.body;
    const jugado = resultadoPropio !== undefined && resultadoPropio !== null
      && resultadoRival !== undefined && resultadoRival !== null;

    const { rows } = await pool.query(
      `UPDATE partidos SET
         fecha = COALESCE($1, fecha),
         hora = COALESCE($2, hora),
         rival = COALESCE($3, rival),
         local_visitante = COALESCE($4, local_visitante),
         competicion = COALESCE($5, competicion),
         jornada = COALESCE($6, jornada),
         resultado_propio = $7,
         resultado_rival = $8,
         jugado = $9,
         notas = COALESCE($10, notas)
       WHERE id = $11
       RETURNING id`,
      [
        fecha, hora, rival, localVisitante, competicion, jornada,
        resultadoPropio ?? null, resultadoRival ?? null, jugado, notas, req.params.id,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Partido no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el partido' });
  }
});

// DELETE /api/partidos/:id - eliminar un partido mal metido.
router.delete('/:id', autenticar, async (req, res) => {
  const { roles, id: usuarioId } = req.usuario;
  try {
    const { rows: actual } = await pool.query('SELECT equipo_id FROM partidos WHERE id = $1', [req.params.id]);
    if (!actual[0]) return res.status(404).json({ error: 'Partido no encontrado' });
    if (!roles.some((r) => GESTION_DEPORTIVA.includes(r))) {
      const autorizado = await usuarioEsPersonalDelEquipo(usuarioId, actual[0].equipo_id);
      if (!autorizado) return res.status(403).json({ error: 'No tienes permiso para esto' });
    }
    await pool.query('DELETE FROM partidos WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el partido' });
  }
});

module.exports = router;
