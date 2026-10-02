import { consultar, consultarUna, ejecutar, transaccion } from '../../db/pool.js';
import { pool } from '../../db/pool.js';
import { conflicto, malPedido, noEncontrado } from '../../utils/errores.js';
import { auditar } from '../../servicios/auditoria.js';
import { emitir } from '../../sockets/index.js';
import type { UsuarioToken } from '../../types/express.js';

interface FilaMesa {
  id: number;
  nombre: string;
  capacidad: number;
  unida_a: number | null;
  activa: number;
}

async function traerMesa(id: number): Promise<FilaMesa> {
  const m = await consultarUna<FilaMesa>(
    pool,
    'SELECT id, nombre, capacidad, unida_a, activa FROM mesas WHERE id = ?',
    [id]
  );
  if (!m) throw noEncontrado('Mesa no encontrada');
  return m;
}

/**
 * Unir es del espacio físico: los satélites apuntan siempre a la principal
 * (sin cadenas) y sus cuentas abiertas se mudan a la principal, que es la que
 * contiene todas las cuentas del grupo. Soporta N mesas, no pares.
 */
export async function unirMesas(principalId: number, mesaIds: number[], actor: UsuarioToken) {
  const principal = await traerMesa(principalId);
  if (principal.unida_a) {
    throw conflicto(`La ${principal.nombre} ya está unida a otra mesa. Uní a la principal.`, 'no_cadenas');
  }

  const avisos: string[] = [];

  await transaccion(async (conn) => {
    for (const id of mesaIds) {
      if (id === principalId) throw malPedido('No se puede unir una mesa a sí misma');
      const mesa = await traerMesa(id);
      const tieneSatelites = await consultarUna<{ n: number }>(
        conn, 'SELECT COUNT(*) AS n FROM mesas WHERE unida_a = ?', [id]
      );
      if (tieneSatelites && tieneSatelites.n > 0) {
        throw conflicto(`La ${mesa.nombre} ya es principal de otro grupo. Desunila primero.`);
      }
      await ejecutar(conn, 'UPDATE mesas SET unida_a = ? WHERE id = ?', [principalId, id]);
      // Las cuentas abiertas del satélite pasan a la principal.
      await ejecutar(
        conn,
        `UPDATE cuentas SET mesa_id = ? WHERE mesa_id = ? AND estado IN ('abierta','por_cobrar')`,
        [principalId, id]
      );
      const reserva = await consultarUna<{ nombre: string }>(
        conn,
        `SELECT nombre FROM reservas WHERE mesa_id = ? AND estado = 'pendiente'
           AND fecha_hora BETWEEN NOW() AND (NOW() + INTERVAL 3 HOUR) LIMIT 1`,
        [id]
      );
      if (reserva) avisos.push(`La ${mesa.nombre} tiene reserva de ${reserva.nombre}`);
    }

    const grupo = await consultar<FilaMesa>(
      conn, 'SELECT capacidad FROM mesas WHERE id = ? OR unida_a = ?', [principalId, principalId]
    );
    const capacidad = grupo.reduce((a, m) => a + m.capacidad, 0);
    const comensales = await consultarUna<{ n: number }>(
      conn,
      `SELECT COALESCE(SUM(comensales), 0) AS n FROM cuentas
       WHERE mesa_id = ? AND estado IN ('abierta','por_cobrar')`,
      [principalId]
    );
    // La capacidad avisa pero no bloquea: la realidad del salón manda.
    if (comensales && comensales.n > capacidad) {
      avisos.push(`El grupo es de ${comensales.n} y las mesas suman ${capacidad} lugares`);
    }
  });

  await auditar({
    actor, accion: 'mesas_unidas', entidad: 'mesa', entidad_id: principalId,
    datos: { satelites: mesaIds },
  });
  emitir(['salon', 'caja'], 'salon:cambio', { motivo: 'union', mesa_id: principalId });
  return { principal_id: principalId, satelites: mesaIds, avisos };
}

export async function desunirMesa(mesaId: number, actor: UsuarioToken) {
  const mesa = await traerMesa(mesaId);
  if (!mesa.unida_a) throw malPedido(`La ${mesa.nombre} no está unida a ninguna mesa`);
  await ejecutar(pool, 'UPDATE mesas SET unida_a = NULL WHERE id = ?', [mesaId]);
  await auditar({ actor, accion: 'mesa_desunida', entidad: 'mesa', entidad_id: mesaId });
  emitir(['salon', 'caja'], 'salon:cambio', { motivo: 'desunion', mesa_id: mesaId });
  return { id: mesaId };
}

/** Se levantan los de la 7 y quedan los de la 8: la 8 pasa a ser principal. */
export async function cambiarPrincipal(nuevaId: number, actor: UsuarioToken) {
  const nueva = await traerMesa(nuevaId);
  if (!nueva.unida_a) throw malPedido('Esa mesa ya es principal');
  const anteriorId = nueva.unida_a;

  await transaccion(async (conn) => {
    await ejecutar(conn, 'UPDATE mesas SET unida_a = NULL WHERE id = ?', [nuevaId]);
    await ejecutar(conn, 'UPDATE mesas SET unida_a = ? WHERE unida_a = ?', [nuevaId, anteriorId]);
    await ejecutar(conn, 'UPDATE mesas SET unida_a = ? WHERE id = ?', [nuevaId, anteriorId]);
    await ejecutar(
      conn,
      `UPDATE cuentas SET mesa_id = ? WHERE mesa_id = ? AND estado IN ('abierta','por_cobrar')`,
      [nuevaId, anteriorId]
    );
  });

  await auditar({
    actor, accion: 'mesa_principal_cambiada', entidad: 'mesa', entidad_id: nuevaId,
    datos: { anterior: anteriorId },
  });
  emitir(['salon', 'caja'], 'salon:cambio', { motivo: 'principal', mesa_id: nuevaId });
  return { principal_id: nuevaId, anterior_id: anteriorId };
}

/** Al cerrar la última cuenta el grupo se desune solo: nadie se acuerda de hacerlo. */
export async function liberarGrupoSiVacio(mesaId: number | null): Promise<void> {
  if (!mesaId) return;
  const abiertas = await consultarUna<{ n: number }>(
    pool,
    `SELECT COUNT(*) AS n FROM cuentas WHERE mesa_id = ? AND estado IN ('abierta','por_cobrar')`,
    [mesaId]
  );
  if (abiertas && abiertas.n === 0) {
    await ejecutar(pool, 'UPDATE mesas SET unida_a = NULL WHERE unida_a = ?', [mesaId]);
    await ejecutar(pool, `DELETE FROM borradores WHERE mesa_id = ? AND estado <> 'consumido'`, [mesaId]);
  }
}
