// Gestión económica: cuotas por deportista/deporte/temporada, con su
// previsión de cobro mes a mes y los pagos reales. Solo entra quien tiene
// acceso a información económica (administrador y dirección deportiva);
// dar de alta cuotas, editarlas o registrar pagos es solo de administrador
// (igual que el resto de operaciones sensibles de la app).
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { BarraCuota, BarraCuotaMini } from '../components/BarraCuota';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const FORMAS_PAGO = ['efectivo', 'domiciliado', 'tpv', 'transferencia'];

function euros(valor) {
  return `${Number(valor || 0).toFixed(2)} €`;
}


export default function Cuotas() {
  const { tieneRol } = useAuth();
  const puedeGestionar = tieneRol('administrador');

  const [temporadas, setTemporadas] = useState([]);
  const [temporadaId, setTemporadaId] = useState('');
  const [deportes, setDeportes] = useState([]);
  const [deporteFiltro, setDeporteFiltro] = useState('');

  const [cuotas, setCuotas] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [mostrarGrupal, setMostrarGrupal] = useState(false);
  const [cuotaAbiertaId, setCuotaAbiertaId] = useState(null);

  useEffect(() => {
    api.get('/deportes').then(setDeportes).catch(() => {});
    api.get('/temporadas').then((lista) => {
      setTemporadas(lista);
      const principal = lista.find((t) => t.esPrincipal) || lista[0];
      if (principal) setTemporadaId(principal.id);
    }).catch((err) => setError(err.message));
  }, []);

  async function cargarDatos() {
    if (!temporadaId) return;
    setCargando(true);
    try {
      const parametros = new URLSearchParams({ temporadaId });
      if (deporteFiltro) parametros.set('deporteId', deporteFiltro);
      const [listaCuotas, stats] = await Promise.all([
        api.get(`/cuotas?${parametros.toString()}`),
        api.get(`/cuotas/estadisticas?temporadaId=${temporadaId}`),
      ]);
      setCuotas(listaCuotas);
      setEstadisticas(stats);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temporadaId, deporteFiltro]);

  async function crearCuota(datos) {
    await api.post('/cuotas', { ...datos, temporadaId });
    setMostrarNueva(false);
    cargarDatos();
  }

  async function aplicarGrupal(datos) {
    await api.post('/cuotas/grupal', { ...datos, temporadaId });
    setMostrarGrupal(false);
    cargarDatos();
  }

  async function eliminarCuota(id) {
    if (!confirm('¿Eliminar esta cuota? Se borran también sus pagos y su previsión. Pensado solo para corregir un alta hecha por error.')) return;
    await api.delete(`/cuotas/${id}`);
    cargarDatos();
  }

  if (cuotaAbiertaId) {
    return (
      <DetalleCuota
        cuotaId={cuotaAbiertaId}
        puedeGestionar={puedeGestionar}
        onVolver={() => {
          setCuotaAbiertaId(null);
          cargarDatos();
        }}
      />
    );
  }

  return (
    <div className="pantalla-cuotas">
      <div className="cabecera">
        <h1>Gestión económica — Cuotas</h1>
        {puedeGestionar && (
          <div className="acciones-fila">
            <button onClick={() => { setMostrarGrupal((v) => !v); setMostrarNueva(false); }}>
              {mostrarGrupal ? 'Cancelar' : 'Edición grupal'}
            </button>
            <button onClick={() => { setMostrarNueva((v) => !v); setMostrarGrupal(false); }}>
              {mostrarNueva ? 'Cancelar' : '+ Dar de alta cuota'}
            </button>
          </div>
        )}
      </div>

      <div className="barra-filtros">
        <select value={temporadaId} onChange={(e) => setTemporadaId(e.target.value)}>
          {temporadas.map((t) => (
            <option key={t.id} value={t.id}>{t.nombre}{t.cerrada ? ' (cerrada)' : ''}</option>
          ))}
        </select>
        <select value={deporteFiltro} onChange={(e) => setDeporteFiltro(e.target.value)}>
          <option value="">Todos los deportes</option>
          {deportes.map((d) => (
            <option key={d.id} value={d.id}>{d.nombre}</option>
          ))}
        </select>
      </div>

      {error && <p className="error">{error}</p>}

      {estadisticas && <EstadisticasCuotas estadisticas={estadisticas} />}

      {mostrarNueva && (
        <FormularioNuevaCuota deportes={deportes} onCrear={crearCuota} />
      )}
      {mostrarGrupal && (
        <FormularioEdicionGrupal deportes={deportes} onAplicar={aplicarGrupal} />
      )}

      {cargando ? (
        <p className="cargando">Cargando…</p>
      ) : cuotas.length === 0 ? (
        <p className="nota">No hay cuotas dadas de alta con estos filtros todavía.</p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla-usuarios">
            <thead>
              <tr>
                <th>Deportista</th>
                <th>Nº socio</th>
                <th>Deporte</th>
                <th>Concepto</th>
                <th>Total a pagar</th>
                <th>Pagado</th>
                <th>Pendiente</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cuotas.map((c) => (
                <tr key={c.id}>
                  <td>{c.deportistaNombre} {c.deportistaApellidos}</td>
                  <td>{c.numeroSocio || '—'}</td>
                  <td>{c.deporteNombre}</td>
                  <td>{c.concepto}</td>
                  <td>{euros(c.totalAPagar)}</td>
                  <td>{euros(c.totalPagado)}</td>
                  <td>
                    <div className={c.pendiente > 0.001 ? 'texto-peligro' : ''} style={{ marginBottom: 4 }}>{euros(c.pendiente)}</div>
                    <BarraCuotaMini pagado={c.totalPagado} total={c.totalAPagar} />
                  </td>
                  <td className="acciones-fila">
                    <button className="boton-lesion" onClick={() => setCuotaAbiertaId(c.id)}>
                      {puedeGestionar ? 'Gestionar' : 'Ver detalle'}
                    </button>
                    {puedeGestionar && (
                      <button className="boton-peligro" onClick={() => eliminarCuota(c.id)}>Eliminar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EstadisticasCuotas({ estadisticas: e }) {
  return (
    <div className="tarjeta" style={{ maxWidth: 'none', marginBottom: 20 }}>
      <div className="checkboxes-roles" style={{ gap: 24 }}>
        <div>
          <div className="nota" style={{ fontSize: 12 }}>Facturado</div>
          <strong style={{ fontSize: 20 }}>{euros(e.totalFacturado)}</strong>
        </div>
        <div>
          <div className="nota" style={{ fontSize: 12 }}>Cobrado</div>
          <strong style={{ fontSize: 20 }}>{euros(e.totalCobrado)}</strong>
        </div>
        <div>
          <div className="nota" style={{ fontSize: 12 }}>Pendiente</div>
          <strong className={e.totalPendiente > 0.001 ? 'texto-peligro' : ''} style={{ fontSize: 20 }}>
            {euros(e.totalPendiente)}
          </strong>
        </div>
        <div>
          <div className="nota" style={{ fontSize: 12 }}>Cuotas al día</div>
          <strong style={{ fontSize: 20 }}>{e.numAlDia} / {e.numCuotas}</strong>
        </div>
      </div>
      {e.porDeporte.length > 1 && (
        <div className="tabla-scroll" style={{ marginTop: 12, boxShadow: 'none' }}>
          <table className="tabla-usuarios">
            <thead>
              <tr><th>Deporte</th><th>Facturado</th><th>Cobrado</th><th>Pendiente</th></tr>
            </thead>
            <tbody>
              {e.porDeporte.map((d) => (
                <tr key={d.deporteId}>
                  <td>{d.deporteNombre}</td>
                  <td>{euros(d.totalFacturado)}</td>
                  <td>{euros(d.totalCobrado)}</td>
                  <td className={d.totalPendiente > 0.001 ? 'texto-peligro' : ''}>{euros(d.totalPendiente)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FormularioNuevaCuota({ deportes, onCrear }) {
  const [deporteId, setDeporteId] = useState('');
  const [deportistas, setDeportistas] = useState([]);
  const [deportistaId, setDeportistaId] = useState('');
  const [concepto, setConcepto] = useState('');
  const [importeCuota, setImporteCuota] = useState('');
  const [importeRopa, setImporteRopa] = useState('');
  const [otrosImportes, setOtrosImportes] = useState('');
  const [descuentoCuotaPct, setDescuentoCuotaPct] = useState('');
  const [descuentoRopaPct, setDescuentoRopaPct] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!deporteId) { setDeportistas([]); return; }
    api.get(`/deportistas?deporteId=${deporteId}&estado=activo`).then(setDeportistas).catch(() => {});
  }, [deporteId]);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!deporteId || !deportistaId || !concepto.trim()) return;
    setError('');
    setEnviando(true);
    try {
      await onCrear({
        deportistaId,
        deporteId,
        concepto: concepto.trim(),
        importeCuota: importeCuota ? Number(importeCuota) : 0,
        importeRopa: importeRopa ? Number(importeRopa) : 0,
        otrosImportes: otrosImportes ? Number(otrosImportes) : 0,
        descuentoCuotaPct: descuentoCuotaPct ? Number(descuentoCuotaPct) : 0,
        descuentoRopaPct: descuentoRopaPct ? Number(descuentoRopaPct) : 0,
        notas: notas || undefined,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta formulario-usuario" onSubmit={manejarEnvio}>
      <h3 style={{ margin: 0 }}>Dar de alta una cuota</h3>
      <label>
        Deporte
        <select value={deporteId} onChange={(e) => { setDeporteId(e.target.value); setDeportistaId(''); }} required>
          <option value="" disabled>Selecciona un deporte…</option>
          {deportes.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
      </label>
      <label>
        Deportista
        <select value={deportistaId} onChange={(e) => setDeportistaId(e.target.value)} required disabled={!deporteId}>
          <option value="" disabled>{deporteId ? 'Selecciona un deportista…' : 'Elige antes un deporte'}</option>
          {deportistas.map((d) => <option key={d.id} value={d.id}>{d.nombre} {d.apellidos}</option>)}
        </select>
      </label>
      <label>
        Concepto (ej: Septiembre, Segundo trimestre, Liga de pádel…)
        <input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Septiembre" required />
        <span className="nota" style={{ fontSize: 12 }}>
          Un mismo deportista puede tener varias cuotas del mismo deporte si usas un concepto distinto para cada una.
        </span>
      </label>
      <label>
        Importe cuota (€/mes o total, como lo lleves)
        <input type="number" min="0" step="0.01" value={importeCuota} onChange={(e) => setImporteCuota(e.target.value)} />
      </label>
      <label>
        Importe equipación
        <input type="number" min="0" step="0.01" value={importeRopa} onChange={(e) => setImporteRopa(e.target.value)} />
      </label>
      <label>
        Otros importes (derramas, etc.)
        <input type="number" min="0" step="0.01" value={otrosImportes} onChange={(e) => setOtrosImportes(e.target.value)} />
      </label>
      <label>
        Descuento sobre la cuota (%)
        <input type="number" min="0" max="100" step="0.01" value={descuentoCuotaPct} onChange={(e) => setDescuentoCuotaPct(e.target.value)} />
      </label>
      <label>
        Descuento sobre la equipación (%)
        <input type="number" min="0" max="100" step="0.01" value={descuentoRopaPct} onChange={(e) => setDescuentoRopaPct(e.target.value)} />
      </label>
      <label>
        Notas (opcional)
        <input value={notas} onChange={(e) => setNotas(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={enviando}>{enviando ? 'Creando…' : 'Crear cuota'}</button>
    </form>
  );
}

function FormularioEdicionGrupal({ deportes, onAplicar }) {
  const [deporteId, setDeporteId] = useState('');
  const [deportistas, setDeportistas] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [concepto, setConcepto] = useState('');
  const [importeCuota, setImporteCuota] = useState('');
  const [importeRopa, setImporteRopa] = useState('');
  const [otrosImportes, setOtrosImportes] = useState('');
  const [descuentoCuotaPct, setDescuentoCuotaPct] = useState('');
  const [descuentoRopaPct, setDescuentoRopaPct] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setSeleccionados([]);
    if (!deporteId) { setDeportistas([]); return; }
    api.get(`/deportistas?deporteId=${deporteId}&estado=activo`).then(setDeportistas).catch(() => {});
  }, [deporteId]);

  function alternar(id) {
    setSeleccionados((actuales) => (actuales.includes(id) ? actuales.filter((x) => x !== id) : [...actuales, id]));
  }

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!deporteId || seleccionados.length === 0 || !concepto.trim()) return;
    setError('');
    setEnviando(true);
    try {
      await onAplicar({
        deportistaIds: seleccionados,
        deporteId,
        concepto: concepto.trim(),
        importeCuota: importeCuota ? Number(importeCuota) : 0,
        importeRopa: importeRopa ? Number(importeRopa) : 0,
        otrosImportes: otrosImportes ? Number(otrosImportes) : 0,
        descuentoCuotaPct: descuentoCuotaPct ? Number(descuentoCuotaPct) : 0,
        descuentoRopaPct: descuentoRopaPct ? Number(descuentoRopaPct) : 0,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta formulario-usuario" style={{ maxWidth: 560 }} onSubmit={manejarEnvio}>
      <h3 style={{ margin: 0 }}>Edición grupal</h3>
      <p className="nota" style={{ margin: 0 }}>
        Aplica el mismo importe y descuento a varios deportistas del mismo deporte a la vez, bajo un mismo
        concepto. Si alguno ya tenía una cuota con ese concepto esta temporada, se actualiza; si no, se crea.
        Usa un concepto distinto para dar de alta un cargo nuevo sin tocar los que ya existían.
      </p>
      <label>
        Deporte
        <select value={deporteId} onChange={(e) => setDeporteId(e.target.value)} required>
          <option value="" disabled>Selecciona un deporte…</option>
          {deportes.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
      </label>
      <label>
        Concepto (ej: Septiembre, Segundo trimestre, Liga de pádel…)
        <input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Septiembre" required />
      </label>
      {deporteId && (
        <label>
          Deportistas
          <div className="checkboxes-roles">
            {deportistas.length === 0 && <span className="nota">Sin deportistas activos en este deporte.</span>}
            {deportistas.map((d) => (
              <label key={d.id}>
                <input type="checkbox" checked={seleccionados.includes(d.id)} onChange={() => alternar(d.id)} />
                {d.nombre} {d.apellidos}
              </label>
            ))}
          </div>
          {deportistas.length > 0 && (
            <button
              type="button"
              className="boton-enlace"
              onClick={() => setSeleccionados(seleccionados.length === deportistas.length ? [] : deportistas.map((d) => d.id))}
            >
              {seleccionados.length === deportistas.length ? 'Quitar selección' : 'Seleccionar todos'}
            </button>
          )}
        </label>
      )}
      <label>
        Importe cuota
        <input type="number" min="0" step="0.01" value={importeCuota} onChange={(e) => setImporteCuota(e.target.value)} />
      </label>
      <label>
        Importe equipación
        <input type="number" min="0" step="0.01" value={importeRopa} onChange={(e) => setImporteRopa(e.target.value)} />
      </label>
      <label>
        Otros importes
        <input type="number" min="0" step="0.01" value={otrosImportes} onChange={(e) => setOtrosImportes(e.target.value)} />
      </label>
      <label>
        Descuento cuota (%)
        <input type="number" min="0" max="100" step="0.01" value={descuentoCuotaPct} onChange={(e) => setDescuentoCuotaPct(e.target.value)} />
      </label>
      <label>
        Descuento equipación (%)
        <input type="number" min="0" max="100" step="0.01" value={descuentoRopaPct} onChange={(e) => setDescuentoRopaPct(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={enviando || seleccionados.length === 0}>
        {enviando ? 'Aplicando…' : `Aplicar a ${seleccionados.length || ''} deportista(s)`}
      </button>
    </form>
  );
}

// ---------- detalle de una cuota: importes, previsión mensual y pagos ----------

function DetalleCuota({ cuotaId, puedeGestionar, onVolver }) {
  const [cuota, setCuota] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  async function cargar() {
    setCargando(true);
    try {
      setCuota(await api.get(`/cuotas/${cuotaId}`));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuotaId]);

  async function guardarImportes(datos) {
    await api.put(`/cuotas/${cuotaId}`, datos);
    cargar();
  }

  async function guardarPrevision(meses) {
    await api.put(`/cuotas/${cuotaId}/prevision`, { meses });
    cargar();
  }

  async function registrarPago(datos) {
    await api.post(`/cuotas/${cuotaId}/pagos`, datos);
    cargar();
  }

  async function eliminarPago(pagoId) {
    if (!confirm('¿Eliminar este pago?')) return;
    await api.delete(`/cuotas/pagos/${pagoId}`);
    cargar();
  }

  if (cargando) return <p className="cargando">Cargando…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!cuota) return null;

  return (
    <div className="pantalla-cuota-detalle">
      <button className="boton-enlace" onClick={onVolver}>‹ Volver a cuotas</button>

      <div className="cabecera">
        <h1>{cuota.deportistaNombre} {cuota.deportistaApellidos} · {cuota.deporteNombre} · {cuota.concepto}</h1>
      </div>

      <div className="checkboxes-roles" style={{ gap: 24, marginBottom: 8 }}>
        <div><div className="nota" style={{ fontSize: 12 }}>Total a pagar</div><strong>{euros(cuota.totalAPagar)}</strong></div>
        <div><div className="nota" style={{ fontSize: 12 }}>Pagado</div><strong>{euros(cuota.totalPagado)}</strong></div>
        <div>
          <div className="nota" style={{ fontSize: 12 }}>Pendiente</div>
          <strong className={cuota.pendiente > 0.001 ? 'texto-peligro' : ''}>{euros(cuota.pendiente)}</strong>
        </div>
      </div>
      <BarraCuota pagado={cuota.totalPagado} total={cuota.totalAPagar} />

      <h2>Importes y descuentos</h2>
      {puedeGestionar ? (
        <FormularioImportes cuota={cuota} onGuardar={guardarImportes} />
      ) : (
        <p className="nota">
          Cuota {euros(cuota.importeCuota)} · Equipación {euros(cuota.importeRopa)} · Otros {euros(cuota.otrosImportes)}
          {(cuota.descuentoCuotaPct > 0 || cuota.descuentoRopaPct > 0) && ' · con descuento aplicado'}
        </p>
      )}

      <h2>Previsión de cobro mensual</h2>
      {puedeGestionar ? (
        <PrevisionMensual previsionInicial={cuota.previsionMensual} onGuardar={guardarPrevision} />
      ) : (
        <p className="nota">Consulta con administración para ver la previsión mes a mes.</p>
      )}

      <h2>Pagos registrados</h2>
      {cuota.pagos.length === 0 ? (
        <p className="nota">Todavía no hay ningún pago registrado.</p>
      ) : (
        <div className="tabla-scroll" style={{ marginBottom: 16 }}>
          <table className="tabla-usuarios">
            <thead>
              <tr><th>Fecha</th><th>Descripción</th><th>Importe</th><th>Forma de pago</th>{puedeGestionar && <th></th>}</tr>
            </thead>
            <tbody>
              {cuota.pagos.map((p) => (
                <tr key={p.id}>
                  <td>{p.fecha?.slice(0, 10)}</td>
                  <td>{p.descripcion || '—'}</td>
                  <td>{euros(p.importe)}</td>
                  <td>{p.formaPago}</td>
                  {puedeGestionar && (
                    <td><button className="boton-peligro" onClick={() => eliminarPago(p.id)}>Eliminar</button></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {puedeGestionar && <FormularioPago onRegistrar={registrarPago} />}
    </div>
  );
}

function FormularioImportes({ cuota, onGuardar }) {
  const [campos, setCampos] = useState({
    importeCuota: cuota.importeCuota,
    importeRopa: cuota.importeRopa,
    otrosImportes: cuota.otrosImportes,
    descuentoCuotaPct: cuota.descuentoCuotaPct,
    descuentoRopaPct: cuota.descuentoRopaPct,
    concepto: cuota.concepto || '',
    notas: cuota.notas || '',
  });
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  function actualizar(campo, valor) {
    setCampos((actuales) => ({ ...actuales, [campo]: valor }));
    setGuardado(false);
  }

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!campos.concepto.trim()) return;
    setGuardando(true);
    try {
      await onGuardar({
        importeCuota: Number(campos.importeCuota) || 0,
        importeRopa: Number(campos.importeRopa) || 0,
        otrosImportes: Number(campos.otrosImportes) || 0,
        descuentoCuotaPct: Number(campos.descuentoCuotaPct) || 0,
        descuentoRopaPct: Number(campos.descuentoRopaPct) || 0,
        concepto: campos.concepto.trim(),
        notas: campos.notas,
      });
      setGuardado(true);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="tarjeta formulario-usuario" onSubmit={manejarEnvio}>
      <label>
        Concepto
        <input value={campos.concepto} onChange={(e) => actualizar('concepto', e.target.value)} required />
      </label>
      <label>
        Importe cuota
        <input type="number" min="0" step="0.01" value={campos.importeCuota} onChange={(e) => actualizar('importeCuota', e.target.value)} />
      </label>
      <label>
        Importe equipación
        <input type="number" min="0" step="0.01" value={campos.importeRopa} onChange={(e) => actualizar('importeRopa', e.target.value)} />
      </label>
      <label>
        Otros importes
        <input type="number" min="0" step="0.01" value={campos.otrosImportes} onChange={(e) => actualizar('otrosImportes', e.target.value)} />
      </label>
      <label>
        Descuento cuota (%)
        <input type="number" min="0" max="100" step="0.01" value={campos.descuentoCuotaPct} onChange={(e) => actualizar('descuentoCuotaPct', e.target.value)} />
      </label>
      <label>
        Descuento equipación (%)
        <input type="number" min="0" max="100" step="0.01" value={campos.descuentoRopaPct} onChange={(e) => actualizar('descuentoRopaPct', e.target.value)} />
      </label>
      <label>
        Notas
        <input value={campos.notas} onChange={(e) => actualizar('notas', e.target.value)} />
      </label>
      <button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
      {guardado && !guardando && <p className="nota">Guardado.</p>}
    </form>
  );
}

function PrevisionMensual({ previsionInicial, onGuardar }) {
  const inicial = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const existente = previsionInicial.find((m) => m.mes === mes);
    return existente ? existente.importe : '';
  });
  const [importes, setImportes] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  function actualizarMes(indice, valor) {
    setImportes((actuales) => actuales.map((v, i) => (i === indice ? valor : v)));
    setGuardado(false);
  }

  async function guardar() {
    setGuardando(true);
    try {
      await onGuardar(importes.map((importe, i) => ({ mes: i + 1, importe: importe ? Number(importe) : 0 })));
      setGuardado(true);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="valoraciones-grid">
        {MESES.map((nombreMes, i) => (
          <label key={nombreMes}>
            {nombreMes}
            <input type="number" min="0" step="0.01" value={importes[i]} onChange={(e) => actualizarMes(i, e.target.value)} />
          </label>
        ))}
      </div>
      <button type="button" onClick={guardar} disabled={guardando} style={{ marginTop: 10 }}>
        {guardando ? 'Guardando…' : 'Guardar previsión'}
      </button>
      {guardado && !guardando && <span className="nota" style={{ marginLeft: 10 }}>Guardado.</span>}
    </div>
  );
}

function FormularioPago({ onRegistrar }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [descripcion, setDescripcion] = useState('');
  const [importe, setImporte] = useState('');
  const [formaPago, setFormaPago] = useState(FORMAS_PAGO[0]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!fecha || !importe) return;
    setError('');
    setEnviando(true);
    try {
      await onRegistrar({ fecha, descripcion: descripcion || undefined, importe: Number(importe), formaPago });
      setImporte('');
      setDescripcion('');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="barra-filtros" onSubmit={manejarEnvio}>
      <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required title="Fecha del pago" />
      <input
        type="number" min="0" step="0.01" placeholder="Importe" value={importe}
        onChange={(e) => setImporte(e.target.value)} required style={{ maxWidth: 120 }}
      />
      <select value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
        {FORMAS_PAGO.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
      <input placeholder="Descripción (opcional)" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      <button type="submit" disabled={enviando}>{enviando ? 'Registrando…' : 'Registrar pago'}</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
