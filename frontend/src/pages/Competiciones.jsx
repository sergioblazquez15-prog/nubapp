// Gestión de competición: liga, copa, torneo o amistosos, por equipo y
// temporada. Antes esto era un campo de texto libre en cada partido; aquí
// se gestiona como catálogo propio, y al crear un partido se elige de esta
// lista (ver FormularioPartido en Equipos.jsx).
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const ETIQUETAS_TIPO = { liga: 'Liga', copa: 'Copa', torneo: 'Torneo', amistoso: 'Amistoso' };
const CLASES_TIPO = { liga: 'etiqueta-liga', copa: 'etiqueta-copa', torneo: 'etiqueta-torneo', amistoso: 'etiqueta-amistoso' };

export default function Competiciones() {
  const { tieneRol } = useAuth();
  const puedeGestionar = tieneRol('administrador', 'direccion_deportiva', 'coordinador', 'entrenador', 'monitor');

  const [temporadas, setTemporadas] = useState([]);
  const [temporadaId, setTemporadaId] = useState('');
  const [equipos, setEquipos] = useState([]);
  const [equipoId, setEquipoId] = useState('');

  const [competiciones, setCompeticiones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  useEffect(() => {
    api.get('/temporadas').then((lista) => {
      setTemporadas(lista);
      const principal = lista.find((t) => t.esPrincipal) || lista[0];
      if (principal) setTemporadaId(principal.id);
    }).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!temporadaId) return;
    api.get(`/equipos?temporadaId=${temporadaId}&estado=activo`).then((lista) => {
      const deEquipo = lista.filter((e) => e.deporteTipo === 'equipo');
      setEquipos(deEquipo);
      setEquipoId((actual) => (deEquipo.some((e) => e.id === actual) ? actual : (deEquipo[0]?.id || '')));
    }).catch((err) => setError(err.message));
  }, [temporadaId]);

  async function cargar() {
    if (!equipoId || !temporadaId) { setCompeticiones([]); return; }
    setCargando(true);
    try {
      setCompeticiones(await api.get(`/competiciones?equipoId=${equipoId}&temporadaId=${temporadaId}`));
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

  async function crear(datos) {
    await api.post('/competiciones', { ...datos, equipoId, temporadaId });
    setMostrarFormulario(false);
    cargar();
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta competición? Los partidos asociados no se borran, se quedan sin competición.')) return;
    await api.delete(`/competiciones/${id}`);
    cargar();
  }

  return (
    <div className="pantalla-competiciones">
      <div className="cabecera">
        <h1>🏆 Competición</h1>
        {puedeGestionar && equipoId && (
          <button onClick={() => setMostrarFormulario((v) => !v)}>
            {mostrarFormulario ? 'Cancelar' : '+ Nueva competición'}
          </button>
        )}
      </div>
      <p className="nota">
        Ligas, copas, torneos o tandas de amistosos, por equipo y temporada. Al crear un partido
        en la ficha del equipo, se elige aquí la competición a la que pertenece (o se deja como
        amistoso suelto).
      </p>

      <div className="barra-filtros">
        <select value={temporadaId} onChange={(e) => setTemporadaId(e.target.value)}>
          {temporadas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
        <select value={equipoId} onChange={(e) => setEquipoId(e.target.value)}>
          {equipos.length === 0 && <option value="">Sin equipos de deporte de equipo</option>}
          {equipos.map((e) => (
            <option key={e.id} value={e.id}>{e.nombre} ({e.deporteNombre})</option>
          ))}
        </select>
      </div>

      {error && <p className="error">{error}</p>}

      {mostrarFormulario && puedeGestionar && equipoId && (
        <FormularioCompeticion onCrear={crear} />
      )}

      {cargando ? (
        <p className="cargando">Cargando…</p>
      ) : !equipoId ? (
        <p className="nota">Selecciona un equipo de deporte de equipo (fútbol o baloncesto) para gestionar su competición.</p>
      ) : competiciones.length === 0 ? (
        <p className="nota">Este equipo todavía no tiene ninguna competición dada de alta esta temporada.</p>
      ) : (
        <div className="tarjetas-dashboard">
          {competiciones.map((c) => (
            <div key={c.id} className="tarjeta tarjeta-dashboard tarjeta-competicion">
              <div className="cabecera-competicion">
                <h3>{c.nombre}</h3>
                <span className={`etiqueta-suave ${CLASES_TIPO[c.tipo] || ''}`}>{ETIQUETAS_TIPO[c.tipo] || c.tipo}</span>
              </div>
              {puedeGestionar && (
                <button className="boton-peligro" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={() => eliminar(c.id)}>
                  Eliminar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FormularioCompeticion({ onCrear }) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('liga');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!nombre) return;
    setError('');
    setEnviando(true);
    try {
      await onCrear({ nombre, tipo });
      setNombre('');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta formulario-usuario" onSubmit={manejarEnvio}>
      <label>
        Nombre
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Liga Infantil Grupo 3" required />
      </label>
      <label>
        Tipo
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="liga">Liga</option>
          <option value="copa">Copa</option>
          <option value="torneo">Torneo</option>
          <option value="amistoso">Amistoso</option>
        </select>
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={enviando}>{enviando ? 'Creando…' : 'Crear competición'}</button>
    </form>
  );
}
