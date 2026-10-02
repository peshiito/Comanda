import { useState } from 'react';
import { Bank, CreditCard, Money, QrCode, Receipt, Wallet } from '@phosphor-icons/react';
import { api } from '../../lib/api.js';
import { useDatos } from '../../lib/useDatos.js';
import { useToast } from '../../componentes/Toast.jsx';
import { EsqueletoLista } from '../../componentes/Esqueleto.jsx';
import { fechaHora, plata, plataCorta } from '../../lib/formato.js';

const MEDIOS = {
  efectivo: { texto: 'Efectivo', Icono: Money },
  debito: { texto: 'Débito', Icono: CreditCard },
  credito: { texto: 'Crédito', Icono: CreditCard },
  transferencia: { texto: 'Transferencia', Icono: Bank },
  qr: { texto: 'QR', Icono: QrCode },
};
const ORDEN_MEDIOS = ['efectivo', 'debito', 'credito', 'transferencia', 'qr'];

const TIPOS = {
  ingreso: { texto: 'Ingreso', clase: 'eti-verde', signo: '+' },
  egreso: { texto: 'Egreso', clase: 'eti-roja', signo: '−' },
  retiro: { texto: 'Retiro', clase: 'eti-amarilla', signo: '−' },
};

/**
 * Categorías cerradas a propósito. El motivo libre sirve para el detalle
 * ("adelanto a Diego, quincena"), pero si el reporte depende de que todos
 * escriban igual —"luz", "EDESUR", "factura de luz"— no se puede sumar nada.
 */
const CATEGORIAS = {
  mercaderia: 'Mercadería',
  sueldo: 'Sueldos',
  adelanto: 'Adelanto a empleado',
  servicio: 'Servicios (luz, gas, internet)',
  alquiler: 'Alquiler',
  impuesto: 'Impuestos',
  mantenimiento: 'Mantenimiento',
  retiro: 'Retiro de socio',
  aporte: 'Aporte de socio',
  otro: 'Otro',
};

/** Qué categorías tienen sentido según lo que estés cargando. */
const POR_TIPO = {
  egreso: ['mercaderia', 'sueldo', 'adelanto', 'servicio', 'alquiler', 'impuesto', 'mantenimiento', 'otro'],
  ingreso: ['aporte', 'otro'],
  retiro: ['retiro', 'otro'],
};

