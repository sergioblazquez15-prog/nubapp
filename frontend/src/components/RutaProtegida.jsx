// Envoltorio de rutas: exige sesión iniciada y, opcionalmente, uno de los
// roles indicados. Se usa así:
//   <Route path="/usuarios" element={
//     <RutaProtegida roles={['administrador','direccion_deportiva']}>
//       <Usuarios />
//     </RutaProtegida>
//   } />
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function RutaProtegida({ children, roles }) {
  const { usuario, cargando, tieneRol } = useAuth();

  if (cargando) return <p className="cargando">Cargando…</p>;
  if (!usuario) return <Navigate to="/login" replace />;
  if (roles && !tieneRol(...roles)) return <Navigate to="/" replace />;

  return children;
}
