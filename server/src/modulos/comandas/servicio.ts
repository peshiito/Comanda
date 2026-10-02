import { consultar, consultarUna, ejecutar, pool, type Ejecutor } from '../../db/pool.js';
import { conflicto, malPedido, noEncontrado } from '../../utils/errores.js';
import { auditar } from '../../servicios/auditoria.js';
import { emitir } from '../../sockets/index.js';
import type { UsuarioToken } from '../../types/express.js';

/** "Mesa 7+8" para que el que lleva los platos sepa a dónde va. */
export async function etiquetaMesa(ejecutor: Ejecutor, cuentaId: number): Promise<string> {
  const c = await consultarUna<{
    mesa_id: number | null; nombre: string | null; referencia: string | null; tipo: string;
  }>(
    ejecutor,
    `SELECT c.mesa_id, m.nombre, c.referencia, c.tipo
     FROM cuentas c LEFT JOIN mesas m ON m.id = c.mesa_id WHERE c.id = ?`,
    [cuentaId]
  );
  if (!c) throw noEncontrado('Cuenta no encontrada');
  if (!c.mesa_id) return c.referencia ? `Take away: ${c.referencia}` : 'Take away';

  const satelites = await consultar<{ nombre: string }>(
    ejecutor,
    'SELECT nombre FROM mesas WHERE unida_a = ? ORDER BY nombre',
    [c.mesa_id]
  );
  const extra = satelites.map((s) => s.nombre.replace(/\D/g, '') || s.nombre).join('+');
  return extra ? `${c.nombre}+${extra}` : `${c.nombre}`;
}

export interface OpcionesComanda {
  urgente?: boolean;
  nota?: string | null;
}

/** Manda a cocina todos los ítems activos que todavía no tienen comanda. */
export async function crearComanda(
  ejecutor: Ejecutor,
  cuentaId: number,
  opciones: OpcionesComanda,
  actor: UsuarioToken
): Promise<{ id: number; items: number; mesa_label: string }> {
  // Lo de barra nunca entra a una comanda: ya se lo llevó el mozo.
  const sinEnviar = await consultar<{ id: number }>(
    ejecutor,
    `SELECT id FROM cuenta_items
     WHERE cuenta_id = ? AND estado = 'activo' AND comanda_id IS NULL AND de_barra = 0`,
    [cuentaId]
  );
  if (!sinEnviar.length) {
    const barra = await consultar<{ id: number }>(
      ejecutor,
      `SELECT id FROM cuenta_items
       WHERE cuenta_id = ? AND estado = 'activo' AND comanda_id IS NULL AND de_barra = 1`,
      [cuentaId]
    );
    throw malPedido(
      barra.length
        ? 'Lo que falta es todo de barra: ya está en la cuenta y lo lleva el mozo, no va a cocina'
        : 'No hay ítems nuevos para mandar a cocina'
    );
  }

  const mesaLabel = await etiquetaMesa(ejecutor, cuentaId);
  const res = await ejecutar(
    ejecutor,
    `INSERT INTO comandas (cuenta_id, mesa_label, urgente, nota, enviada_por)
     VALUES (?, ?, ?, ?, ?)`,
    [cuentaId, mesaLabel, opciones.urgente ? 1 : 0, opciones.nota || null, actor.id]
  );
  await ejecutar(
    ejecutor,
    `UPDATE cuenta_items SET comanda_id = ?
     WHERE cuenta_id = ? AND estado = 'activo' AND comanda_id IS NULL AND de_barra = 0`,
    [res.insertId, cuentaId]
  );

  await auditar(
    {
      actor, accion: 'comanda_enviada', entidad: 'comanda', entidad_id: res.insertId,
      datos: { cuenta_id: cuentaId, items: sinEnviar.length, urgente: Boolean(opciones.urgente) },
    },
    ejecutor
  );
  return { id: res.insertId, items: sinEnviar.length, mesa_label: mesaLabel };
}

export async function avisarComandaNueva(comandaId: number): Promise<void> {
  emitir(['cocina', 'caja'], 'comanda:nueva', { comanda_id: comandaId });
}

