// Directo a pantalla completa — antes era un desplegable dentro de la
// ficha del equipo en Plantillas; ahora es su propia pantalla (fuera del
// layout con menú, ver App.jsx), con los mismos botones que en el boceto
// que aprobó Sergio: marcador grande, cronómetro, convocatoria plegable y
// una acción por botón para no tener que leer nada en mitad del partido.
//
// v3 (tras usarlo en un partido real): goles con autor y asistencia
// opcional, tarjetas con autor y motivo opcional, cambios (quién entra y
// quién sale), convocatoria con titular/suplente explícito, resumen
// visual con barras comparativas en el descanso, comentario del
// entrenador obligatorio para cerrar el partido e informe imprimible al
// final. También se refresca sola (cada 15s y al volver a la pestaña)
// para que lo que se mete desde un móvil se vea igual en cualquier otro
// dispositivo sin tener que recargar a mano.
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { BotonInforme, CabeceraInforme } from '../components/Informe';

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
  cambio: 'Cambio',
  otro: 'Otro',
};

function formatoReloj(segundosTotales) {
  const seg = Math.max(0, Math.floor(segundosTotales || 0));
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Acciones de un solo toque (sin modal): se registran al instante usando,
// si hay uno marcado, el chip de "jugador de la próxima acción". El gol y
// las tarjetas propias llevan su propio modal (abren una ficha para poder
// elegir autor/asistencia/motivo con calma) y el cambio tiene su botón
// aparte, fuera de las dos columnas, porque hace falta elegir dos
// jugadores (quién entra y quién sale).
const ACCIONES_PROPIAS = [
  { tipo: 'gol_propio', etiqueta: 'Gol', icono: '⚽', clase: 'accion-gol', modal: 'gol' },
  { tipo: 'tiro_propio', etiqueta: 'Tiro', icono: '🎯', clase: 'accion-tiro' },
  { tipo: 'corner_favor', etiqueta: 'Córner', icono: '🚩', clase: 'accion-corner' },
  { tipo: 'falta_favor', etiqueta: 'Falta a favor', icono: '⚠️', clase: 'accion-falta' },
  { tipo: 'tarjeta_amarilla_propio', etiqueta: 'Amarilla', icono: '🟨', clase: 'accion-amarilla', modal: 'tarjeta' },
  { tipo: 'tarjeta_roja_propio', etiqueta: 'Roja', icono: '🟥', clase: 'accion-roja', modal: 'tarjeta' },
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
const TIPOS_CON_JUGADOR_DIRECTO = new Set(['tiro_propio', 'falta_favor', 'falta_contra', 'corner_favor']);
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
        <MarcadorDirecto partidoId={partidoId} equipoId={equipoId} equipoNombre={equipoNombre} puedeGestionar={puedeGestionar} />
      )}
    </div>
  );
}

