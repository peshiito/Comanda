import { plata } from '../lib/formato.js';

/** Número grande con su rótulo: la unidad de los reportes. */
export function Kpi({ rotulo, valor, pie }) {
  return (
    <div className="kpi">
      <span className="rotulo">{rotulo}</span>
      <span className="kpi-valor">{valor}</span>
      {pie ? <span className="kpi-pie">{pie}</span> : null}
    </div>
  );
}

/**
 * Barras proporcionales en un solo color. El color acá no significa nada
 * —es una comparación de magnitudes—, así que no gasta el semáforo.
 */
export function Barras({ filas, etiqueta, valor, formato = plata, vacio = 'Sin datos en el período.' }) {
  if (!filas.length) return <p className="t13 tenue-3">{vacio}</p>;
  const max = Math.max(...filas.map((f) => Number(f[valor]) || 0), 1);

  return (
    <div className="pila-2">
      {filas.map((f, i) => (
        <div className="barra-dato" key={i}>
          <div className="fila-sep">
            <span className="cortar">{f[etiqueta]}</span>
            <span className="mono tenue">{formato(f[valor])}</span>
          </div>
          <div className="medidor">
            <div style={{ width: `${((Number(f[valor]) || 0) / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Tabla simple con cabecera; las columnas numéricas van alineadas a la derecha. */
export function Tabla({ columnas, filas, clave, vacio = 'Sin datos.' }) {
  if (!filas.length) return <p className="t13 tenue-3">{vacio}</p>;
  return (
    <div className="tabla-scroll">
      <table className="tabla">
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.campo} className={c.derecha ? 'derecha' : undefined}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={clave ? f[clave] : i}>
              {columnas.map((c) => (
                <td
                  key={c.campo}
                  className={`${c.derecha ? 'derecha ' : ''}${c.mono ? 'mono ' : ''}${c.chico ? 't12 tenue' : ''}`.trim()}
                >
                  {c.render ? c.render(f) : f[c.campo]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
