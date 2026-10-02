import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useDatos } from '../../lib/useDatos.js';
import { useToast } from '../../componentes/Toast.jsx';

const ETIQUETAS = {
  nombre_local: ['Nombre del local', 'texto'],
  cubierto_activo: ['Cobrar cubierto', 'bool'],
  cubierto_monto: ['Monto del cubierto por persona', 'plata'],
  descuento_tope_sin_pin: ['Descuento que caja puede hacer sin PIN', 'plata'],
  demora_amarillo_min: ['Comanda en amarillo a los (min)', 'num'],
  demora_naranja_min: ['Comanda en naranja a los (min)', 'num'],
  demora_rojo_min: ['Comanda en rojo a los (min)', 'num'],
  mesa_sin_pedido_min: ['Avisar mesa sin pedido a los (min)', 'num'],
  plato_listo_sin_retirar_min: ['Avisar plato sin retirar a los (min)', 'num'],
  cuenta_pedida_min: ['Avisar cuenta pedida a los (min)', 'num'],
  take_away_activo: ['Take away habilitado', 'bool'],
  propina_sugerida_pct: ['Propina sugerida (%)', 'num'],
  reserva_aviso_min: ['Mostrar reservas con (min) de anticipación', 'num'],
};

export default function Config() {
  const toast = useToast();
  const { datos } = useDatos('/admin/config');
  const [valores, setValores] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (datos?.valores) setValores(datos.valores);
  }, [datos]);

  const guardar = async () => {
    setGuardando(true);
    try {
      await api.put('/admin/config', valores);
      toast.ok('Configuración guardada');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const cambiar = (clave, valor) => setValores((v) => ({ ...v, [clave]: valor }));

  return (
    <section className="panel">
      <header>Configuración del local</header>
      <div className="cuerpo pila">
        <p className="t13 tenue">
          El tope de descuento sin PIN arranca en cero a propósito: el sistema viene seguro de
          fábrica y el dueño lo afloja si le molesta.
        </p>

        {Object.entries(ETIQUETAS).map(([clave, [texto, tipo]]) => (
          <label className="campo" key={clave}>
            <span>{texto}</span>
            {tipo === 'bool' ? (
              <select value={valores[clave] ?? '0'} onChange={(e) => cambiar(clave, e.target.value)}>
                <option value="1">Sí</option>
                <option value="0">No</option>
              </select>
            ) : (
              <input
                className={tipo === 'texto' ? '' : 'mono'}
                type={tipo === 'texto' ? 'text' : 'number'}
                step={tipo === 'plata' ? '100' : '1'}
                value={valores[clave] ?? ''}
                onChange={(e) => cambiar(clave, e.target.value)}
              />
            )}
          </label>
        ))}

        <button className="btn btn-primario btn-grande btn-ancho" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </section>
  );
}
