// Solicitudes de alta recibidas por el enlace público de un equipo (ver
// routes/altaPublica.js, donde se reciben sin necesidad de login). Aquí
// se gestionan ya autenticado: listarlas, aprobarlas (crea la ficha de
// deportista real, lo ficha en el equipo/temporada y le da de alta el
// acceso a "Mi app" automáticamente) o rechazarlas.
// Gestión deportiva: administrador, dirección deportiva o coordinador.
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { autenticar } = require('../middleware/auth');
const { requiereRol, GESTION_DEPORTIVA } = require('../middleware/permisos');

const RONDAS_BCRYPT = 10;

// Genera una contraseña inicial para el acceso a "Mi app" que se crea al
// aprobar una solicitud - formato fácil de transcribir a mano (sin
// caracteres ambiguos como 0/O o 1/l/I), 10 caracteres. Mismo criterio que
// en la importación de Excel (ver routes/deportistas.js).
function generarPasswordAleatoria() {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let resultado = '';
  for (let i = 0; i < 10; i++) resultado += caracteres[Math.floor(Math.random() * caracteres.length)];
  return resultado;
}

function filaASolicitud(fila) {
  return {
    id: fila.id,
    equipoId: fila.equipo_id,
    equipoNombre: fila.equipo_nombre,
    deporteNombre: fila.deporte_nombre,
    nombre: fila.nombre,
    apellidos: fila.apellidos,
    email: fila.email,
    telefono: fila.telefono,
    estado: fila.estado,
    deportistaId: fila.deportista_id,
    creadoEn: fila.creado_en,
    revisadoEn: fila.revisado_en,
  };
}

const CONSULTA = `
  SELECT s.*, e.nombre AS equipo_nombre, dep.nombre AS deporte_nombre
  FROM solicitudes_alta s
  JOIN equipos e ON e.id = s.equipo_id
  JOIN deportes dep ON dep.id = e.deporte_id
`;

// GET /api/solicitudes?estado=pendiente&equipoId= - listado global (para
// la pantalla "Solicitudes de alta") o filtrado por equipo (para la
// pestaña dentro de la ficha de ese equipo) — mismo endpoint para ambas.
router.get('/', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  const { estado, equipoId } = req.query;
  const condiciones = [];
  const parametros = [];
  const nuevoParametro = (valor) => {
    parametros.push(valor);
    return `$${parametros.length}`;
  };
  if (estado) condiciones.push(`s.estado = ${nuevoParametro(estado)}`);
  if (equipoId) condiciones.push(`s.equipo_id = ${nuevoParametro(equipoId)}`);
  const clausulaWhere = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  try {
    const { rows } = await pool.query(
      `${CONSULTA} ${clausulaWhere} ORDER BY s.creado_en DESC`,
      parametros
    );
    res.json(rows.map(filaASolicitud));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar las solicitudes' });
  }
});

