// Días festivos del club: no se entrena. Al crear uno se marca a qué
// equipos afecta (ver backend/src/routes/festivos.js) — cancela de
// inmediato las sesiones ya existentes de esos equipos en esa fecha, y
// las que se generen después para esa fecha salen ya canceladas.
import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Festivos() {
  const [festivos, setFestivos] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      setFestivos(await api.get('/festivos'));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    api.get('/equipos?estado=activo').then(setEquipos).catch(() => {});
  }, []);

  async function crear(datos) {
    const r = await api.post('/festivos', datos);
    setMostrarFormulario(false);
    cargar();
    return r;
  }

  async function eliminar(id) {
    if (!confirm('¿Quitar este festivo? No reactivará las sesiones que canceló; si alguna debe jugarse, reactívala a mano desde el equipo.')) return;
    await api.delete(`/festivos/${id}`);
    cargar();
  }

  return (
    <div className="pantalla-festivos">
      <div className="cabecera">
        <h1>📅 Días festivos</h1>
        <button onClick={() => setMostrarFormulario((v) => !v)}>
          {mostrarFormulario ? 'Cancelar' : '+ Nuevo festivo'}
        </button>
      </div>
      <p className="nota">
        Marca aquí los días en los que no se entrena. Al crear uno, eliges a qué equipos afecta;
        sus sesiones ya existentes en esa fecha se cancelan solas, y las que se generen después
        para esa fecha salen ya canceladas. Si algún equipo sí entrena ese día, reactiva su sesión
        a mano desde su ficha (botón "Reactivar").
      </p>

      {error && <p className="error">{error}</p>}

      {mostrarFormulario && <FormularioFestivo equipos={equipos} onCrear={crear} />}

      {cargando ? (
        <p className="cargando">Cargando…</p>
      ) : festivos.length === 0 ? (
        <p className="nota">Todavía no hay ningún festivo marcado.</p>
      ) : (
        <div className="tarjetas-dashboard">
          {festivos.map((f) => (
            <div key={f.id} className="tarjeta tarjeta-dashboard">
              <h3 style={{ margin: 0 }}>{f.fecha?.slice(0, 10)}</h3>
              <p style={{ margin: '4px 0' }}>{f.descripcion}</p>
              <div className="etiquetas-roles" style={{ margin: '4px 0' }}>
                {f.equipos.length === 0 ? (
                  <span className="nota">Sin equipos afectados</span>
                ) : (
                  f.equipos.map((e) => <span key={e.id} className="etiqueta-suave">{e.nombre}</span>)
                )}
              </div>
              <button className="boton-peligro" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={() => eliminar(f.id)}>
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FormularioFestivo({ equipos, onCrear }) {
  const [fecha, setFecha] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [equipoIds, setEquipoIds] = useState([]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  function alternarEquipo(id) {
    setEquipoIds((actuales) => (actuales.includes(id) ? actuales.filter((e) => e !== id) : [...actuales, id]));
  }

  function marcarTodos() {
    setEquipoIds(equipos.map((e) => e.id));
  }

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!fecha || !descripcion.trim() || equipoIds.length === 0) return;
    setError('');
    setEnviando(true);
    try {
      const r = await onCrear({ fecha, descripcion: descripcion.trim(), equipoIds });
      setResultado(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta formulario-usuario" onSubmit={manejarEnvio} style={{ maxWidth: 560 }}>
      <label>
        Fecha
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
      </label>
      <label>
        Motivo (ej: Navidad, puente de diciembre…)
        <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} required />
      </label>
      <div className="acciones-fila" style={{ marginBottom: 4 }}>
        <span className="nota" style={{ margin: 0 }}>¿A qué equipos afecta?</span>
        <button type="button" className="boton-enlace" onClick={marcarTodos}>marcar todos</button>
      </div>
      <div className="checkboxes-roles" style={{ maxHeight: 220, overflowY: 'auto' }}>
        {equipos.map((eq) => (
          <label key={eq.id}>
            <input type="checkbox" checked={equipoIds.includes(eq.id)} onChange={() => alternarEquipo(eq.id)} />
            {eq.nombre} ({eq.deporteNombre})
          </label>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={enviando}>{enviando ? 'Guardando…' : 'Crear festivo'}</button>
      {resultado && (
        <p className="nota">{resultado.sesionesCanceladas} sesión(es) ya existente(s) cancelada(s) automáticamente.</p>
      )}
    </form>
  );
}
