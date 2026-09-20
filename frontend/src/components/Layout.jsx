// Cabecera + navegación, comunes a todas las pantallas ya logueadas.
// Los enlaces que se muestran dependen del rol del usuario.
//
// Estructura agrupada (Dirección Deportiva / Competición / Scout /
// Configuración) tal y como se acordó con el club. El monitor es el
// perfil más limitado: dentro de "Dirección Deportiva" solo ve Fichas
// individuales y Asistencia — nada de ejercicios, planificación,
// plantillas ni competición. Cuotas y Usuarios siguen reservados a
// administración/dirección deportiva (datos económicos y de cuentas).
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const PERSONAL_TECNICO = ['administrador', 'direccion_deportiva', 'coordinador', 'entrenador'];
const GESTION_DEPORTIVA = ['administrador', 'direccion_deportiva', 'coordinador'];
const ACCESO_TOTAL_LECTURA = ['administrador', 'direccion_deportiva'];

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

  const veDireccionDeportiva = tieneRol(...PERSONAL_TECNICO) || tieneRol('monitor');
  const veAmplioDireccionDeportiva = tieneRol(...PERSONAL_TECNICO); // todo menos monitor
  const veFichaYAsistencia = tieneRol(...PERSONAL_TECNICO) || tieneRol('monitor');
  const veConfiguracion = tieneRol(...ACCESO_TOTAL_LECTURA) || tieneRol(...GESTION_DEPORTIVA);

  return (
    <div className="app-shell">
      <header className="barra-navegacion">
        <span className="marca">NUBAPP</span>
        <nav>
          <EnlaceNav to="/" icono="🏠">Inicio</EnlaceNav>

          {veDireccionDeportiva && (
            <div className="grupo-nav">
              <div className="grupo-nav-titulo">Dirección deportiva</div>
              {veAmplioDireccionDeportiva && <EnlaceNav to="/ejercicios" icono="📋">Base de ejercicios</EnlaceNav>}
              {veAmplioDireccionDeportiva && <EnlaceNav to="/metodologia" icono="🗓️">Planificación general</EnlaceNav>}
              {veAmplioDireccionDeportiva && <EnlaceNav to="/equipos" icono="⚽">Plantillas</EnlaceNav>}
              {veFichaYAsistencia && <EnlaceNav to="/deportistas" icono="🧑‍🤝‍🧑">Fichas individuales</EnlaceNav>}
              {veFichaYAsistencia && <EnlaceNav to="/asistencia" icono="✅">Asistencia</EnlaceNav>}
            </div>
          )}

          {veAmplioDireccionDeportiva && (
            <div className="grupo-nav">
              <div className="grupo-nav-titulo">Competición</div>
              <EnlaceNav to="/competiciones" icono="🏆">Amistosos y competiciones</EnlaceNav>
            </div>
          )}

          {tieneRol(...ACCESO_TOTAL_LECTURA) && (
            <div className="grupo-nav">
              <div className="grupo-nav-titulo">Scout</div>
              <EnlaceNav to="/scout" icono="🔎">Base de datos scout</EnlaceNav>
            </div>
          )}

          {veConfiguracion && (
            <div className="grupo-nav">
              <div className="grupo-nav-titulo">Configuración</div>
              {tieneRol(...ACCESO_TOTAL_LECTURA) && <EnlaceNav to="/cuotas" icono="💶">Cuotas</EnlaceNav>}
              {tieneRol(...ACCESO_TOTAL_LECTURA) && <EnlaceNav to="/usuarios" icono="🔑">Usuarios</EnlaceNav>}
              {tieneRol(...GESTION_DEPORTIVA) && <EnlaceNav to="/traspaso-temporada" icono="➡️">Traspaso de temporada</EnlaceNav>}
            </div>
          )}
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
