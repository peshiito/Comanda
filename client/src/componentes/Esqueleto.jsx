import './esqueleto.css';

/**
 * Esqueletos de carga. Nunca una pantalla en blanco ni un "Cargando…":
 * la forma de lo que viene ya está dibujada, así el salto al contenido real
 * no mueve nada de lugar.
 */
export function Bloque({ ancho = '100%', alto = 14, radio, style }) {
  return (
    <span
      className="esq"
      aria-hidden="true"
      style={{ width: ancho, height: alto, borderRadius: radio ?? 'var(--r1)', ...style }}
    />
  );
}

/* Siluetas del plano: mismas posiciones y formas que siembra el local, para
   que al llegar los datos no se mueva nada de lugar. */
const SILUETAS = [
  [48, 60, 92, 92], [48, 176, 92, 92], [48, 292, 92, 92], [48, 408, 92, 92],
  [236, 64, 140, 96], [236, 212, 140, 96], [236, 360, 140, 96],
  [424, 64, 140, 96], [424, 212, 140, 96], [424, 360, 140, 96],
  [612, 64, 140, 96], [612, 212, 140, 96], [612, 360, 140, 96],
  [812, 64, 132, 132], [812, 216, 132, 132], [812, 396, 132, 132],
  [236, 496, 132, 132], [452, 496, 132, 132],
];

export function EsqueletoSalon({ mesas = 12 }) {
  return (
    <div className="contenido pila vista-plano" aria-busy="true" aria-live="polite">
      <span className="solo-lector">Cargando el salón</span>
      <div className="panel">
        <header><Bloque ancho="120px" alto={12} /></header>
        <div className="cuerpo pila-2">
          {[0, 1].map((i) => (
            <div className="fila" key={i}>
              <Bloque ancho="64px" alto={22} radio="var(--r-pill)" />
              <Bloque ancho={`${45 + i * 12}%`} alto={13} />
            </div>
          ))}
        </div>
      </div>
      <div className="plano-marco">
        <div className="plano" style={{ width: 1000, height: 620 }}>
          {SILUETAS.map(([x, y, ancho, alto], i) => (
            <Bloque
              key={i}
              ancho={`${ancho}px`}
              alto={alto}
              radio={ancho === alto && ancho > 100 ? '50%' : 'var(--r2)'}
              style={{ position: 'absolute', left: x, top: y }}
            />
          ))}
        </div>
      </div>

      <div className="mesas">
        {Array.from({ length: mesas }, (_, i) => (
          <div className="mesa mesa-esq" key={i}>
            <div className="fila-sep">
              <Bloque ancho="34px" alto={26} />
              <Bloque ancho="58px" alto={18} radio="var(--r-pill)" />
            </div>
            <Bloque ancho="70%" alto={12} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EsqueletoKds({ tickets = 4 }) {
  return (
    <div className="kds" aria-busy="true" aria-live="polite">
      <span className="solo-lector">Cargando comandas</span>
      {Array.from({ length: tickets }, (_, i) => (
        <article className="comanda comanda-esq" key={i}>
          <header>
            <Bloque ancho="140px" alto={26} />
            <Bloque ancho="56px" alto={26} />
          </header>
          <div className="pila-2" style={{ marginTop: 'var(--e3)' }}>
            {Array.from({ length: 2 + (i % 3) }, (_, j) => (
              <div key={j} className="pila-2">
                <Bloque ancho={`${60 + ((j * 13) % 30)}%`} alto={20} />
                <Bloque ancho="40%" alto={13} />
              </div>
            ))}
          </div>
          <Bloque alto={70} radio="var(--r2)" style={{ marginTop: 'var(--e3)' }} />
        </article>
      ))}
    </div>
  );
}

export function EsqueletoCuenta() {
  return (
    <div className="contenido cuenta-layout" aria-busy="true" aria-live="polite">
      <span className="solo-lector">Cargando la cuenta</span>
      <section className="panel">
        <header><Bloque ancho="160px" alto={12} /><Bloque ancho="70px" alto={20} radio="var(--r-pill)" /></header>
        <div className="cuerpo pila">
          {[0, 1, 2].map((i) => (
            <div className="fila fila-arriba" key={i}>
              <Bloque ancho="28px" alto={16} />
              <div className="crece pila-2">
                <Bloque ancho={`${55 + i * 10}%`} alto={15} />
                <Bloque ancho="35%" alto={12} />
              </div>
              <Bloque ancho="74px" alto={15} />
            </div>
          ))}
          <div className="pila-2" style={{ marginTop: 'var(--e3)' }}>
            <Bloque alto={16} />
            <Bloque ancho="60%" alto={16} />
            <Bloque alto={34} radio="var(--r2)" style={{ marginTop: 'var(--e2)' }} />
          </div>
          <Bloque alto={56} radio="var(--r2)" />
        </div>
      </section>
      <section className="panel">
        <header><Bloque ancho="120px" alto={12} /></header>
        <div className="cuerpo pila">
          <Bloque alto={44} radio="var(--r2)" />
          <div className="grilla-productos">
            {Array.from({ length: 9 }, (_, i) => (
              <Bloque key={i} alto={76} radio="var(--r2)" />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function EsqueletoLista({ filas = 4, conCabecera = true }) {
  return (
    <section className="panel" aria-busy="true">
      {conCabecera ? <header><Bloque ancho="130px" alto={12} /></header> : null}
      <div className="cuerpo pila">
        {Array.from({ length: filas }, (_, i) => (
          <div className="tarjeta fila" key={i}>
            <div className="crece pila-2">
              <Bloque ancho={`${40 + ((i * 17) % 35)}%`} alto={15} />
              <Bloque ancho="55%" alto={12} />
            </div>
            <Bloque ancho="80px" alto={20} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function EsqueletoReportes() {
  return (
    <div className="pila" aria-busy="true" aria-live="polite">
      <span className="solo-lector">Cargando reportes</span>
      <div className="rejilla-kpi">
        {Array.from({ length: 4 }, (_, i) => (
          <div className="tarjeta pila-2" key={i}>
            <Bloque ancho="60%" alto={11} />
            <Bloque ancho="75%" alto={28} />
          </div>
        ))}
      </div>
      {[0, 1].map((i) => (
        <section className="panel" key={i}>
          <header><Bloque ancho="110px" alto={12} /></header>
          <div className="cuerpo pila-2">
            {Array.from({ length: 5 }, (_, j) => (
              <div className="pila-2" key={j}>
                <div className="fila-sep">
                  <Bloque ancho={`${30 + ((j * 11) % 30)}%`} alto={12} />
                  <Bloque ancho="70px" alto={12} />
                </div>
                <Bloque alto={6} radio="var(--r-pill)" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
