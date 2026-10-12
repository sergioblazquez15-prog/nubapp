// Fichas individuales de deportistas (Gestión deportiva). El alta/edición
// de la ficha general y de los deportes que practica es solo para
// administrador, dirección deportiva y coordinador; marcar lesión también
// lo puede hacer el entrenador de ese equipo (el backend ya filtra las
// filas según a qué equipos tiene acceso cada usuario).
//
// Dar de baja es siempre baja LÓGICA: no se borra ni se toca ningún dato
// (nº de socio incluido), solo se marca como inactivo. Por eso se puede
// "dar de alta" otra vez sin perder nada de su historial.
import { Fragment, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { BarraCuotaMini } from '../components/BarraCuota';
import { colorEtiqueta, iniciales } from '../utils/colorEtiqueta';
import { EsquemaPosiciones, catalogoPosicionesPara, nombrePosicion } from '../components/EsquemaPosiciones';
import { BotonInforme, CabeceraInforme } from '../components/Informe';
import { CalendarioDeportista } from '../components/CalendarioDeportista';

const GESTION_DEPORTIVA = ['administrador', 'direccion_deportiva', 'coordinador'];

export default function Deportistas() {
  const { tieneRol } = useAuth();
  const puedeGestionar = tieneRol(...GESTION_DEPORTIVA);
  const esAdministrador = tieneRol('administrador');

  const [deportistas, setDeportistas] = useState([]);
  const [deportesDisponibles, setDeportesDisponibles] = useState([]);
  const [temporadas, setTemporadas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarImportar, setMostrarImportar] = useState(false);
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
    api.get('/temporadas').then(setTemporadas).catch(() => {});
    cargarDeportistas();
  }, []);

  async function importarExcel(archivo, temporadaId) {
    const formData = new FormData();
    formData.append('archivo', archivo);
    formData.append('temporadaId', temporadaId);
    const resultado = await api.postFile('/deportistas/importar', formData);
    cargarDeportistas();
    return resultado;
  }

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
        <div className="acciones-fila">
          {puedeGestionar && (
            <button onClick={() => setMostrarFormulario((v) => !v)}>
              {mostrarFormulario ? 'Cancelar' : '+ Nuevo deportista'}
            </button>
          )}
          {esAdministrador && (
            <button onClick={() => setMostrarImportar((v) => !v)}>
              {mostrarImportar ? 'Cancelar' : '📊 Importar plantilla (Excel)'}
            </button>
          )}
        </div>
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

      {mostrarImportar && (
        <ImportarExcelDeportistas temporadas={temporadas} onImportar={importarExcel} />
      )}

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
        <div className="tarjetas-dashboard">
          {deportistas.map((d) => (
            <TarjetaDeportista
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
        </div>
      )}
    </div>
  );
}

