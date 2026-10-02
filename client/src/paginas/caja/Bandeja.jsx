import { NotePencil, Tray, Warning } from '@phosphor-icons/react';
import { Bloque } from '../../componentes/Esqueleto.jsx';
import { duracion } from '../../lib/formato.js';

/**
 * Lo que el salón dejó esperando. Caja revisa el borrador del mozo y recién
 * ahí sale a cocina: el pedido se escribió una sola vez, en la mesa.
 */
export default function Bandeja({ pendientes, cargando, hayTurno, onCargar }) {
  return (
    <section className="panel">
      <header>
        <span className="fila"><Tray size={16} weight="bold" /> Mesas por cargar</span>
        {pendientes?.length ? <span className="eti eti-marca">{pendientes.length}</span> : null}
      </header>

      <div className="cuerpo pila">
        {cargando ? (
          <>
            <div className="tarjeta pila-2"><Bloque ancho="40%" alto={15} /><Bloque ancho="70%" alto={13} /></div>
            <div className="tarjeta pila-2"><Bloque ancho="35%" alto={15} /><Bloque ancho="60%" alto={13} /></div>
          </>
        ) : pendientes?.length ? (
          pendientes.map((b) => (
            <div className="tarjeta pila borrador" key={b.id}>
              <div className="fila-sep">
                <strong className="t16">{b.mesa ?? 'Take away'}</strong>
                <span className="t12 tenue-3">{b.mozo} · hace {duracion(b.minutos)}</span>
              </div>

              {b.pago_previsto || b.nota ? (
                <div className="fila envolver t13">
                  {b.pago_previsto ? <span className="eti eti-azul">paga con {b.pago_previsto}</span> : null}
                  {b.nota ? <span className="tenue">{b.nota}</span> : null}
                </div>
              ) : null}

              <div className="items">
                {b.items.map((i) => (
                  <div className="item" key={i.id}>
                    <span className="cant">{i.cantidad}×</span>
                    <span className="detalle">
                      <span>
                        {i.producto}
                        {i.variante ? ` · ${i.variante}` : ''}
                        {i.agotado ? (
                          <span className="eti eti-roja" style={{ marginLeft: 6 }}>agotado</span>
                        ) : null}
                      </span>
                      {i.nota ? <span className="nota">{i.nota}</span> : null}
                    </span>
                  </div>
                ))}
              </div>

              <div className="fila">
                <button className="btn btn-primario crece" onClick={() => onCargar(b, true)} disabled={!hayTurno}>
                  Revisar y mandar a cocina
                </button>
                <button className="btn" onClick={() => onCargar(b, false)} disabled={!hayTurno}>
                  <NotePencil size={16} /> Solo cargar
                </button>
              </div>

              {!hayTurno ? (
                <p className="t12 fila" style={{ color: 'var(--amarillo)' }}>
                  <Warning size={14} weight="fill" /> Abrí la caja para poder cargarlo
                </p>
              ) : null}
            </div>
          ))
        ) : (
          <div className="vacio">
            <Tray size={34} weight="light" />
            <strong>Nada esperando</strong>
            <p className="t13">Cuando un mozo pase un pedido desde el salón, aparece acá.</p>
          </div>
        )}
      </div>
    </section>
  );
}
