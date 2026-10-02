import { useState } from 'react';
import { ArrowCounterClockwise, Trash } from '@phosphor-icons/react';
import Modal from '../../componentes/Modal.jsx';
import PedirPin from '../../componentes/PedirPin.jsx';
import { api } from '../../lib/api.js';
import { useToast } from '../../componentes/Toast.jsx';
import { MOTIVOS_DEVOLUCION, plata } from '../../lib/formato.js';

/**
 * Anular y devolver son dos operaciones distintas a propósito:
 *  - anular   → el ítem no tendría que estar (no se perdió comida)
 *  - devolver → se cocinó y se perdió (va al reporte de comida tirada)
 * Las dos sacan plata de la cuenta, pero sólo una destruye mercadería.
 */
export default function AccionesItem({ cuentaId, item, alCerrar, alListo }) {
  const toast = useToast();
  const [vista, setVista] = useState('menu');
  const [motivoDev, setMotivoDev] = useState('error_cocina');
  const [detalle, setDetalle] = useState('');
  const [reponer, setReponer] = useState(true);
  const enCocina = Boolean(item.comanda_id);

  const llamar = async (fn, exito) => {
    try {
      await fn();
      toast.ok(exito);
      alListo();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const anularSinPin = (motivo) =>
    llamar(() => api.post(`/cuentas/${cuentaId}/items/${item.id}/anular`, { motivo }), 'Ítem anulado');

  if (vista === 'anular-pin') {
    return (
      <PedirPin
        titulo="Anular un plato que ya está en cocina"
        detalle={`${item.cantidad}× ${item.nombre_snapshot} · ${plata(item.total_linea)}`}
        motivoRequerido
        alCerrar={alCerrar}
        alConfirmar={({ pin, motivo }) =>
          llamar(
            () => api.post(`/cuentas/${cuentaId}/items/${item.id}/anular`, { motivo, pin }),
            'Ítem anulado'
          )
        }
      />
    );
  }

  if (vista === 'devolver-pin') {
    return (
      <PedirPin
        titulo="Confirmar devolución"
        detalle={`${MOTIVOS_DEVOLUCION[motivoDev]}${detalle ? `: ${detalle}` : ''}${reponer ? ' · se repone sin cargo' : ''}`}
        alCerrar={alCerrar}
        alConfirmar={({ pin }) =>
          llamar(
            () =>
              api.post(`/cuentas/${cuentaId}/items/${item.id}/devolver`, {
                motivo: motivoDev,
                detalle: detalle || null,
                reponer,
                pin,
              }),
            reponer ? 'Devuelto y repuesto sin cargo' : 'Devuelto'
          )
        }
      />
    );
  }

  if (vista === 'devolver') {
    return (
      <Modal
        titulo="Devolver el plato"
        descripcion="Esto se cocinó y se perdió. Va al reporte de comida tirada, aparte de las anulaciones."
        alCerrar={alCerrar}
        pie={
          <>
            <button className="btn" onClick={() => setVista('menu')}>Atrás</button>
            <button className="btn btn-peligro" onClick={() => setVista('devolver-pin')}>Continuar</button>
          </>
        }
      >
        <div className="pila" style={{ gap: 'var(--e5)' }}>
          <div className="campo">
            <span className="rotulo">Motivo</span>
            <div className="opciones">
              {Object.entries(MOTIVOS_DEVOLUCION).map(([clave, texto]) => (
                <button
                  key={clave} className="pildora" aria-pressed={motivoDev === clave}
                  onClick={() => setMotivoDev(clave)}
                >
                  {texto}
                </button>
              ))}
            </div>
          </div>

          <label className="campo">
            <span>Detalle (opcional)</span>
            <input value={detalle} onChange={(e) => setDetalle(e.target.value)} maxLength={200} placeholder="salió crudo" />
          </label>

          <label className="casilla">
            <input type="checkbox" checked={reponer} onChange={(e) => setReponer(e.target.checked)} />
            <span className="marca">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6.2 5 8.6l4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="crece">
              Reponer el plato
              <span className="campo-ayuda">Vuelve a cocina como urgente y no se cobra de nuevo.</span>
            </span>
          </label>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      titulo={`${item.cantidad}× ${item.nombre_snapshot}`}
      descripcion={`${plata(item.total_linea)} · ${enCocina ? 'ya salió a cocina' : 'todavía no salió a cocina'}`}
      alCerrar={alCerrar}
    >
      <div className="pila-2">
        {enCocina ? (
          <>
            <button className="btn btn-ancho" onClick={() => setVista('anular-pin')}>
              <Trash size={16} /> Anular — se cargó mal (pide PIN)
            </button>
            <button className="btn btn-peligro btn-ancho" onClick={() => setVista('devolver')}>
              <ArrowCounterClockwise size={16} /> Devolver — se cocinó y se perdió
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-ancho" onClick={() => anularSinPin('Cargado por error')}>
              Anular: cargado por error
            </button>
            <button className="btn btn-ancho" onClick={() => anularSinPin('El cliente cambió de idea')}>
              Anular: el cliente cambió de idea
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
