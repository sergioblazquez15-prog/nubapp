// Pantalla global que junta las solicitudes de alta de TODOS los
// equipos (llegadas por sus enlaces públicos — ver EnlaceAltaEquipo en
// Equipos.jsx). También se pueden revisar una a una desde la ficha de
// cada equipo; esta pantalla es solo para no tener que ir equipo por
// equipo si llegan de varios a la vez.
import { useEffect, useState } from 'react';
import { api } from '../api/client';

const ETIQUETAS_ESTADO = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada' };

export default function SolicitudesAlta() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [temporadas, setTemporadas] = useState([]);
  const [estado, setEstado] = useState('pendiente');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aprobandoId, setAprobandoId] = useState(null);
  const [credenciales, setCredenciales] = useState([]);

  async function cargar() {
    setCargando(true);
    try {
      const parametros = estado ? `?estado=${estado}` : '';
      setSolicitudes(await api.get(`/solicitudes${parametros}`));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    api.get('/temporadas').then(setTemporadas).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  async function aprobar(solicitud, datos) {
    const resultado = await api.post(`/solicitudes/${solicitud.id}/aprobar`, datos);
    setAprobandoId(null);
    if (resultado.acceso) {
      setCredenciales((prev) => [
        ...prev,
        { nombre: `${solicitud.nombre} ${solicitud.apellidos}`, equipoNombre: solicitud.equipoNombre, ...resultado.acceso },
      ]);
    }
    cargar();
  }

  async function rechazar(id) {
    if (!confirm('¿Rechazar esta solicitud?')) return;
    await api.post(`/solicitudes/${id}/rechazar`);
    cargar();
  }

  return (
    <div className="pantalla-solicitudes-alta">
      <h1>📨 Solicitudes de alta</h1>
      <p className="nota">
        Todas las solicitudes recibidas por los enlaces públicos de los equipos (ver botón "Enlace
        de alta" en la ficha de cada equipo, donde también se pueden revisar una a una).
      </p>

      <div className="barra-filtros">
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="pendiente">Pendientes</option>
          <option value="aprobada">Aprobadas</option>
          <option value="rechazada">Rechazadas</option>
          <option value="">Todas</option>
        </select>
      </div>

      {credenciales.length > 0 && (
        <div className="nota" style={{ background: 'var(--color-superficie-alt)', padding: 10, borderRadius: 8, marginBottom: 14 }}>
          <p style={{ margin: '0 0 4px', fontWeight: 600 }}>
            Acceso a "Mi app" creado — apunta estos datos, no se pueden volver a mostrar:
          </p>
          <div className="tabla-scroll">
            <table className="tabla-usuarios">
              <thead><tr><th>Deportista</th><th>Equipo</th><th>Email</th><th>Contraseña</th></tr></thead>
              <tbody>
                {credenciales.map((c, i) => (
                  <tr key={i}>
                    <td>{c.nombre}</td>
                    <td>{c.equipoNombre}</td>
                    <td>{c.email}{c.emailGenerado && <span className="nota"> (generado)</span>}</td>
                    <td>{c.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {cargando ? (
        <p className="cargando">Cargando…</p>
      ) : solicitudes.length === 0 ? (
        <p className="nota">No hay solicitudes con este filtro.</p>
      ) : (
        <ul className="lista-dashboard">
          {solicitudes.map((s) => (
            <li key={s.id} className="tarjeta" style={{ marginBottom: 10 }}>
              {aprobandoId === s.id ? (
                <FormularioAprobar
                  solicitud={s}
                  temporadas={temporadas}
                  onGuardar={(datos) => aprobar(s, datos)}
                  onCancelar={() => setAprobandoId(null)}
                />
              ) : (
                <>
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {s.nombre} {s.apellidos} <span className="nota" style={{ fontWeight: 400 }}>→ {s.equipoNombre} ({s.deporteNombre})</span>
                  </p>
                  <p className="nota" style={{ margin: '2px 0 8px' }}>
                    {[s.email, s.telefono].filter(Boolean).join(' · ') || 'Sin contacto indicado'}
                    {' · '}<span className="etiqueta-suave">{ETIQUETAS_ESTADO[s.estado] || s.estado}</span>
                  </p>
                  {s.estado === 'pendiente' && (
                    <div className="acciones-fila">
                      <button onClick={() => setAprobandoId(s.id)}>Aprobar</button>
                      <button className="boton-peligro" onClick={() => rechazar(s.id)}>Rechazar</button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FormularioAprobar({ solicitud, temporadas, onGuardar, onCancelar }) {
  const [temporadaId, setTemporadaId] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [numeroSocio, setNumeroSocio] = useState('');
  const [dni, setDni] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (temporadaId || temporadas.length === 0) return;
    const principal = temporadas.find((t) => t.esPrincipal) || temporadas[0];
    if (principal) setTemporadaId(principal.id);
  }, [temporadas, temporadaId]);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!temporadaId || !fechaNacimiento) return;
    setError('');
    setEnviando(true);
    try {
      await onGuardar({
        temporadaId, fechaNacimiento,
        numeroSocio: numeroSocio || undefined,
        dni: dni || undefined,
      });
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={manejarEnvio}>
      <p style={{ margin: '0 0 8px', fontWeight: 600 }}>
        {solicitud.nombre} {solicitud.apellidos} → {solicitud.equipoNombre}
      </p>
      <label>
        Temporada en la que se ficha
        <select value={temporadaId} onChange={(e) => setTemporadaId(e.target.value)} required>
          {temporadas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
      </label>
      <label>
        Fecha de nacimiento
        <input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} required />
      </label>
      <label>
        Nº de socio (opcional)
        <input value={numeroSocio} onChange={(e) => setNumeroSocio(e.target.value)} />
      </label>
      <label>
        DNI (opcional)
        <input value={dni} onChange={(e) => setDni(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="acciones-fila">
        <button type="submit" disabled={enviando}>{enviando ? 'Creando ficha y acceso…' : 'Aprobar, crear ficha y dar acceso'}</button>
        <button type="button" onClick={onCancelar} disabled={enviando}>Cancelar</button>
      </div>
    </form>
  );
}