function MarcadorDirecto({ partidoId, equipoId, equipoNombre, puedeGestionar }) {
  const [partido, setPartido] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [convocados, setConvocados] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState('');
  const [jugadorId, setJugadorId] = useState('');
  const [ocasionClara, setOcasionClara] = useState(false);
  const [mostrarConvocatoria, setMostrarConvocatoria] = useState(false);
  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [modal, setModal] = useState(null); // 'gol' | 'tarjeta_amarilla_propio' | 'tarjeta_roja_propio' | 'cambio' | 'cierre'
  const [accionCierre, setAccionCierre] = useState(null); // 'finalizar' | 'siguiente-parte'
  const [, forzarTick] = useState(0);

  async function cargar() {
    try {
      const [p, ev, conv, res] = await Promise.all([
        api.get(`/partidos/${partidoId}`),
        api.get(`/partidos/${partidoId}/eventos`),
        api.get(`/partidos/${partidoId}/alineacion`),
        api.get(`/partidos/${partidoId}/resumen`),
      ]);
      setPartido(p);
      setEventos(ev);
      setConvocados(conv);
      setResumen(res);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidoId]);

  // Sincronización entre dispositivos: esta pantalla no lleva websockets,
  // así que si el partido se está llevando desde el móvil, cualquier otra
  // pantalla abierta (p.ej. el ordenador) se queda con los datos de cuando
  // entró hasta que se refresca. Para que eso no pase, se refresca sola
  // cada 15s mientras el directo está en marcha y, además, en cuanto la
  // pestaña vuelve a estar visible o recupera el foco (así si se deja
  // abierta de un partido anterior, al volver a mirarla se pone al día al
  // momento sin tener que recargar a mano).
  useEffect(() => {
    if (!partido?.enDirecto) return undefined;
    const intervalo = setInterval(cargar, 15000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partido?.enDirecto, partidoId]);

  useEffect(() => {
    function alVolver() {
      if (document.visibilityState === 'visible') cargar();
    }
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
    };
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
  const partes = partido?.configuracionPartes;
  const esUltimaParte = Array.isArray(partes) && partido?.parteActualIndice != null
    && partido.parteActualIndice + 1 >= partes.length;

  function pedirSiguienteParte() {
    if (esUltimaParte) {
      setAccionCierre('siguiente-parte');
      setModal('cierre');
    } else {
      siguienteParte();
    }
  }
  async function siguienteParte(comentarioCierre) {
    setPartido(await api.put(`/partidos/${partidoId}/directo/siguiente-parte`, comentarioCierre ? { comentarioCierre } : {}));
    setModal(null);
    setMostrarResumen(true);
    await cargar();
  }
  function pedirFinalizarAhora() {
    setAccionCierre('finalizar');
    setModal('cierre');
  }
  async function finalizarPartidoAhora(comentarioCierre) {
    setPartido(await api.put(`/partidos/${partidoId}/directo/finalizar`, { comentarioCierre }));
    setModal(null);
    setMostrarResumen(true);
    await cargar();
  }
  async function confirmarCierre(comentarioCierre) {
    if (accionCierre === 'finalizar') await finalizarPartidoAhora(comentarioCierre);
    else await siguienteParte(comentarioCierre);
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

  async function registrar(tipo, extra = {}) {
    try {
      const datos = { tipo, ...extra };
      if (TIPOS_CON_JUGADOR_DIRECTO.has(tipo) && jugadorId) datos.deportistaId = jugadorId;
      if (TIPOS_CON_OCASION_CLARA.has(tipo)) datos.ocasionClara = ocasionClara;
      await api.post(`/partidos/${partidoId}/eventos`, datos);
      setJugadorId('');
      setOcasionClara(false);
      setModal(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  function abrirAccion(accion) {
    if (accion.modal === 'gol') setModal('gol');
    else if (accion.modal === 'tarjeta') setModal(accion.tipo);
    else registrar(accion.tipo);
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
    <>
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
              partidoId={partidoId} equipoId={equipoId} temporadaId={partido.temporadaId} puedeGestionar={puedeGestionar}
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
              {finalizado && <BotonInforme titulo={`partido vs ${partido.rival}`} className="boton-lesion" />}
            </div>
          )}
          {!antesDeEmpezar && mostrarConvocatoria && (
            <AlineacionPartido
              partidoId={partidoId} equipoId={equipoId} temporadaId={partido.temporadaId} puedeGestionar={puedeGestionar}
              convocados={convocados} onGuardado={cargar}
            />
          )}
          {!antesDeEmpezar && mostrarResumen && <ResumenDirecto resumen={resumen} />}

          {finalizado && partido.comentarioCierre && (
            <div className="nota" style={{ background: 'var(--color-superficie-alt)', color: 'var(--color-texto)', padding: 10, borderRadius: 8, marginBottom: 14, fontStyle: 'italic' }}>
              📝 Comentario del entrenador: {partido.comentarioCierre}
            </div>
          )}

          {enMarcha && puedeGestionar && (
            <>
              <div className="directo-controles">
                {partido.periodoIniciadoEn ? (
                  <button type="button" onClick={pausar}>⏸ Pausar</button>
                ) : (
                  <button type="button" onClick={reanudar}>▶ Reanudar</button>
                )}
                <button type="button" className="boton-lesion" onClick={pedirSiguienteParte}>⏭ Siguiente parte</button>
                <button type="button" className="boton-lesion" onClick={anadirParteExtra}>+ Parte extra</button>
                <button type="button" className="boton-peligro" onClick={pedirFinalizarAhora}>⏹ Finalizar partido ahora</button>
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
                    Jugador de la próxima acción (opcional — tiros, córners y faltas a favor):
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
                        onClick={() => abrirAccion(a)}
                      >
                        <span className="icono-accion">{a.icono}</span>
                        {a.etiqueta}
                      </button>
                    ))}
                    <button type="button" className="boton-accion-directo accion-cambio" onClick={() => setModal('cambio')}>
                      <span className="icono-accion">🔄</span>
                      Cambio
                    </button>
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
                {eventos.slice().reverse().map((e) => (
                  <li key={e.id} className="evento-directo">
                    <span className="minuto-evento">{e.minuto != null ? `${e.minuto}'` : '—'}</span>
                    <span>{descripcionEvento(e)}</span>
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

      {modal === 'gol' && (
        <ModalEventoConJugador
          titulo="Gol"
          convocados={convocados}
          campos={[
            { clave: 'deportistaId', etiqueta: '¿Quién lo mete?', opcional: true },
            { clave: 'asistenciaDeportistaId', etiqueta: '¿Asistencia? (opcional, no siempre la hay)', opcional: true },
          ]}
          onConfirmar={(valores) => registrar('gol_propio', valores)}
          onCerrar={() => setModal(null)}
        />
      )}
      {(modal === 'tarjeta_amarilla_propio' || modal === 'tarjeta_roja_propio') && (
        <ModalEventoConJugador
          titulo={modal === 'tarjeta_amarilla_propio' ? 'Tarjeta amarilla' : 'Tarjeta roja'}
          convocados={convocados}
          campos={[{ clave: 'deportistaId', etiqueta: '¿Quién la recibe?', opcional: true }]}
          campoTexto={{ clave: 'descripcion', etiqueta: 'Motivo (opcional)', placeholder: 'Ej: pérdida de tiempo, protesta al árbitro…' }}
          onConfirmar={(valores) => registrar(modal, valores)}
          onCerrar={() => setModal(null)}
        />
      )}
      {modal === 'cambio' && (
        <ModalEventoConJugador
          titulo="Cambio"
          convocados={convocados}
          campos={[
            { clave: 'deportistaSaleId', etiqueta: 'Sale', opcional: true },
            { clave: 'deportistaId', etiqueta: 'Entra', opcional: true },
          ]}
          onConfirmar={(valores) => registrar('cambio', valores)}
          onCerrar={() => setModal(null)}
        />
      )}
      {modal === 'cierre' && (
        <ModalCierrePartido
          onConfirmar={confirmarCierre}
          onCerrar={() => setModal(null)}
        />
      )}

      <InformeDirectoImprimible equipoNombre={equipoNombre} partido={partido} eventos={eventos} convocados={convocados} resumen={resumen} />
    </>
  );
}

// Texto completo de un evento para el feed del directo — antes solo se
// veía esto para los tipos sin jugador; ahora todos los tipos describen
// claramente qué ha pasado (y con quién), no solo el minuto.
function descripcionEvento(e) {
  if (e.tipo === 'cambio') {
    const partes = [];
    if (e.deportistaSaleNombre) partes.push(`sale ${e.deportistaSaleNombre}`);
    if (e.deportistaNombre) partes.push(`entra ${e.deportistaNombre}`);
    return `🔄 Cambio${partes.length ? ' — ' + partes.join(', ') : ''}`;
  }
  let texto = ETIQUETAS_EVENTO[e.tipo] || e.tipo;
  if (e.ocasionClara) texto += ' (ocasión clara)';
  if (e.deportistaNombre) texto += ` — ${e.deportistaNombre}`;
  if (e.asistenciaNombre) texto += ` (asistencia: ${e.asistenciaNombre})`;
  if (e.descripcion) texto += ` — ${e.descripcion}`;
  return texto;
}

// Modal genérico para un evento que necesita elegir uno o dos jugadores
// (y, opcionalmente, un texto libre) antes de registrarse — gol, tarjeta
// propia o cambio. Todos los campos son opcionales: si hace falta se
// puede confirmar sin elegir nada y corregirlo luego borrando el evento.
function ModalEventoConJugador({ titulo, convocados, campos, campoTexto, onConfirmar, onCerrar }) {
  const [valores, setValores] = useState({});
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  function elegir(clave, deportistaId) {
    setValores((actual) => ({ ...actual, [clave]: actual[clave] === deportistaId ? '' : deportistaId }));
  }

  async function confirmar() {
    setEnviando(true);
    try {
      const datos = { ...valores };
      if (campoTexto && texto.trim()) datos[campoTexto.clave] = texto.trim();
      await onConfirmar(datos);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-directo-fondo" onClick={onCerrar}>
      <div className="modal-directo-panel" onClick={(e) => e.stopPropagation()}>
        <h3>{titulo}</h3>
        {convocados.length === 0 && <p className="nota">No hay convocados a los que atribuir esto, pero puedes registrarlo igualmente.</p>}
        {campos.map((campo) => (
          <div key={campo.clave} style={{ marginBottom: 12 }}>
            <p className="nota" style={{ margin: '0 0 6px', fontWeight: 600 }}>{campo.etiqueta}</p>
            <div className="lista-seleccion-jugador">
              {convocados.map((c) => (
                <div
                  key={c.deportistaId}
                  className={`opcion-seleccion-jugador${valores[campo.clave] === c.deportistaId ? ' activa' : ''}`}
                  onClick={() => elegir(campo.clave, c.deportistaId)}
                >
                  {c.dorsal != null ? `${c.dorsal} · ` : ''}{c.nombre} {c.apellidos}
                </div>
              ))}
            </div>
          </div>
        ))}
        {campoTexto && (
          <label style={{ display: 'block', marginBottom: 4 }}>
            {campoTexto.etiqueta}
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={campoTexto.placeholder} />
          </label>
        )}
        <div className="acciones-fila">
          <button type="button" onClick={onCerrar} disabled={enviando}>Cancelar</button>
          <button type="button" onClick={confirmar} disabled={enviando}>{enviando ? 'Guardando…' : 'Registrar'}</button>
        </div>
      </div>
    </div>
  );
}

// Modal de cierre de partido: pide siempre un comentario del entrenador
// antes de dar el partido por finalizado (botón "Finalizar ahora" o
// "Siguiente parte" cuando ya era la última). El botón "Sin comentarios"
// deja constancia explícita de que no hay nada que añadir, en vez de
// dejarlo vacío sin que se sepa si se olvidó o no había nada que decir.
function ModalCierrePartido({ onConfirmar, onCerrar }) {
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function confirmar(valor) {
    setEnviando(true);
    try {
      await onConfirmar(valor);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-directo-fondo" onClick={onCerrar}>
      <div className="modal-directo-panel" onClick={(e) => e.stopPropagation()}>
        <h3>Cerrar el partido</h3>
        <p className="nota">Antes de dar el partido por terminado, deja un comentario para el informe (cómo ha ido, sensaciones, algo que destacar del rival o del equipo…).</p>
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={4}
          placeholder="Comentario del entrenador…"
          autoFocus
          style={{ width: '100%', marginBottom: 12 }}
        />
        <div className="acciones-fila">
          <button type="button" onClick={onCerrar} disabled={enviando}>Cancelar</button>
          <button type="button" className="boton-lesion" onClick={() => confirmar('Sin comentarios.')} disabled={enviando}>Sin comentarios</button>
          <button type="button" className="boton-peligro" onClick={() => confirmar(comentario.trim() || 'Sin comentarios.')} disabled={enviando}>
            {enviando ? 'Finalizando…' : 'Finalizar partido'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AlineacionPartido({ partidoId, equipoId, temporadaId, puedeGestionar, convocados, onGuardado }) {
  const [plantilla, setPlantilla] = useState([]);
  // Jugadores incorporados de OTRO equipo (p.ej. un juvenil que sube a
  // completar al Regional esa semana) — no están en la plantilla propia
  // del equipo de este partido, así que se llevan aparte y se pintan en
  // la misma tabla con una etiqueta de qué equipo son.
  const [extras, setExtras] = useState([]);
  const [seleccion, setSeleccion] = useState({});
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mostrarBuscador, setMostrarBuscador] = useState(false);

  useEffect(() => {
    api.get(`/equipos/${equipoId}`).then((eq) => {
      const lista = eq.deportistas || [];
      setPlantilla(lista);
      const idsPlantilla = new Set(lista.map((d) => d.id));
      const ajenos = convocados.filter((c) => !idsPlantilla.has(c.deportistaId));
      setExtras(ajenos.map((c) => ({
        deportistaId: c.deportistaId, nombre: c.nombre, apellidos: c.apellidos,
        equipoOrigenNombre: c.equipoOrigenNombre,
      })));
      const inicial = {};
      lista.forEach((d) => {
        const convocado = convocados.find((c) => c.deportistaId === d.id);
        inicial[d.id] = {
          incluido: !!convocado,
          dorsal: convocado ? (convocado.dorsal ?? '') : (d.dorsal ?? ''),
          titular: convocado ? convocado.titular : true,
        };
      });
      ajenos.forEach((c) => {
        inicial[c.deportistaId] = { incluido: true, dorsal: c.dorsal ?? '', titular: c.titular };
      });
      setSeleccion(inicial);
    }).catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipoId]);

  function actualizar(id, campo, valor) {
    setSeleccion((actual) => ({ ...actual, [id]: { ...actual[id], [campo]: valor } }));
  }

  function agregarJugadorDeOtroEquipo(jugador) {
    const yaEsta = plantilla.some((d) => d.id === jugador.deportistaId) || extras.some((e) => e.deportistaId === jugador.deportistaId);
    if (!yaEsta) {
      setExtras((actual) => [...actual, {
        deportistaId: jugador.deportistaId, nombre: jugador.nombre, apellidos: jugador.apellidos,
        equipoOrigenNombre: jugador.equipoNombre,
      }]);
    }
    setSeleccion((actual) => ({
      ...actual,
      [jugador.deportistaId]: { incluido: true, dorsal: actual[jugador.deportistaId]?.dorsal ?? (jugador.dorsal ?? ''), titular: false },
    }));
    setMostrarBuscador(false);
  }

  function quitarExtra(id) {
    setExtras((actual) => actual.filter((e) => e.deportistaId !== id));
    setSeleccion((actual) => {
      const copia = { ...actual };
      delete copia[id];
      return copia;
    });
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
        Convocados: {convocados.length === 0 ? 'sin definir todavía' : convocados.map((c) => `${c.nombre}${c.titular === false ? ' (suplente)' : ''}${c.equipoOrigenNombre ? ` (${c.equipoOrigenNombre})` : ''}`).join(', ')}
      </p>
    );
  }

  const incluidos = Object.values(seleccion).filter((v) => v.incluido);
  const totalTitulares = incluidos.filter((v) => v.titular !== false).length;
  const totalSuplentes = incluidos.length - totalTitulares;

  return (
    <div className="tarjeta" style={{ maxWidth: 'none', margin: '8px 0' }}>
      <h3 style={{ marginTop: 0, fontSize: 15 }}>Convocatoria</h3>
      {plantilla.length === 0 && extras.length === 0 ? (
        <p className="nota">Este equipo todavía no tiene plantilla fichada esta temporada.</p>
      ) : (
        <>
          <p className="resumen-convocatoria">
            <span>Convocados: <strong>{incluidos.length}</strong></span>
            <span>Titulares: <strong>{totalTitulares}</strong></span>
            <span>Suplentes: <strong>{totalSuplentes}</strong></span>
          </p>
          <div className="tabla-scroll" style={{ marginBottom: 12 }}>
            <table className="tabla-usuarios">
              <thead>
                <tr><th></th><th>Jugador</th><th>Dorsal</th><th>¿Titular o suplente?</th><th></th></tr>
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
                      <td>
                        <div className="selector-titularidad">
                          <button
                            type="button"
                            className={v.titular !== false ? 'activo-titular' : ''}
                            disabled={!v.incluido}
                            onClick={() => actualizar(d.id, 'titular', true)}
                          >
                            Titular
                          </button>
                          <button
                            type="button"
                            className={v.titular === false ? 'activo-suplente' : ''}
                            disabled={!v.incluido}
                            onClick={() => actualizar(d.id, 'titular', false)}
                          >
                            Suplente
                          </button>
                        </div>
                      </td>
                      <td></td>
                    </tr>
                  );
                })}
                {extras.map((d) => {
                  const v = seleccion[d.deportistaId] || {};
                  return (
                    <tr key={d.deportistaId}>
                      <td><input type="checkbox" checked={!!v.incluido} onChange={(e) => actualizar(d.deportistaId, 'incluido', e.target.checked)} /></td>
                      <td>
                        {d.nombre} {d.apellidos}
                        {' '}<span className="etiqueta-otro-equipo">{d.equipoOrigenNombre || 'otro equipo'}</span>
                      </td>
                      <td>
                        <input
                          type="number" min="0" style={{ maxWidth: 64 }} value={v.dorsal ?? ''}
                          onChange={(e) => actualizar(d.deportistaId, 'dorsal', e.target.value)} disabled={!v.incluido}
                        />
                      </td>
                      <td>
                        <div className="selector-titularidad">
                          <button
                            type="button"
                            className={v.titular !== false ? 'activo-titular' : ''}
                            disabled={!v.incluido}
                            onClick={() => actualizar(d.deportistaId, 'titular', true)}
                          >
                            Titular
                          </button>
                          <button
                            type="button"
                            className={v.titular === false ? 'activo-suplente' : ''}
                            disabled={!v.incluido}
                            onClick={() => actualizar(d.deportistaId, 'titular', false)}
                          >
                            Suplente
                          </button>
                        </div>
                      </td>
                      <td><button type="button" className="boton-enlace" onClick={() => quitarExtra(d.deportistaId)}>quitar</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <button type="button" className="boton-lesion" style={{ marginBottom: 12 }} onClick={() => setMostrarBuscador(true)}>
        + Añadir jugador de otro equipo
      </button>
      {error && <p className="error">{error}</p>}
      <div>
        <button onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar convocatoria'}</button>
      </div>
      {mostrarBuscador && (
        <ModalBuscarJugadorOtroEquipo
          partidoId={partidoId}
          temporadaId={temporadaId}
          onElegir={agregarJugadorDeOtroEquipo}
          onCerrar={() => setMostrarBuscador(false)}
        />
      )}
    </div>
  );
}

// Buscador para incorporar a la convocatoria un jugador que normalmente
// juega en OTRO equipo del club (p.ej. un juvenil que sube a completar al
// Regional esa semana) — por nombre/apellidos y/o filtrando por equipo de
// origen. Ver GET /api/partidos/:id/buscar-jugador en el backend.
function ModalBuscarJugadorOtroEquipo({ partidoId, temporadaId, onElegir, onCerrar }) {
  const [equipos, setEquipos] = useState([]);
  const [q, setQ] = useState('');
  const [equipoFiltroId, setEquipoFiltroId] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!temporadaId) return;
    api.get(`/equipos?temporadaId=${temporadaId}&estado=activo`).then(setEquipos).catch(() => {});
  }, [temporadaId]);

  useEffect(() => {
    if (!q && !equipoFiltroId) { setResultados([]); return undefined; }
    setBuscando(true);
    const temporizador = setTimeout(() => {
      const parametros = new URLSearchParams();
      if (q) parametros.set('q', q);
      if (equipoFiltroId) parametros.set('equipoId', equipoFiltroId);
      api.get(`/partidos/${partidoId}/buscar-jugador?${parametros.toString()}`)
        .then(setResultados)
        .catch((err) => setError(err.message))
        .finally(() => setBuscando(false));
    }, 300);
    return () => clearTimeout(temporizador);
  }, [q, equipoFiltroId, partidoId]);

  return (
    <div className="modal-directo-fondo" onClick={onCerrar}>
      <div className="modal-directo-panel" onClick={(e) => e.stopPropagation()}>
        <h3>Añadir jugador de otro equipo</h3>
        <p className="nota">Busca por nombre/apellido y, si quieres, filtra por el equipo donde juega normalmente.</p>
        <div className="barra-filtros" style={{ marginBottom: 10 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o apellido…" autoFocus style={{ flex: 1 }} />
          <select value={equipoFiltroId} onChange={(e) => setEquipoFiltroId(e.target.value)}>
            <option value="">Todos los equipos</option>
            {equipos.map((eq) => <option key={eq.id} value={eq.id}>{eq.nombre}</option>)}
          </select>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="lista-seleccion-jugador">
          {buscando && <p className="nota" style={{ padding: 8 }}>Buscando…</p>}
          {!buscando && q === '' && equipoFiltroId === '' && (
            <p className="nota" style={{ padding: 8 }}>Escribe un nombre o elige un equipo para empezar a buscar.</p>
          )}
          {!buscando && (q !== '' || equipoFiltroId !== '') && resultados.length === 0 && (
            <p className="nota" style={{ padding: 8 }}>Sin resultados.</p>
          )}
          {resultados.map((r) => (
            <div key={r.deportistaId} className="opcion-seleccion-jugador" onClick={() => onElegir(r)}>
              {r.dorsal != null ? `${r.dorsal} · ` : ''}{r.nombre} {r.apellidos}
              {' '}<span className="etiqueta-otro-equipo">{r.equipoNombre}</span>
            </div>
          ))}
        </div>
        <div className="acciones-fila">
          <button type="button" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
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

// Resumen visual del descanso: una barra comparativa por estadística (en
// vez de solo números en una tabla) para verlo de un vistazo, tal y como
// pidió Sergio. Se mantiene también el detalle numérico al lado de cada
// barra, incluidas las ocasiones claras de los tiros.
function ResumenDirecto({ resumen }) {
  if (!resumen) return <p className="cargando">Cargando…</p>;

  return (
    <div className="resumen-visual">
      {ETIQUETAS_RESUMEN.map(([etiqueta, tipoPropio, tipoRival, conOcasionClara]) => {
        const propio = resumen[tipoPropio]?.total || 0;
        const rival = resumen[tipoRival]?.total || 0;
        const total = propio + rival;
        const pctPropio = total > 0 ? (propio / total) * 100 : 50;
        const pctRival = total > 0 ? 100 - pctPropio : 50;
        return (
          <div key={etiqueta} className="fila-barra-comparativa">
            <div className="etiqueta-barra">
              <span>
                {propio}
                {conOcasionClara ? ` (${resumen[tipoPropio]?.ocasionesClaras || 0} claras)` : ''}
              </span>
              <span>{etiqueta}</span>
              <span>
                {rival}
                {conOcasionClara ? ` (${resumen[tipoRival]?.ocasionesClaras || 0} claras)` : ''}
              </span>
            </div>
            <div className="pista-barra-comparativa">
              <div className="segmento-nosotros" style={{ width: `${pctPropio}%` }} />
              <div className="segmento-rival" style={{ width: `${pctRival}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Informe imprimible del partido (botón "🖨️ Generar informe PDF" junto al
// resumen, una vez finalizado) — siempre en el DOM, oculto en pantalla y
// solo visible al imprimir (ver @media print en global.css), igual que el
// resto de informes de la app (components/Informe.jsx).
function InformeDirectoImprimible({ equipoNombre, partido, eventos, convocados, resumen }) {
  const titulares = convocados.filter((c) => c.titular !== false);
  const suplentes = convocados.filter((c) => c.titular === false);
  const golesPropios = eventos.filter((e) => e.tipo === 'gol_propio');
  const tarjetasPropias = eventos.filter((e) => e.tipo === 'tarjeta_amarilla_propio' || e.tipo === 'tarjeta_roja_propio');
  const cambios = eventos.filter((e) => e.tipo === 'cambio');
  const golesRival = eventos.filter((e) => e.tipo === 'gol_rival').length;
  const tarjetasRival = eventos.filter((e) => e.tipo === 'tarjeta_amarilla_rival' || e.tipo === 'tarjeta_roja_rival').length;

  return (
    <div className="informe-directo-imprimible">
      <CabeceraInforme titulo={`${equipoNombre || 'Nuestro equipo'} vs ${partido.rival}`} subtitulo={partido.fecha?.slice(0, 10)} />
      <p className="resultado-informe-directo">{partido.resultadoPropio ?? 0} - {partido.resultadoRival ?? 0}</p>

      <h3>Convocatoria</h3>
      <p>
        <strong>Titulares:</strong> {titulares.length === 0 ? '—' : titulares.map((c) => `${c.dorsal != null ? c.dorsal + '. ' : ''}${c.nombre} ${c.apellidos}`).join(', ')}
      </p>
      <p>
        <strong>Suplentes:</strong> {suplentes.length === 0 ? '—' : suplentes.map((c) => `${c.dorsal != null ? c.dorsal + '. ' : ''}${c.nombre} ${c.apellidos}`).join(', ')}
      </p>

      <h3>Goles</h3>
      {golesPropios.length === 0 && golesRival === 0 ? <p>No ha habido goles.</p> : (
        <table>
          <tbody>
            {golesPropios.map((e) => (
              <tr key={e.id}>
                <td>{e.minuto != null ? `${e.minuto}'` : '—'}</td>
                <td>⚽ Nosotros — {e.deportistaNombre || 'autor sin especificar'}{e.asistenciaNombre ? ` (asistencia: ${e.asistenciaNombre})` : ''}</td>
              </tr>
            ))}
            {golesRival > 0 && <tr><td colSpan={2}>⚽ Rival — {golesRival} gol{golesRival > 1 ? 'es' : ''}</td></tr>}
          </tbody>
        </table>
      )}

      <h3>Tarjetas</h3>
      {tarjetasPropias.length === 0 && tarjetasRival === 0 ? <p>No ha habido tarjetas.</p> : (
        <table>
          <tbody>
            {tarjetasPropias.map((e) => (
              <tr key={e.id}>
                <td>{e.minuto != null ? `${e.minuto}'` : '—'}</td>
                <td>{e.tipo === 'tarjeta_roja_propio' ? '🟥' : '🟨'} Nosotros — {e.deportistaNombre || 'jugador sin especificar'}{e.descripcion ? ` (${e.descripcion})` : ''}</td>
              </tr>
            ))}
            {tarjetasRival > 0 && <tr><td colSpan={2}>🟨🟥 Rival — {tarjetasRival} tarjeta{tarjetasRival > 1 ? 's' : ''}</td></tr>}
          </tbody>
        </table>
      )}

      <h3>Cambios</h3>
      {cambios.length === 0 ? <p>No ha habido cambios.</p> : (
        <table>
          <tbody>
            {cambios.map((e) => (
              <tr key={e.id}>
                <td>{e.minuto != null ? `${e.minuto}'` : '—'}</td>
                <td>🔄 Sale {e.deportistaSaleNombre || '—'} / Entra {e.deportistaNombre || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Estadísticas</h3>
      <table>
        <thead><tr><th>Nosotros</th><th></th><th>Rival</th></tr></thead>
        <tbody>
          {ETIQUETAS_RESUMEN.map(([etiqueta, tipoPropio, tipoRival]) => (
            <tr key={etiqueta}>
              <td>{resumen?.[tipoPropio]?.total || 0}</td>
              <td>{etiqueta}</td>
              <td>{resumen?.[tipoRival]?.total || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {partido.comentarioCierre && (
        <>
          <h3>Comentario del entrenador</h3>
          <p className="comentario-cierre-informe">{partido.comentarioCierre}</p>
        </>
      )}
    </div>
  );
}