function TarjetaDeportista({ deportista: d, puedeGestionar, deportesDisponibles, onGuardarDeportes, onAlternarLesion, onDarDeBaja, onDarDeAlta, onVerFicha }) {
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
    <div className={`tarjeta tarjeta-dashboard tarjeta-persona${d.inactivo ? ' tarjeta-inactiva' : ''}`}>
      <div className="cabecera-persona">
        <span className={`avatar-circulo ${colorEtiqueta(d.nombre + d.apellidos)}`}>
          {iniciales(d.nombre, d.apellidos)}
        </span>
        <div className="datos-cabecera-persona">
          <button className="boton-enlace nombre-tarjeta-persona" onClick={onVerFicha}>
            {d.nombre} {d.apellidos}
          </button>
          {d.nombreDeportivo && <span className="nota" style={{ fontSize: 12.5 }}>«{d.nombreDeportivo}»</span>}
        </div>
        <span className={`badge-estado ${d.inactivo ? 'badge-inactivo' : 'badge-activo'}`}>
          {d.inactivo ? 'Inactivo' : 'Activo'}
        </span>
      </div>

      <div className="etiquetas-roles" style={{ margin: '4px 0' }}>
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
          <>
            {d.deportes.length === 0
              ? <span className="nota">Sin deporte asignado</span>
              : d.deportes.map((dep) => (
                <span key={dep.id} className={`etiqueta-suave ${colorEtiqueta(dep.nombre)}`}>{dep.nombre}</span>
              ))}
            {puedeGestionar && (
              <button className="boton-enlace" onClick={() => setEditandoDeportes(true)}>editar</button>
            )}
          </>
        )}
      </div>

      <p className="nota" style={{ margin: 0, fontSize: 13 }}>
        {d.numeroSocio ? `Nº socio ${d.numeroSocio}` : 'Sin nº de socio'}
        {d.fechaNacimiento && ` · ${d.fechaNacimiento.slice(0, 10)}`}
      </p>

      <button
        className={`boton-lesion boton-ancho ${d.lesionado ? 'boton-lesion-activa' : ''}`}
        onClick={onAlternarLesion}
      >
        {d.lesionado ? `🩹 Lesionado${d.lesionDetalle ? `: ${d.lesionDetalle}` : ''}` : 'Sin lesión'}
      </button>

      <div className="acciones-fila" style={{ marginTop: 4 }}>
        <button className="boton-lesion" onClick={onVerFicha}>Ver ficha</button>
        {puedeGestionar && (d.inactivo ? (
          <button onClick={onDarDeAlta}>Dar de alta</button>
        ) : (
          <button className="boton-peligro" onClick={onDarDeBaja}>Dar de baja</button>
        ))}
      </div>
    </div>
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

// ---------- acceso propio del deportista a "Mi app" (solo administrador) ----------

