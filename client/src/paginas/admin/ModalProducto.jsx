import Modal from '../../componentes/Modal.jsx';

const APTOS = [
  ['visible_qr', 'En carta QR'],
  ['apto_celiaco', 'Sin TACC'],
  ['apto_vegetariano', 'Vegetariano'],
  ['apto_vegano', 'Vegano'],
  // Apagado = sale de la barra y no genera comanda: el mozo lo alcanza.
  ['va_a_cocina', 'Va a cocina'],
];

/** Alta y edición de un producto. El precio queda auditado al guardarse. */
export default function ModalProducto({ producto, categorias, onCambiar, onGuardar, onCerrar }) {
  const set = (campo, valor) => onCambiar({ ...producto, [campo]: valor });

  return (
    <Modal
      titulo={producto.id ? 'Editar producto' : 'Nuevo producto'}
      descripcion={producto.id ? 'Cambiar el precio queda registrado con tu nombre y la hora.' : undefined}
      alCerrar={onCerrar}
      pie={
        <>
          <button className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primario" onClick={onGuardar} disabled={!producto.nombre}>
            Guardar
          </button>
        </>
      }
    >
      <div className="pila">
        <label className="campo">
          <span>Nombre</span>
          <input value={producto.nombre} onChange={(e) => set('nombre', e.target.value)} autoFocus />
        </label>

        <label className="campo">
          <span>Categoría</span>
          <select value={producto.categoria_id} onChange={(e) => set('categoria_id', Number(e.target.value))}>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>

        <div className="fila">
          <label className="campo crece">
            <span>Precio</span>
            <input
              className="mono" type="number" step="100" value={producto.precio}
              onChange={(e) => set('precio', Number(e.target.value))}
            />
          </label>
          <label className="campo crece">
            <span>Costo</span>
            <input
              className="mono" type="number" step="100" value={producto.costo}
              onChange={(e) => set('costo', Number(e.target.value))}
            />
          </label>
          <label className="campo">
            <span>IVA %</span>
            <input
              className="mono" type="number" step="0.5" value={producto.iva_alicuota}
              onChange={(e) => set('iva_alicuota', Number(e.target.value))}
            />
          </label>
        </div>

        <label className="campo">
          <span>Código corto</span>
          <input
            className="mono" maxLength={8} value={producto.codigo_corto}
            onChange={(e) => set('codigo_corto', e.target.value)}
          />
          <span className="campo-ayuda">Para que caja lo cargue tipeando el número y Enter.</span>
        </label>

        <label className="campo">
          <span>Descripción</span>
          <input value={producto.descripcion} onChange={(e) => set('descripcion', e.target.value)} />
          <span className="campo-ayuda">Se ve en la carta QR del cliente.</span>
        </label>

        <div className="fila">
          <label className="campo crece">
            <span>Disponible desde</span>
            <input type="time" value={producto.horario_desde} onChange={(e) => set('horario_desde', e.target.value)} />
          </label>
          <label className="campo crece">
            <span>hasta</span>
            <input type="time" value={producto.horario_hasta} onChange={(e) => set('horario_hasta', e.target.value)} />
          </label>
        </div>

        <div className="campo">
          <span className="rotulo">Marcas</span>
          <div className="opciones">
            {APTOS.map(([clave, texto]) => (
              <button
                key={clave} className="pildora" aria-pressed={Boolean(producto[clave])}
                onClick={() => set(clave, !producto[clave])}
              >
                {texto}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Engancha grupos de modificadores al producto. Se comparten por referencia. */
export function ModalGrupos({ producto, grupos, elegidos, onCambiar, onGuardar, onCerrar }) {
  return (
    <Modal
      titulo={`Modificadores de ${producto.nombre}`}
      descripcion="Los grupos existen una sola vez: si cambiás “Punto de carne”, cambia en todos los cortes."
      alCerrar={onCerrar}
      pie={
        <>
          <button className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primario" onClick={onGuardar}>Guardar</button>
        </>
      }
    >
      <div className="pila-2">
        {grupos.map((g) => (
          <button
            key={g.id}
            className={`btn fila-sep${elegidos.includes(g.id) ? ' btn-primario' : ''}`}
            onClick={() =>
              onCambiar(elegidos.includes(g.id) ? elegidos.filter((x) => x !== g.id) : [...elegidos, g.id])
            }
          >
            <span>{g.nombre}</span>
            <span className="t12">
              {g.obligatorio ? 'obligatorio' : 'opcional'} · {g.opciones.length} opciones
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
