// Barra visual de progreso de una cuota (pagado vs. pendiente), compartida
// entre la pantalla de Cuotas y la ficha del deportista, para que en
// cualquier sitio donde se vea una cuota se entienda de un vistazo.
function euros(valor) {
  return `${Number(valor || 0).toFixed(2)} €`;
}

function porcentajePagado(pagado, total) {
  const t = Number(total || 0);
  if (t <= 0) return 0;
  return Math.min(100, Math.max(0, (Number(pagado || 0) / t) * 100));
}

// Grande: para la ficha completa de una cuota.
export function BarraCuota({ pagado, total }) {
  const pct = porcentajePagado(pagado, total);
  return (
    <div className="barra-cuota-envoltorio">
      <div className="barra-cuota-etiquetas">
        <span>{pct.toFixed(0)}% pagado</span>
        <span>{euros(Math.max(0, Number(total || 0) - Number(pagado || 0)))} pendiente</span>
      </div>
      <div className="barra-cuota">
        <div className={`barra-cuota-relleno${pct >= 100 ? ' completo' : ''}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Pequeña: para verlo fila a fila en un listado.
export function BarraCuotaMini({ pagado, total }) {
  const pct = porcentajePagado(pagado, total);
  return (
    <div className="barra-mini-envoltorio" title={`${euros(pagado)} de ${euros(total)}`}>
      <div className="barra-mini">
        <div className="barra-mini-relleno" style={{ width: `${pct}%` }} />
      </div>
      <span className="barra-mini-porcentaje">{pct.toFixed(0)}%</span>
    </div>
  );
}
