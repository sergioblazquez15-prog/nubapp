// Gestión económica: cuotas por deportista/deporte/temporada, su previsión
// de cobro mes a mes y los pagos reales registrados. Es información
// sensible (dinero), así que solo administración/dirección deportiva
// pueden CONSULTARLA, y solo administrador puede crearla/editarla o
// registrar pagos — igual que ya hacemos con usuarios y roles.
//
// El esquema (tablas cuotas, cuotas_prevision_mensual, cuotas_pagos y la
// vista v_cuotas_resumen) ya existía desde el principio del proyecto en
// database/02_schema_cuotas.sql; este fichero es lo que lo conecta con la
// aplicación de verdad.
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { autenticar } = require('../middleware/auth');
const { requiereRol, ACCESO_TOTAL_LECTURA } = require('../middleware/permisos');

function filaACuota(fila) {
  return {
    id: fila.id,
    deportistaId: fila.deportista_id,
    deporteId: fila.deporte_id,
    temporadaId: fila.temporada_id,
    importeCuota: Number(fila.importe_cuota),
    importeRopa: Number(fila.importe_ropa),
    otrosImportes: Number(fila.otros_importes),
    descuentoCuotaPct: Number(fila.descuento_cuota_pct),
    descuentoRopaPct: Number(fila.descuento_ropa_pct),
    notas: fila.notas,
    totalAPagar: fila.total_a_pagar !== undefined ? Number(fila.total_a_pagar) : undefined,
    totalPagado: fila.total_pagado !== undefined ? Number(fila.total_pagado) : undefined,
    pendiente: fila.pendiente !== undefined ? Number(fila.pendiente) : undefined,
    deportistaNombre: fila.deportista_nombre,
    deportistaApellidos: fila.deportista_apellidos,
    numeroSocio: fila.numero_socio,
    deporteNombre: fila.deporte_nombre,
  };
}

function filaAPago(fila) {
  return {
    id: fila.id,
    cuotaId: fila.cuota_id,
    fecha: fila.fecha,
    descripcion: fila.descripcion,
    importe: Number(fila.importe),
    formaPago: fila.forma_pago,
    registradoPor: fila.registrado_por,
  };
}

const CONSULTA_RESUMEN = `
  SELECT c.*, r.total_a_pagar, r.total_pagado, r.pendiente,
         d.nombre AS deportista_nombre, d.apellidos AS deportista_apellidos, d.numero_socio,
         dep.nombre AS deporte_nombre
  FROM cuotas c
  JOIN v_cuotas_resumen r ON r.cuota_id = c.id
  JOIN deportistas d ON d.id = c.deportista_id
  JOIN deportes dep ON dep.id = c.deporte_id
`;

