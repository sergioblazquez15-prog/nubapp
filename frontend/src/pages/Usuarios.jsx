import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { colorEtiqueta } from '../utils/colorEtiqueta';
import ImportarPlantillaExcel from '../components/ImportarPlantillaExcel';

const ROLES_DISPONIBLES = [
  'administrador',
  'direccion_deportiva',
  'coordinador',
  'entrenador',
  'monitor',
  'deportista',
];

export default function Usuarios() {
  const { tieneRol } = useAuth();
  const esAdmin = tieneRol('administrador');

  const [usuarios, setUsuarios] = useState([]);
  const [temporadas, setTemporadas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarImportar, setMostrarImportar] = useState(false);

  async function cargarUsuarios() {
    setCargando(true);
    try {
      setUsuarios(await api.get('/usuarios'));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarUsuarios();
    api.get('/temporadas').then(setTemporadas).catch(() => {});
  }, []);

  async function importarExcel(archivo, temporadaId) {
    const formData = new FormData();
    formData.append('archivo', archivo);
    formData.append('temporadaId', temporadaId);
    const resultado = await api.postFile('/deportistas/importar', formData);
    cargarUsuarios();
    return resultado;
  }

  async function cambiarRoles(usuarioId, roles) {
    await api.put(`/usuarios/${usuarioId}/roles`, { roles });
    cargarUsuarios();
  }

  async function guardarDatosUsuario(usuarioId, datos) {
    await api.put(`/usuarios/${usuarioId}`, datos);
    cargarUsuarios();
  }

  async function darDeBaja(usuarioId) {
    if (!confirm('¿Dar de baja a este usuario? Se puede reactivar más adelante.')) return;
    await api.delete(`/usuarios/${usuarioId}`);
    cargarUsuarios();
  }

  return (
    <div className="pantalla-usuarios">
      <div className="cabecera">
        <h1>Gestión de usuarios</h1>
        {esAdmin && (
          <div className="acciones-fila">
            <button onClick={() => { setMostrarFormulario((v) => !v); setMostrarImportar(false); }}>
              {mostrarFormulario ? 'Cancelar' : '+ Nuevo usuario'}
            </button>
            <button onClick={() => { setMostrarImportar((v) => !v); setMostrarFormulario(false); }}>
              {mostrarImportar ? 'Cancelar' : '📊 Importar plantilla (Excel)'}
            </button>
          </div>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {mostrarFormulario && (
        <FormularioUsuario
          onCreado={() => {
            setMostrarFormulario(false);
            cargarUsuarios();
          }}
        />
      )}

      {mostrarImportar && (
        <>
          <p className="nota">
            Esto crea deportistas (no personal técnico ni administradores) a partir de la
            plantilla, con su acceso de login propio a "Mi app" — para el resto de roles sigue
            usándose "+ Nuevo usuario".
          </p>
          <ImportarPlantillaExcel temporadas={temporadas} onImportar={importarExcel} />
        </>
      )}

      {cargando ? (
        <p className="cargando">Cargando…</p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla-usuarios">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Estado</th>
                {esAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <FilaUsuario
                  key={u.id}
                  usuario={u}
                  esAdmin={esAdmin}
                  onCambiarRoles={(roles) => cambiarRoles(u.id, roles)}
                  onGuardarDatos={(datos) => guardarDatosUsuario(u.id, datos)}
                  onDarDeBaja={() => darDeBaja(u.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilaUsuario({ usuario, esAdmin, onCambiarRoles, onGuardarDatos, onDarDeBaja }) {
  const [editando, setEditando] = useState(false);
  const [editandoDatos, setEditandoDatos] = useState(false);
  const [rolesSeleccionados, setRolesSeleccionados] = useState(usuario.roles);
  const [nombreCompleto, setNombreCompleto] = useState(usuario.nombreCompleto || '');
  const [telefono, setTelefono] = useState(usuario.telefono || '');
  const [email, setEmail] = useState(usuario.email || '');
  const [errorDatos, setErrorDatos] = useState('');
  const [guardandoDatos, setGuardandoDatos] = useState(false);

  function alternarRol(rol) {
    setRolesSeleccionados((actuales) =>
      actuales.includes(rol) ? actuales.filter((r) => r !== rol) : [...actuales, rol]
    );
  }

  async function guardar() {
    await onCambiarRoles(rolesSeleccionados);
    setEditando(false);
  }

  async function guardarDatos(evento) {
    evento.preventDefault();
    if (!nombreCompleto.trim()) return;
    setErrorDatos('');
    setGuardandoDatos(true);
    try {
      await onGuardarDatos({
        nombreCompleto: nombreCompleto.trim(),
        telefono: telefono.trim() || null,
        email: email.trim() ? email.trim().toLowerCase() : null,
      });
      setEditandoDatos(false);
    } catch (err) {
      setErrorDatos(err.message);
    } finally {
      setGuardandoDatos(false);
    }
  }

  if (editandoDatos) {
    return (
      <tr className={usuario.inactivo ? 'fila-inactiva' : ''}>
        <td colSpan={esAdmin ? 4 : 3}>
          <form className="barra-filtros" onSubmit={guardarDatos} style={{ flexWrap: 'wrap' }}>
            <input value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} placeholder="Nombre completo" required />
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Teléfono" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
            {errorDatos && <p className="error">{errorDatos}</p>}
            <button type="submit" disabled={guardandoDatos}>{guardandoDatos ? 'Guardando…' : 'Guardar'}</button>
            <button type="button" onClick={() => setEditandoDatos(false)} disabled={guardandoDatos}>Cancelar</button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className={usuario.inactivo ? 'fila-inactiva' : ''}>
      <td>{usuario.nombreCompleto}</td>
      <td>{usuario.email || '—'}</td>
      <td>
        {editando ? (
          <div className="checkboxes-roles">
            {ROLES_DISPONIBLES.map((rol) => (
              <label key={rol}>
                <input
                  type="checkbox"
                  checked={rolesSeleccionados.includes(rol)}
                  onChange={() => alternarRol(rol)}
                />
                {rol}
              </label>
            ))}
            <button onClick={guardar}>Guardar</button>
          </div>
        ) : usuario.roles.length === 0 ? (
          '—'
        ) : (
          <div className="etiquetas-roles">
            {usuario.roles.map((rol) => (
              <span key={rol} className={`etiqueta-suave ${colorEtiqueta(rol)}`}>{rol}</span>
            ))}
          </div>
        )}
      </td>
      <td>
        <span className={`badge-estado ${usuario.inactivo ? 'badge-inactivo' : 'badge-activo'}`}>
          {usuario.inactivo ? 'Inactivo' : 'Activo'}
        </span>
      </td>
      {esAdmin && (
        <td className="acciones-fila">
          {!editando && <button onClick={() => setEditando(true)}>Editar roles</button>}
          <button onClick={() => setEditandoDatos(true)}>✎ Editar datos</button>
          {!usuario.inactivo && <button className="boton-peligro" onClick={onDarDeBaja}>Dar de baja</button>}
        </td>
      )}
    </tr>
  );
}

function FormularioUsuario({ onCreado }) {
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telefono, setTelefono] = useState('');
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  function alternarRol(rol) {
    setRoles((actuales) => (actuales.includes(rol) ? actuales.filter((r) => r !== rol) : [...actuales, rol]));
  }

  async function manejarEnvio(evento) {
    evento.preventDefault();
    setError('');
    if (roles.length === 0) {
      setError('Selecciona al menos un rol');
      return;
    }
    setEnviando(true);
    try {
      await api.post('/usuarios', {
        nombreCompleto,
        email: email || undefined,
        password: password || undefined,
        telefono: telefono || undefined,
        roles,
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
        Nombre completo
        <input value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} required />
      </label>

      <label>
        Teléfono
        <input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
      </label>

      <label>
        Email (déjalo en blanco si no va a tener acceso propio a la app)
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>

      {email && (
        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
          />
        </label>
      )}

      <div className="checkboxes-roles">
        {ROLES_DISPONIBLES.map((rol) => (
          <label key={rol}>
            <input type="checkbox" checked={roles.includes(rol)} onChange={() => alternarRol(rol)} />
            {rol}
          </label>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={enviando}>
        {enviando ? 'Creando…' : 'Crear usuario'}
      </button>
    </form>
  );
}
