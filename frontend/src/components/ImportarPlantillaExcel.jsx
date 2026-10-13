// Sube el Excel de plantillas (ver POST /deportistas/importar en el
// backend, y la plantilla oficial "plantilla_deportistas_nubapp.xlsx" que
// se entrega aparte): una fila por deportista y equipo/deporte — crea o
// actualiza la ficha (por Nº de socio si lo trae, o si no por nombre +
// apellidos + fecha de nacimiento), lo asigna al equipo de la temporada
// elegida y le crea SIEMPRE su acceso propio a "Mi app" si todavía no lo
// tenía (generando email y/o contraseña provisionales cuando la fila no
// los trae, para poder comunicárselos a la familia).
//
// Mismo componente compartido en las tres pantallas donde Sergio esperaba
// encontrarlo: Fichas de deportistas, Equipos (gestión de plantillas) y
// Usuarios (porque crea cuentas de acceso).
import { useEffect, useState } from 'react';

export default function ImportarPlantillaExcel({ temporadas, onImportar }) {
  const [temporadaId, setTemporadaId] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    if (temporadaId || temporadas.length === 0) return;
    const principal = temporadas.find((t) => t.esPrincipal) || temporadas[0];
    if (principal) setTemporadaId(principal.id);
  }, [temporadas, temporadaId]);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!temporadaId || !archivo) return;
    setError('');
    setResultado(null);
    setEnviando(true);
    try {
      const r = await onImportar(archivo, temporadaId);
      setResultado(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta formulario-usuario" onSubmit={manejarEnvio} style={{ maxWidth: 680 }}>
      <p className="nota">
        Sube la plantilla oficial rellena (una fila por deportista y equipo/deporte — si practica
        varios, una fila por cada uno). El Nº de socio es opcional: si lo rellenas, sirve para
        reconocer si ese deportista ya existe en NUBAPP (y ACTUALIZAR su ficha) o hay que CREARLA;
        si lo dejas en blanco, se intenta reconocer por nombre + apellidos + fecha de nacimiento, y
        si tampoco hay ninguno igual se crea sin número de socio. El equipo/deporte de cada fila se
        busca en la temporada que elijas aquí abajo. A cada deportista que todavía no tenga acceso
        propio a "Mi app" se le crea uno automáticamente — si rellenaste "Email acceso Mi app" y
        "Contraseña inicial" se usan tal cual, y si no, se generan solos (los verás abajo en el
        resultado, apúntalos para dárselos a la familia).
      </p>
      <label>
        Temporada (a la que se asignan los equipos de la plantilla)
        <select value={temporadaId} onChange={(e) => setTemporadaId(e.target.value)} required>
          <option value="" disabled>Selecciona una temporada…</option>
          {temporadas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
      </label>
      <label>
        Archivo Excel (.xlsx)
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => setArchivo(e.target.files?.[0] || null)}
          required
        />
      </label>
      {error && <p className="error">{error}</p>}
      {resultado && (
        <div className="nota" style={{ background: 'var(--color-superficie-alt)', padding: 10, borderRadius: 8 }}>
          <p style={{ margin: 0 }}>
            {resultado.creados} deportista(s) nuevo(s) · {resultado.actualizados} actualizado(s)
            {resultado.accesosExistentes > 0 && ` · ${resultado.accesosExistentes} ya tenían acceso (sin tocar)`}
          </p>
          {resultado.detalleAccesos?.length > 0 && (
            <>
              <p style={{ margin: '10px 0 4px', fontWeight: 600 }}>
                {resultado.detalleAccesos.length} acceso(s) nuevo(s) a "Mi app" — apunta estos datos, no se pueden volver a mostrar:
              </p>
              <div className="tabla-scroll">
                <table className="tabla-usuarios">
                  <thead><tr><th>Deportista</th><th>Nº socio</th><th>Email</th><th>Contraseña</th></tr></thead>
                  <tbody>
                    {resultado.detalleAccesos.map((a, i) => (
                      <tr key={i}>
                        <td>{a.nombre}</td>
                        <td>{a.numeroSocio || '—'}</td>
                        <td>{a.email}{a.emailGenerado && <span className="nota"> (generado)</span>}</td>
                        <td>{a.password}{a.passwordGenerada && <span className="nota"> (generada)</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {resultado.errores?.length > 0 && (
            <>
              <p style={{ margin: '10px 0 4px' }} className="texto-peligro">
                {resultado.errores.length} fila(s) con avisos o errores:
              </p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {resultado.errores.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
      <button type="submit" disabled={enviando}>{enviando ? 'Importando…' : 'Importar'}</button>
    </form>
  );
}
