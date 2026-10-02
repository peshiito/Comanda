import { useMemo, useState } from 'react';
import { Plus, Warning } from '@phosphor-icons/react';
import Modal from '../../componentes/Modal.jsx';
import LineaPago from './LineaPago.jsx';
import { api, claveIdempotencia } from '../../lib/api.js';
import { useToast } from '../../componentes/Toast.jsx';
import { plata } from '../../lib/formato.js';

const COMPROBANTES = {
  ticket: 'Ticket',
  factura_b: 'Factura B',
  factura_a: 'Factura A',
  factura_c: 'Factura C',
};

const redondear = (n) => Math.round(n * 100) / 100;

export default function Cobrar({ cuenta, alCerrar, alListo }) {
  const toast = useToast();
  const saldo = Number(cuenta.saldo);
  // La clave se genera una vez al abrir: dos toques no cobran dos veces.
  const clave = useMemo(() => claveIdempotencia(`cuenta${cuenta.id}`), [cuenta.id]);

  const [lineas, setLineas] = useState([{ medio: 'efectivo', monto: saldo.toFixed(2), recibido: '' }]);
  const [propina, setPropina] = useState('0');
  const [tipoComprobante, setTipoComprobante] = useState('ticket');
  const [docNro, setDocNro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const total = redondear(lineas.reduce((a, l) => a + (Number(l.monto) || 0), 0));
  const faltante = redondear(saldo - total);
  const propinaNum = Number(propina) || 0;
  const efectivo = lineas.find((l) => l.medio === 'efectivo' && Number(l.recibido) > 0);
  const vuelto = efectivo
    ? Math.max(0, redondear(Number(efectivo.recibido) - Number(efectivo.monto || 0) - propinaNum))
    : 0;

  const cambiar = (i, campo, valor) =>
    setLineas((ls) => ls.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));

  const dividir = (partes) => {
    const base = Math.floor((saldo * 100) / partes) / 100;
    const resto = redondear(saldo - base * partes);
    setLineas(
      Array.from({ length: partes }, (_, i) => ({
        medio: 'efectivo',
        monto: (i === 0 ? redondear(base + resto) : base).toFixed(2),
        recibido: '',
      }))
    );
  };

  const cobrar = async () => {
    if (enviando || total <= 0 || faltante < 0) return;
    setEnviando(true);
    try {
      const r = await api.post(`/caja/cuentas/${cuenta.id}/cobrar`, {
        pagos: lineas
          .filter((l) => Number(l.monto) > 0)
          .map((l) => ({
            medio: l.medio,
            monto: Number(l.monto),
            recibido: l.medio === 'efectivo' && l.recibido ? Number(l.recibido) : null,
            referencia: l.referencia || null,
          })),
        propina: propinaNum,
        idempotency_key: clave,
        comprobante:
          faltante > 0
            ? null
            : {
                tipo: tipoComprobante,
                doc_tipo: tipoComprobante === 'ticket' ? null : docNro ? 'CUIT' : 'CF',
                doc_nro: docNro || null,
              },
      });
      toast.ok(
        r.cerrada
          ? vuelto > 0 ? `Cobrado. Vuelto ${plata(vuelto)}` : 'Cobrado'
          : `Pago parcial. Queda ${plata(r.saldo)}`
      );
      alListo();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      titulo={`Cobrar ${plata(saldo)}`}
      descripcion={cuenta.mesa ?? cuenta.referencia ?? 'Take away'}
      ancho
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn" onClick={alCerrar} disabled={enviando}>Cancelar</button>
          <button className="btn btn-ok" onClick={cobrar} disabled={enviando || total <= 0 || faltante < 0}>
            {enviando
              ? 'Cobrando…'
              : faltante > 0 ? `Cobrar parcial ${plata(total)}` : `Cobrar ${plata(total)}`}
          </button>
        </>
      }
    >
      <div className="pila" style={{ gap: 'var(--e5)' }}>
        <div className="campo">
          <span className="rotulo">Dividir en partes iguales</span>
          <div className="division">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button key={n} className="pildora" onClick={() => dividir(n)}>
                {n === 1 ? 'Sin dividir' : `${n} partes`}
              </button>
            ))}
          </div>
        </div>

        <div className="pila-2">
          {lineas.map((l, i) => (
            <LineaPago
              key={i}
              linea={l}
              indice={i}
              unica={lineas.length === 1}
              onCambiar={(campo, valor) => cambiar(i, campo, valor)}
              onQuitar={() => setLineas((ls) => ls.filter((_, x) => x !== i))}
            />
          ))}

          <button
            className="btn btn-chico"
            onClick={() =>
              setLineas((ls) => [
                ...ls,
                { medio: 'credito', monto: Math.max(0, faltante).toFixed(2), recibido: '' },
              ])
            }
          >
            <Plus size={14} weight="bold" /> Otro medio de pago
          </button>
        </div>

        <div className="fila" style={{ alignItems: 'flex-end' }}>
          <label className="campo crece">
            <span>Propina</span>
            <input
              className="mono" type="number" step="100" value={propina}
              onChange={(e) => setPropina(e.target.value)}
            />
          </label>
          <button className="btn" onClick={() => setPropina(String(Math.round(saldo * 0.1)))}>10%</button>
          <button className="btn" onClick={() => setPropina('0')}>Sin propina</button>
        </div>

        <div className="campo">
          <span className="rotulo">Comprobante</span>
          <div className="opciones">
            {Object.entries(COMPROBANTES).map(([clave2, texto]) => (
              <button
                key={clave2} className="pildora" aria-pressed={tipoComprobante === clave2}
                onClick={() => setTipoComprobante(clave2)}
              >
                {texto}
              </button>
            ))}
          </div>
          {tipoComprobante !== 'ticket' ? (
            <input
              className="mono" value={docNro} onChange={(e) => setDocNro(e.target.value)}
              placeholder="CUIT o DNI del cliente (opcional)" maxLength={20}
              style={{ marginTop: 'var(--e2)' }}
            />
          ) : null}
        </div>

        <div className="totales">
          <div className="t13"><span className="tenue">A cobrar ahora</span><span className="mono">{plata(total)}</span></div>
          {propinaNum > 0 ? (
            <div className="t13"><span className="tenue">Propina</span><span className="mono">{plata(propinaNum)}</span></div>
          ) : null}
          {faltante > 0 ? (
            <div className="t13"><span className="tenue">Queda pendiente</span><span className="mono">{plata(faltante)}</span></div>
          ) : null}
        </div>

        {faltante < 0 ? (
          <p className="alerta-monto">
            <Warning size={16} weight="fill" /> Te pasaste por {plata(-faltante)}
          </p>
        ) : null}

        {vuelto > 0 ? (
          <p className="vuelto">
            <span className="rotulo" style={{ color: 'inherit' }}>Vuelto</span>
            <strong>{plata(vuelto)}</strong>
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
