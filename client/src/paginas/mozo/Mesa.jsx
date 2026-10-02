import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowsIn, ArrowsOut, HandCoins, Minus, Plus, Users,
} from '@phosphor-icons/react';
import Barra from '../../componentes/Barra.jsx';
import Modal from '../../componentes/Modal.jsx';
import Borrador from './Borrador.jsx';
import UnirMesas from './UnirMesas.jsx';
import { Bloque } from '../../componentes/Esqueleto.jsx';
import { api } from '../../lib/api.js';
import { useDatos, useReloj } from '../../lib/useDatos.js';
import { useToast } from '../../componentes/Toast.jsx';
import { useSesion } from '../../lib/sesion.jsx';
import { ETIQUETA_ESTADO, duracion, plata } from '../../lib/formato.js';
import './salon.css';

const EVENTOS = [
  'salon:cambio', 'cuenta:cambio', 'cuenta:pedida', 'cuenta:cerrada',
  'comanda:terminada', 'borrador:pasado',
];

export default function Mesa() {
  const { mesaId } = useParams();
  const navegar = useNavigate();
  const toast = useToast();
  const { esCaja, usuario } = useSesion();
  const { datos, cargando, recargar } = useDatos('/salon', EVENTOS, 45000);
  const [abriendo, setAbriendo] = useState(false);
  const [comensales, setComensales] = useState(2);
  const [uniendo, setUniendo] = useState(false);
  // A nombre de qué mozo se abre. Sólo lo elige caja o encargado: cuando abre
  // el mozo, la cuenta queda a su nombre sola.
  const [mozoElegido, setMozoElegido] = useState('');
  const { datos: mozos } = useDatos(esCaja ? '/admin/mozos' : null);
  useReloj(20);

  const mesa = datos?.mesas?.find((m) => String(m.id) === String(mesaId));

  if (cargando) {
    return (
      <>
        <Barra titulo="Mesa" atras="/salon" />
        <div className="contenido pila">
          <div className="panel">
            <header><Bloque ancho="90px" alto={18} radio="var(--r-pill)" /></header>
            <div className="cuerpo pila"><Bloque alto={56} radio="var(--r2)" /><Bloque alto={44} radio="var(--r2)" /></div>
          </div>
        </div>
      </>
    );
  }

  if (!mesa) {
    return (
      <>
        <Barra titulo="Mesa" atras="/salon" />
        <div className="vacio"><strong>Esa mesa no existe</strong></div>
      </>
    );
  }

  const eti = ETIQUETA_ESTADO[mesa.estado] ?? ETIQUETA_ESTADO.libre;
  const cuentaActiva = mesa.cuentas[0] ?? null;

  const accion = async (fn, exito) => {
    try {
      const r = await fn();
      if (exito) toast.ok(exito);
      recargar();
      return r;
    } catch (e) {
      toast.error(e.message);
      return null;
    }
  };

  const ocupar = async () => {
    const r = await accion(
      () =>
        api.post('/cuentas', {
          tipo: 'salon',
          mesa_id: mesa.id,
          comensales,
          mozo_id: mozoElegido ? Number(mozoElegido) : null,
        }),
      `${mesa.nombre} ocupada`
    );
    if (r) setAbriendo(false);
  };

  const nombreCompleto = `${mesa.nombre}${mesa.satelites.length ? ` + ${mesa.satelites.join(' + ')}` : ''}`;

  return (
    <>
      <Barra
        titulo={nombreCompleto}
        subtitulo={mesa.cuentas.length ? `${mesa.comensales} comensales · ${duracion(mesa.minutos)}` : `${mesa.capacidad} lugares`}
        atras="/salon"
      />

      <div className="contenido pila">
        <section className="panel">
          <header>
            <span className={`eti ${eti.clase}`}>{eti.texto}</span>
            <div className="fila">
              <button className="btn btn-chico" onClick={() => setUniendo(true)}>
                <ArrowsIn size={15} weight="bold" /> Unir
              </button>
              {mesa.satelites.length ? (
                <button
                  className="btn btn-chico"
                  onClick={() =>
                    accion(async () => {
                      const sat = datos.mesas.filter((m) => m.unida_a === mesa.id);
                      await Promise.all(sat.map((s) => api.post(`/salon/mesas/${s.id}/desunir`)));
                    }, 'Mesas desunidas')
                  }
                >
                  <ArrowsOut size={15} weight="bold" /> Desunir
                </button>
              ) : null}
            </div>
          </header>

          <div className="cuerpo pila">
            {mesa.reserva ? (
              <p className="t13 fila" style={{ color: 'var(--azul)' }}>
                Reservada: <strong>{mesa.reserva.nombre}</strong> · {mesa.reserva.personas} personas
              </p>
            ) : null}

            {mesa.cuentas.length === 0 ? (
              <button className="btn btn-primario btn-grande btn-ancho" onClick={() => setAbriendo(true)}>
                <Users size={18} weight="bold" /> Marcar ocupada
              </button>
            ) : (
              <>
                {mesa.cuentas.map((c) => (
                  <div key={c.id} className="tarjeta fila envolver">
                    <div className="crece">
                      <div className="medio">Cuenta #{c.id}</div>
                      <div className="t12 tenue-3">
                        {c.comensales} pers. · {c.items} ítems · {c.mozo ?? 'sin mozo'}
                        {c.comandas_pendientes > 0 ? ' · en cocina' : ''}
                        {c.comandas_listas > 0 ? ' · plato listo' : ''}
                      </div>
                    </div>
                    {esCaja ? <span className="mono medio">{plata(c.total)}</span> : null}
                    {esCaja ? (
                      <button className="btn btn-chico" onClick={() => navegar(`/cuenta/${c.id}`)}>Abrir</button>
                    ) : null}
                    {c.estado === 'abierta' && c.items > 0 ? (
                      <button
                        className="btn btn-chico"
                        onClick={() => accion(() => api.post(`/cuentas/${c.id}/pedir-cuenta`), 'Caja avisada')}
                      >
                        <HandCoins size={15} weight="bold" /> Piden la cuenta
                      </button>
                    ) : null}
                  </div>
                ))}
                <button className="btn btn-chico" onClick={() => setAbriendo(true)}>
                  <Plus size={14} weight="bold" /> Cuenta nueva en esta mesa
                </button>
              </>
            )}
          </div>
        </section>

        {cuentaActiva ? (
          <Borrador mesaId={mesa.id} cuentaId={cuentaActiva.id} mozoId={usuario.id} />
        ) : (
          <p className="vacio t13">Marcá la mesa como ocupada para empezar a anotar el pedido.</p>
        )}
      </div>

      {abriendo ? (
        <Modal
          titulo={`Ocupar ${mesa.nombre}`}
          alCerrar={() => setAbriendo(false)}
          pie={
            <>
              <button className="btn" onClick={() => setAbriendo(false)}>Cancelar</button>
              <button className="btn btn-primario" onClick={ocupar}>Confirmar</button>
            </>
          }
        >
          <div className="campo">
            <span className="rotulo">¿Cuántos son?</span>
            <div className="contador">
              <button className="btn btn-icono" onClick={() => setComensales((n) => Math.max(0, n - 1))} aria-label="Uno menos">
                <Minus size={18} weight="bold" />
              </button>
              <input
                type="number" min="0" max="60" value={comensales} aria-label="Cantidad de comensales"
                onChange={(e) => setComensales(Math.max(0, Math.min(60, Number(e.target.value) || 0)))}
              />
              <button className="btn btn-icono" onClick={() => setComensales((n) => Math.min(60, n + 1))} aria-label="Uno más">
                <Plus size={18} weight="bold" />
              </button>
            </div>
            <span className="campo-ayuda">De acá salen el cubierto y el ticket por persona.</span>
          </div>

          {esCaja ? (
            <label className="campo" style={{ marginTop: 'var(--e4)' }}>
              <span>¿Qué mozo la atiende?</span>
              <select value={mozoElegido} onChange={(e) => setMozoElegido(e.target.value)}>
                <option value="">Yo mismo</option>
                {(mozos ?? [])
                  .filter((m) => m.id !== usuario.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
              </select>
              <span className="campo-ayuda">
                Si el mozo canta el pedido en papel, ponelo acá: la venta y las propinas
                quedan a su nombre aunque la cargues vos.
              </span>
            </label>
          ) : null}
        </Modal>
      ) : null}

      {uniendo ? (
        <UnirMesas
          mesa={mesa}
          mesas={datos.mesas}
          alCerrar={() => setUniendo(false)}
          alUnir={() => { setUniendo(false); recargar(); }}
        />
      ) : null}
    </>
  );
}
