import { DotsThree, PlusCircle, Receipt } from '@phosphor-icons/react';
import { plata } from '../../lib/formato.js';

function EstadoItem({ item }) {
  if (item.estado !== 'activo') return <span className="eti eti-roja">{item.estado}</span>;
  // Lo de barra no pasa por cocina: el mozo lo alcanza y ya está entregado.
  if (item.de_barra) return <span className="eti eti-azul">de barra</span>;
  if (!item.comanda_id) return <span className="eti eti-amarilla">sin mandar</span>;
  if (item.comanda_estado === 'terminada') return <span className="eti eti-verde">listo</span>;
  return <span className="eti eti-naranja">en cocina</span>;
}

/** El ticket: lo que el cliente va a pagar, con el detalle de lo que pasó. */
export default function TicketCuenta({ cuenta, editable, onAccionItem }) {
  return (
    <>
      {cuenta.items.length ? (
        <div className="items">
          {cuenta.items.map((i) => (
            <div className={`item ${i.estado}`} key={i.id}>
              <span className="cant">{i.cantidad}×</span>

              <span className="detalle">
                <span>{i.nombre_snapshot}</span>
                {i.mods.length ? (
                  <span className="mods">
                    {i.mods
                      .map((m) => (m.cantidad > 1 ? `${m.cantidad} ${m.nombre_snapshot}` : m.nombre_snapshot))
                      .join(' · ')}
                  </span>
                ) : null}
                {i.nota ? <span className="nota">{i.nota}</span> : null}
                {i.motivo ? <span className="t12 tenue-3">{i.motivo}</span> : null}
                <span className="fila" style={{ gap: 6 }}>
                  <EstadoItem item={i} />
                  {i.es_reposicion ? <span className="eti eti-neutra">reposición</span> : null}
                </span>
              </span>

              <span className="importe">{plata(i.total_linea)}</span>

              {editable && i.estado === 'activo' ? (
                <button
                  className="btn btn-plano btn-chico btn-icono"
                  onClick={() => onAccionItem(i)}
                  aria-label={`Acciones de ${i.nombre_snapshot}`}
                >
                  <DotsThree size={20} weight="bold" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="vacio">
          <PlusCircle size={32} weight="light" />
          <strong>Cuenta vacía</strong>
          <p className="t13">Cargá los platos desde la carta.</p>
        </div>
      )}

      <div className="totales">
        <div className="t13"><span className="tenue">Subtotal</span><span className="mono">{plata(cuenta.subtotal)}</span></div>

        {Number(cuenta.cubierto_total) > 0 ? (
          <div className="t13"><span className="tenue">Cubierto</span><span className="mono">{plata(cuenta.cubierto_total)}</span></div>
        ) : null}

        {Number(cuenta.descuento) > 0 ? (
          <div className="t13">
            <span className="tenue">
              Descuento{cuenta.descuento_motivo ? ` · ${cuenta.descuento_motivo}` : ''}
            </span>
            <span className="mono">−{plata(cuenta.descuento)}</span>
          </div>
        ) : null}

        {Number(cuenta.pagado) > 0 ? (
          <div className="t13"><span className="tenue">Pagado</span><span className="mono">{plata(cuenta.pagado)}</span></div>
        ) : null}

        <div className="total">
          <span>{Number(cuenta.pagado) > 0 ? 'Saldo' : 'Total'}</span>
          <span className="mono">{plata(cuenta.saldo)}</span>
        </div>
      </div>

      {cuenta.comprobantes?.length ? (
        <div className="pila-2 t12 tenue-3">
          {cuenta.comprobantes.map((c) => (
            <span key={c.id} className="fila">
              <Receipt size={14} />
              {c.tipo.replace('_', ' ')} · PV{c.punto_venta} N°{c.numero}
              <span className={`eti ${c.estado === 'emitido' ? 'eti-verde' : 'eti-amarilla'}`}>
                {c.estado}
              </span>
            </span>
          ))}
        </div>
      ) : null}
    </>
  );
}