export async function terminar(comandaId: number, actor: UsuarioToken) {
  const c = await consultarUna<{ estado: string; cuenta_id: number; mesa_label: string }>(
    pool,
    'SELECT estado, cuenta_id, mesa_label FROM comandas WHERE id = ?',
    [comandaId]
  );
  if (!c) throw noEncontrado('Comanda no encontrada');
  if (c.estado === 'terminada') throw conflicto('Esa comanda ya estaba terminada');

  await ejecutar(
    pool,
    `UPDATE comandas SET estado = 'terminada', terminada_por = ?, terminada_at = NOW(3)
     WHERE id = ?`,
    [actor.id, comandaId]
  );
  const mozo = await consultarUna<{ mozo_id: number | null }>(
    pool, 'SELECT mozo_id FROM cuentas WHERE id = ?', [c.cuenta_id]
  );

  await auditar({ actor, accion: 'comanda_terminada', entidad: 'comanda', entidad_id: comandaId });
  const salas = ['cocina', 'caja', 'salon'] as const;
  emitir([...salas], 'comanda:terminada', { comanda_id: comandaId, mesa: c.mesa_label });
  if (mozo?.mozo_id) {
    emitir(`mozo:${mozo.mozo_id}`, 'plato:listo', { comanda_id: comandaId, mesa: c.mesa_label });
  }
  return { id: comandaId, estado: 'terminada' };
}

/** Deshacer vive 30 segundos: después lo arregla caja. */
export async function deshacer(comandaId: number, actor: UsuarioToken) {
  const c = await consultarUna<{ terminada_at: Date | null; segundos: number }>(
    pool,
    `SELECT terminada_at, TIMESTAMPDIFF(SECOND, terminada_at, NOW()) AS segundos
     FROM comandas WHERE id = ? AND estado = 'terminada'`,
    [comandaId]
  );
  if (!c?.terminada_at) throw noEncontrado('Esa comanda no está terminada');
  if (c.segundos > 30 && actor.rol === 'cocina') {
    throw conflicto('Pasaron más de 30 segundos: pedile a caja que lo corrija');
  }

  await ejecutar(
    pool,
    `UPDATE comandas SET estado = 'pendiente', terminada_por = NULL, terminada_at = NULL,
       retirado_por = NULL, retirado_at = NULL WHERE id = ?`,
    [comandaId]
  );
  await auditar({ actor, accion: 'comanda_deshecha', entidad: 'comanda', entidad_id: comandaId });
  emitir(['cocina', 'caja', 'salon'], 'comanda:cambio', { comanda_id: comandaId });
  return { id: comandaId, estado: 'pendiente' };
}

export async function marcarUrgente(comandaId: number, urgente: boolean, actor: UsuarioToken) {
  const res = await ejecutar(pool, 'UPDATE comandas SET urgente = ? WHERE id = ?', [
    urgente ? 1 : 0,
    comandaId,
  ]);
  if (!res.affectedRows) throw noEncontrado('Comanda no encontrada');
  await auditar({
    actor, accion: urgente ? 'comanda_urgente' : 'comanda_normal',
    entidad: 'comanda', entidad_id: comandaId,
  });
  emitir(['cocina', 'caja'], 'comanda:cambio', { comanda_id: comandaId });
  return { id: comandaId, urgente };
}

/** El mozo apaga el aviso con un toque: la forma más liviana de "lo llevé". */
export async function marcarRetirado(comandaId: number, actor: UsuarioToken) {
  const res = await ejecutar(
    pool,
    `UPDATE comandas SET retirado_por = ?, retirado_at = NOW(3)
     WHERE id = ? AND estado = 'terminada' AND retirado_at IS NULL`,
    [actor.id, comandaId]
  );
  if (!res.affectedRows) throw conflicto('Esa comanda no está lista o ya se retiró');
  await auditar({ actor, accion: 'plato_retirado', entidad: 'comanda', entidad_id: comandaId });
  emitir(['salon', 'caja'], 'comanda:cambio', { comanda_id: comandaId });
  return { id: comandaId, retirado: true };
}