export default function Caja() {
  const toast = useToast();
  const { datos: arqueo, cargando, recargar } = useDatos('/caja/turno/arqueo', ['caja:cambio']);
  const { datos: movs, recargar: recargarMovs } = useDatos('/caja/movimientos', ['caja:cambio']);
  const [form, setForm] = useState({
    tipo: 'egreso', medio: 'efectivo', categoria: 'mercaderia', monto: '', motivo: '',
  });
  const [enviando, setEnviando] = useState(false);

  if (cargando) return <EsqueletoLista filas={5} />;

  if (!arqueo) {
    return (
      <div className="vacio">
        <Wallet size={32} weight="light" aria-hidden="true" />
        <strong>No hay un turno de caja abierto</strong>
        <p className="t13">Los movimientos se cargan sobre un turno. Abrilo desde Caja → Arqueo.</p>
      </div>
    );
  }

  const set = (campo, valor) =>
    setForm((f) => {
      const n = { ...f, [campo]: valor };
      // Al cambiar de tipo, la categoría anterior puede no aplicar
      if (campo === 'tipo' && !POR_TIPO[valor].includes(n.categoria)) {
        n.categoria = POR_TIPO[valor][0];
      }
      return n;
    });

  const registrar = async () => {
    const n = Number(form.monto);
    if (!(n > 0) || form.motivo.trim().length < 3 || enviando) return;
    setEnviando(true);
    try {
      await api.post('/caja/movimientos', {
        tipo: form.tipo, medio: form.medio, categoria: form.categoria,
        monto: n, motivo: form.motivo.trim(),
      });
      toast.ok(`${TIPOS[form.tipo].texto} registrado`);
      setForm((f) => ({ ...f, monto: '', motivo: '' }));
      recargar();
      recargarMovs();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const lineas = [...(arqueo.por_medio ?? [])].sort(
    (a, b) => ORDEN_MEDIOS.indexOf(a.medio) - ORDEN_MEDIOS.indexOf(b.medio)
  );
  const gastos = (arqueo.movimientos_por_categoria ?? []).filter((c) => c.tipo !== 'ingreso');
  const enCajon = form.medio === 'efectivo';

  return (
    <div className="pila">
      <div>
        <h2>Caja</h2>
        <p className="t13 tenue" style={{ maxWidth: '62ch' }}>
          Cuánta plata hay y por dónde entró o salió. Lo único que cambia el efectivo
          del cajón es lo que se movió en efectivo: si un sueldo se pagó por
          transferencia, sale del banco y el cajón queda igual.
        </p>
      </div>

      <div className="rejilla-kpi">
        <div className="kpi">
          <span className="rotulo">Efectivo en el cajón</span>
          <span className="kpi-valor">{plataCorta(arqueo.efectivo_esperado)}</span>
          <span className="kpi-pie">Incluye el fondo de {plata(arqueo.fondo_inicial)}</span>
        </div>
        <div className="kpi">
          <span className="rotulo">Cobrado sin efectivo</span>
          <span className="kpi-valor">{plataCorta(arqueo.cobrado_electronico)}</span>
          <span className="kpi-pie">Tarjetas, transferencias y QR</span>
        </div>
        <div className="kpi">
          <span className="rotulo">Ingresos del turno</span>
          <span className="kpi-valor">{plataCorta(arqueo.ingresos)}</span>
          <span className="kpi-pie">Aparte de las ventas</span>
        </div>
        <div className="kpi">
          <span className="rotulo">Egresos y retiros</span>
          <span className="kpi-valor">
            {plataCorta(Number(arqueo.egresos) + Number(arqueo.retiros))}
          </span>
          <span className="kpi-pie">
            Egresos {plata(arqueo.egresos)} · Retiros {plata(arqueo.retiros)}
          </span>
        </div>
      </div>

      {/* El cuadro que faltaba: cada medio con su venta y sus movimientos */}
      <section className="panel">
        <header><span className="rotulo">Plata por medio de pago</span></header>
        <div className="cuerpo">
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Medio</th>
                  <th className="derecha">Ventas</th>
                  <th className="derecha">Propinas</th>
                  <th className="derecha">Ingresos</th>
                  <th className="derecha">Salidas</th>
                  <th className="derecha">Neto</th>
                </tr>
              </thead>
              <tbody>
                {lineas.length ? (
                  lineas.map((l) => {
                    const { texto, Icono } = MEDIOS[l.medio] ?? { texto: l.medio, Icono: Receipt };
                    return (
                      <tr key={l.medio}>
                        <td>
                          <span className="fila">
                            <Icono size={16} weight="bold" aria-hidden="true" />
                            {texto}
                            {l.operaciones ? (
                              <span className="t12 tenue-3">{l.operaciones} op.</span>
                            ) : null}
                          </span>
                        </td>
                        <td className="derecha mono">{plata(l.ventas)}</td>
                        <td className="derecha mono tenue">{plata(l.propinas)}</td>
                        <td className="derecha mono">
                          {Number(l.ingresos) ? `+${plata(l.ingresos)}` : '—'}
                        </td>
                        <td className="derecha mono">
                          {Number(l.egresos) ? `−${plata(l.egresos)}` : '—'}
                        </td>
                        <td className="derecha mono medio">{plata(l.neto)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="tenue">Todavía no se movió plata en este turno.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="campo-ayuda">
            El efectivo es lo único que está en el cajón. Lo demás ya está en el banco
            o lo acredita la tarjeta.
          </p>
        </div>
      </section>

      {gastos.length ? (
        <section className="panel">
          <header><span className="rotulo">En qué se gastó</span></header>
          <div className="cuerpo pila-2">
            {gastos.map((g) => (
              <div className="fila-sep" key={`${g.categoria}${g.tipo}`}>
                <span className="fila">
                  <span className={`eti ${TIPOS[g.tipo]?.clase ?? 'eti-neutra'}`}>
                    {TIPOS[g.tipo]?.texto ?? g.tipo}
                  </span>
                  {CATEGORIAS[g.categoria] ?? g.categoria}
                </span>
                <span className="mono medio">{plata(g.monto)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <header><span className="rotulo">Registrar un movimiento</span></header>
        <div className="cuerpo pila">
          <div className="campo">
            <span className="rotulo">Qué es</span>
            <div className="opciones">
              {Object.entries(TIPOS).map(([clave, { texto }]) => (
                <button
                  key={clave}
                  className="pildora"
                  aria-pressed={form.tipo === clave}
                  onClick={() => set('tipo', clave)}
                >
                  {texto}
                </button>
              ))}
            </div>
          </div>

          <div className="campo">
            <span className="rotulo">Por dónde</span>
            <div className="opciones">
              {ORDEN_MEDIOS.map((m) => (
                <button
                  key={m}
                  className="pildora"
                  aria-pressed={form.medio === m}
                  onClick={() => set('medio', m)}
                >
                  {MEDIOS[m].texto}
                </button>
              ))}
            </div>
            {/* Que quede clarísimo antes de guardar, no después */}
            <span className={`campo-ayuda${enCajon ? '' : ' caja-aviso'}`}>
              {enCajon
                ? 'Sale o entra del cajón: el efectivo esperado del arqueo cambia.'
                : 'No toca el cajón. El efectivo del arqueo queda igual; se mueve la cuenta.'}
            </span>
          </div>

          <label className="campo">
            <span>Categoría</span>
            <select value={form.categoria} onChange={(e) => set('categoria', e.target.value)}>
              {POR_TIPO[form.tipo].map((c) => (
                <option key={c} value={c}>{CATEGORIAS[c]}</option>
              ))}
            </select>
            <span className="campo-ayuda">De acá sale el resumen de “en qué se gastó”.</span>
          </label>

          <label className="campo">
            <span>Monto</span>
            <input
              className="mono"
              type="number"
              min="0"
              step="100"
              inputMode="decimal"
              value={form.monto}
              onChange={(e) => set('monto', e.target.value)}
              placeholder="0"
            />
          </label>

          <label className="campo">
            <span>Detalle</span>
            <input
              value={form.motivo}
              onChange={(e) => set('motivo', e.target.value)}
              maxLength={255}
              placeholder="adelanto a Diego, quincena de septiembre…"
            />
            <span className="campo-ayuda">Queda en la auditoría con tu nombre y la hora.</span>
          </label>

          <button
            className="btn btn-primario btn-grande btn-ancho"
            onClick={registrar}
            disabled={!(Number(form.monto) > 0) || form.motivo.trim().length < 3 || enviando}
          >
            {enviando
              ? 'Registrando…'
              : `Registrar ${TIPOS[form.tipo].texto.toLowerCase()} en ${MEDIOS[form.medio].texto.toLowerCase()}`}
          </button>
        </div>
      </section>

      <section className="panel">
        <header>
          <span className="rotulo">Movimientos del turno</span>
          <span className="eti eti-neutra">{(movs ?? []).length}</span>
        </header>
        <div className="cuerpo pila-2">
          {(movs ?? []).length ? (
            movs.map((m) => {
              const t = TIPOS[m.tipo] ?? TIPOS.egreso;
              const med = MEDIOS[m.medio] ?? { texto: m.medio, Icono: Receipt };
              return (
                <div className="fila-sep" key={m.id}>
                  <span className="crece">
                    <span className="fila envolver" style={{ gap: 'var(--e2)' }}>
                      <span className={`eti ${t.clase}`}>{t.texto}</span>
                      <span className="eti eti-neutra">
                        <med.Icono size={12} weight="bold" aria-hidden="true" /> {med.texto}
                      </span>
                      <strong>{CATEGORIAS[m.categoria] ?? m.categoria}</strong>
                    </span>
                    <span className="t12 tenue-3">
                      {m.motivo} · {fechaHora(m.creado_at)} · {m.usuario}
                    </span>
                  </span>
                  <span className="mono medio">{t.signo}{plata(m.monto)}</span>
                </div>
              );
            })
          ) : (
            <p className="t13 tenue">
              Sin movimientos. Todo lo que hay en el cajón es fondo más ventas en efectivo.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
