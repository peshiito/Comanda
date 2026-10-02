import { consultar, consultarUna, pool } from '../../db/pool.js';
import { noEncontrado } from '../../utils/errores.js';

export interface ProductoCarta {
  id: number;
  categoria_id: number;
  nombre: string;
  descripcion: string | null;
  codigo_corto: string | null;
  precio: string;
  iva_alicuota: string;
  agotado_hoy: number;
  stock_restante: number | null;
  visible_qr: number;
  va_a_cocina: number;
  foto: string | null;
  apto_celiaco: number;
  apto_vegetariano: number;
  apto_vegano: number;
  horario_desde: string | null;
  horario_hasta: string | null;
  disponible?: boolean;
  variantes?: { id: number; nombre: string; precio: string }[];
  grupos?: number[];
}

const SELECT_PRODUCTO = `
  SELECT id, categoria_id, nombre, descripcion, codigo_corto, precio, iva_alicuota,
         agotado_hoy, stock_restante, visible_qr, va_a_cocina, foto,
         apto_celiaco, apto_vegetariano, apto_vegano, horario_desde, horario_hasta
  FROM productos`;

/** Un producto está disponible si no está agotado, tiene stock y está en horario. */
export function estaDisponible(p: ProductoCarta, ahora = new Date()): boolean {
  if (p.agotado_hoy) return false;
  if (p.stock_restante !== null && p.stock_restante <= 0) return false;
  if (p.horario_desde && p.horario_hasta) {
    const hhmm = ahora.toTimeString().slice(0, 8);
    if (p.horario_desde <= p.horario_hasta) {
      if (hhmm < p.horario_desde || hhmm > p.horario_hasta) return false;
    } else if (hhmm < p.horario_desde && hhmm > p.horario_hasta) {
      return false;
    }
  }
  return true;
}

async function decorar(productos: ProductoCarta[]): Promise<ProductoCarta[]> {
  if (!productos.length) return [];
  const ids = productos.map((p) => p.id);
  const marcadores = ids.map(() => '?').join(',');

  const variantes = await consultar<{ id: number; producto_id: number; nombre: string; precio: string }>(
    pool,
    `SELECT id, producto_id, nombre, precio FROM producto_variantes
     WHERE producto_id IN (${marcadores}) AND activa = 1 ORDER BY orden, id`,
    ids
  );
  const vinculos = await consultar<{ producto_id: number; grupo_id: number }>(
    pool,
    `SELECT pg.producto_id, pg.grupo_id FROM producto_grupos pg
     JOIN modificador_grupos g ON g.id = pg.grupo_id AND g.activo = 1
     WHERE pg.producto_id IN (${marcadores}) ORDER BY pg.orden, pg.grupo_id`,
    ids
  );

  return productos.map((p) => ({
    ...p,
    disponible: estaDisponible(p),
    variantes: variantes.filter((v) => v.producto_id === p.id).map(({ id, nombre, precio }) => ({ id, nombre, precio })),
    grupos: vinculos.filter((v) => v.producto_id === p.id).map((v) => v.grupo_id),
  }));
}

export async function cartaCompleta() {
  const categorias = await consultar<{ id: number; nombre: string; orden: number }>(
    pool,
    'SELECT id, nombre, orden FROM categorias WHERE activa = 1 ORDER BY orden, nombre'
  );
  const productos = await decorar(
    await consultar<ProductoCarta>(
      pool,
      `${SELECT_PRODUCTO} WHERE activo = 1 ORDER BY orden, nombre`
    )
  );
  const grupos = await gruposModificadores();

  return {
    categorias: categorias.map((c) => ({
      ...c,
      productos: productos.filter((p) => p.categoria_id === c.id),
    })),
    grupos,
  };
}

export async function gruposModificadores() {
  const grupos = await consultar<{
    id: number;
    nombre: string;
    obligatorio: number;
    min_sel: number;
    max_sel: number;
    por_cantidad: number;
  }>(
    pool,
    `SELECT id, nombre, obligatorio, min_sel, max_sel, por_cantidad
     FROM modificador_grupos WHERE activo = 1 ORDER BY nombre`
  );
  if (!grupos.length) return [];
  const opciones = await consultar<{
    id: number;
    grupo_id: number;
    nombre: string;
    delta_precio: string;
  }>(
    pool,
    `SELECT id, grupo_id, nombre, delta_precio FROM modificador_opciones
     WHERE activa = 1 ORDER BY orden, id`
  );
  return grupos.map((g) => ({ ...g, opciones: opciones.filter((o) => o.grupo_id === g.id) }));
}

export async function obtenerProducto(id: number): Promise<ProductoCarta> {
  const p = await consultarUna<ProductoCarta>(pool, `${SELECT_PRODUCTO} WHERE id = ?`, [id]);
  if (!p) throw noEncontrado('Producto no encontrado');
  return (await decorar([p]))[0];
}

export async function buscar(texto: string) {
  const like = `%${texto}%`;
  return decorar(
    await consultar<ProductoCarta>(
      pool,
      `${SELECT_PRODUCTO} WHERE activo = 1 AND (nombre LIKE ? OR codigo_corto = ?)
       ORDER BY (codigo_corto = ?) DESC, nombre LIMIT 25`,
      [like, texto, texto]
    )
  );
}

/** Quick keys: lo más vendido de los últimos 30 días, para la primera pantalla. */
export async function favoritos(limite = 16) {
  const ids = await consultar<{ producto_id: number }>(
    pool,
    `SELECT i.producto_id, SUM(i.cantidad) AS cant
     FROM cuenta_items i
     JOIN cuentas c ON c.id = i.cuenta_id
     WHERE i.estado = 'activo' AND i.producto_id IS NOT NULL
       AND c.abierta_at >= (NOW() - INTERVAL 30 DAY)
     GROUP BY i.producto_id ORDER BY cant DESC LIMIT ?`,
    [limite]
  );
  if (!ids.length) return [];
  const marcadores = ids.map(() => '?').join(',');
  const productos = await decorar(
    await consultar<ProductoCarta>(
      pool,
      `${SELECT_PRODUCTO} WHERE activo = 1 AND id IN (${marcadores})`,
      ids.map((i) => i.producto_id)
    )
  );
  const orden = new Map(ids.map((i, idx) => [i.producto_id, idx]));
  return productos.sort((a, b) => (orden.get(a.id) ?? 0) - (orden.get(b.id) ?? 0));
}
