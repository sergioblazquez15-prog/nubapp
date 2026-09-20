// Dashboard de "Inicio": cumpleaños de la semana, lesionados, resultados
// recientes y faltas sin justificar (3+ sesiones). El backend
// (GET /api/inicio/resumen) ya filtra según el rol: administrador/
// dirección deportiva ven todo el club, el resto solo sus equipos.
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { colorEtiqueta, iniciales } from '../utils/colorEtiqueta';

export default function Inicio() {
  const { usuario } = useAuth();
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/inicio/resumen').then(setResumen).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="pantalla-inicio">
      <h1>Hola, {usuario.nombreCompleto} 👋</h1>
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

function CabeceraTarjetaInicio({ icono, titulo, total }) {
  return (
    <div className="cabecera-tarjeta-inicio">
      <span className="icono-tarjeta-inicio">{icono}</span>
      <h3>{titulo}</h3>
      {total > 0 && <span className="contador-tarjeta-inicio">{total}</span>}
    </div>
  );
}

function TarjetaCumpleanos({ items }) {
  return (
    <div className="tarjeta tarjeta-dashboard tarjeta-inicio acento-dorado">
      <CabeceraTarjetaInicio icono="🎂" titulo="Cumpleaños de la semana" total={items.length} />
      {items.length === 0 ? (
        <p className="nota">Ninguno esta semana.</p>
      ) : (
        <ul className="lista-dashboard lista-inicio">
          {items.map((d) => (
            <li key={d.deportistaId} className="fila-inicio">
              <span className={`avatar-circulo avatar-circulo-mini ${colorEtiqueta(d.nombre + d.apellidos)}`}>
                {iniciales(d.nombre, d.apellidos)}
              </span>
              <span>{d.nombre} {d.apellidos}</span>
              <span className="nota fila-inicio-extra">{d.fecha.slice(8, 10)}/{d.fecha.slice(5, 7)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TarjetaLesionados({ items }) {
  return (
    <div className="tarjeta tarjeta-dashboard tarjeta-inicio acento-rojo">
      <CabeceraTarjetaInicio icono="🩹" titulo="Lesionados" total={items.length} />
      {items.length === 0 ? (
        <p className="nota">Nadie lesionado ahora mismo.</p>
      ) : (
        <ul className="lista-dashboard lista-inicio">
          {items.map((d) => (
            <li key={d.deportistaId} className="fila-inicio">
              <span className={`avatar-circulo avatar-circulo-mini ${colorEtiqueta(d.nombre + d.apellidos)}`}>
                {iniciales(d.nombre, d.apellidos)}
              </span>
              <span>{d.nombre} {d.apellidos}</span>
              {d.detalle && <span className="nota fila-inicio-extra">{d.detalle}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TarjetaResultados({ items }) {
  return (
    <div className="tarjeta tarjeta-dashboard tarjeta-inicio acento-azul">
      <CabeceraTarjetaInicio icono="⚽" titulo="Resultados recientes" total={items.length} />
      {items.length === 0 ? (
        <p className="nota">Todavía no hay partidos jugados esta temporada.</p>
      ) : (
        <ul className="lista-dashboard lista-inicio">
          {items.map((p, i) => {
            const propio = Number(p.resultadoPropio);
            const rival = Number(p.resultadoRival);
            const resultado = propio > rival ? 'victoria' : propio < rival ? 'derrota' : 'empate';
            return (
              <li key={i} className="fila-inicio">
                <span className={`resultado-badge resultado-${resultado}`}>{p.resultadoPropio}-{p.resultadoRival}</span>
                <span>{p.equipoNombre} vs {p.rival}</span>
                <span className="nota fila-inicio-extra">
                  {p.localVisitante === 'local' ? 'local' : 'visit.'} · {p.fecha?.slice(0, 10)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TarjetaFaltas({ items }) {
  return (
    <div className="tarjeta tarjeta-dashboard tarjeta-inicio acento-rojo">
      <CabeceraTarjetaInicio icono="⚠️" titulo="Faltas sin justificar (+3)" total={items.length} />
      {items.length === 0 ? (
        <p className="nota">Nadie por encima de 3 faltas sin justificar.</p>
      ) : (
        <ul className="lista-dashboard lista-inicio">
          {items.map((f) => (
            <li key={f.deportistaId} className="fila-inicio">
              <span className={`avatar-circulo avatar-circulo-mini ${colorEtiqueta(f.nombre + f.apellidos)}`}>
                {iniciales(f.nombre, f.apellidos)}
              </span>
              <span>{f.nombre} {f.apellidos}</span>
              <span className="texto-peligro fila-inicio-extra">{f.faltas} faltas</span>
              <span className="nota fila-inicio-extra">{f.equipoNombre}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
