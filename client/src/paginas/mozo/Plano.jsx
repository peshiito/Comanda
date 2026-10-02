import { BellRinging, Clock, Users } from '@phosphor-icons/react';
import { ETIQUETA_ESTADO, duracion, hora, plata, soloNumero } from '../../lib/formato.js';

/** El lienzo es el mismo en el que se guardan pos_x y pos_y de cada mesa. */
const ANCHO = 1000;
const ALTO = 620;

/**
 * Forma y tamaño vienen guardados en la mesa: los dibujó el encargado desde
 * Salón → Editar. Antes se deducían de la capacidad, pero una mesa de seis
 * contra la pared es larga y angosta y otra de seis en el medio es redonda,
 * así que la capacidad sola no alcanzaba para que el plano se pareciera a la
 * sala de verdad.
 */
const figura = (m) => ({ ancho: m.ancho, alto: m.alto, forma: m.forma });

/**
 * Plano del salón: las mesas donde están de verdad, no en una grilla.
 * Sólo escritorio — en el celular la lista se toca mejor.
 */
export default function Plano({ mesas, zonas = [], esCaja, alElegir }) {
  const porNombre = new Map(mesas.map((m) => [m.nombre, m]));

  // Recuadro punteado que abraza a una mesa con sus satélites
  const uniones = mesas
    .filter((m) => m.satelites.length)
    .map((m) => {
      const partes = [m, ...m.satelites.map((n) => porNombre.get(n)).filter(Boolean)];
      const cajas = partes.map((p) => ({ ...figura(p), x: p.pos_x, y: p.pos_y }));
      const x1 = Math.min(...cajas.map((c) => c.x));
      const y1 = Math.min(...cajas.map((c) => c.y));
      const x2 = Math.max(...cajas.map((c) => c.x + c.ancho));
      const y2 = Math.max(...cajas.map((c) => c.y + c.alto));
      return {
        id: m.id,
        etiqueta: partes.map((p) => soloNumero(p.nombre)).join('+'),
        x: x1 - 12,
        y: y1 - 12,
        ancho: x2 - x1 + 24,
        alto: y2 - y1 + 24,
      };
    });

  return (
    <div className="plano-marco">
      <div className="plano" style={{ width: ANCHO, height: ALTO }}>
        {/* Barra, recepción, puertas: van atrás y no se tocan. Orientan al
            mozo nuevo, que es para lo único que están. */}
        {zonas.map((z) => (
          <div
            key={`z${z.id}`}
            className={`plano-zona zona-${z.tipo}`}
            style={{ left: z.pos_x, top: z.pos_y, width: z.ancho, height: z.alto }}
            aria-hidden="true"
          >
            <span className="plano-zona-nombre">{z.nombre}</span>
          </div>
        ))}

        {uniones.map((u) => (
          <div
            key={`u${u.id}`}
            className="plano-union"
            style={{ left: u.x, top: u.y, width: u.ancho, height: u.alto }}
          >
            <span className="plano-union-eti">Unidas · {u.etiqueta}</span>
          </div>
        ))}

        {mesas.map((m) => {
          const eti = ETIQUETA_ESTADO[m.estado] ?? ETIQUETA_ESTADO.libre;
          const { ancho, alto, forma } = figura(m);
          const unida = m.estado === 'unida';
          const listo = m.cuentas.some((c) => c.comandas_listas > 0);
          const total = m.cuentas.reduce((t, c) => t + Number(c.total ?? 0), 0);

          return (
            <button
              key={m.id}
              className={`plano-mesa plano-${forma} mesa-${m.estado}${listo ? ' mesa-listo' : ''}`}
              style={{ left: m.pos_x, top: m.pos_y, width: ancho, height: alto }}
              onClick={() => alElegir(m)}
              disabled={unida}
              aria-label={`${m.nombre}, ${eti.texto}, ${m.capacidad} lugares`}
            >
              <span className={`plano-numero${/^\d+$/.test(soloNumero(m.nombre)) ? '' : ' plano-texto'}`}>
                {soloNumero(m.nombre)}
              </span>

              {m.cuentas.length ? (
                <span className="plano-dato">
                  {esCaja && total > 0 ? <strong className="mono">{plata(total)}</strong> : null}
                  <span className="fila" style={{ gap: 3 }}>
                    <Clock size={11} weight="bold" aria-hidden="true" />
                    <span className="mono">{duracion(m.minutos)}</span>
                  </span>
                </span>
              ) : m.reserva ? (
                <span className="plano-dato cortar">
                  {hora(m.reserva.hora)} {m.reserva.nombre.split(' ')[0]}
                </span>
              ) : (
                <span className="plano-dato tenue-4 fila" style={{ gap: 3 }}>
                  <Users size={11} weight="bold" aria-hidden="true" />
                  {m.capacidad}
                </span>
              )}

              {listo ? (
                <span className="plano-campana" title="Plato listo">
                  <BellRinging size={13} weight="fill" aria-hidden="true" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <ul className="plano-refe" aria-label="Referencia de estados">
        {['libre', 'ocupada_sin_pedido', 'en_cocina', 'por_cobrar', 'reservada'].map((e) => (
          <li key={e}>
            <span className={`plano-refe-punto mesa-${e}`} aria-hidden="true" />
            {(ETIQUETA_ESTADO[e] ?? ETIQUETA_ESTADO.libre).texto}
          </li>
        ))}
      </ul>
    </div>
  );
}
