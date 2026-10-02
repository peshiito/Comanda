import { consultar, ejecutar, pool, transaccion } from '../../db/pool.js';
import { conflicto, malPedido } from '../../utils/errores.js';
import { aCentavos, aPesos } from '../../utils/dinero.js';
import { auditar } from '../../servicios/auditoria.js';
import { autorizar } from '../../servicios/autorizacion.js';
import { valorCentavos } from '../../servicios/config.js';
import { emitir } from '../../sockets/index.js';
import { liberarGrupoSiVacio } from '../salon/mesas.js';
import { bloquearCuenta, recalcular, saldoPendiente, traerCuenta } from './totales.js';
import type { UsuarioToken } from '../../types/express.js';
import type { z } from 'zod';
import type { descuentoSchema, perdidaSchema } from './esquemas.js';

/** Descuento con tope configurable: arranca en cero, o sea siempre pide PIN. */
export async function aplicarDescuento(
  cuentaId: number,
  datos: z.infer<typeof descuentoSchema>,
  actor: UsuarioToken
) {
  const tope = await valorCentavos('descuento_tope_sin_pin');
  const monto = aCentavos(datos.monto);

  const resultado = await transaccion(async (conn) => {
    const cuenta = await bloquearCuenta(conn, cuentaId);
    if (cuenta.estado === 'cerrada' || cuenta.estado === 'perdida') {
      throw conflicto('Esa cuenta ya está cerrada');
    }
    if (monto > aCentavos(cuenta.subtotal) + aCentavos(cuenta.cubierto_total)) {
      throw malPedido('El descuento no puede ser mayor al consumo');
    }
    const autorizante = await autorizar(actor, {
      requierePin: monto > tope,
      pin: datos.pin,
      accion: 'descuento',
    });
    // Va por conn, no por pool: la fila está bloqueada por esta transacción.
    await ejecutar(conn, 'UPDATE cuentas SET descuento = ?, descuento_motivo = ? WHERE id = ?', [
      aPesos(monto), datos.motivo, cuentaId,
    ]);
    return { cuenta: await recalcular(conn, cuentaId), autorizante };
  });

  await auditar({
    actor, accion: 'descuento_aplicado', entidad: 'cuenta', entidad_id: cuentaId,
    motivo: datos.motivo,
    datos: { monto: aPesos(monto), autorizo: resultado.autorizante.nombre },
  });
  emitir(['caja', 'salon'], 'cuenta:cambio', { cuenta_id: cuentaId });
  return resultado.cuenta;
}

export async function definirComensales(cuentaId: number, comensales: number, actor: UsuarioToken) {
  const cuenta = await transaccion(async (conn) => {
    await bloquearCuenta(conn, cuentaId);
    await ejecutar(conn, 'UPDATE cuentas SET comensales = ? WHERE id = ?', [comensales, cuentaId]);
    return recalcular(conn, cuentaId);
  });
  await auditar({
    actor, accion: 'comensales_definidos', entidad: 'cuenta', entidad_id: cuentaId,
    datos: { comensales },
  });
  emitir(['salon', 'caja'], 'cuenta:cambio', { cuenta_id: cuentaId });
  return cuenta;
}

/** Se cambian de mesa: el reloj de la cuenta sigue corriendo, no se reinicia. */
export async function moverCuenta(cuentaId: number, mesaId: number | null, actor: UsuarioToken) {
  const cuenta = await traerCuenta(pool, cuentaId);
  if (cuenta.estado === 'cerrada' || cuenta.estado === 'perdida') {
    throw conflicto('Esa cuenta ya está cerrada');
  }
  const anterior = cuenta.mesa_id;
  await ejecutar(pool, 'UPDATE cuentas SET mesa_id = ? WHERE id = ?', [mesaId, cuentaId]);
  await liberarGrupoSiVacio(anterior);

  await auditar({
    actor, accion: 'cuenta_movida', entidad: 'cuenta', entidad_id: cuentaId,
    datos: { de_mesa: anterior, a_mesa: mesaId },
  });
  emitir(['salon', 'caja'], 'salon:cambio', { motivo: 'cuenta_movida' });
  return { id: cuentaId, mesa_id: mesaId };
}

/**
 * Fusionar cuentas mueve la plata: los ítems pasan con su precio original.
 * La cuenta vaciada no se borra, queda marcada como fusionada.
 */
