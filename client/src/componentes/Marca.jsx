/**
 * Comanda — marca del sistema.
 * El signo es una comanda: papel con el borde inferior dentado, dos renglones
 * escritos y la marca de "listo". Se lee a 16px y a 200px.
 */
export function Isotipo({ tamano = 28, titulo }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 32 32"
      fill="none"
      role={titulo ? 'img' : 'presentation'}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
    >
      <path
        d="M5 4.5a1.5 1.5 0 0 1 1.5-1.5h19A1.5 1.5 0 0 1 27 4.5v20.2c0 .7-.8 1.1-1.4.7l-2.3-1.6a1.5 1.5 0 0 0-1.7 0l-2.3 1.6a1.5 1.5 0 0 1-1.7 0l-2.3-1.6a1.5 1.5 0 0 0-1.7 0l-2.3 1.6a1.5 1.5 0 0 1-1.7 0l-2.3-1.6a1.5 1.5 0 0 0-1.7 0l-.2.1V4.5Z"
        fill="currentColor"
        opacity="0.14"
      />
      <path
        d="M5.5 4.5A1.5 1.5 0 0 1 7 3h18a1.5 1.5 0 0 1 1.5 1.5v20.9c0 .6-.7 1-1.2.6l-2.1-1.5a1.5 1.5 0 0 0-1.8 0l-2 1.4a1.5 1.5 0 0 1-1.8 0l-2-1.4a1.5 1.5 0 0 0-1.8 0l-2 1.4a1.5 1.5 0 0 1-1.8 0l-2-1.4a1.5 1.5 0 0 0-1.8 0l-2.1 1.5c-.5.4-1.2 0-1.2-.6V4.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10 10.5h12M10 15h7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function Marca({ tamano = 28, conNombre = true, subtitulo }) {
  return (
    <span className="marca" style={{ '--marca-tam': `${tamano}px` }}>
      <span className="marca-signo">
        <Isotipo tamano={tamano} titulo="Comanda" />
      </span>
      {conNombre ? (
        <span className="marca-texto">
          <strong>Comanda</strong>
          {subtitulo ? <span className="marca-sub">{subtitulo}</span> : null}
        </span>
      ) : null}
    </span>
  );
}
