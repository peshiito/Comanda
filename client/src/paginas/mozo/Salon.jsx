import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Armchair, Bag, BellRinging, Clock, Users } from '@phosphor-icons/react';
import Barra from '../../componentes/Barra.jsx';
import Prioridades from './Prioridades.jsx';
import Plano from './Plano.jsx';
import PlanoEditor from './PlanoEditor.jsx';
import { EsqueletoSalon } from '../../componentes/Esqueleto.jsx';
import { useDatos, useReloj } from '../../lib/useDatos.js';
import { obtenerSocket, sonarAviso } from '../../lib/socket.js';
import { useToast } from '../../componentes/Toast.jsx';
import { useSesion } from '../../lib/sesion.jsx';
import { ETIQUETA_ESTADO, duracion, hora, plata, soloNumero } from '../../lib/formato.js';
import './salon.css';

const EVENTOS = [
  'salon:cambio', 'cuenta:cambio', 'cuenta:pedida', 'cuenta:cerrada',
  'comanda:cambio', 'comanda:terminada', 'borrador:pasado',
];

export default function Salon() {
  const navegar = useNavigate();
  const toast = useToast();
  const { esCaja, esEncargado } = useSesion();
  const { datos, cargando, recargar } = useDatos('/salon', EVENTOS, 60000);
  const [params, setParams] = useSearchParams();
  // La vista queda en la URL: así el encargado se guarda el enlace del plano.
  const pedida = params.get('vista');
  // Editar es del encargado: es el layout del local, no una vista del servicio.
  const vista = pedida === 'lista' ? 'lista' : pedida === 'editar' && esEncargado ? 'editar' : 'plano';
  useReloj(20);

  // El aviso de plato listo suena: es el que más plata salva en un servicio.
  useEffect(() => {
    const socket = obtenerSocket();
    const alListo = (d) => {
      sonarAviso(true);
      toast.ok(`${d.mesa} lista para retirar`);
    };
    socket.on('plato:listo', alListo);
    return () => socket.off('plato:listo', alListo);
  }, [toast]);

  if (cargando) {
    return (
      <>
        <Barra titulo="Salón" />
        <EsqueletoSalon />
      </>
    );
  }

  const mesas = datos?.mesas ?? [];
  const takeAway = datos?.take_away ?? [];
  const zonas = datos?.zonas ?? [];
  const ocupadas = mesas.filter((m) => m.cuentas.length).length;
  const libres = mesas.filter((m) => m.estado === 'libre').length;

  return (
    <>
      <Barra
        titulo="Salón"
        subtitulo={`${ocupadas} ocupadas · ${libres} libres`}
        acciones={
          <div className="tabs solo-ancho" role="tablist" aria-label="Cómo ver el salón">
            {[['plano', 'Plano'], ['lista', 'Lista'], ...(esEncargado ? [['editar', 'Editar']] : [])].map(([v, texto]) => (
              <button
                key={v}
                className="tab"
                role="tab"
                aria-selected={vista === v}
                onClick={() => setParams(v === 'plano' ? {} : { vista: v }, { replace: true })}
              >
                {texto}
              </button>
            ))}
          </div>
        }
      />
      <div className={`contenido pila vista-${vista}`}>
        <Prioridades />

        {vista === 'editar' ? (
          <PlanoEditor mesas={mesas} zonas={zonas} alCambiar={recargar} />
        ) : (
          <Plano mesas={mesas} zonas={zonas} esCaja={esCaja} alElegir={(m) => navegar(`/mesa/${m.id}`)} />
        )}

        <div className="mesas">
          {mesas.map((m) => {
            const eti = ETIQUETA_ESTADO[m.estado] ?? ETIQUETA_ESTADO.libre;
            const unida = m.estado === 'unida';
            const listo = m.cuentas.some((c) => c.comandas_listas > 0);
            const nombre = soloNumero(m.nombre);
            const grupo = m.satelites.map(soloNumero).join('+');

            return (
              <button
                key={m.id}
                className={`mesa mesa-${m.estado}${listo ? ' mesa-listo' : ''}`}
                onClick={() => navegar(`/mesa/${m.id}`)}
                disabled={unida}
                aria-label={`${m.nombre}, ${eti.texto}`}
              >
                <span className="mesa-alto">
                  <span className="mesa-numero">
                    {nombre}
                    {grupo ? <span className="mesa-grupo">+{grupo}</span> : null}
                  </span>
                  <span className={`eti ${eti.clase}`}>{eti.texto}</span>
                </span>

                <span className="mesa-bajo t12">
                  {m.cuentas.length ? (
                    <>
                      <span className="fila" style={{ gap: 4 }}>
                        <Users size={13} weight="bold" /> {m.comensales}
                      </span>
                      <span className="fila mono" style={{ gap: 4 }}>
                        <Clock size={13} weight="bold" /> {duracion(m.minutos)}
                      </span>
                      {m.cuentas.length > 1 ? (
                        <span className="eti eti-neutra">{m.cuentas.length} cuentas</span>
                      ) : null}
                    </>
                  ) : m.reserva ? (
                    <span className="cortar">
                      {m.reserva.nombre} · {hora(m.reserva.hora)}
                    </span>
                  ) : (
                    <span className="fila tenue-4" style={{ gap: 4 }}>
                      <Armchair size={13} weight="bold" /> {m.capacidad}
                    </span>
                  )}
                </span>

                {listo ? (
                  <span className="mesa-aviso">
                    <BellRinging size={13} weight="fill" /> Plato listo
                  </span>
                ) : m.borrador_pasado ? (
                  <span className="mesa-aviso tenue-3">Pedido en caja</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {takeAway.length ? (
          <section className="panel">
            <header>
              <span className="fila"><Bag size={15} weight="bold" /> Take away</span>
              <span className="eti eti-neutra">{takeAway.length}</span>
            </header>
            <div className="cuerpo pila-2">
              {takeAway.map((c) => (
                <button
                  key={c.id}
                  className="btn fila-sep"
                  onClick={() => esCaja && navegar(`/cuenta/${c.id}`)}
                  disabled={!esCaja}
                >
                  <span className="crece cortar" style={{ textAlign: 'left' }}>
                    {c.referencia ?? `#${c.id}`}
                    {c.mozo ? <span className="tenue-3"> · {c.mozo}</span> : null}
                  </span>
                  {esCaja ? <span className="mono">{plata(c.total)}</span> : null}
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
