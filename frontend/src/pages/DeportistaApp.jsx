// "Mi app": la pantalla que ve un deportista que entra con su propio
// usuario (rol "deportista"). Pensada para el móvil, con cabecera fija +
// contenido con scroll + navegación inferior de 5 pestañas, siguiendo el
// boceto que se validó con Sergio (el único elemento tomado de la imagen
// de referencia que mandó es el toggle "Asisto / No asisto" - el resto es
// la identidad visual propia de NUBAPP).
//
// Reglas importantes que vienen del backend y que esta pantalla respeta:
// - La confirmación previa (Asisto/No asisto + motivo) la marca el propio
//   deportista y vive en asistencia.confirmacion_previa/motivo/motivo_texto
//   (PUT /sesiones/:id/mi-confirmacion). NUNCA toca asistio/justificada.
// - La asistencia REAL (pestaña "Asistencia") la marca el monitor/
//   entrenador y aquí es solo de lectura.
// - Ficha personal y Cuotas también son solo de lectura: las gestiona el
//   club desde el resto de NUBAPP.
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import '../styles/deportista.css';

const NOMBRES_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MOTIVOS = [
  { valor: 'enfermo', etiqueta: 'Enfermo' },
  { valor: 'lesion', etiqueta: 'Lesión' },
  { valor: 'trabajo', etiqueta: 'Trabajo' },
  { valor: 'otro', etiqueta: 'Otro motivo' },
];
const MES_OFFSET_MAXIMO = 2;

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
// Construye la fecha como LOCAL (no UTC) a partir de un "aaaa-mm-dd" que
// viene del backend, para que no se desplace un día según el huso horario.
function fechaLocalDesdeISO(iso) {
  return new Date(`${iso.slice(0, 10)}T00:00:00`);
}
function capitalizar(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function formatoImporte(n) {
  return `${Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
function formatoFechaCorta(iso) {
  const f = fechaLocalDesdeISO(iso);
  return `${DIAS_CORTOS[(f.getDay() + 6) % 7]} ${f.getDate()} ${NOMBRES_MES[f.getMonth()].slice(0, 3)}`;
}

export default function DeportistaApp() {
  const { usuario, cerrarSesion } = useAuth();
  const deportistaId = usuario?.deportistaId;

  const [tab, setTab] = useState('inicio');
  const [mesOffset, setMesOffset] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [deportista, setDeportista] = useState(null);
  const [sesiones, setSesiones] = useState([]);
  const [cuotas, setCuotas] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [partidos, setPartidos] = useState([]);

  // Overlay local sobre la confirmación de cada sesión: se usa para poder
  // reflejar el clic al instante sin esperar la respuesta del servidor, y
  // para llevar el borrador de "otro motivo" mientras se escribe.
  const [pendientes, setPendientes] = useState({});
  const [guardandoId, setGuardandoId] = useState(null);
  const temporizadoresTexto = useRef({});

  async function cargarTodo() {
    if (!deportistaId) { setCargando(false); return; }
    setCargando(true);
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const desde = aISO(sumarDias(hoy, -60));
      const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + MES_OFFSET_MAXIMO + 1, 0);
      const hasta = aISO(finMes);

      const [datosDeportista, listaSesiones, resumenCuotas, stats] = await Promise.all([
        api.get(`/deportistas/${deportistaId}`),
        api.get(`/sesiones/calendario?deportistaId=${deportistaId}&desde=${desde}&hasta=${hasta}`),
        api.get(`/cuotas/deportista/${deportistaId}`).catch(() => []),
        api.get(`/deportistas/${deportistaId}/estadisticas`).catch(() => ({ porDeporte: [] })),
      ]);
      setDeportista(datosDeportista);
      setSesiones(listaSesiones);
      setCuotas(resumenCuotas);
      setEstadisticas(stats);
      setError('');

      const equiposDeEquipo = (stats.porDeporte || []).filter((d) => d.tipo === 'equipo');
      if (equiposDeEquipo.length > 0) {
        const listas = await Promise.all(
          equiposDeEquipo.map((eq) =>
            api.get(`/partidos?equipoId=${eq.equipoId}&temporadaId=${eq.temporadaId}`).catch(() => [])
          )
        );
        setPartidos(listas.flat());
      } else {
        setPartidos([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deportistaId]);

  // ---- confirmación previa (Asisto / No asisto) ----

  function estadoDeSesion(sesion) {
    return pendientes[sesion.id] || {
      estado: sesion.confirmacionPrevia || 'pendiente',
      motivo: sesion.motivo || null,
      motivoTexto: sesion.motivoTexto || '',
    };
  }

  function actualizarPendiente(sesion, cambios) {
    setPendientes((actual) => ({
      ...actual,
      [sesion.id]: { ...estadoDeSesion(sesion), ...cambios },
    }));
  }

  async function enviarConfirmacion(sesion, estado, motivo, motivoTexto) {
    setGuardandoId(sesion.id);
    try {
      await api.put(`/sesiones/${sesion.id}/mi-confirmacion`, { estado, motivo, motivoTexto });
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoId(null);
    }
  }

  function marcarAsisto(sesion) {
    actualizarPendiente(sesion, { estado: 'confirmado', motivo: null, motivoTexto: '' });
    enviarConfirmacion(sesion, 'confirmado', null, '');
  }

  function marcarNoAsisto(sesion) {
    const actual = estadoDeSesion(sesion);
    actualizarPendiente(sesion, { estado: 'rechazado' });
    // El backend exige un motivo para poder guardar "rechazado": si ya
    // había uno elegido se reenvía tal cual; si no, se espera a que elija
    // uno de los chips (que llaman a elegirMotivo, más abajo).
    if (actual.motivo) enviarConfirmacion(sesion, 'rechazado', actual.motivo, actual.motivoTexto);
  }

  function elegirMotivo(sesion, motivo) {
    const actual = estadoDeSesion(sesion);
    const texto = motivo === 'otro' ? actual.motivoTexto : '';
    actualizarPendiente(sesion, { motivo, motivoTexto: texto });
    enviarConfirmacion(sesion, 'rechazado', motivo, texto);
  }

  function escribirMotivoTexto(sesion, texto) {
    actualizarPendiente(sesion, { motivoTexto: texto });
    clearTimeout(temporizadoresTexto.current[sesion.id]);
    temporizadoresTexto.current[sesion.id] = setTimeout(() => {
      enviarConfirmacion(sesion, 'rechazado', 'otro', texto);
    }, 600);
  }

  // ---- pantalla de carga / sin ficha enlazada ----

  if (!deportistaId) {
    return (
      <div className="da-raiz">
        <div className="da-estado-carga">
          Tu usuario no tiene una ficha de deportista enlazada todavía. Contacta con el club para que te den de alta el acceso.
          <div style={{ marginTop: 16 }}>
            <button type="button" className="da-boton-salir" style={{ color: '#171613', borderColor: 'rgba(23,22,19,0.3)' }} onClick={cerrarSesion}>Salir</button>
          </div>
        </div>
      </div>
    );
  }

  if (cargando) {
    return <div className="da-raiz"><div className="da-estado-carga">Cargando tu app…</div></div>;
  }

  // ---- datos derivados para "Inicio" ----

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const lunesEstaSemana = lunesDeSemana(hoy);
  const finEstaSemana = sumarDias(lunesEstaSemana, 6);
  const lunesProximaSemana = sumarDias(lunesEstaSemana, 7);
  const finProximaSemana = sumarDias(lunesProximaSemana, 6);

  function enRango(sesion, ini, fin) {
    const f = sesion.fecha.slice(0, 10);
    return f >= aISO(ini) && f <= aISO(fin);
  }
  function ordenar(lista) {
    return [...lista].sort((a, b) => `${a.fecha}${a.horaInicio || ''}`.localeCompare(`${b.fecha}${b.horaInicio || ''}`));
  }

  const sesionesActivas = sesiones.filter((s) => !s.cancelada);
  const sesionesEstaSemana = ordenar(sesionesActivas.filter((s) => enRango(s, lunesEstaSemana, finEstaSemana)));
  const sesionesProximaSemana = ordenar(sesionesActivas.filter((s) => enRango(s, lunesProximaSemana, finProximaSemana)));

  const totalPendienteCuotas = cuotas.reduce((acc, c) => acc + (c.pendiente || 0), 0);
  const alDiaEnCuotas = totalPendienteCuotas <= 0.009;

  const nombreCorto = (deportista?.nombreDeportivo || deportista?.nombre || usuario.nombreCompleto || '').trim();
  const iniciales = `${(deportista?.nombre || usuario.nombreCompleto || '?').charAt(0)}${(deportista?.apellidos || '').charAt(0)}`.toUpperCase();
  const deportesTexto = (deportista?.deportes || []).map((d) => d.nombre).join(' · ') || '—';

  // ---- calendario del mes (mesOffset 0..2) ----
  function construirMes(offset) {
    const base = new Date(hoy.getFullYear(), hoy.getMonth() + offset, 1);
    const anio = base.getFullYear();
    const mesIndice = base.getMonth();
    const primerDiaSemana = (new Date(anio, mesIndice, 1).getDay() + 6) % 7;
    const totalDias = new Date(anio, mesIndice + 1, 0).getDate();

    const tipoPorDia = {};
    for (const s of sesionesActivas) {
      const f = s.fecha.slice(0, 10);
      if (Number(f.slice(0, 4)) !== anio || Number(f.slice(5, 7)) !== mesIndice + 1) continue;
      const nuevo = s.esRecuperacion ? 'recuperacion' : 'normal';
      if (!tipoPorDia[f] || nuevo === 'recuperacion') tipoPorDia[f] = nuevo;
    }
    for (const p of partidos) {
      const f = p.fecha.slice(0, 10);
      if (Number(f.slice(0, 4)) !== anio || Number(f.slice(5, 7)) !== mesIndice + 1) continue;
      if (!tipoPorDia[f]) tipoPorDia[f] = 'partido';
    }

    const celdas = [];
    for (let i = 0; i < primerDiaSemana; i++) celdas.push(null);
    for (let d = 1; d <= totalDias; d++) celdas.push(d);
    while (celdas.length % 7 !== 0) celdas.push(null);

    const semanas = [];
    for (let i = 0; i < celdas.length; i += 7) {
      semanas.push(celdas.slice(i, i + 7).map((num) => {
        if (num === null) return null;
        const clave = `${anio}-${pad2(mesIndice + 1)}-${pad2(num)}`;
        return { num, tipo: tipoPorDia[clave] || null, esHoy: clave === aISO(hoy) };
      }));
    }
    return { semanas, anio, mesIndice };
  }
  const mesActual = construirMes(mesOffset);

  // ---- sub-componentes de cada pestaña ----

  function TarjetaSesion({ sesion }) {
    const st = estadoDeSesion(sesion);
    const mostrarMotivo = st.estado === 'rechazado';
    const guardando = guardandoId === sesion.id;
    const fecha = fechaLocalDesdeISO(sesion.fecha);
    const titulo = sesion.esRecuperacion
      ? `${sesion.deporteNombre} · Recuperación`
      : (sesion.equipoNombre && sesion.equipoNombre !== sesion.deporteNombre ? `${sesion.deporteNombre} · ${sesion.equipoNombre}` : sesion.deporteNombre);

    return (
      <div className="da-tarjeta-sesion">
        <div className="da-fila-fecha-sesion">
          <div className="da-bloque-fecha">
            <div className="da-num">{pad2(fecha.getDate())}</div>
            <div className="da-mes">{NOMBRES_MES[fecha.getMonth()].slice(0, 3).toUpperCase()}</div>
          </div>
          <div className="da-info-sesion">
            <div className="da-deporte">{titulo || 'Sesión'}</div>
            <div className="da-detalle">
              {capitalizar(DIAS_LARGOS[(fecha.getDay() + 6) % 7])}
              {sesion.horaInicio ? ` · ${sesion.horaInicio.slice(0, 5)}` : ''}
            </div>
          </div>
        </div>
        <div className="da-toggle-asistencia">
          <button
            type="button"
            className={`da-boton-estado ${st.estado === 'confirmado' ? 'da-activo-asisto' : ''}`}
            onClick={() => marcarAsisto(sesion)}
            disabled={guardando}
          >
            Asisto
          </button>
          <button
            type="button"
            className={`da-boton-estado da-boton-no-asisto ${st.estado === 'rechazado' ? 'da-activo-no' : ''}`}
            onClick={() => marcarNoAsisto(sesion)}
            disabled={guardando}
          >
            No asisto
          </button>
        </div>
        {mostrarMotivo && (
          <div className="da-bloque-motivo">
            <div className="da-etiqueta-motivo">¿Por qué no puedes venir?</div>
            <div className="da-chips-motivo">
              {MOTIVOS.map((m) => (
                <button
                  key={m.valor}
                  type="button"
                  className={`da-chip-motivo ${st.motivo === m.valor ? 'da-activo' : ''}`}
                  onClick={() => elegirMotivo(sesion, m.valor)}
                  disabled={guardando}
                >
                  {m.etiqueta}
                </button>
              ))}
            </div>
            {st.motivo === 'otro' && (
              <input
                type="text"
                className="da-input-otro-motivo"
                placeholder="Cuéntanos el motivo…"
                value={st.motivoTexto}
                onChange={(e) => escribirMotivoTexto(sesion, e.target.value)}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  function InicioTab() {
    return (
      <div>
        <h1 className="da-titular da-titulo-pantalla">Hola, {nombreCorto} 👋</h1>
        <p className="da-subtitulo-pantalla">Así va tu semana en el club</p>

        <div className="da-grupo-titulo">Confirma tu asistencia · esta semana</div>
        {sesionesEstaSemana.length === 0
          ? <p className="da-vacio">No tienes sesiones esta semana.</p>
          : sesionesEstaSemana.map((s) => <TarjetaSesion key={s.id} sesion={s} />)}

        <div className="da-grupo-titulo">Confirma tu asistencia · próxima semana</div>
        {sesionesProximaSemana.length === 0
          ? <p className="da-vacio">Todavía no hay sesiones programadas la semana que viene.</p>
          : sesionesProximaSemana.map((s) => <TarjetaSesion key={s.id} sesion={s} />)}

        <div className="da-grupo-titulo">Tus cuotas</div>
        <div className="da-tarjeta">
          {cuotas.length === 0 ? (
            <p className="da-vacio" style={{ padding: 0 }}>Todavía no tienes ninguna cuota registrada.</p>
          ) : (
            <div className="da-fila-resumen">
              <span>Estado de tus cuotas</span>
              <span className={`da-estado-pill ${alDiaEnCuotas ? 'da-pagada' : 'da-pendiente'}`}>
                {alDiaEnCuotas ? 'Al día' : `${formatoImporte(totalPendienteCuotas)} pendiente`}
              </span>
            </div>
          )}
          <button type="button" className="da-boton-simple da-enlace-boton" onClick={() => setTab('cuotas')}>Ver detalle en Cuotas →</button>
        </div>

        <div className="da-grupo-titulo">Próximos partidos y eventos</div>
        {(estadisticas?.porDeporte || []).length === 0 && <p className="da-vacio">Todavía no estás asignado a ningún equipo.</p>}
        {(estadisticas?.porDeporte || []).map((d) => {
          if (d.tipo === 'equipo') {
            const proximo = partidos
              .filter((p) => p.equipoId === d.equipoId && !p.jugado && p.fecha.slice(0, 10) >= aISO(hoy))
              .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
            return (
              <div key={d.equipoId} className="da-tarjeta da-tarjeta-proximo">
                <div className="da-tarjeta-proximo-etiqueta">⚽ Próximo partido · {d.deporteNombre}</div>
                {proximo ? (
                  <>
                    <div className="da-tarjeta-proximo-titulo">
                      {d.equipoNombre} vs {proximo.rival}{proximo.localVisitante === 'visitante' ? ' (fuera)' : ' (casa)'}
                    </div>
                    <div className="da-tarjeta-proximo-detalle">
                      {formatoFechaCorta(proximo.fecha)}{proximo.hora ? ` · ${proximo.hora.slice(0, 5)}` : ''}
                    </div>
                  </>
                ) : (
                  <p className="da-vacio" style={{ padding: 0 }}>No hay partidos programados todavía.</p>
                )}
              </div>
            );
          }
          return (
            <div key={d.equipoId} className="da-tarjeta da-tarjeta-proximo">
              <div className="da-tarjeta-proximo-etiqueta">🎾 Próximos eventos · {d.deporteNombre}</div>
              <p className="da-vacio" style={{ padding: 0 }}>Todavía no hay eventos programados.</p>
            </div>
          );
        })}

        <div className="da-grupo-titulo">Calendario</div>
        <div className="da-tarjeta">
          <div className="da-cabecera-mes">
            <button type="button" className="da-flecha-mes" onClick={() => setMesOffset((v) => Math.max(0, v - 1))} disabled={mesOffset <= 0} aria-label="Mes anterior">‹</button>
            <span className="da-nombre-mes">{NOMBRES_MES[mesActual.mesIndice]} {mesActual.anio}</span>
            <button type="button" className="da-flecha-mes" onClick={() => setMesOffset((v) => Math.min(MES_OFFSET_MAXIMO, v + 1))} disabled={mesOffset >= MES_OFFSET_MAXIMO} aria-label="Mes siguiente">›</button>
          </div>
          <div className="da-grid-dias-semana">
            <span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span>
          </div>
          {mesActual.semanas.map((semana, i) => (
            <div key={i} className="da-fila-semana">
              {semana.map((dia, j) => (
                <div key={j} className={`da-dia-mes ${dia?.esHoy ? 'da-dia-hoy' : ''}`}>
                  {dia?.num || ''}
                  {dia?.tipo && <span className={`da-punto-dia da-punto-${dia.tipo}`}></span>}
                </div>
              ))}
            </div>
          ))}
          <div className="da-leyenda-mes">
            <span><span className="da-punto-dia da-punto-normal"></span>Entrenamiento</span>
            <span><span className="da-punto-dia da-punto-recuperacion"></span>Recuperación</span>
            <span><span className="da-punto-dia da-punto-partido"></span>Partido</span>
          </div>
        </div>
      </div>
    );
  }

  function FichaTab() {
    if (!deportista) return null;
    const fmtFecha = (f) => (f ? fechaLocalDesdeISO(f).toLocaleDateString('es-ES') : '—');
    return (
      <div>
        <h1 className="da-titular da-titulo-pantalla" style={{ fontSize: 18, marginBottom: 14 }}>Ficha personal</h1>
        <div className="da-aviso-solo-lectura">🔒 Estos datos los gestiona el club. Si algo está mal, avisa a administración.</div>
        <div className="da-tarjeta">
          <div className="da-fila-dato"><span className="da-etiqueta">Nombre</span><span className="da-valor">{deportista.nombre} {deportista.apellidos}</span></div>
          {deportista.nombreDeportivo && <div className="da-fila-dato"><span className="da-etiqueta">Nombre deportivo</span><span className="da-valor">{deportista.nombreDeportivo}</span></div>}
          {deportista.numeroSocio && <div className="da-fila-dato"><span className="da-etiqueta">Nº de socio</span><span className="da-valor">{deportista.numeroSocio}</span></div>}
          <div className="da-fila-dato"><span className="da-etiqueta">Fecha de nacimiento</span><span className="da-valor">{fmtFecha(deportista.fechaNacimiento)}</span></div>
          {deportista.dni && <div className="da-fila-dato"><span className="da-etiqueta">DNI</span><span className="da-valor">{deportista.dni}</span></div>}
          {deportista.telefonoDeportista && <div className="da-fila-dato"><span className="da-etiqueta">Teléfono (deportista)</span><span className="da-valor">{deportista.telefonoDeportista}</span></div>}
          {deportista.telefonoPadre && <div className="da-fila-dato"><span className="da-etiqueta">Teléfono (padre)</span><span className="da-valor">{deportista.telefonoPadre}</span></div>}
          {deportista.telefonoMadre && <div className="da-fila-dato"><span className="da-etiqueta">Teléfono (madre)</span><span className="da-valor">{deportista.telefonoMadre}</span></div>}
          {deportista.email && <div className="da-fila-dato"><span className="da-etiqueta">Email</span><span className="da-valor">{deportista.email}</span></div>}
          <div className="da-fila-dato">
            <span className="da-etiqueta">Deportes</span>
            <span className="da-valor">{deportesTexto}</span>
          </div>
        </div>
      </div>
    );
  }

  function AsistenciaTab() {
    const historial = [...sesiones]
      .filter((s) => s.asistio !== null && s.asistio !== undefined)
      .sort((a, b) => `${b.fecha}${b.horaInicio || ''}`.localeCompare(`${a.fecha}${a.horaInicio || ''}`))
      .slice(0, 25);
    return (
      <div>
        <h1 className="da-titular da-titulo-pantalla" style={{ fontSize: 18, marginBottom: 6 }}>Asistencia</h1>
        <div className="da-aviso-solo-lectura">🔒 Esto es lo que ha registrado tu entrenador/monitor, no lo que marcaste en Inicio.</div>
        {(estadisticas?.porDeporte || []).length > 0 && (
          <div className="da-tarjetas-stat-grid" style={{ marginBottom: 16 }}>
            {estadisticas.porDeporte.map((d) => (
              <div key={d.equipoId} className="da-tarjeta-stat">
                <div className="da-dato da-dorado">{d.asistencia.porcentaje != null ? `${d.asistencia.porcentaje}%` : '—'}</div>
                <div className="da-label">Asistencia · {d.deporteNombre}</div>
              </div>
            ))}
          </div>
        )}
        <div className="da-grupo-titulo">Últimas sesiones</div>
        {historial.length === 0 ? (
          <p className="da-vacio">Todavía no hay asistencia registrada.</p>
        ) : (
          <div className="da-tarjeta">
            {historial.map((s) => {
              const etiqueta = s.asistio ? 'Asistió' : (s.justificada ? 'Justificada' : 'Faltó');
              const clase = s.asistio ? 'da-asistio' : (s.justificada ? 'da-justificada' : 'da-no-asistio');
              return (
                <div key={s.id} className="da-fila-resumen">
                  <span>{formatoFechaCorta(s.fecha)} · {s.deporteNombre}</span>
                  <span className={`da-estado-pill ${clase}`}>{etiqueta}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function CuotasTab() {
    return (
      <div>
        <h1 className="da-titular da-titulo-pantalla" style={{ fontSize: 18, marginBottom: 6 }}>Cuotas</h1>
        <div className="da-aviso-solo-lectura">🔒 Lo gestiona administración. Cualquier duda, contacta con el club.</div>
        <div className="da-tarjeta" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 12, color: '#8C8776', fontWeight: 600, textTransform: 'uppercase' }}>Estado actual</div>
            <div className="da-titular" style={{ fontSize: 20, color: '#171613', fontWeight: 600, marginTop: 2 }}>
              {alDiaEnCuotas ? 'Al día' : 'Pendiente'}
            </div>
          </div>
          <span className={`da-estado-pill ${alDiaEnCuotas ? 'da-pagada' : 'da-pendiente'}`} style={{ fontSize: 12, padding: '6px 14px' }}>
            {alDiaEnCuotas ? '✓ Pagada' : formatoImporte(totalPendienteCuotas)}
          </span>
        </div>
        <div className="da-grupo-titulo">Detalle de cuotas</div>
        {cuotas.length === 0 ? (
          <p className="da-vacio">Todavía no tienes ninguna cuota registrada.</p>
        ) : (
          <div className="da-tarjeta">
            {cuotas.map((c) => (
              <div key={c.id} className="da-fila-resumen">
                <span>{c.deporteNombre} · {c.concepto} · {formatoImporte(c.totalAPagar)}</span>
                <span className={`da-estado-pill ${c.pendiente > 0.009 ? 'da-pendiente' : 'da-pagada'}`}>
                  {c.pendiente > 0.009 ? `${formatoImporte(c.pendiente)} pdte.` : 'Pagada'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function EstadisticasTab() {
    const lista = estadisticas?.porDeporte || [];
    return (
      <div>
        <h1 className="da-titular da-titulo-pantalla" style={{ fontSize: 18, marginBottom: 14 }}>Estadísticas</h1>
        {lista.length === 0 && <p className="da-vacio">Todavía no hay estadísticas disponibles.</p>}
        {lista.map((d) => (
          <div key={d.equipoId}>
            <div className="da-grupo-titulo">{d.deporteNombre} · {d.equipoNombre}</div>
            <div className="da-tarjetas-stat-grid" style={{ marginBottom: 16 }}>
              {d.tipo === 'equipo' ? (
                <>
                  <div className="da-tarjeta-stat"><div className="da-dato">{d.partidos.jugados}</div><div className="da-label">Partidos jugados</div></div>
                  <div className="da-tarjeta-stat"><div className="da-dato da-dorado">{d.partidos.goles}</div><div className="da-label">Goles</div></div>
                  <div className="da-tarjeta-stat"><div className="da-dato">{d.partidos.convocatorias}</div><div className="da-label">Convocatorias</div></div>
                  <div className="da-tarjeta-stat"><div className="da-dato">{d.asistencia.porcentaje != null ? `${d.asistencia.porcentaje}%` : '—'}</div><div className="da-label">Asistencia</div></div>
                </>
              ) : (
                <>
                  <div className="da-tarjeta-stat"><div className="da-dato">{d.asistencia.asistidas}/{d.asistencia.convocado}</div><div className="da-label">Sesiones esta temporada</div></div>
                  <div className="da-tarjeta-stat"><div className="da-dato da-dorado">{d.asistencia.porcentaje != null ? `${d.asistencia.porcentaje}%` : '—'}</div><div className="da-label">Asistencia</div></div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const PESTANAS = [
    { id: 'inicio', etiqueta: 'Inicio' },
    { id: 'ficha', etiqueta: 'Ficha' },
    { id: 'asistencia', etiqueta: 'Asistencia' },
    { id: 'cuotas', etiqueta: 'Cuotas' },
    { id: 'estadisticas', etiqueta: 'Stats' },
  ];

  return (
    <div className="da-raiz">
      <div className="da-cabecera">
        <div className="da-cabecera-marca">
          <div className="da-cabecera-logo"><span>N</span></div>
          <span className="da-titular da-cabecera-nombre-app">NUBAPP</span>
        </div>
        <div className="da-cabecera-usuario">
          <div className="da-cabecera-usuario-texto">
            <div className="da-cabecera-usuario-nombre">{nombreCorto}</div>
            <div className="da-cabecera-usuario-deportes">{deportesTexto}</div>
          </div>
          <div className="da-avatar-cabecera"><span>{iniciales}</span></div>
          <button type="button" className="da-boton-salir" onClick={cerrarSesion}>Salir</button>
        </div>
      </div>

      <div className="da-contenido">
        {error && <p className="error">{error}</p>}
        {tab === 'inicio' && <InicioTab />}
        {tab === 'ficha' && <FichaTab />}
        {tab === 'asistencia' && <AsistenciaTab />}
        {tab === 'cuotas' && <CuotasTab />}
        {tab === 'estadisticas' && <EstadisticasTab />}
      </div>

      <div className="da-nav-inferior">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="da-boton-simple da-nav-boton"
            style={{ color: tab === p.id ? '#171613' : '#ADA998' }}
            onClick={() => setTab(p.id)}
          >
            <span>{p.etiqueta}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
