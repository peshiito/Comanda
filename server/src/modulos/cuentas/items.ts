import { consultar, ejecutar, pool, transaccion, type Ejecutor } from '../../db/pool.js';
import { conflicto } from '../../utils/errores.js';
import { auditar } from '../../servicios/auditoria.js';
import { emitir } from '../../sockets/index.js';
import { descontarStock } from '../carta/disponibilidad.js';
import { avisarComandaNueva, crearComanda } from '../comandas/servicio.js';
import { armarItem, type ItemArmado, type ItemPedido } from './armar-item.js';
import { bloquearCuenta, recalcular } from './totales.js';
import type { UsuarioToken } from '../../types/express.js';
import type { z } from 'zod';
import type { agregarItemsSchema } from './esquemas.js';

type Agregar = z.infer<typeof agregarItemsSchema>;

async function insertarItem(
  ejecutor: Ejecutor,
  cuentaId: number,
  item: ItemArmado,
  actor: UsuarioToken,
  autorPedido: number | null
): Promise<number> {
  const res = await ejecutar(
    ejecutor,
    `INSERT INTO cuenta_items
       (cuenta_id, producto_id, variante_id, nombre_snapshot, precio_snapshot, iva_snapshot,
        cantidad, mods_total, total_linea, nota, cargado_por, autor_pedido, de_barra)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cuentaId, item.producto_id, item.variante_id, item.nombre_snapshot, item.precio_snapshot,
      item.iva_snapshot, item.cantidad, item.mods_total, item.total_linea, item.nota,
      actor.id, autorPedido, item.de_barra ? 1 : 0,
    ]
  );
  for (const m of item.mods) {
    await ejecutar(
      ejecutor,
      `INSERT INTO cuenta_item_mods
         (item_id, opcion_id, grupo_nombre, nombre_snapshot, delta_snapshot, cantidad)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [res.insertId, m.opcion_id, m.grupo_nombre, m.nombre, m.delta, m.cantidad]
    );
  }
  await descontarStock(ejecutor, item.producto_id, item.cantidad);
  return res.insertId;
}

/**
 * Carga ítems en la cuenta. Solo caja y encargado llegan acá: el mozo pasa
 * borrador. Si la cuenta estaba "por cobrar", agregar la reabre — lo que cierra
 * una cuenta es el pago, nunca la impresión de la pre-cuenta.
 */
export async function agregarItems(
  cuentaId: number,
  datos: Agregar,
  actor: UsuarioToken,
  autorPedido: number | null = null
) {
  const resultado = await transaccion(async (conn) => {
    const cuenta = await bloquearCuenta(conn, cuentaId, datos.version);
    if (cuenta.estado === 'cerrada' || cuenta.estado === 'perdida' || cuenta.estado === 'fusionada') {
      throw conflicto(
        'Esa cuenta ya está cerrada. Abrí una cuenta nueva en la mesa.',
        'cuenta_cerrada'
      );
    }

    const armados: ItemArmado[] = [];
    for (const pedido of datos.items) {
      armados.push(await armarItem(conn, pedido as ItemPedido));
    }
    for (const item of armados) {
      await insertarItem(conn, cuentaId, item, actor, autorPedido);
    }

    if (cuenta.estado === 'por_cobrar') {
      await ejecutar(
        conn,
        `UPDATE cuentas SET estado = 'abierta', cuenta_pedida_at = NULL WHERE id = ?`,
        [cuentaId]
      );
    }

    let comanda: { id: number; items: number; mesa_label: string } | null = null;
    if (datos.enviar) {
      comanda = await crearComanda(
        conn,
        cuentaId,
        { urgente: datos.urgente, nota: datos.nota_comanda },
        actor
      );
    }

    const actualizada = await recalcular(conn, cuentaId);
    return { cuenta: actualizada, comanda, agregados: armados.length };
  });

  await auditar({
    actor, accion: 'items_agregados', entidad: 'cuenta', entidad_id: cuentaId,
    datos: { cantidad: resultado.agregados, enviados: Boolean(resultado.comanda) },
  });
  if (resultado.comanda) await avisarComandaNueva(resultado.comanda.id);
  emitir(['salon', 'caja'], 'cuenta:cambio', { cuenta_id: cuentaId });
  return resultado;
}

/** Manda a cocina lo que ya está cargado y todavía no salió. */
export async function enviarACocina(
  cuentaId: number,
  opciones: { urgente: boolean; nota?: string | null },
  actor: UsuarioToken
) {
  const comanda = await transaccion(async (conn) => {
    await bloquearCuenta(conn, cuentaId);
    return crearComanda(conn, cuentaId, opciones, actor);
  });
  await avisarComandaNueva(comanda.id);
  emitir(['salon', 'caja'], 'cuenta:cambio', { cuenta_id: cuentaId });
  return comanda;
}

export async function itemsDeCuenta(cuentaId: number) {
  const items = await consultar<{
    id: number; nombre_snapshot: string; precio_snapshot: string; cantidad: number;
    mods_total: string; total_linea: string; nota: string | null; estado: string;
    comanda_id: number | null; es_reposicion: number; motivo: string | null;
    iva_snapshot: string; producto_id: number | null; autor_pedido: number | null;
    comanda_estado: string | null; creado_at: string; de_barra: number;
  }>(
    pool,
    `SELECT i.id, i.nombre_snapshot, i.precio_snapshot, i.cantidad, i.mods_total,
            i.total_linea, i.nota, i.estado, i.comanda_id, i.es_reposicion, i.motivo,
            i.iva_snapshot, i.producto_id, i.autor_pedido, k.estado AS comanda_estado, i.creado_at,
            i.de_barra
     FROM cuenta_items i LEFT JOIN comandas k ON k.id = i.comanda_id
     WHERE i.cuenta_id = ? ORDER BY i.id`,
    [cuentaId]
  );
  if (!items.length) return [];
  const mods = await consultar<{
    item_id: number; grupo_nombre: string; nombre_snapshot: string;
    delta_snapshot: string; cantidad: number;
  }>(
    pool,
    `SELECT item_id, grupo_nombre, nombre_snapshot, delta_snapshot, cantidad FROM cuenta_item_mods
     WHERE item_id IN (${items.map(() => '?').join(',')}) ORDER BY id`,
    items.map((i) => i.id)
  );
  return items.map((i) => ({ ...i, mods: mods.filter((m) => m.item_id === i.id) }));
}
