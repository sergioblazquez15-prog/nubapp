import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
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
import { Layout } from './components/Layout';
import { RutaProtegida } from './components/RutaProtegida';

// Perfiles con acceso amplio a "Dirección deportiva" (banco de
// ejercicios, planificación, plantillas, competición). El monitor queda
// fuera de este grupo a propósito: su perfil solo entra a Fichas
// individuales y Asistencia (ver PERSONAL_TECNICO_Y_MONITOR más abajo),
// nunca a la gestión de equipos ni al banco de ejercicios.
const PERSONAL_TECNICO = ['administrador', 'direccion_deportiva', 'coordinador', 'entrenador'];
const PERSONAL_TECNICO_Y_MONITOR = [...PERSONAL_TECNICO, 'monitor'];
const GESTION_DEPORTIVA = ['administrador', 'direccion_deportiva', 'coordinador'];
const ACCESO_TOTAL_LECTURA = ['administrador', 'direccion_deportiva'];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

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

      <Route
        element={
          <RutaProtegida>
            <Layout />
          </RutaProtegida>
        }
      >
        <Route path="/" element={<Inicio />} />
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
            <RutaProtegida roles={PERSONAL_TECNICO}>
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
      </Route>
    </Routes>
  );
}
