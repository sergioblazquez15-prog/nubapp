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

      <div className="bloque-ficha">
        <AsistenciaEquipo equipoId={equipoId} temporadaId={equipo.temporadaId} puedeGestionar={puedeGestionar} />
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

// ---------- sesiones y control de asistencia ----------
// Para cualquier equipo, pero es la métrica clave en deportes individuales
// (Muay Thai, pádel, tenis...), donde no hay partidos.

// Exportado para reutilizarse en la página independiente de Asistencia
// (pages/Asistencia.jsx), a la que también puede entrar el monitor sin
// tener que pasar por la gestión completa de Equipos.
export function AsistenciaEquipo({ equipoId, temporadaId, puedeGestionar }) {
  const [sesiones, setSesiones] = useState([]);
  const [resumen, setResumen] = useState([]);
  const [plantilla, setPlantilla] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarRecuperacion, setMostrarRecuperacion] = useState(false);
  const [sesionAbiertaId, setSesionAbiertaId] = useState(null);

  async function cargar() {
    setCargando(true);
    try {
      const [lista, resumenAsistencia, equipo] = await Promise.all([
        api.get(`/sesiones?equipoId=${equipoId}&temporadaId=${temporadaId}`),
        api.get(`/sesiones/resumen-asistencia?equipoId=${equipoId}&temporadaId=${temporadaId}`),
        api.get(`/equipos/${equipoId}`),
      ]);
      setSesiones(lista);
      setResumen(resumenAsistencia);
      setPlantilla(equipo.deportistas || []);
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

  async function crearRecuperacion(datos) {
    await api.post('/sesiones', { ...datos, equipoId, temporadaId, esRecuperacion: true });
    setMostrarRecuperacion(false);
    cargar();
  }

  async function alternarCancelada(sesion) {
    if (sesion.cancelada) {
      await api.put(`/sesiones/${sesion.id}`, { cancelada: false, motivoCancelacion: '' });
      cargar();
      return;
    }
    const motivo = window.prompt('Motivo de la cancelación (ej: lluvia, pista ocupada…)', sesion.motivoCancelacion || '');
    if (motivo === null) return;
    await api.put(`/sesiones/${sesion.id}`, { cancelada: true, motivoCancelacion: motivo });
    cargar();
  }

  async function eliminarSesion(sesionId) {
    if (!confirm('¿Eliminar esta sesión? Se borra también la asistencia registrada.')) return;
    if (sesionAbiertaId === sesionId) setSesionAbiertaId(null);
    await api.delete(`/sesiones/${sesionId}`);
    cargar();
  }

  const faltasDestacadas = resumen.filter((r) => r.faltasSinJustificar >= 3);
  const sesionesCancelables = sesiones.filter((s) => !s.esRecuperacion);

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
        <div className="acciones-fila" style={{ marginBottom: 12 }}>
          <button onClick={() => { setMostrarFormulario((v) => !v); setMostrarRecuperacion(false); }}>
            {mostrarFormulario ? 'Cancelar' : '+ Nueva sesión'}
          </button>
          <button className="boton-outline-dorado" onClick={() => { setMostrarRecuperacion((v) => !v); setMostrarFormulario(false); }}>
            {mostrarRecuperacion ? 'Cancelar' : '+ Sesión de recuperación'}
          </button>
        </div>
      )}
      {mostrarFormulario && <FormularioSesion onCrear={crearSesion} />}
      {mostrarRecuperacion && (
        <FormularioRecuperacion
          plantilla={plantilla}
          sesionesCancelables={sesionesCancelables}
          onCrear={crearRecuperacion}
        />
      )}
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
                    <td>
                      {s.esRecuperacion
                        ? `Recuperación${s.titulo ? ` · ${s.titulo}` : ''}`
                        : (s.titulo || '—')}
                      {s.cancelada && s.motivoCancelacion && (
                        <div className="nota" style={{ marginTop: 2 }}>Motivo: {s.motivoCancelacion}</div>
                      )}
                    </td>
                    <td>
                      {s.esRecuperacion ? (
                        <span className="badge-sesion badge-sesion-recuperacion">Recuperación</span>
                      ) : s.cancelada ? (
                        <span className="badge-sesion badge-sesion-cancelada">Cancelada</span>
                      ) : (
                        <span className="badge-sesion badge-sesion-prevista">Prevista</span>
                      )}
                    </td>
                    <td className="acciones-fila">
                      <button
                        className="boton-lesion"
                        onClick={() => setSesionAbiertaId(sesionAbiertaId === s.id ? null : s.id)}
                      >
                        {sesionAbiertaId === s.id ? 'Cerrar' : 'Asistencia'}
                      </button>
                      {puedeGestionar && !s.esRecuperacion && (
                        <button className="boton-lesion" onClick={() => alternarCancelada(s)}>
                          {s.cancelada ? 'Reactivar' : 'Cancelar clase'}
                        </button>
                      )}
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
  const [cancelada, setCancelada] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!fecha) return;
    setError('');
    setEnviando(true);
    try {
      await onCrear({
        fecha,
        horaInicio: horaInicio || undefined,
        titulo: titulo || undefined,
        cancelada,
        motivoCancelacion: cancelada ? (motivoCancelacion || undefined) : undefined,
      });
      setTitulo('');
      setCancelada(false);
      setMotivoCancelacion('');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta formulario-usuario" onSubmit={manejarEnvio} style={{ maxWidth: 460, marginBottom: 16 }}>
      <div className="barra-filtros">
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
      </div>
      <input placeholder="Título (opcional)" value={titulo} onChange={(e) => setTitulo(e.target.value)} />

      <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={cancelada} onChange={(e) => setCancelada(e.target.checked)} />
        Clase cancelada
      </label>
      {cancelada && (
        <div className="aviso-cancelacion">
          <label>
            Motivo de la cancelación
            <input
              value={motivoCancelacion}
              onChange={(e) => setMotivoCancelacion(e.target.value)}
              placeholder="Ej. Lluvia, pista ocupada…"
            />
          </label>
        </div>
      )}

      <button type="submit" disabled={enviando}>{enviando ? 'Creando…' : 'Crear sesión'}</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

// Sesión de recuperación: como pidió Sergio, tanto administración como el
// propio monitor pueden crearla, y es de UN deportista concreto — no de
// toda la plantilla — para recuperar una clase perdida (normalmente una
// cancelada). Aparece en el calendario del deportista en dorado.
function FormularioRecuperacion({ plantilla, sesionesCancelables, onCrear }) {
  const [deportistaId, setDeportistaId] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [horaInicio, setHoraInicio] = useState('');
  const [recuperaSesionId, setRecuperaSesionId] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!deportistaId || !fecha) return;
    setError('');
    setEnviando(true);
    try {
      await onCrear({
        soloDeportistaId: deportistaId,
        fecha,
        horaInicio: horaInicio || undefined,
        recuperaSesionId: recuperaSesionId || undefined,
      });
      setRecuperaSesionId('');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta formulario-usuario tarjeta-recuperacion" onSubmit={manejarEnvio} style={{ maxWidth: 460, marginBottom: 16 }}>
      <p className="nota" style={{ margin: 0 }}>
        Disponible para administración y para el monitor del equipo. Aparece en el calendario del deportista
        en dorado, diferenciada de sus clases habituales.
      </p>
      <label>
        Deportista
        <select value={deportistaId} onChange={(e) => setDeportistaId(e.target.value)} required>
          <option value="">Selecciona un deportista…</option>
          {plantilla.map((d) => <option key={d.id} value={d.id}>{d.nombre} {d.apellidos}</option>)}
        </select>
      </label>
      <div className="barra-filtros">
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
      </div>
      <label>
        Recupera la sesión de (opcional)
        <select value={recuperaSesionId} onChange={(e) => setRecuperaSesionId(e.target.value)}>
          <option value="">— sin enlazar a una sesión concreta —</option>
          {sesionesCancelables.filter((s) => s.cancelada).map((s) => (
            <option key={s.id} value={s.id}>
              {s.fecha?.slice(0, 10)}{s.horaInicio ? ` ${s.horaInicio.slice(0, 5)}` : ''} — cancelada{s.motivoCancelacion ? ` (${s.motivoCancelacion})` : ''}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="boton-outline-dorado" disabled={enviando || !deportistaId}>
        {enviando ? 'Creando…' : '+ Crear recuperación'}
      </button>
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

