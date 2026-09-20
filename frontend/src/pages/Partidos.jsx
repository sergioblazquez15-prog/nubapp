// Partidos — sección propia dentro de Dirección deportiva (antes vivía
// dentro de la ficha de cada equipo, en Plantillas). Aquí se ven los
// partidos de todos los equipos de deporte de equipo (fútbol, baloncesto)
// a la vez, con un filtro opcional por equipo, se crean partidos nuevos,
// se importa el calendario desde la RFFM y se entra al Directo — que
// ahora es su propia pantalla completa (ver pages/Directo.jsx), ya no un
// desplegable dentro de la fila.
import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { CabeceraInforme, BotonInforme } from '../components/Informe';

const GESTION_DEPORTIVA = ['administrador', 'direccion_deportiva', 'coordinador'];

function inicialesRival(nombre) {
  return (nombre || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?';
}

export default function Partidos() {
  const { tieneRol } = useAuth();
  const puedeGestionar = tieneRol(...GESTION_DEPORTIVA);

  const [temporadas, setTemporadas] = useState([]);
  const [temporadaId, setTemporadaId] = useState('');
  const [equipos, setEquipos] = useState([]);
  const [equipoFiltroId, setEquipoFiltroId] = useState('');
  const [partidos, setPartidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarImportar, setMostrarImportar] = useState(false);

  useEffect(() => {
    async function inicial() {
      try {
        const listaTemporadas = await api.get('/temporadas');
        setTemporadas(listaTemporadas);
        const principal = listaTemporadas.find((t) => t.esPrincipal) || listaTemporadas[0];
        if (principal) setTemporadaId(principal.id);
      } catch (err) {
        setError(err.message);
      }
    }
    inicial();
  }, []);

  useEffect(() => {
    if (!temporadaId) return;
    api.get(`/equipos?temporadaId=${temporadaId}&estado=activo`)
      .then((lista) => setEquipos(lista.filter((e) => e.deporteTipo === 'equipo')))
      .catch(() => {});
  }, [temporadaId]);

  async function cargarPartidos() {
    if (!temporadaId) return;
    setCargando(true);
    try {
      const parametros = new URLSearchParams({ temporadaId });
      if (equipoFiltroId) parametros.set('equipoId', equipoFiltroId);
      setPartidos(await api.get(`/partidos?${parametros.toString()}`));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarPartidos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temporadaId, equipoFiltroId]);

  async function crearPartido(equipoId, datos) {
    await api.post('/partidos', { ...datos, equipoId, temporadaId });
    setMostrarFormulario(false);
    cargarPartidos();
  }

  async function guardarResultado(partidoId, resultadoPropio, resultadoRival) {
    await api.put(`/partidos/${partidoId}`, { resultadoPropio, resultadoRival });
    cargarPartidos();
  }

  async function eliminarPartido(partidoId) {
    if (!confirm('¿Eliminar este partido?')) return;
    await api.delete(`/partidos/${partidoId}`);
    cargarPartidos();
  }

  return (
    <div className="pantalla-partidos">
      <CabeceraInforme titulo="Informe de partidos" />
      <div className="barra-migas">Dirección deportiva / Partidos</div>
      <div className="cabecera">
        <div>
          <h1>Partidos</h1>
          <p className="subtitulo">Calendario, resultados y directo de todos los equipos de deporte de equipo.</p>
        </div>
        <div className="acciones-fila">
          <BotonInforme titulo="partidos" />
        </div>
      </div>

      <div className="barra-filtros" style={{ marginBottom: 16 }}>
        <select value={temporadaId} onChange={(e) => setTemporadaId(e.target.value)}>
          {temporadas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
        <select value={equipoFiltroId} onChange={(e) => setEquipoFiltroId(e.target.value)}>
          <option value="">Todos los equipos</option>
          {equipos.map((eq) => <option key={eq.id} value={eq.id}>{eq.nombre} — {eq.deporteNombre}</option>)}
        </select>
        {puedeGestionar && (
          <>
            <button onClick={() => setMostrarFormulario((v) => !v)}>
              {mostrarFormulario ? 'Cancelar' : '+ Nuevo partido'}
            </button>
            <button onClick={() => setMostrarImportar((v) => !v)}>
              {mostrarImportar ? 'Cancelar' : '🌐 Importar calendario (RFFM)'}
            </button>
          </>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {mostrarFormulario && (
        <FormularioPartido equipos={equipos} equipoInicialId={equipoFiltroId} onCrear={crearPartido} />
      )}
      {mostrarImportar && (
        <ImportarCalendarioRFFM equipos={equipos} equipoInicialId={equipoFiltroId} temporadaId={temporadaId} onImportado={cargarPartidos} />
      )}

      {cargando ? (
        <p className="cargando">Cargando…</p>
      ) : equipos.length === 0 ? (
        <p className="nota">No tienes equipos de deporte de equipo asignados esta temporada.</p>
      ) : partidos.length === 0 ? (
        <p className="nota">Todavía no hay partidos registrados{equipoFiltroId ? ' para este equipo' : ''}.</p>
      ) : (
        <div className="tabla-partidos">
          {partidos.map((p) => (
            <FilaPartidoLista
              key={p.id}
              partido={p}
              puedeGestionar={puedeGestionar}
              onGuardarResultado={(propio, rival) => guardarResultado(p.id, propio, rival)}
              onEliminar={() => eliminarPartido(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilaPartidoLista({ partido: p, puedeGestionar, onGuardarResultado, onEliminar }) {
  const [editando, setEditando] = useState(false);
  const [propio, setPropio] = useState(p.resultadoPropio ?? '');
  const [rival, setRival] = useState(p.resultadoRival ?? '');

  function guardar() {
    if (propio === '' || rival === '') return;
    onGuardarResultado(Number(propio), Number(rival));
    setEditando(false);
  }

  const estado = p.enDirecto ? 'directo' : p.jugado ? 'finalizado' : 'programado';

  return (
    <div className="fila-partido-lista">
      {p.escudoRival ? (
        <img src={p.escudoRival} alt="" className="escudo-mini-club" style={{ objectFit: 'cover' }} />
      ) : (
        <span className="escudo-mini-club">{inicialesRival(p.rival)}</span>
      )}
      <div className="info-fila-partido">
        <div style={{ fontWeight: 600 }}>
          {p.equipoNombre ? <span className="equipo-del-partido">{p.equipoNombre} · </span> : null}
          vs {p.rival}
        </div>
        <div className="nota" style={{ marginTop: 2 }}>
          {p.fecha?.slice(0, 10)}{p.hora ? ` · ${p.hora.slice(0, 5)}` : ''}
          {(p.competicionNombre || p.competicion) ? ` — ${p.competicionNombre || p.competicion}` : ''}
          {p.jornada ? ` · Jornada ${p.jornada}` : ''}
        </div>
      </div>
      <span className={`badge-partido ${estado === 'directo' ? 'badge-directo-en-vivo' : estado === 'finalizado' ? 'badge-finalizado' : 'badge-programado'}`}>
        {estado === 'directo' ? '● EN DIRECTO' : estado === 'finalizado' ? 'Finalizado' : 'Programado'}
      </span>
      {editando ? (
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          <input type="number" min="0" style={{ maxWidth: 56 }} value={propio} onChange={(e) => setPropio(e.target.value)} onBlur={guardar} />
          -
          <input type="number" min="0" style={{ maxWidth: 56 }} value={rival} onChange={(e) => setRival(e.target.value)} onBlur={guardar} />
        </span>
      ) : (
        <span
          className="resultado-fila-partido"
          onClick={() => puedeGestionar && setEditando(true)}
          style={{ cursor: puedeGestionar ? 'pointer' : 'default' }}
          title={puedeGestionar ? 'Editar resultado' : ''}
        >
          {p.jugado || p.enDirecto ? `${p.resultadoPropio ?? 0} - ${p.resultadoRival ?? 0}` : '—'}
        </span>
      )}
      <div className="acciones-fila">
        <Link to={`/partidos/${p.id}/directo`} className="boton-ver-directo">
          ▶ {estado === 'directo' ? 'Ver directo' : estado === 'finalizado' ? 'Resumen' : 'Directo'}
        </Link>
        {puedeGestionar && <button className="boton-peligro" onClick={onEliminar}>Eliminar</button>}
      </div>
    </div>
  );
}

function FormularioPartido({ equipos, equipoInicialId, onCrear }) {
  const [equipoId, setEquipoId] = useState(equipoInicialId || equipos[0]?.id || '');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [rival, setRival] = useState('');
  const [localVisitante, setLocalVisitante] = useState('local');
  const [competicionId, setCompeticionId] = useState('');
  const [competiciones, setCompeticiones] = useState([]);
  const [temporadaVigente, setTemporadaVigente] = useState(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!equipoInicialId) return;
    setEquipoId(equipoInicialId);
  }, [equipoInicialId]);

  useEffect(() => {
    if (!equipoId) return;
    api.get(`/equipos/${equipoId}`).then((eq) => setTemporadaVigente(eq.temporadaId)).catch(() => {});
  }, [equipoId]);

  useEffect(() => {
    if (!equipoId || !temporadaVigente) return;
    api.get(`/competiciones?equipoId=${equipoId}&temporadaId=${temporadaVigente}`).then(setCompeticiones).catch(() => {});
  }, [equipoId, temporadaVigente]);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!equipoId || !fecha || !rival) return;
    setError('');
    setEnviando(true);
    try {
      await onCrear(equipoId, { fecha, rival, localVisitante, competicionId: competicionId || undefined });
      setRival('');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta formulario-usuario" onSubmit={manejarEnvio} style={{ maxWidth: 620, marginBottom: 16 }}>
      <label>
        Equipo
        <select value={equipoId} onChange={(e) => setEquipoId(e.target.value)} required>
          <option value="">Selecciona un equipo…</option>
          {equipos.map((eq) => <option key={eq.id} value={eq.id}>{eq.nombre} — {eq.deporteNombre}</option>)}
        </select>
      </label>
      <div className="barra-filtros">
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        <input placeholder="Rival" value={rival} onChange={(e) => setRival(e.target.value)} required />
        <select value={localVisitante} onChange={(e) => setLocalVisitante(e.target.value)}>
          <option value="local">Local</option>
          <option value="visitante">Visitante</option>
        </select>
        <select value={competicionId} onChange={(e) => setCompeticionId(e.target.value)}>
          <option value="">Amistoso (sin competición)</option>
          {competiciones.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <button type="submit" disabled={enviando || !equipoId}>{enviando ? 'Creando…' : 'Crear partido'}</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function ImportarCalendarioRFFM({ equipos, equipoInicialId, temporadaId, onImportado }) {
  const [equipoId, setEquipoId] = useState(equipoInicialId || equipos[0]?.id || '');
  const [equipo, setEquipo] = useState(null);
  const [nombreClub, setNombreClub] = useState('');
  const [url, setUrl] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    if (equipoInicialId) setEquipoId(equipoInicialId);
  }, [equipoInicialId]);

  useEffect(() => {
    if (!equipoId) { setEquipo(null); return; }
    api.get(`/equipos/${equipoId}`).then((eq) => {
      setEquipo(eq);
      setNombreClub(eq.nombreClubCompeticion || '');
      setUrl(eq.calendarioExternoUrl || '');
    }).catch(() => {});
  }, [equipoId]);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!equipoId || !url.trim()) return;
    setError('');
    setResultado(null);
    setEnviando(true);
    try {
      if (nombreClub.trim() !== (equipo?.nombreClubCompeticion || '')) {
        await api.put(`/equipos/${equipoId}`, { nombreClubCompeticion: nombreClub.trim() });
      }
      const equipoTemporadaId = equipo?.temporadaId || temporadaId;
      const r = await api.post('/partidos/importar-calendario', { equipoId, temporadaId: equipoTemporadaId, url: url.trim() });
      setResultado(r);
      onImportado?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta formulario-usuario" onSubmit={manejarEnvio} style={{ maxWidth: 620, marginBottom: 16 }}>
      <p className="nota">
        Pega el enlace del calendario de un equipo en la web de la RFFM (competicion/calendario?...) y se
        crearán/actualizarán automáticamente sus partidos, con fecha, rival y escudo si la RFFM lo trae.
        Importante: en rffm.es, dentro de "Calendario", primero elige Temporada, Tipo de juego, Competición
        y Grupo y pulsa "BUSCAR" — solo entonces la URL de la barra de direcciones lleva los partidos (termina
        en algo como "?temporada=...&amp;tipojuego=...&amp;competicion=...&amp;grupo=..."). El enlace genérico de
        "Calendario" sin esos datos rellenados no sirve.
      </p>
      <label>
        Equipo
        <select value={equipoId} onChange={(e) => setEquipoId(e.target.value)} required>
          <option value="">Selecciona un equipo…</option>
          {equipos.map((eq) => <option key={eq.id} value={eq.id}>{eq.nombre} — {eq.deporteNombre}</option>)}
        </select>
      </label>
      <label>
        Nombre del club en la RFFM
        <input
          value={nombreClub}
          onChange={(e) => setNombreClub(e.target.value)}
          placeholder='Ej: "AD Nuevo Baztán" (tal y como aparece en la RFFM)'
          required
        />
      </label>
      <label>
        Enlace del calendario (rffm.es)
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.rffm.es/competicion/calendario?..."
          required
        />
      </label>
      {error && <p className="error">{error}</p>}
      {resultado && (
        <div className="nota" style={{ background: 'var(--color-superficie-alt)', padding: 10, borderRadius: 8 }}>
          <p style={{ margin: 0 }}>
            {resultado.totalEncontrados} partidos encontrados · {resultado.partidosCreados} nuevos
            {' '}· {resultado.partidosActualizados} actualizados
            {resultado.partidosIgnorados > 0 && ` · ${resultado.partidosIgnorados} no se han podido interpretar`}
            {resultado.partidosEliminados > 0 && ` · ${resultado.partidosEliminados} eliminados (sobraban de una importación anterior)`}
          </p>
          {resultado.rivalesSinReconocer?.length > 0 && (
            <p style={{ margin: '6px 0 0' }} className="texto-peligro">
              No se ha podido identificar quién es el rival en: {resultado.rivalesSinReconocer.join(', ')}.
              Revisa que "Nombre del club en la RFFM" esté escrito tal cual aparece allí.
            </p>
          )}
        </div>
      )}
      <button type="submit" disabled={enviando || !equipoId}>{enviando ? 'Importando…' : 'Importar calendario'}</button>
    </form>
  );
}
