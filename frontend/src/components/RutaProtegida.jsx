// Envoltorio de rutas: exige sesión iniciada y, opcionalmente, uno de los
// roles indicados. Se usa así:
//   <Route path="/usuarios" element={
//     <RutaProtegida roles={['administrador','direccion_deportiva']}>
//       <Usuarios />
//     </RutaProtegida>
//   } />
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { CambiarContrasenaObligatoria } from './CambiarContrasenaObligatoria';

export function RutaProtegida({ children, roles }) {
  const { usuario, cargando, tieneRol } = useAuth();

  if (cargando) return <p className="cargando">Cargando…</p>;
  if (!usuario) return <Navigate to="/login" replace />;

  // Cuenta con contraseña inicial automática (1234): hay que cambiarla
  // antes de poder usar nada de la app, sea la ruta que sea.
  if (usuario.debeCambiarContrasena) return <CambiarContrasenaObligatoria />;

  if (roles && !tieneRol(...roles)) return <Navigate to="/" replace />;

  return children;
}
