import { BellRinging, CalendarCheck, HandCoins, Hourglass } from '@phosphor-icons/react';
import { api } from '../../lib/api.js';
import { useDatos } from '../../lib/useDatos.js';
import { useToast } from '../../componentes/Toast.jsx';
import { Bloque } from '../../componentes/Esqueleto.jsx';
import { NIVEL_CLASE } from '../../lib/formato.js';

const EVENTOS = ['comanda:terminada', 'comanda:cambio', 'cuenta:cambio', 'cuenta:pedida', 'salon:cambio'];

const ICONO = {
  plato_listo: BellRinging,
  mesa_sin_pedido: Hourglass,
  cuenta_pedida: HandCoins,
  reserva_encima: CalendarCheck,
};

/**
 * La franja de arriba del salón: ordenada por urgencia, no por número de mesa.
 * El plato listo sin retirar va primero porque se está enfriando.
 */
export default function Prioridades() {
  const toast = useToast();
  const { datos, cargando, recargar } = useDatos('/salon/prioridades', EVENTOS, 30000);

  const retirar = async (comandaId) => {
    try {
      await api.post(`/comandas/${comandaId}/retirado`);
      toast.ok('Listo, aviso apagado');
      recargar();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (cargando) {
    return (
      <section className="panel">
        <header><Bloque ancho="90px" alto={12} /></header>
        <div className="cuerpo pila-2">
          <Bloque alto={22} /><Bloque ancho="70%" alto={22} />
        </div>
      </section>
    );
  }

  const lista = datos ?? [];
  if (!lista.length) return null;

  return (
    <section className="panel panel-prioridades">
      <header>
        <span className="rotulo">Atender primero</span>
        <span className="eti eti-neutra">{lista.length}</span>
      </header>
      <div className="cuerpo-ajustado pila-2">
        {lista.map((p, i) => {
          const Icono = ICONO[p.tipo] ?? Hourglass;
          return (
            <div key={`${p.tipo}-${p.cuenta_id ?? p.mesa_id}-${i}`} className="prioridad">
              <span className={`prioridad-icono nivel-${p.nivel}`}>
                <Icono size={16} weight="fill" />
              </span>
              <span className="crece">{p.texto}</span>
              <span className={`eti ${NIVEL_CLASE[p.nivel]} mono`}>{p.minutos}′</span>
              {p.tipo === 'plato_listo' ? (
                <button className="btn btn-ok btn-chico" onClick={() => retirar(p.comanda_id)}>
                  Lo llevé
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
