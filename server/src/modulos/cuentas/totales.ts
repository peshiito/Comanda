import { consultar, consultarUna, ejecutar, type Ejecutor } from '../../db/pool.js';
import { noEncontrado, versionVieja } from '../../utils/errores.js';
import { aCentavos, aPesos, sumar } from '../../utils/dinero.js';

export interface FilaCuenta {
  id: number;
  tipo: 'salon' | 'take_away';
  mesa_id: number | null;
  mozo_id: number | null;
  comensales: number;
  estado: 'abierta' | 'por_cobrar' | 'cerrada' | 'perdida' | 'fusionada';
  cubierto_unitario: string;
  subtotal: string;
  cubierto_total: string;
  descuento: string;
  total: string;
  pagado: string;
  propina: string;
  version: number;
}

const CAMPOS = `id, tipo, mesa_id, mozo_id, comensales, estado, cubierto_unitario,
  subtotal, cubierto_total, descuento, total, pagado, propina, version`;

export async function traerCuenta(ejecutor: Ejecutor, id: number): Promise<FilaCuenta> {
  const c = await consultarUna<FilaCuenta>(ejecutor, `SELECT ${CAMPOS} FROM cuentas WHERE id = ?`, [id]);
  if (!c) throw noEncontrado('Cuenta no encontrada');
  return c;
}

/** Bloquea la fila: dos meseros pueden tocar la misma mesa al mismo tiempo. */
export async function bloquearCuenta(
  ejecutor: Ejecutor,
  id: number,
  versionEsperada?: number
): Promise<FilaCuenta> {
  const c = await consultarUna<FilaCuenta>(
    ejecutor,
    `SELECT ${CAMPOS} FROM cuentas WHERE id = ? FOR UPDATE`,
    [id]
  );
  if (!c) throw noEncontrado('Cuenta no encontrada');
  if (versionEsperada !== undefined && versionEsperada !== c.version) throw versionVieja();
  return c;
}

/**
 * Recalcula subtotal, cubierto y total desde los ítems activos.
 * Lo que manda el cliente es intención: el total siempre lo hace el servidor.
 */
export async function recalcular(ejecutor: Ejecutor, cuentaId: number): Promise<FilaCuenta> {
  const cuenta = await traerCuenta(ejecutor, cuentaId);

  const filas = await consultar<{ total_linea: string }>(
    ejecutor,
    `SELECT total_linea FROM cuenta_items WHERE cuenta_id = ? AND estado = 'activo'`,
    [cuentaId]
  );
  const subtotal = sumar(...filas.map((f) => aCentavos(f.total_linea)));

  const cubiertoUnit = aCentavos(cuenta.cubierto_unitario);
  const cubierto = cuenta.tipo === 'salon' ? cubiertoUnit * cuenta.comensales : 0;
  const descuento = aCentavos(cuenta.descuento);
  const total = Math.max(subtotal + cubierto - descuento, 0);

  await ejecutar(
    ejecutor,
    `UPDATE cuentas SET subtotal = ?, cubierto_total = ?, total = ?, version = version + 1
     WHERE id = ?`,
    [aPesos(subtotal), aPesos(cubierto), aPesos(total), cuentaId]
  );

  return traerCuenta(ejecutor, cuentaId);
}

export function saldoPendiente(cuenta: FilaCuenta): number {
  return aCentavos(cuenta.total) - aCentavos(cuenta.pagado);
}
