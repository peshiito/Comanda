import { useMemo, useState } from 'react';
import { Minus, Plus } from '@phosphor-icons/react';
import Modal from './Modal.jsx';
import { plata } from '../lib/formato.js';

/**
 * Pide variante, modificadores obligatorios y aclaración. No deja confirmar
 * hasta resolver los grupos obligatorios: eso es lo que mata el "yo dije a punto".
 *
 * Los grupos `por_cantidad` (los gustos de empanada) funcionan al revés que
 * los demás: en vez de elegir una opción, se reparte una cantidad entre
 * varias, y la cantidad del ítem sale de esa suma. Así una docena surtida se
 * carga como una sola línea y la cocina lee "4 carne, 4 humita, 4 verdura".
 */
export default function ElegirModificadores({ producto, grupos, mostrarPrecios, alConfirmar, alCerrar }) {
  const gruposProducto = useMemo(
    () => (producto.grupos ?? []).map((id) => grupos.find((g) => g.id === id)).filter(Boolean),
    [producto, grupos]
  );
  const grupoReparto = gruposProducto.find((g) => g.por_cantidad) ?? null;

  const [varianteId, setVarianteId] = useState(producto.variantes?.[0]?.id ?? null);
  const [elegidas, setElegidas] = useState({});
  // { opcion_id: cuántas } para el grupo de reparto
  const [reparto, setReparto] = useState({});
  const [cantidadSuelta, setCantidadSuelta] = useState(1);
  const [nota, setNota] = useState('');

  const totalReparto = Object.values(reparto).reduce((a, b) => a + b, 0);
  const cantidad = grupoReparto ? totalReparto : cantidadSuelta;

  const alternar = (grupo, opcionId) => {
    setElegidas((prev) => {
      const actual = prev[grupo.id] ?? [];
      if (actual.includes(opcionId)) return { ...prev, [grupo.id]: actual.filter((o) => o !== opcionId) };
      if (grupo.max_sel === 1) return { ...prev, [grupo.id]: [opcionId] };
      if (actual.length >= grupo.max_sel) return prev;
      return { ...prev, [grupo.id]: [...actual, opcionId] };
    });
  };

  const repartir = (opcionId, delta) => {
    setReparto((prev) => {
      const actual = prev[opcionId] ?? 0;
      const nuevo = Math.max(0, Math.min(99, actual + delta));
      // Sumar un gusto nuevo no puede pasarse del tope de gustos distintos
      if (nuevo > 0 && actual === 0) {
        const distintos = Object.values(prev).filter((n) => n > 0).length;
        if (distintos >= grupoReparto.max_sel) return prev;
      }
      const siguiente = { ...prev, [opcionId]: nuevo };
      if (!nuevo) delete siguiente[opcionId];
      return siguiente;
    });
  };

  const faltan = gruposProducto.filter((g) => {
    if (g.por_cantidad) return totalReparto < Math.max(g.min_sel, g.obligatorio ? 1 : 0);
    const minimo = g.obligatorio ? Math.max(g.min_sel, 1) : g.min_sel;
    return (elegidas[g.id]?.length ?? 0) < minimo;
  });

  const precioBase = Number(
    producto.variantes?.find((v) => v.id === varianteId)?.precio ?? producto.precio
  );

  const opcionesDeGrupos = gruposProducto.flatMap((g) => g.opciones);
  const buscarOpcion = (id) => opcionesDeGrupos.find((o) => o.id === id);

  // Los deltas normales se pagan por unidad del ítem; los del reparto ya
  // traen su propia cantidad y se suman una vez.
  const extrasPorUnidad = Object.values(elegidas)
    .flat()
    .reduce((acc, id) => acc + Number(buscarOpcion(id)?.delta_precio ?? 0), 0);
  const extrasFijos = Object.entries(reparto).reduce(
    (acc, [id, n]) => acc + Number(buscarOpcion(Number(id))?.delta_precio ?? 0) * n,
    0
  );
  const totalLinea = (precioBase + extrasPorUnidad) * cantidad + extrasFijos;

  const confirmar = () => {
    if (faltan.length || cantidad < 1) return;
    alConfirmar({
      producto_id: producto.id,
      variante_id: varianteId,
      cantidad,
      nota: nota.trim() || null,
      opcion_ids: [...Object.values(elegidas).flat(), ...Object.keys(reparto).map(Number)],
      opcion_cant: Object.entries(reparto).map(([id, n]) => ({
        opcion_id: Number(id),
        cantidad: n,
      })),
    });
  };

  return (
    <Modal
      titulo={producto.nombre}
      descripcion={producto.descripcion || undefined}
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn" onClick={alCerrar}>Cancelar</button>
          <button
            className="btn btn-primario"
            onClick={confirmar}
            disabled={faltan.length > 0 || cantidad < 1}
          >
            {faltan.length
              ? `Falta ${faltan[0].nombre.toLowerCase()}`
              : cantidad < 1
                ? 'Elegí cuántas'
                : `Agregar ${cantidad}${mostrarPrecios ? ` · ${plata(totalLinea)}` : ''}`}
          </button>
        </>
      }
    >
      <div className="pila" style={{ gap: 'var(--e5)' }}>
        {producto.variantes?.length > 1 ? (
          <div className="campo">
            <span className="rotulo">Tamaño</span>
            <div className="opciones">
              {producto.variantes.map((v) => (
                <button
                  key={v.id}
                  className="pildora"
                  aria-pressed={varianteId === v.id}
                  onClick={() => setVarianteId(v.id)}
                >
                  {v.nombre}
                  {mostrarPrecios ? <span className="mono t12"> {plata(v.precio)}</span> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {gruposProducto.map((g) =>
          g.por_cantidad ? (
            <div className="campo" key={g.id}>
              <span className="fila-sep">
                <span className="rotulo">{g.nombre}</span>
                <span className={`eti ${totalReparto ? 'eti-verde' : 'eti-amarilla'}`}>
                  {totalReparto ? `${totalReparto} en total` : 'elegí cuántas de cada uno'}
                </span>
              </span>
              <div className="reparto">
                {g.opciones.map((o) => {
                  const n = reparto[o.id] ?? 0;
                  return (
                    <div className={`reparto-fila${n ? ' con-cantidad' : ''}`} key={o.id}>
                      <span className="crece">
                        {o.nombre}
                        {Number(o.delta_precio) !== 0 && mostrarPrecios ? (
                          <span className="mono t12 tenue-3"> +{plata(o.delta_precio)} c/u</span>
                        ) : null}
                      </span>
                      <span className="contador">
                        <button
                          className="btn btn-icono btn-chico"
                          onClick={() => repartir(o.id, -1)}
                          disabled={!n}
                          aria-label={`Una menos de ${o.nombre}`}
                        >
                          <Minus size={15} weight="bold" />
                        </button>
                        <span className="reparto-n mono" aria-label={`${n} de ${o.nombre}`}>{n}</span>
                        <button
                          className="btn btn-icono btn-chico"
                          onClick={() => repartir(o.id, 1)}
                          aria-label={`Una más de ${o.nombre}`}
                        >
                          <Plus size={15} weight="bold" />
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
              <span className="campo-ayuda">
                Hasta {g.max_sel} gustos distintos. La cantidad del pedido sale de esta suma.
              </span>
            </div>
          ) : (
            <div className="campo" key={g.id}>
              <span className="fila" style={{ gap: 'var(--e2)' }}>
                <span className="rotulo">{g.nombre}</span>
                {g.obligatorio ? (
                  <span className={`eti ${faltan.includes(g) ? 'eti-amarilla' : 'eti-verde'}`}>
                    {faltan.includes(g) ? 'falta elegir' : 'listo'}
                  </span>
                ) : g.max_sel > 1 ? (
                  <span className="t11 tenue-3">hasta {g.max_sel}</span>
                ) : null}
              </span>
              <div className="opciones">
                {g.opciones.map((o) => (
                  <button
                    key={o.id}
                    className="pildora"
                    aria-pressed={(elegidas[g.id] ?? []).includes(o.id)}
                    onClick={() => alternar(g, o.id)}
                  >
                    {o.nombre}
                    {Number(o.delta_precio) !== 0 && mostrarPrecios ? (
                      <span className="mono t12"> +{plata(o.delta_precio)}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          )
        )}

        <label className="campo">
          <span className="rotulo">Aclaración para la cocina</span>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="sin sal, para compartir, que salga primero…"
            maxLength={200}
          />
        </label>

        {grupoReparto ? null : (
          <div className="campo">
            <span className="rotulo">Cantidad</span>
            <div className="contador">
              <button className="btn btn-icono" onClick={() => setCantidadSuelta((c) => Math.max(1, c - 1))} aria-label="Uno menos">
                <Minus size={18} weight="bold" />
              </button>
              <input
                type="number" min="1" max="99" value={cantidadSuelta}
                onChange={(e) => setCantidadSuelta(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                aria-label="Cantidad"
              />
              <button className="btn btn-icono" onClick={() => setCantidadSuelta((c) => Math.min(99, c + 1))} aria-label="Uno más">
                <Plus size={18} weight="bold" />
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
