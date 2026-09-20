// "Mi calendario" — semana del deportista con sus clases habituales (en
// negro) y sus sesiones de recuperación (en dorado), tal y como pidió
// Sergio. Vive en la ficha del deportista (Deportistas.jsx).
import { useEffect, useState } from 'react';
import { api } from '../api/client';

const NOMBRES_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function lunesDeLaSemana(fecha) {
  const d = new Date(fecha);
  const diaSemana = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - diaSemana);
  d.setHours(0, 0, 0, 0);
  return d;
}

function aISO(fecha) {
  return fecha.toISOString().slice(0, 10);
}

export function CalendarioDeportista({ deportistaId }) {
  const [inicioSemana, setInicioSemana] = useState(() => lunesDeLaSemana(new Date()));
  const [sesiones, setSesiones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const dias = Array.from({ length: 7 }, (_, i) => {
    const f = new Date(inicioSemana);
    f.setDate(f.getDate() + i);
    return f;
  });

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      try {
        const desde = aISO(dias[0]);
        const hasta = aISO(dias[6]);
        const lista = await api.get(`/sesiones/calendario?deportistaId=${deportistaId}&desde=${desde}&hasta=${hasta}`);
        setSesiones(lista);
        setError('');
      } catch (err) {
        setError(err.message);
      } finally {
        setCargando(false);
      }
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deportistaId, inicioSemana]);

  function semanaAnterior() {
    setInicioSemana((actual) => { const d = new Date(actual); d.setDate(d.getDate() - 7); return d; });
  }
  function semanaSiguiente() {
    setInicioSemana((actual) => { const d = new Date(actual); d.setDate(d.getDate() + 7); return d; });
  }
  function semanaActual() {
    setInicioSemana(lunesDeLaSemana(new Date()));
  }

  return (
    <div>
      <div className="cabecera" style={{ marginBottom: 10 }}>
        <div className="leyenda-calendario">
          <span><span className="punto-leyenda" style={{ background: 'var(--color-primario-ink)' }}></span>Clase habitual</span>
          <span><span className="punto-leyenda" style={{ background: 'var(--color-recuperacion)' }}></span>Sesión de recuperación</span>
          <span><span className="punto-leyenda" style={{ background: 'var(--color-peligro-suave)' }}></span>Cancelada</span>
        </div>
        <div className="acciones-fila">
          <button className="boton-lesion" onClick={semanaAnterior}>‹ Semana anterior</button>
          <button className="boton-lesion" onClick={semanaActual}>Hoy</button>
          <button className="boton-lesion" onClick={semanaSiguiente}>Semana siguiente ›</button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {cargando ? (
        <p className="cargando">Cargando…</p>
      ) : (
        <div className="calendario-semana">
          {dias.map((dia, i) => {
            const iso = aISO(dia);
            const sesionesDelDia = sesiones.filter((s) => s.fecha?.slice(0, 10) === iso);
            return (
              <div key={iso} className="dia-calendario">
                <span className="nombre-dia">{NOMBRES_DIA[i]}</span>
                <span className="numero-dia">{dia.getDate()}</span>
                {sesionesDelDia.length === 0 ? (
                  <span className="vacio-dia">Sin sesión</span>
                ) : (
                  sesionesDelDia.map((s) => (
                    <div
                      key={s.id}
                      className={`sesion-calendario ${
                        s.cancelada ? 'sesion-calendario-cancelada' : s.esRecuperacion ? 'sesion-calendario-recuperacion' : 'sesion-calendario-normal'
                      }`}
                    >
                      {s.horaInicio && <span className="hora-sesion-cal">{s.horaInicio.slice(0, 5)}</span>}
                      {s.esRecuperacion ? 'Recuperación' : (s.titulo || s.equipoNombre || s.deporteNombre || 'Sesión')}
                      {s.cancelada && ' (cancelada)'}
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
