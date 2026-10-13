import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
import DeportistaApp from './pages/DeportistaApp';
import Usuarios from './pages/Usuarios';
import Deportistas from './pages/Deportistas';
import Equipos from './pages/Equipos';
import Partidos from './pages/Partidos';
import Directo from './pages/Directo';
import Cuotas from './pages/Cuotas';
import Ejercicios from './pages/Ejercicios';
import Metodologia from './pages/Metodologia';
import Competiciones from './pages/Competiciones';
import Asistencia from './pages/Asistencia';
import Scout from './pages/Scout';
import TraspasoTemporada from './pages/TraspasoTemporada';
import Festivos from './pages/Festivos';
import SolicitudesAlta from './pages/SolicitudesAlta';
import AltaPublica from './pages/AltaPublica';
import { Layout } from './components/Layout';
import { RutaProtegida } from './components/RutaProtegida';
import { useAuth } from './auth/AuthContext';

// Perfiles con acceso amplio a "Dirección deportiva" (banco de
// ejercicios, planificación, competición). El monitor queda fuera de
// este grupo a propósito: su perfil solo entra a Fichas individuales,
// Asistencia y Equipos (ver PERSONAL_TECNICO_Y_MONITOR más abajo) — en
// Equipos, solo para ver sus propios equipos asignados y gestionar su
// horario de entrenamiento; nunca para crear/editar equipos, fichar
// jugadores ni el banco de ejercicios (eso sigue gestionado dentro de
// Equipos.jsx con el rol real, no con el acceso a la ruta).
const PERSONAL_TECNICO = ['administrador', 'direccion_deportiva', 'coordinador', 'entrenador'];
const PERSONAL_TECNICO_Y_MONITOR = [...PERSONAL_TECNICO, 'monitor'];
const GESTION_DEPORTIVA = ['administrador', 'direccion_deportiva', 'coordinador'];
const ACCESO_TOTAL_LECTURA = ['administrador', 'direccion_deportiva'];
const PERSONAL_CLUB = ['administrador', 'direccion_deportiva', 'coordinador', 'entrenador', 'monitor'];

// Un usuario que SOLO tiene el rol "deportista" (sin ningún rol de
// personal del club) no tiene nada que hacer en el panel de Inicio de
// dirección deportiva - "/" le manda directo a su propia app.
function InicioOMiApp() {
  const { tieneRol } = useAuth();
  if (tieneRol('deportista') && !tieneRol(...PERSONAL_CLUB)) {
    return <Navigate to="/mi-app" replace />;
  }
  return <Inicio />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Enlace público de alta de un equipo (ver botón "Enlace de alta"
          en la ficha de cada equipo): sin login, fuera del layout con
          menú, como Login. */}
      <Route path="/alta/:token" element={<AltaPublica />} />

      {/* Directo a pantalla completa: fuera del layout con menú a
          propósito (como Login), para que ocupe toda la pantalla sin la
          cabecera de navegación por encima. */}
      <Route
        path="/partidos/:id/directo"
        element={
          <RutaProtegida roles={PERSONAL_TECNICO}>
            <Directo />
          </RutaProtegida>
        }
      />

      {/* App del deportista: fuera del layout con menú de dirección
          deportiva (como Directo y Login), con su propia cabecera y
          navegación inferior pensadas para el móvil. */}
      <Route
        path="/mi-app"
        element={
          <RutaProtegida roles={['deportista']}>
            <DeportistaApp />
          </RutaProtegida>
        }
      />

      <Route
        element={
          <RutaProtegida>
            <Layout />
          </RutaProtegida>
        }
      >
        <Route path="/" element={<InicioOMiApp />} />
        <Route
          path="/deportistas"
          element={
            <RutaProtegida roles={PERSONAL_TECNICO_Y_MONITOR}>
              <Deportistas />
            </RutaProtegida>
          }
        />
        <Route
          path="/asistencia"
          element={
            <RutaProtegida roles={PERSONAL_TECNICO_Y_MONITOR}>
              <Asistencia />
            </RutaProtegida>
          }
        />
        <Route
          path="/equipos"
          element={
            <RutaProtegida roles={PERSONAL_TECNICO_Y_MONITOR}>
              <Equipos />
            </RutaProtegida>
          }
        />
        <Route
          path="/partidos"
          element={
            <RutaProtegida roles={PERSONAL_TECNICO}>
              <Partidos />
            </RutaProtegida>
          }
        />
        <Route
          path="/usuarios"
          element={
            <RutaProtegida roles={ACCESO_TOTAL_LECTURA}>
              <Usuarios />
            </RutaProtegida>
          }
        />
        <Route
          path="/cuotas"
          element={
            <RutaProtegida roles={ACCESO_TOTAL_LECTURA}>
              <Cuotas />
            </RutaProtegida>
          }
        />
        <Route
          path="/ejercicios"
          element={
            <RutaProtegida roles={PERSONAL_TECNICO}>
              <Ejercicios />
            </RutaProtegida>
          }
        />
        <Route
          path="/metodologia"
          element={
            <RutaProtegida roles={PERSONAL_TECNICO}>
              <Metodologia />
            </RutaProtegida>
          }
        />
        <Route
          path="/competiciones"
          element={
            <RutaProtegida roles={PERSONAL_TECNICO}>
              <Competiciones />
            </RutaProtegida>
          }
        />
        <Route
          path="/scout"
          element={
            <RutaProtegida roles={ACCESO_TOTAL_LECTURA}>
              <Scout />
            </RutaProtegida>
          }
        />
        <Route
          path="/traspaso-temporada"
          element={
            <RutaProtegida roles={GESTION_DEPORTIVA}>
              <TraspasoTemporada />
            </RutaProtegida>
          }
        />
        <Route
          path="/festivos"
          element={
            <RutaProtegida roles={GESTION_DEPORTIVA}>
              <Festivos />
            </RutaProtegida>
          }
        />
        <Route
          path="/solicitudes-alta"
          element={
            <RutaProtegida roles={GESTION_DEPORTIVA}>
              <SolicitudesAlta />
            </RutaProtegida>
          }
        />
      </Route>
    </Routes>
  );
}
