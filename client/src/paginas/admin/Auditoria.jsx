import { useState } from 'react';
import { ClipboardText } from '@phosphor-icons/react';
import { EsqueletoLista } from '../../componentes/Esqueleto.jsx';
import { useDatos } from '../../lib/useDatos.js';
import { HOY, fechaHora } from '../../lib/formato.js';

const TEXTO_ACCION = {
  item_anulado: 'Anuló un ítem',
  item_devuelto: 'Devolvió un plato',
  descuento_aplicado: 'Aplicó un descuento',
  cuenta_perdida: 'Marcó una cuenta como no cobrada',
  cuentas_fusionadas: 'Fusionó cuentas',
  pin_rechazado: 'PIN rechazado',
  turno_cerrado: 'Cerró el turno',
  precio_cambiado: 'Cambió un precio',
  cuenta_movida: 'Movió una cuenta de mesa',
  item_movido: 'Pasó un ítem a otra cuenta',
  credenciales_cambiadas: 'Cambió credenciales',
  cuenta_abierta: 'Abrió una cuenta',
  comanda_enviada: 'Mandó una comanda',
  cuenta_cobrada: 'Cobró una cuenta',
};

const ROJAS = ['item_devuelto', 'cuenta_perdida', 'pin_rechazado'];

/** El panel que el dueño abre cuando hay algo que discutir. */
export default function Auditoria() {
  const [desde, setDesde] = useState(HOY());
  const [hasta, setHasta] = useState(HOY());
  const [accion, setAccion] = useState('sensibles');

  const q = `?desde=${desde}&hasta=${hasta}&accion=${accion}`;
  const { datos: filas, cargando } = useDatos(`/admin/auditoria${q}`);
  const { datos: resumen } = useDatos(`/admin/auditoria/resumen?desde=${desde}&hasta=${hasta}`);
  const { datos: acciones } = useDatos('/admin/auditoria/acciones');

  const leerDatos = (d) => {
    if (!d) return null;
    try {
      return typeof d === 'string' ? JSON.parse(d) : d;
    } catch {
      return null;
    }
  };

  return (
    <div className="pila">
      <div className="fila envolver">
        <label className="campo">
          <span>Desde</span>
          <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className="campo">
          <span>Hasta</span>
          <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <label className="campo crece">
          <span>Qué mostrar</span>
          <select value={accion} onChange={(e) => setAccion(e.target.value)}>
            <option value="sensibles">Solo lo que importa</option>
            <option value="">Todo el movimiento</option>
            {(acciones ?? []).map((a) => (
              <option key={a.accion} value={a.accion}>
                {TEXTO_ACCION[a.accion] ?? a.accion} ({a.veces})
              </option>
            ))}
          </select>
        </label>
      </div>

      {resumen?.length ? (
        <section className="panel">
          <header><span className="rotulo">Resumen del período</span></header>
          <div className="cuerpo tabla-scroll">
            <table className="tabla">
              <thead><tr><th>Acción</th><th>Quién</th><th className="derecha">Veces</th></tr></thead>
              <tbody>
                {resumen.map((r, i) => (
                  <tr key={i}>
                    <td>{TEXTO_ACCION[r.accion] ?? r.accion}</td>
                    <td>{r.actor_nombre ?? '—'}</td>
                    <td className="derecha mono">{r.veces}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {cargando ? (
        <EsqueletoLista filas={5} />
      ) : filas?.length ? (
        <section className="panel">
          <header><span className="rotulo">Detalle</span><span className="eti eti-neutra">{filas.length}</span></header>
          <div className="cuerpo pila-2">
            {filas.map((f) => {
              const datos = leerDatos(f.datos);
              return (
                <div className="tarjeta pila-2" key={f.id}>
                  <div className="fila-sep">
                    <strong className="t13">
                      {TEXTO_ACCION[f.accion] ?? f.accion}
                      {ROJAS.includes(f.accion) ? (
                        <span className="eti eti-roja" style={{ marginLeft: 8 }}>sensible</span>
                      ) : null}
                    </strong>
                    <span className="t12 mono tenue-3">{fechaHora(f.creado_at)}</span>
                  </div>
                  <div className="t12 tenue">
                    {f.actor_nombre ?? 'sistema'}
                    {f.actor_rol ? ` · ${f.actor_rol}` : ''}
                    {f.entidad ? ` · ${f.entidad} #${f.entidad_id ?? ''}` : ''}
                  </div>
                  {f.motivo ? <div className="t13">Motivo: {f.motivo}</div> : null}
                  {datos ? (
                    <div className="t12 tenue-3 mono" style={{ wordBreak: 'break-word' }}>
                      {Object.entries(datos).map(([k, v]) => `${k}: ${v}`).join('  ·  ')}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="vacio">
          <ClipboardText size={34} weight="light" />
          <strong>Sin registros en el período</strong>
          <p className="t13">Nada que revisar. Probá ampliar las fechas.</p>
        </div>
      )}
    </div>
  );
}
