import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bag, Lock, Plus, Receipt, Scales } from '@phosphor-icons/react';
import Barra from '../../componentes/Barra.jsx';
import Modal from '../../componentes/Modal.jsx';
import Bandeja from './Bandeja.jsx';
import { EsqueletoLista } from '../../componentes/Esqueleto.jsx';
import { api } from '../../lib/api.js';
import { useDatos, useReloj } from '../../lib/useDatos.js';
import { useToast } from '../../componentes/Toast.jsx';
import { duracion, hora, minutosDesde, plata } from '../../lib/formato.js';
import './caja.css';

const EVENTOS = [
  'borrador:pasado', 'cuenta:cambio', 'cuenta:pedida', 'cuenta:cerrada',
  'salon:cambio', 'caja:turno',
];

export default function Caja() {
  const navegar = useNavigate();
  const toast = useToast();
  const { datos: turno, cargando: cargandoTurno } = useDatos('/caja/turno', ['caja:turno']);
  const { datos: pendientes, cargando: cargandoPend, recargar: recargarPend } =
    useDatos('/borradores/pendientes', EVENTOS, 30000);
  const { datos: cuentas, cargando: cargandoCuentas, recargar: recargarCuentas } =
    useDatos('/cuentas', EVENTOS, 30000);
  const [takeAway, setTakeAway] = useState(false);
  const [referencia, setReferencia] = useState('');
  useReloj(20);

  const hayTurno = Boolean(turno?.turno);
  const porCobrar = (cuentas ?? []).filter((c) => c.estado === 'por_cobrar');
  const enSalon = (cuentas ?? []).filter((c) => c.estado !== 'por_cobrar');

  const cargarBorrador = async (b, enviar) => {
    try {
      const r = await api.post(`/borradores/${b.id}/convertir`, { enviar });
      toast.ok(enviar ? 'Comanda enviada a cocina' : 'Cargado sin mandar');
      recargarPend();
      recargarCuentas();
      navegar(`/cuenta/${r.cuenta_id}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const abrirTakeAway = async () => {
    try {
      const r = await api.post('/cuentas', { tipo: 'take_away', referencia: referencia || null });
      setTakeAway(false);
      setReferencia('');
      navegar(`/cuenta/${r.id}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const filaCuenta = (c) => (
    <button key={c.id} className="cuenta-fila" onClick={() => navegar(`/cuenta/${c.id}`)}>
      <span className="cuenta-fila-datos">
        <span className="fila" style={{ gap: 'var(--e2)' }}>
          <strong>{c.mesa ?? (c.referencia ? `Take away · ${c.referencia}` : 'Take away')}</strong>
          <span className="mono t12 tenue-3">#{c.id}</span>
          {c.estado === 'por_cobrar' ? <span className="eti eti-tinta">por cobrar</span> : null}
          {c.sin_enviar > 0 ? <span className="eti eti-amarilla">{c.sin_enviar} sin mandar</span> : null}
        </span>
        <span className="t12 tenue-3">
          {c.items} ítems · {c.comensales} pers. · {c.mozo ?? 'sin mozo'} ·{' '}
          {duracion(minutosDesde(c.abierta_at))}
        </span>
      </span>
      <span className="mono t18">{plata(c.total)}</span>
    </button>
  );

  return (
    <>
      <Barra
        titulo="Caja"
        subtitulo={
          cargandoTurno
            ? undefined
            : hayTurno
              ? `Turno #${turno.turno.id} · abierto ${hora(turno.turno.abierto_at)} por ${turno.turno.usuario}`
              : 'Caja cerrada'
        }
        acciones={
          hayTurno ? (
            <Link className="btn btn-chico" to="/caja/turno">
              <Scales size={15} weight="bold" /> Arqueo
            </Link>
          ) : null
        }
      />

      <div className="contenido pila">
        {!cargandoTurno && !hayTurno ? (
          <section className="panel panel-cerrado">
            <div className="cuerpo fila envolver" style={{ gap: 'var(--e4)' }}>
              <span className="cerrado-icono"><Lock size={22} weight="bold" /></span>
              <div className="crece">
                <h2>La caja está cerrada</h2>
                <p className="t13 tenue">
                  Abrí el turno con el fondo inicial para poder cobrar. Al abrirlo se reponen solos
                  los productos que ayer quedaron agotados.
                </p>
              </div>
              <Link className="btn btn-primario btn-grande" to="/caja/turno">Abrir caja</Link>
            </div>
          </section>
        ) : null}

        <Bandeja
          pendientes={pendientes}
          cargando={cargandoPend}
          hayTurno={hayTurno}
          onCargar={cargarBorrador}
        />

        {/* Por cobrar primero: es lo que traba la rotación de mesas */}
        {porCobrar.length ? (
          <section className="panel panel-cobrar">
            <header>
              <span className="fila"><Receipt size={16} weight="bold" /> Piden la cuenta</span>
              <span className="eti eti-marca">{porCobrar.length}</span>
            </header>
            <div className="cuerpo pila-2">{porCobrar.map(filaCuenta)}</div>
          </section>
        ) : null}

        <section className="panel">
          <header>
            <span>Cuentas abiertas</span>
            <button className="btn btn-chico" onClick={() => setTakeAway(true)} disabled={!hayTurno}>
              <Plus size={14} weight="bold" /> Take away
            </button>
          </header>
          <div className="cuerpo pila-2">
            {cargandoCuentas ? (
              <EsqueletoLista filas={3} conCabecera={false} />
            ) : enSalon.length ? (
              enSalon.map(filaCuenta)
            ) : (
              <div className="vacio">
                <Bag size={34} weight="light" />
                <strong>Sin cuentas abiertas</strong>
                <p className="t13">El salón está libre.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {takeAway ? (
        <Modal
          titulo="Nuevo take away"
          descripcion="Sin mesa: se identifica con un nombre o un número de ticket."
          alCerrar={() => setTakeAway(false)}
          pie={
            <>
              <button className="btn" onClick={() => setTakeAway(false)}>Cancelar</button>
              <button className="btn btn-primario" onClick={abrirTakeAway}>Crear</button>
            </>
          }
        >
          <label className="campo">
            <span>Nombre o ticket</span>
            <input
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ramírez"
              maxLength={60}
              onKeyDown={(e) => e.key === 'Enter' && abrirTakeAway()}
            />
          </label>
        </Modal>
      ) : null}
    </>
  );
}
