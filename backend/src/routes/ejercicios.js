// Banco de ejercicios: independiente por deporte (siempre se filtra por
// deporte_id), con vídeos vinculados (Instagram/TikTok) por ejercicio.
// Es un recurso compartido entre todo el cuerpo técnico: cualquiera con
// rol técnico puede consultarlo y aportar ejercicios nuevos. Editar o
// borrar uno de otro compañero queda reservado a quien lo creó o a
// dirección deportiva/administrador/coordinador, para que nadie borre por
// error el trabajo de otro entrenador.
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { autenticar } = require('../middleware/auth');
const { requiereRol, GESTION_DEPORTIVA, PERSONAL_TECNICO } = require('../middleware/permisos');

function filaAEjercicio(fila) {
  return {
    id: fila.id,
    deporteId: fila.deporte_id,
    deporteNombre: fila.deporte_nombre,
    titulo: fila.titulo,
    descripcion: fila.descripcion,
    tipologia: fila.tipologia,
    naturaleza: fila.naturaleza,
    categoriaEdad: fila.categoria_edad,
    espacio: fila.espacio,
    numJugadores: fila.num_jugadores,
    duracionMin: fila.duracion_min,
    imagenUrl: fila.imagen_url,
    creadoPor: fila.creado_por,
  };
}

function filaAVideo(fila) {
  return {
    id: fila.id,
    ejercicioId: fila.ejercicio_id,
    titulo: fila.titulo,
    urlOriginal: fila.url_original,
    plataforma: fila.plataforma,
    autor: fila.autor,
    procesadoEstado: fila.procesado_estado,
    imagenGeneradaUrl: fila.imagen_generada_url,
  };
}

async function puedeEditar(req, ejercicioId) {
  const { roles, id: usuarioId } = req.usuario;
  if (roles.some((r) => GESTION_DEPORTIVA.includes(r))) return true;
  const { rows } = await pool.query('SELECT creado_por FROM ejercicios WHERE id = $1', [ejercicioId]);
  return rows[0] && rows[0].creado_por === usuarioId;
}

// GET /api/ejercicios?deporteId=&tipologia=&naturaleza=&q=
router.get('/', autenticar, requiereRol(...PERSONAL_TECNICO), async (req, res) => {
  const { deporteId, tipologia, naturaleza, q } = req.query;
  if (!deporteId) return res.status(400).json({ error: 'deporteId es obligatorio (el banco es independiente por deporte)' });

  const condiciones = ['e.deporte_id = $1'];
  const parametros = [deporteId];
  const nuevoParametro = (valor) => {
    parametros.push(valor);
    return `$${parametros.length}`;
  };
  if (tipologia) condiciones.push(`e.tipologia = ${nuevoParametro(tipologia)}`);
  if (naturaleza) condiciones.push(`e.naturaleza = ${nuevoParametro(naturaleza)}`);
  if (q) condiciones.push(`(e.titulo ILIKE ${nuevoParametro(`%${q}%`)} OR e.descripcion ILIKE ${nuevoParametro(`%${q}%`)})`);

  try {
    const { rows } = await pool.query(
      `SELECT e.*, dep.nombre AS deporte_nombre
       FROM ejercicios e
       JOIN deportes dep ON dep.id = e.deporte_id
       WHERE ${condiciones.join(' AND ')}
       ORDER BY e.creado_en DESC`,
      parametros
    );
    res.json(rows.map(filaAEjercicio));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar el banco de ejercicios' });
  }
});

// GET /api/ejercicios/:id - detalle con sus vídeos.
router.get('/:id', autenticar, requiereRol(...PERSONAL_TECNICO), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*, dep.nombre AS deporte_nombre FROM ejercicios e
       JOIN deportes dep ON dep.id = e.deporte_id WHERE e.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Ejercicio no encontrado' });
    const { rows: videos } = await pool.query(
      'SELECT * FROM ejercicios_videos WHERE ejercicio_id = $1 ORDER BY creado_en DESC',
      [req.params.id]
    );
    res.json({ ...filaAEjercicio(rows[0]), videos: videos.map(filaAVideo) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar el ejercicio' });
  }
});

