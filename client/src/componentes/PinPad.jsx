import { useEffect } from 'react';
import { Backspace } from '@phosphor-icons/react';
import './pinpad.css';

/** Teclado numérico grande: se usa con una mano, caminando y sin mirar. */
export default function PinPad({ valor, alCambiar, alConfirmar, largo = 6, deshabilitado }) {
  const tocar = (d) => {
    if (valor.length < largo) alCambiar(valor + d);
  };

  useEffect(() => {
    const alTeclear = (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (/^\d$/.test(e.key)) tocar(e.key);
      else if (e.key === 'Backspace') alCambiar(valor.slice(0, -1));
      else if (e.key === 'Enter' && valor.length >= 4) alConfirmar?.();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  });

  return (
    <div className="pinpad">
      <div className="pinpad-puntos" role="status" aria-label={`${valor.length} de ${largo} dígitos`}>
        {Array.from({ length: largo }, (_, i) => (
          <span key={i} className={i < valor.length ? 'punto-pin lleno' : 'punto-pin'} />
        ))}
      </div>

      <div className="pinpad-teclas">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button
            key={d} type="button" className="btn tecla"
            onClick={() => tocar(String(d))} disabled={deshabilitado}
          >
            {d}
          </button>
        ))}
        <button
          type="button" className="btn tecla btn-plano" onClick={() => alCambiar('')}
          disabled={deshabilitado || !valor} aria-label="Borrar todo"
        >
          C
        </button>
        <button type="button" className="btn tecla" onClick={() => tocar('0')} disabled={deshabilitado}>
          0
        </button>
        <button
          type="button" className="btn tecla btn-plano" onClick={() => alCambiar(valor.slice(0, -1))}
          disabled={deshabilitado || !valor} aria-label="Borrar un dígito"
        >
          <Backspace size={22} />
        </button>
      </div>
    </div>
  );
}
