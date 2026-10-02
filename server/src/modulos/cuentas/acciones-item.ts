import { consultarUna, ejecutar, transaccion } from '../../db/pool.js';
import { conflicto, malPedido, noEncontrado } from '../../utils/errores.js';
import { auditar } from '../../servicios/auditoria.js';
import { autorizar } from '../../servicios/autorizacion.js';
import { emitir } from '../../sockets/index.js';
import { avisarComandaNueva, crearComanda } from '../comandas/servicio.js';
import { bloquearCuenta, recalcular } from './totales.js';
import type { UsuarioToken } from '../../types/express.js';
import type { z } from 'zod';
import type { anularSchema, devolverSchema } from './esquemas.js';

interface FilaItem {
  id: number;
  cuenta_id: number;
  producto_id: number | null;
  variante_id: number | null;
  nombre_snapshot: string;
  precio_snapshot: string;
  iva_snapshot: string;
  cantidad: number;
  mods_total: string;
  total_linea: string;
  nota: string | null;
  estado: string;
  comanda_id: number | null;
  de_barra: number;
}

async function traerItem(ejecutor: Parameters<typeof consultarUna>[0], cuentaId: number, itemId: number) {
  const item = await consultarUna<FilaItem>(
    ejecutor,
    `SELECT id, cuenta_id, producto_id, variante_id, nombre_snapshot, precio_snapshot,
            iva_snapshot, cantidad, mods_total, total_linea, nota, estado, comanda_id,
            de_barra
     FROM cuenta_items WHERE id = ? AND cuenta_id = ? FOR UPDATE`,
    [itemId, cuentaId]
  );
  if (!item) throw noEncontrado('Ese ítem no está en la cuenta');
  if (item.estado !== 'activo') throw conflicto(`Ese ítem ya está ${item.estado}`);
  return item;
}

/**
 * Anular: el ítem no tendría que estar ahí (se cargó dos veces, se cargó en la
 * mesa equivocada, lo cambiaron antes de cocinarse). No se perdió comida.
 * Si ya salió a cocina, pide PIN del encargado.
 */
export async function anularItem(
  cuentaId: number,
  itemId: number,
  datos: z.infer<typeof anularSchema>,
  actor: UsuarioToken
) {
  const resultado = await transaccion(async (conn) => {
    await bloquearCuenta(conn, cuentaId);
    const item = await traerItem(conn, cuentaId, itemId);
    const yaEnCocina = item.comanda_id !== null;

    const autorizante = await autorizar(actor, {
      requierePin: yaEnCocina,
      pin: datos.pin,
      accion: 'anular_item_en_cocina',
    });

    await ejecutar(
      conn,
      `UPDATE cuenta_items SET estado = 'anulado', motivo = ?, resuelto_por = ?, resuelto_at = NOW(3)
       WHERE id = ?`,
      [datos.motivo, autorizante.id, itemId]
    );
    const cuenta = await recalcular(conn, cuentaId);
    return { cuenta, item, autorizante, yaEnCocina };
  });

  await auditar({
    actor, accion: 'item_anulado', entidad: 'cuenta_item', entidad_id: itemId,
    motivo: datos.motivo,
    datos: {
      cuenta_id: cuentaId, producto: resultado.item.nombre_snapshot,
      importe: resultado.item.total_linea, ya_en_cocina: resultado.yaEnCocina,
      autorizo: resultado.autorizante.nombre,
    },
  });
  emitir(['salon', 'caja', 'cocina'], 'cuenta:cambio', { cuenta_id: cuentaId });
  return resultado.cuenta;
}

const MOTIVOS: Record<string, string> = {
  error_cocina: 'Error de cocina',
  error_pedido: 'Error al tomar el pedido',
  devuelto_cliente: 'Devuelto por el cliente',
  se_cayo: 'Se cayó',
  otro: 'Otro',
};

/**
 * Devolución: se cocinó, salió y se perdió. Sale de la cuenta igual que una
 * anulación, pero se reporta aparte porque destruye mercadería.
 * Con reposición, el plato vuelve a cocina como urgente y no se cobra dos veces.
 */
