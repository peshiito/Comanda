import { consultar, consultarUna, ejecutar, pool } from '../../db/pool.js';
import { conflicto, malPedido, noEncontrado } from '../../utils/errores.js';
import { aCentavos, aPesos } from '../../utils/dinero.js';
import { auditar } from '../../servicios/auditoria.js';
import { valorBool, valorCentavos } from '../../servicios/config.js';
import { emitir } from '../../sockets/index.js';
import { consumirReservaDeMesa } from '../salon/reservas.js';
import { itemsDeCuenta } from './items.js';
import { saldoPendiente, traerCuenta } from './totales.js';
import type { UsuarioToken } from '../../types/express.js';
import type { z } from 'zod';
import type { abrirCuentaSchema } from './esquemas.js';

type Abrir = z.infer<typeof abrirCuentaSchema>;

/** Si la mesa es satélite, la cuenta va a la principal: ahí viven todas. */
async function mesaPrincipal(mesaId: number): Promise<{ id: number; nombre: string }> {
  const m = await consultarUna<{ id: number; nombre: string; unida_a: number | null; activa: number }>(
    pool,
    'SELECT id, nombre, unida_a, activa FROM mesas WHERE id = ?',
    [mesaId]
  );
  if (!m || !m.activa) throw noEncontrado('Mesa no encontrada');
  if (!m.unida_a) return { id: m.id, nombre: m.nombre };
  const principal = await consultarUna<{ id: number; nombre: string }>(
    pool,
    'SELECT id, nombre FROM mesas WHERE id = ?',
    [m.unida_a]
  );
  if (!principal) throw noEncontrado('Mesa principal no encontrada');
  return principal;
}

/**
 * Abre una cuenta. Una mesa puede tener varias abiertas al mismo tiempo:
 * el postre de después, los que llegaron más tarde, el que paga aparte.
 */
export async function abrirCuenta(datos: Abrir, actor: UsuarioToken) {
  let mesaId: number | null = null;

  if (datos.tipo === 'salon') {
    if (!datos.mesa_id) throw malPedido('Falta la mesa');
    mesaId = (await mesaPrincipal(datos.mesa_id)).id;
  } else if (!(await valorBool('take_away_activo'))) {
    throw conflicto('El take away está desactivado');
  }

  const cubiertoActivo = await valorBool('cubierto_activo');
  const cubierto = datos.tipo === 'salon' && cubiertoActivo ? await valorCentavos('cubierto_monto') : 0;

  // El mozo que abre queda a cargo; si abre caja, se asigna después.
  const mozoId = datos.mozo_id ?? (actor.rol === 'mozo' ? actor.id : null);

  const res = await ejecutar(
    pool,
    `INSERT INTO cuentas (tipo, mesa_id, referencia, mozo_id, abierta_por, comensales, cubierto_unitario)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [datos.tipo, mesaId, datos.referencia || null, mozoId, actor.id, datos.comensales, aPesos(cubierto)]
  );

  if (mesaId) await consumirReservaDeMesa(mesaId);

  await auditar({
    actor, accion: 'cuenta_abierta', entidad: 'cuenta', entidad_id: res.insertId,
    datos: { tipo: datos.tipo, mesa_id: mesaId, comensales: datos.comensales },
  });
  emitir(['salon', 'caja'], 'salon:cambio', { motivo: 'cuenta_abierta', mesa_id: mesaId });
  return { id: res.insertId, mesa_id: mesaId };
}

export async function obtenerCuenta(id: number) {
  const cuenta = await consultarUna<Record<string, unknown>>(
    pool,
    `SELECT c.*, m.nombre AS mesa, u.nombre AS mozo, ua.nombre AS abierta_por_nombre
     FROM cuentas c
     LEFT JOIN mesas m ON m.id = c.mesa_id
     LEFT JOIN usuarios u ON u.id = c.mozo_id
     LEFT JOIN usuarios ua ON ua.id = c.abierta_por
     WHERE c.id = ?`,
    [id]
  );
  if (!cuenta) throw noEncontrado('Cuenta no encontrada');

  const [items, pagos, comprobantes, comandas] = await Promise.all([
    itemsDeCuenta(id),
    consultar(
      pool,
      `SELECT p.id, p.medio, p.monto, p.propina, p.recibido, p.vuelto, p.referencia,
              p.creado_at, u.nombre AS usuario
       FROM pagos p JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.cuenta_id = ? ORDER BY p.id`,
      [id]
    ),
    consultar(
      pool,
      `SELECT id, tipo, punto_venta, numero, total, estado, cae, cae_vto, doc_nro, receptor
       FROM comprobantes WHERE cuenta_id = ? ORDER BY id`,
      [id]
    ),
    consultar(
      pool,
      `SELECT id, estado, urgente, enviada_at, terminada_at, retirado_at,
              TIMESTAMPDIFF(MINUTE, enviada_at, COALESCE(terminada_at, NOW())) AS minutos
       FROM comandas WHERE cuenta_id = ? ORDER BY id`,
      [id]
    ),
  ]);

  const fila = await traerCuenta(pool, id);
  return {
    ...cuenta,
    items,
    pagos,
    comprobantes,
    comandas,
    saldo: aPesos(saldoPendiente(fila)),
  };
}

/** Lo que caja tiene que atender: pasadas del mozo, por cobrar y abiertas. */
export async function cuentasAbiertas() {
  return consultar(
    pool,
    `SELECT c.id, c.tipo, c.estado, c.mesa_id, m.nombre AS mesa, c.referencia,
            c.comensales, c.total, c.pagado, c.abierta_at, c.cuenta_pedida_at,
            u.nombre AS mozo,
            (SELECT COUNT(*) FROM cuenta_items i WHERE i.cuenta_id = c.id AND i.estado = 'activo') AS items,
            (SELECT COUNT(*) FROM cuenta_items i WHERE i.cuenta_id = c.id AND i.estado = 'activo' AND i.comanda_id IS NULL AND i.de_barra = 0) AS sin_enviar
     FROM cuentas c
     LEFT JOIN mesas m ON m.id = c.mesa_id
     LEFT JOIN usuarios u ON u.id = c.mozo_id
     WHERE c.estado IN ('abierta','por_cobrar')
     ORDER BY FIELD(c.estado,'por_cobrar','abierta'), c.abierta_at`
  );
}

/** El mozo toca "piden la cuenta": caja ya está imprimiendo mientras él sigue en el salón. */
export async function pedirCuenta(id: number, actor: UsuarioToken) {
  const cuenta = await traerCuenta(pool, id);
  if (cuenta.estado !== 'abierta') throw conflicto(`La cuenta está ${cuenta.estado}`);
  if (aCentavos(cuenta.total) <= 0) throw malPedido('La cuenta no tiene consumo todavía');

  await ejecutar(
    pool,
    `UPDATE cuentas SET estado = 'por_cobrar', cuenta_pedida_at = NOW(3) WHERE id = ?`,
    [id]
  );
  await auditar({ actor, accion: 'cuenta_pedida', entidad: 'cuenta', entidad_id: id });
  emitir(['caja', 'salon'], 'cuenta:pedida', { cuenta_id: id, mesa_id: cuenta.mesa_id });
  return { id, estado: 'por_cobrar' };
}
