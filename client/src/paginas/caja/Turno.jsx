import { useState } from 'react';
import { LockOpen } from '@phosphor-icons/react';
import Barra from '../../componentes/Barra.jsx';
import Modal from '../../componentes/Modal.jsx';
import { Bloque } from '../../componentes/Esqueleto.jsx';
import { Tabla } from '../../componentes/Datos.jsx';
import Arqueo, { TIPOS_MOVIMIENTO } from './Arqueo.jsx';
import { api } from '../../lib/api.js';
import { useDatos } from '../../lib/useDatos.js';
import { useToast } from '../../componentes/Toast.jsx';
import { fechaHora, plata } from '../../lib/formato.js';
import './caja.css';

export default function Turno() {
  const toast = useToast();
  const { datos: estado, cargando, recargar: recargarEstado } = useDatos('/caja/turno', ['caja:turno']);
  const hayTurno = Boolean(estado?.turno);
  const { datos: arqueo, recargar: recargarArqueo } = useDatos(
    hayTurno ? '/caja/turno/arqueo' : null,
    ['caja:movimiento', 'cuenta:cerrada']
  );
  const { datos: movimientos, recargar: recargarMovs } = useDatos(
    hayTurno ? '/caja/movimientos' : null,
    ['caja:movimiento']
  );

  const [fondo, setFondo] = useState('20000');
  const [declarado, setDeclarado] = useState('');
  const [nota, setNota] = useState('');
  const [cerrando, setCerrando] = useState(false);
  const [mov, setMov] = useState(null);

  const refrescar = () => { recargarEstado(); recargarArqueo(); recargarMovs(); };

  const abrir = async () => {
    try {
      const r = await api.post('/caja/turno/abrir', { fondo_inicial: Number(fondo) || 0 });
      toast.ok(
        r.agotados_limpiados
          ? `Caja abierta. Se repusieron ${r.agotados_limpiados} productos agotados.`
          : 'Caja abierta'
      );
      refrescar();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const cerrar = async () => {
    try {
      const r = await api.post('/caja/turno/cerrar', {
        total_declarado: Number(declarado) || 0,
        nota: nota || null,
      });
      const dif = Number(r.diferencia);
      toast.avisar(
        dif === 0 ? 'Cerró justo' : `Cerró con diferencia de ${plata(dif)}`,
        dif === 0 ? 'ok' : 'error',
        7000
      );
      setCerrando(false);
      refrescar();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const registrarMov = async () => {
    try {
      await api.post('/caja/movimientos', {
        tipo: mov.tipo, monto: Number(mov.monto) || 0, motivo: mov.motivo,
      });
      toast.ok('Movimiento registrado');
      setMov(null);
      refrescar();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const diferencia = declarado === '' ? null : Number(declarado) - Number(arqueo?.efectivo_esperado ?? 0);

  return (
    <>
      <Barra titulo="Turno de caja" atras="/caja" />
      <div className="contenido pila">
        {cargando ? (
          <div className="panel">
            <header><Bloque ancho="110px" alto={12} /></header>
            <div className="cuerpo pila">
              <Bloque alto={44} radio="var(--r2)" /><Bloque alto={56} radio="var(--r2)" />
            </div>
          </div>
        ) : !hayTurno ? (
          <section className="panel">
            <header><span className="fila"><LockOpen size={16} weight="bold" /> Abrir caja</span></header>
            <div className="cuerpo pila">
              <label className="campo">
                <span>Fondo inicial en efectivo</span>
                <input
                  className="mono t22" type="number" step="100" value={fondo}
                  onChange={(e) => setFondo(e.target.value)} autoFocus
                />
                <span className="campo-ayuda">
                  Al abrir el turno se reponen solos los productos que quedaron agotados ayer.
                </span>
              </label>
              <button className="btn btn-primario btn-grande btn-ancho" onClick={abrir}>Abrir turno</button>
            </div>
          </section>
        ) : (
          <>
            <Arqueo
              arqueo={arqueo}
              turno={estado.turno}
              driver={estado.driver_fiscal}
              onMovimiento={(tipo) => setMov({ tipo, monto: '', motivo: '' })}
              onCerrar={() => { setDeclarado(''); setCerrando(true); }}
            />

            <section className="panel">
              <header><span className="rotulo">Movimientos del turno</span></header>
              <div className="cuerpo">
                <Tabla
                  clave="id"
                  filas={movimientos ?? []}
                  vacio="Sin movimientos por ahora."
                  columnas={[
                    { campo: 'creado_at', titulo: 'Hora', mono: true, render: (m) => fechaHora(m.creado_at) },
                    { campo: 'tipo', titulo: 'Tipo', render: (m) => TIPOS_MOVIMIENTO[m.tipo]?.texto ?? m.tipo },
                    {
                      campo: 'motivo', titulo: 'Motivo',
                      render: (m) => <>{m.motivo} <span className="tenue-3">· {m.usuario}</span></>,
                    },
                    { campo: 'monto', titulo: 'Monto', derecha: true, mono: true, render: (m) => plata(m.monto) },
                  ]}
                />
              </div>
            </section>
          </>
        )}
      </div>

      {cerrando ? (
        <Modal
          titulo="Cerrar turno"
          descripcion="Contá el efectivo de la caja y poné cuánto hay de verdad."
          alCerrar={() => setCerrando(false)}
          pie={
            <>
              <button className="btn" onClick={() => setCerrando(false)}>Cancelar</button>
              <button className="btn btn-primario" onClick={cerrar} disabled={declarado === ''}>
                Cerrar turno
              </button>
            </>
          }
        >
          <div className="pila">
            <div className="totales">
              <div className="t13">
                <span className="tenue">El sistema espera</span>
                <span className="mono">{plata(arqueo?.efectivo_esperado)}</span>
              </div>
            </div>
            <label className="campo">
              <span>Efectivo contado</span>
              <input
                className="mono t22" type="number" step="100" value={declarado}
                onChange={(e) => setDeclarado(e.target.value)} autoFocus
              />
            </label>
            {diferencia !== null ? (
              <p
                className={diferencia === 0 ? 'vuelto' : 'alerta-monto'}
                style={diferencia === 0 ? undefined : { justifyContent: 'space-between' }}
              >
                <span className="rotulo" style={{ color: 'inherit' }}>
                  {diferencia === 0 ? 'Cuadra justo' : diferencia > 0 ? 'Sobra' : 'Falta'}
                </span>
                <strong className="mono">{plata(Math.abs(diferencia))}</strong>
              </p>
            ) : null}
            <label className="campo">
              <span>Nota (opcional)</span>
              <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} />
            </label>
          </div>
        </Modal>
      ) : null}

      {mov ? (
        <Modal
          titulo={TIPOS_MOVIMIENTO[mov.tipo].texto}
          alCerrar={() => setMov(null)}
          pie={
            <>
              <button className="btn" onClick={() => setMov(null)}>Cancelar</button>
              <button
                className="btn btn-primario" onClick={registrarMov}
                disabled={!mov.monto || mov.motivo.length < 3}
              >
                Registrar
              </button>
            </>
          }
        >
          <div className="pila">
            <label className="campo">
              <span>Monto</span>
              <input
                className="mono t22" type="number" step="100" value={mov.monto}
                onChange={(e) => setMov({ ...mov, monto: e.target.value })} autoFocus
              />
            </label>
            <label className="campo">
              <span>Motivo</span>
              <input
                value={mov.motivo} onChange={(e) => setMov({ ...mov, motivo: e.target.value })}
                placeholder="pago al verdulero" maxLength={200}
              />
            </label>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
