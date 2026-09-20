import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { colorEtiqueta } from '../utils/colorEtiqueta';

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
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

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
  }, []);

  async function cambiarRoles(usuarioId, roles) {
    await api.put(`/usuarios/${usuarioId}/roles`, { roles });
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
          <button onClick={() => setMostrarFormulario((v) => !v)}>
            {mostrarFormulario ? 'Cancelar' : '+ Nuevo usuario'}
          </button>
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

function FilaUsuario({ usuario, esAdmin, onCambiarRoles, onDarDeBaja }) {
  const [editando, setEditando] = useState(false);
  const [rolesSeleccionados, setRolesSeleccionados] = useState(usuario.roles);

  function alternarRol(rol) {
    setRolesSeleccionados((actuales) =>
      actuales.includes(rol) ? actuales.filter((r) => r !== rol) : [...actuales, rol]
    );
  }

  async function guardar() {
    await onCambiarRoles(rolesSeleccionados);
    setEditando(false);
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
