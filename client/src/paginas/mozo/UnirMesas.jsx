import { useState } from 'react';
import Modal from '../../componentes/Modal.jsx';
import { api } from '../../lib/api.js';
import { useToast } from '../../componentes/Toast.jsx';
import { soloNumero } from '../../lib/formato.js';

/** Unir es del espacio: la mesa principal pasa a contener todas las cuentas del grupo. */
export default function UnirMesas({ mesa, mesas, alCerrar, alUnir }) {
  const toast = useToast();
  const [elegidas, setElegidas] = useState([]);
  const [enviando, setEnviando] = useState(false);

  const candidatas = mesas.filter((m) => m.id !== mesa.id && !m.unida_a && !m.satelites.length);

  const alternar = (id) =>
    setElegidas((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));

  const unir = async () => {
    if (!elegidas.length || enviando) return;
    setEnviando(true);
    try {
      const r = await api.post(`/salon/mesas/${mesa.id}/unir`, { mesa_ids: elegidas });
      r.avisos?.forEach((a) => toast.avisar(a, 'info', 6500));
      toast.ok('Mesas unidas');
      alUnir();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      titulo={`Unir a ${mesa.nombre}`}
      descripcion="Las cuentas abiertas de las mesas que unas pasan a esta. Al cobrar la última, se desunen solas."
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn" onClick={alCerrar}>Cancelar</button>
          <button className="btn btn-primario" onClick={unir} disabled={!elegidas.length || enviando}>
            Unir {elegidas.length ? `(${elegidas.length})` : ''}
          </button>
        </>
      }
    >
      {candidatas.length ? (
        <div className="mesas">
          {candidatas.map((m) => (
            <button
              key={m.id}
              className={`mesa${elegidas.includes(m.id) ? ' mesa-por_cobrar' : ''}`}
              onClick={() => alternar(m.id)}
              aria-pressed={elegidas.includes(m.id)}
            >
              <span className="mesa-numero">{soloNumero(m.nombre)}</span>
              <span className="t12 tenue-3">
                {m.cuentas.length ? `${m.comensales} pers.` : `${m.capacidad} lugares`}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="vacio t13">No hay mesas disponibles para unir.</p>
      )}
    </Modal>
  );
}
