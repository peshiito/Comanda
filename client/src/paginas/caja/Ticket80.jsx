import { montoPlano } from '../../lib/formato.js';

const MEDIO = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  credito: 'Crédito',
  transferencia: 'Transferencia',
  qr: 'QR',
};

const fecha = (iso) =>
  new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

const numero = (c) =>
  `${String(c.punto_venta).padStart(4, '0')}-${String(c.numero).padStart(8, '0')}`;

/**
 * Ticket de consumo en 80 mm, el ancho de las térmicas que usa un bodegón.
 *
 * No es un comprobante fiscal y lo dice: en Argentina un ticket sin CAE no
 * reemplaza la factura, y omitir esa leyenda sería dejarle un problema al
 * local. Sirve para que el cliente vea el detalle y para el control interno.
 */
export default function Ticket80({ doc }) {
  const { local, cuenta, pagos, comprobantes, impuestos } = doc;
  const comp = comprobantes.find((c) => c.tipo === 'ticket') ?? comprobantes[0] ?? null;
  const cajero = pagos.find((p) => p.cajero)?.cajero ?? null;
  const propina = Number(cuenta.propina ?? 0);
  const vuelto = pagos.reduce((a, p) => a + Number(p.vuelto ?? 0), 0);

  return (
    <div className="tk">
      <div className="tk-centro">
        <div className="tk-nombre">{local.nombre}</div>
        {local.direccion ? <div>{local.direccion}</div> : null}
        {local.localidad ? <div>{local.localidad}</div> : null}
        {local.cuit ? <div>CUIT {local.cuit}</div> : null}
        {local.condicion_iva ? <div>{local.condicion_iva}</div> : null}
      </div>

      <div className="tk-sep" />

      <div className="tk-centro tk-fuerte">
        TICKET DE CONSUMO
        {comp ? <div>Nº {numero(comp)}</div> : null}
      </div>

      <div className="tk-sep" />

      <div className="tk-fila"><span>Fecha</span><span>{fecha(cuenta.cerrada_at ?? cuenta.abierta_at)}</span></div>
      <div className="tk-fila">
        <span>{cuenta.tipo === 'take_away' ? 'Take away' : 'Mesa'}</span>
        <span>{cuenta.tipo === 'take_away' ? (cuenta.referencia ?? `#${cuenta.id}`) : cuenta.mesa}</span>
      </div>
      {cuenta.comensales > 0 ? (
        <div className="tk-fila"><span>Comensales</span><span>{cuenta.comensales}</span></div>
      ) : null}
      {cuenta.mozo ? <div className="tk-fila"><span>Atendió</span><span>{cuenta.mozo}</span></div> : null}
      {cajero ? <div className="tk-fila"><span>Cobró</span><span>{cajero}</span></div> : null}

      <div className="tk-sep" />

      {cuenta.items.map((i) => (
        <div className="tk-item" key={i.id}>
          <div className="tk-fila">
            <span>{i.cantidad} {i.nombre_snapshot}</span>
            <span className="tk-monto">{montoPlano(i.total_linea)}</span>
          </div>
          {i.mods.map((m, n) => (
            <div className="tk-mod" key={n}>
              {m.cantidad > 1 ? `${m.cantidad} ` : ''}{m.nombre_snapshot}
            </div>
          ))}
          {i.nota ? <div className="tk-mod">{i.nota}</div> : null}
        </div>
      ))}

      <div className="tk-sep" />

      <div className="tk-fila"><span>Subtotal</span><span className="tk-monto">{montoPlano(cuenta.subtotal)}</span></div>
      {Number(cuenta.cubierto_total) > 0 ? (
        <div className="tk-fila">
          <span>Cubierto ({cuenta.comensales})</span>
          <span className="tk-monto">{montoPlano(cuenta.cubierto_total)}</span>
        </div>
      ) : null}
      {Number(cuenta.descuento) > 0 ? (
        <div className="tk-fila">
          <span>Descuento</span>
          <span className="tk-monto">−{montoPlano(cuenta.descuento)}</span>
        </div>
      ) : null}

      <div className="tk-sep" />
      <div className="tk-fila tk-total">
        <span>TOTAL</span>
        <span className="tk-monto">{montoPlano(cuenta.total)}</span>
      </div>
      <div className="tk-sep" />

      {pagos.map((p, n) => (
        <div className="tk-fila" key={n}>
          <span>{MEDIO[p.medio] ?? p.medio}</span>
          <span className="tk-monto">{montoPlano(p.monto)}</span>
        </div>
      ))}
      {propina > 0 ? (
        <div className="tk-fila"><span>Propina</span><span className="tk-monto">{montoPlano(propina)}</span></div>
      ) : null}
      {vuelto > 0 ? (
        <div className="tk-fila"><span>Vuelto</span><span className="tk-monto">{montoPlano(vuelto)}</span></div>
      ) : null}

      <div className="tk-sep" />

      {/* Discriminar el IVA es propio de la factura A. En un ticket el IVA va
          contenido en el precio y sólo se informa cuánto es. */}
      {impuestos.por_alicuota.map((a) => (
        <div className="tk-fila tk-chico" key={a.alicuota}>
          <span>IVA {Number(a.alicuota).toFixed(0)}% contenido</span>
          <span className="tk-monto">{montoPlano(a.iva)}</span>
        </div>
      ))}

      <div className="tk-sep" />

      <div className="tk-centro tk-aviso">
        DOCUMENTO NO VÁLIDO COMO FACTURA
        <div className="tk-chico">Si necesita factura, pídala en caja antes de retirarse.</div>
      </div>

      {local.pie ? <div className="tk-centro tk-pie">{local.pie}</div> : null}
      <div className="tk-centro tk-chico">Comanda · gestión gastronómica</div>
    </div>
  );
}
