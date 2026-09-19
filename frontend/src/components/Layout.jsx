// Cabecera + navegación, comunes a todas las pantallas ya logueadas.
// Los enlaces que se muestran dependen del rol del usuario.
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Layout() {
  const { usuario, cerrarSesion, tieneRol } = useAuth();

  return (
    <div className="app-shell">
      <header className="barra-navegacion">
        <span className="marca">NUBAPP</span>
        <nav>
          <Link to="/">Inicio</Link>
          {tieneRol('administrador', 'direccion_deportiva', 'coordinador', 'entrenador', 'monitor') && (
            <Link to="/deportistas">Deportistas</Link>
          )}
          {tieneRol('administrador', 'direccion_deportiva', 'coordinador', 'entrenador', 'monitor') && (
            <Link to="/equipos">Equipos</Link>
          )}
          {tieneRol('administrador', 'direccion_deportiva', 'coordinador', 'entrenador', 'monitor') && (
            <Link to="/ejercicios">Ejercicios</Link>
          )}
          {tieneRol('administrador', 'direccion_deportiva', 'coordinador', 'entrenador', 'monitor') && (
            <Link to="/metodologia">Metodología</Link>
          )}
          {tieneRol('administrador', 'direccion_deportiva') && <Link to="/cuotas">Cuotas</Link>}
          {tieneRol('administrador', 'direccion_deportiva') && <Link to="/usuarios">Usuarios</Link>}
        </nav>
        <div className="usuario-actual">
          <span>{usuario?.nombreCompleto}</span>
          <button onClick={cerrarSesion}>Salir</button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
