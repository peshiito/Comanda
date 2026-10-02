import { consultar, consultarUna, ejecutar, pool, transaccion } from '../../db/pool.js';
import { conflicto, malPedido } from '../../utils/errores.js';
import { aCentavos, aPesos, repartir, sumar } from '../../utils/dinero.js';
import { auditar } from '../../servicios/auditoria.js';
import { emitir } from '../../sockets/index.js';
import { liberarGrupoSiVacio } from '../salon/mesas.js';
import { bloquearCuenta, saldoPendiente } from '../cuentas/totales.js';
import { emitirComprobante } from '../fiscal/servicio.js';
import { exigirTurnoAbierto } from './turnos.js';
import type { UsuarioToken } from '../../types/express.js';
import type { z } from 'zod';
import type { cobrarSchema } from './esquemas.js';

type Cobro = z.infer<typeof cobrarSchema>;

async function yaAplicado(clave: string): Promise<boolean> {
  const previo = await consultarUna<{ id: number }>(
    pool,
    'SELECT id FROM pagos WHERE idempotency_key LIKE ? LIMIT 1',
    [`${clave}:%`]
  );
  return Boolean(previo);
}

/**
 * La respuesta para un cobro que ya se hizo: el estado actual de la cuenta,
 * sin volver a tocar nada.
 */
async function yaEstaba(cuentaId: number) {
  const cuenta = await bloquearCuenta(pool, cuentaId);
  return { repetido: true, cuenta, saldo: aPesos(saldoPendiente(cuenta)) };
}

