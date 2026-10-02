import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle, FileText, FireSimple, Percent, Receipt, XCircle,
} from '@phosphor-icons/react';
import Barra from '../../componentes/Barra.jsx';
import SelectorProductos from '../../componentes/SelectorProductos.jsx';
import PedirPin from '../../componentes/PedirPin.jsx';
import { EsqueletoCuenta } from '../../componentes/Esqueleto.jsx';
import TicketCuenta from './TicketCuenta.jsx';
import AccionesItem from './AccionesItem.jsx';
import Cobrar from './Cobrar.jsx';
import { api } from '../../lib/api.js';
import { useDatos } from '../../lib/useDatos.js';
import { useToast } from '../../componentes/Toast.jsx';
import { ESTADO_CUENTA, plata } from '../../lib/formato.js';
import './caja.css';

const EVENTOS = ['cuenta:cambio', 'cuenta:cerrada', 'comanda:terminada', 'comanda:cambio'];

export default function Cuenta() {
  const { cuentaId } = useParams();
  const navegar = useNavigate();
  const toast = useToast();
  const { datos: cuenta, cargando, recargar } = useDatos(`/cuentas/${cuentaId}`, EVENTOS, 45000);
  const [itemAccion, setItemAccion] = useState(null);
  const [cobrando, setCobrando] = useState(false);
  const [pidiendoPin, setPidiendoPin] = useState(null);

  if (cargando) {
    return (
      <>
        <Barra titulo="Cuenta" atras="/caja" />
        <EsqueletoCuenta />
      </>
    );
  }

  if (!cuenta) {
    return (
      <>
        <Barra titulo="Cuenta" atras="/caja" />
        <div className="vacio"><strong>Esa cuenta no existe</strong></div>
      </>
    );
  }

  /**
   * Abre el documento en otra pestaña. Aparte y no en un modal porque el
   * diálogo de impresión del navegador toma la pestaña entera, y así la caja
   * no pierde de vista la cuenta mientras el cliente decide.
   */
  const imprimir = (tipo) =>
    window.open(`/imprimir/${cuenta.id}?tipo=${tipo}`, '_blank', 'noopener');

  const activos = cuenta.items.filter((i) => i.estado === 'activo');
  // Lo de barra no se manda a ningún lado: el mozo lo alcanza de la heladera
  // y ya cuenta como entregado, así que no entra en el botón de cocina.
  const sinEnviar = activos.filter((i) => !i.comanda_id && !i.de_barra);
  const deBarra = activos.filter((i) => i.de_barra);
  const cerrada = ['cerrada', 'perdida', 'fusionada'].includes(cuenta.estado);
  const eti = ESTADO_CUENTA[cuenta.estado] ?? ESTADO_CUENTA.abierta;

  const hacer = async (fn, exito) => {
    try {
      await fn();
      if (exito) toast.ok(exito);
      recargar();
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    }
  };

  const agregar = (item) =>
    hacer(() => api.post(`/cuentas/${cuentaId}/items`, { items: [item], enviar: false }));

  const mandar = (urgente) =>
    hacer(() => api.post(`/cuentas/${cuentaId}/enviar`, { urgente }), 'Comanda enviada a cocina');

  const pedirDescuento = () =>
    setPidiendoPin({
      titulo: 'Aplicar un descuento',
      detalle: 'El tope sin PIN lo define el encargado en configuración.',
      motivo: true, monto: true, montoMaximo: cuenta.saldo,
      fn: ({ pin, motivo, monto }) =>
        hacer(() => api.post(`/cuentas/${cuentaId}/descuento`, { monto, motivo, pin }), 'Descuento aplicado'),
    });

  const pedirPerdida = () =>
    setPidiendoPin({
      titulo: 'Marcar como no cobrada',
      detalle: 'La venta no se borra: queda en el reporte de pérdidas con tu firma y la del encargado.',
      motivo: true,
      fn: ({ pin, motivo }) =>
        hacer(() => api.post(`/cuentas/${cuentaId}/perdida`, { motivo, pin }), 'Registrada como pérdida')
          .then((ok) => ok && navegar('/caja')),
    });

  const titulo = cuenta.mesa
    ? `${cuenta.mesa} · cuenta #${cuenta.id}`
    : `Take away #${cuenta.id}${cuenta.referencia ? ` · ${cuenta.referencia}` : ''}`;

  return (
    <>
      <Barra
        titulo={titulo}
        subtitulo={`${cuenta.comensales} comensales · ${cuenta.mozo ?? 'sin mozo'}`}
        atras="/caja"
      />

      <div className="contenido cuenta-layout">
        <section className="panel cuenta-ticket">
          <header>
            <span className="rotulo">Cuenta</span>
            <span className={`eti ${eti.clase}`}>{eti.texto}</span>
          </header>

          <div className="cuerpo pila">
            <TicketCuenta cuenta={cuenta} editable={!cerrada} onAccionItem={setItemAccion} />

            {!cerrada ? (
              <div className="pila">
                {sinEnviar.length ? (
                  <div className="fila">
                    <button className="btn btn-primario btn-grande crece" onClick={() => mandar(false)}>
                      Mandar a cocina ({sinEnviar.length})
                    </button>
                    <button
                      className="btn btn-grande btn-icono" onClick={() => mandar(true)}
                      title="Mandar como urgente: entra arriba en la cocina"
                      aria-label="Mandar como urgente"
                    >
                      <FireSimple size={20} weight="fill" />
                    </button>
                  </div>
                ) : null}

                {deBarra.length ? (
                  <p className="t12 tenue-3">
                    {deBarra.length === 1
                      ? 'Hay 1 ítem de barra que no va a cocina: lo lleva el mozo y ya está en la cuenta.'
                      : `Hay ${deBarra.length} ítems de barra que no van a cocina: los lleva el mozo y ya están en la cuenta.`}
                  </p>
                ) : null}

                <button
                  className="btn btn-ok btn-grande btn-ancho"
                  onClick={() => setCobrando(true)}
                  disabled={Number(cuenta.saldo) <= 0}
                >
                  <CheckCircle size={20} weight="bold" /> Cobrar {plata(cuenta.saldo)}
                </button>

                <div className="fila">
                  <button className="btn btn-chico crece" onClick={pedirDescuento}>
                    <Percent size={15} weight="bold" /> Descuento
                  </button>
                  <button className="btn btn-chico crece" onClick={pedirPerdida}>
                    <XCircle size={15} weight="bold" /> No cobrada
                  </button>
                </div>
                <div className="fila">
                  <button className="btn btn-chico crece" onClick={() => imprimir('ticket')}>
                    <Receipt size={15} weight="bold" /> Ticket
                  </button>
                  <button className="btn btn-chico crece" onClick={() => imprimir('factura')}>
                    <FileText size={15} weight="bold" /> Factura
                  </button>
                </div>

              </div>
            ) : (
              <div className="pila">
                <div className="fila">
                  <button className="btn crece" onClick={() => imprimir('ticket')}>
                    <Receipt size={16} weight="bold" /> Imprimir ticket
                  </button>
                  <button className="btn crece" onClick={() => imprimir('factura')}>
                    <FileText size={16} weight="bold" /> Imprimir factura
                  </button>
                </div>
                <button className="btn btn-ancho" onClick={() => navegar('/caja')}>Volver a caja</button>
              </div>
            )}
          </div>
        </section>

        {!cerrada ? (
          <section className="panel">
            <header><span className="rotulo">Cargar pedido</span></header>
            <div className="cuerpo">
              <SelectorProductos alElegir={agregar} mostrarPrecios />
            </div>
          </section>
        ) : null}
      </div>

      {itemAccion ? (
        <AccionesItem
          cuentaId={cuentaId}
          item={itemAccion}
          alCerrar={() => setItemAccion(null)}
          alListo={() => { setItemAccion(null); recargar(); }}
        />
      ) : null}

      {cobrando ? (
        <Cobrar
          cuenta={cuenta}
          alCerrar={() => setCobrando(false)}
          alListo={() => { setCobrando(false); recargar(); }}
        />
      ) : null}

      {pidiendoPin ? (
        <PedirPin
          titulo={pidiendoPin.titulo}
          detalle={pidiendoPin.detalle}
          motivoRequerido={pidiendoPin.motivo}
          montoRequerido={pidiendoPin.monto}
          montoMaximo={pidiendoPin.montoMaximo}
          alCerrar={() => setPidiendoPin(null)}
          alConfirmar={async (d) => {
            await pidiendoPin.fn(d);
            setPidiendoPin(null);
          }}
        />
      ) : null}
    </>
  );
}
