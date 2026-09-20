// Asigna un color estable (una de las clases .etiqueta-color-N de
// global.css) a cualquier texto libre, para que las mismas palabras
// (un deporte, una tipología de ejercicio, una categoría...) siempre
// salgan pintadas igual en toda la app sin mantener una lista cerrada.
const COLORES_ETIQUETA = [
  'etiqueta-color-1', 'etiqueta-color-2', 'etiqueta-color-3',
  'etiqueta-color-4', 'etiqueta-color-5', 'etiqueta-color-6',
];

export function colorEtiqueta(texto) {
  if (!texto) return '';
  let hash = 0;
  for (let i = 0; i < texto.length; i += 1) hash = (hash * 31 + texto.charCodeAt(i)) % COLORES_ETIQUETA.length;
  return COLORES_ETIQUETA[hash];
}

// Iniciales para el avatar-círculo (ej: "Julián González" -> "JG").
export function iniciales(nombre, apellidos) {
  const a = (nombre || '').trim().charAt(0);
  const b = (apellidos || '').trim().charAt(0);
  return `${a}${b}`.toUpperCase() || '?';
}
