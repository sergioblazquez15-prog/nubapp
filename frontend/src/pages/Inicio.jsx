// Dashboard de "Inicio": contadores rápidos, calendario del mes, cumpleaños
// de la semana, lesionados, resultados recientes, faltas sin justificar
// (3+ sesiones) y rotación de ejercicios. El backend (GET /api/inicio/resumen)
// ya filtra según el rol — administrador/dirección deportiva ven todo el
// club, el resto solo sus equipos — y omite rotacionEjercicios para el
// monitor (no tiene acceso al banco de ejercicios).
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { colorEtiqueta, iniciales } from '../utils/colorEtiqueta';

const NOMBRES_DIA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function pad2(n) { return n < 10 ? `0${n}` : `${n}`; }
function aISO(fecha) { return `${fecha.getFullYear()}-${pad2(fecha.getMonth() + 1)}-${pad2(fecha.getDate())}`; }
function sumarDias(fecha, n) { const d = new Date(fecha); d.setDate(d.getDate() + n); return d; }
function lunesDeSemana(fecha) {
  const d = new Date(fecha);
  const diaSemana = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - diaSemana);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function Inicio() {
  const { usuario, tieneRol } = useAuth();
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState('');
  const [confirmaciones, setConfirmaciones] = useState(null);
  const veEjercicios = tieneRol('administrador', 'direccion_deportiva', 'coordinador', 'entrenador');

  useEffect(() => {
    api.get('/inicio/resumen').then(setResumen).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    const lunes = lunesDeSemana(new Date());
    const domingo = sumarDias(lunes, 6);
    const desde = aISO(lunes);
    const hasta = aISO(domingo);
    Promise.all([
      api.get(`/sesiones/confirmaciones?desde=${desde}&hasta=${hasta}`).catch(() => []),
      api.get(`/partidos/confirmaciones?desde=${desde}&hasta=${hasta}`).catch(() => []),
    ]).then(([sesiones, partidos]) => {
      const items = [...sesiones, ...partidos].sort((a, b) => `${a.fecha}${a.horaInicio || a.hora || ''}`.localeCompare(`${b.fecha}${b.horaInicio || b.hora || ''}`));
      setConfirmaciones(items);
    });
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
        <>
          <div className="tarjetas-stats">
            <TarjetaStat icono="🧑‍🤝‍🧑" valor={resumen.totalDeportistasActivos} etiqueta="Deportistas activos" />
            <TarjetaStat icono="⚽" valor={resumen.totalEquipos} etiqueta="Equipos" />
            <TarjetaStat icono="🗓️" valor={resumen.sesionesEstaSemana} etiqueta="Sesiones esta semana" />
          </div>

          <div className="panel-inicio">
            <CalendarioMensual sesiones={resumen.sesionesDelMes} partidos={resumen.partidosDelMes || []} />

            <div className="columna-inicio">
              <TarjetaConfirmacionesSemana items={confirmaciones} />
              <TarjetaCumpleanos items={resumen.cumpleanosSemana} />
              <TarjetaLesionados items={resumen.lesionados} />
              <TarjetaFaltas items={resumen.faltasSinJustificar} />
              <TarjetaResultados items={resumen.resultadosRecientes} />
              {veEjercicios && <TarjetaRotacionEjercicios items={resumen.rotacionEjercicios} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Tarjeta "Confirmaciones de la semana": para cada sesión de entrenamiento
// y cada partido de esta semana (lunes a domingo), cuántos han confirmado,
// cuántos han dicho que no y cuántos siguen sin contestar — con el listado
// de nombres de quién ha confirmado, que es lo que pidió Sergio para poder
// ver de un vistazo quién va a venir. Administración/dirección deportiva
// ven todos los equipos; coordinador/entrenador/monitor solo los suyos
// (el backend ya filtra, ver GET /sesiones|partidos/confirmaciones).
function TarjetaConfirmacionesSemana({ items }) {
  const [abiertoId, setAbiertoId] = useState(null);

  return (
    <div className="tarjeta tarjeta-dashboard tarjeta-inicio acento-dorado">
      <CabeceraTarjetaInicio icono="✅" titulo="Confirmaciones de la semana" total={(items || []).length} />
      {items === null ? (
        <p className="cargando">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="nota">No hay sesiones ni partidos programados esta semana.</p>
      ) : (
        <ul className="lista-dashboard lista-inicio">
          {items.map((it) => {
            const clave = `${it.tipo}-${it.id}`;
            const abierto = abiertoId === clave;
            const titulo = it.tipo === 'partido'
              ? `⚽ ${it.equipoNombre} vs ${it.rival}`
              : `${it.equipoNombre}${it.titulo ? ` · ${it.titulo}` : ''}`;
            const hora = (it.horaInicio || it.hora || '').slice(0, 5);
            return (
              <li key={clave} className="fila-inicio" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', cursor: 'pointer' }}
                  onClick={() => setAbiertoId(abierto ? null : clave)}
                >
                  <span style={{ flex: 1 }}>
                    {titulo}
                    <span className="nota" style={{ marginLeft: 6 }}>
                      {it.fecha.slice(8, 10)}/{it.fecha.slice(5, 7)}{hora ? ` · ${hora}` : ''}
                    </span>
                  </span>
                  <span className="nota" title="Confirmados / pendientes / no asisten">
                    ✅ {it.confirmados.length} · ⏳ {it.pendientes.length} · ❌ {it.rechazados.length}
                  </span>
                </div>
                {abierto && (
                  <div className="nota" style={{ paddingLeft: 4 }}>
                    <div><strong>Confirmados:</strong> {it.confirmados.length === 0 ? '—' : it.confirmados.map((d) => `${d.nombre} ${d.apellidos}`).join(', ')}</div>
                    <div><strong>No asisten:</strong> {it.rechazados.length === 0 ? '—' : it.rechazados.map((d) => `${d.nombre} ${d.apellidos}`).join(', ')}</div>
                    <div><strong>Sin contestar:</strong> {it.pendientes.length === 0 ? '—' : it.pendientes.map((d) => `${d.nombre} ${d.apellidos}`).join(', ')}</div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TarjetaStat({ icono, valor, etiqueta }) {
  return (
    <div className="tarjeta tarjeta-stat">
      <span className="tarjeta-stat-icono">{icono}</span>
      <div>
        <div className="tarjeta-stat-valor">{valor}</div>
        <div className="tarjeta-stat-etiqueta">{etiqueta}</div>
      </div>
    </div>
  );
}

function CalendarioMensual({ sesiones, partidos }) {
  const hoy = new Date();
  const [anio, mes] = [hoy.getFullYear(), hoy.getMonth()];

  const eventos = useMemo(() => [
    ...sesiones.map((s) => ({ ...s, tipo: 'sesion' })),
    ...partidos.map((p) => ({ ...p, tipo: 'partido' })),
  ], [sesiones, partidos]);

  const porDia = useMemo(() => {
    const mapa = new Map();
    for (const e of eventos) {
      const dia = Number(e.fecha.slice(8, 10));
      if (!mapa.has(dia)) mapa.set(dia, []);
      mapa.get(dia).push(e);
    }
    return mapa;
  }, [eventos]);

  const primerDiaSemana = (new Date(anio, mes, 1).getDay() + 6) % 7; // 0 = lunes
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const celdas = [];
  for (let i = 0; i < primerDiaSemana; i++) celdas.push(null);
  for (let dia = 1; dia <= diasEnMes; dia++) celdas.push(dia);

  const nombreMes = hoy.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  return (
    <div className="tarjeta calendario-mensual">
      <div className="cabecera-tarjeta-inicio">
        <span className="icono-tarjeta-inicio">📅</span>
        <h3 style={{ textTransform: 'capitalize' }}>{nombreMes}</h3>
        {eventos.length > 0 && <span className="contador-tarjeta-inicio">{eventos.length}</span>}
      </div>
      <div className="calendario-grid calendario-cabecera-dias">
        {NOMBRES_DIA.map((n) => (
          <div key={n} className="calendario-nombre-dia">{n}</div>
        ))}
      </div>
      <div className="calendario-grid">
        {celdas.map((dia, i) => {
          if (dia === null) return <div key={`vacio-${i}`} className="calendario-dia calendario-dia-vacio" />;
          const esHoy = dia === hoy.getDate();
          const eventosDia = porDia.get(dia) || [];
          return (
            <div key={dia} className={`calendario-dia${esHoy ? ' calendario-dia-hoy' : ''}`}>
              <span className="calendario-dia-numero">{dia}</span>
              {eventosDia.slice(0, 2).map((e, idx) => (
                e.tipo === 'partido' ? (
                  <span
                    key={idx}
                    className="calendario-sesion calendario-partido"
                    title={`${e.equipoNombre} vs ${e.rival}${e.jugado ? ` (${e.resultadoPropio}-${e.resultadoRival})` : ''}`}
                  >
                    {e.escudoRival && <img src={e.escudoRival} alt="" className="calendario-escudo-rival" />}
                    ⚽ {e.rival}
                  </span>
                ) : (
                  <span key={idx} className="calendario-sesion" title={`${e.titulo} · ${e.equipoNombre}`}>
                    {e.equipoNombre}
                  </span>
                )
              ))}
              {eventosDia.length > 2 && (
                <span className="calendario-sesion calendario-sesion-mas">+{eventosDia.length - 2} más</span>
              )}
            </div>
          );
        })}
      </div>
      {eventos.length === 0 && <p className="nota">No hay sesiones ni partidos programados este mes.</p>}
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

function TarjetaRotacionEjercicios({ items }) {
  return (
    <div className="tarjeta tarjeta-dashboard tarjeta-inicio acento-verde">
      <CabeceraTarjetaInicio icono="📋" titulo="Ejercicios destacados" total={items.length} />
      {items.length === 0 ? (
        <p className="nota">Todavía no hay ejercicios en el banco.</p>
      ) : (
        <ul className="lista-dashboard lista-inicio">
          {items.map((e) => (
            <li key={e.id} className="fila-inicio">
              <span>{e.titulo}</span>
              <span className="nota fila-inicio-extra">{e.deporteNombre} · {e.tipologia}</span>
            </li>
          ))}
        </ul>
      )}
      <Link to="/ejercicios" className="enlace-tarjeta-inicio">Ver banco de ejercicios →</Link>
    </div>
  );
}
