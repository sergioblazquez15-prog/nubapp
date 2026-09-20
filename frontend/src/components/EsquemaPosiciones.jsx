// Esquema clicable/visual del campo de fútbol o la pista de baloncesto,
// extraído de Equipos.jsx (donde ya funcionaba dentro del editor de ficha
// técnica) para poder reutilizarlo tal cual, sin reinventarlo, en otras
// pantallas — la ficha individual del deportista y, más adelante,
// cualquier otra vista que necesite mostrar una posición sobre el campo.
//
// Catálogos de posiciones, en % del ancho/alto sobre un viewBox 0-100.
export const POSICIONES_FUTBOL = [
  { id: 'portero', nombre: 'Portero', x: 50, y: 92 },
  { id: 'central', nombre: 'Central', x: 35, y: 78 },
  { id: 'central', nombre: 'Central', x: 65, y: 78 },
  { id: 'lateral', nombre: 'Lateral', x: 10, y: 75 },
  { id: 'lateral', nombre: 'Lateral', x: 90, y: 75 },
  { id: 'medio_centro', nombre: 'Medio centro', x: 50, y: 58 },
  { id: 'interior', nombre: 'Interior', x: 30, y: 42 },
  { id: 'interior', nombre: 'Interior', x: 70, y: 42 },
  { id: 'extremo', nombre: 'Extremo', x: 8, y: 20 },
  { id: 'extremo', nombre: 'Extremo', x: 92, y: 20 },
  { id: 'delantero', nombre: 'Delantero', x: 50, y: 8 },
];

export const POSICIONES_BALONCESTO = [
  { id: 'base', nombre: 'Base', x: 50, y: 80 },
  { id: 'escolta', nombre: 'Escolta', x: 22, y: 58 },
  { id: 'alero', nombre: 'Alero', x: 78, y: 45 },
  { id: 'ala_pivot', nombre: 'Ala-pívot', x: 30, y: 22 },
  { id: 'pivot', nombre: 'Pívot', x: 50, y: 8 },
];

export function catalogoPosicionesPara(deporteNombre) {
  if (deporteNombre === 'Baloncesto') return POSICIONES_BALONCESTO;
  if (deporteNombre === 'Futbol') return POSICIONES_FUTBOL;
  return null; // el resto de deportes todavía no tienen esquema propio
}

export function nombrePosicion(deporteNombre, id) {
  const catalogo = deporteNombre === 'Baloncesto' ? POSICIONES_BALONCESTO : POSICIONES_FUTBOL;
  return catalogo.find((p) => p.id === id)?.nombre || id;
}

// Esquema clicable del campo de fútbol o la pista de baloncesto. Cada
// posición es un punto marcado sobre un SVG con las líneas del terreno de
// juego; se resalta en dorado si es la principal y en un tono más suave
// si es la secundaria. Pasa onClicPosicion={null} (o no lo pases) para
// una versión de solo lectura, sin puntos clicables.
export function EsquemaPosiciones({ posiciones, tipoCancha, posicionPrincipal, posicionSecundaria, onClicPosicion }) {
  const soloLectura = !onClicPosicion;
  return (
    <svg viewBox="0 0 100 100" className={`esquema-posiciones esquema-${tipoCancha}`} role="group" aria-label="Esquema de posiciones">
      {tipoCancha === 'futbol' ? <FondoCampoFutbol /> : <FondoPistaBaloncesto />}
      {posiciones.map((p, indice) => {
        const estado = p.id === posicionPrincipal ? 'principal' : p.id === posicionSecundaria ? 'secundaria' : '';
        if (!estado && soloLectura) return null; // en solo lectura no interesa pintar posiciones vacías
        return (
          <g
            key={indice}
            className={`marcador-posicion ${estado}`}
            transform={`translate(${p.x}, ${p.y})`}
            onClick={onClicPosicion ? () => onClicPosicion(p.id) : undefined}
            role={onClicPosicion ? 'button' : undefined}
            tabIndex={onClicPosicion ? 0 : undefined}
            aria-label={p.nombre}
            onKeyDown={onClicPosicion ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClicPosicion(p.id);
              }
            } : undefined}
          >
            <circle r="6.5" />
            <text y="2">{p.nombre.slice(0, 3).toUpperCase()}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function FondoCampoFutbol() {
  return (
    <g className="fondo-cancha">
      <rect x="2" y="2" width="96" height="96" rx="2" />
      <line x1="2" y1="50" x2="98" y2="50" />
      <circle cx="50" cy="50" r="9" />
      <rect x="25" y="2" width="50" height="14" />
      <rect x="25" y="84" width="50" height="14" />
      <rect x="38" y="2" width="24" height="6" />
      <rect x="38" y="92" width="24" height="6" />
    </g>
  );
}

export function FondoPistaBaloncesto() {
  return (
    <g className="fondo-cancha">
      <rect x="2" y="2" width="96" height="96" rx="2" />
      <circle cx="50" cy="50" r="9" />
      <rect x="30" y="2" width="40" height="30" />
      <path d="M 30 32 A 20 20 0 0 0 70 32" />
      <path d="M 20 2 A 45 45 0 0 0 20 40" />
      <path d="M 80 2 A 45 45 0 0 1 80 40" />
    </g>
  );
}
