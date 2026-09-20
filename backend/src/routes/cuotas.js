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
const multer = require('multer');
const ExcelJS = require('exceljs');
const pool = require('../config/db');
const { autenticar } = require('../middleware/auth');
const { requiereRol, ACCESO_TOTAL_LECTURA } = require('../middleware/permisos');

// El Excel de la secretaría se procesa en memoria (no hace falta guardarlo
// en disco, es un volcado puntual) y se limita a 10 MB.
const subidaExcel = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Nombres de columna aceptados (en minúsculas, sin acentos) para cada
// campo, porque el Excel de la secretaría no sigue necesariamente los
// mismos nombres que usamos internamente. Si el Excel real usa otras
// cabeceras habrá que añadirlas aquí.
const ALIAS_COLUMNAS = {
  numeroSocio: ['nº socio', 'n socio', 'numero socio', 'num socio', 'socio', 'nº de socio'],
  nombre: ['nombre', 'nombre deportista'],
  apellidos: ['apellidos', 'apellido'],
  nombreCompleto: ['nombre y apellidos', 'deportista', 'nombre completo'],
  concepto: ['concepto', 'cuota', 'descripcion cuota'],
  importe: ['importe', 'cantidad', 'importe pagado', 'pagado', 'euros', 'importe €'],
  fecha: ['fecha', 'fecha pago', 'fecha de pago', 'fecha cobro'],
  formaPago: ['forma de pago', 'forma pago', 'medio de pago', 'metodo de pago'],
  descripcion: ['descripcion', 'observaciones', 'notas'],
};

