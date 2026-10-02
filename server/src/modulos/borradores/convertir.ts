import { consultar, consultarUna, pool } from '../../db/pool.js';
import { conflicto, malPedido, noEncontrado } from '../../utils/errores.js';
import { auditar } from '../../servicios/auditoria.js';
import { abrirCuenta } from '../cuentas/servicio.js';
import { agregarItems } from '../cuentas/items.js';
import { itemsDeBorrador, marcarConsumido } from './servicio.js';
import type { UsuarioToken } from '../../types/express.js';
import type { z } from 'zod';
import type { convertirSchema } from './esquemas.js';

interface FilaBorrador {
  id: number;
  mesa_id: number | null;
  cuenta_id: number | null;
  mozo_id: number;
  estado: string;
  nota: string | null;
}

async function cuentaDestino(b: FilaBorrador, indicada: number | null, actor: UsuarioToken): Promise<number> {
  if (indicada) return indicada;
  if (b.cuenta_id) {
    const viva = await consultarUna<{ id: number }>(
      pool,
      `SELECT id FROM cuentas WHERE id = ? AND estado IN ('abierta','por_cobrar')`,
      [b.cuenta_id]
    );
    if (viva) return viva.id;
  }
  if (b.mesa_id) {
    const abiertas = await consultar<{ id: number }>(
      pool,
      `SELECT id FROM cuentas WHERE mesa_id = ? AND estado IN ('abierta','por_cobrar')
       ORDER BY abierta_at LIMIT 1`,
      [b.mesa_id]
    );
    if (abiertas.length) return abiertas[0].id;
    const nueva = await abrirCuenta({ tipo: 'salon', mesa_id: b.mesa_id, comensales: 0, mozo_id: b.mozo_id }, actor);
    return nueva.id;
  }
  throw malPedido('Ese borrador no tiene mesa: indicá a qué cuenta va');
}

/**
 * Caja revisa el borrador del mozo y lo convierte en comanda. El pedido se
 * escribió una sola vez, en la mesa, por quien lo escuchó — y el que decide
 * qué entra a la cocina sigue siendo caja.
 */
export async function convertirBorrador(
  borradorId: number,
  datos: z.infer<typeof convertirSchema>,
  actor: UsuarioToken
) {
  const b = await consultarUna<FilaBorrador>(
    pool,
    'SELECT id, mesa_id, cuenta_id, mozo_id, estado, nota FROM borradores WHERE id = ?',
    [borradorId]
  );
  if (!b) throw noEncontrado('Borrador no encontrado');
  if (b.estado === 'consumido') throw conflicto('Ese borrador ya se cargó');
  if (b.estado === 'privado') throw conflicto('El mozo todavía no lo pasó a caja');

  const items = (await itemsDeBorrador(borradorId)) as {
    producto_id: number;
    variante_id: number | null;
    cantidad: number;
    nota: string | null;
    mods: number[] | string | null;
    mods_cant: { opcion_id: number; cantidad: number }[] | string | null;
  }[];
  if (!items.length) throw malPedido('El borrador está vacío');

  const cuentaId = await cuentaDestino(b, datos.cuenta_id ?? null, actor);

  const resultado = await agregarItems(
    cuentaId,
    {
      items: items.map((i) => ({
        producto_id: i.producto_id,
        variante_id: i.variante_id,
        cantidad: i.cantidad,
        nota: i.nota,
        opcion_ids: Array.isArray(i.mods) ? i.mods : JSON.parse((i.mods as string) || '[]'),
        opcion_cant: Array.isArray(i.mods_cant)
          ? i.mods_cant
          : JSON.parse((i.mods_cant as string) || '[]'),
      })),
      enviar: datos.enviar,
      urgente: datos.urgente,
      nota_comanda: b.nota,
    },
    actor,
    b.mozo_id
  );

  await marcarConsumido(borradorId);
  await auditar({
    actor, accion: 'borrador_cargado', entidad: 'borrador', entidad_id: borradorId,
    datos: { cuenta_id: cuentaId, items: items.length, mozo_id: b.mozo_id },
  });
  return { ...resultado, cuenta_id: cuentaId };
}
