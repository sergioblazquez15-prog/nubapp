// Fichas individuales de deportistas (Gestión deportiva). El alta/edición
// de la ficha general y de los deportes que practica es solo para
// administrador, dirección deportiva y coordinador; marcar lesión también
// lo puede hacer el entrenador de ese equipo (el backend ya filtra las
// filas según a qué equipos tiene acceso cada usuario).
//
// Dar de baja es siempre baja LÓGICA: no se borra ni se toca ningún dato
// (nº de socio incluido), solo se marca como inactivo. Por eso se puede
// "dar de alta" otra vez sin perder nada de su historial.
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const GESTION_DEPORTIVA = ['administrador', 'direccion_deportiva', 'coordinador'];

export default function Deportistas() {
  const { tieneRol } = useAuth();
  const puedeGestionar = tieneRol(...GESTION_DEPORTIVA);

  const [deportistas, setDeportistas] = useState([]);
  const [deportesDisponibles, setDeportesDisponibles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [deportistaAbiertoId, setDeportistaAbiertoId] = useState(null);

  const [filtros, setFiltros] = useState({ q: '', deporteId: '', estado: 'activo' });

  async function cargarDeportistas(filtrosActuales = filtros) {
    setCargando(true);
    try {
      const parametros = new URLSearchParams();
      if (filtrosActuales.q) parametros.set('q', filtrosActuales.q);
      if (filtrosActuales.deporteId) parametros.set('deporteId', filtrosActuales.deporteId);
      if (filtrosActuales.estado) parametros.set('estado', filtrosActuales.estado);
      setDeportistas(await api.get(`/deportistas?${parametros.toString()}`));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    api.get('/deportes').then(setDeportesDisponibles).catch(() => {});
    cargarDeportistas();
  }, []);

  // Vuelve a pedir la lista cada vez que cambia algún filtro (con un
  // pequeño margen para no lanzar una petición por cada letra tecleada).
  useEffect(() => {
    const temporizador = setTimeout(() => cargarDeportistas(filtros), 300);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.q, filtros.deporteId, filtros.estado]);

  function actualizarFiltro(campo, valor) {
    setFiltros((actuales) => ({ ...actuales, [campo]: valor }));
  }

  async function alternarLesion(deportista) {
    const lesionado = !deportista.lesionado;
    let lesionDetalle;
    if (lesionado) {
      lesionDetalle = prompt('¿Qué lesión tiene? (opcional)') || undefined;
    }
    await api.put(`/deportistas/${deportista.id}/lesion`, { lesionado, lesionDetalle });
    cargarDeportistas();
  }

  async function guardarDeportes(deportistaId, deporteIds) {
    await api.put(`/deportistas/${deportistaId}/deportes`, {
      deportes: deporteIds.map((deporteId) => ({ deporteId })),
    });
    cargarDeportistas();
  }

  async function darDeBaja(id) {
    if (!confirm('¿Dar de baja a este deportista? No se pierde ningún dato: se puede dar de alta otra vez cuando quieras.')) return;
    await api.delete(`/deportistas/${id}`);
    cargarDeportistas();
  }

  async function darDeAlta(id) {
    await api.put(`/deportistas/${id}`, { inactivo: false });
    cargarDeportistas();
  }

  if (deportistaAbiertoId) {
    return (
      <DeportistaDetalle
        deportistaId={deportistaAbiertoId}
        puedeGestionar={puedeGestionar}
        onVolver={() => {
          setDeportistaAbiertoId(null);
          cargarDeportistas();
        }}
      />
    );
  }

  return (
    <div className="pantalla-deportistas">
      <div className="cabecera">
        <h1>Fichas de deportistas</h1>
        {puedeGestionar && (
          <button onClick={() => setMostrarFormulario((v) => !v)}>
            {mostrarFormulario ? 'Cancelar' : '+ Nuevo deportista'}
          </button>
        )}
      </div>

      <div className="barra-filtros">
        <input
          type="search"
          placeholder="Buscar por nombre, apellidos o nº de socio…"
          value={filtros.q}
          onChange={(e) => actualizarFiltro('q', e.target.value)}
        />
        <select value={filtros.deporteId} onChange={(e) => actualizarFiltro('deporteId', e.target.value)}>
          <option value="">Todos los deportes</option>
          {deportesDisponibles.map((d) => (
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
        <FormularioDeportista
          deportesDisponibles={deportesDisponibles}
          onCreado={() => {
            setMostrarFormulario(false);
            cargarDeportistas();
          }}
        />
      )}

      {cargando ? (
        <p className="cargando">Cargando…</p>
      ) : deportistas.length === 0 ? (
        <p className="nota">No hay deportistas que coincidan con estos filtros.</p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla-usuarios">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Fecha nacimiento</th>
                <th>Nº socio</th>
                <th>Deportes</th>
                <th>Lesionado</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {deportistas.map((d) => (
                <FilaDeportista
                  key={d.id}
                  deportista={d}
                  puedeGestionar={puedeGestionar}
                  deportesDisponibles={deportesDisponibles}
                  onGuardarDeportes={(ids) => guardarDeportes(d.id, ids)}
                  onAlternarLesion={() => alternarLesion(d)}
                  onDarDeBaja={() => darDeBaja(d.id)}
                  onDarDeAlta={() => darDeAlta(d.id)}
                  onVerFicha={() => setDeportistaAbiertoId(d.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilaDeportista({ deportista: d, puedeGestionar, deportesDisponibles, onGuardarDeportes, onAlternarLesion, onDarDeBaja, onDarDeAlta, onVerFicha }) {
  const [editandoDeportes, setEditandoDeportes] = useState(false);
  const [seleccionados, setSeleccionados] = useState(d.deportes.map((dep) => dep.id));

  function alternarDeporte(deporteId) {
    setSeleccionados((actuales) =>
      actuales.includes(deporteId) ? actuales.filter((id) => id !== deporteId) : [...actuales, deporteId]
    );
  }

  async function guardar() {
    await onGuardarDeportes(seleccionados);
    setEditandoDeportes(false);
  }

  return (
    <tr className={d.inactivo ? 'fila-inactiva' : ''}>
      <td>
        {d.nombre} {d.apellidos}
        {d.nombreDeportivo && <span className="nota"> ({d.nombreDeportivo})</span>}
      </td>
      <td>{d.fechaNacimiento?.slice(0, 10) || '—'}</td>
      <td>{d.numeroSocio || '—'}</td>
      <td>
        {editandoDeportes ? (
          <div className="checkboxes-roles">
            {deportesDisponibles.map((dep) => (
              <label key={dep.id}>
                <input
                  type="checkbox"
                  checked={seleccionados.includes(dep.id)}
                  onChange={() => alternarDeporte(dep.id)}
                />
                {dep.nombre}
              </label>
            ))}
            <button onClick={guardar}>Guardar</button>
          </div>
        ) : (
          <div className="etiquetas-roles">
            {d.deportes.length === 0
              ? <span className="nota">—</span>
              : d.deportes.map((dep) => <span key={dep.id} className="etiqueta-suave">{dep.nombre}</span>)}
            {puedeGestionar && (
              <button className="boton-enlace" onClick={() => setEditandoDeportes(true)}>
                editar
              </button>
            )}
          </div>
        )}
      </td>
      <td>
        <button className="boton-lesion" onClick={onAlternarLesion}>
          {d.lesionado ? `Lesionado${d.lesionDetalle ? `: ${d.lesionDetalle}` : ''}` : 'No'}
        </button>
      </td>
      <td>{d.inactivo ? 'Inactivo' : 'Activo'}</td>
      <td className="acciones-fila">
        <button className="boton-lesion" onClick={onVerFicha}>Ver ficha</button>
        {puedeGestionar && (d.inactivo ? (
          <button onClick={onDarDeAlta}>Dar de alta</button>
        ) : (
          <button className="boton-peligro" onClick={onDarDeBaja}>Dar de baja</button>
        ))}
      </td>
    </tr>
  );
}

function FormularioDeportista({ deportesDisponibles, onCreado }) {
  const [campos, setCampos] = useState({
    nombre: '',
    apellidos: '',
    fechaNacimiento: '',
    numeroSocio: '',
    nombreDeportivo: '',
    dni: '',
    telefonoDeportista: '',
    telefonoPadre: '',
    telefonoMadre: '',
    email: '',
  });
  const [deportesElegidos, setDeportesElegidos] = useState([]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  function actualizarCampo(campo, valor) {
    setCampos((actuales) => ({ ...actuales, [campo]: valor }));
  }

  function alternarDeporte(deporteId) {
    setDeportesElegidos((actuales) =>
      actuales.includes(deporteId) ? actuales.filter((id) => id !== deporteId) : [...actuales, deporteId]
    );
  }

  async function manejarEnvio(evento) {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await api.post('/deportistas', {
        ...campos,
        numeroSocio: campos.numeroSocio || undefined,
        nombreDeportivo: campos.nombreDeportivo || undefined,
        dni: campos.dni || undefined,
        telefonoDeportista: campos.telefonoDeportista || undefined,
        telefonoPadre: campos.telefonoPadre || undefined,
        telefonoMadre: campos.telefonoMadre || undefined,
        email: campos.email || undefined,
        deportes: deportesElegidos.map((deporteId) => ({ deporteId })),
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
        Nombre
        <input value={campos.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} required />
      </label>
      <label>
        Apellidos
        <input value={campos.apellidos} onChange={(e) => actualizarCampo('apellidos', e.target.value)} required />
      </label>
      <label>
        Fecha de nacimiento
        <input
          type="date"
          value={campos.fechaNacimiento}
          onChange={(e) => actualizarCampo('fechaNacimiento', e.target.value)}
          required
        />
      </label>
      <label>
        Nombre deportivo (alias, opcional)
        <input value={campos.nombreDeportivo} onChange={(e) => actualizarCampo('nombreDeportivo', e.target.value)} />
      </label>
      <label>
        Nº de socio (opcional)
        <input value={campos.numeroSocio} onChange={(e) => actualizarCampo('numeroSocio', e.target.value)} />
      </label>
      <label>
        DNI (opcional)
        <input value={campos.dni} onChange={(e) => actualizarCampo('dni', e.target.value)} />
      </label>
      <label>
        Teléfono del deportista
        <input value={campos.telefonoDeportista} onChange={(e) => actualizarCampo('telefonoDeportista', e.target.value)} />
      </label>
      <label>
        Teléfono del padre/tutor 1
        <input value={campos.telefonoPadre} onChange={(e) => actualizarCampo('telefonoPadre', e.target.value)} />
      </label>
      <label>
        Teléfono de la madre/tutor 2
        <input value={campos.telefonoMadre} onChange={(e) => actualizarCampo('telefonoMadre', e.target.value)} />
      </label>
      <label>
        Email (opcional)
        <input type="email" value={campos.email} onChange={(e) => actualizarCampo('email', e.target.value)} />
      </label>

      <label>
        Deporte(s) que practica
        <div className="checkboxes-roles">
          {deportesDisponibles.map((dep) => (
            <label key={dep.id}>
              <input
                type="checkbox"
                checked={deportesElegidos.includes(dep.id)}
                onChange={() => alternarDeporte(dep.id)}
              />
              {dep.nombre}
            </label>
          ))}
        </div>
      </label>

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={enviando}>
        {enviando ? 'Creando…' : 'Crear ficha'}
      </button>
    </form>
  );
}

// ---------- ficha completa: datos editables + historial de deportes ----------

function DeportistaDetalle({ deportistaId, puedeGestionar, onVolver }) {
  const { tieneRol } = useAuth();
  const puedeVerCuotas = tieneRol('administrador', 'direccion_deportiva');
  const [deportista, setDeportista] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [deportesDisponibles, setDeportesDisponibles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  async function cargarTodo() {
    setCargando(true);
    try {
      const [datos, periodos] = await Promise.all([
        api.get(`/deportistas/${deportistaId}`),
        api.get(`/deportistas/${deportistaId}/historial-deportes`),
      ]);
      setDeportista(datos);
      setHistorial(periodos);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarTodo();
    api.get('/deportes').then(setDeportesDisponibles).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deportistaId]);

  async function guardarDatos(campos) {
    await api.put(`/deportistas/${deportistaId}`, campos);
    cargarTodo();
  }

  async function anadirPeriodo(datos) {
    await api.post(`/deportistas/${deportistaId}/historial-deportes`, datos);
    cargarTodo();
  }

  async function guardarFechasPeriodo(historialId, fechaAlta, fechaBaja) {
    await api.put(`/deportistas/${deportistaId}/historial-deportes/${historialId}`, { fechaAlta, fechaBaja });
    cargarTodo();
  }

  async function eliminarPeriodo(historialId) {
    if (!confirm('¿Eliminar este periodo del historial? No se puede deshacer.')) return;
    await api.delete(`/deportistas/${deportistaId}/historial-deportes/${historialId}`);
    cargarTodo();
  }

  if (cargando) return <p className="cargando">Cargando…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!deportista) return null;

  return (
    <div className="pantalla-deportista-detalle">
      <button className="boton-enlace" onClick={onVolver}>
        ‹ Volver a deportistas
      </button>

      <div className="cabecera">
        <h1>
          {deportista.nombre} {deportista.apellidos}
          {deportista.inactivo && <span className="etiqueta-suave"> inactivo</span>}
        </h1>
      </div>

      <h2>Datos generales</h2>
      {puedeGestionar ? (
        <FormularioDatosGenerales deportista={deportista} onGuardar={guardarDatos} />
      ) : (
        <DatosGeneralesSoloLectura deportista={deportista} />
      )}

      <h2>Historial de deportes practicados</h2>
      {historial.length === 0 ? (
        <p className="nota">Todavía no hay ningún periodo registrado.</p>
      ) : (
        <div className="tabla-scroll" style={{ marginBottom: 16 }}>
          <table className="tabla-usuarios">
            <thead>
              <tr>
                <th>Deporte</th>
                <th>Desde</th>
                <th>Hasta</th>
                <th>Estado</th>
                {puedeGestionar && <th></th>}
              </tr>
            </thead>
            <tbody>
              {historial.map((periodo) => (
                <FilaHistorial
                  key={periodo.id}
                  periodo={periodo}
                  puedeGestionar={puedeGestionar}
                  onGuardarFechas={(fechaAlta, fechaBaja) => guardarFechasPeriodo(periodo.id, fechaAlta, fechaBaja)}
                  onEliminar={() => eliminarPeriodo(periodo.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {puedeGestionar && (
        <FormularioNuevoPeriodo deportesDisponibles={deportesDisponibles} onAnadir={anadirPeriodo} />
      )}

      <h2>Histórico de cuotas</h2>
      {puedeVerCuotas ? (
        <HistoricoCuotas deportistaId={deportistaId} />
      ) : (
        <p className="nota">No tienes acceso a la información económica de este deportista.</p>
      )}
    </div>
  );
}

// Resumen de cuotas de este deportista (todas las temporadas). La gestión
// completa (crear cuota, registrar pagos, previsión mensual…) vive en la
// pantalla de Cuotas — aquí solo se consulta de un vistazo.
function HistoricoCuotas({ deportistaId }) {
  const [cuotas, setCuotas] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/cuotas/deportista/${deportistaId}`)
      .then(setCuotas)
      .catch((err) => setError(err.message));
  }, [deportistaId]);

  if (error) return <p className="nota">No se ha podido consultar el histórico de cuotas ({error}).</p>;
  if (cuotas === null) return <p className="cargando">Cargando…</p>;
  if (cuotas.length === 0) return <p className="nota">Todavía no tiene ninguna cuota dada de alta.</p>;

  return (
    <div className="tabla-scroll" style={{ marginBottom: 16 }}>
      <table className="tabla-usuarios">
        <thead>
          <tr>
            <th>Deporte</th>
            <th>Total a pagar</th>
            <th>Pagado</th>
            <th>Pendiente</th>
          </tr>
        </thead>
        <tbody>
          {cuotas.map((c) => (
            <tr key={c.id}>
              <td>{c.deporteNombre}</td>
              <td>{c.totalAPagar.toFixed(2)} €</td>
              <td>{c.totalPagado.toFixed(2)} €</td>
              <td className={c.pendiente > 0.001 ? 'texto-peligro' : ''}>{c.pendiente.toFixed(2)} €</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DatosGeneralesSoloLectura({ deportista: d }) {
  return (
    <div className="tarjeta formulario-usuario">
      <p><strong>Nombre:</strong> {d.nombre} {d.apellidos}</p>
      <p><strong>Fecha de nacimiento:</strong> {d.fechaNacimiento?.slice(0, 10) || '—'}</p>
      <p><strong>Nº de socio:</strong> {d.numeroSocio || '—'}</p>
      <p><strong>DNI:</strong> {d.dni || '—'}</p>
      <p><strong>Teléfono deportista:</strong> {d.telefonoDeportista || '—'}</p>
      <p><strong>Teléfono padre/tutor:</strong> {d.telefonoPadre || '—'}</p>
      <p><strong>Teléfono madre/tutor:</strong> {d.telefonoMadre || '—'}</p>
      <p><strong>Email:</strong> {d.email || '—'}</p>
    </div>
  );
}

function FormularioDatosGenerales({ deportista, onGuardar }) {
  const [campos, setCampos] = useState({
    nombre: deportista.nombre || '',
    apellidos: deportista.apellidos || '',
    fechaNacimiento: deportista.fechaNacimiento?.slice(0, 10) || '',
    nombreDeportivo: deportista.nombreDeportivo || '',
    numeroSocio: deportista.numeroSocio || '',
    dni: deportista.dni || '',
    telefonoDeportista: deportista.telefonoDeportista || '',
    telefonoPadre: deportista.telefonoPadre || '',
    telefonoMadre: deportista.telefonoMadre || '',
    email: deportista.email || '',
  });
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState('');

  function actualizarCampo(campo, valor) {
    setCampos((actuales) => ({ ...actuales, [campo]: valor }));
    setGuardado(false);
  }

  async function manejarEnvio(evento) {
    evento.preventDefault();
    setError('');
    setGuardando(true);
    try {
      await onGuardar({
        ...campos,
        numeroSocio: campos.numeroSocio || undefined,
        nombreDeportivo: campos.nombreDeportivo || undefined,
        dni: campos.dni || undefined,
        telefonoDeportista: campos.telefonoDeportista || undefined,
        telefonoPadre: campos.telefonoPadre || undefined,
        telefonoMadre: campos.telefonoMadre || undefined,
        email: campos.email || undefined,
      });
      setGuardado(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="tarjeta formulario-usuario" onSubmit={manejarEnvio}>
      <label>
        Nombre
        <input value={campos.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} required />
      </label>
      <label>
        Apellidos
        <input value={campos.apellidos} onChange={(e) => actualizarCampo('apellidos', e.target.value)} required />
      </label>
      <label>
        Fecha de nacimiento
        <input type="date" value={campos.fechaNacimiento} onChange={(e) => actualizarCampo('fechaNacimiento', e.target.value)} required />
      </label>
      <label>
        Nombre deportivo (alias, opcional)
        <input value={campos.nombreDeportivo} onChange={(e) => actualizarCampo('nombreDeportivo', e.target.value)} />
      </label>
      <label>
        Nº de socio (opcional)
        <input value={campos.numeroSocio} onChange={(e) => actualizarCampo('numeroSocio', e.target.value)} />
      </label>
      <label>
        DNI (opcional)
        <input value={campos.dni} onChange={(e) => actualizarCampo('dni', e.target.value)} />
      </label>
      <label>
        Teléfono del deportista
        <input value={campos.telefonoDeportista} onChange={(e) => actualizarCampo('telefonoDeportista', e.target.value)} />
      </label>
      <label>
        Teléfono del padre/tutor 1
        <input value={campos.telefonoPadre} onChange={(e) => actualizarCampo('telefonoPadre', e.target.value)} />
      </label>
      <label>
        Teléfono de la madre/tutor 2
        <input value={campos.telefonoMadre} onChange={(e) => actualizarCampo('telefonoMadre', e.target.value)} />
      </label>
      <label>
        Email (opcional)
        <input type="email" value={campos.email} onChange={(e) => actualizarCampo('email', e.target.value)} />
      </label>

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar cambios'}
      </button>
      {guardado && !guardando && <p className="nota">Guardado.</p>}
    </form>
  );
}

function FilaHistorial({ periodo, puedeGestionar, onGuardarFechas, onEliminar }) {
  const [fechaAlta, setFechaAlta] = useState(periodo.fechaAlta?.slice(0, 10) || '');
  const [fechaBaja, setFechaBaja] = useState(periodo.fechaBaja?.slice(0, 10) || '');

  function alGuardar() {
    if (!fechaAlta) return;
    onGuardarFechas(fechaAlta, fechaBaja || null);
  }

  return (
    <tr>
      <td>{periodo.deporteNombre}</td>
      <td>
        {puedeGestionar ? (
          <input type="date" value={fechaAlta} onChange={(e) => setFechaAlta(e.target.value)} onBlur={alGuardar} />
        ) : (
          fechaAlta || '—'
        )}
      </td>
      <td>
        {puedeGestionar ? (
          <input type="date" value={fechaBaja} onChange={(e) => setFechaBaja(e.target.value)} onBlur={alGuardar} />
        ) : (
          fechaBaja || 'Actual'
        )}
      </td>
      <td>{fechaBaja ? 'Finalizado' : 'Actual'}</td>
      {puedeGestionar && (
        <td className="acciones-fila">
          <button className="boton-peligro" onClick={onEliminar}>Eliminar</button>
        </td>
      )}
    </tr>
  );
}

function FormularioNuevoPeriodo({ deportesDisponibles, onAnadir }) {
  const [deporteId, setDeporteId] = useState('');
  const [fechaAlta, setFechaAlta] = useState(new Date().toISOString().slice(0, 10));
  const [fechaBaja, setFechaBaja] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!deporteId || !fechaAlta) return;
    setError('');
    setEnviando(true);
    try {
      await onAnadir({ deporteId, fechaAlta, fechaBaja: fechaBaja || undefined });
      setFechaBaja('');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="barra-filtros" onSubmit={manejarEnvio}>
      <select value={deporteId} onChange={(e) => setDeporteId(e.target.value)} required>
        <option value="" disabled>
          Añadir periodo de…
        </option>
        {deportesDisponibles.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nombre}
          </option>
        ))}
      </select>
      <input type="date" value={fechaAlta} onChange={(e) => setFechaAlta(e.target.value)} required title="Fecha de alta" />
      <input type="date" value={fechaBaja} onChange={(e) => setFechaBaja(e.target.value)} title="Fecha de baja (vacío = hasta ahora)" />
      <button type="submit" disabled={enviando}>
        Añadir periodo
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
