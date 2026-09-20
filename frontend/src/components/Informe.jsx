// Piezas reutilizables para "generar informe PDF" en cualquier pantalla:
// no se genera un PDF en el servidor (eso exigiría un navegador headless
// corriendo en el VPS, pesado e innecesario) — en su lugar se usa el
// propio diálogo de impresión del navegador ("Guardar como PDF"), con una
// hoja de estilos de impresión (@media print en global.css) que oculta la
// navegación/botones y dibuja una cabecera de informe solo visible al
// imprimir. El resultado es un PDF limpio con lo que hay en pantalla en
// ese momento.
export function BotonInforme({ titulo = 'informe', className = '' }) {
  function imprimir() {
    const tituloOriginal = document.title;
    document.title = titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_');
    window.print();
    setTimeout(() => { document.title = tituloOriginal; }, 500);
  }
  return (
    <button type="button" className={`boton-informe ${className}`} onClick={imprimir}>
      🖨️ Generar informe PDF
    </button>
  );
}

// Solo se ve al imprimir (display:none en pantalla, ver global.css):
// título del club, título del informe, subtítulo opcional (ej. equipo o
// temporada) y fecha de generación.
export function CabeceraInforme({ titulo, subtitulo }) {
  const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  return (
    <div className="cabecera-informe-impresion">
      <h1>NUBAPP</h1>
      <h2>{titulo}</h2>
      {subtitulo && <p className="subtitulo-informe">{subtitulo}</p>}
      <p className="fecha-informe">Generado el {fecha}</p>
    </div>
  );
}
