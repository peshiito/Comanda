import { consultar, consultarUna, type Ejecutor } from '../../db/pool.js';
import { conflicto, malPedido } from '../../utils/errores.js';
import { aCentavos, aPesos, sumar } from '../../utils/dinero.js';
import { estaDisponible, type ProductoCarta } from '../carta/lectura.js';
import type { z } from 'zod';
import type { itemPedidoSchema } from './esquemas.js';

export type ItemPedido = z.infer<typeof itemPedidoSchema>;

export interface ItemArmado {
  producto_id: number;
  variante_id: number | null;
  nombre_snapshot: string;
  precio_snapshot: string;
  iva_snapshot: string;
  cantidad: number;
  mods_total: string;
  total_linea: string;
  nota: string | null;
  de_barra: boolean;
  mods: {
    opcion_id: number;
    grupo_nombre: string;
    nombre: string;
    delta: string;
    cantidad: number;
  }[];
}

/**
 * Arma el ítem con precio congelado y valida los modificadores obligatorios.
 * Esta validación también vive en el servidor: la pantalla no deja avanzar,
 * pero el backend tampoco acepta una comanda incompleta.
 */
export async function armarItem(ejecutor: Ejecutor, pedido: ItemPedido): Promise<ItemArmado> {
  const producto = await consultarUna<ProductoCarta & { activo: number; va_a_cocina: number }>(
    ejecutor,
    `SELECT id, nombre, precio, iva_alicuota, activo, agotado_hoy, stock_restante,
            horario_desde, horario_hasta, va_a_cocina
     FROM productos WHERE id = ?`,
    [pedido.producto_id]
  );
  if (!producto || !producto.activo) throw malPedido('Ese producto no existe o está dado de baja');
  if (!estaDisponible(producto)) throw conflicto(`"${producto.nombre}" está agotado`, 'agotado');
  if (producto.stock_restante !== null && producto.stock_restante < pedido.cantidad) {
    throw conflicto(`Quedan ${producto.stock_restante} de "${producto.nombre}"`, 'sin_stock');
  }

  let nombre = producto.nombre;
  let precio = aCentavos(producto.precio);

  if (pedido.variante_id) {
    const variante = await consultarUna<{ nombre: string; precio: string }>(
      ejecutor,
      'SELECT nombre, precio FROM producto_variantes WHERE id = ? AND producto_id = ? AND activa = 1',
      [pedido.variante_id, pedido.producto_id]
    );
    if (!variante) throw malPedido('Esa variante no corresponde al producto');
    nombre = `${producto.nombre} (${variante.nombre})`;
    precio = aCentavos(variante.precio);
  }

  const grupos = await consultar<{
    id: number; nombre: string; obligatorio: number; min_sel: number; max_sel: number;
    por_cantidad: number;
  }>(
    ejecutor,
    `SELECT g.id, g.nombre, g.obligatorio, g.min_sel, g.max_sel, g.por_cantidad
     FROM producto_grupos pg JOIN modificador_grupos g ON g.id = pg.grupo_id
     WHERE pg.producto_id = ? AND g.activo = 1 ORDER BY pg.orden`,
    [pedido.producto_id]
  );

  const opciones = pedido.opcion_ids.length
    ? await consultar<{ id: number; grupo_id: number; nombre: string; delta_precio: string }>(
        ejecutor,
        `SELECT id, grupo_id, nombre, delta_precio FROM modificador_opciones
         WHERE id IN (${pedido.opcion_ids.map(() => '?').join(',')}) AND activa = 1`,
        pedido.opcion_ids
      )
    : [];

  if (opciones.length !== pedido.opcion_ids.length) {
    throw malPedido('Alguna opción elegida ya no está disponible');
  }

  const idsGrupos = new Set(grupos.map((g) => g.id));
  for (const o of opciones) {
    if (!idsGrupos.has(o.grupo_id)) {
      throw malPedido(`"${o.nombre}" no corresponde a ${producto.nombre}`);
    }
  }

  // Cuántas pidió de cada opción. Los grupos normales no mandan nada acá.
  const cantPorOpcion = new Map(pedido.opcion_cant.map((c) => [c.opcion_id, c.cantidad]));
  for (const id of cantPorOpcion.keys()) {
    if (!opciones.some((o) => o.id === id)) {
      throw malPedido('Mandaste una cantidad para una opción que no elegiste');
    }
  }

  for (const g of grupos) {
    const delGrupo = opciones.filter((o) => o.grupo_id === g.id);
    const minimo = g.obligatorio ? Math.max(g.min_sel, 1) : g.min_sel;
    if (delGrupo.length < minimo) {
      throw malPedido(
        `Falta elegir ${g.nombre.toLowerCase()} para ${producto.nombre}`,
        'modificador_obligatorio'
      );
    }
    if (delGrupo.length > g.max_sel) {
      throw malPedido(`En ${g.nombre.toLowerCase()} se puede elegir hasta ${g.max_sel}`);
    }
    // En un grupo por cantidad lo que importa es que las partes cierren con
    // el total: doce empanadas tienen que ser doce, no once ni trece.
    if (g.por_cantidad && delGrupo.length) {
      const suma = delGrupo.reduce((s, o) => s + (cantPorOpcion.get(o.id) ?? 0), 0);
      if (suma !== pedido.cantidad) {
        throw malPedido(
          `En ${g.nombre.toLowerCase()} las cantidades suman ${suma} y tienen que sumar ${pedido.cantidad}`,
          'cantidad_no_cierra'
        );
      }
    }
  }

  // El delta de un grupo normal es por unidad del ítem; el de un grupo por
  // cantidad ya viene con su propia cantidad y se suma una sola vez.
  const porGrupo = new Map(grupos.map((g) => [g.id, g]));
  let modsPorUnidad = 0;
  let modsFijos = 0;
  for (const o of opciones) {
    const delta = aCentavos(o.delta_precio);
    if (porGrupo.get(o.grupo_id)?.por_cantidad) {
      modsFijos += delta * (cantPorOpcion.get(o.id) ?? 0);
    } else {
      modsPorUnidad = sumar(modsPorUnidad, delta);
    }
  }
  const modsTotal = modsPorUnidad;
  const totalLinea = (precio + modsPorUnidad) * pedido.cantidad + modsFijos;

  return {
    producto_id: pedido.producto_id,
    variante_id: pedido.variante_id ?? null,
    nombre_snapshot: nombre,
    precio_snapshot: aPesos(precio),
    iva_snapshot: Number(producto.iva_alicuota).toFixed(2),
    cantidad: pedido.cantidad,
    mods_total: aPesos(modsTotal),
    total_linea: aPesos(totalLinea),
    nota: pedido.nota?.trim() || null,
    de_barra: !producto.va_a_cocina,
    mods: opciones.map((o) => ({
      opcion_id: o.id,
      grupo_nombre: grupos.find((g) => g.id === o.grupo_id)?.nombre ?? '',
      nombre: o.nombre,
      delta: Number(o.delta_precio).toFixed(2),
      cantidad: porGrupo.get(o.grupo_id)?.por_cantidad ? (cantPorOpcion.get(o.id) ?? 1) : 1,
    })),
  };
}