// POST /api/solicitudes/:id/aprobar - crea la ficha de deportista real
// con los datos que falten (la solicitud solo trae nombre, apellidos,
// email y teléfono), lo ficha en el equipo de la solicitud para la
// temporada indicada y le crea automáticamente el acceso a "Mi app":
// reutiliza el email de la solicitud si lo dio, o si no genera uno a
// partir de su nombre; la contraseña siempre se genera. Ambos se
// devuelven una sola vez en la respuesta (igual que en la importación de
// Excel) para que el club se los pueda comunicar al deportista - no se
// pueden volver a mostrar después, solo queda guardado el hash.
router.post('/:id/aprobar', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  const {
    temporadaId, fechaNacimiento, numeroSocio, nombreDeportivo, dni,
    telefonoPadre, telefonoMadre, tipoDeportista, dorsal,
  } = req.body;

  if (!temporadaId || !fechaNacimiento) {
    return res.status(400).json({ error: 'Temporada y fecha de nacimiento son obligatorias para aprobar' });
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    const { rows: solicitud } = await cliente.query(
      `SELECT s.*, e.deporte_id FROM solicitudes_alta s JOIN equipos e ON e.id = s.equipo_id
       WHERE s.id = $1 FOR UPDATE`,
      [req.params.id]
    );
    if (!solicitud[0]) {
      await cliente.query('ROLLBACK');
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    if (solicitud[0].estado !== 'pendiente') {
      await cliente.query('ROLLBACK');
      return res.status(409).json({ error: 'Esta solicitud ya se revisó' });
    }
    const s = solicitud[0];

    const { rows: nuevo } = await cliente.query(
      `INSERT INTO deportistas
         (nombre, apellidos, fecha_nacimiento, numero_socio, nombre_deportivo, dni, email,
          telefono_padre, telefono_madre, telefono_deportista)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [
        s.nombre, s.apellidos, fechaNacimiento, numeroSocio || null, nombreDeportivo || null,
        dni || null, s.email || null, telefonoPadre || null, telefonoMadre || null, s.telefono || null,
      ]
    );
    const deportistaId = nuevo[0].id;

    await cliente.query(
      'INSERT INTO deportista_deportes (deportista_id, deporte_id, tipo_deportista) VALUES ($1, $2, $3)',
      [deportistaId, s.deporte_id, tipoDeportista || null]
    );

    await cliente.query(
      `INSERT INTO deportista_equipo_temporada (deportista_id, equipo_id, temporada_id, dorsal)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (deportista_id, equipo_id, temporada_id) DO UPDATE SET dorsal = COALESCE(EXCLUDED.dorsal, deportista_equipo_temporada.dorsal)`,
      [deportistaId, s.equipo_id, temporadaId, dorsal ?? null]
    );

    await cliente.query(
      `UPDATE solicitudes_alta SET estado = 'aprobada', deportista_id = $1, revisado_por = $2, revisado_en = now()
       WHERE id = $3`,
      [deportistaId, req.usuario.id, req.params.id]
    );

    // Acceso a "Mi app": se crea siempre al aprobar, usando el email que
    // la familia metió al apuntarse (obligatorio desde el formulario
    // público, normalizado aquí). El "if" es solo un resguardo por si la
    // solicitud viniera sin email de alguna otra vía; en el flujo normal
    // no debería saltar. La contraseña se genera siempre.
    let emailFinal = s.email ? s.email.toLowerCase().trim() : '';
    const emailGenerado = !emailFinal;
    if (emailGenerado) {
      emailFinal = `${s.nombre}.${s.apellidos}`
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9.]/g, '')
        + '.' + deportistaId.replace(/-/g, '').slice(-6) + '@adnb-nubapp.es';
    }
    const passwordFinal = generarPasswordAleatoria();
    const passwordHash = await bcrypt.hash(passwordFinal, RONDAS_BCRYPT);

    const { rows: nuevoUsuario } = await cliente.query(
      'INSERT INTO usuarios (email, password_hash, nombre_completo) VALUES ($1, $2, $3) RETURNING id',
      [emailFinal, passwordHash, `${s.nombre} ${s.apellidos}`]
    );
    const usuarioId = nuevoUsuario[0].id;
    const { rows: rolDeportista } = await cliente.query(`SELECT id FROM roles WHERE nombre = 'deportista'`);
    await cliente.query('INSERT INTO usuario_roles (usuario_id, rol_id) VALUES ($1, $2)', [usuarioId, rolDeportista[0].id]);
    await cliente.query('UPDATE deportistas SET usuario_id = $1 WHERE id = $2', [usuarioId, deportistaId]);

    await cliente.query('COMMIT');
    res.json({
      ok: true,
      deportistaId,
      acceso: { email: emailFinal, password: passwordFinal, emailGenerado },
    });
  } catch (err) {
    await cliente.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un deportista o un usuario con ese dato (número de socio o email)' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al aprobar la solicitud' });
  } finally {
    cliente.release();
  }
});

// POST /api/solicitudes/:id/rechazar
router.post('/:id/rechazar', autenticar, requiereRol(...GESTION_DEPORTIVA), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE solicitudes_alta SET estado = 'rechazada', revisado_por = $1, revisado_en = now()
       WHERE id = $2 AND estado = 'pendiente' RETURNING id`,
      [req.usuario.id, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Solicitud no encontrada o ya revisada' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al rechazar la solicitud' });
  }
});

module.exports = router;
