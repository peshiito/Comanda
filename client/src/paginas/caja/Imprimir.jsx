import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Printer, X } from '@phosphor-icons/react';
import { api } from '../../lib/api.js';
import Ticket80 from './Ticket80.jsx';
import FacturaAR from './FacturaAR.jsx';
import './imprimir.css';

/**
 * Vista de impresión. Se abre en una pestaña aparte y muestra el documento
 * terminado; el diálogo del navegador lo dispara el cajero con el botón.
 *
 * A propósito no se abre solo: el cajero necesita poder mirar el documento
 * antes de mandarlo al papel —que el número de mesa esté bien, que la
 * factura tenga el CUIT que le dictaron— y un modal encima no lo deja.
 *
 * Desde ese diálogo se imprime en la térmica o se elige "Guardar como PDF",
 * que es lo que se le manda al cliente por mensaje. El PDF no lo armamos en
 * el servidor porque el navegador ya lo hace, sin sumarle una dependencia ni
 * una fuente más al mini PC del local.
 */
export default function Imprimir() {
  const { cuentaId } = useParams();
  const [params] = useSearchParams();
  const tipo = params.get('tipo') === 'factura' ? 'factura' : 'ticket';
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const [emitiendo, setEmitiendo] = useState(false);
  const [letra, setLetra] = useState('factura_b');
  const [docNro, setDocNro] = useState('');
  const [receptor, setReceptor] = useState('');

  useEffect(() => {
    api
      .get(`/caja/cuentas/${cuentaId}/documento`)
      .then(setDoc)
      .catch((e) => setError(e.message));
  }, [cuentaId]);

  /**
   * `@page` no se puede condicionar con una clase, así que la regla se inyecta
   * según el documento: la térmica es un rollo continuo de 80 mm sin márgenes
   * y la factura es una A4. Sin esto, el ticket sale centrado en una hoja
   * carta con tres cuartos de papel en blanco.
   */
  useEffect(() => {
    const estilo = document.createElement('style');
    estilo.textContent =
      tipo === 'factura'
        ? '@page { size: A4 portrait; margin: 10mm; }'
        : '@page { size: 80mm auto; margin: 0; }';
    document.head.append(estilo);
    return () => estilo.remove();
  }, [tipo]);

  useEffect(() => {
    document.title = doc
      ? `${tipo === 'factura' ? 'Factura' : 'Ticket'} — ${doc.local.nombre} — cuenta ${cuentaId}`
      : 'Imprimir';
  }, [doc, tipo, cuentaId]);

  if (error) {
    return (
      <div className="imp-estado">
        <strong>No se pudo armar el documento</strong>
        <p className="t13 tenue">{error}</p>
      </div>
    );
  }

  if (!doc) return <div className="imp-estado t13 tenue">Armando el documento…</div>;

  const existe =
    tipo === 'factura'
      ? doc.comprobantes.some((c) => c.tipo.startsWith('factura'))
      : doc.comprobantes.some((c) => c.tipo === 'ticket');

  /**
   * En el local pasa todo el tiempo: se cobra, el cliente se va a ir y recién
   * ahí pide factura. Emitirla acá es lo mismo que hace la caja de cualquier
   * bodegón, y el número sale del mismo contador que si se hubiera pedido al
   * cobrar, así la numeración no queda con huecos.
   */
  const emitir = async () => {
    setEmitiendo(true);
    try {
      await api.post(`/caja/cuentas/${cuentaId}/comprobante`, {
        tipo: tipo === 'factura' ? letra : 'ticket',
        doc_tipo: tipo === 'factura' ? (docNro ? 'CUIT' : 'CF') : null,
        doc_nro: docNro || null,
        receptor: receptor.trim() || null,
      });
      setDoc(await api.get(`/caja/cuentas/${cuentaId}/documento`));
    } catch (e) {
      setError(e.message);
    } finally {
      setEmitiendo(false);
    }
  };

  if (!existe) {
    return (
      <div className="imp-estado">
        <div className="imp-emitir">
          <h1>{tipo === 'factura' ? 'Todavía no hay factura' : 'Todavía no hay ticket'}</h1>
          <p className="t13 tenue">
            Esta cuenta se cerró sin {tipo === 'factura' ? 'factura' : 'ticket'}. Se puede emitir
            ahora: el número sale del mismo contador, así la numeración no queda con huecos.
          </p>

          {tipo === 'factura' ? (
            <>
              <div className="campo">
                <span className="rotulo">Tipo</span>
                <div className="opciones">
                  {[['factura_b', 'Factura B'], ['factura_a', 'Factura A'], ['factura_c', 'Factura C']].map(
                    ([clave, texto]) => (
                      <button
                        key={clave}
                        className="pildora"
                        aria-pressed={letra === clave}
                        onClick={() => setLetra(clave)}
                      >
                        {texto}
                      </button>
                    )
                  )}
                </div>
              </div>
              <label className="campo">
                <span>CUIT o DNI del cliente</span>
                <input
                  className="mono"
                  value={docNro}
                  onChange={(e) => setDocNro(e.target.value)}
                  inputMode="numeric"
                  placeholder="30-71234567-4"
                />
                <span className="campo-ayuda">
                  Si lo dejás vacío sale a Consumidor Final.
                </span>
              </label>
              <label className="campo">
                <span>Razón social o nombre</span>
                <input
                  value={receptor}
                  onChange={(e) => setReceptor(e.target.value)}
                  maxLength={160}
                  placeholder="Estudio Contable Ortiz SRL"
                />
              </label>
            </>
          ) : null}

          <button className="btn btn-primario btn-grande btn-ancho" onClick={emitir} disabled={emitiendo}>
            {emitiendo ? 'Emitiendo…' : `Emitir ${tipo === 'factura' ? 'factura' : 'ticket'} e imprimir`}
          </button>
          <button className="btn btn-ancho" onClick={() => window.close()}>Cerrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`imp imp-${tipo}`}>
      {/* Esta barra no se imprime: es para operar la pantalla. */}
      <div className="imp-barra">
        <button className="btn btn-primario" onClick={() => window.print()}>
          <Printer size={18} weight="bold" aria-hidden="true" /> Imprimir o guardar PDF
        </button>
        <button className="btn" onClick={() => window.close()}>
          <X size={18} weight="bold" aria-hidden="true" /> Cerrar
        </button>
        <p className="t12 tenue-3">
          En el diálogo del navegador elegí “Guardar como PDF” si lo querés mandar por mensaje.
        </p>
      </div>

      <div className="imp-hoja">
        {tipo === 'factura' ? <FacturaAR doc={doc} /> : <Ticket80 doc={doc} />}
      </div>
    </div>
  );
}
