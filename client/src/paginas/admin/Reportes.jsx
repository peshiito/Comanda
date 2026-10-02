import { useState } from 'react';
import { Barras, Kpi, Tabla } from '../../componentes/Datos.jsx';
import { EsqueletoReportes } from '../../componentes/Esqueleto.jsx';
import { useDatos } from '../../lib/useDatos.js';
import { HOY, MEDIOS, duracion, fechaLocal, numero, plata, plataCorta } from '../../lib/formato.js';

const RANGOS = [
  { texto: 'Hoy', dias: 0 },
  { texto: '7 días', dias: 6 },
  { texto: '30 días', dias: 29 },
];

export default function Reportes() {
  const [desde, setDesde] = useState(HOY());
  const [hasta, setHasta] = useState(HOY());
  const q = `?desde=${desde}&hasta=${hasta}`;

  const { datos: resumen, cargando } = useDatos(`/reportes/resumen${q}`);
  const { datos: porHora } = useDatos(`/reportes/por-hora${q}`);
  const { datos: porProducto } = useDatos(`/reportes/por-producto${q}&limite=10`);
  const { datos: porMozo } = useDatos(`/reportes/por-mozo${q}`);
  const { datos: tiempos } = useDatos(`/reportes/tiempos${q}`);
  const { datos: perdidas } = useDatos(`/reportes/perdidas${q}`);
  const { datos: notas } = useDatos(`/reportes/notas-frecuentes${q}`);

  const aplicarRango = (dias) => {
    const fin = new Date();
    const ini = new Date();
    ini.setDate(fin.getDate() - dias);
    setDesde(fechaLocal(ini));
    setHasta(fechaLocal(fin));
  };

  return (
    <div className="pila">
      <div className="fila envolver" style={{ gap: 'var(--e3)' }}>
        <div className="opciones">
          {RANGOS.map((r) => (
            <button key={r.texto} className="pildora" onClick={() => aplicarRango(r.dias)}>
              {r.texto}
            </button>
          ))}
        </div>
        <div className="fila crece" style={{ justifyContent: 'flex-end' }}>
          <label className="campo">
            <span>Desde</span>
            <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="campo">
            <span>Hasta</span>
            <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
          </label>
        </div>
      </div>

      {cargando ? (
        <EsqueletoReportes />
      ) : (
        <>
          <div className="rejilla-kpi">
            <Kpi rotulo="Venta" valor={plataCorta(resumen?.venta)} pie={`${numero(resumen?.tickets)} tickets`} />
            <Kpi rotulo="Ticket promedio" valor={plataCorta(resumen?.ticket_promedio)} />
            <Kpi
              rotulo="Por comensal" valor={plataCorta(resumen?.por_comensal)}
              pie={`${numero(resumen?.comensales)} comensales`}
            />
            <Kpi rotulo="Propinas" valor={plataCorta(resumen?.propinas)} />
          </div>

          <section className="panel">
            <header><span className="rotulo">Los tres relojes del local</span></header>
            <div className="cuerpo pila">
              <p className="t12 tenue-3">
                Medidos solos, sin pedirle un dato a nadie: el sistema pone la hora cuando la
                comanda entra y cuando alguien la toca.
              </p>
              <div className="totales">
                <div className="t13"><span className="tenue">Duración de mesa</span><span className="mono">{duracion(tiempos?.mesa_minutos)}</span></div>
                <div className="t13"><span className="tenue">Cocina por comanda</span><span className="mono">{duracion(tiempos?.cocina_minutos)}</span></div>
                <div className="t13"><span className="tenue">De “listo” a retirado</span><span className="mono">{duracion(tiempos?.retiro_minutos)}</span></div>
                <div className="t13"><span className="tenue">De “piden la cuenta” a cobrado</span><span className="mono">{duracion(tiempos?.cobro_minutos)}</span></div>
                <div className="t13">
                  <span className="tenue">Comandas demoradas (+20 min)</span>
                  <span className="mono">
                    {numero(tiempos?.comandas_demoradas)} / {numero(tiempos?.comandas_medidas)}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <header><span className="rotulo">Medios de pago</span></header>
            <div className="cuerpo">
              <Barras
                filas={(resumen?.por_medio ?? []).map((p) => ({ ...p, medio: MEDIOS[p.medio] ?? p.medio }))}
                etiqueta="medio" valor="monto"
              />
            </div>
          </section>

          <section className="panel">
            <header><span className="rotulo">Horas pico</span></header>
            <div className="cuerpo">
              <Barras
                filas={(porHora ?? []).map((h) => ({ ...h, hora: `${String(h.hora).padStart(2, '0')}:00` }))}
                etiqueta="hora" valor="venta"
              />
            </div>
          </section>

          <section className="panel">
            <header><span className="rotulo">Más vendidos</span></header>
            <div className="cuerpo">
              <Barras filas={porProducto ?? []} etiqueta="producto" valor="unidades" formato={numero} />
            </div>
          </section>

          <section className="panel">
            <header><span className="rotulo">Por mozo</span></header>
            <div className="cuerpo">
              <Tabla
                clave="id"
                filas={porMozo ?? []}
                vacio="Sin ventas con mozo asignado en el período."
                columnas={[
                  { campo: 'mozo', titulo: 'Mozo' },
                  { campo: 'tickets', titulo: 'Tickets', derecha: true, mono: true, render: (f) => numero(f.tickets) },
                  { campo: 'venta', titulo: 'Venta', derecha: true, mono: true, render: (f) => plata(f.venta) },
                  { campo: 'propinas', titulo: 'Propinas', derecha: true, mono: true, render: (f) => plata(f.propinas) },
                ]}
              />
            </div>
          </section>

          <section className="panel">
            <header><span className="rotulo">Pérdidas</span></header>
            <div className="cuerpo pila">
              <div className="rejilla-kpi">
                <Kpi rotulo="Comida devuelta" valor={plataCorta(perdidas?.total_devuelto)} pie={`${perdidas?.devoluciones?.length ?? 0} platos`} />
                <Kpi rotulo="Anulado" valor={plataCorta(perdidas?.total_anulado)} pie="error de carga" />
                <Kpi rotulo="No cobrado" valor={plataCorta(perdidas?.total_no_cobrado)} pie={`${perdidas?.no_cobradas?.length ?? 0} cuentas`} />
              </div>
              <Tabla
                clave="id"
                filas={perdidas?.devoluciones ?? []}
                vacio="No se tiró comida en el período."
                columnas={[
                  { campo: 'producto', titulo: 'Plato', render: (f) => `${f.cantidad}× ${f.producto}` },
                  { campo: 'motivo', titulo: 'Motivo', chico: true },
                  { campo: 'autorizo', titulo: 'Autorizó', chico: true },
                  { campo: 'importe', titulo: 'Importe', derecha: true, mono: true, render: (f) => plata(f.importe) },
                ]}
              />
            </div>
          </section>

          <section className="panel">
            <header><span className="rotulo">Aclaraciones más repetidas</span></header>
            <div className="cuerpo pila-2">
              <p className="t12 tenue-3">
                Lo que se escribe a mano muchas veces conviene convertirlo en modificador de la
                carta: así se puede cobrar y se puede reportar.
              </p>
              {notas?.length
                ? notas.map((n, i) => (
                    <div className="fila-sep t13" key={i}>
                      <span className="cortar">{n.nota}</span>
                      <span className="mono tenue">{n.veces}×</span>
                    </div>
                  ))
                : <p className="t13 tenue-3">Nada repetido en el período.</p>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
