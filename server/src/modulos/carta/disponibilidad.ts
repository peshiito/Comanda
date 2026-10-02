import { consultarUna, ejecutar, pool, type Ejecutor } from '../../db/pool.js';
import { noEncontrado } from '../../utils/errores.js';
import { auditar } from '../../servicios/auditoria.js';
import { emitir } from '../../sockets/index.js';
import type { UsuarioToken } from '../../types/express.js';

/**
 * Dos alcances distintos a propósito:
 *  - 'hoy'  → se restaura solo al abrir el próximo turno de caja.
 *  - 'baja' → queda oculto hasta que alguien lo reactive a mano.
 * Con un solo botón, el bife queda tachado tres semanas.
 */
export async function marcarAgotado(
  productoId: number,
  agotado: boolean,
  alcance: 'hoy' | 'baja',
  actor: UsuarioToken
) {
  const p = await consultarUna<{ nombre: string }>(
    pool,
    'SELECT nombre FROM productos WHERE id = ?',
    [productoId]
  );
  if (!p) throw noEncontrado('Producto no encontrado');

  if (alcance === 'baja') {
    await ejecutar(pool, 'UPDATE productos SET activo = ?, agotado_hoy = 0 WHERE id = ?', [
      agotado ? 0 : 1,
      productoId,
    ]);
  } else {
    await ejecutar(pool, 'UPDATE productos SET agotado_hoy = ? WHERE id = ?', [
      agotado ? 1 : 0,
      productoId,
    ]);
  }

  await auditar({
    actor,
    accion: agotado ? 'producto_agotado' : 'producto_repuesto',
    entidad: 'producto',
    entidad_id: productoId,
    datos: { nombre: p.nombre, alcance },
  });

  emitir(['caja', 'cocina', 'salon'], 'carta:cambio', {
    producto_id: productoId,
    agotado,
    alcance,
    nombre: p.nombre,
  });

  return { id: productoId, agotado, alcance };
}

export async function definirStock(
  productoId: number,
  stock: number | null,
  actor: UsuarioToken
) {
  const res = await ejecutar(pool, 'UPDATE productos SET stock_restante = ? WHERE id = ?', [
    stock,
    productoId,
  ]);
  if (!res.affectedRows) throw noEncontrado('Producto no encontrado');
  await auditar({
    actor, accion: 'stock_definido', entidad: 'producto', entidad_id: productoId,
    datos: { stock_restante: stock },
  });
  emitir(['caja', 'cocina'], 'carta:cambio', { producto_id: productoId, stock });
  return { id: productoId, stock_restante: stock };
}

/** Descuenta el contador del plato del día al vender. */
export async function descontarStock(
  ejecutor: Ejecutor,
  productoId: number,
  cantidad: number
): Promise<void> {
  await ejecutar(
    ejecutor,
    `UPDATE productos SET stock_restante = GREATEST(stock_restante - ?, 0)
     WHERE id = ? AND stock_restante IS NOT NULL`,
    [cantidad, productoId]
  );
}

/** Se llama al abrir turno de caja: limpia los agotados del día anterior. */
export async function limpiarAgotadosDelDia(ejecutor: Ejecutor = pool): Promise<number> {
  const res = await ejecutar(ejecutor, 'UPDATE productos SET agotado_hoy = 0 WHERE agotado_hoy = 1');
  return res.affectedRows;
}
