// Asistente de 3 pasos para el cambio de temporada. El backend
// (POST /api/temporadas/:id/traspaso) ya existe y hace el trabajo real:
// copia equipos, personal y plantilla (deportistas activos) de una
// temporada a otra sin duplicar nada si se repite. Aquí solo se
// construye la parte visual para no tener que hacerlo a mano con la API.
import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function TraspasoTemporada() {
  const [temporadas, setTemporadas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [paso, setPaso] = useState(0);

  const [origenId, setOrigenId] = useState('');
  const [nombreNueva, setNombreNueva] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [incluirDorsales, setIncluirDorsales] = useState(false);
  const [destinoId, setDestinoId] = useState('');
  const [resultado, setResultado] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.get('/temporadas').then((lista) => {
      setTemporadas(lista);
      const principal = lista.find((t) => t.esPrincipal) || lista[0];
      if (principal) {
        setOrigenId(principal.id);
        const anioInicio = Number(principal.nombre?.split('/')[0]) + 1 || new Date().getFullYear() + 1;
        setNombreNueva(`${anioInicio}/${anioInicio + 1}`);
        setFechaInicio(`${anioInicio}-09-01`);
        setFechaFin(`${anioInicio + 1}-06-30`);
      }
      setError('');
    }).catch((err) => setError(err.message)).finally(() => setCargando(false));
  }, []);

  async function crearTemporadaYContinuar() {
    if (!nombreNueva || !fechaInicio || !fechaFin) return;
    setEnviando(true);
    setError('');
    try {
      const creada = await api.post('/temporadas', { nombre: nombreNueva, fechaInicio, fechaFin });
      setDestinoId(creada.id);
      setPaso(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarTraspaso() {
    setEnviando(true);
    setError('');
    try {
      const res = await api.post(`/temporadas/${destinoId}/traspaso`, { temporadaOrigenId: origenId, incluirDorsales });
      setResultado(res);
      setPaso(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const nombresPasos = ['Nueva temporada', 'Confirmar traspaso', 'Hecho'];

  return (
    <div className="pantalla-traspaso">
      <h1>Traspaso de temporada</h1>
      <p className="subtitulo">Cierra la temporada actual y prepara la siguiente sin perder ningún dato.</p>

      <div className="pasos-traspaso" style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '16px 0 20px' }}>
        {nombresPasos.map((n, i) => (
          <span key={n} className={`etiqueta-suave ${i === paso ? 'etiqueta-color-1' : ''}`}>
            {i + 1}. {n}
          </span>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      {cargando ? (
        <p className="cargando">Cargando…</p>
      ) : (
        <div className="bloque-ficha">
          {paso === 0 && (
            <>
              <h2>Datos de la nueva temporada</h2>
              <p className="nota" style={{ marginBottom: 12 }}>
                Se traspasarán los equipos, el personal y los deportistas activos de{' '}
                <strong>{temporadas.find((t) => t.id === origenId)?.nombre || '—'}</strong>.
                La temporada actual queda tal cual, solo de lectura para lo histórico.
              </p>
              <label>Temporada de origen</label>
              <select value={origenId} onChange={(e) => setOrigenId(e.target.value)} style={{ marginBottom: 10 }}>
                {temporadas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
              <label>Nombre de la nueva temporada</label>
              <input value={nombreNueva} onChange={(e) => setNombreNueva(e.target.value)} style={{ marginBottom: 10 }} />
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label>Inicio</label>
                  <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Fin</label>
                  <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <input type="checkbox" checked={incluirDorsales} onChange={(e) => setIncluirDorsales(e.target.checked)} />
                Mantener los dorsales del año pasado (si no, empiezan en blanco)
              </label>
              <button onClick={crearTemporadaYContinuar} disabled={enviando} style={{ marginTop: 16 }}>
                {enviando ? 'Creando…' : 'Crear temporada y continuar'}
              </button>
            </>
          )}

          {paso === 1 && (
            <>
              <h2>Confirmar traspaso</h2>
              <p className="nota" style={{ marginBottom: 16 }}>
                Se copiarán los equipos, el personal y la plantilla de <strong>{temporadas.find((t) => t.id === origenId)?.nombre}</strong> a{' '}
                <strong>{nombreNueva}</strong>. Es seguro repetir esta operación: nada se duplica.
              </p>
              <button onClick={confirmarTraspaso} disabled={enviando}>
                {enviando ? 'Traspasando…' : 'Iniciar traspaso'}
              </button>
              <button className="boton-enlace" onClick={() => setPaso(0)} style={{ marginLeft: 10 }}>Atrás</button>
            </>
          )}

          {paso === 2 && resultado && (
            <>
              <h2>Traspaso completado</h2>
              <ul className="lista-dashboard">
                <li>Equipos creados: <strong>{resultado.equiposCreados}</strong></li>
                <li>Equipos que ya existían: <strong>{resultado.equiposYaExistian}</strong></li>
                <li>Personal técnico asignado: <strong>{resultado.personalAsignado}</strong></li>
                <li>Deportistas fichados: <strong>{resultado.deportistasFichados}</strong></li>
              </ul>
              <p className="nota" style={{ marginTop: 12 }}>
                Revisa la nueva temporada en Plantillas y márcala como principal cuando quieras
                empezar a trabajar en ella desde Equipos.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
