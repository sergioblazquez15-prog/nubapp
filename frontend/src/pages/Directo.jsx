// Directo a pantalla completa — antes era un desplegable dentro de la
// ficha del equipo en Plantillas; ahora es su propia pantalla (fuera del
// layout con menú, ver App.jsx), con los mismos botones que en el boceto
// que aprobó Sergio: marcador grande, cronómetro, convocatoria plegable y
// una acción por botón para no tener que leer nada en mitad del partido.
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const GESTION_DEPORTIVA = ['administrador', 'direccion_deportiva', 'coordinador'];

const ETIQUETAS_EVENTO = {
  gol_propio: 'Gol propio',
  gol_rival: 'Gol rival',
  tarjeta_amarilla_propio: 'Amarilla (propio)',
  tarjeta_amarilla_rival: 'Amarilla (rival)',
  tarjeta_roja_propio: 'Roja (propio)',
  tarjeta_roja_rival: 'Roja (rival)',
  tiro_propio: 'Tiro propio',
  tiro_rival: 'Tiro rival',
  falta_favor: 'Falta a favor',
  falta_contra: 'Falta en contra',
  corner_favor: 'Córner a favor',
  corner_contra: 'Córner en contra',
  posesion_cambio: 'Cambio de posesión',
  otro: 'Otro',
};

