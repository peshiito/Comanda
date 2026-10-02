import { useEffect, useRef } from 'react';
import { X } from '@phosphor-icons/react';

const FOCO =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Modal con foco atrapado, cierre con Escape y scroll bloqueado detrás. */
export default function Modal({ titulo, descripcion, children, pie, alCerrar, ancho = false }) {
  const caja = useRef(null);

  /**
   * `alCerrar` llega como función inline desde cada pantalla, así que cambia
   * de identidad en CADA render. Si el efecto de abajo dependiera de ella, se
   * desarmaría y rearmaría con cada tecla que escribís, y su primera línea
   * vuelve a enfocar el primer campo del formulario: escribías una letra del
   * email y el cursor saltaba de vuelta al nombre.
   *
   * Guardándola en un ref, el efecto corre UNA vez al abrir y el manejador
   * sigue llamando siempre a la última versión.
   */
  const cerrar = useRef(alCerrar);
  cerrar.current = alCerrar;

  useEffect(() => {
    const previo = document.activeElement;

    const alTeclear = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cerrar.current?.();
        return;
      }
      if (e.key !== 'Tab' || !caja.current) return;
      const foco = [...caja.current.querySelectorAll(FOCO)];
      if (!foco.length) return;
      const [primero, ultimo] = [foco[0], foco[foco.length - 1]];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener('keydown', alTeclear);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const primerCampo = caja.current?.querySelector('input:not([type="hidden"]), textarea, select');
    (primerCampo ?? caja.current?.querySelector('button'))?.focus();

    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = overflow;
      previo?.focus?.();
    };
    // Sólo al abrir y al cerrar: ver el comentario del ref de arriba.
  }, []);

  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && alCerrar?.()}>
      <div
        className={`modal${ancho ? ' ancho' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        ref={caja}
      >
        <header>
          <div className="pila-2" style={{ gap: 2 }}>
            <h2>{titulo}</h2>
            {descripcion ? <p className="t12 tenue-3">{descripcion}</p> : null}
          </div>
          <button className="btn btn-plano btn-chico btn-icono" onClick={alCerrar} aria-label="Cerrar">
            <X size={17} />
          </button>
        </header>
        <div className="cuerpo">{children}</div>
        {pie ? <footer>{pie}</footer> : null}
      </div>
    </div>
  );
}
