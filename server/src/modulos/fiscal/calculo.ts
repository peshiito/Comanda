import { consultar, pool } from '../../db/pool.js';
import { aCentavos, desglosarIva, sumar } from '../../utils/dinero.js';
import { traerCuenta } from '../cuentas/totales.js';

export interface Impuestos {
  neto: number;
  iva: number;
  total: number;
  por_alicuota: { alicuota: number; base: number; iva: number }[];
}

/**
 * Los precios de la carta son finales con IVA incluido, así que el impuesto se
 * discrimina hacia atrás por alícuota. El descuento se reparte proporcional
 * entre las líneas para no inventar base imponible.
 */
export async function calcularImpuestos(cuentaId: number): Promise<Impuestos> {
  const cuenta = await traerCuenta(pool, cuentaId);
  const lineas = await consultar<{ iva_snapshot: string; total_linea: string }>(
    pool,
    `SELECT iva_snapshot, total_linea FROM cuenta_items
     WHERE cuenta_id = ? AND estado = 'activo'`,
    [cuentaId]
  );

  const grupos = new Map<number, number>();
  for (const l of lineas) {
    const alicuota = Number(l.iva_snapshot);
    grupos.set(alicuota, (grupos.get(alicuota) ?? 0) + aCentavos(l.total_linea));
  }

  const cubierto = aCentavos(cuenta.cubierto_total);
  if (cubierto > 0) grupos.set(21, (grupos.get(21) ?? 0) + cubierto);

  const bruto = sumar(...grupos.values());
  const descuento = aCentavos(cuenta.descuento);

  const por_alicuota: Impuestos['por_alicuota'] = [];
  let netoTotal = 0;
  let ivaTotal = 0;
  let repartido = 0;
  const entradas = [...grupos.entries()];

  entradas.forEach(([alicuota, monto], i) => {
    const esUltima = i === entradas.length - 1;
    const quita = esUltima && bruto > 0
      ? descuento - repartido
      : bruto > 0 ? Math.round((descuento * monto) / bruto) : 0;
    repartido += quita;
    const base = Math.max(monto - quita, 0);
    const { neto, iva } = desglosarIva(base, alicuota);
    netoTotal += neto;
    ivaTotal += iva;
    por_alicuota.push({ alicuota, base, iva });
  });

  return { neto: netoTotal, iva: ivaTotal, total: netoTotal + ivaTotal, por_alicuota };
}
