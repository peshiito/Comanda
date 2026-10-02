import { consultar, consultarUna, ejecutar, pool } from '../../db/pool.js';
import { conflicto, malPedido, noEncontrado, sinPermiso } from '../../utils/errores.js';
import { auditar } from '../../servicios/auditoria.js';
import { emitir } from '../../sockets/index.js';
import type { UsuarioToken } from '../../types/express.js';
import type { z } from 'zod';
import type { itemBorradorSchema, notaBorradorSchema } from './esquemas.js';

type ItemBorrador = z.infer<typeof itemBorradorSchema>;
type Nota = z.infer<typeof notaBorradorSchema>;

interface FilaBorrador {
  id: number;
  mesa_id: number | null;
  cuenta_id: number | null;
  mozo_id: number;
  estado: 'privado' | 'pasado' | 'consumido';
  nota: string | null;
  pago_previsto: string | null;
}

async function traer(id: number): Promise<FilaBorrador> {
  const b = await consultarUna<FilaBorrador>(
    pool,
    'SELECT id, mesa_id, cuenta_id, mozo_id, estado, nota, pago_previsto FROM borradores WHERE id = ?',
    [id]
  );
  if (!b) throw noEncontrado('Borrador no encontrado');
  return b;
}

/** El borrador privado es del mozo: nadie más lo ve mientras no lo pase. */
function verificarDuenio(b: FilaBorrador, actor: UsuarioToken): void {
  if (b.estado === 'privado' && b.mozo_id !== actor.id && actor.rol !== 'encargado') {
    throw sinPermiso('Ese borrador es de otro mozo');
  }
}

/**
 * Para escribir hacen falta las dos cosas: ser el dueño y que todavía sea
 * privado.
 *
 * `verificarDuenio` sola no alcanza, porque mira el dueño únicamente mientras
 * el borrador es privado: una vez pasado a caja dejaba de proteger nada y
 * cualquiera del salón podía borrarle una línea al pedido de otro — sin que
 * quedara registrado, justo cuando esa línea ya es plata esperando a que caja
 * la cargue. Pasado el borrador, se corrige sobre la cuenta, que sí se audita.
 */
function verificarEditable(b: FilaBorrador, actor: UsuarioToken): void {
  verificarDuenio(b, actor);
  if (b.estado !== 'privado') throw conflicto('Ese borrador ya se pasó a caja');
}

export async function itemsDeBorrador(borradorId: number) {
  return consultar(
    pool,
    `SELECT bi.id, bi.producto_id, bi.variante_id, bi.cantidad, bi.nota, bi.mods,
            bi.mods_cant, p.nombre AS producto, v.nombre AS variante,
            p.va_a_cocina, (p.agotado_hoy = 1 OR p.activo = 0) AS agotado
     FROM borrador_items bi
     JOIN productos p ON p.id = bi.producto_id
     LEFT JOIN producto_variantes v ON v.id = bi.variante_id
     WHERE bi.borrador_id = ? ORDER BY bi.id`,
    [borradorId]
  );
}

/**
 * Su libreta vive en el servidor, no en el teléfono: si se queda sin batería,
 * agarra otro celular, entra con su PIN y está todo.
 */
export async function miBorrador(actor: UsuarioToken, mesaId: number | null, cuentaId: number | null) {
  const existente = await consultarUna<FilaBorrador>(
    pool,
    `SELECT id, mesa_id, cuenta_id, mozo_id, estado, nota, pago_previsto FROM borradores
     WHERE mozo_id = ? AND estado = 'privado' AND (mesa_id <=> ?) LIMIT 1`,
    [actor.id, mesaId]
  );
  const borrador =
    existente ??
    (await traer(
      (
        await ejecutar(
          pool,
          'INSERT INTO borradores (mesa_id, cuenta_id, mozo_id) VALUES (?, ?, ?)',
          [mesaId, cuentaId, actor.id]
        )
      ).insertId
    ));
  return { ...borrador, items: await itemsDeBorrador(borrador.id) };
}

