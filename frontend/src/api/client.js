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

// Para descargar archivos generados por el backend (ej: Excel de cuotas)
// que requieren el token de autenticación - un <a href> normal no puede
// mandar el header Authorization, así que se pide como blob y se fuerza
// la descarga en el navegador con un enlace temporal.
async function peticionDescarga(ruta, nombreArchivoPorDefecto) {
  const token = localStorage.getItem('nubapp_token');
  const respuesta = await fetch(`${BASE_URL}${ruta}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => null);
    throw new Error(datos?.error || `Error ${respuesta.status}`);
  }
  const disposicion = respuesta.headers.get('Content-Disposition') || '';
  const coincidencia = disposicion.match(/filename="?([^"]+)"?/);
  const nombreArchivo = coincidencia ? coincidencia[1] : nombreArchivoPorDefecto;
  const blob = await respuesta.blob();
  const url = window.URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.URL.revokeObjectURL(url);
}

export const api = {
  get: (ruta) => peticion(ruta),
  post: (ruta, body) => peticion(ruta, { method: 'POST', body }),
  put: (ruta, body) => peticion(ruta, { method: 'PUT', body }),
  delete: (ruta) => peticion(ruta, { method: 'DELETE' }),
  postFile: (ruta, formData) => peticionArchivo(ruta, formData),
  descargar: (ruta, nombreArchivoPorDefecto) => peticionDescarga(ruta, nombreArchivoPorDefecto),
};

// BASE_URL suele ser ".../api"; los archivos subidos (fotos) se sirven
// fuera de /api, así que quitamos ese sufijo para construir su URL.
const ORIGEN = BASE_URL.replace(/\/api\/?$/, '');
export function urlMedia(ruta) {
  if (!ruta) return null;
  return ruta.startsWith('http') ? ruta : `${ORIGEN}${ruta}`;
}
