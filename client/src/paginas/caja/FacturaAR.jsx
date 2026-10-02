import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { montoPlano } from '../../lib/formato.js';

/** Código de comprobante de ARCA según el tipo. Van impresos en la factura. */
const LETRA = {
  factura_a: { letra: 'A', codigo: '01', titulo: 'FACTURA' },
  factura_b: { letra: 'B', codigo: '06', titulo: 'FACTURA' },
  factura_c: { letra: 'C', codigo: '11', titulo: 'FACTURA' },
  nota_credito: { letra: 'B', codigo: '08', titulo: 'NOTA DE CRÉDITO' },
};

const MEDIO = {
  efectivo: 'Efectivo',
  debito: 'Tarjeta de débito',
  credito: 'Tarjeta de crédito',
  transferencia: 'Transferencia bancaria',
  qr: 'Pago con QR',
};

const soloFecha = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const numeroComp = (c) =>
  `${String(c.punto_venta).padStart(5, '0')}-${String(c.numero).padStart(8, '0')}`;

/**
 * Factura con la disposición que usa ARCA: los datos del emisor a la
 * izquierda, la letra en un recuadro al medio y la numeración a la derecha.
 *
 * La diferencia entre A y B no es estética: en la A el IVA se discrimina
 * línea por línea porque el receptor lo computa como crédito fiscal, y en la
 * B va contenido en el precio. Por eso el detalle cambia de columnas.
 */
