import { useEffect, useState } from 'react';
import { ArrowUUpLeft, Check, CookingPot, Prohibit, Warning } from '@phosphor-icons/react';
import Barra from '../../componentes/Barra.jsx';
import Modal from '../../componentes/Modal.jsx';
import { EsqueletoKds } from '../../componentes/Esqueleto.jsx';
import { api } from '../../lib/api.js';
import { useDatos, useReloj } from '../../lib/useDatos.js';
import { obtenerSocket, sonarAviso } from '../../lib/socket.js';
import { useToast } from '../../componentes/Toast.jsx';
import './cocina.css';

const EVENTOS = ['comanda:nueva', 'comanda:cambio', 'comanda:terminada', 'cuenta:cambio'];

/**
 * Pantalla de cocina: las más viejas arriba, las urgentes primero, el reloj lo
 * cuenta el sistema y hay un solo botón. Al cocinero no se le pide ningún dato;
 * lo único extra es poder avisar que algo se agotó.
 */
export default function Cocina() {
  const toast = useToast();
  const { datos, cargando, recargar } = useDatos('/comandas/pendientes', EVENTOS, 20000);
  const [deshacibles, setDeshacibles] = useState([]);
  const [agotando, setAgotando] = useState(null);
  useReloj(15);

  useEffect(() => {
    const socket = obtenerSocket();
    const alNueva = () => {
      sonarAviso();
      recargar();
    };
    socket.on('comanda:nueva', alNueva);
    return () => socket.off('comanda:nueva', alNueva);
  }, [recargar]);

  const terminar = async (comanda) => {
    try {
      await api.post(`/comandas/${comanda.id}/terminada`);
      setDeshacibles((d) => [...d, comanda]);
      setTimeout(() => setDeshacibles((d) => d.filter((x) => x.id !== comanda.id)), 30000);
      recargar();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const deshacer = async (id) => {
    try {
      await api.post(`/comandas/${id}/deshacer`);
      setDeshacibles((d) => d.filter((x) => x.id !== id));
      recargar();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const agotar = async (item) => {
    try {
      await api.post(`/carta/producto/${item.producto_id}/agotado`, { agotado: true, alcance: 'hoy' });
      toast.ok(`${item.nombre}: agotado por hoy`);
      setAgotando(null);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const comandas = datos ?? [];

  return (
    <>
      <Barra
        oscura
        titulo="Cocina"
        subtitulo={comandas.length ? `${comandas.length} comanda(s) en curso` : 'Todo al día'}
        acciones={
          <span className="cocina-reloj mono" aria-hidden="true">
            {new Date().toLocaleTimeString('es-AR', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
          </span>
        }
      />

      {deshacibles.length ? (
        <div className="cocina-deshacer" role="status">
          {deshacibles.map((c) => (
            <button key={c.id} className="btn btn-chico" onClick={() => deshacer(c.id)}>
              <ArrowUUpLeft size={15} weight="bold" /> Deshacer {c.mesa_label}
            </button>
          ))}
        </div>
      ) : null}

      {cargando ? (
        <EsqueletoKds />
      ) : !comandas.length ? (
        <div className="vacio" style={{ paddingTop: 'var(--e7)' }}>
          <CookingPot size={44} weight="light" />
          <strong className="t18">Sin comandas pendientes</strong>
          <p className="t13">Cuando caja mande un pedido, aparece acá solo y suena.</p>
        </div>
      ) : (
        <div className="kds">
          {comandas.map((c) => (
            <article key={c.id} className={`comanda nivel-${c.nivel}${c.urgente ? ' urgente' : ''}`}>
              <header>
                <strong className="comanda-mesa">{c.mesa_label}</strong>
                <span className="comanda-reloj mono">{c.minutos}′</span>
              </header>

              {c.urgente ? (
                <p className="comanda-bandera">
                  <Warning size={16} weight="fill" /> Urgente
                </p>
              ) : null}
              {c.nota ? <p className="comanda-nota">{c.nota}</p> : null}

              <ul className="comanda-items">
                {c.items.map((i) => (
                  <li key={i.id}>
                    <span className="comanda-cant mono">{i.cantidad}</span>
                    <span className="crece">
                      <span className="comanda-plato">{i.nombre}</span>
                      {i.mods.length ? <span className="comanda-mods">{i.mods.join(' · ')}</span> : null}
                      {i.nota ? <span className="comanda-aclara">{i.nota}</span> : null}
                      {i.es_reposicion ? <span className="eti eti-roja">reposición</span> : null}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="comanda-pie">
                <button className="btn btn-ok comanda-listo" onClick={() => terminar(c)}>
                  <Check size={22} weight="bold" /> Terminada
                </button>
                <button
                  className="btn btn-icono comanda-agotar"
                  onClick={() => setAgotando(c)}
                  aria-label="Marcar algo agotado"
                  title="Marcar algo agotado"
                >
                  <Prohibit size={20} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {agotando ? (
        <Modal
          titulo="¿Qué se agotó?"
          descripcion="Desaparece de caja, del celular del mozo y de la carta QR al instante. Vuelve solo cuando se abre el próximo turno."
          alCerrar={() => setAgotando(null)}
        >
          <div className="pila-2">
            {agotando.items
              .filter((i) => i.producto_id)
              .map((i) => (
                <button key={i.id} className="btn btn-ancho" onClick={() => agotar(i)}>
                  {i.nombre}
                </button>
              ))}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
