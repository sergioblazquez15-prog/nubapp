// Gestión deportiva > Equipos. Un equipo es siempre de un deporte y una
// temporada concretos (ver README). Aquí se crean equipos, se les asigna
// personal (entrenador/coordinador/monitor) y se ficha a los deportistas
// que forman la plantilla esa temporada, con su dorsal y su ficha técnica.
import { Fragment, useEffect, useState } from 'react';
import { api, urlMedia } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { colorEtiqueta } from '../utils/colorEtiqueta';
import { POSICIONES_FUTBOL, POSICIONES_BALONCESTO, nombrePosicion, EsquemaPosiciones } from '../components/EsquemaPosiciones';
import { BotonInforme, CabeceraInforme } from '../components/Informe';

const GESTION_DEPORTIVA = ['administrador', 'direccion_deportiva', 'coordinador'];
const ROLES_PERSONAL = ['entrenador', 'coordinador', 'monitor'];

const ICONOS_DEPORTE = {
  Futbol: '⚽', Baloncesto: '🏀', Padel: '🎾', Tenis: '🎾',
  'Muay Thai': '🥊', Patinaje: '⛸️', 'Gimnasia Ritmica': '🤸',
};
function iconoDeporte(nombre) {
  return ICONOS_DEPORTE[nombre] || '🏅';
}

