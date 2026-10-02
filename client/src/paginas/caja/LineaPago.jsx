import { X } from '@phosphor-icons/react';
import { MEDIOS } from '../../lib/formato.js';

/**
 * Un pago de la cuenta. Son varios registros contra una misma cuenta y no un
 * campo "forma de pago": sin eso, el que se va antes de pagar rompe el arqueo.
 */
export default function LineaPago({ linea, indice, unica, onCambiar, onQuitar }) {
  return (
    <div className="tarjeta pago-tarjeta">
      <div className="fila-sep">
        <span className="rotulo">Pago {unica ? '' : indice + 1}</span>
        {!unica ? (
          <button
            className="btn btn-plano btn-chico btn-icono"
            onClick={onQuitar}
            aria-label={`Quitar el pago ${indice + 1}`}
          >
            <X size={15} />
          </button>
        ) : null}
      </div>

      <div className="medios">
        {Object.entries(MEDIOS).map(([clave, texto]) => (
          <button
            key={clave}
            className="pildora"
            aria-pressed={linea.medio === clave}
            onClick={() => onCambiar('medio', clave)}
          >
            {texto}
          </button>
        ))}
      </div>

      <div className="pago-linea">
        <label className="campo crece">
          <span>Monto</span>
          <input
            className="mono" type="number" step="0.01" value={linea.monto}
            onChange={(e) => onCambiar('monto', e.target.value)}
          />
        </label>

        {linea.medio === 'efectivo' ? (
          <label className="campo crece">
            <span>Con cuánto paga</span>
            <input
              className="mono" type="number" step="0.01" value={linea.recibido}
              onChange={(e) => onCambiar('recibido', e.target.value)} placeholder="—"
            />
          </label>
        ) : (
          <label className="campo crece">
            <span>Referencia</span>
            <input
              value={linea.referencia ?? ''}
              onChange={(e) => onCambiar('referencia', e.target.value)}
              placeholder="lote / últimos 4"
            />
          </label>
        )}
      </div>
    </div>
  );
}
