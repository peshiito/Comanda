import { useState } from 'react';
import { ShieldCheck } from '@phosphor-icons/react';
import Modal from './Modal.jsx';
import PinPad from './PinPad.jsx';
import { plata } from '../lib/formato.js';

/**
 * Autorización con PIN. La usan anular en cocina, devolver, descontar y marcar
 * una cuenta como no cobrada: todo lo que le duele al dueño queda firmado.
 */
export default function PedirPin({
  titulo,
  detalle,
  alConfirmar,
  alCerrar,
  motivoRequerido = false,
  montoRequerido = false,
  montoMaximo,
}) {
  const [pin, setPin] = useState('');
  const [motivo, setMotivo] = useState('');
  const [monto, setMonto] = useState('');
  const [enviando, setEnviando] = useState(false);

  const montoNum = Number(monto);
  const montoOk =
    !montoRequerido ||
    (Number.isFinite(montoNum) && montoNum > 0 && (!montoMaximo || montoNum <= Number(montoMaximo)));
  const listo = pin.length >= 4 && montoOk && (!motivoRequerido || motivo.trim().length >= 3);

  const confirmar = async () => {
    if (!listo || enviando) return;
    setEnviando(true);
    try {
      await alConfirmar({ pin, motivo: motivo.trim(), monto: montoNum });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      titulo={titulo}
      descripcion={detalle}
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn" onClick={alCerrar} disabled={enviando}>Cancelar</button>
          <button className="btn btn-primario" onClick={confirmar} disabled={!listo || enviando}>
            {enviando ? 'Verificando…' : 'Autorizar'}
          </button>
        </>
      }
    >
      <div className="pila" style={{ gap: 'var(--e5)' }}>
        {montoRequerido ? (
          <label className="campo">
            <span>Monto en pesos</span>
            <input
              className="mono" type="number" min="0" step="100" value={monto}
              onChange={(e) => setMonto(e.target.value)} placeholder="0" autoFocus
            />
            {montoMaximo ? (
              <span className="campo-ayuda">Hasta {plata(montoMaximo)}</span>
            ) : null}
          </label>
        ) : null}

        {motivoRequerido ? (
          <label className="campo">
            <span>Motivo</span>
            <input
              value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por qué se hace" maxLength={200}
            />
            <span className="campo-ayuda">Queda en la auditoría con tu nombre y la hora.</span>
          </label>
        ) : null}

        <div className="pila" style={{ alignItems: 'center', gap: 'var(--e3)' }}>
          <p className="rotulo fila">
            <ShieldCheck size={15} weight="bold" /> PIN del encargado
          </p>
          <PinPad valor={pin} alCambiar={setPin} alConfirmar={confirmar} deshabilitado={enviando} />
        </div>
      </div>
    </Modal>
  );
}