function normalizarTexto(txt) {
  return String(txt ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim();
}

function detectarColumnas(filaCabecera) {
  const mapa = {};
  filaCabecera.eachCell((celda, colNumero) => {
    const valor = normalizarTexto(celda.value);
    for (const [campo, alias] of Object.entries(ALIAS_COLUMNAS)) {
      if (alias.includes(valor)) mapa[campo] = colNumero;
    }
  });
  return mapa;
}

const FORMAS_PAGO_VALIDAS = ['efectivo', 'domiciliado', 'tpv', 'transferencia'];
function normalizarFormaPago(txt) {
  const n = normalizarTexto(txt);
  if (n.includes('efect')) return 'efectivo';
  if (n.includes('domicil') || n.includes('recibo')) return 'domiciliado';
  if (n.includes('tpv') || n.includes('tarjeta')) return 'tpv';
  if (n.includes('transfer') || n.includes('bizum')) return 'transferencia';
  return FORMAS_PAGO_VALIDAS.includes(n) ? n : 'transferencia';
}

function parsearFechaCelda(valor) {
  if (!valor) return new Date().toISOString().slice(0, 10);
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  const texto = String(valor).trim();
  // admite dd/mm/aaaa, dd-mm-aaaa o aaaa-mm-dd
  const conBarras = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (conBarras) {
    const [, d, m, a] = conBarras;
    return `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  return new Date().toISOString().slice(0, 10);
}

// Extrae texto plano de una celda de ExcelJS, que puede venir como string,
// número, fecha, fórmula ({formula, result}) o texto enriquecido
// ({richText: [...]})
function celdaTexto(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'object') {
    if (Array.isArray(valor.richText)) return valor.richText.map((t) => t.text).join('');
    if (valor.text !== undefined) return String(valor.text);
    if (valor.result !== undefined) return celdaTexto(valor.result);
    if (valor instanceof Date) return valor.toISOString();
  }
  return String(valor);
}

// Importe robusto: admite número directo, "30", "30,00 €" o "1.234,56".
function parsearImporte(valor) {
  if (valor === null || valor === undefined || valor === '') return NaN;
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'object' && valor.result !== undefined) return parsearImporte(valor.result);
  let texto = celdaTexto(valor).replace(/[€\s]/g, '');
  if (texto.includes(',') && texto.includes('.')) texto = texto.replace(/\./g, '').replace(',', '.');
  else if (texto.includes(',')) texto = texto.replace(',', '.');
  return Number(texto);
}

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
    concepto: fila.concepto,
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

// GET /api/cuotas/exportar?temporadaId=&deporteId= - vuelca a un Excel
// (.xlsx) las cuotas y los cobros ya registrados, para llevarlos a
// contabilidad. Dos hojas: "Cuotas" (el mismo resumen que se ve en
// pantalla: facturado/cobrado/pendiente por cuota) y "Pagos cobrados"
// (cada cobro individual ya registrado, con fecha y forma de pago).
router.get('/exportar', autenticar, requiereRol(...ACCESO_TOTAL_LECTURA), async (req, res) => {
  const { temporadaId, deporteId } = req.query;
  if (!temporadaId) return res.status(400).json({ error: 'temporadaId es obligatorio' });
  try {
    const condiciones = ['c.temporada_id = $1'];
    const valores = [temporadaId];
    if (deporteId) {
      valores.push(deporteId);
      condiciones.push(`c.deporte_id = $${valores.length}`);
    }
    const { rows: cuotas } = await pool.query(
      `${CONSULTA_RESUMEN} WHERE ${condiciones.join(' AND ')} ORDER BY d.apellidos, d.nombre`,
      valores
    );
    const { rows: pagos } = await pool.query(
      `SELECT p.fecha, p.descripcion, p.importe, p.forma_pago,
              d.nombre AS deportista_nombre, d.apellidos AS deportista_apellidos, d.numero_socio,
              dep.nombre AS deporte_nombre, c.concepto
       FROM cuotas_pagos p
       JOIN cuotas c ON c.id = p.cuota_id
       JOIN deportistas d ON d.id = c.deportista_id
       JOIN deportes dep ON dep.id = c.deporte_id
       WHERE ${condiciones.join(' AND ')}
       ORDER BY p.fecha DESC`,
      valores
    );

    const libro = new ExcelJS.Workbook();
    libro.creator = 'NUBAPP';
    libro.created = new Date();

    const hojaCuotas = libro.addWorksheet('Cuotas');
    hojaCuotas.columns = [
      { header: 'Deportista', key: 'deportista', width: 28 },
      { header: 'Nº socio', key: 'numeroSocio', width: 10 },
      { header: 'Deporte', key: 'deporte', width: 16 },
      { header: 'Concepto', key: 'concepto', width: 20 },
      { header: 'Importe cuota', key: 'importeCuota', width: 14, style: { numFmt: '#,##0.00 "€"' } },
      { header: 'Importe ropa', key: 'importeRopa', width: 14, style: { numFmt: '#,##0.00 "€"' } },
      { header: 'Otros importes', key: 'otrosImportes', width: 14, style: { numFmt: '#,##0.00 "€"' } },
      { header: 'Total a pagar', key: 'totalAPagar', width: 14, style: { numFmt: '#,##0.00 "€"' } },
      { header: 'Total cobrado', key: 'totalPagado', width: 14, style: { numFmt: '#,##0.00 "€"' } },
      { header: 'Pendiente', key: 'pendiente', width: 14, style: { numFmt: '#,##0.00 "€"' } },
    ];
    hojaCuotas.getRow(1).font = { bold: true };
    for (const c of cuotas.map(filaACuota)) {
      hojaCuotas.addRow({
        deportista: `${c.deportistaNombre} ${c.deportistaApellidos}`,
        numeroSocio: c.numeroSocio || '',
        deporte: c.deporteNombre,
        concepto: c.concepto,
        importeCuota: c.importeCuota,
        importeRopa: c.importeRopa,
        otrosImportes: c.otrosImportes,
        totalAPagar: c.totalAPagar,
        totalPagado: c.totalPagado,
        pendiente: c.pendiente,
      });
    }

    const hojaPagos = libro.addWorksheet('Pagos cobrados');
    hojaPagos.columns = [
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Deportista', key: 'deportista', width: 28 },
      { header: 'Nº socio', key: 'numeroSocio', width: 10 },
      { header: 'Deporte', key: 'deporte', width: 16 },
      { header: 'Concepto', key: 'concepto', width: 20 },
      { header: 'Descripción', key: 'descripcion', width: 24 },
      { header: 'Importe', key: 'importe', width: 12, style: { numFmt: '#,##0.00 "€"' } },
      { header: 'Forma de pago', key: 'formaPago', width: 16 },
    ];
    hojaPagos.getRow(1).font = { bold: true };
    for (const p of pagos) {
      hojaPagos.addRow({
        fecha: p.fecha ? new Date(p.fecha).toISOString().slice(0, 10) : '',
        deportista: `${p.deportista_nombre} ${p.deportista_apellidos}`,
        numeroSocio: p.numero_socio || '',
        deporte: p.deporte_nombre,
        concepto: p.concepto,
        descripcion: p.descripcion || '',
        importe: Number(p.importe),
        formaPago: p.forma_pago,
      });
    }
    const totalRow = hojaPagos.addRow({
      deportista: '', concepto: '', descripcion: 'TOTAL COBRADO',
      importe: pagos.reduce((s, p) => s + Number(p.importe), 0),
    });
    totalRow.font = { bold: true };

    const nombreArchivo = `cuotas_${temporadaId}${deporteId ? `_deporte${deporteId}` : ''}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    await libro.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al exportar las cuotas a Excel' });
  }
});