// GET /api/cuotas?temporadaId=&deporteId= - listado con resumen de cobro,
// para la pantalla general de Cuotas.
router.get('/', autenticar, requiereRol(...ACCESO_TOTAL_LECTURA), async (req, res) => {
  const { temporadaId, deporteId } = req.query;
  const condiciones = [];
  const valores = [];
  if (temporadaId) {
    valores.push(temporadaId);
    condiciones.push(`c.temporada_id = $${valores.length}`);
  }
  if (deporteId) {
    valores.push(deporteId);
    condiciones.push(`c.deporte_id = $${valores.length}`);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  try {
    const { rows } = await pool.query(
      `${CONSULTA_RESUMEN} ${where} ORDER BY d.apellidos, d.nombre`,
      valores
    );
    res.json(rows.map(filaACuota));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar las cuotas' });
  }
});

// GET /api/cuotas/estadisticas?temporadaId= - totales para la vista
// resumida (facturado / cobrado / pendiente, y desglose por deporte).
router.get('/estadisticas', autenticar, requiereRol(...ACCESO_TOTAL_LECTURA), async (req, res) => {
  const { temporadaId } = req.query;
  if (!temporadaId) return res.status(400).json({ error: 'temporadaId es obligatorio' });
  try {
    const totales = await pool.query(
      `SELECT
         COALESCE(SUM(r.total_a_pagar), 0) AS total_facturado,
         COALESCE(SUM(r.total_pagado), 0) AS total_cobrado,
         COALESCE(SUM(r.pendiente), 0) AS total_pendiente,
         COUNT(*) AS num_cuotas,
         COUNT(*) FILTER (WHERE r.pendiente <= 0.001) AS num_al_dia
       FROM v_cuotas_resumen r
       JOIN cuotas c ON c.id = r.cuota_id
       WHERE c.temporada_id = $1`,
      [temporadaId]
    );
    const porDeporte = await pool.query(
      `SELECT dep.id AS deporte_id, dep.nombre AS deporte_nombre,
              COALESCE(SUM(r.total_a_pagar), 0) AS total_facturado,
              COALESCE(SUM(r.total_pagado), 0) AS total_cobrado,
              COALESCE(SUM(r.pendiente), 0) AS total_pendiente
       FROM v_cuotas_resumen r
       JOIN cuotas c ON c.id = r.cuota_id
       JOIN deportes dep ON dep.id = c.deporte_id
       WHERE c.temporada_id = $1
       GROUP BY dep.id, dep.nombre
       ORDER BY dep.nombre`,
      [temporadaId]
    );
    const t = totales.rows[0];
    res.json({
      totalFacturado: Number(t.total_facturado),
      totalCobrado: Number(t.total_cobrado),
      totalPendiente: Number(t.total_pendiente),
      numCuotas: Number(t.num_cuotas),
      numAlDia: Number(t.num_al_dia),
      porDeporte: porDeporte.rows.map((f) => ({
        deporteId: f.deporte_id,
        deporteNombre: f.deporte_nombre,
        totalFacturado: Number(f.total_facturado),
        totalCobrado: Number(f.total_cobrado),
        totalPendiente: Number(f.total_pendiente),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular las estadísticas de cuotas' });
  }
});

// GET /api/cuotas/deportista/:deportistaId - historial de cuotas de UN
// deportista (todas las temporadas), para pintarlo dentro de su ficha.
router.get('/deportista/:deportistaId', autenticar, requiereRol(...ACCESO_TOTAL_LECTURA), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `${CONSULTA_RESUMEN} WHERE c.deportista_id = $1 ORDER BY c.creado_en DESC`,
      [req.params.deportistaId]
    );
    res.json(rows.map(filaACuota));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar el histórico de cuotas' });
  }
});

// GET /api/cuotas/:id - detalle completo (previsión mensual + pagos), para
// abrir una cuota concreta y gestionarla.
router.get('/:id', autenticar, requiereRol(...ACCESO_TOTAL_LECTURA), async (req, res) => {
  try {
    const { rows } = await pool.query(`${CONSULTA_RESUMEN} WHERE c.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Cuota no encontrada' });
    const prevision = await pool.query(
      'SELECT mes, importe FROM cuotas_prevision_mensual WHERE cuota_id = $1 ORDER BY mes',
      [req.params.id]
    );
    const pagos = await pool.query(
      'SELECT * FROM cuotas_pagos WHERE cuota_id = $1 ORDER BY fecha DESC, creado_en DESC',
      [req.params.id]
    );
    res.json({
      ...filaACuota(rows[0]),
      previsionMensual: prevision.rows.map((f) => ({ mes: f.mes, importe: Number(f.importe) })),
      pagos: pagos.rows.map(filaAPago),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar la cuota' });
  }
});

// POST /api/cuotas - crear la cuota de un deportista en un deporte/temporada.
router.post('/', autenticar, requiereRol('administrador'), async (req, res) => {
  const {
    deportistaId, deporteId, temporadaId,
    importeCuota, importeRopa, otrosImportes,
    descuentoCuotaPct, descuentoRopaPct, notas,
  } = req.body;
  if (!deportistaId || !deporteId || !temporadaId) {
    return res.status(400).json({ error: 'deportistaId, deporteId y temporadaId son obligatorios' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO cuotas (deportista_id, deporte_id, temporada_id, importe_cuota, importe_ropa,
                            otros_importes, descuento_cuota_pct, descuento_ropa_pct, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        deportistaId, deporteId, temporadaId,
        importeCuota || 0, importeRopa || 0, otrosImportes || 0,
        descuentoCuotaPct || 0, descuentoRopaPct || 0, notas || null,
      ]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Este deportista ya tiene una cuota para ese deporte y temporada' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear la cuota' });
  }
});

// POST /api/cuotas/grupal - edición/creación grupal: aplica el mismo
// importe/descuento a varios deportistas de un deporte y temporada a la
// vez (ej: "toda la plantilla del Cadete paga 30€/mes este año"). Si ya
// tenían cuota se actualiza; si no, se crea.
router.post('/grupal', autenticar, requiereRol('administrador'), async (req, res) => {
  const {
    deportistaIds, deporteId, temporadaId,
    importeCuota, importeRopa, otrosImportes,
    descuentoCuotaPct, descuentoRopaPct,
  } = req.body;
  if (!Array.isArray(deportistaIds) || deportistaIds.length === 0 || !deporteId || !temporadaId) {
    return res.status(400).json({ error: 'deportistaIds (no vacío), deporteId y temporadaId son obligatorios' });
  }
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    for (const deportistaId of deportistaIds) {
      await cliente.query(
        `INSERT INTO cuotas (deportista_id, deporte_id, temporada_id, importe_cuota, importe_ropa,
                              otros_importes, descuento_cuota_pct, descuento_ropa_pct)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (deportista_id, deporte_id, temporada_id) DO UPDATE SET
           importe_cuota = EXCLUDED.importe_cuota,
           importe_ropa = EXCLUDED.importe_ropa,
           otros_importes = EXCLUDED.otros_importes,
           descuento_cuota_pct = EXCLUDED.descuento_cuota_pct,
           descuento_ropa_pct = EXCLUDED.descuento_ropa_pct`,
        [
          deportistaId, deporteId, temporadaId,
          importeCuota || 0, importeRopa || 0, otrosImportes || 0,
          descuentoCuotaPct || 0, descuentoRopaPct || 0,
        ]
      );
    }
    await cliente.query('COMMIT');
    res.json({ ok: true, actualizadas: deportistaIds.length });
  } catch (err) {
    await cliente.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al aplicar la edición grupal' });
  } finally {
    cliente.release();
  }
});

// PUT /api/cuotas/:id - editar importes/descuentos/notas de una cuota.
router.put('/:id', autenticar, requiereRol('administrador'), async (req, res) => {
  const {
    importeCuota, importeRopa, otrosImportes,
    descuentoCuotaPct, descuentoRopaPct, notas,
  } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE cuotas SET
         importe_cuota = COALESCE($1, importe_cuota),
         importe_ropa = COALESCE($2, importe_ropa),
         otros_importes = COALESCE($3, otros_importes),
         descuento_cuota_pct = COALESCE($4, descuento_cuota_pct),
         descuento_ropa_pct = COALESCE($5, descuento_ropa_pct),
         notas = COALESCE($6, notas)
       WHERE id = $7
       RETURNING id`,
      [importeCuota, importeRopa, otrosImportes, descuentoCuotaPct, descuentoRopaPct, notas, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Cuota no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la cuota' });
  }
});

// PUT /api/cuotas/:id/prevision - fija la previsión de cobro mes a mes
// (array de hasta 12 objetos { mes, importe }). Sustituye la previsión
// anterior por completo, así que el frontend manda siempre los 12 meses.
router.put('/:id/prevision', autenticar, requiereRol('administrador'), async (req, res) => {
  const { meses } = req.body;
  if (!Array.isArray(meses)) return res.status(400).json({ error: 'meses debe ser un array de { mes, importe }' });
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const cuota = await cliente.query('SELECT id FROM cuotas WHERE id = $1', [req.params.id]);
    if (!cuota.rows[0]) {
      await cliente.query('ROLLBACK');
      return res.status(404).json({ error: 'Cuota no encontrada' });
    }
    await cliente.query('DELETE FROM cuotas_prevision_mensual WHERE cuota_id = $1', [req.params.id]);
    for (const m of meses) {
      if (!m || !m.mes) continue;
      await cliente.query(
        'INSERT INTO cuotas_prevision_mensual (cuota_id, mes, importe) VALUES ($1, $2, $3)',
        [req.params.id, m.mes, m.importe || 0]
      );
    }
    await cliente.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await cliente.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al guardar la previsión mensual' });
  } finally {
    cliente.release();
  }
});

// DELETE /api/cuotas/:id - elimina una cuota completa (con sus pagos y
// previsión, por el ON DELETE CASCADE) - solo para corregir un alta hecha
// por error, no para "dar de baja" al deportista de esa cuota.
router.delete('/:id', autenticar, requiereRol('administrador'), async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM cuotas WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Cuota no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la cuota' });
  }
});

// POST /api/cuotas/:id/pagos - registra un pago real (fecha, importe,
// forma de pago). Esto es lo que mueve el "pendiente" de la cuota.
router.post('/:id/pagos', autenticar, requiereRol('administrador'), async (req, res) => {
  const { fecha, descripcion, importe, formaPago } = req.body;
  if (!fecha || !importe || !formaPago) {
    return res.status(400).json({ error: 'fecha, importe y formaPago son obligatorios' });
  }
  const formasValidas = ['efectivo', 'domiciliado', 'tpv', 'transferencia'];
  if (!formasValidas.includes(formaPago)) {
    return res.status(400).json({ error: `formaPago debe ser una de: ${formasValidas.join(', ')}` });
  }
  try {
    const cuota = await pool.query('SELECT id FROM cuotas WHERE id = $1', [req.params.id]);
    if (!cuota.rows[0]) return res.status(404).json({ error: 'Cuota no encontrada' });
    const { rows } = await pool.query(
      `INSERT INTO cuotas_pagos (cuota_id, fecha, descripcion, importe, forma_pago, registrado_por)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [req.params.id, fecha, descripcion || null, importe, formaPago, req.usuario.id]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar el pago' });
  }
});

// DELETE /api/cuotas/pagos/:pagoId - elimina un pago (para corregir un
// registro erróneo, ej. importe o fecha equivocados).
router.delete('/pagos/:pagoId', autenticar, requiereRol('administrador'), async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM cuotas_pagos WHERE id = $1 RETURNING id', [req.params.pagoId]);
    if (!rows[0]) return res.status(404).json({ error: 'Pago no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el pago' });
  }
});

module.exports = router;