// Sube el Excel de plantillas (ver POST /deportistas/importar en el
// backend, y la plantilla oficial que se entrega aparte): una fila por
// deportista y equipo/deporte - crea o actualiza la ficha por Nº de
// socio, lo asigna al equipo de la temporada elegida y, si se rellenan
// las columnas de acceso, le crea también su login de "Mi app".
function ImportarExcelDeportistas({ temporadas, onImportar }) {
  const [temporadaId, setTemporadaId] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    if (temporadaId || temporadas.length === 0) return;
    const principal = temporadas.find((t) => t.esPrincipal) || temporadas[0];
    if (principal) setTemporadaId(principal.id);
  }, [temporadas, temporadaId]);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!temporadaId || !archivo) return;
    setError('');
    setResultado(null);
    setEnviando(true);
    try {
      const r = await onImportar(archivo, temporadaId);
      setResultado(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta formulario-usuario" onSubmit={manejarEnvio} style={{ maxWidth: 620 }}>
      <p className="nota">
        Sube la plantilla oficial rellena (una fila por deportista y equipo/deporte — si practica
        varios, una fila por cada uno con el mismo Nº de socio). Por Nº de socio: si ya existe en
        NUBAPP se ACTUALIZA su ficha, si no existe se CREA. El equipo/deporte de cada fila se busca
        en la temporada que elijas aquí abajo. Si rellenas "Email acceso Mi app" y "Contraseña
        inicial" también se le crea su acceso propio a la app (solo si no lo tenía ya).
      </p>
      <label>
        Temporada (a la que se asignan los equipos de la plantilla)
        <select value={temporadaId} onChange={(e) => setTemporadaId(e.target.value)} required>
          <option value="" disabled>Selecciona una temporada…</option>
          {temporadas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
      </label>
      <label>
        Archivo Excel (.xlsx)
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => setArchivo(e.target.files?.[0] || null)}
          required
        />
      </label>
      {error && <p className="error">{error}</p>}
      {resultado && (
        <div className="nota" style={{ background: 'var(--color-superficie-alt)', padding: 10, borderRadius: 8 }}>
          <p style={{ margin: 0 }}>
            {resultado.creados} deportista(s) nuevo(s) · {resultado.actualizados} actualizado(s)
            {resultado.accesosCreados > 0 && ` · ${resultado.accesosCreados} acceso(s) a Mi app creados`}
          </p>
          {resultado.errores?.length > 0 && (
            <>
              <p style={{ margin: '8px 0 4px' }} className="texto-peligro">
                {resultado.errores.length} fila(s) con avisos o errores:
              </p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {resultado.errores.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
      <button type="submit" disabled={enviando}>{enviando ? 'Importando…' : 'Importar'}</button>
    </form>
  );
}

function AccesoApp({ deportista, onCambio }) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarReset, setMostrarReset] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  async function crearAcceso(evento) {
    evento.preventDefault();
    setError('');
    setMensaje('');
    setEnviando(true);
    try {
      await api.post(`/deportistas/${deportista.id}/acceso`, { email, password });
      setMensaje(`Acceso creado: ${email}. Comunícaselo al deportista junto con la contraseña.`);
      setEmail('');
      setPassword('');
      setMostrarForm(false);
      onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function resetearPassword(evento) {
    evento.preventDefault();
    setError('');
    setMensaje('');
    setEnviando(true);
    try {
      await api.put(`/usuarios/${deportista.usuarioId}/password`, { password: nuevaPassword });
      setMensaje('Contraseña actualizada. Comunícasela al deportista.');
      setNuevaPassword('');
      setMostrarReset(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function revocarAcceso() {
    if (!confirm('¿Quitar el acceso propio a este deportista? Se puede volver a dar de alta más adelante.')) return;
    setError('');
    setMensaje('');
    try {
      await api.delete(`/deportistas/${deportista.id}/acceso`);
      setMensaje('Acceso revocado.');
      onCambio();
    } catch (err) {
      setError(err.message);
    }
  }

  if (deportista.usuarioId) {
    return (
      <div>
        <p className="nota">Este deportista ya tiene acceso propio a "Mi app" (entra con su email y contraseña).</p>
        {mensaje && <p className="nota" style={{ color: '#1a7a3a' }}>{mensaje}</p>}
        {error && <p className="error">{error}</p>}
        {!mostrarReset ? (
          <div className="acciones-fila">
            <button type="button" className="boton-lesion" onClick={() => setMostrarReset(true)}>Cambiar contraseña</button>
            <button type="button" className="boton-lesion" onClick={revocarAcceso}>Quitar acceso</button>
          </div>
        ) : (
          <form onSubmit={resetearPassword} className="acciones-fila" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="password"
              placeholder="Nueva contraseña (mín. 8 caracteres)"
              value={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
              required
              minLength={8}
            />
            <button type="submit" className="boton-ancho" disabled={enviando}>Guardar</button>
            <button type="button" className="boton-lesion" onClick={() => setMostrarReset(false)}>Cancelar</button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="nota">Este deportista todavía no tiene acceso propio a la app.</p>
      {mensaje && <p className="nota" style={{ color: '#1a7a3a' }}>{mensaje}</p>}
      {error && <p className="error">{error}</p>}
      {!mostrarForm ? (
        <button type="button" className="boton-lesion" onClick={() => setMostrarForm(true)}>Crear acceso</button>
      ) : (
        <form onSubmit={crearAcceso} className="acciones-fila" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="email"
            placeholder="Email del deportista"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Contraseña (mín. 8 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <button type="submit" className="boton-ancho" disabled={enviando}>Crear</button>
          <button type="button" className="boton-lesion" onClick={() => setMostrarForm(false)}>Cancelar</button>
        </form>
      )}
    </div>
  );
}

// ---------- ficha completa: datos editables + historial de deportes ----------

function DeportistaDetalle({ deportistaId, puedeGestionar, onVolver }) {
  const { usuario, tieneRol } = useAuth();
  const [deportista, setDeportista] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [fichaTecnica, setFichaTecnica] = useState([]);
  const [deportesDisponibles, setDeportesDisponibles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // Administración/dirección deportiva ven las cuotas de cualquiera; un
  // deportista que entra con su propio usuario ve las suyas (el backend
  // hace la misma comprobación, esto es solo para no mostrar la sección
  // a quien el servidor le va a devolver un 403 de todas formas).
  const puedeVerCuotas = tieneRol('administrador', 'direccion_deportiva')
    || (deportista && usuario && deportista.usuarioId === usuario.id);

  async function cargarTodo() {
    setCargando(true);
    try {
      const [datos, periodos, ficha] = await Promise.all([
        api.get(`/deportistas/${deportistaId}`),
        api.get(`/deportistas/${deportistaId}/historial-deportes`),
        api.get(`/deportistas/${deportistaId}/ficha-tecnica`).catch(() => []),
      ]);
      setDeportista(datos);
      setHistorial(periodos);
      setFichaTecnica(ficha);
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

      <CabeceraInforme titulo="Ficha del deportista" subtitulo={`${deportista.nombre} ${deportista.apellidos}`} />

      <div className="cabecera cabecera-ficha-persona">
        <span className={`avatar-circulo avatar-circulo-grande ${colorEtiqueta(deportista.nombre + deportista.apellidos)}`}>
          {iniciales(deportista.nombre, deportista.apellidos)}
        </span>
        <div>
          <h1 style={{ marginBottom: 4 }}>
            {deportista.nombre} {deportista.apellidos}
            {deportista.nombreDeportivo && <span className="nota" style={{ fontSize: 16, fontWeight: 400 }}> «{deportista.nombreDeportivo}»</span>}
          </h1>
          <div className="etiquetas-roles" style={{ margin: 0 }}>
            <span className={`badge-estado ${deportista.inactivo ? 'badge-inactivo' : 'badge-activo'}`}>
              {deportista.inactivo ? 'Inactivo' : 'Activo'}
            </span>
            {deportista.deportes?.map((dep) => (
              <span key={dep.id} className={`etiqueta-suave ${colorEtiqueta(dep.nombre)}`}>{dep.nombre}</span>
            ))}
          </div>
        </div>
        <div className="acciones-fila" style={{ marginLeft: 'auto' }}>
          <BotonInforme titulo={`ficha ${deportista.nombre} ${deportista.apellidos}`} />
        </div>
      </div>

      <div className="bloque-ficha">
        <h2>📋 Datos generales</h2>
        {puedeGestionar ? (
          <FormularioDatosGenerales deportista={deportista} onGuardar={guardarDatos} />
        ) : (
          <DatosGeneralesSoloLectura deportista={deportista} />
        )}
      </div>

      {fichaTecnica.length > 0 && (
        <div className="bloque-ficha">
          <h2>⚽ Posición</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
            {fichaTecnica.map((ft) => {
              const catalogo = catalogoPosicionesPara(ft.deporteNombre);
              if (!catalogo) return null;
              return (
                <div key={ft.equipoId} className="esquema-posiciones-envoltorio">
                  <p className="nota" style={{ marginBottom: 6 }}>
                    <strong>{ft.equipoNombre}</strong> · {ft.deporteNombre}{ft.dorsal ? ` · dorsal ${ft.dorsal}` : ''}
                  </p>
                  <EsquemaPosiciones
                    posiciones={catalogo}
                    tipoCancha={ft.deporteNombre === 'Baloncesto' ? 'baloncesto' : 'futbol'}
                    posicionPrincipal={ft.posicionPrincipal}
                    posicionSecundaria={ft.posicionSecundaria}
                  />
                  <p className="nota">
                    {ft.posicionPrincipal
                      ? <>Principal: <strong>{nombrePosicion(ft.deporteNombre, ft.posicionPrincipal)}</strong></>
                      : 'Todavía sin posición marcada'}
                    {ft.posicionSecundaria && <> · Secundaria: <strong>{nombrePosicion(ft.deporteNombre, ft.posicionSecundaria)}</strong></>}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tieneRol('administrador') && (
        <div className="bloque-ficha">
          <h2>🔑 Acceso a "Mi app"</h2>
          <AccesoApp deportista={deportista} onCambio={cargarTodo} />
        </div>
      )}

      <div className="bloque-ficha">
        <h2>🗓️ Mi calendario</h2>
        <CalendarioDeportista deportistaId={deportistaId} />
      </div>

      <div className="bloque-ficha">
        <h2>📅 Historial de deportes practicados</h2>
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
      </div>

      <div className="bloque-ficha">
        <h2>💶 Histórico de cuotas</h2>
        {puedeVerCuotas ? (
          <HistoricoCuotas deportistaId={deportistaId} />
        ) : (
          <p className="nota">No tienes acceso a la información económica de este deportista.</p>
        )}
      </div>
    </div>
  );
}

// Resumen de cuotas de este deportista (todas las temporadas). La gestión
// completa (crear cuota, registrar pagos, previsión mensual…) vive en la
// pantalla de Cuotas — aquí solo se consulta de un vistazo.
function HistoricoCuotas({ deportistaId }) {
  const [cuotas, setCuotas] = useState(null);
  const [error, setError] = useState('');
  const [abiertaId, setAbiertaId] = useState(null);

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
            <th>Concepto</th>
            <th>Total a pagar</th>
            <th>Pagado</th>
            <th>Pendiente</th>
            <th>Progreso</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {cuotas.map((c) => (
            <Fragment key={c.id}>
              <tr>
                <td>{c.deporteNombre}</td>
                <td>{c.concepto}</td>
                <td>{c.totalAPagar.toFixed(2)} €</td>
                <td>{c.totalPagado.toFixed(2)} €</td>
                <td className={c.pendiente > 0.001 ? 'texto-peligro' : ''}>{c.pendiente.toFixed(2)} €</td>
                <td><BarraCuotaMini pagado={c.totalPagado} total={c.totalAPagar} /></td>
                <td>
                  <button className="boton-enlace" onClick={() => setAbiertaId(abiertaId === c.id ? null : c.id)}>
                    {abiertaId === c.id ? 'Cerrar' : 'Ver pagos'}
                  </button>
                </td>
              </tr>
              {abiertaId === c.id && (
                <tr>
                  <td colSpan={7}><PagosDeCuota cuotaId={c.id} /></td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PagosDeCuota({ cuotaId }) {
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/cuotas/${cuotaId}`).then(setDetalle).catch((err) => setError(err.message));
  }, [cuotaId]);

  if (error) return <p className="nota">{error}</p>;
  if (!detalle) return <p className="cargando">Cargando…</p>;
  if (detalle.pagos.length === 0) return <p className="nota">Todavía no hay pagos registrados en esta cuota.</p>;

  const ETIQUETAS_FORMA_PAGO = { efectivo: 'Efectivo', domiciliado: 'Domiciliado', tpv: 'TPV', transferencia: 'Transferencia' };

  return (
    <div className="lista-dashboard" style={{ padding: '8px 0' }}>
      {detalle.pagos.map((p) => (
        <div key={p.id} className="fila-inicio">
          <span className="nota fila-inicio-extra">{p.fecha?.slice(0, 10)}</span>
          <span>{p.descripcion || 'Pago'}</span>
          <span className="etiqueta-suave">{ETIQUETAS_FORMA_PAGO[p.formaPago] || p.formaPago}</span>
          <span className="fila-inicio-extra" style={{ fontWeight: 700 }}>+{Number(p.importe).toFixed(2)} €</span>
        </div>
      ))}
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
      <td>
        <span className={`badge-estado ${fechaBaja ? 'badge-inactivo' : 'badge-activo'}`}>
          {fechaBaja ? 'Finalizado' : 'Actual'}
        </span>
      </td>
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
