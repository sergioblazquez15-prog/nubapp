// Formulario público (sin login) al que llega quien abre el enlace de
// alta de un equipo (ver EnlaceAltaEquipo en Equipos.jsx y
// backend/src/routes/altaPublica.js). Vive fuera del layout con menú,
// igual que Login — pantalla suelta para quien todavía no tiene cuenta.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import escudoAdnb from '../assets/escudo-adnb.png';

export default function AltaPublica() {
  const { token } = useParams();
  const [equipo, setEquipo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.get(`/alta-publica/${token}`)
      .then(setEquipo)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [token]);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!nombre.trim() || !apellidos.trim() || !email.trim()) return;
    setError('');
    setEnviando(true);
    try {
      await api.post(`/alta-publica/${token}`, {
        nombre: nombre.trim(),
        apellidos: apellidos.trim(),
        email: email.trim(),
        telefono: telefono.trim() || undefined,
      });
      setEnviado(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="pantalla-login">
      <div className="tarjeta tarjeta-login" style={{ maxWidth: 420 }}>
        <img src={escudoAdnb} alt="Escudo AD Nuevo Baztán" className="escudo-login" />
        <h1 className="marca-login">NUBAPP</h1>
        <p className="subtitulo">AD Nuevo Baztán</p>

        {cargando ? (
          <p className="cargando">Cargando…</p>
        ) : !equipo ? (
          <p className="error">{error || 'Este enlace no es válido.'}</p>
        ) : enviado ? (
          <p className="nota" style={{ textAlign: 'center' }}>
            ¡Solicitud enviada! El club la revisará y se pondrá en contacto contigo.
          </p>
        ) : (
          <>
            <p className="nota" style={{ textAlign: 'center', marginBottom: 12 }}>
              Solicitud para unirte a <strong>{equipo.nombre}</strong> ({equipo.deporteNombre}
              {equipo.categoria ? ` · ${equipo.categoria}` : ''})
            </p>
            <form onSubmit={manejarEnvio}>
              <label>
                Nombre
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              </label>
              <label>
                Apellidos
                <input value={apellidos} onChange={(e) => setApellidos(e.target.value)} required />
              </label>
              <label>
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label>
                Teléfono (opcional)
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              </label>
              <p className="nota" style={{ fontSize: 12.5 }}>
                El email es obligatorio: con él te daremos acceso a "Mi app" cuando el club apruebe
                tu solicitud. Revisará tus datos antes de darte de alta definitivamente.
              </p>
              {error && <p className="error">{error}</p>}
              <button type="submit" disabled={enviando} style={{ width: '100%', marginTop: 8 }}>
                {enviando ? 'Enviando…' : 'Enviar solicitud'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
