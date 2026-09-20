// Asistencia como página independiente, para que el monitor (y cualquier
// entrenador/coordinador) pueda entrar directamente a pasar lista sin
// tener que abrir la gestión completa de un equipo. Reutiliza el mismo
// componente AsistenciaEquipo que ya funciona dentro de Equipos.jsx — no
// se reinventa nada, solo se hace alcanzable por su cuenta.
//
// Importante: aquí SÍ dejamos marcar asistencia a entrenador y monitor
// (no solo a quien gestiona la plantilla), porque son quienes de verdad
// están delante del equipo entrenando. El listado de equipos que ve cada
// uno ya viene filtrado por el servidor a "los suyos" (equipo_personal),
// así que cualquier equipo que aparezca aquí es uno donde tiene permiso
// de sobra para pasar lista.
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { AsistenciaEquipo } from './Equipos';
import { BotonInforme, CabeceraInforme } from '../components/Informe';

const PUEDE_MARCAR = ['administrador', 'direccion_deportiva', 'coordinador', 'entrenador', 'monitor'];

export default function Asistencia() {
  const { tieneRol } = useAuth();
  const puedeMarcar = tieneRol(...PUEDE_MARCAR);

  const [equipos, setEquipos] = useState([]);
  const [temporadaId, setTemporadaId] = useState('');
  const [equipoId, setEquipoId] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      try {
        const temporadas = await api.get('/temporadas');
        const principal = temporadas.find((t) => t.esPrincipal) || temporadas[0];
        if (principal) setTemporadaId(principal.id);
        const listaEquipos = await api.get(`/equipos${principal ? `?temporadaId=${principal.id}` : ''}`);
        setEquipos(listaEquipos);
        if (listaEquipos.length > 0) setEquipoId(listaEquipos[0].id);
        setError('');
      } catch (err) {
        setError(err.message);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  const equipoActual = equipos.find((eq) => eq.id === equipoId);

  return (
    <div className="pantalla-asistencia">
      <CabeceraInforme titulo="Informe de asistencia" subtitulo={equipoActual ? `${equipoActual.nombre} · ${equipoActual.deporteNombre}` : ''} />
      <div className="cabecera">
        <div>
          <h1>Asistencia</h1>
          <p className="subtitulo">Pasa lista de las sesiones de cada equipo y marca las faltas.</p>
        </div>
        {equipoId && (
          <div className="acciones-fila">
            <BotonInforme titulo={`asistencia ${equipoActual?.nombre || ''}`} />
          </div>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {cargando ? (
        <p className="cargando">Cargando…</p>
      ) : equipos.length === 0 ? (
        <p className="nota">No tienes equipos asignados esta temporada.</p>
      ) : (
        <>
          <div className="barra-filtros" style={{ marginBottom: 16 }}>
            <select value={equipoId} onChange={(e) => setEquipoId(e.target.value)}>
              {equipos.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.nombre} · {eq.deporteNombre}</option>
              ))}
            </select>
          </div>
          {equipoId && (
            <div className="bloque-ficha">
              <AsistenciaEquipo equipoId={equipoId} temporadaId={temporadaId} puedeGestionar={puedeMarcar} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
