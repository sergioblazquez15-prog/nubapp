// Estado global de sesión: guarda el token en localStorage, carga el
// usuario autenticado al arrancar (GET /auth/yo) y expone login/logout.
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const ContextoAuth = createContext(null);

export function ProveedorAuth({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('nubapp_token');
    if (!token) {
      setCargando(false);
      return;
    }

    api
      .get('/auth/yo')
      .then(setUsuario)
      .catch(() => localStorage.removeItem('nubapp_token'))
      .finally(() => setCargando(false));
  }, []);

  async function iniciarSesion(email, password) {
    const { token, usuario: datosUsuario } = await api.post('/auth/login', { email, password });
    localStorage.setItem('nubapp_token', token);
    setUsuario(datosUsuario);
  }

  function cerrarSesion() {
    localStorage.removeItem('nubapp_token');
    setUsuario(null);
  }

  function tieneRol(...roles) {
    return Boolean(usuario) && roles.some((r) => usuario.roles.includes(r));
  }

  return (
    <ContextoAuth.Provider value={{ usuario, cargando, iniciarSesion, cerrarSesion, tieneRol }}>
      {children}
    </ContextoAuth.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(ContextoAuth);
  if (!contexto) throw new Error('useAuth debe usarse dentro de <ProveedorAuth>');
  return contexto;
}