// POST /api/cuotas/importar - la secretaría lleva los cobros en un Excel
// propio; este endpoint lo sube (multipart, campo "archivo") junto con
// temporadaId y deporteId, y traslada cada fila a la app: busca al
// deportista (por Nº de socio o por nombre+apellidos, sin importar el
// orden ni los acentos), encuentra o crea la cuota correspondiente (por
// concepto) y registra el pago. Si el mismo pago ya se había importado
// antes (misma cuota+fecha+importe) se omite, para poder reimportar el
// mismo Excel sin duplicar cobros. Las filas que no se puedan casar con
// ningún deportista se devuelven en "noEncontrados" para revisarlas a
// mano. Solo administrador (es una operación que mueve dinero real).
function claveNombre(nombre, apellidos) {
  return normalizarTexto(`${nombre} ${apellidos}`).split(/\s+/).filter(Boolean).sort().join(' ');
}

router.post('/importar', autenticar, requiereRol('administrador'), subidaExcel.single('archivo'), async (req, res) => {
  const { temporadaId, deporteId } = req.body;
  if (!req.file) return res.status(400).json({ error: 'Falta el archivo Excel (campo "archivo")' });
  if (!temporadaId || !deporteId) return res.status(400).json({ error: 'temporadaId y deporteId son obligatorios' });

  let libro;
  try {
    libro = new ExcelJS.Workbook();
    await libro.xlsx.load(req.file.buffer);
  } catch (err) {
    return res.status(400).json({ error: 'No se ha podido leer el archivo. ¿Es un .xlsx válido?' });
  }

  const hoja = libro.worksheets[0];
  if (!hoja) return res.status(400).json({ error: 'El Excel no tiene ninguna hoja' });

  const columnas = detectarColumnas(hoja.getRow(1));
  if (!columnas.numeroSocio && !columnas.nombre && !columnas.nombreCompleto) {
    return res.status(400).json({
      error: 'No se reconoce ninguna columna de nombre o número de socio en la primera fila. '
        + 'Columnas que se entienden: "Nº socio", "Nombre" + "Apellidos" (o "Nombre y apellidos"), '
        + '"Concepto", "Importe", "Fecha", "Forma de pago".',
    });
  }
  if (!columnas.importe) {
    return res.status(400).json({ error: 'No se reconoce ninguna columna de importe ("Importe", "Cantidad" o "Pagado").' });
  }

  try {
    const { rows: deportistas } = await pool.query('SELECT id, nombre, apellidos, numero_socio FROM deportistas');
    const porSocio = new Map();
    const porNombre = new Map();
    for (const d of deportistas) {
      if (d.numero_socio) porSocio.set(String(d.numero_socio).trim(), d);
      porNombre.set(claveNombre(d.nombre, d.apellidos), d);
    }

    const resultado = {
      filasProcesadas: 0, pagosCreados: 0, pagosDuplicadosOmitidos: 0, cuotasCreadas: 0, noEncontrados: [],
    };

    const cliente = await pool.connect();
    try {
      for (let numFila = 2; numFila <= hoja.rowCount; numFila++) {
        const fila = hoja.getRow(numFila);
        if (!fila || fila.cellCount === 0) continue;
        const val = (campo) => (columnas[campo] ? fila.getCell(columnas[campo]).value : null);

        const importe = parsearImporte(val('importe'));
        if (!importe || Number.isNaN(importe)) continue; // fila vacía o sin importe: se ignora sin más

        resultado.filasProcesadas++;

        const numeroSocio = celdaTexto(val('numeroSocio')).trim();
        let deportista = numeroSocio ? porSocio.get(numeroSocio) : null;
        if (!deportista) {
          const nombreCompleto = celdaTexto(val('nombreCompleto')).trim();
          const nombre = celdaTexto(val('nombre')).trim();
          const apellidos = celdaTexto(val('apellidos')).trim();
          const clave = nombreCompleto
            ? normalizarTexto(nombreCompleto).split(/\s+/).filter(Boolean).sort().join(' ')
            : (nombre || apellidos) ? claveNombre(nombre, apellidos) : null;
          if (clave) deportista = porNombre.get(clave);
        }

        if (!deportista) {
          resultado.noEncontrados.push({
            fila: numFila,
            texto: numeroSocio
              ? `Nº socio ${numeroSocio}`
              : (celdaTexto(val('nombreCompleto')) || `${celdaTexto(val('nombre'))} ${celdaTexto(val('apellidos'))}`).trim(),
          });
          continue;
        }

        const concepto = (celdaTexto(val('concepto')) || 'Importado de Excel').trim();
        const fecha = parsearFechaCelda(val('fecha'));
        const formaPago = normalizarFormaPago(celdaTexto(val('formaPago')));
        const descripcion = celdaTexto(val('descripcion')).trim() || `Importado de Excel (fila ${numFila})`;

        await cliente.query('BEGIN');
        try {
          const cuotaExistente = await cliente.query(
            'SELECT id FROM cuotas WHERE deportista_id = $1 AND deporte_id = $2 AND temporada_id = $3 AND concepto = $4',
            [deportista.id, deporteId, temporadaId, concepto]
          );
          let cuotaId = cuotaExistente.rows[0]?.id;
          if (!cuotaId) {
            const creada = await cliente.query(
              `INSERT INTO cuotas (deportista_id, deporte_id, temporada_id, concepto, importe_cuota)
               VALUES ($1, $2, $3, $4, $5) RETURNING id`,
              [deportista.id, deporteId, temporadaId, concepto, importe]
            );
            cuotaId = creada.rows[0].id;
            resultado.cuotasCreadas++;
          }

          const pagoExistente = await cliente.query(
            'SELECT 1 FROM cuotas_pagos WHERE cuota_id = $1 AND fecha = $2 AND importe = $3',
            [cuotaId, fecha, importe]
          );
          if (pagoExistente.rows[0]) {
            resultado.pagosDuplicadosOmitidos++;
          } else {
            await cliente.query(
              `INSERT INTO cuotas_pagos (cuota_id, fecha, descripcion, importe, forma_pago, registrado_por)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [cuotaId, fecha, descripcion, importe, formaPago, req.usuario.id]
            );
            resultado.pagosCreados++;
          }
          await cliente.query('COMMIT');
        } catch (err) {
          await cliente.query('ROLLBACK');
          console.error(`Error importando fila ${numFila}:`, err);
          resultado.noEncontrados.push({ fila: numFila, texto: `Error al guardar: ${err.message}` });
        }
      }
    } finally {
      cliente.release();
    }

    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al importar el Excel de cuotas' });
  }
});

// GET /api/cuotas/deportista/:deportistaId - historial de cuotas de UN
// deportista (todas las temporadas), para pintarlo dentro de su ficha.
// Administración/dirección deportiva ven las cuotas de cualquiera; un
// deportista que entra con su propio usuario solo puede ver las SUYAS
// (nunca las de otro), para que pueda consultar en la app lo que tiene
// pendiente y lo que ya ha pagado sin necesitar acceso económico general.
router.get('/deportista/:deportistaId', autenticar, async (req, res) => {
  const { roles, id: usuarioId } = req.usuario;
  try {
    if (!roles.some((r) => ACCESO_TOTAL_LECTURA.includes(r))) {
      const { rows: propio } = await pool.query(
        'SELECT 1 FROM deportistas WHERE id = $1 AND usuario_id = $2',
        [req.params.deportistaId, usuarioId]
      );
      if (!propio[0]) return res.status(403).json({ error: 'No tienes permiso para esto' });
    }
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
// abrir una cuota concreta y gestionarla. Igual que arriba, un deportista
// puede abrir el detalle de SU PROPIA cuota (para ver sus pagos), nunca
// la de otro.
router.get('/:id', autenticar, async (req, res) => {
  const { roles, id: usuarioId } = req.usuario;
  try {
    const { rows } = await pool.query(`${CONSULTA_RESUMEN} WHERE c.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Cuota no encontrada' });
    if (!roles.some((r) => ACCESO_TOTAL_LECTURA.includes(r))) {
      const { rows: propio } = await pool.query(
        'SELECT 1 FROM deportistas WHERE id = $1 AND usuario_id = $2',
        [rows[0].deportista_id, usuarioId]
      );
      if (!propio[0]) return res.status(403).json({ error: 'No tienes permiso para esto' });
    }
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

// POST /api/cuotas - crear una cuota de un deportista en un deporte/temporada.
// Un mismo deportista puede tener varias cuotas del mismo deporte y
// temporada siempre que tengan un "concepto" distinto (ej. "Septiembre",
// "Segundo trimestre", "Liga de pádel") - así se pueden ir dando de alta
// cargos sueltos en vez de una única cuota anual.
router.post('/', autenticar, requiereRol('administrador'), async (req, res) => {
  const {
    deportistaId, deporteId, temporadaId, concepto,
    importeCuota, importeRopa, otrosImportes,
    descuentoCuotaPct, descuentoRopaPct, notas,
  } = req.body;
  if (!deportistaId || !deporteId || !temporadaId) {
    return res.status(400).json({ error: 'deportistaId, deporteId y temporadaId son obligatorios' });
  }
  if (!concepto || !concepto.trim()) {
    return res.status(400).json({ error: 'concepto es obligatorio (ej: Septiembre, Segundo trimestre, Liga de pádel)' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO cuotas (deportista_id, deporte_id, temporada_id, concepto, importe_cuota, importe_ropa,
                            otros_importes, descuento_cuota_pct, descuento_ropa_pct, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        deportistaId, deporteId, temporadaId, concepto.trim(),
        importeCuota || 0, importeRopa || 0, otrosImportes || 0,
        descuentoCuotaPct || 0, descuentoRopaPct || 0, notas || null,
      ]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Este deportista ya tiene una cuota con ese mismo concepto para ese deporte y temporada' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear la cuota' });
  }
});

// POST /api/cuotas/grupal - edición/creación grupal: aplica el mismo
// importe/descuento a varios deportistas de un deporte y temporada a la
// vez, bajo un mismo "concepto" (ej: "toda la plantilla del Cadete paga
// 30€/mes de Septiembre"). Si alguno ya tenía cuota con ese mismo
// concepto se actualiza; si no, se crea una nueva. Usar un concepto
// distinto (ej. "Liga de pádel") crea cuotas nuevas sin tocar las que ya
// existían con otros conceptos.
router.post('/grupal', autenticar, requiereRol('administrador'), async (req, res) => {
  const {
    deportistaIds, deporteId, temporadaId, concepto,
    importeCuota, importeRopa, otrosImportes,
    descuentoCuotaPct, descuentoRopaPct,
  } = req.body;
  if (!Array.isArray(deportistaIds) || deportistaIds.length === 0 || !deporteId || !temporadaId) {
    return res.status(400).json({ error: 'deportistaIds (no vacío), deporteId y temporadaId son obligatorios' });
  }
  if (!concepto || !concepto.trim()) {
    return res.status(400).json({ error: 'concepto es obligatorio (ej: Septiembre, Segundo trimestre, Liga de pádel)' });
  }
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    for (const deportistaId of deportistaIds) {
      await cliente.query(
        `INSERT INTO cuotas (deportista_id, deporte_id, temporada_id, concepto, importe_cuota, importe_ropa,
                              otros_importes, descuento_cuota_pct, descuento_ropa_pct)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (deportista_id, deporte_id, temporada_id, concepto) DO UPDATE SET
           importe_cuota = EXCLUDED.importe_cuota,
           importe_ropa = EXCLUDED.importe_ropa,
           otros_importes = EXCLUDED.otros_importes,
           descuento_cuota_pct = EXCLUDED.descuento_cuota_pct,
           descuento_ropa_pct = EXCLUDED.descuento_ropa_pct`,
        [
          deportistaId, deporteId, temporadaId, concepto.trim(),
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

// PUT /api/cuotas/:id - editar importes/descuentos/concepto/notas de una cuota.
router.put('/:id', autenticar, requiereRol('administrador'), async (req, res) => {
  const {
    importeCuota, importeRopa, otrosImportes,
    descuentoCuotaPct, descuentoRopaPct, concepto, notas,
  } = req.body;
  if (concepto !== undefined && !concepto.trim()) {
    return res.status(400).json({ error: 'El concepto no puede quedar vacío' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE cuotas SET
         importe_cuota = COALESCE($1, importe_cuota),
         importe_ropa = COALESCE($2, importe_ropa),
         otros_importes = COALESCE($3, otros_importes),
         descuento_cuota_pct = COALESCE($4, descuento_cuota_pct),
         descuento_ropa_pct = COALESCE($5, descuento_ropa_pct),
         concepto = COALESCE($6, concepto),
         notas = COALESCE($7, notas)
       WHERE id = $8
       RETURNING id`,
      [importeCuota, importeRopa, otrosImportes, descuentoCuotaPct, descuentoRopaPct, concepto, notas, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Cuota no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe otra cuota de ese deporte y temporada con ese mismo concepto' });
    }
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