// POST /api/ejercicios - crear ejercicio nuevo en el banco.
router.post('/', autenticar, requiereRol(...PERSONAL_TECNICO), async (req, res) => {
  const {
    deporteId, titulo, descripcion, tipologia, naturaleza,
    categoriaEdad, espacio, numJugadores, duracionMin,
  } = req.body;
  if (!deporteId || !titulo) {
    return res.status(400).json({ error: 'deporteId y titulo son obligatorios' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO ejercicios (deporte_id, titulo, descripcion, tipologia, naturaleza,
                                categoria_edad, espacio, num_jugadores, duracion_min, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        deporteId, titulo, descripcion || null, tipologia || null, naturaleza || null,
        categoriaEdad || null, espacio || null, numJugadores || null, duracionMin || null,
        req.usuario.id,
      ]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el ejercicio' });
  }
});

// PUT /api/ejercicios/:id - editar (el autor o dirección deportiva/admin/coordinador).
router.put('/:id', autenticar, requiereRol(...PERSONAL_TECNICO), async (req, res) => {
  if (!(await puedeEditar(req, req.params.id))) {
    return res.status(403).json({ error: 'Solo quien creó este ejercicio (o dirección deportiva) puede editarlo' });
  }
  const {
    titulo, descripcion, tipologia, naturaleza,
    categoriaEdad, espacio, numJugadores, duracionMin,
  } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE ejercicios SET
         titulo = COALESCE($1, titulo),
         descripcion = COALESCE($2, descripcion),
         tipologia = COALESCE($3, tipologia),
         naturaleza = COALESCE($4, naturaleza),
         categoria_edad = COALESCE($5, categoria_edad),
         espacio = COALESCE($6, espacio),
         num_jugadores = COALESCE($7, num_jugadores),
         duracion_min = COALESCE($8, duracion_min)
       WHERE id = $9
       RETURNING id`,
      [titulo, descripcion, tipologia, naturaleza, categoriaEdad, espacio, numJugadores, duracionMin, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Ejercicio no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el ejercicio' });
  }
});

// DELETE /api/ejercicios/:id
router.delete('/:id', autenticar, requiereRol(...PERSONAL_TECNICO), async (req, res) => {
  if (!(await puedeEditar(req, req.params.id))) {
    return res.status(403).json({ error: 'Solo quien creó este ejercicio (o dirección deportiva) puede eliminarlo' });
  }
  try {
    const { rows } = await pool.query('DELETE FROM ejercicios WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Ejercicio no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el ejercicio' });
  }
});

// POST /api/ejercicios/:id/videos - vincular un vídeo (Instagram/TikTok).
router.post('/:id/videos', autenticar, requiereRol(...PERSONAL_TECNICO), async (req, res) => {
  const { titulo, urlOriginal, plataforma, autor } = req.body;
  if (!urlOriginal) return res.status(400).json({ error: 'urlOriginal es obligatorio' });
  const plataformasValidas = ['instagram', 'tiktok', 'otro'];
  const plataformaFinal = plataformasValidas.includes(plataforma) ? plataforma : 'otro';
  try {
    const ejercicio = await pool.query('SELECT id FROM ejercicios WHERE id = $1', [req.params.id]);
    if (!ejercicio.rows[0]) return res.status(404).json({ error: 'Ejercicio no encontrado' });
    const { rows } = await pool.query(
      `INSERT INTO ejercicios_videos (ejercicio_id, titulo, url_original, plataforma, autor)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [req.params.id, titulo || null, urlOriginal, plataformaFinal, autor || null]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al vincular el vídeo' });
  }
});

// DELETE /api/ejercicios/videos/:videoId
router.delete('/videos/:videoId', autenticar, requiereRol(...PERSONAL_TECNICO), async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM ejercicios_videos WHERE id = $1 RETURNING id', [req.params.videoId]);
    if (!rows[0]) return res.status(404).json({ error: 'Vídeo no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el vídeo' });
  }
});

module.exports = router;
