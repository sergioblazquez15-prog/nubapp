// Cabecera + navegación, comunes a todas las pantallas ya logueadas.
// Los enlaces que se muestran dependen del rol del usuario.
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const ROLES_TECNICOS = ['administrador', 'direccion_deportiva', 'coordinador', 'entrenador', 'monitor'];

function EnlaceNav({ to, icono, children }) {
  return (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `enlace-nav${isActive ? ' activo' : ''}`}>
      <span className="icono-nav">{icono}</span>
      {children}
    </NavLink>
  );
}

export function Layout() {
  const { usuario, cerrarSesion, tieneRol } = useAuth();

  return (
    <div className="app-shell">
      <header className="barra-navegacion">
        <span className="marca">NUBAPP</span>
        <nav>
          <EnlaceNav to="/" icono="🏠">Inicio</EnlaceNav>
          {tieneRol(...ROLES_TECNICOS) && <EnlaceNav to="/deportistas" icono="🧑‍🤝‍🧑">Deportistas</EnlaceNav>}
          {tieneRol(...ROLES_TECNICOS) && <EnlaceNav to="/equipos" icono="⚽">Equipos</EnlaceNav>}
          {tieneRol(...ROLES_TECNICOS) && <EnlaceNav to="/competiciones" icono="🏆">Competición</EnlaceNav>}
          {tieneRol(...ROLES_TECNICOS) && <EnlaceNav to="/ejercicios" icono="📋">Ejercicios</EnlaceNav>}
          {tieneRol(...ROLES_TECNICOS) && <EnlaceNav to="/metodologia" icono="📚">Metodología</EnlaceNav>}
          {tieneRol('administrador', 'direccion_deportiva') && <EnlaceNav to="/cuotas" icono="💶">Cuotas</EnlaceNav>}
          {tieneRol('administrador', 'direccion_deportiva') && <EnlaceNav to="/usuarios" icono="🔑">Usuarios</EnlaceNav>}
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
