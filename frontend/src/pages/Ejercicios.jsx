// Banco de ejercicios: independiente por deporte, con vídeos vinculados
// (Instagram/TikTok). Compartido entre todo el cuerpo técnico: cualquiera
// con rol técnico puede consultarlo y aportar; editar/borrar uno de otro
// compañero es solo para dirección deportiva/administrador/coordinador.
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { colorEtiqueta } from '../utils/colorEtiqueta';

const NATURALEZAS = ['fisica', 'tecnica', 'tactica'];
const TIPOLOGIAS_SUGERIDAS = [
  'calentamiento', 'rondo', 'partido_condicionado', 'juego_reducido',
  'tecnico', 'fisico', 'posesion', 'finalizacion', 'transiciones',
];

export default function Ejercicios() {
  const [deportes, setDeportes] = useState([]);
  const [deporteId, setDeporteId] = useState('');
  const [tipologia, setTipologia] = useState('');
  const [naturaleza, setNaturaleza] = useState('');
  const [q, setQ] = useState('');

  const [ejercicios, setEjercicios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [ejercicioAbiertoId, setEjercicioAbiertoId] = useState(null);

  useEffect(() => {
    api.get('/deportes').then((lista) => {
      setDeportes(lista);
      if (lista.length > 0) setDeporteId(lista[0].id);
    }).catch((err) => setError(err.message));
  }, []);

  async function cargar() {
    if (!deporteId) return;
    setCargando(true);
    try {
      const parametros = new URLSearchParams({ deporteId });
      if (tipologia) parametros.set('tipologia', tipologia);
      if (naturaleza) parametros.set('naturaleza', naturaleza);
      if (q) parametros.set('q', q);
      setEjercicios(await api.get(`/ejercicios?${parametros.toString()}`));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    const temporizador = setTimeout(cargar, 250);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deporteId, tipologia, naturaleza, q]);

  async function crearEjercicio(datos) {
    await api.post('/ejercicios', { ...datos, deporteId });
    setMostrarFormulario(false);
    cargar();
  }

  async function eliminarEjercicio(id) {
    if (!confirm('¿Eliminar este ejercicio del banco?')) return;
    await api.delete(`/ejercicios/${id}`);
    if (ejercicioAbiertoId === id) setEjercicioAbiertoId(null);
    cargar();
  }

  if (ejercicioAbiertoId) {
    return (
      <DetalleEjercicio
        ejercicioId={ejercicioAbiertoId}
        onVolver={() => { setEjercicioAbiertoId(null); cargar(); }}
        onEliminar={() => eliminarEjercicio(ejercicioAbiertoId)}
      />
    );
  }

  return (
    <div className="pantalla-ejercicios">
      <div className="cabecera">
        <h1>Banco de ejercicios</h1>
        <button onClick={() => setMostrarFormulario((v) => !v)}>
          {mostrarFormulario ? 'Cancelar' : '+ Nuevo ejercicio'}
        </button>
      </div>

      <div className="barra-filtros">
        <select value={deporteId} onChange={(e) => setDeporteId(e.target.value)}>
          {deportes.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        <select value={naturaleza} onChange={(e) => setNaturaleza(e.target.value)}>
          <option value="">Cualquier naturaleza</option>
          {NATURALEZAS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <input
          list="tipologias-sugeridas" placeholder="Tipología (ej: rondo)"
          value={tipologia} onChange={(e) => setTipologia(e.target.value)}
        />
        <datalist id="tipologias-sugeridas">
          {TIPOLOGIAS_SUGERIDAS.map((t) => <option key={t} value={t} />)}
        </datalist>
        <input type="search" placeholder="Buscar por título o descripción…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {error && <p className="error">{error}</p>}

      {mostrarFormulario && <FormularioEjercicio onCrear={crearEjercicio} />}

      {cargando ? (
        <p className="cargando">Cargando…</p>
      ) : ejercicios.length === 0 ? (
        <p className="nota">No hay ejercicios en el banco de este deporte con estos filtros.</p>
      ) : (
        <div className="tarjetas-dashboard">
          {ejercicios.map((e) => (
            <div key={e.id} className="tarjeta tarjeta-dashboard tarjeta-ejercicio">
              <button className="boton-enlace titulo-tarjeta-ejercicio" onClick={() => setEjercicioAbiertoId(e.id)}>
                {e.titulo}
              </button>
              <div className="etiquetas-roles" style={{ margin: '4px 0' }}>
                {e.tipologia && <span className={`etiqueta-suave ${colorEtiqueta(e.tipologia)}`}>{e.tipologia}</span>}
                {e.naturaleza && <span className={`etiqueta-suave ${colorEtiqueta(e.naturaleza)}`}>{e.naturaleza}</span>}
                {e.categoriaEdad && <span className={`etiqueta-suave ${colorEtiqueta(e.categoriaEdad)}`}>{e.categoriaEdad}</span>}
              </div>
              {e.descripcion && <p className="nota descripcion-tarjeta-ejercicio">{e.descripcion}</p>}
              <p className="nota" style={{ margin: '4px 0 0' }}>
                {[e.espacio, e.numJugadores ? `${e.numJugadores} jugadores` : null, e.duracionMin ? `${e.duracionMin} min` : null]
                  .filter(Boolean).join(' · ') || 'Sin más detalles'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FormularioEjercicio({ onCrear }) {
  const [campos, setCampos] = useState({
    titulo: '', descripcion: '', tipologia: '', naturaleza: '',
    categoriaEdad: '', espacio: '', numJugadores: '', duracionMin: '',
  });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  function actualizar(campo, valor) {
    setCampos((actuales) => ({ ...actuales, [campo]: valor }));
  }

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!campos.titulo) return;
    setError('');
    setEnviando(true);
    try {
      await onCrear({
        ...campos,
        duracionMin: campos.duracionMin ? Number(campos.duracionMin) : undefined,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta formulario-usuario" onSubmit={manejarEnvio}>
      <label>
        Título
        <input value={campos.titulo} onChange={(e) => actualizar('titulo', e.target.value)} required />
      </label>
      <label>
        Descripción
        <input value={campos.descripcion} onChange={(e) => actualizar('descripcion', e.target.value)} />
      </label>
      <label>
        Naturaleza
        <select value={campos.naturaleza} onChange={(e) => actualizar('naturaleza', e.target.value)}>
          <option value="">Sin indicar</option>
          {NATURALEZAS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <label>
        Tipología
        <input
          list="tipologias-sugeridas" value={campos.tipologia}
          onChange={(e) => actualizar('tipologia', e.target.value)}
        />
      </label>
      <label>
        Categoría de edad (ej: +U11)
        <input value={campos.categoriaEdad} onChange={(e) => actualizar('categoriaEdad', e.target.value)} />
      </label>
      <label>
        Espacio (ej: Medio campo)
        <input value={campos.espacio} onChange={(e) => actualizar('espacio', e.target.value)} />
      </label>
      <label>
        Nº de jugadores (ej: 11-19)
        <input value={campos.numJugadores} onChange={(e) => actualizar('numJugadores', e.target.value)} />
      </label>
      <label>
        Duración (minutos)
        <input type="number" min="0" value={campos.duracionMin} onChange={(e) => actualizar('duracionMin', e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={enviando}>{enviando ? 'Creando…' : 'Crear ejercicio'}</button>
    </form>
  );
}

function DetalleEjercicio({ ejercicioId, onVolver, onEliminar }) {
  const [ejercicio, setEjercicio] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  async function cargar() {
    setCargando(true);
    try {
      setEjercicio(await api.get(`/ejercicios/${ejercicioId}`));
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
  }, [ejercicioId]);

  async function anadirVideo(datos) {
    await api.post(`/ejercicios/${ejercicioId}/videos`, datos);
    cargar();
  }

  async function eliminarVideo(videoId) {
    if (!confirm('¿Quitar este vídeo del ejercicio?')) return;
    await api.delete(`/ejercicios/videos/${videoId}`);
    cargar();
  }

  if (cargando) return <p className="cargando">Cargando…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!ejercicio) return null;

  return (
    <div className="pantalla-ejercicio-detalle">
      <button className="boton-enlace" onClick={onVolver}>‹ Volver al banco de ejercicios</button>

      <div className="cabecera">
        <h1>{ejercicio.titulo}</h1>
        <button className="boton-peligro" onClick={onEliminar}>Eliminar ejercicio</button>
      </div>

      {ejercicio.descripcion && <p>{ejercicio.descripcion}</p>}
      <p className="nota">
        {ejercicio.deporteNombre}
        {ejercicio.naturaleza && ` · ${ejercicio.naturaleza}`}
        {ejercicio.tipologia && ` · ${ejercicio.tipologia}`}
        {ejercicio.categoriaEdad && ` · ${ejercicio.categoriaEdad}`}
        {ejercicio.espacio && ` · ${ejercicio.espacio}`}
        {ejercicio.numJugadores && ` · ${ejercicio.numJugadores} jugadores`}
        {ejercicio.duracionMin && ` · ${ejercicio.duracionMin} min`}
      </p>

      <h2>Vídeos</h2>
      {ejercicio.videos.length === 0 ? (
        <p className="nota">Todavía no hay ningún vídeo vinculado.</p>
      ) : (
        <ul className="lista-dashboard" style={{ marginBottom: 16 }}>
          {ejercicio.videos.map((v) => (
            <li key={v.id}>
              <a href={v.urlOriginal} target="_blank" rel="noreferrer">{v.titulo || v.urlOriginal}</a>
              <span className="nota"> — {v.plataforma}{v.autor ? ` · ${v.autor}` : ''}</span>
              {' '}
              <button className="boton-enlace" onClick={() => eliminarVideo(v.id)}>quitar</button>
            </li>
          ))}
        </ul>
      )}
      <FormularioVideo onAnadir={anadirVideo} />
    </div>
  );
}

function FormularioVideo({ onAnadir }) {
  const [titulo, setTitulo] = useState('');
  const [urlOriginal, setUrlOriginal] = useState('');
  const [plataforma, setPlataforma] = useState('instagram');
  const [autor, setAutor] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!urlOriginal) return;
    setError('');
    setEnviando(true);
    try {
      await onAnadir({ titulo: titulo || undefined, urlOriginal, plataforma, autor: autor || undefined });
      setTitulo('');
      setUrlOriginal('');
      setAutor('');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="barra-filtros" onSubmit={manejarEnvio}>
      <input placeholder="Enlace (Instagram/TikTok…)" value={urlOriginal} onChange={(e) => setUrlOriginal(e.target.value)} required />
      <select value={plataforma} onChange={(e) => setPlataforma(e.target.value)}>
        <option value="instagram">Instagram</option>
        <option value="tiktok">TikTok</option>
        <option value="otro">Otro</option>
      </select>
      <input placeholder="Título (opcional)" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      <input placeholder="Autor (opcional)" value={autor} onChange={(e) => setAutor(e.target.value)} />
      <button type="submit" disabled={enviando}>{enviando ? 'Añadiendo…' : 'Añadir vídeo'}</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
