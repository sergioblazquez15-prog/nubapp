import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
import Usuarios from './pages/Usuarios';
import Deportistas from './pages/Deportistas';
import Equipos from './pages/Equipos';
import Cuotas from './pages/Cuotas';
import Ejercicios from './pages/Ejercicios';
import Metodologia from './pages/Metodologia';
import { Layout } from './components/Layout';
import { RutaProtegida } from './components/RutaProtegida';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <RutaProtegida>
            <Layout />
          </RutaProtegida>
        }
      >
        <Route path="/" element={<Inicio />} />
        <Route path="/deportistas" element={<Deportistas />} />
        <Route path="/equipos" element={<Equipos />} />
        <Route
          path="/usuarios"
          element={
            <RutaProtegida roles={['administrador', 'direccion_deportiva']}>
              <Usuarios />
            </RutaProtegida>
          }
        />
        <Route
          path="/cuotas"
          element={
            <RutaProtegida roles={['administrador', 'direccion_deportiva']}>
              <Cuotas />
            </RutaProtegida>
          }
        />
        <Route
          path="/ejercicios"
          element={
            <RutaProtegida roles={['administrador', 'direccion_deportiva', 'coordinador', 'entrenador', 'monitor']}>
              <Ejercicios />
            </RutaProtegida>
          }
        />
        <Route
          path="/metodologia"
          element={
            <RutaProtegida roles={['administrador', 'direccion_deportiva', 'coordinador', 'entrenador', 'monitor']}>
              <Metodologia />
            </RutaProtegida>
          }
        />
      </Route>
    </Routes>
  );
}
