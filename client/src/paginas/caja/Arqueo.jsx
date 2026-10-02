import { ArrowDown, ArrowUp, HandCoins, Warning } from '@phosphor-icons/react';
import { MEDIOS, plata } from '../../lib/formato.js';

export const TIPOS_MOVIMIENTO = {
  ingreso: { texto: 'Ingreso', Icono: ArrowDown },
  egreso: { texto: 'Egreso', Icono: ArrowUp },
  retiro: { texto: 'Retiro', Icono: HandCoins },
};

/**
 * Arqueo en vivo. El "efectivo esperado" es lo único que el cajero tiene que
 * mirar al cerrar: fondo + efectivo cobrado + propinas + ingresos − egresos − retiros.
 */
export default function Arqueo({ arqueo, turno, driver, onMovimiento, onCerrar }) {
  const abiertas = arqueo?.cuentas_abiertas ?? [];

  return (
    <section className="panel">
      <header>
        <span className="rotulo">Arqueo en vivo</span>
        <span className="t12 tenue-3">turno #{turno.id} · facturación: {driver}</span>
      </header>

      <div className="cuerpo pila">
        <div className="totales">
          <div className="t13"><span className="tenue">Fondo inicial</span><span className="mono">{plata(arqueo?.fondo_inicial)}</span></div>

          {arqueo?.por_medio?.map((p) => (
            <div className="t13" key={p.medio}>
              <span className="tenue">{MEDIOS[p.medio] ?? p.medio} · {p.operaciones} op.</span>
              <span className="mono">{plata(p.monto)}</span>
            </div>
          ))}

          {Number(arqueo?.ingresos) > 0 ? (
            <div className="t13"><span className="tenue">Ingresos</span><span className="mono">{plata(arqueo.ingresos)}</span></div>
          ) : null}
          {Number(arqueo?.egresos) > 0 ? (
            <div className="t13"><span className="tenue">Egresos</span><span className="mono">−{plata(arqueo.egresos)}</span></div>
          ) : null}
          {Number(arqueo?.retiros) > 0 ? (
            <div className="t13"><span className="tenue">Retiros</span><span className="mono">−{plata(arqueo.retiros)}</span></div>
          ) : null}

          <div className="t13"><span className="tenue">Propinas</span><span className="mono">{plata(arqueo?.propinas_totales)}</span></div>
          <div className="total">
            <span>Efectivo que tiene que haber en caja</span>
            <span className="mono">{plata(arqueo?.efectivo_esperado)}</span>
          </div>
        </div>

        <div className="fila">
          {Object.entries(TIPOS_MOVIMIENTO).map(([tipo, { texto, Icono }]) => (
            <button key={tipo} className="btn btn-chico crece" onClick={() => onMovimiento(tipo)}>
              <Icono size={15} weight="bold" /> {texto}
            </button>
          ))}
        </div>

        {abiertas.length ? (
          <div
            className="tarjeta pila-2"
            style={{ borderColor: 'var(--amarillo-linea)', background: 'var(--amarillo-tenue)' }}
          >
            <strong className="fila" style={{ color: 'var(--amarillo)' }}>
              <Warning size={16} weight="fill" /> Todavía no se puede cerrar
            </strong>
            <p className="t13 tenue">
              Quedan {abiertas.length} cuenta(s) sin cobrar. Cobralas o marcalas como no cobradas:
              si no, el arqueo nunca cuadra.
            </p>
            <div className="pila-2">
              {abiertas.map((c) => (
                <div className="fila-sep t13" key={c.id}>
                  <span>{c.mesa ?? 'Take away'} · #{c.id}</span>
                  <span className="mono">{plata(c.total)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <button className="btn btn-primario btn-grande btn-ancho" onClick={onCerrar}>
            Cerrar turno
          </button>
        )}
      </div>
    </section>
  );
}
