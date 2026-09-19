// Dashboard de "Inicio": cumpleaños de la semana, lesionados, resultados
// recientes y faltas sin justificar (3+ sesiones). El backend
// (GET /api/inicio/resumen) ya filtra según el rol: administrador/
// dirección deportiva ven todo el club, el resto solo sus equipos.
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export default function Inicio() {
  const { usuario } = useAuth();
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/inicio/resumen').then(setResumen).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="pantalla-inicio">
      <h1>Hola, {usuario.nombreCompleto}</h1>
      <p className="subtitulo">
        Rol(es): {usuario.roles.join(', ')}
        {resumen?.temporada && ` · Temporada ${resumen.temporada.nombre}`}
      </p>

      {error && <p className="error">{error}</p>}
      {!resumen && !error && <p className="cargando">Cargando…</p>}

      {resumen && (
        <div className="tarjetas-dashboard">
          <TarjetaCumpleanos items={resumen.cumpleanosSemana} />
          <TarjetaLesionados items={resumen.lesionados} />
          <TarjetaResultados items={resumen.resultadosRecientes} />
          <TarjetaFaltas items={resumen.faltasSinJustificar} />
        </div>
      )}
    </div>
  );
}

function TarjetaCumpleanos({ items }) {
  return (
    <div className="tarjeta tarjeta-dashboard">
      <h3>Cumpleaños de la semana</h3>
      {items.length === 0 ? (
        <p className="nota">Ninguno esta semana.</p>
      ) : (
        <ul className="lista-dashboard">
          {items.map((d) => (
            <li key={d.deportistaId}>
              {d.nombre} {d.apellidos} <span className="nota">— {d.fecha.slice(8, 10)}/{d.fecha.slice(5, 7)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TarjetaLesionados({ items }) {
  return (
    <div className="tarjeta tarjeta-dashboard">
      <h3>Lesionados</h3>
      {items.length === 0 ? (
        <p className="nota">Nadie lesionado ahora mismo.</p>
      ) : (
        <ul className="lista-dashboard">
          {items.map((d) => (
            <li key={d.deportistaId}>
              {d.nombre} {d.apellidos}{d.detalle && <span className="nota"> — {d.detalle}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TarjetaResultados({ items }) {
  return (
    <div className="tarjeta tarjeta-dashboard">
      <h3>Resultados recientes</h3>
      {items.length === 0 ? (
        <p className="nota">Todavía no hay partidos jugados esta temporada.</p>
      ) : (
        <ul className="lista-dashboard">
          {items.map((p, i) => (
            <li key={i}>
              {p.equipoNombre} {p.resultadoPropio}-{p.resultadoRival} {p.rival}
              <span className="nota"> ({p.localVisitante === 'local' ? 'local' : 'visitante'}, {p.fecha?.slice(0, 10)})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TarjetaFaltas({ items }) {
  return (
    <div className="tarjeta tarjeta-dashboard">
      <h3>Faltas sin justificar (+3)</h3>
      {items.length === 0 ? (
        <p className="nota">Nadie por encima de 3 faltas sin justificar.</p>
      ) : (
        <ul className="lista-dashboard">
          {items.map((f) => (
            <li key={f.deportistaId}>
              {f.nombre} {f.apellidos} <span className="texto-peligro">{f.faltas} faltas</span>
              <span className="nota"> · {f.equipoNombre}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
