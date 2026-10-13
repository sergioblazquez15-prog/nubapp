// Asistente de 3 pasos para el cambio de temporada. El backend
// (POST /api/temporadas/:id/traspaso) ya existe y hace el trabajo real:
// copia equipos, personal y plantilla (deportistas activos) de una
// temporada a otra sin duplicar nada si se repite. Aquí solo se
// construye la parte visual para no tener que hacerlo a mano con la API.
import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function TraspasoTemporada() {
  const [temporadas, setTemporadas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [paso, setPaso] = useState(0);
  const [mostrarGestion, setMostrarGestion] = useState(false);

  const [origenId, setOrigenId] = useState('');
  const [nombreNueva, setNombreNueva] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [incluirDorsales, setIncluirDorsales] = useState(false);
  const [destinoId, setDestinoId] = useState('');
  const [resultado, setResultado] = useState(null);
  const [enviando, setEnviando] = useState(false);

  function cargarTemporadas() {
    return api.get('/temporadas').then((lista) => {
      setTemporadas(lista);
      return lista;
    });
  }

  useEffect(() => {
    cargarTemporadas().then((lista) => {
      const principal = lista.find((t) => t.esPrincipal) || lista[0];
      if (principal) {
        setOrigenId(principal.id);
        const anioInicio = Number(principal.nombre?.split('/')[0]) + 1 || new Date().getFullYear() + 1;
        setNombreNueva(`${anioInicio}/${anioInicio + 1}`);
        setFechaInicio(`${anioInicio}-09-01`);
        setFechaFin(`${anioInicio + 1}-06-30`);
      }
      setError('');
    }).catch((err) => setError(err.message)).finally(() => setCargando(false));
  }, []);

  async function crearTemporadaYContinuar() {
    if (!nombreNueva || !fechaInicio || !fechaFin) return;
    setEnviando(true);
    setError('');
    try {
      const creada = await api.post('/temporadas', { nombre: nombreNueva, fechaInicio, fechaFin });
      setDestinoId(creada.id);
      setPaso(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarTraspaso() {
    setEnviando(true);
    setError('');
    try {
      const res = await api.post(`/temporadas/${destinoId}/traspaso`, { temporadaOrigenId: origenId, incluirDorsales });
      setResultado(res);
      setPaso(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const nombresPasos = ['Nueva temporada', 'Confirmar traspaso', 'Hecho'];

  return (
    <div className="pantalla-traspaso">
      <div className="cabecera">
        <h1>Traspaso de temporada</h1>
        <button onClick={() => setMostrarGestion((v) => !v)}>
          {mostrarGestion ? 'Cancelar' : '🗓️ Gestionar temporadas'}
        </button>
      </div>
      <p className="subtitulo">Cierra la temporada actual y prepara la siguiente sin perder ningún dato.</p>

      {mostrarGestion && (
        <GestionTemporadas temporadas={temporadas} onCambio={cargarTemporadas} />
      )}

      <div className="pasos-traspaso" style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '16px 0 20px' }}>
        {nombresPasos.map((n, i) => (
          <span key={n} className={`etiqueta-suave ${i === paso ? 'etiqueta-color-1' : ''}`}>
            {i + 1}. {n}
          </span>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      {cargando ? (
        <p className="cargando">Cargando…</p>
      ) : (
        <div className="bloque-ficha">
          {paso === 0 && (
            <>
              <h2>Datos de la nueva temporada</h2>
              <p className="nota" style={{ marginBottom: 12 }}>
                Se traspasarán los equipos, el personal y los deportistas activos de{' '}
                <strong>{temporadas.find((t) => t.id === origenId)?.nombre || '—'}</strong>.
                La temporada actual queda tal cual, solo de lectura para lo histórico.
              </p>
              <label>Temporada de origen</label>
              <select value={origenId} onChange={(e) => setOrigenId(e.target.value)} style={{ marginBottom: 10 }}>
                {temporadas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
              <label>Nombre de la nueva temporada</label>
              <input value={nombreNueva} onChange={(e) => setNombreNueva(e.target.value)} style={{ marginBottom: 10 }} />
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label>Inicio</label>
                  <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Fin</label>
                  <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <input type="checkbox" checked={incluirDorsales} onChange={(e) => setIncluirDorsales(e.target.checked)} />
                Mantener los dorsales del año pasado (si no, empiezan en blanco)
              </label>
              <button onClick={crearTemporadaYContinuar} disabled={enviando} style={{ marginTop: 16 }}>
                {enviando ? 'Creando…' : 'Crear temporada y continuar'}
              </button>
            </>
          )}

          {paso === 1 && (
            <>
              <h2>Confirmar traspaso</h2>
              <p className="nota" style={{ marginBottom: 16 }}>
                Se copiarán los equipos, el personal y la plantilla de <strong>{temporadas.find((t) => t.id === origenId)?.nombre}</strong> a{' '}
                <strong>{nombreNueva}</strong>. Es seguro repetir esta operación: nada se duplica.
              </p>
              <button onClick={confirmarTraspaso} disabled={enviando}>
                {enviando ? 'Traspasando…' : 'Iniciar traspaso'}
              </button>
              <button className="boton-enlace" onClick={() => setPaso(0)} style={{ marginLeft: 10 }}>Atrás</button>
            </>
          )}

          {paso === 2 && resultado && (
            <>
              <h2>Traspaso completado</h2>
              <ul className="lista-dashboard">
                <li>Equipos creados: <strong>{resultado.equiposCreados}</strong></li>
                <li>Equipos que ya existían: <strong>{resultado.equiposYaExistian}</strong></li>
                <li>Personal técnico asignado: <strong>{resultado.personalAsignado}</strong></li>
                <li>Deportistas fichados: <strong>{resultado.deportistasFichados}</strong></li>
              </ul>
              <p className="nota" style={{ marginTop: 12 }}>
                Revisa la nueva temporada en Plantillas y márcala como principal cuando quieras
                empezar a trabajar en ella desde Equipos.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Lista todas las temporadas con corrección de nombre/fechas (por si hubo
// un typo al crearlas), más las dos acciones que ya existían en el
// backend pero no tenían ningún botón en la pantalla: marcar como
// principal (la que se propone al crear equipos nuevos) y cerrarla
// (pasa a ser de solo lectura, histórico).
function GestionTemporadas({ temporadas, onCambio }) {
  const [editandoId, setEditandoId] = useState(null);
  const [error, setError] = useState('');
  const [procesandoId, setProcesandoId] = useState(null);

  async function guardarEdicion(id, datos) {
    setError('');
    try {
      await api.put(`/temporadas/${id}`, datos);
      setEditandoId(null);
      await onCambio();
    } catch (err) {
      setError(err.message);
    }
  }

  async function marcarPrincipal(id) {
    setError('');
    setProcesandoId(id);
    try {
      await api.put(`/temporadas/${id}/principal`);
      await onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesandoId(null);
    }
  }

  async function cerrarTemporada(id, nombre) {
    if (!confirm(`¿Cerrar "${nombre}"? Pasará a ser de solo lectura (histórico). No se puede deshacer desde aquí.`)) return;
    setError('');
    setProcesandoId(id);
    try {
      await api.put(`/temporadas/${id}/cerrar`);
      await onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesandoId(null);
    }
  }

  return (
    <div className="tarjeta" style={{ marginBottom: 20 }}>
      <h2 style={{ marginTop: 0 }}>Temporadas existentes</h2>
      {error && <p className="error">{error}</p>}
      <table className="tabla-usuarios">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Inicio</th>
            <th>Fin</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {temporadas.map((t) => (
            <tr key={t.id}>
              {editandoId === t.id ? (
                <td colSpan={5}>
                  <FormularioEditarTemporada
                    temporada={t}
                    onGuardar={(datos) => guardarEdicion(t.id, datos)}
                    onCancelar={() => setEditandoId(null)}
                  />
                </td>
              ) : (
                <>
                  <td>{t.nombre}</td>
                  <td>{t.fechaInicio?.slice(0, 10)}</td>
                  <td>{t.fechaFin?.slice(0, 10)}</td>
                  <td>
                    {t.esPrincipal && <span className="etiqueta-suave etiqueta-color-1">Principal</span>}
                    {t.cerrada && <span className="etiqueta-suave">Cerrada</span>}
                    {!t.esPrincipal && !t.cerrada && <span className="nota">—</span>}
                  </td>
                  <td className="acciones-fila">
                    <button onClick={() => setEditandoId(t.id)}>✎ Editar</button>
                    {!t.esPrincipal && !t.cerrada && (
                      <button disabled={procesandoId === t.id} onClick={() => marcarPrincipal(t.id)}>
                        Marcar como principal
                      </button>
                    )}
                    {!t.cerrada && (
                      <button className="boton-peligro" disabled={procesandoId === t.id} onClick={() => cerrarTemporada(t.id, t.nombre)}>
                        Cerrar temporada
                      </button>
                    )}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FormularioEditarTemporada({ temporada, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(temporada.nombre || '');
  const [fechaInicio, setFechaInicio] = useState(temporada.fechaInicio?.slice(0, 10) || '');
  const [fechaFin, setFechaFin] = useState(temporada.fechaFin?.slice(0, 10) || '');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!nombre.trim() || !fechaInicio || !fechaFin) return;
    setError('');
    setEnviando(true);
    try {
      await onGuardar({ nombre: nombre.trim(), fechaInicio, fechaFin });
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  }

  return (
    <form className="barra-filtros" onSubmit={manejarEnvio} style={{ flexWrap: 'wrap' }}>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required />
      <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} required />
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar'}</button>
      <button type="button" onClick={onCancelar} disabled={enviando}>Cancelar</button>
    </form>
  );
}