export async function devolverItem(
  cuentaId: number,
  itemId: number,
  datos: z.infer<typeof devolverSchema>,
  actor: UsuarioToken
) {
  const resultado = await transaccion(async (conn) => {
    await bloquearCuenta(conn, cuentaId);
    const item = await traerItem(conn, cuentaId, itemId);
    if (!item.comanda_id) {
      throw malPedido('Ese plato no salió a cocina todavía: anulalo en vez de devolverlo');
    }

    const autorizante = await autorizar(actor, {
      requierePin: true,
      pin: datos.pin,
      accion: 'devolver_item',
    });

    const motivo = `${MOTIVOS[datos.motivo]}${datos.detalle ? `: ${datos.detalle}` : ''}`;
    await ejecutar(
      conn,
      `UPDATE cuenta_items SET estado = 'devuelto', motivo = ?, resuelto_por = ?, resuelto_at = NOW(3)
       WHERE id = ?`,
      [motivo, autorizante.id, itemId]
    );

    let reposicion: number | null = null;
    let comandaId: number | null = null;
    if (datos.reponer) {
      const res = await ejecutar(
        conn,
        `INSERT INTO cuenta_items
           (cuenta_id, producto_id, variante_id, nombre_snapshot, precio_snapshot, iva_snapshot,
            cantidad, mods_total, total_linea, nota, estado, es_reposicion, cargado_por, de_barra)
         VALUES (?, ?, ?, ?, '0.00', ?, ?, '0.00', '0.00', ?, 'activo', 1, ?, ?)`,
        [
          cuentaId, item.producto_id, item.variante_id, item.nombre_snapshot, item.iva_snapshot,
          item.cantidad, `Reposición: ${motivo}`, actor.id, item.de_barra,
        ]
      );
      reposicion = res.insertId;
      // Si era de barra no hay nada que cocinar: el mozo sirve otra y listo.
      if (!item.de_barra) {
        const comanda = await crearComanda(conn, cuentaId, { urgente: true, nota: 'REPOSICIÓN' }, actor);
        comandaId = comanda.id;
      }
    }

    const cuenta = await recalcular(conn, cuentaId);
    return { cuenta, item, autorizante, motivo, reposicion, comandaId };
  });

  await auditar({
    actor, accion: 'item_devuelto', entidad: 'cuenta_item', entidad_id: itemId,
    motivo: resultado.motivo,
    datos: {
      cuenta_id: cuentaId, producto: resultado.item.nombre_snapshot,
      importe: resultado.item.total_linea, repuesto: Boolean(resultado.reposicion),
      autorizo: resultado.autorizante.nombre,
    },
  });
  if (resultado.comandaId) await avisarComandaNueva(resultado.comandaId);
  emitir(['salon', 'caja', 'cocina'], 'cuenta:cambio', { cuenta_id: cuentaId });
  return resultado.cuenta;
}

/** Pasa un ítem a otra cuenta de la mesa: así se divide por ítem. */
export async function moverItem(
  cuentaId: number,
  itemId: number,
  destinoId: number,
  actor: UsuarioToken
) {
  if (cuentaId === destinoId) throw malPedido('El ítem ya está en esa cuenta');

  const resultado = await transaccion(async (conn) => {
    const origen = await bloquearCuenta(conn, cuentaId);
    const destino = await bloquearCuenta(conn, destinoId);
    if (destino.estado === 'cerrada' || destino.estado === 'perdida' || destino.estado === 'fusionada') {
      throw conflicto('La cuenta destino ya está cerrada');
    }
    if (origen.mesa_id !== destino.mesa_id) {
      throw malPedido('Solo se pueden pasar ítems entre cuentas de la misma mesa');
    }
    const item = await traerItem(conn, cuentaId, itemId);
    await ejecutar(conn, 'UPDATE cuenta_items SET cuenta_id = ? WHERE id = ?', [destinoId, itemId]);
    const [a, b] = [await recalcular(conn, cuentaId), await recalcular(conn, destinoId)];
    return { origen: a, destino: b, item };
  });

  await auditar({
    actor, accion: 'item_movido', entidad: 'cuenta_item', entidad_id: itemId,
    datos: { de: cuentaId, a: destinoId, producto: resultado.item.nombre_snapshot },
  });
  emitir(['salon', 'caja'], 'cuenta:cambio', { cuenta_id: cuentaId });
  return resultado;
}