function formatoReloj(segundosTotales) {
  const seg = Math.max(0, Math.floor(segundosTotales || 0));
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const ACCIONES_PROPIAS = [
  { tipo: 'gol_propio', etiqueta: 'Gol', icono: '⚽', clase: 'accion-gol' },
  { tipo: 'tiro_propio', etiqueta: 'Tiro', icono: '🎯', clase: 'accion-tiro' },
  { tipo: 'corner_favor', etiqueta: 'Córner', icono: '🚩', clase: 'accion-corner' },
  { tipo: 'falta_favor', etiqueta: 'Falta a favor', icono: '⚠️', clase: 'accion-falta' },
  { tipo: 'tarjeta_amarilla_propio', etiqueta: 'Amarilla', icono: '🟨', clase: 'accion-amarilla' },
  { tipo: 'tarjeta_roja_propio', etiqueta: 'Roja', icono: '🟥', clase: 'accion-roja' },
];
const ACCIONES_RIVAL = [
  { tipo: 'gol_rival', etiqueta: 'Gol', icono: '⚽', clase: 'accion-gol' },
  { tipo: 'tiro_rival', etiqueta: 'Tiro', icono: '🎯', clase: 'accion-tiro' },
  { tipo: 'corner_contra', etiqueta: 'Córner', icono: '🚩', clase: 'accion-corner' },
  { tipo: 'falta_contra', etiqueta: 'Falta en contra', icono: '⚠️', clase: 'accion-falta' },
  { tipo: 'tarjeta_amarilla_rival', etiqueta: 'Amarilla', icono: '🟨', clase: 'accion-amarilla' },
  { tipo: 'tarjeta_roja_rival', etiqueta: 'Roja', icono: '🟥', clase: 'accion-roja' },
];
const TIPOS_CON_OCASION_CLARA = new Set(['tiro_propio', 'tiro_rival']);
const TIPOS_CON_JUGADOR = new Set([
  'gol_propio', 'tarjeta_amarilla_propio', 'tarjeta_roja_propio',
  'tiro_propio', 'falta_favor', 'falta_contra', 'corner_favor',
]);
const ETIQUETAS_RESUMEN = [
  ['Goles', 'gol_propio', 'gol_rival', false],
  ['Tiros', 'tiro_propio', 'tiro_rival', true],
  ['Córners', 'corner_favor', 'corner_contra', false],
  ['Faltas', 'falta_favor', 'falta_contra', false],
  ['Amarillas', 'tarjeta_amarilla_propio', 'tarjeta_amarilla_rival', false],
  ['Rojas', 'tarjeta_roja_propio', 'tarjeta_roja_rival', false],
];

export default function Directo() {
  const { id: partidoId } = useParams();
  const navigate = useNavigate();
  const { usuario, tieneRol } = useAuth();

  const [equipoId, setEquipoId] = useState(null);
  const [equipoNombre, setEquipoNombre] = useState('');
  const [esPersonalDelEquipo, setEsPersonalDelEquipo] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/partidos/${partidoId}`).then((p) => {
      setEquipoId(p.equipoId);
      return api.get(`/equipos/${p.equipoId}`);
    }).then((eq) => {
      setEquipoNombre(eq.nombre);
      setEsPersonalDelEquipo((eq.personal || []).some((per) => per.usuarioId === usuario?.id));
    }).catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidoId]);

  const puedeGestionar = tieneRol(...GESTION_DEPORTIVA) || esPersonalDelEquipo;

  return (
    <div className="pantalla-directo">
      <div className="pantalla-directo-top">
        <button className="boton-volver-directo" onClick={() => navigate('/partidos')}>‹ Volver a Partidos</button>
        {equipoNombre && <span className="nota" style={{ color: 'rgba(243,239,227,0.7)' }}>{equipoNombre}</span>}
      </div>
      {error && <p className="error" style={{ margin: '16px 22px' }}>{error}</p>}
      {equipoId && (
        <MarcadorDirecto partidoId={partidoId} equipoId={equipoId} puedeGestionar={puedeGestionar} />
      )}
    </div>
  );
}

function MarcadorDirecto({ partidoId, equipoId, puedeGestionar }) {
  const [partido, setPartido] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [convocados, setConvocados] = useState([]);
  const [error, setError] = useState('');
  const [jugadorId, setJugadorId] = useState('');
  const [ocasionClara, setOcasionClara] = useState(false);
  const [mostrarConvocatoria, setMostrarConvocatoria] = useState(false);
  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [, forzarTick] = useState(0);

  async function cargar() {
    try {
      const [p, ev, conv] = await Promise.all([
        api.get(`/partidos/${partidoId}`),
        api.get(`/partidos/${partidoId}/eventos`),
        api.get(`/partidos/${partidoId}/alineacion`),
      ]);
      setPartido(p);
      setEventos(ev);
      setConvocados(conv);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidoId]);

  useEffect(() => {
    if (!partido?.periodoIniciadoEn) return undefined;
    const intervalo = setInterval(() => forzarTick((t) => t + 1), 1000);
    return () => clearInterval(intervalo);
  }, [partido?.periodoIniciadoEn]);

  const segundosParteActual = partido
    ? (partido.periodoSegundosAcumulados || 0) + (partido.periodoIniciadoEn
        ? Math.floor((Date.now() - new Date(partido.periodoIniciadoEn).getTime()) / 1000)
        : 0)
    : 0;

  async function iniciarDirecto(partes) {
    setPartido(await api.put(`/partidos/${partidoId}/directo/iniciar`, { configuracionPartes: partes }));
  }
  async function pausar() {
    setPartido(await api.put(`/partidos/${partidoId}/directo/pausar`, {}));
  }
  async function reanudar() {
    setPartido(await api.put(`/partidos/${partidoId}/directo/reanudar`, {}));
  }
  async function siguienteParte() {
    setPartido(await api.put(`/partidos/${partidoId}/directo/siguiente-parte`, {}));
    setMostrarResumen(true);
  }
  async function anadirParteExtra() {
    const nombre = window.prompt('Nombre de la parte extra (ej: Prórroga 1)', 'Prórroga');
    if (!nombre) return;
    const duracionMin = Number(window.prompt('Duración en minutos', '10'));
    if (!duracionMin) return;
    setPartido(await api.put(`/partidos/${partidoId}/directo/anadir-parte`, { nombre, duracionMin }));
  }
  async function cambiarPosesion(valor) {
    await api.put(`/partidos/${partidoId}/directo/posesion`, { valor });
    await cargar();
  }

  async function registrar(tipo) {
    try {
      const datos = { tipo };
      if (TIPOS_CON_JUGADOR.has(tipo) && jugadorId) datos.deportistaId = jugadorId;
      if (TIPOS_CON_OCASION_CLARA.has(tipo)) datos.ocasionClara = ocasionClara;
      await api.post(`/partidos/${partidoId}/eventos`, datos);
      setJugadorId('');
      setOcasionClara(false);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminarEvento(id) {
    await api.delete(`/partidos/eventos/${id}`);
    await cargar();
  }

  if (error) return <p className="error" style={{ margin: '0 22px' }}>{error}</p>;
  if (!partido) return <p className="cargando" style={{ margin: '0 22px', color: '#f3efe3' }}>Cargando…</p>;

  const finalizado = partido.periodo === 'Finalizado';
  const antesDeEmpezar = !partido.enDirecto && !finalizado;
  const enMarcha = partido.enDirecto && !finalizado;

  return (
    <div className="tarjeta marcador-directo">
      <div className="directo-cabecera">
        <span className="directo-rival">Nosotros vs {partido.rival}</span>
        <span className="directo-marcador">{partido.resultadoPropio ?? 0} - {partido.resultadoRival ?? 0}</span>
        {enMarcha && (
          <span className={`directo-reloj${!partido.periodoIniciadoEn ? ' en-pausa' : ''}`}>
            ⏱ {formatoReloj(segundosParteActual)}
            {partido.minutoActual != null ? ` · min. ${partido.minutoActual}` : ''}
            {!partido.periodoIniciadoEn && ' · pausa'}
          </span>
        )}
        <span className="directo-estado">
          {finalizado ? 'Finalizado' : antesDeEmpezar ? 'Sin empezar' : partido.periodo}
        </span>
      </div>

      <div className="directo-cuerpo">
        {antesDeEmpezar && (
          <AlineacionPartido
            partidoId={partidoId} equipoId={equipoId} puedeGestionar={puedeGestionar}
            convocados={convocados} onGuardado={cargar}
          />
        )}
        {antesDeEmpezar && puedeGestionar && (
          convocados.length > 0
            ? <ConfiguracionDirecto partesIniciales={partido.configuracionPartes} onIniciar={iniciarDirecto} />
            : <p className="nota" style={{ color: 'rgba(243,239,227,0.7)' }}>Añade al menos un convocado a la convocatoria antes de arrancar el directo.</p>
        )}

        {!antesDeEmpezar && (
          <div className="directo-controles">
            <button type="button" className="boton-lesion" onClick={() => setMostrarConvocatoria((v) => !v)}>
              👥 {mostrarConvocatoria ? 'Ocultar convocatoria' : `Convocatoria (${convocados.length})`}
            </button>
            <button type="button" className="boton-lesion" onClick={() => setMostrarResumen((v) => !v)}>
              📊 {mostrarResumen ? 'Ocultar resumen' : 'Ver resumen'}
            </button>
          </div>
        )}
        {!antesDeEmpezar && mostrarConvocatoria && (
          <AlineacionPartido
            partidoId={partidoId} equipoId={equipoId} puedeGestionar={puedeGestionar}
            convocados={convocados} onGuardado={cargar}
          />
        )}
        {!antesDeEmpezar && mostrarResumen && <ResumenDirecto partidoId={partidoId} />}

        {enMarcha && puedeGestionar && (
          <>
            <div className="directo-controles">
              {partido.periodoIniciadoEn ? (
                <button type="button" onClick={pausar}>⏸ Pausar</button>
              ) : (
                <button type="button" onClick={reanudar}>▶ Reanudar</button>
              )}
              <button type="button" className="boton-lesion" onClick={siguienteParte}>⏭ Siguiente parte</button>
              <button type="button" className="boton-lesion" onClick={anadirParteExtra}>+ Parte extra</button>
            </div>

            <div className="directo-posesion">
              <button
                type="button"
                className={`boton-posesion${partido.posesionActual === 'propio' ? ' activa' : ''}`}
                onClick={() => cambiarPosesion('propio')}
              >
                🔵 Posesión nuestra
              </button>
              <button
                type="button"
                className={`boton-posesion${partido.posesionActual === 'rival' ? ' activa' : ''}`}
                onClick={() => cambiarPosesion('rival')}
              >
                ⚪ Posesión rival
              </button>
            </div>

            {convocados.length > 0 && (
              <div className="directo-jugadores">
                <p className="nota" style={{ margin: '0 0 6px', color: 'rgba(243,239,227,0.7)' }}>
                  Jugador de la próxima acción (opcional — se aplica a acciones propias):
                </p>
                <div className="chips-jugadores">
                  {convocados.map((c) => (
                    <button
                      key={c.deportistaId}
                      type="button"
                      className={`chip-jugador${jugadorId === c.deportistaId ? ' activo' : ''}`}
                      onClick={() => setJugadorId(jugadorId === c.deportistaId ? '' : c.deportistaId)}
                    >
                      {c.dorsal != null ? `${c.dorsal} · ` : ''}{c.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="directo-ocasion">
              <label>
                <input type="checkbox" checked={ocasionClara} onChange={(e) => setOcasionClara(e.target.checked)} />
                🎯 Marcar el próximo tiro como ocasión clara
              </label>
            </div>

            <div className="columnas-acciones">
              <div className="columna-acciones">
                <h4>Nosotros</h4>
                <div className="grid-botones-accion">
                  {ACCIONES_PROPIAS.map((a) => (
                    <button
                      key={a.tipo} type="button"
                      className={`boton-accion-directo ${a.clase}`}
                      onClick={() => registrar(a.tipo)}
                    >
                      <span className="icono-accion">{a.icono}</span>
                      {a.etiqueta}
                    </button>
                  ))}
                </div>
              </div>
              <div className="columna-acciones">
                <h4>Rival</h4>
                <div className="grid-botones-accion">
                  {ACCIONES_RIVAL.map((a) => (
                    <button
                      key={a.tipo} type="button"
                      className={`boton-accion-directo ${a.clase}`}
                      onClick={() => registrar(a.tipo)}
                    >
                      <span className="icono-accion">{a.icono}</span>
                      {a.etiqueta}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        <div className="directo-eventos">
          <h3 style={{ fontSize: 14, margin: '12px 0 6px' }}>Eventos</h3>
          {eventos.length === 0 ? (
            <p className="nota" style={{ color: 'rgba(243,239,227,0.7)' }}>Todavía no hay eventos registrados.</p>
          ) : (
            <ul className="lista-eventos-directo">
              {eventos.map((e) => (
                <li key={e.id} className="evento-directo">
                  <span className="minuto-evento">{e.minuto != null ? `${e.minuto}'` : '—'}</span>
                  <span>
                    {ETIQUETAS_EVENTO[e.tipo] || e.tipo}
                    {e.ocasionClara ? ' (ocasión clara)' : ''}
                    {e.deportistaNombre ? ` — ${e.deportistaNombre}` : ''}
                    {e.descripcion ? ` — ${e.descripcion}` : ''}
                  </span>
                  {puedeGestionar && (
                    <button className="boton-enlace" style={{ marginLeft: 'auto' }} onClick={() => eliminarEvento(e.id)}>quitar</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function AlineacionPartido({ partidoId, equipoId, puedeGestionar, convocados, onGuardado }) {
  const [plantilla, setPlantilla] = useState([]);
  const [seleccion, setSeleccion] = useState({});
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.get(`/equipos/${equipoId}`).then((eq) => {
      const lista = eq.deportistas || [];
      setPlantilla(lista);
      const inicial = {};
      lista.forEach((d) => {
        const convocado = convocados.find((c) => c.deportistaId === d.id);
        inicial[d.id] = {
          incluido: !!convocado,
          dorsal: convocado ? (convocado.dorsal ?? '') : (d.dorsal ?? ''),
          titular: convocado ? convocado.titular : true,
        };
      });
      setSeleccion(inicial);
    }).catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipoId]);

  function actualizar(id, campo, valor) {
    setSeleccion((actual) => ({ ...actual, [id]: { ...actual[id], [campo]: valor } }));
  }

  async function guardar() {
    setGuardando(true);
    setError('');
    try {
      const nuevos = Object.entries(seleccion)
        .filter(([, v]) => v.incluido)
        .map(([deportistaId, v]) => ({
          deportistaId,
          dorsal: v.dorsal !== '' ? Number(v.dorsal) : undefined,
          titular: v.titular !== false,
        }));
      await api.put(`/partidos/${partidoId}/alineacion`, { convocados: nuevos });
      await onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!puedeGestionar) {
    return (
      <p className="nota" style={{ color: 'rgba(243,239,227,0.7)' }}>
        Convocados: {convocados.length === 0 ? 'sin definir todavía' : convocados.map((c) => c.nombre).join(', ')}
      </p>
    );
  }

  return (
    <div className="tarjeta" style={{ maxWidth: 'none', margin: '8px 0' }}>
      <h3 style={{ marginTop: 0, fontSize: 15 }}>Convocatoria</h3>
      {plantilla.length === 0 ? (
        <p className="nota">Este equipo todavía no tiene plantilla fichada esta temporada.</p>
      ) : (
        <div className="tabla-scroll" style={{ marginBottom: 12 }}>
          <table className="tabla-usuarios">
            <thead>
              <tr><th></th><th>Jugador</th><th>Dorsal</th><th>Titular</th></tr>
            </thead>
            <tbody>
              {plantilla.map((d) => {
                const v = seleccion[d.id] || {};
                return (
                  <tr key={d.id}>
                    <td><input type="checkbox" checked={!!v.incluido} onChange={(e) => actualizar(d.id, 'incluido', e.target.checked)} /></td>
                    <td>{d.nombre} {d.apellidos}</td>
                    <td>
                      <input
                        type="number" min="0" style={{ maxWidth: 64 }} value={v.dorsal ?? ''}
                        onChange={(e) => actualizar(d.id, 'dorsal', e.target.value)} disabled={!v.incluido}
                      />
                    </td>
                    <td><input type="checkbox" checked={v.titular !== false} onChange={(e) => actualizar(d.id, 'titular', e.target.checked)} disabled={!v.incluido} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <button onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar convocatoria'}</button>
    </div>
  );
}

function ConfiguracionDirecto({ partesIniciales, onIniciar }) {
  const [partes, setPartes] = useState(
    Array.isArray(partesIniciales) && partesIniciales.length > 0
      ? partesIniciales
      : [{ nombre: '1ª parte', duracionMin: 25 }, { nombre: '2ª parte', duracionMin: 25 }]
  );
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  function actualizarParte(indice, campo, valor) {
    setPartes((actuales) => actuales.map((p, i) => (i === indice ? { ...p, [campo]: valor } : p)));
  }
  function anadirParte() {
    setPartes((actuales) => [...actuales, { nombre: `Parte ${actuales.length + 1}`, duracionMin: 10 }]);
  }
  function quitarParte(indice) {
    setPartes((actuales) => actuales.filter((_, i) => i !== indice));
  }

  async function iniciar() {
    if (partes.length === 0 || partes.some((p) => !p.nombre || !p.duracionMin)) {
      setError('Cada parte necesita nombre y duración en minutos');
      return;
    }
    setEnviando(true);
    setError('');
    try {
      await onIniciar(partes.map((p) => ({ nombre: p.nombre, duracionMin: Number(p.duracionMin) })));
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tarjeta" style={{ maxWidth: 'none', margin: '8px 0' }}>
      <h3 style={{ marginTop: 0, fontSize: 15 }}>Partes del partido</h3>
      <p className="nota">Define cuántas partes tiene el partido y la duración de cada una antes de arrancar el directo.</p>
      {partes.map((p, i) => (
        <div key={i} className="barra-filtros" style={{ marginBottom: 8 }}>
          <input value={p.nombre} onChange={(e) => actualizarParte(i, 'nombre', e.target.value)} style={{ flex: 1 }} />
          <input type="number" min="1" value={p.duracionMin} onChange={(e) => actualizarParte(i, 'duracionMin', e.target.value)} style={{ maxWidth: 90 }} />
          <span className="nota">min</span>
          {partes.length > 1 && <button type="button" className="boton-enlace" onClick={() => quitarParte(i)}>quitar</button>}
        </div>
      ))}
      <button type="button" className="boton-lesion" onClick={anadirParte} style={{ marginBottom: 12 }}>+ Añadir parte</button>
      {error && <p className="error">{error}</p>}
      <div>
        <button onClick={iniciar} disabled={enviando}>{enviando ? 'Arrancando…' : '▶ Iniciar directo'}</button>
      </div>
    </div>
  );
}

function ResumenDirecto({ partidoId }) {
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/partidos/${partidoId}/resumen`).then(setResumen).catch((err) => setError(err.message));
  }, [partidoId]);

  if (error) return <p className="error">{error}</p>;
  if (!resumen) return <p className="cargando">Cargando…</p>;

  return (
    <div className="tabla-scroll" style={{ marginBottom: 12 }}>
      <table className="tabla-usuarios">
        <thead><tr><th>Resumen</th><th>Nosotros</th><th>Rival</th></tr></thead>
        <tbody>
          {ETIQUETAS_RESUMEN.map(([etiqueta, tipoPropio, tipoRival, conOcasionClara]) => (
            <tr key={etiqueta}>
              <td>{etiqueta}</td>
              <td>
                {resumen[tipoPropio]?.total || 0}
                {conOcasionClara ? ` (${resumen[tipoPropio]?.ocasionesClaras || 0} claras)` : ''}
              </td>
              <td>
                {resumen[tipoRival]?.total || 0}
                {conOcasionClara ? ` (${resumen[tipoRival]?.ocasionesClaras || 0} claras)` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