export default function Equipos() {
  const { tieneRol } = useAuth();
  const puedeGestionar = tieneRol(...GESTION_DEPORTIVA);

  const [equipos, setEquipos] = useState([]);
  const [deportes, setDeportes] = useState([]);
  const [temporadas, setTemporadas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarTraspaso, setMostrarTraspaso] = useState(false);
  const [equipoAbiertoId, setEquipoAbiertoId] = useState(null);

  const [filtros, setFiltros] = useState({ temporadaId: '', deporteId: '', estado: 'activo' });

  async function cargarEquipos(filtrosActuales = filtros) {
    setCargando(true);
    try {
      const parametros = new URLSearchParams();
      if (filtrosActuales.temporadaId) parametros.set('temporadaId', filtrosActuales.temporadaId);
      if (filtrosActuales.deporteId) parametros.set('deporteId', filtrosActuales.deporteId);
      if (filtrosActuales.estado) parametros.set('estado', filtrosActuales.estado);
      setEquipos(await api.get(`/equipos?${parametros.toString()}`));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    api.get('/deportes').then(setDeportes).catch(() => {});
    api.get('/temporadas').then((lista) => {
      setTemporadas(lista);
      const principal = lista.find((t) => t.esPrincipal);
      if (principal) setFiltros((actuales) => ({ ...actuales, temporadaId: principal.id }));
    }).catch(() => {});
    cargarEquipos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargarEquipos(filtros);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.temporadaId, filtros.deporteId, filtros.estado]);

  function actualizarFiltro(campo, valor) {
    setFiltros((actuales) => ({ ...actuales, [campo]: valor }));
  }

  async function darDeBajaEquipo(id) {
    if (!confirm('¿Dar de baja este equipo? Se puede reactivar más adelante.')) return;
    await api.delete(`/equipos/${id}`);
    cargarEquipos();
  }

  async function traspasarTemporada(temporadaOrigenId, incluirDorsales) {
    const resultado = await api.post(`/temporadas/${filtros.temporadaId}/traspaso`, { temporadaOrigenId, incluirDorsales });
    setMostrarTraspaso(false);
    cargarEquipos();
    return resultado;
  }

  if (equipoAbiertoId) {
    return (
      <EquipoDetalle
        equipoId={equipoAbiertoId}
        puedeGestionar={puedeGestionar}
        onVolver={() => {
          setEquipoAbiertoId(null);
          cargarEquipos();
        }}
      />
    );
  }

  return (
    <div className="pantalla-equipos">
      <div className="cabecera">
        <h1>Equipos</h1>
        {puedeGestionar && (
          <div className="acciones-fila">
            {filtros.temporadaId && (
              <button onClick={() => { setMostrarTraspaso((v) => !v); setMostrarFormulario(false); }}>
                {mostrarTraspaso ? 'Cancelar' : 'Traspasar de otra temporada'}
              </button>
            )}
            <button onClick={() => { setMostrarFormulario((v) => !v); setMostrarTraspaso(false); }}>
              {mostrarFormulario ? 'Cancelar' : '+ Nuevo equipo'}
            </button>
          </div>
        )}
      </div>

      <div className="barra-filtros">
        <select value={filtros.temporadaId} onChange={(e) => actualizarFiltro('temporadaId', e.target.value)}>
          <option value="">Todas las temporadas</option>
          {temporadas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
              {t.esPrincipal ? ' (actual)' : ''}
            </option>
          ))}
        </select>
        <select value={filtros.deporteId} onChange={(e) => actualizarFiltro('deporteId', e.target.value)}>
          <option value="">Todos los deportes</option>
          {deportes.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nombre}
            </option>
          ))}
        </select>
        <select value={filtros.estado} onChange={(e) => actualizarFiltro('estado', e.target.value)}>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
          <option value="todos">Todos los estados</option>
        </select>
      </div>

      {error && <p className="error">{error}</p>}

      {mostrarFormulario && (
        <FormularioEquipo
          deportes={deportes}
          temporadas={temporadas}
          onCreado={() => {
            setMostrarFormulario(false);
            cargarEquipos();
          }}
        />
      )}

      {mostrarTraspaso && (
        <FormularioTraspaso
          temporadas={temporadas}
          temporadaDestinoId={filtros.temporadaId}
          onTraspasar={traspasarTemporada}
        />
      )}

      {cargando ? (
        <p className="cargando">Cargando…</p>
      ) : equipos.length === 0 ? (
        <p className="nota">No hay equipos que coincidan con estos filtros.</p>
      ) : (
        <div className="tarjetas-dashboard">
          {equipos.map((eq) => (
            <div key={eq.id} className={`tarjeta tarjeta-dashboard tarjeta-equipo${eq.inactivo ? ' tarjeta-inactiva' : ''}`}>
              <div className="cabecera-equipo">
                <span className="icono-equipo">{iconoDeporte(eq.deporteNombre)}</span>
                <div className="datos-cabecera-persona">
                  <button className="boton-enlace nombre-tarjeta-persona" onClick={() => setEquipoAbiertoId(eq.id)}>
                    {eq.nombre}
                  </button>
                  {eq.categoria && <span className="nota" style={{ fontSize: 12.5 }}>{eq.categoria}</span>}
                </div>
                <span className={`badge-estado ${eq.inactivo ? 'badge-inactivo' : 'badge-activo'}`}>
                  {eq.inactivo ? 'Inactivo' : 'Activo'}
                </span>
              </div>

              <div className="etiquetas-roles" style={{ margin: '4px 0' }}>
                <span className={`etiqueta-suave ${colorEtiqueta(eq.deporteNombre)}`}>{eq.deporteNombre}</span>
                <span className="etiqueta-suave">{eq.temporadaNombre}</span>
              </div>

              <p className="nota" style={{ margin: 0, fontSize: 13 }}>
                {eq.clubNombre ? `Rival habitual: ${eq.clubNombre}` : 'Sin club/rival habitual indicado'}
              </p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                👥 {eq.numeroDeportistas ?? 0} deportista{(eq.numeroDeportistas ?? 0) === 1 ? '' : 's'} en plantilla
              </p>

              <div className="acciones-fila" style={{ marginTop: 4 }}>
                <button className="boton-lesion" onClick={() => setEquipoAbiertoId(eq.id)}>Ver plantilla</button>
                {puedeGestionar && !eq.inactivo && (
                  <button className="boton-peligro" onClick={() => darDeBajaEquipo(eq.id)}>Dar de baja</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FormularioTraspaso({ temporadas, temporadaDestinoId, onTraspasar }) {
  const candidatas = temporadas.filter((t) => t.id !== temporadaDestinoId);
  const [temporadaOrigenId, setTemporadaOrigenId] = useState(candidatas[0]?.id || '');
  const [incluirDorsales, setIncluirDorsales] = useState(true);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!temporadaOrigenId) return;
    setError('');
    setEnviando(true);
    setResultado(null);
    try {
      const r = await onTraspasar(temporadaOrigenId, incluirDorsales);
      setResultado(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta formulario-usuario" onSubmit={manejarEnvio}>
      <h3 style={{ margin: 0 }}>Traspasar equipos de otra temporada</h3>
      <p className="nota" style={{ margin: 0 }}>
        Copia los equipos activos de la temporada elegida (con su personal y los deportistas activos de su
        plantilla) a la temporada que tienes seleccionada en el filtro. Es seguro repetirlo: lo que ya exista no
        se duplica. No se copian fichas técnicas — cada temporada empieza la valoración en blanco.
      </p>
      <label>
        Temporada de origen
        <select value={temporadaOrigenId} onChange={(e) => setTemporadaOrigenId(e.target.value)} required>
          {candidatas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
      </label>
      <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <input type="checkbox" checked={incluirDorsales} onChange={(e) => setIncluirDorsales(e.target.checked)} />
        Mantener el mismo dorsal
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={enviando || !temporadaOrigenId}>
        {enviando ? 'Traspasando…' : 'Traspasar'}
      </button>
      {resultado && (
        <p className="nota">
          {resultado.equiposCreados} equipo(s) nuevo(s), {resultado.equiposYaExistian} ya existían,{' '}
          {resultado.deportistasFichados} deportista(s) fichados, {resultado.personalAsignado} asignación(es) de personal.
        </p>
      )}
    </form>
  );
}

function FormularioEquipo({ deportes, temporadas, onCreado }) {
  const principal = temporadas.find((t) => t.esPrincipal);
  const [campos, setCampos] = useState({
    nombre: '',
    categoria: '',
    clubNombre: '',
    deporteId: '',
    temporadaId: principal?.id || '',
  });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  function actualizarCampo(campo, valor) {
    setCampos((actuales) => ({ ...actuales, [campo]: valor }));
  }

  async function manejarEnvio(evento) {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await api.post('/equipos', {
        ...campos,
        categoria: campos.categoria || undefined,
        clubNombre: campos.clubNombre || undefined,
        temporadaId: campos.temporadaId || undefined,
      });
      onCreado();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta formulario-usuario" onSubmit={manejarEnvio}>
      <label>
        Nombre del equipo
        <input value={campos.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} required />
      </label>
      <label>
        Deporte
        <select value={campos.deporteId} onChange={(e) => actualizarCampo('deporteId', e.target.value)} required>
          <option value="" disabled>
            Elige un deporte…
          </option>
          {deportes.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nombre}
            </option>
          ))}
        </select>
      </label>
      <label>
        Temporada
        <select value={campos.temporadaId} onChange={(e) => actualizarCampo('temporadaId', e.target.value)} required>
          <option value="" disabled>
            Elige una temporada…
          </option>
          {temporadas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
              {t.esPrincipal ? ' (actual)' : ''}
            </option>
          ))}
        </select>
      </label>
      <label>
        Categoría (opcional)
        <input value={campos.categoria} onChange={(e) => actualizarCampo('categoria', e.target.value)} placeholder="Ej: Cadete, Regional A" />
      </label>
      <label>
        Club / rival habitual (opcional)
        <input value={campos.clubNombre} onChange={(e) => actualizarCampo('clubNombre', e.target.value)} />
      </label>

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={enviando}>
        {enviando ? 'Creando…' : 'Crear equipo'}
      </button>
    </form>
  );
}

function EquipoDetalle({ equipoId, puedeGestionar, onVolver }) {
  const [equipo, setEquipo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [usuariosDisponibles, setUsuariosDisponibles] = useState(null); // null = no consultado / sin permiso
  const [deportistasDisponibles, setDeportistasDisponibles] = useState([]);

  async function cargarEquipo() {
    setCargando(true);
    try {
      setEquipo(await api.get(`/equipos/${equipoId}`));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarEquipo();
    api.get('/usuarios').then(setUsuariosDisponibles).catch(() => setUsuariosDisponibles(null));
    api.get('/deportistas?estado=activo').then(setDeportistasDisponibles).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipoId]);

  async function asignarPersonal(usuarioId, rolEnEquipo) {
    await api.post(`/equipos/${equipoId}/personal`, { usuarioId, rolEnEquipo });
    cargarEquipo();
  }

  async function quitarPersonal(usuarioId, rolEnEquipo) {
    await api.delete(`/equipos/${equipoId}/personal/${usuarioId}/${rolEnEquipo}`);
    cargarEquipo();
  }

  async function ficharDeportista(deportistaId, dorsal) {
    await api.post(`/equipos/${equipoId}/deportistas`, { deportistaId, dorsal: dorsal || undefined });
    cargarEquipo();
  }

  async function quitarDeportista(deportistaId) {
    if (!confirm('¿Quitar a este deportista del equipo esta temporada?')) return;
    await api.delete(`/equipos/${equipoId}/deportistas/${deportistaId}`);
    cargarEquipo();
  }

  async function guardarDorsal(deportistaId, dorsal) {
    await api.put(`/equipos/${equipoId}/deportistas/${deportistaId}`, { dorsal: dorsal || null });
    cargarEquipo();
  }

  async function guardarFichaTecnica(deportistaId, datos) {
    await api.put(`/equipos/${equipoId}/deportistas/${deportistaId}/ficha-tecnica`, datos);
    cargarEquipo();
  }

  async function subirFotoDeportista(deportistaId, archivo) {
    const formData = new FormData();
    formData.append('foto', archivo);
    await api.postFile(`/deportistas/${deportistaId}/foto`, formData);
    cargarEquipo();
  }

  if (cargando) return <p className="cargando">Cargando…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!equipo) return null;

  const idsEnPlantilla = new Set(equipo.deportistas.map((d) => d.id));
  const candidatos = deportistasDisponibles.filter((d) => !idsEnPlantilla.has(d.id));

  return (
    <div className="pantalla-equipo-detalle">
      <button className="boton-enlace" onClick={onVolver}>
        ‹ Volver a equipos
      </button>

      <CabeceraInforme titulo="Informe de plantilla" subtitulo={`${equipo.nombre} · ${equipo.temporadaNombre}`} />

      <div className="cabecera cabecera-ficha-persona">
        <span className="icono-equipo icono-equipo-grande">{iconoDeporte(equipo.deporteNombre)}</span>
        <div>
          <h1 style={{ marginBottom: 4 }}>{equipo.nombre}</h1>
          <div className="etiquetas-roles" style={{ margin: 0 }}>
            <span className={`etiqueta-suave ${colorEtiqueta(equipo.deporteNombre)}`}>{equipo.deporteNombre}</span>
            <span className="etiqueta-suave">{equipo.temporadaNombre}</span>
            {equipo.clubNombre && <span className="etiqueta-suave">vs. {equipo.clubNombre}</span>}
          </div>
        </div>
        <div className="acciones-fila" style={{ marginLeft: 'auto' }}>
          <BotonInforme titulo={`plantilla ${equipo.nombre}`} />
        </div>
      </div>

      <div className="bloque-ficha">
        <h2>🧑‍🏫 Personal del equipo</h2>
        <div className="etiquetas-roles" style={{ marginBottom: 12 }}>
          {equipo.personal.length === 0 ? (
            <span className="nota">Sin personal asignado todavía.</span>
          ) : (
            equipo.personal.map((p) => (
              <span key={`${p.usuarioId}-${p.rolEnEquipo}`} className="etiqueta-suave">
                {p.nombreCompleto} · {p.rolEnEquipo}
                {puedeGestionar && (
                  <button
                    className="boton-enlace"
                    style={{ marginLeft: 6 }}
                    onClick={() => quitarPersonal(p.usuarioId, p.rolEnEquipo)}
                  >
                    quitar
                  </button>
                )}
              </span>
            ))
          )}
        </div>
        {puedeGestionar && usuariosDisponibles && (
          <FormularioPersonal usuarios={usuariosDisponibles} onAsignar={asignarPersonal} />
        )}
        {puedeGestionar && !usuariosDisponibles && (
          <p className="nota">Solo administración puede asignar personal nuevo desde aquí.</p>
        )}
      </div>

      <div className="bloque-ficha">
        <h2>👥 Plantilla ({equipo.deportistas.length})</h2>
        {equipo.deportistas.length === 0 ? (
          <p className="nota">Todavía no hay deportistas fichados por este equipo esta temporada.</p>
        ) : (
          <div className="tabla-scroll">
            <table className="tabla-usuarios">
              <thead>
                <tr>
                  <th>Dorsal</th>
                  <th>Nombre</th>
                  <th>Nº socio</th>
                  <th>Ficha técnica</th>
                  {puedeGestionar && <th></th>}
                </tr>
              </thead>
              <tbody>
                {equipo.deportistas.map((d) => (
                  <FilaJugador
                    key={d.id}
                    jugador={d}
                    deporteNombre={equipo.deporteNombre}
                    puedeGestionar={puedeGestionar}
                    onGuardarDorsal={(dorsal) => guardarDorsal(d.id, dorsal)}
                    onGuardarFicha={(datos) => guardarFichaTecnica(d.id, datos)}
                    onSubirFoto={(archivo) => subirFotoDeportista(d.id, archivo)}
                    onQuitar={() => quitarDeportista(d.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {puedeGestionar && (
          <FormularioFichar candidatos={candidatos} onFichar={ficharDeportista} />
        )}
      </div>

      {equipo.deporteTipo === 'equipo' && (
        <div className="bloque-ficha">
          <PartidosEquipo
            equipoId={equipoId}
            temporadaId={equipo.temporadaId}
            puedeGestionar={puedeGestionar}
            equipoNombre={equipo.nombre}
            nombreClubCompeticion={equipo.nombreClubCompeticion}
            calendarioExternoUrl={equipo.calendarioExternoUrl}
            onEquipoActualizado={cargarEquipo}
          />
        </div>
      )}

      <div className="bloque-ficha">
        <AsistenciaEquipo equipoId={equipoId} temporadaId={equipo.temporadaId} puedeGestionar={puedeGestionar} />
      </div>

      <div className="bloque-ficha">
        <PlanificacionMensual equipoId={equipoId} temporadaId={equipo.temporadaId} puedeGestionar={puedeGestionar} />
      </div>
    </div>
  );
}

function FormularioPersonal({ usuarios, onAsignar }) {
  const [usuarioId, setUsuarioId] = useState('');
  const [rolEnEquipo, setRolEnEquipo] = useState('entrenador');
  const [enviando, setEnviando] = useState(false);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!usuarioId) return;
    setEnviando(true);
    try {
      await onAsignar(usuarioId, rolEnEquipo);
      setUsuarioId('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="barra-filtros" onSubmit={manejarEnvio} style={{ marginBottom: 20 }}>
      <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} required>
        <option value="" disabled>
          Elige una persona…
        </option>
        {usuarios.map((u) => (
          <option key={u.id} value={u.id}>
            {u.nombreCompleto}
          </option>
        ))}
      </select>
      <select value={rolEnEquipo} onChange={(e) => setRolEnEquipo(e.target.value)}>
        {ROLES_PERSONAL.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button type="submit" disabled={enviando}>
        Añadir al equipo
      </button>
    </form>
  );
}

function FormularioFichar({ candidatos, onFichar }) {
  const [deportistaId, setDeportistaId] = useState('');
  const [dorsal, setDorsal] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!deportistaId) return;
    setError('');
    setEnviando(true);
    try {
      await onFichar(deportistaId, dorsal);
      setDeportistaId('');
      setDorsal('');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="barra-filtros" onSubmit={manejarEnvio}>
      <select value={deportistaId} onChange={(e) => setDeportistaId(e.target.value)} required>
        <option value="" disabled>
          {candidatos.length === 0 ? 'No hay deportistas disponibles' : 'Fichar a un deportista…'}
        </option>
        {candidatos.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nombre} {d.apellidos}
          </option>
        ))}
      </select>
      <input
        type="number"
        min="0"
        placeholder="Dorsal (opcional)"
        value={dorsal}
        onChange={(e) => setDorsal(e.target.value)}
        style={{ maxWidth: 140 }}
      />
      <button type="submit" disabled={enviando || candidatos.length === 0}>
        Fichar por este equipo
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function FilaJugador({ jugador: d, deporteNombre, puedeGestionar, onGuardarDorsal, onGuardarFicha, onSubirFoto, onQuitar }) {
  const [dorsal, setDorsal] = useState(d.dorsal ?? '');
  const [editandoFicha, setEditandoFicha] = useState(false);

  return (
    <>
      <tr>
        <td>
          {puedeGestionar ? (
            <input
              type="number"
              min="0"
              value={dorsal}
              onChange={(e) => setDorsal(e.target.value)}
              onBlur={() => onGuardarDorsal(dorsal)}
              style={{ maxWidth: 70 }}
            />
          ) : (
            d.dorsal ?? '—'
          )}
        </td>
        <td>
          <span className="jugador-nombre">
            {d.fotoUrl ? (
              <img className="foto-jugador" src={urlMedia(d.fotoUrl)} alt="" />
            ) : (
              <span className="foto-jugador foto-jugador-vacia" aria-hidden="true">
                {d.nombre?.[0]}
              </span>
            )}
            {d.nombre} {d.apellidos}
          </span>
          {d.lesionado && <span className="etiqueta-suave"> lesionado</span>}
        </td>
        <td>{d.numeroSocio || '—'}</td>
        <td>
          {resumenFicha(d, deporteNombre)}{' '}
          <button className="boton-enlace" onClick={() => setEditandoFicha((v) => !v)}>
            {editandoFicha ? 'cerrar' : 'editar ficha'}
          </button>
        </td>
        {puedeGestionar && (
          <td className="acciones-fila">
            <button className="boton-peligro" onClick={onQuitar}>Quitar</button>
          </td>
        )}
      </tr>
      {editandoFicha && (
        <tr>
          <td colSpan={puedeGestionar ? 5 : 4}>
            <FormularioFichaTecnica
              jugador={d}
              deporteNombre={deporteNombre}
              onGuardar={async (datos) => {
                await onGuardarFicha(datos);
                setEditandoFicha(false);
              }}
              onSubirFoto={onSubirFoto}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function resumenFicha(d, deporteNombre) {
  const valores = [
    d.valoracionTecnica,
    d.valoracionTactica,
    d.valoracionFisica,
    d.valoracionPsicologica,
    d.valoracionPersonalidad,
  ].filter((v) => v !== null && v !== undefined);
  const media = valores.length ? valores.reduce((a, b) => a + Number(b), 0) / valores.length : null;

  if (!d.posicionPrincipal && media === null) return <span className="nota">Sin ficha técnica</span>;
  return (
    <>
      {d.posicionPrincipal && (
        <span className="etiqueta-suave">
          {nombrePosicion(deporteNombre, d.posicionPrincipal)}
          {d.posicionSecundaria ? ` / ${nombrePosicion(deporteNombre, d.posicionSecundaria)}` : ''}
        </span>
      )}
      {media !== null && <span className="etiqueta-suave">media {media.toFixed(1)}</span>}
    </>
  );
}

const CAMPOS_VALORACION = [
  ['valoracionTecnica', 'Técnica'],
  ['valoracionTactica', 'Táctica'],
  ['valoracionFisica', 'Física'],
  ['valoracionPsicologica', 'Psicológica'],
  ['valoracionPersonalidad', 'Personalidad'],
];

function FormularioFichaTecnica({ jugador, deporteNombre, onGuardar, onSubirFoto }) {
  const [datos, setDatos] = useState({
    lateralidad: jugador.lateralidad || '',
    genero: jugador.genero || '',
    posicionPrincipal: jugador.posicionPrincipal || '',
    posicionSecundaria: jugador.posicionSecundaria || '',
    valoracionTecnica: jugador.valoracionTecnica ?? '',
    valoracionTactica: jugador.valoracionTactica ?? '',
    valoracionFisica: jugador.valoracionFisica ?? '',
    valoracionPsicologica: jugador.valoracionPsicologica ?? '',
    valoracionPersonalidad: jugador.valoracionPersonalidad ?? '',
  });
  const [enviando, setEnviando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState('');

  const catalogoPosiciones = deporteNombre === 'Baloncesto' ? POSICIONES_BALONCESTO
    : deporteNombre === 'Futbol' ? POSICIONES_FUTBOL
    : null;

  function actualizarCampo(campo, valor) {
    setDatos((actuales) => ({ ...actuales, [campo]: valor }));
  }

  // Clic en el esquema: la primera posición marcada es la principal, la
  // segunda la secundaria. Volver a hacer clic en una ya marcada la quita
  // (y si quitas la principal, la secundaria pasa a serlo).
  function alClicPosicion(id) {
    setDatos((actuales) => {
      if (actuales.posicionPrincipal === id) {
        return { ...actuales, posicionPrincipal: actuales.posicionSecundaria, posicionSecundaria: '' };
      }
      if (actuales.posicionSecundaria === id) {
        return { ...actuales, posicionSecundaria: '' };
      }
      if (!actuales.posicionPrincipal) {
        return { ...actuales, posicionPrincipal: id };
      }
      return { ...actuales, posicionSecundaria: id };
    });
  }

  async function manejarSubidaFoto(evento) {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!archivo || !onSubirFoto) return;
    setErrorFoto('');
    setSubiendoFoto(true);
    try {
      await onSubirFoto(archivo);
    } catch (err) {
      setErrorFoto(err.message);
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function manejarEnvio(evento) {
    evento.preventDefault();
    setEnviando(true);
    try {
      await onGuardar({
        lateralidad: datos.lateralidad || undefined,
        genero: datos.genero || undefined,
        posicionPrincipal: datos.posicionPrincipal || undefined,
        posicionSecundaria: datos.posicionSecundaria || undefined,
        valoracionTecnica: datos.valoracionTecnica === '' ? undefined : Number(datos.valoracionTecnica),
        valoracionTactica: datos.valoracionTactica === '' ? undefined : Number(datos.valoracionTactica),
        valoracionFisica: datos.valoracionFisica === '' ? undefined : Number(datos.valoracionFisica),
        valoracionPsicologica: datos.valoracionPsicologica === '' ? undefined : Number(datos.valoracionPsicologica),
        valoracionPersonalidad: datos.valoracionPersonalidad === '' ? undefined : Number(datos.valoracionPersonalidad),
      });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta ficha-tecnica-form" onSubmit={manejarEnvio}>
      <div className="ficha-tecnica-cabecera">
        <div className="foto-subida">
          {jugador.fotoUrl ? (
            <img className="foto-jugador foto-jugador-grande" src={urlMedia(jugador.fotoUrl)} alt="" />
          ) : (
            <span className="foto-jugador foto-jugador-grande foto-jugador-vacia" aria-hidden="true">
              {jugador.nombre?.[0]}
            </span>
          )}
          <label className="boton-enlace foto-subida-boton">
            {subiendoFoto ? 'Subiendo…' : 'Cambiar foto'}
            <input type="file" accept="image/*" onChange={manejarSubidaFoto} disabled={subiendoFoto} hidden />
          </label>
          {errorFoto && <p className="error">{errorFoto}</p>}
        </div>

        {catalogoPosiciones && (
          <div className="esquema-posiciones-envoltorio">
            <EsquemaPosiciones
              posiciones={catalogoPosiciones}
              tipoCancha={deporteNombre === 'Baloncesto' ? 'baloncesto' : 'futbol'}
              posicionPrincipal={datos.posicionPrincipal}
              posicionSecundaria={datos.posicionSecundaria}
              onClicPosicion={alClicPosicion}
            />
            <p className="nota">
              {datos.posicionPrincipal
                ? <>Principal: <strong>{nombrePosicion(deporteNombre, datos.posicionPrincipal)}</strong></>
                : 'Toca una posición para marcarla como principal'}
              {datos.posicionSecundaria && <> · Secundaria: <strong>{nombrePosicion(deporteNombre, datos.posicionSecundaria)}</strong></>}
            </p>
          </div>
        )}
      </div>

      <label>
        Lateralidad
        <select value={datos.lateralidad} onChange={(e) => actualizarCampo('lateralidad', e.target.value)}>
          <option value="">Sin indicar</option>
          <option value="derecho">Derecho</option>
          <option value="zurdo">Zurdo</option>
          <option value="ambidiestro">Ambidiestro</option>
          <option value="desconocido">Desconocido</option>
        </select>
      </label>
      <div className="valoraciones-grid">
        {CAMPOS_VALORACION.map(([campo, etiqueta]) => (
          <label key={campo}>
            {etiqueta} (0-10)
            <input
              type="number"
              min="0"
              max="10"
              step="0.5"
              value={datos[campo]}
              onChange={(e) => actualizarCampo(campo, e.target.value)}
            />
          </label>
        ))}
      </div>
      <button type="submit" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Guardar ficha técnica'}
      </button>
    </form>
  );
}

// ---------- estadísticas de equipo: partidos y resultados ----------
// Solo para deportes de equipo (fútbol/baloncesto): individuales no
// juegan partidos, se les hace seguimiento por asistencia (más abajo).

function PartidosEquipo({
  equipoId, temporadaId, puedeGestionar, equipoNombre, nombreClubCompeticion, calendarioExternoUrl, onEquipoActualizado,
}) {
  const [partidos, setPartidos] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarImportar, setMostrarImportar] = useState(false);
  const [partidoDirectoId, setPartidoDirectoId] = useState(null);

  async function cargar() {
    setCargando(true);
    try {
      const [lista, stats] = await Promise.all([
        api.get(`/partidos?equipoId=${equipoId}&temporadaId=${temporadaId}`),
        api.get(`/partidos/estadisticas?equipoId=${equipoId}&temporadaId=${temporadaId}`),
      ]);
      setPartidos(lista);
      setEstadisticas(stats);
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
  }, [equipoId, temporadaId]);

  async function crearPartido(datos) {
    const creado = await api.post('/partidos', { ...datos, equipoId, temporadaId });
    setMostrarFormulario(false);
    await cargar();
    // Abrimos el Directo del partido recién creado directamente, para no
    // obligar a un segundo clic buscándolo en la tabla.
    setPartidoDirectoId(creado.id);
  }

  async function guardarResultado(partidoId, resultadoPropio, resultadoRival) {
    await api.put(`/partidos/${partidoId}`, { resultadoPropio, resultadoRival });
    cargar();
  }

  async function eliminarPartido(partidoId) {
    if (!confirm('¿Eliminar este partido?')) return;
    await api.delete(`/partidos/${partidoId}`);
    cargar();
  }

  return (
    <>
      <CabeceraInforme titulo="Informe de partidos" subtitulo={equipoNombre} />
      <div className="cabecera">
        <h2>Partidos y resultados</h2>
        <div className="acciones-fila">
          <BotonInforme titulo={`partidos ${equipoNombre || ''}`} />
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {estadisticas && (
        <p className="nota" style={{ marginBottom: 10 }}>
          {estadisticas.jugados} jugados · {estadisticas.ganados}G {estadisticas.empatados}E {estadisticas.perdidos}P
          {' '}· {estadisticas.favor}-{estadisticas.contra}
        </p>
      )}
      {puedeGestionar && (
        <div className="acciones-fila" style={{ marginBottom: 12 }}>
          <button onClick={() => setMostrarFormulario((v) => !v)}>
            {mostrarFormulario ? 'Cancelar' : '+ Nuevo partido'}
          </button>
          <button onClick={() => setMostrarImportar((v) => !v)}>
            {mostrarImportar ? 'Cancelar' : '🌐 Importar calendario (RFFM)'}
          </button>
        </div>
      )}
      {mostrarImportar && (
        <ImportarCalendarioRFFM
          equipoId={equipoId}
          temporadaId={temporadaId}
          nombreClubCompeticion={nombreClubCompeticion}
          calendarioExternoUrl={calendarioExternoUrl}
          onImportado={() => { cargar(); onEquipoActualizado?.(); }}
        />
      )}
      {mostrarFormulario && <FormularioPartido equipoId={equipoId} temporadaId={temporadaId} onCrear={crearPartido} />}
      {cargando ? (
        <p className="cargando">Cargando…</p>
      ) : partidos.length === 0 ? (
        <p className="nota">Todavía no hay partidos registrados esta temporada.</p>
      ) : (
        <div className="tabla-scroll" style={{ marginBottom: 20 }}>
          <table className="tabla-usuarios">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Rival</th>
                <th>Local/Visitante</th>
                <th>Resultado</th>
                {puedeGestionar && <th></th>}
              </tr>
            </thead>
            <tbody>
              {partidos.map((p) => (
                <Fragment key={p.id}>
                  <FilaPartido
                    partido={p}
                    puedeGestionar={puedeGestionar}
                    onGuardarResultado={(propio, rival) => guardarResultado(p.id, propio, rival)}
                    onEliminar={() => eliminarPartido(p.id)}
                    directoAbierto={partidoDirectoId === p.id}
                    onAlternarDirecto={() => setPartidoDirectoId(partidoDirectoId === p.id ? null : p.id)}
                  />
                  {partidoDirectoId === p.id && (
                    <tr>
                      <td colSpan={5}>
                        <MarcadorDirecto partidoId={p.id} equipoId={equipoId} puedeGestionar={puedeGestionar} onCambio={cargar} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// Importa el calendario del equipo desde una URL de RFFM (ver POST
// /partidos/importar-calendario en el backend): crea o actualiza los
// partidos, con fecha, rival y escudo si la RFFM lo trae. Hace falta
// haber rellenado antes "nombre del club en la RFFM" (cómo aparece el
// propio club en esos datos, para poder distinguir el rival) - si no
// está puesto, se pide aquí mismo antes de poder importar.
function ImportarCalendarioRFFM({ equipoId, temporadaId, nombreClubCompeticion, calendarioExternoUrl, onImportado }) {
  const [nombreClub, setNombreClub] = useState(nombreClubCompeticion || '');
  const [url, setUrl] = useState(calendarioExternoUrl || '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!url.trim()) return;
    setError('');
    setResultado(null);
    setEnviando(true);
    try {
      if (nombreClub.trim() !== (nombreClubCompeticion || '')) {
        await api.put(`/equipos/${equipoId}`, { nombreClubCompeticion: nombreClub.trim() });
      }
      const r = await api.post('/partidos/importar-calendario', { equipoId, temporadaId, url: url.trim() });
      setResultado(r);
      onImportado?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta formulario-usuario" onSubmit={manejarEnvio} style={{ maxWidth: 560, marginBottom: 16 }}>
      <p className="nota">
        Pega el enlace del calendario de este equipo en la web de la RFFM (competicion/calendario?...) y se
        crearán/actualizarán automáticamente sus partidos, con fecha, rival y escudo si la RFFM lo trae.
        Se puede volver a importar más adelante para traer los partidos y resultados nuevos.
      </p>
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
          </p>
          {resultado.rivalesSinReconocer?.length > 0 && (
            <p style={{ margin: '6px 0 0' }} className="texto-peligro">
              No se ha podido identificar quién es el rival en: {resultado.rivalesSinReconocer.join(', ')}.
              Revisa que "Nombre del club en la RFFM" esté escrito tal cual aparece allí.
            </p>
          )}
        </div>
      )}
      <button type="submit" disabled={enviando}>{enviando ? 'Importando…' : 'Importar calendario'}</button>
    </form>
  );
}

function FilaPartido({ partido: p, puedeGestionar, onGuardarResultado, onEliminar, directoAbierto, onAlternarDirecto }) {
  const [propio, setPropio] = useState(p.resultadoPropio ?? '');
  const [rival, setRival] = useState(p.resultadoRival ?? '');

  function guardar() {
    if (propio === '' || rival === '') return;
    onGuardarResultado(Number(propio), Number(rival));
  }

  return (
    <tr>
      <td>
        {p.fecha?.slice(0, 10)}{p.hora ? ` ${p.hora.slice(0, 5)}` : ''}
        {p.enDirecto && <span className="texto-peligro"> · EN DIRECTO</span>}
      </td>
      <td>
        {p.escudoRival && <img src={p.escudoRival} alt="" className="escudo-rival-mini" />}
        {p.rival}{(p.competicionNombre || p.competicion) ? <span className="nota"> ({p.competicionNombre || p.competicion})</span> : ''}
      </td>
      <td>{p.localVisitante === 'local' ? 'Local' : 'Visitante'}</td>
      <td>
        {puedeGestionar ? (
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <input
              type="number" min="0" style={{ maxWidth: 56 }} value={propio}
              onChange={(e) => setPropio(e.target.value)} onBlur={guardar}
            />
            -
            <input
              type="number" min="0" style={{ maxWidth: 56 }} value={rival}
              onChange={(e) => setRival(e.target.value)} onBlur={guardar}
            />
          </span>
        ) : p.jugado || p.enDirecto ? `${p.resultadoPropio ?? 0} - ${p.resultadoRival ?? 0}` : 'Pendiente'}
      </td>
      <td className="acciones-fila">
        <button className="boton-lesion" onClick={onAlternarDirecto}>
          {directoAbierto ? 'Cerrar' : 'Directo'}
        </button>
        {puedeGestionar && <button className="boton-peligro" onClick={onEliminar}>Eliminar</button>}
      </td>
    </tr>
  );
}

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

// Directo v2 (a partir de las capturas de referencia que pasó Sergio):
// convocatoria previa, cronómetro real con partes configurables por el
// entrenador, y un botón por cada acción — el minuto lo calcula el
// servidor solo a partir del cronómetro, aquí no se escribe a mano.

function formatoReloj(segundosTotales) {
  const seg = Math.max(0, Math.floor(segundosTotales || 0));
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Un botón grande por acción, con icono y color propio, agrupados en dos
// columnas (nosotros / rival) para que el entrenador toque sin tener que
// leer texto en mitad de un partido real.
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

// Convocatoria/alineación del partido: qué jugadores de la plantilla
// juegan, con dorsal y si son titulares. Necesaria para poder asignar
// jugador a cada acción del directo.
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
      <p className="nota">
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

// Configuración de las partes del partido (cuántas y cuánto dura cada
// una) antes de arrancar el cronómetro — el entrenador puede tocarlas.
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

function MarcadorDirecto({ partidoId, equipoId, puedeGestionar, onCambio }) {
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

  // El reloj en pantalla se recalcula cada segundo mientras el cronómetro
  // esté en marcha (periodoIniciadoEn no nulo), sin volver a preguntar al
  // servidor — se basa en la hora de inicio que ya nos ha dado.
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
    onCambio();
  }
  async function pausar() {
    setPartido(await api.put(`/partidos/${partidoId}/directo/pausar`, {}));
    onCambio();
  }
  async function reanudar() {
    setPartido(await api.put(`/partidos/${partidoId}/directo/reanudar`, {}));
    onCambio();
  }
  async function siguienteParte() {
    setPartido(await api.put(`/partidos/${partidoId}/directo/siguiente-parte`, {}));
    setMostrarResumen(true);
    onCambio();
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
      onCambio();
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminarEvento(id) {
    await api.delete(`/partidos/eventos/${id}`);
    await cargar();
    onCambio();
  }

  if (error) return <p className="error">{error}</p>;
  if (!partido) return <p className="cargando">Cargando…</p>;

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
            : <p className="nota">Añade al menos un convocado a la convocatoria antes de arrancar el directo.</p>
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
                <p className="nota" style={{ margin: '0 0 6px' }}>
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
            <p className="nota">Todavía no hay eventos registrados.</p>
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

function FormularioPartido({ equipoId, temporadaId, onCrear }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [rival, setRival] = useState('');
  const [localVisitante, setLocalVisitante] = useState('local');
  const [competicionId, setCompeticionId] = useState('');
  const [competiciones, setCompeticiones] = useState([]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!equipoId || !temporadaId) return;
    api.get(`/competiciones?equipoId=${equipoId}&temporadaId=${temporadaId}`).then(setCompeticiones).catch(() => {});
  }, [equipoId, temporadaId]);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!fecha || !rival) return;
    setError('');
    setEnviando(true);
    try {
      await onCrear({ fecha, rival, localVisitante, competicionId: competicionId || undefined });
      setRival('');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="barra-filtros" onSubmit={manejarEnvio}>
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
      <button type="submit" disabled={enviando}>{enviando ? 'Creando…' : 'Crear partido'}</button>
      {error && <p className="error">{error}</p>}
      {competiciones.length === 0 && (
        <p className="nota" style={{ width: '100%', margin: '4px 0 0' }}>
          Sin competiciones dadas de alta todavía para este equipo — puedes crearlas en la sección "Competición" del menú.
        </p>
      )}
    </form>
  );
}

// ---------- sesiones y control de asistencia ----------
// Para cualquier equipo, pero es la métrica clave en deportes individuales
// (Muay Thai, pádel, tenis...), donde no hay partidos.

// Exportado para reutilizarse en la página independiente de Asistencia
// (pages/Asistencia.jsx), a la que también puede entrar el monitor sin
// tener que pasar por la gestión completa de Equipos.
export function AsistenciaEquipo({ equipoId, temporadaId, puedeGestionar }) {
  const [sesiones, setSesiones] = useState([]);
  const [resumen, setResumen] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [sesionAbiertaId, setSesionAbiertaId] = useState(null);

  async function cargar() {
    setCargando(true);
    try {
      const [lista, resumenAsistencia] = await Promise.all([
        api.get(`/sesiones?equipoId=${equipoId}&temporadaId=${temporadaId}`),
        api.get(`/sesiones/resumen-asistencia?equipoId=${equipoId}&temporadaId=${temporadaId}`),
      ]);
      setSesiones(lista);
      setResumen(resumenAsistencia);
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
  }, [equipoId, temporadaId]);

  async function crearSesion(datos) {
    await api.post('/sesiones', { ...datos, equipoId, temporadaId });
    setMostrarFormulario(false);
    cargar();
  }

  async function eliminarSesion(sesionId) {
    if (!confirm('¿Eliminar esta sesión? Se borra también la asistencia registrada.')) return;
    if (sesionAbiertaId === sesionId) setSesionAbiertaId(null);
    await api.delete(`/sesiones/${sesionId}`);
    cargar();
  }

  const faltasDestacadas = resumen.filter((r) => r.faltasSinJustificar >= 3);

  return (
    <>
      <h2>Sesiones y asistencia</h2>
      {error && <p className="error">{error}</p>}
      {faltasDestacadas.length > 0 && (
        <p className="nota" style={{ marginBottom: 10 }}>
          <span className="texto-peligro">Aviso:</span>{' '}
          {faltasDestacadas.map((r) => `${r.nombre} ${r.apellidos} (${r.faltasSinJustificar} faltas sin justificar)`).join(' · ')}
        </p>
      )}
      {puedeGestionar && (
        <button onClick={() => setMostrarFormulario((v) => !v)} style={{ marginBottom: 12 }}>
          {mostrarFormulario ? 'Cancelar' : '+ Nueva sesión'}
        </button>
      )}
      {mostrarFormulario && <FormularioSesion onCrear={crearSesion} />}
      {cargando ? (
        <p className="cargando">Cargando…</p>
      ) : sesiones.length === 0 ? (
        <p className="nota">Todavía no hay sesiones registradas esta temporada.</p>
      ) : (
        <div className="tabla-scroll" style={{ marginBottom: 16 }}>
          <table className="tabla-usuarios">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Título</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sesiones.map((s) => (
                <Fragment key={s.id}>
                  <tr>
                    <td>{s.fecha?.slice(0, 10)}{s.horaInicio ? ` ${s.horaInicio.slice(0, 5)}` : ''}</td>
                    <td>{s.titulo || '—'}</td>
                    <td>{s.cancelada ? `Cancelada${s.motivoCancelacion ? `: ${s.motivoCancelacion}` : ''}` : 'Prevista'}</td>
                    <td className="acciones-fila">
                      <button
                        className="boton-lesion"
                        onClick={() => setSesionAbiertaId(sesionAbiertaId === s.id ? null : s.id)}
                      >
                        {sesionAbiertaId === s.id ? 'Cerrar' : 'Asistencia'}
                      </button>
                      {puedeGestionar && (
                        <button className="boton-peligro" onClick={() => eliminarSesion(s.id)}>Eliminar</button>
                      )}
                    </td>
                  </tr>
                  {sesionAbiertaId === s.id && (
                    <tr>
                      <td colSpan={4}>
                        <TablaAsistenciaSesion sesionId={s.id} puedeGestionar={puedeGestionar} onCambio={cargar} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function FormularioSesion({ onCrear }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [horaInicio, setHoraInicio] = useState('');
  const [titulo, setTitulo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!fecha) return;
    setError('');
    setEnviando(true);
    try {
      await onCrear({ fecha, horaInicio: horaInicio || undefined, titulo: titulo || undefined });
      setTitulo('');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="barra-filtros" onSubmit={manejarEnvio}>
      <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
      <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
      <input placeholder="Título (opcional)" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      <button type="submit" disabled={enviando}>{enviando ? 'Creando…' : 'Crear sesión'}</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function TablaAsistenciaSesion({ sesionId, puedeGestionar, onCambio }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  async function cargar() {
    try {
      setDatos(await api.get(`/sesiones/${sesionId}/asistencia`));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesionId]);

  async function marcar(deportistaId, asistio, justificada) {
    await api.put(`/sesiones/${sesionId}/asistencia/${deportistaId}`, { asistio, justificada });
    cargar();
    onCambio();
  }

  if (error) return <p className="error">{error}</p>;
  if (!datos) return <p className="cargando">Cargando…</p>;
  if (datos.asistencia.length === 0) return <p className="nota">Este equipo no tiene deportistas fichados.</p>;

  return (
    <div className="checkboxes-roles" style={{ padding: '8px 0' }}>
      {datos.asistencia.map((a) => (
        <span key={a.deportistaId} className="etiqueta-suave" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {a.nombre} {a.apellidos}
          {puedeGestionar ? (
            <>
              <button
                className="boton-enlace"
                style={{ color: a.asistio === true ? 'var(--color-primario)' : undefined }}
                onClick={() => marcar(a.deportistaId, true, false)}
              >
                asistió
              </button>
              <button
                className="boton-enlace"
                style={{ color: a.asistio === false ? 'var(--color-peligro)' : undefined }}
                onClick={() => marcar(a.deportistaId, false, a.justificada)}
              >
                faltó
              </button>
              {a.asistio === false && (
                <label style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', gap: 3, fontSize: 11 }}>
                  <input
                    type="checkbox" checked={!!a.justificada}
                    onChange={(e) => marcar(a.deportistaId, false, e.target.checked)}
                  />
                  justificada
                </label>
              )}
            </>
          ) : (
            <span className="nota">{a.asistio === true ? 'Asistió' : a.asistio === false ? (a.justificada ? 'Faltó (justificada)' : 'Faltó') : 'Sin marcar'}</span>
          )}
        </span>
      ))}
    </div>
  );
}

// ---------- planificación mensual (coordinador -> entrenador) ----------

const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function PlanificacionMensual({ equipoId, temporadaId, puedeGestionar }) {
  const [meses, setMeses] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioActual);
  const [mes, setMes] = useState(new Date().getMonth() + 1);

  async function cargar() {
    setCargando(true);
    try {
      setMeses(await api.get(`/planificaciones?equipoId=${equipoId}&temporadaId=${temporadaId}`));
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
  }, [equipoId, temporadaId]);

  async function guardarMes(anioGuardar, mesGuardar, contenido) {
    await api.put('/planificaciones', { equipoId, temporadaId, anio: anioGuardar, mes: mesGuardar, contenido });
    cargar();
  }

  async function eliminarMes(id) {
    if (!confirm('¿Vaciar la planificación de este mes?')) return;
    await api.delete(`/planificaciones/${id}`);
    cargar();
  }

  const existente = meses.find((m) => m.anio === Number(anio) && m.mes === Number(mes));

  return (
    <>
      <h2>Planificación mensual</h2>
      {error && <p className="error">{error}</p>}
      {cargando ? (
        <p className="cargando">Cargando…</p>
      ) : meses.length === 0 ? (
        <p className="nota">Todavía no hay ningún mes planificado.</p>
      ) : (
        <div className="tabla-scroll" style={{ marginBottom: 16 }}>
          <table className="tabla-usuarios">
            <thead>
              <tr><th>Mes</th><th>Contenido</th>{puedeGestionar && <th></th>}</tr>
            </thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.id}>
                  <td>{NOMBRES_MES[m.mes - 1]} {m.anio}</td>
                  <td style={{ whiteSpace: 'pre-wrap' }}>{m.contenido || '—'}</td>
                  {puedeGestionar && (
                    <td><button className="boton-peligro" onClick={() => eliminarMes(m.id)}>Vaciar</button></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {puedeGestionar && (
        <FormularioPlanificacion
          anio={anio} mes={mes} contenidoInicial={existente?.contenido || ''}
          onCambiarAnio={setAnio} onCambiarMes={setMes}
          onGuardar={(contenido) => guardarMes(anio, mes, contenido)}
        />
      )}
    </>
  );
}

function FormularioPlanificacion({ anio, mes, contenidoInicial, onCambiarAnio, onCambiarMes, onGuardar }) {
  const [contenido, setContenido] = useState(contenidoInicial);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    setContenido(contenidoInicial);
    setGuardado(false);
  }, [contenidoInicial]);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    setGuardando(true);
    try {
      await onGuardar(contenido);
      setGuardado(true);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="tarjeta formulario-usuario" onSubmit={manejarEnvio}>
      <div className="checkboxes-roles">
        <label style={{ flexDirection: 'column' }}>
          Año
          <input
            type="number" style={{ maxWidth: 100 }} value={anio}
            onChange={(e) => onCambiarAnio(Number(e.target.value))}
          />
        </label>
        <label style={{ flexDirection: 'column' }}>
          Mes
          <select value={mes} onChange={(e) => onCambiarMes(Number(e.target.value))}>
            {NOMBRES_MES.map((nombre, i) => <option key={nombre} value={i + 1}>{nombre}</option>)}
          </select>
        </label>
      </div>
      <label>
        Objetivos / contenido de este mes
        <textarea rows={4} value={contenido} onChange={(e) => setContenido(e.target.value)} />
      </label>
      <button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar mes'}</button>
      {guardado && !guardando && <span className="nota" style={{ marginLeft: 10 }}>Guardado.</span>}
    </form>
  );
}