export async function fusionarCuentas(origenId: number, destinoId: number, actor: UsuarioToken) {
  if (origenId === destinoId) throw malPedido('Son la misma cuenta');

  const resultado = await transaccion(async (conn) => {
    const origen = await bloquearCuenta(conn, origenId);
    const destino = await bloquearCuenta(conn, destinoId);
    if (!['abierta', 'por_cobrar'].includes(origen.estado)) throw conflicto('La cuenta origen no está abierta');
    if (!['abierta', 'por_cobrar'].includes(destino.estado)) throw conflicto('La cuenta destino no está abierta');
    if (aCentavos(origen.pagado) > 0) throw conflicto('La cuenta origen ya tiene pagos: no se puede fusionar');

    await ejecutar(conn, 'UPDATE cuenta_items SET cuenta_id = ? WHERE cuenta_id = ?', [destinoId, origenId]);
    await ejecutar(conn, 'UPDATE comandas SET cuenta_id = ? WHERE cuenta_id = ?', [destinoId, origenId]);
    await ejecutar(
      conn,
      `UPDATE cuentas SET estado = 'fusionada', fusionada_en = ?, cerrada_at = NOW(3),
         comensales = 0, subtotal = 0, cubierto_total = 0, total = 0 WHERE id = ?`,
      [destinoId, origenId]
    );
    await ejecutar(conn, 'UPDATE cuentas SET comensales = comensales + ? WHERE id = ?', [
      origen.comensales, destinoId,
    ]);
    return recalcular(conn, destinoId);
  });

  await auditar({
    actor, accion: 'cuentas_fusionadas', entidad: 'cuenta', entidad_id: destinoId,
    datos: { origen: origenId, destino: destinoId },
  });
  emitir(['salon', 'caja'], 'salon:cambio', { motivo: 'fusion' });
  return resultado;
}

/**
 * Se fueron sin pagar. No se borra: la comida salió y la venta existe.
 * Va a un reporte de pérdidas con motivo, autor y PIN — nunca a la venta del día.
 */
export async function marcarPerdida(
  cuentaId: number,
  datos: z.infer<typeof perdidaSchema>,
  actor: UsuarioToken
) {
  const resultado = await transaccion(async (conn) => {
    const cuenta = await bloquearCuenta(conn, cuentaId);
    if (!['abierta', 'por_cobrar'].includes(cuenta.estado)) throw conflicto('Esa cuenta ya está cerrada');
    const autorizante = await autorizar(actor, {
      requierePin: true, pin: datos.pin, accion: 'cuenta_perdida',
    });
    await ejecutar(
      conn,
      `UPDATE cuentas SET estado = 'perdida', motivo_cierre = ?, cerrada_at = NOW(3) WHERE id = ?`,
      [datos.motivo, cuentaId]
    );
    return { cuenta, autorizante, saldo: saldoPendiente(cuenta) };
  });

  await liberarGrupoSiVacio(resultado.cuenta.mesa_id);
  await auditar({
    actor, accion: 'cuenta_perdida', entidad: 'cuenta', entidad_id: cuentaId,
    motivo: datos.motivo,
    datos: {
      importe: aPesos(resultado.saldo), mesa_id: resultado.cuenta.mesa_id,
      autorizo: resultado.autorizante.nombre,
    },
  });
  emitir(['salon', 'caja'], 'salon:cambio', { motivo: 'perdida' });
  return { id: cuentaId, estado: 'perdida', importe: aPesos(resultado.saldo) };
}

/** Cambio de turno: la mesa se reasigna para que los avisos lleguen al que está. */
export async function asignarMozo(cuentaId: number, mozoId: number | null, actor: UsuarioToken) {
  if (mozoId !== null) {
    const mozos = await consultar<{ id: number }>(
      pool,
      `SELECT id FROM usuarios WHERE id = ? AND activo = 1 AND rol IN ('mozo','encargado','caja')`,
      [mozoId]
    );
    if (!mozos.length) throw malPedido('Ese usuario no puede quedar a cargo de una mesa');
  }
  await ejecutar(pool, 'UPDATE cuentas SET mozo_id = ? WHERE id = ?', [mozoId, cuentaId]);
  await auditar({
    actor, accion: 'mozo_asignado', entidad: 'cuenta', entidad_id: cuentaId,
    datos: { mozo_id: mozoId },
  });
  emitir(['salon', 'caja'], 'cuenta:cambio', { cuenta_id: cuentaId });
  return { id: cuentaId, mozo_id: mozoId };
}