export async function agregarItem(borradorId: number, datos: ItemBorrador, actor: UsuarioToken) {
  const b = await traer(borradorId);
  verificarEditable(b, actor);

  const producto = await consultarUna<{ id: number; agotado_hoy: number; activo: number }>(
    pool,
    'SELECT id, agotado_hoy, activo FROM productos WHERE id = ?',
    [datos.producto_id]
  );
  if (!producto?.activo) throw malPedido('Ese producto no está en la carta');
  if (producto.agotado_hoy) throw conflicto('Ese producto está agotado', 'agotado');

  const res = await ejecutar(
    pool,
    `INSERT INTO borrador_items
       (borrador_id, producto_id, variante_id, cantidad, nota, mods, mods_cant)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      borradorId, datos.producto_id, datos.variante_id ?? null, datos.cantidad,
      datos.nota?.trim() || null, JSON.stringify(datos.opcion_ids ?? []),
      JSON.stringify(datos.opcion_cant ?? []),
    ]
  );
  return { id: res.insertId, items: await itemsDeBorrador(borradorId) };
}

export async function quitarItem(borradorId: number, itemId: number, actor: UsuarioToken) {
  const b = await traer(borradorId);
  verificarEditable(b, actor);
  await ejecutar(pool, 'DELETE FROM borrador_items WHERE id = ? AND borrador_id = ?', [itemId, borradorId]);
  return { items: await itemsDeBorrador(borradorId) };
}

export async function editarNota(borradorId: number, datos: Nota, actor: UsuarioToken) {
  const b = await traer(borradorId);
  verificarEditable(b, actor);
  await ejecutar(pool, 'UPDATE borradores SET nota = ?, pago_previsto = ? WHERE id = ?', [
    datos.nota?.trim() || null, datos.pago_previsto || null, borradorId,
  ]);
  return traer(borradorId);
}

/** Pasar a caja: deja de ser privado y aparece en la bandeja de pendientes. */
export async function pasarACaja(borradorId: number, actor: UsuarioToken) {
  const b = await traer(borradorId);
  verificarDuenio(b, actor);
  if (b.estado !== 'privado') throw conflicto('Ese borrador ya se pasó');

  const items = await itemsDeBorrador(borradorId);
  if (!items.length) throw malPedido('El borrador está vacío');

  await ejecutar(
    pool,
    `UPDATE borradores SET estado = 'pasado', pasado_at = NOW(3) WHERE id = ?`,
    [borradorId]
  );
  await auditar({
    actor, accion: 'borrador_pasado', entidad: 'borrador', entidad_id: borradorId,
    datos: { mesa_id: b.mesa_id, items: items.length },
  });
  emitir(['caja', 'salon'], 'borrador:pasado', { borrador_id: borradorId, mesa_id: b.mesa_id });
  return { id: borradorId, estado: 'pasado' };
}

/** Lo que caja tiene esperando para cargar. */
export async function pendientes() {
  const borradores = await consultar<FilaBorrador & { mesa: string | null; mozo: string; minutos: number }>(
    pool,
    `SELECT b.id, b.mesa_id, b.cuenta_id, b.mozo_id, b.estado, b.nota, b.pago_previsto,
            m.nombre AS mesa, u.nombre AS mozo,
            TIMESTAMPDIFF(MINUTE, b.pasado_at, NOW()) AS minutos
     FROM borradores b
     LEFT JOIN mesas m ON m.id = b.mesa_id
     JOIN usuarios u ON u.id = b.mozo_id
     WHERE b.estado = 'pasado' ORDER BY b.pasado_at`
  );
  return Promise.all(
    borradores.map(async (b) => ({ ...b, items: await itemsDeBorrador(b.id) }))
  );
}

export async function marcarConsumido(borradorId: number): Promise<void> {
  await ejecutar(pool, `UPDATE borradores SET estado = 'consumido' WHERE id = ?`, [borradorId]);
}
