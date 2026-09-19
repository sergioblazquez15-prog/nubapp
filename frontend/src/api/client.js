// Cliente HTTP mínimo: añade el token JWT a cada petición y centraliza el
// manejo de errores para no repetir fetch + try/catch en cada pantalla.
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

async function peticion(ruta, opciones = {}) {
  const token = localStorage.getItem('nubapp_token');

  const respuesta = await fetch(`${BASE_URL}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opciones.headers,
    },
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });

  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new Error(datos?.error || `Error ${respuesta.status}`);
  }

  return datos;
}

// Para subir archivos (ej: foto del deportista) con FormData: sin
// Content-Type manual (el navegador pone el boundary) y sin JSON.stringify.
async function peticionArchivo(ruta, formData) {
  const token = localStorage.getItem('nubapp_token');
  const respuesta = await fetch(`${BASE_URL}${ruta}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new Error(datos?.error || `Error ${respuesta.status}`);
  }
  return datos;
}

export const api = {
  get: (ruta) => peticion(ruta),
  post: (ruta, body) => peticion(ruta, { method: 'POST', body }),
  put: (ruta, body) => peticion(ruta, { method: 'PUT', body }),
  delete: (ruta) => peticion(ruta, { method: 'DELETE' }),
  postFile: (ruta, formData) => peticionArchivo(ruta, formData),
};

// BASE_URL suele ser ".../api"; los archivos subidos (fotos) se sirven
// fuera de /api, así que quitamos ese sufijo para construir su URL.
const ORIGEN = BASE_URL.replace(/\/api\/?$/, '');
export function urlMedia(ruta) {
  if (!ruta) return null;
  return ruta.startsWith('http') ? ruta : `${ORIGEN}${ruta}`;
}
