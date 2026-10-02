import { consultar, consultarUna, pool } from '../../db/pool.js';
import { hoyLocal } from '../../utils/fechas.js';

export interface Rango {
  desde: string;
  hasta: string;
}

/** Por defecto, el día de hoy en el reloj del local — ver `utils/fechas`. */
export function rango(desde?: string, hasta?: string): Rango {
  const hoy = hoyLocal();
  return { desde: desde || hoy, hasta: hasta || desde || hoy };
}

const VENTAS = `FROM cuentas c
  WHERE c.estado = 'cerrada' AND DATE(c.cerrada_at) BETWEEN ? AND ?`;

export async function resumen(r: Rango) {
  const base = await consultarUna<{
    tickets: number; venta: string; descuentos: string; propinas: string;
    comensales: number; cubiertos: string;
  }>(
    pool,
    `SELECT COUNT(*) AS tickets, COALESCE(SUM(c.total),0) AS venta,
            COALESCE(SUM(c.descuento),0) AS descuentos, COALESCE(SUM(c.propina),0) AS propinas,
            COALESCE(SUM(c.comensales),0) AS comensales, COALESCE(SUM(c.cubierto_total),0) AS cubiertos
     ${VENTAS}`,
    [r.desde, r.hasta]
  );

  const porMedio = await consultar<{ medio: string; monto: string; operaciones: number }>(
    pool,
    `SELECT p.medio, SUM(p.monto) AS monto, COUNT(*) AS operaciones
     FROM pagos p JOIN cuentas c ON c.id = p.cuenta_id
     WHERE c.estado = 'cerrada' AND DATE(c.cerrada_at) BETWEEN ? AND ?
     GROUP BY p.medio ORDER BY monto DESC`,
    [r.desde, r.hasta]
  );

  const porTipo = await consultar<{ tipo: string; tickets: number; monto: string }>(
    pool,
    `SELECT c.tipo, COUNT(*) AS tickets, SUM(c.total) AS monto ${VENTAS} GROUP BY c.tipo`,
    [r.desde, r.hasta]
  );

  const tickets = base?.tickets ?? 0;
  const venta = Number(base?.venta ?? 0);
  return {
    rango: r,
    tickets,
    venta: venta.toFixed(2),
    ticket_promedio: tickets ? (venta / tickets).toFixed(2) : '0.00',
    por_comensal:
      base && base.comensales > 0 ? (venta / base.comensales).toFixed(2) : '0.00',
    comensales: base?.comensales ?? 0,
    descuentos: Number(base?.descuentos ?? 0).toFixed(2),
    propinas: Number(base?.propinas ?? 0).toFixed(2),
    cubiertos: Number(base?.cubiertos ?? 0).toFixed(2),
    por_medio: porMedio,
    por_tipo: porTipo,
  };
}

export async function porDia(r: Rango) {
  return consultar(
    pool,
    `SELECT DATE(c.cerrada_at) AS dia, COUNT(*) AS tickets, SUM(c.total) AS venta,
            SUM(c.comensales) AS comensales
     ${VENTAS} GROUP BY dia ORDER BY dia`,
    [r.desde, r.hasta]
  );
}

/** Horas pico: dónde se concentra la venta y dónde conviene poner gente. */
export async function porHora(r: Rango) {
  return consultar(
    pool,
    `SELECT HOUR(c.cerrada_at) AS hora, COUNT(*) AS tickets, SUM(c.total) AS venta
     ${VENTAS} GROUP BY hora ORDER BY hora`,
    [r.desde, r.hasta]
  );
}

export async function porProducto(r: Rango, limite = 50) {
  return consultar(
    pool,
    `SELECT i.nombre_snapshot AS producto, SUM(i.cantidad) AS unidades,
            SUM(i.total_linea) AS venta, COUNT(DISTINCT i.cuenta_id) AS tickets
     FROM cuenta_items i JOIN cuentas c ON c.id = i.cuenta_id
     WHERE i.estado = 'activo' AND c.estado = 'cerrada'
       AND DATE(c.cerrada_at) BETWEEN ? AND ?
     GROUP BY i.nombre_snapshot ORDER BY unidades DESC LIMIT ?`,
    [r.desde, r.hasta, limite]
  );
}

export async function porCategoria(r: Rango) {
  return consultar(
    pool,
    `SELECT cat.nombre AS categoria, SUM(i.cantidad) AS unidades, SUM(i.total_linea) AS venta
     FROM cuenta_items i
     JOIN cuentas c ON c.id = i.cuenta_id
     JOIN productos p ON p.id = i.producto_id
     JOIN categorias cat ON cat.id = p.categoria_id
     WHERE i.estado = 'activo' AND c.estado = 'cerrada'
       AND DATE(c.cerrada_at) BETWEEN ? AND ?
     GROUP BY cat.nombre ORDER BY venta DESC`,
    [r.desde, r.hasta]
  );
}

export async function porMozo(r: Rango) {
  return consultar(
    pool,
    `SELECT u.id, u.nombre AS mozo, COUNT(*) AS tickets, SUM(c.total) AS venta,
            SUM(c.propina) AS propinas, SUM(c.comensales) AS comensales
     FROM cuentas c JOIN usuarios u ON u.id = c.mozo_id
     WHERE c.estado = 'cerrada' AND DATE(c.cerrada_at) BETWEEN ? AND ?
     GROUP BY u.id, u.nombre ORDER BY venta DESC`,
    [r.desde, r.hasta]
  );
}