/** El cobro propiamente dicho, en una sola transacción. */
function aplicarCobro(cuentaId: number, datos: Cobro, actor: UsuarioToken, turnoId: number) {
  return transaccion(async (conn) => {
    const cuenta = await bloquearCuenta(conn, cuentaId);
    if (!['abierta', 'por_cobrar'].includes(cuenta.estado)) {
      throw conflicto(`Esa cuenta está ${cuenta.estado}`);
    }

    const saldo = saldoPendiente(cuenta);
    const total = sumar(...datos.pagos.map((p) => aCentavos(p.monto)));
    if (total > saldo) {
      throw malPedido(
        `El pago (${aPesos(total)}) supera el saldo de la cuenta (${aPesos(saldo)})`,
        'pago_excede'
      );
    }

    const propina = aCentavos(datos.propina);
    for (const [i, p] of datos.pagos.entries()) {
      const montoPago = aCentavos(p.monto);
      const recibido = p.medio === 'efectivo' && p.recibido ? aCentavos(p.recibido) : null;
      const vuelto = recibido !== null ? Math.max(recibido - montoPago - (i === 0 ? propina : 0), 0) : null;
      await ejecutar(
        conn,
        `INSERT INTO pagos
           (cuenta_id, turno_id, medio, monto, propina, recibido, vuelto, referencia,
            idempotency_key, usuario_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cuentaId, turnoId, p.medio, aPesos(montoPago), i === 0 ? aPesos(propina) : '0.00',
          recibido !== null ? aPesos(recibido) : null,
          vuelto !== null ? aPesos(vuelto) : null,
          p.referencia || null, `${datos.idempotency_key}:${i}`, actor.id,
        ]
      );
    }

    const pagadoNuevo = aCentavos(cuenta.pagado) + total;
    const cerrada = pagadoNuevo >= aCentavos(cuenta.total);
    await ejecutar(
      conn,
      `UPDATE cuentas SET pagado = ?, propina = propina + ?,
         estado = ?, cerrada_at = ${cerrada ? 'NOW(3)' : 'cerrada_at'}
       WHERE id = ?`,
      [aPesos(pagadoNuevo), aPesos(propina), cerrada ? 'cerrada' : 'por_cobrar', cuentaId]
    );

    /**
     * El rastro va en el mismo commit que el cobro. Estaba después, y entre el
     * commit y el INSERT de auditoría quedaba una ventana —corta, pero real—
     * en la que existía un cobro sin rastro de quién lo hizo. En un sistema
     * que se vende por el control, ese es el registro que no puede faltar.
     * `auditar` sigue sin lanzar: una falla de bitácora no tumba una venta.
     */
    await auditar({
      actor, accion: cerrada ? 'cuenta_cobrada' : 'cobro_parcial',
      entidad: 'cuenta', entidad_id: cuentaId,
      datos: {
        cobrado: aPesos(total), propina: aPesos(propina),
        medios: datos.pagos.map((p) => p.medio), turno_id: turnoId,
      },
    }, conn);

    const final = await bloquearCuenta(conn, cuentaId);
    return { cuenta: final, cerrada, cobrado: total, propina, mesa_id: cuenta.mesa_id };
  });
}

/**
 * Cobra una cuenta. Acepta pago mixto y pago parcial: los pagos son varios
 * registros contra una cuenta, no un campo "forma de pago" — sin eso, el que
 * se va antes de pagar te arruina el arqueo.
 */
export async function cobrar(cuentaId: number, datos: Cobro, actor: UsuarioToken) {
  const turno = await exigirTurnoAbierto();

  if (await yaAplicado(datos.idempotency_key)) return yaEstaba(cuentaId);

  let resultado: Awaited<ReturnType<typeof aplicarCobro>>;
  try {
    resultado = await aplicarCobro(cuentaId, datos, actor, turno.id);
  } catch (error) {
    /**
     * El chequeo de arriba no es atómico: si el mozo toca "cobrar" dos veces
     * en el mismo instante, los dos pedidos lo pasan y el segundo choca con
     * el UNIQUE de `idempotency_key`. La plata está bien — la transacción se
     * deshace entera y no se cobra dos veces —, pero el cliente recibía un
     * 409 "ese registro ya existe", que en la pantalla de caja se lee como si
     * el cobro hubiera fallado. La respuesta correcta es la misma que para
     * cualquier repetición: ya está hecho.
     */
    if ((error as { code?: string })?.code === 'ER_DUP_ENTRY'
        && String((error as { sqlMessage?: string })?.sqlMessage ?? '').includes('idempotency_key')) {
      return yaEstaba(cuentaId);
    }
    throw error;
  }

  if (resultado.cerrada) await liberarGrupoSiVacio(resultado.mesa_id);

  let comprobante = null;
  if (datos.comprobante && resultado.cerrada) {
    comprobante = await emitirComprobante(cuentaId, datos.comprobante, actor);
  }

  emitir(['caja', 'salon'], resultado.cerrada ? 'cuenta:cerrada' : 'cuenta:cambio', {
    cuenta_id: cuentaId,
    mesa_id: resultado.mesa_id,
  });

  return {
    repetido: false,
    cuenta: resultado.cuenta,
    cerrada: resultado.cerrada,
    saldo: aPesos(saldoPendiente(resultado.cuenta)),
    comprobante,
  };
}

/** Partes iguales: el 80% de las divisiones de cuenta del mundo real. */
export async function dividirEnPartes(cuentaId: number, partes: number) {
  const cuenta = await bloquearCuenta(pool, cuentaId);
  const saldo = saldoPendiente(cuenta);
  return {
    cuenta_id: cuentaId,
    partes,
    saldo: aPesos(saldo),
    montos: repartir(saldo, partes).map(aPesos),
  };
}

export async function pagosDelTurno(turnoId?: number) {
  const turno = turnoId ?? (await exigirTurnoAbierto()).id;
  return consultar(
    pool,
    `SELECT p.id, p.cuenta_id, p.medio, p.monto, p.propina, p.referencia, p.creado_at,
            u.nombre AS usuario, m.nombre AS mesa
     FROM pagos p
     JOIN usuarios u ON u.id = p.usuario_id
     JOIN cuentas c ON c.id = p.cuenta_id
     LEFT JOIN mesas m ON m.id = c.mesa_id
     WHERE p.turno_id = ? ORDER BY p.id DESC LIMIT 200`,
    [turno]
  );
}
