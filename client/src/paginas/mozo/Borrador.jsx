import { useEffect, useState } from 'react';
import { NotePencil, PaperPlaneTilt, X } from '@phosphor-icons/react';
import SelectorProductos from '../../componentes/SelectorProductos.jsx';
import { Bloque } from '../../componentes/Esqueleto.jsx';
import { api } from '../../lib/api.js';
import { useToast } from '../../componentes/Toast.jsx';

const PAGOS = ['efectivo', 'tarjeta', 'transferencia', 'qr', 'mixto'];

/**
 * La libreta del mozo. Vive en el servidor: si se queda sin batería agarra otro
 * celular, entra con su PIN y está todo. No muestra precios y no puede mandar
 * nada a la cocina — eso lo decide caja.
 */
export default function Borrador({ mesaId, cuentaId }) {
  const toast = useToast();
  const [borrador, setBorrador] = useState(null);
  const [nota, setNota] = useState('');
  const [pago, setPago] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargar = async () => {
    try {
      const b = await api.post('/borradores/mio', { mesa_id: mesaId, cuenta_id: cuentaId });
      setBorrador(b);
      setNota(b.nota ?? '');
      setPago(b.pago_previsto ?? '');
    } catch (e) {
      toast.error(e.message);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesaId, cuentaId]);

  if (!borrador) {
    return (
      <section className="panel">
        <header><Bloque ancho="90px" alto={12} /></header>
        <div className="cuerpo pila">
          <Bloque alto={44} radio="var(--r2)" />
          <div className="grilla-productos">
            {Array.from({ length: 6 }, (_, i) => <Bloque key={i} alto={76} radio="var(--r2)" />)}
          </div>
        </div>
      </section>
    );
  }

  const agregar = async (item) => {
    try {
      const r = await api.post(`/borradores/${borrador.id}/items`, item);
      setBorrador((b) => ({ ...b, items: r.items }));
    } catch (e) {
      toast.error(e.message);
    }
  };

  const quitar = async (itemId) => {
    try {
      const r = await api.del(`/borradores/${borrador.id}/items/${itemId}`);
      setBorrador((b) => ({ ...b, items: r.items }));
    } catch (e) {
      toast.error(e.message);
    }
  };

  const guardarNota = async () => {
    try {
      await api.patch(`/borradores/${borrador.id}`, {
        nota: nota || null,
        pago_previsto: pago || null,
      });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const pasar = async () => {
    if (enviando) return;
    setEnviando(true);
    try {
      await guardarNota();
      await api.post(`/borradores/${borrador.id}/pasar`);
      toast.ok('Pasado a caja');
      await cargar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="panel">
      <header>
        <span className="fila"><NotePencil size={16} weight="bold" /> Mi libreta</span>
        {borrador.items.length ? <span className="eti eti-neutra">{borrador.items.length}</span> : null}
      </header>

      <div className="cuerpo pila">
        {borrador.items.length ? (
          <div className="items">
            {borrador.items.map((i) => (
              <div className="item" key={i.id}>
                <span className="cant">{i.cantidad}×</span>
                <span className="detalle">
                  <span>
                    {i.producto}
                    {i.variante ? ` · ${i.variante}` : ''}
                    {i.agotado ? <span className="eti eti-roja" style={{ marginLeft: 6 }}>agotado</span> : null}
                  </span>
                  {i.nota ? <span className="nota">{i.nota}</span> : null}
                </span>
                <button
                  className="btn btn-plano btn-chico btn-icono"
                  onClick={() => quitar(i.id)}
                  aria-label={`Quitar ${i.producto}`}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="t13 tenue-3">
            Tocá los platos para anotarlos. Acá no se ven precios: la cuenta la arma caja.
          </p>
        )}

        <label className="campo">
          <span>Nota para caja</span>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onBlur={guardarNota}
            placeholder="pagan con tarjeta, uno sin sal…"
            maxLength={200}
          />
        </label>

        <div className="campo">
          <span className="rotulo">Forma de pago prevista</span>
          <div className="opciones">
            {PAGOS.map((p) => (
              <button
                key={p} className="pildora" aria-pressed={pago === p}
                onClick={() => setPago(pago === p ? '' : p)}
              >
                {p}
              </button>
            ))}
          </div>
          <span className="campo-ayuda">Caja prepara el posnet o el cambio antes de que lleguen.</span>
        </div>

        <button
          className="btn btn-primario btn-grande btn-ancho"
          onClick={pasar}
          disabled={!borrador.items.length || enviando}
        >
          <PaperPlaneTilt size={18} weight="bold" />
          {enviando ? 'Pasando…' : 'Pasar a caja'}
        </button>

        <SelectorProductos alElegir={agregar} mostrarPrecios={false} />
      </div>
    </section>
  );
}
