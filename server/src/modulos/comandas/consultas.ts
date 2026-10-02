import { consultar, pool } from '../../db/pool.js';
import { leerConfig } from '../../servicios/config.js';

export interface ItemComanda {
  id: number;
  comanda_id: number;
  producto_id: number | null;
  nombre: string;
  cantidad: number;
  nota: string | null;
  estado: string;
  es_reposicion: number;
  mods: string[];
}

export interface ComandaKds {
  id: number;
  cuenta_id: number;
  mesa_label: string;
  urgente: number;
  nota: string | null;
  enviada_at: string;
  minutos: number;
  nivel: 'verde' | 'amarillo' | 'naranja' | 'rojo';
  items: ItemComanda[];
}

async function itemsDeComandas(ids: number[]): Promise<ItemComanda[]> {
  if (!ids.length) return [];
  const marcadores = ids.map(() => '?').join(',');
  const items = await consultar<Omit<ItemComanda, 'mods'>>(
    pool,
    `SELECT id, comanda_id, producto_id, nombre_snapshot AS nombre, cantidad, nota,
            estado, es_reposicion
     FROM cuenta_items WHERE comanda_id IN (${marcadores}) ORDER BY id`,
    ids
  );
  if (!items.length) return [];
  const mods = await consultar<{ item_id: number; nombre_snapshot: string; cantidad: number }>(
    pool,
    `SELECT item_id, nombre_snapshot, cantidad FROM cuenta_item_mods
     WHERE item_id IN (${items.map(() => '?').join(',')}) ORDER BY id`,
    items.map((i) => i.id)
  );
  return items.map((i) => ({
    ...i,
    // Con cantidad adelante cuando son varios del mismo gusto: la cocina
    // necesita leer "3 carne, 1 roquefort", no la lista de gustos a secas.
    mods: mods
      .filter((m) => m.item_id === i.id)
      .map((m) => (m.cantidad > 1 ? `${m.cantidad} ${m.nombre_snapshot}` : m.nombre_snapshot)),
  }));
}

/**
 * La pantalla de cocina: las más viejas arriba, las urgentes primero.
 * El reloj lo cuenta el sistema — al cocinero no se le pide ningún dato.
 */
export async function comandasPendientes(): Promise<ComandaKds[]> {
  const cfg = await leerConfig();
  const amarillo = Number(cfg.demora_amarillo_min);
  const naranja = Number(cfg.demora_naranja_min);
  const rojo = Number(cfg.demora_rojo_min);

  // Solo de cuentas vivas: si la mesa se cobró o se dio por perdida, la cocina
  // no tiene que seguir viendo ese ticket.
  const comandas = await consultar<Omit<ComandaKds, 'items' | 'minutos' | 'nivel'> & { minutos: number }>(
    pool,
    `SELECT k.id, k.cuenta_id, k.mesa_label, k.urgente, k.nota, k.enviada_at,
            TIMESTAMPDIFF(MINUTE, k.enviada_at, NOW()) AS minutos
     FROM comandas k
     JOIN cuentas c ON c.id = k.cuenta_id
     WHERE k.estado = 'pendiente' AND c.estado IN ('abierta','por_cobrar')
     ORDER BY k.urgente DESC, k.enviada_at ASC`
  );
  const items = await itemsDeComandas(comandas.map((c) => c.id));

  return comandas.map((c) => ({
    ...c,
    nivel:
      c.minutos >= rojo ? 'rojo' : c.minutos >= naranja ? 'naranja' : c.minutos >= amarillo ? 'amarillo' : 'verde',
    items: items.filter((i) => i.comanda_id === c.id),
  }));
}

/** Comandas listas que nadie retiró: el plato se está enfriando. */
export async function comandasListas(mozoId?: number): Promise<ComandaKds[]> {
  const filtro = mozoId ? 'AND c.mozo_id = ?' : '';
  const params = mozoId ? [mozoId] : [];
  const comandas = await consultar<Omit<ComandaKds, 'items' | 'nivel'> & { minutos: number }>(
    pool,
    `SELECT k.id, k.cuenta_id, k.mesa_label, k.urgente, k.nota, k.enviada_at,
            TIMESTAMPDIFF(MINUTE, k.terminada_at, NOW()) AS minutos
     FROM comandas k JOIN cuentas c ON c.id = k.cuenta_id
     WHERE k.estado = 'terminada' AND k.retirado_at IS NULL
       AND c.estado IN ('abierta','por_cobrar') ${filtro}
     ORDER BY k.terminada_at`,
    params
  );
  const items = await itemsDeComandas(comandas.map((c) => c.id));
  return comandas.map((c) => ({
    ...c,
    nivel: 'verde',
    items: items.filter((i) => i.comanda_id === c.id),
  }));
}

/** Historial del día para caja: sirve para reimprimir y para revisar demoras. */
export async function comandasDelDia(): Promise<ComandaKds[]> {
  const comandas = await consultar<Omit<ComandaKds, 'items' | 'nivel'> & { minutos: number }>(
    pool,
    `SELECT id, cuenta_id, mesa_label, urgente, nota, enviada_at,
            TIMESTAMPDIFF(MINUTE, enviada_at, COALESCE(terminada_at, NOW())) AS minutos
     FROM comandas WHERE DATE(enviada_at) = CURDATE()
     ORDER BY enviada_at DESC LIMIT 200`
  );
  const items = await itemsDeComandas(comandas.map((c) => c.id));
  return comandas.map((c) => ({ ...c, nivel: 'verde', items: items.filter((i) => i.comanda_id === c.id) }));
}
