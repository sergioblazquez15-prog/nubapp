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
    escudoRival: fila.escudo_rival,
    fuenteExterna: fila.fuente_externa,
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
// Con equipoId: los partidos de ese equipo (comportamiento de siempre).
// Sin equipoId: los partidos de TODOS los equipos que el usuario puede
// ver (para la sección "Partidos" de Dirección deportiva) — administración
// y dirección deportiva ven los de todo el club; entrenador/monitor solo
// los de sus propios equipos.
router.get('/', autenticar, async (req, res) => {
  const { equipoId, temporadaId } = req.query;
  if (equipoId) {
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
        `SELECT p.*, c.nombre AS competicion_nombre, e.nombre AS equipo_nombre FROM partidos p
         LEFT JOIN competiciones c ON c.id = p.competicion_id
         JOIN equipos e ON e.id = p.equipo_id
         WHERE ${condiciones.join(' AND ')} ORDER BY p.fecha DESC, p.hora DESC NULLS LAST`,
        parametros
      );
      res.json(rows.map((f) => ({ ...filaAPartido(f), equipoNombre: f.equipo_nombre })));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al consultar los partidos' });
    }
    return;
  }

  const { roles, id: usuarioId } = req.usuario;
  const condiciones = [`dep.tipo = 'equipo'`];
  const parametros = [];
  if (temporadaId) {
    parametros.push(temporadaId);
    condiciones.push(`p.temporada_id = $${parametros.length}`);
  }
  if (!roles.some((r) => ACCESO_TOTAL_LECTURA.includes(r))) {
    parametros.push(usuarioId);
    condiciones.push(`EXISTS (SELECT 1 FROM equipo_personal ep WHERE ep.equipo_id = p.equipo_id AND ep.usuario_id = $${parametros.length})`);
  }
  try {
    const { rows } = await pool.query(
      `SELECT p.*, c.nombre AS competicion_nombre, e.nombre AS equipo_nombre FROM partidos p
       JOIN equipos e ON e.id = p.equipo_id
       JOIN deportes dep ON dep.id = e.deporte_id
       LEFT JOIN competiciones c ON c.id = p.competicion_id
       WHERE ${condiciones.join(' AND ')} ORDER BY p.fecha DESC, p.hora DESC NULLS LAST`,
      parametros
    );
    res.json(rows.map((f) => ({ ...filaAPartido(f), equipoNombre: f.equipo_nombre })));
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

// --- Importar calendario desde una URL externa (RFFM) -----------------
//
// La RFFM (Real Federación de Fútbol de Madrid) publica el calendario de
// cada grupo/competición en una página que, al inspeccionarla, resultó
// ser una app Next.js: los datos de los partidos viajan embebidos en un
// bloque <script id="__NEXT_DATA__"> dentro del propio HTML (en vez de
// pedirse aparte a una API), según la técnica que usa el proyecto
// open-source "rffm_tools" para lo mismo. No ha sido posible comprobar
// desde el entorno de desarrollo la forma EXACTA de ese JSON (el acceso
// a rffm.es estaba bloqueado ahí), así que aquí se busca de forma
// heurística: se recorre el JSON entero buscando el array que parezca
// contener los partidos (por tener fecha + dos nombres de equipo en cada
// elemento) probando varios nombres de campo habituales. Si la RFFM usa
// nombres de campo distintos a los aquí previstos, faltará ajustar los
// alias de abajo una vez se pueda ver una respuesta real - el endpoint
// devuelve siempre alguna pista (las claves del primer partido
// encontrado) para poder afinarlo rápido.
const ALIAS_FECHA = ['fecha', 'fechaPartido', 'fecha_partido', 'date', 'fechaHora', 'fechaInicio'];
const ALIAS_HORA = ['hora', 'horaPartido', 'hora_partido', 'time', 'horaInicio'];
const ALIAS_LOCAL = ['equipoLocal', 'nombreLocal', 'local', 'equipo1', 'homeTeam', 'home', 'nombreEquipoLocal'];
const ALIAS_VISITANTE = ['equipoVisitante', 'nombreVisitante', 'visitante', 'equipo2', 'awayTeam', 'away', 'nombreEquipoVisitante'];
const ALIAS_GOLES_LOCAL = ['golesLocal', 'resultadoLocal', 'golLocal', 'homeScore', 'puntosLocal', 'marcadorLocal'];
const ALIAS_GOLES_VISITANTE = ['golesVisitante', 'resultadoVisitante', 'golVisitante', 'awayScore', 'puntosVisitante', 'marcadorVisitante'];
const ALIAS_ESCUDO_LOCAL = ['escudoLocal', 'escudo1', 'logoLocal', 'homeCrest', 'imagenLocal', 'escudoEquipoLocal'];
const ALIAS_ESCUDO_VISITANTE = ['escudoVisitante', 'escudo2', 'logoVisitante', 'awayCrest', 'imagenVisitante', 'escudoEquipoVisitante'];
const ALIAS_JORNADA = ['jornada', 'round', 'ronda', 'numeroJornada'];
const ALIAS_ID = ['id', 'idPartido', 'partidoId', 'matchId', 'id_partido'];

function normalizarTextoRival(txt) {
  return String(txt ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function buscarCampo(obj, alias) {
  for (const clave of alias) {
    if (obj[clave] !== undefined && obj[clave] !== null && obj[clave] !== '') return obj[clave];
  }
  return null;
}

function textoDeCampo(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'object') {
    // a veces el nombre del equipo viene como { nombre: '...' } o { texto: '...' }
    return textoDeCampo(valor.nombre ?? valor.texto ?? valor.value ?? valor.name ?? null);
  }
  return String(valor);
}

function urlDeCampo(valor) {
  const texto = textoDeCampo(valor);
  if (!texto) return null;
  if (typeof valor === 'object' && (valor.url || valor.src)) return valor.url || valor.src;
  return texto.startsWith('http') || texto.startsWith('/') ? texto : null;
}

function extraerNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function pareceUnPartido(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  return buscarCampo(obj, ALIAS_FECHA) !== null
    && buscarCampo(obj, ALIAS_LOCAL) !== null
    && buscarCampo(obj, ALIAS_VISITANTE) !== null;
}

function buscarArrayDePartidos(nodo, profundidadMax = 8, _prof = 0, _visto = new Set()) {
  if (_prof > profundidadMax || !nodo || typeof nodo !== 'object' || _visto.has(nodo)) return null;
  _visto.add(nodo);
  if (Array.isArray(nodo)) {
    if (nodo.length > 0 && nodo.filter(pareceUnPartido).length >= Math.ceil(nodo.length * 0.6)) {
      return nodo;
    }
    for (const item of nodo) {
      const encontrado = buscarArrayDePartidos(item, profundidadMax, _prof + 1, _visto);
      if (encontrado) return encontrado;
    }
    return null;
  }
  for (const valor of Object.values(nodo)) {
    const encontrado = buscarArrayDePartidos(valor, profundidadMax, _prof + 1, _visto);
    if (encontrado) return encontrado;
  }
  return null;
}

// Admite ISO ("2026-10-04..."), "dd/mm/aaaa[ hh:mm]" o timestamp numérico
// (ms o s). Devuelve { fecha: 'aaaa-mm-dd', hora: 'hh:mm'|null } o null si
// no se ha podido interpretar.
function parsearFechaHoraFlexible(fechaBruta, horaBruta) {
  let fecha = null;
  let hora = null;
  if (typeof fechaBruta === 'number') {
    const ms = fechaBruta > 1e12 ? fechaBruta : fechaBruta * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) {
      fecha = d.toISOString().slice(0, 10);
      hora = d.toISOString().slice(11, 16);
    }
  } else {
    const texto = String(fechaBruta).trim();
    const conBarras = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
    const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
    if (conBarras) {
      const [, d, m, a, h, min] = conBarras;
      fecha = `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      if (h) hora = `${h.padStart(2, '0')}:${min}`;
    } else if (iso) {
      const [, a, m, d, h, min] = iso;
      fecha = `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      if (h) hora = `${h.padStart(2, '0')}:${min}`;
    }
  }
  if (!fecha) return null;
  if (!hora && horaBruta) {
    const h = String(horaBruta).trim().match(/^(\d{1,2}):(\d{2})/);
    if (h) hora = `${h[1].padStart(2, '0')}:${h[2]}`;
  }
  return { fecha, hora };
}

// POST /api/partidos/importar-calendario - trae el calendario de un
// equipo desde una URL de RFFM y crea/actualiza sus partidos. body:
// { equipoId, temporadaId, url }. Guarda la url en el equipo para poder
// re-sincronizar más adelante con un clic. Requiere que el equipo tenga
// rellenado "nombreClubCompeticion" (cómo nos llama la RFFM, ej. "AD
// Nuevo Baztán") para poder distinguir dentro de cada partido cuál de
// los dos equipos somos nosotros y cuál es el rival.
router.post('/importar-calendario', autenticar, async (req, res) => {
  const { roles, id: usuarioId } = req.usuario;
  const { equipoId, temporadaId, url } = req.body;
  if (!equipoId || !temporadaId || !url) {
    return res.status(400).json({ error: 'equipoId, temporadaId y url son obligatorios' });
  }
  if (!roles.some((r) => GESTION_DEPORTIVA.includes(r))) {
    const autorizado = await usuarioEsPersonalDelEquipo(usuarioId, equipoId);
    if (!autorizado) return res.status(403).json({ error: 'No tienes permiso para esto' });
  }
  let urlValida;
  try {
    urlValida = new URL(url);
  } catch {
    return res.status(400).json({ error: 'La URL no es válida' });
  }
  if (!/(^|\.)rffm\.es$/.test(urlValida.hostname)) {
    return res.status(400).json({ error: 'Por ahora solo se admite un enlace de calendario de rffm.es' });
  }

  try {
    const { rows: equipoRows } = await pool.query('SELECT nombre_club_competicion FROM equipos WHERE id = $1', [equipoId]);
    if (!equipoRows[0]) return res.status(404).json({ error: 'Equipo no encontrado' });
    const nombreClub = equipoRows[0].nombre_club_competicion;
    if (!nombreClub) {
      return res.status(400).json({
        error: 'A este equipo le falta el "nombre del club en la competición" (cómo os llama la RFFM, ej. "AD Nuevo Baztán"). '
          + 'Rellénalo en la ficha del equipo antes de importar, para poder distinguir el rival en cada partido.',
      });
    }
    const clavePropia = normalizarTextoRival(nombreClub).split(/\s+/).filter((p) => p.length > 2);

    let respuesta;
    try {
      respuesta = await fetch(urlValida.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          Accept: 'text/html',
        },
      });
    } catch (err) {
      return res.status(502).json({ error: `No se ha podido contactar con la RFFM: ${err.message}` });
    }
    if (!respuesta.ok) {
      return res.status(502).json({ error: `La RFFM ha respondido con un error (${respuesta.status}) para ese enlace` });
    }
    const html = await respuesta.text();
    const datos = extraerNextData(html);
    if (!datos) {
      return res.status(502).json({
        error: 'La página se ha podido descargar pero no se ha encontrado el bloque de datos esperado (__NEXT_DATA__). '
          + 'Puede que la RFFM haya cambiado el formato de su web.',
      });
    }
    const partidosEncontrados = buscarArrayDePartidos(datos);
    if (!partidosEncontrados || partidosEncontrados.length === 0) {
      return res.status(502).json({
        error: 'Se ha leído la página pero no se ha reconocido ningún partido dentro de sus datos. '
          + 'El formato puede haber cambiado; habría que revisar el enlace real para ajustar la importación.',
      });
    }

    let creados = 0;
    let actualizados = 0;
    let ignorados = 0;
    const rivalesSinReconocer = [];

    for (const p of partidosEncontrados) {
      const nombreLocal = textoDeCampo(buscarCampo(p, ALIAS_LOCAL));
      const nombreVisitante = textoDeCampo(buscarCampo(p, ALIAS_VISITANTE));
      const fh = parsearFechaHoraFlexible(buscarCampo(p, ALIAS_FECHA), buscarCampo(p, ALIAS_HORA));
      if (!nombreLocal || !nombreVisitante || !fh) { ignorados++; continue; }

      const localEsNuestro = clavePropia.some((p2) => normalizarTextoRival(nombreLocal).includes(p2));
      const visitanteEsNuestro = clavePropia.some((p2) => normalizarTextoRival(nombreVisitante).includes(p2));
      if (localEsNuestro === visitanteEsNuestro) {
        // o no aparecemos en ninguno de los dos lados, o (raro) en los dos - no se puede decidir el rival
        rivalesSinReconocer.push(`${nombreLocal} - ${nombreVisitante}`);
        ignorados++;
        continue;
      }
      const localVisitante = localEsNuestro ? 'local' : 'visitante';
      const rival = localEsNuestro ? nombreVisitante : nombreLocal;
      const escudoRival = localEsNuestro
        ? urlDeCampo(buscarCampo(p, ALIAS_ESCUDO_VISITANTE))
        : urlDeCampo(buscarCampo(p, ALIAS_ESCUDO_LOCAL));

      const golesLocal = buscarCampo(p, ALIAS_GOLES_LOCAL);
      const golesVisitante = buscarCampo(p, ALIAS_GOLES_VISITANTE);
      const resultadoPropio = localEsNuestro ? golesLocal : golesVisitante;
      const resultadoRival = localEsNuestro ? golesVisitante : golesLocal;
      const jugado = resultadoPropio !== null && resultadoPropio !== undefined
        && resultadoRival !== null && resultadoRival !== undefined;

      const idExterno = String(buscarCampo(p, ALIAS_ID) ?? `${fh.fecha}-${nombreLocal}-${nombreVisitante}`).slice(0, 150);
      const jornada = textoDeCampo(buscarCampo(p, ALIAS_JORNADA));

      const { rows: existente } = await pool.query(
        `SELECT id FROM partidos WHERE equipo_id = $1 AND fuente_externa = 'rffm' AND id_externo = $2`,
        [equipoId, idExterno]
      );
      if (existente[0]) {
        await pool.query(
          `UPDATE partidos SET fecha = $1, hora = $2, rival = $3, local_visitante = $4, jornada = $5,
                                resultado_propio = $6, resultado_rival = $7, jugado = $8, escudo_rival = $9
           WHERE id = $10`,
          [
            fh.fecha, fh.hora, rival, localVisitante, jornada || null,
            resultadoPropio ?? null, resultadoRival ?? null, jugado, escudoRival, existente[0].id,
          ]
        );
        actualizados++;
      } else {
        await pool.query(
          `INSERT INTO partidos (equipo_id, temporada_id, fecha, hora, rival, local_visitante, jornada,
                                  resultado_propio, resultado_rival, jugado, escudo_rival, id_externo, fuente_externa, creado_por)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'rffm', $13)`,
          [
            equipoId, temporadaId, fh.fecha, fh.hora, rival, localVisitante, jornada || null,
            resultadoPropio ?? null, resultadoRival ?? null, jugado, escudoRival, idExterno, usuarioId,
          ]
        );
        creados++;
      }
    }

    await pool.query('UPDATE equipos SET calendario_externo_url = $1 WHERE id = $2', [url, equipoId]);

    res.json({
      ok: true,
      totalEncontrados: partidosEncontrados.length,
      partidosCreados: creados,
      partidosActualizados: actualizados,
      partidosIgnorados: ignorados,
      rivalesSinReconocer: rivalesSinReconocer.slice(0, 10),
      muestraClaves: Object.keys(partidosEncontrados[0] || {}),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al importar el calendario' });
  }
});

module.exports = router;
