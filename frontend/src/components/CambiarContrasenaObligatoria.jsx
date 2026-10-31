// Pantalla obligatoria para quien todavía tiene la contraseña inicial
// automática (1234, ver debe_cambiar_contrasena en la base de datos):
// RutaProtegida la muestra en vez de cualquier otra pantalla hasta que
// el usuario se pone una contraseña propia. Reutiliza el mismo aspecto
// que Login (misma hoja de estilos).
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import escudoAdnb from '../assets/escudo-adnb.png';

export function CambiarContrasenaObligatoria() {
  const { usuario, marcarContrasenaCambiada, cerrarSesion } = useAuth();
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordRepetida, setPasswordRepetida] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    setError('');

    if (passwordNueva.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (passwordNueva !== passwordRepetida) {
      setError('Las dos contraseñas no coinciden');
      return;
    }
    if (passwordNueva === '1234') {
      setError('Tiene que ser distinta de la contraseña inicial (1234)');
      return;
    }

    setEnviando(true);
    try {
      await api.put(`/usuarios/${usuario.id}/password`, { password: passwordNueva });
      marcarContrasenaCambiada();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="pantalla-login">
      <form className="tarjeta tarjeta-login" onSubmit={manejarEnvio}>
        <img src={escudoAdnb} alt="Escudo AD Nuevo Baztán" className="escudo-login" />
        <h1 className="marca-login">NUBAPP</h1>
        <p className="subtitulo">Pon tu contraseña</p>
        <p className="nota">
          Por seguridad, antes de continuar tienes que cambiar la contraseña inicial por una propia.
        </p>

        <label>
          Nueva contraseña
          <input
            type="password"
            value={passwordNueva}
            onChange={(e) => setPasswordNueva(e.target.value)}
            required
            minLength={8}
            autoFocus
          />
        </label>

        <label>
          Repite la nueva contraseña
          <input
            type="password"
            value={passwordRepetida}
            onChange={(e) => setPasswordRepetida(e.target.value)}
            required
            minLength={8}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="boton-ancho boton-login" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar y continuar'}
        </button>

        <button type="button" className="boton-enlace" onClick={cerrarSesion}>
          Salir
        </button>
      </form>
    </div>
  );
}