export default function FacturaAR({ doc }) {
  const { local, cuenta, pagos, comprobantes, impuestos } = doc;
  const comp =
    comprobantes.find((c) => c.tipo.startsWith('factura')) ??
    comprobantes.find((c) => c.tipo === 'nota_credito') ??
    null;
  const meta = LETRA[comp?.tipo] ?? LETRA.factura_b;
  const discrimina = comp?.tipo === 'factura_a';
  const [qr, setQr] = useState(null);

  useEffect(() => {
    // El QR de ARCA sale del payload que devuelve el organismo al autorizar.
    // Sin CAE no hay payload y no se dibuja nada: un QR inventado apuntaría a
    // un comprobante que no existe.
    if (!comp?.qr_payload) {
      setQr(null);
      return;
    }
    QRCode.toDataURL(comp.qr_payload, { margin: 0, width: 220, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setQr(null));
  }, [comp?.qr_payload]);

  const netoGravado = Number(impuestos.neto);
  const ivaTotal = Number(impuestos.iva);

  return (
    <div className="fa">
      <header className="fa-cabeza">
        <div className="fa-emisor">
          <div className="fa-razon">{local.nombre}</div>
          <dl>
            <div><dt>Razón Social:</dt><dd>{local.nombre}</dd></div>
            {local.direccion ? (
              <div>
                <dt>Domicilio Comercial:</dt>
                <dd>{local.direccion}{local.localidad ? ` — ${local.localidad}` : ''}</dd>
              </div>
            ) : null}
            <div><dt>Condición frente al IVA:</dt><dd>{local.condicion_iva || '—'}</dd></div>
          </dl>
        </div>

        <div className="fa-letra">
          <span className="fa-letra-grande">{meta.letra}</span>
          <span className="fa-codigo">COD. {meta.codigo}</span>
        </div>

        <div className="fa-numeracion">
          <div className="fa-titulo">{meta.titulo}</div>
          <dl>
            <div>
              <dt>Punto de Venta:</dt>
              <dd>{String(comp?.punto_venta ?? 1).padStart(5, '0')}</dd>
              <dt>Comp. Nro:</dt>
              <dd>{String(comp?.numero ?? 0).padStart(8, '0')}</dd>
            </div>
            <div><dt>Fecha de Emisión:</dt><dd>{soloFecha(comp?.creado_at ?? cuenta.cerrada_at)}</dd></div>
            <div><dt>CUIT:</dt><dd>{local.cuit || '—'}</dd></div>
            <div><dt>Ingresos Brutos:</dt><dd>{local.ingresos_brutos || '—'}</dd></div>
            <div><dt>Inicio de Actividades:</dt><dd>{local.inicio_actividades || '—'}</dd></div>
          </dl>
        </div>
      </header>

      <section className="fa-periodo">
        <span>Período Facturado Desde: <strong>{soloFecha(cuenta.abierta_at)}</strong></span>
        <span>Hasta: <strong>{soloFecha(cuenta.cerrada_at ?? cuenta.abierta_at)}</strong></span>
        <span>Fecha de Vto. para el pago: <strong>{soloFecha(cuenta.cerrada_at ?? cuenta.abierta_at)}</strong></span>
      </section>

      <section className="fa-receptor">
        <dl>
          <div>
            <dt>{comp?.doc_tipo === 'CUIT' ? 'CUIT:' : 'DNI:'}</dt>
            <dd>{comp?.doc_nro || '—'}</dd>
            <dt>Apellido y Nombre / Razón Social:</dt>
            <dd>{comp?.receptor || 'Consumidor Final'}</dd>
          </div>
          <div>
            <dt>Condición frente al IVA:</dt>
            <dd>{comp?.doc_tipo === 'CUIT' ? 'Responsable Inscripto' : 'Consumidor Final'}</dd>
            <dt>Domicilio:</dt>
            <dd>—</dd>
          </div>
          <div>
            <dt>Condición de venta:</dt>
            <dd>{pagos.map((p) => MEDIO[p.medio] ?? p.medio).join(' · ') || 'Contado'}</dd>
          </div>
        </dl>
      </section>

      <table className="fa-detalle">
        <thead>
          <tr>
            <th className="fa-cod">Código</th>
            <th>Producto / Servicio</th>
            <th className="fa-num">Cantidad</th>
            <th className="fa-um">U. medida</th>
            <th className="fa-num">Precio Unit.</th>
            <th className="fa-num">% Bonif.</th>
            {discrimina ? <th className="fa-num">Subtotal</th> : null}
            {discrimina ? <th className="fa-num">Alícuota IVA</th> : null}
            <th className="fa-num">Subtotal c/IVA</th>
          </tr>
        </thead>
        <tbody>
          {cuenta.items.map((i) => {
            const total = Number(i.total_linea);
            const alic = Number(i.iva_snapshot);
            const neto = total / (1 + alic / 100);
            const unit = discrimina ? neto / i.cantidad : total / i.cantidad;
            return (
              <tr key={i.id}>
                <td className="fa-cod">{i.producto_id ?? '—'}</td>
                <td>
                  {i.nombre_snapshot}
                  {i.mods.length ? (
                    <div className="fa-mods">
                      {i.mods
                        .map((m) => (m.cantidad > 1 ? `${m.cantidad} ${m.nombre_snapshot}` : m.nombre_snapshot))
                        .join(' · ')}
                    </div>
                  ) : null}
                </td>
                <td className="fa-num">{i.cantidad},00</td>
                <td className="fa-um">unidad</td>
                <td className="fa-num">{montoPlano(unit)}</td>
                <td className="fa-num">0,00</td>
                {discrimina ? <td className="fa-num">{montoPlano(neto)}</td> : null}
                {discrimina ? <td className="fa-num">{alic.toFixed(2)}%</td> : null}
                <td className="fa-num">{montoPlano(total)}</td>
              </tr>
            );
          })}
          {Number(cuenta.cubierto_total) > 0 ? (
            <tr>
              <td className="fa-cod">—</td>
              <td>Servicio de mesa ({cuenta.comensales} cubiertos)</td>
              <td className="fa-num">{cuenta.comensales},00</td>
              <td className="fa-um">unidad</td>
              <td className="fa-num">
                {montoPlano(Number(cuenta.cubierto_total) / Math.max(1, cuenta.comensales))}
              </td>
              <td className="fa-num">0,00</td>
              {discrimina ? <td className="fa-num">{montoPlano(Number(cuenta.cubierto_total) / 1.21)}</td> : null}
              {discrimina ? <td className="fa-num">21,00%</td> : null}
              <td className="fa-num">{montoPlano(cuenta.cubierto_total)}</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <section className="fa-totales">
        {discrimina ? (
          <>
            <div><span>Importe Neto Gravado: $</span><strong>{montoPlano(netoGravado)}</strong></div>
            {impuestos.por_alicuota.map((a) => (
              <div key={a.alicuota}>
                <span>IVA {Number(a.alicuota).toFixed(2)}%: $</span>
                <strong>{montoPlano(a.iva)}</strong>
              </div>
            ))}
          </>
        ) : (
          <div><span>Subtotal: $</span><strong>{montoPlano(Number(cuenta.total) + Number(cuenta.descuento))}</strong></div>
        )}
        {Number(cuenta.descuento) > 0 ? (
          <div><span>Descuento: $</span><strong>−{montoPlano(cuenta.descuento)}</strong></div>
        ) : null}
        <div><span>Importe Otros Tributos: $</span><strong>0,00</strong></div>
        <div className="fa-gran-total">
          <span>Importe Total: $</span>
          <strong>{montoPlano(cuenta.total)}</strong>
        </div>
      </section>

      <footer className="fa-pie">
        <div className="fa-qr">
          {qr ? (
            <img src={qr} alt="Código QR del comprobante" width="110" height="110" />
          ) : (
            <div className="fa-qr-vacio">
              QR de ARCA
              <span>se genera al autorizar</span>
            </div>
          )}
        </div>
        <div className="fa-cae">
          {comp?.cae ? (
            <>
              <div className="fa-autorizado">Comprobante Autorizado</div>
              <div><span>CAE Nº:</span> <strong>{comp.cae}</strong></div>
              <div><span>Fecha de Vto. de CAE:</span> <strong>{soloFecha(comp.cae_vto)}</strong></div>
            </>
          ) : (
            <>
              <div className="fa-sin-cae">Comprobante sin autorizar</div>
              <p>
                Falta conectar ARCA (certificado y punto de venta del local). Hasta
                entonces este documento tiene el formato legal pero no tiene CAE, así
                que no reemplaza a una factura.
              </p>
            </>
          )}
          <div className="fa-marca">Comanda · gestión gastronómica</div>
        </div>
      </footer>
    </div>
  );
}
