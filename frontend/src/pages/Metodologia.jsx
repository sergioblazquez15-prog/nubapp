// Metodología: documentos de texto libre (principios de juego, objetivos
// por categoría, sistema de entrenamiento...) por deporte o generales para
// todo el club. Primera versión sin capturas de referencia de MísterCoach —
// se afinará más adelante. Todo el cuerpo técnico puede consultar; solo
// dirección deportiva/administrador/coordinador puede crear, editar o
// eliminar documentos (mismo criterio que el banco de ejercicios).
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { colorEtiqueta } from '../utils/colorEtiqueta';

export default function Metodologia() {
  const { tieneRol } = useAuth();
  const puedeEditar = tieneRol('administrador', 'direccion_deportiva', 'coordinador');

  const [deportes, setDeportes] = useState([]);
  const [deporteId, setDeporteId] = useState('');

  const [documentos, setDocumentos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [documentoAbiertoId, setDocumentoAbiertoId] = useState(null);

  useEffect(() => {
    api.get('/deportes').then(setDeportes).catch((err) => setError(err.message));
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      const parametros = new URLSearchParams();
      if (deporteId) parametros.set('deporteId', deporteId);
      const query = parametros.toString();
      setDocumentos(await api.get(`/metodologia${query ? `?${query}` : ''}`));
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
  }, [deporteId]);

  async function crearDocumento(datos) {
    await api.post('/metodologia', datos);
    setMostrarFormulario(false);
    cargar();
  }

  async function eliminarDocumento(id) {
    if (!confirm('¿Eliminar este documento de metodología?')) return;
    await api.delete(`/metodologia/${id}`);
    if (documentoAbiertoId === id) setDocumentoAbiertoId(null);
    cargar();
  }

  if (documentoAbiertoId) {
    return (
      <DetalleDocumento
        documentoId={documentoAbiertoId}
        puedeEditar={puedeEditar}
        onVolver={() => { setDocumentoAbiertoId(null); cargar(); }}
        onEliminar={() => eliminarDocumento(documentoAbiertoId)}
      />
    );
  }

  return (
    <div className="pantalla-metodologia">
      <div className="cabecera">
        <h1>Metodología</h1>
        {puedeEditar && (
          <button onClick={() => setMostrarFormulario((v) => !v)}>
            {mostrarFormulario ? 'Cancelar' : '+ Nuevo documento'}
          </button>
        )}
      </div>
      <p className="nota">
        Principios de juego, objetivos por categoría, sistema de entrenamiento… Los documentos
        generales aplican a todo el club; los de un deporte concreto se muestran además al
        consultar ese deporte.
      </p>

      <div className="barra-filtros">
        <select value={deporteId} onChange={(e) => setDeporteId(e.target.value)}>
          <option value="">Solo documentos generales del club</option>
          {deportes.map((d) => (
            <option key={d.id} value={d.id}>{d.nombre} (+ generales)</option>
          ))}
        </select>
      </div>

      {error && <p className="error">{error}</p>}

      {mostrarFormulario && puedeEditar && (
        <FormularioDocumento deportes={deportes} onCrear={crearDocumento} />
      )}

      {cargando ? (
        <p className="cargando">Cargando…</p>
      ) : documentos.length === 0 ? (
        <p className="nota">No hay documentos de metodología con estos filtros todavía.</p>
      ) : (
        <div className="tarjetas-dashboard">
          {documentos.map((doc) => (
            <div key={doc.id} className="tarjeta tarjeta-dashboard tarjeta-metodologia">
              <span className="icono-metodologia">📚</span>
              <button className="boton-enlace titulo-tarjeta-ejercicio" onClick={() => setDocumentoAbiertoId(doc.id)}>
                {doc.titulo}
              </button>
              <span className={`etiqueta-suave ${colorEtiqueta(doc.deporteNombre || 'General')}`}>
                {doc.deporteNombre ? doc.deporteNombre : 'Todo el club'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FormularioDocumento({ deportes, onCrear }) {
  const [titulo, setTitulo] = useState('');
  const [deporteId, setDeporteId] = useState('');
  const [contenido, setContenido] = useState('');
  const [orden, setOrden] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!titulo) return;
    setError('');
    setEnviando(true);
    try {
      await onCrear({
        titulo,
        deporteId: deporteId || undefined,
        contenido,
        orden: orden ? Number(orden) : undefined,
      });
      setTitulo('');
      setContenido('');
      setOrden('');
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
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
      </label>
      <label>
        Ámbito
        <select value={deporteId} onChange={(e) => setDeporteId(e.target.value)}>
          <option value="">General (todo el club)</option>
          {deportes.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
      </label>
      <label>
        Contenido
        <textarea rows={6} value={contenido} onChange={(e) => setContenido(e.target.value)} />
      </label>
      <label>
        Orden (opcional, para ordenar dentro del mismo ámbito)
        <input type="number" value={orden} onChange={(e) => setOrden(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={enviando}>{enviando ? 'Creando…' : 'Crear documento'}</button>
    </form>
  );
}

function DetalleDocumento({ documentoId, puedeEditar, onVolver, onEliminar }) {
  const [documento, setDocumento] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      setDocumento(await api.get(`/metodologia/${documentoId}`));
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
  }, [documentoId]);

  async function guardar(datos) {
    await api.put(`/metodologia/${documentoId}`, datos);
    setEditando(false);
    cargar();
  }

  if (cargando) return <p className="cargando">Cargando…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!documento) return null;

  return (
    <div className="pantalla-metodologia-detalle">
      <button className="boton-enlace" onClick={onVolver}>‹ Volver a metodología</button>

      <div className="cabecera">
        <h1>📚 {documento.titulo}</h1>
        {puedeEditar && (
          <div>
            <button onClick={() => setEditando((v) => !v)}>{editando ? 'Cancelar' : 'Editar'}</button>
            {' '}
            <button className="boton-peligro" onClick={onEliminar}>Eliminar</button>
          </div>
        )}
      </div>
      <span className={`etiqueta-suave ${colorEtiqueta(documento.deporteNombre || 'General')}`}>
        {documento.deporteNombre ? documento.deporteNombre : 'Documento general del club'}
      </span>

      <div className="bloque-ficha" style={{ marginTop: 14 }}>
        {editando ? (
          <FormularioEdicion documento={documento} onGuardar={guardar} />
        ) : (
          documento.contenido
            ? <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{documento.contenido}</p>
            : <p className="nota" style={{ margin: 0 }}>Este documento todavía no tiene contenido.</p>
        )}
      </div>
    </div>
  );
}

function FormularioEdicion({ documento, onGuardar }) {
  const [titulo, setTitulo] = useState(documento.titulo);
  const [contenido, setContenido] = useState(documento.contenido || '');
  const [orden, setOrden] = useState(documento.orden ?? 0);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await onGuardar({ titulo, contenido, orden: Number(orden) });
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
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
      </label>
      <label>
        Contenido
        <textarea rows={10} value={contenido} onChange={(e) => setContenido(e.target.value)} />
      </label>
      <label>
        Orden
        <input type="number" value={orden} onChange={(e) => setOrden(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar cambios'}</button>
    </form>
  );
}
