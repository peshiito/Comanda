import { consultar, pool } from '../../db/pool.js';

export interface FiltroAuditoria {
  desde?: string;
  hasta?: string;
  accion?: string;
  actor_id?: number;
  entidad?: string;
  entidad_id?: number;
  limite?: number;
}

/** Las acciones que le importan al dueño, agrupadas para filtrar de un toque. */
export const ACCIONES_SENSIBLES = [
  'item_anulado', 'item_devuelto', 'descuento_aplicado', 'cuenta_perdida',
  'cuentas_fusionadas', 'pin_rechazado', 'turno_cerrado', 'precio_cambiado',
  'cuenta_movida', 'item_movido', 'credenciales_cambiadas',
];

export async function consultarAuditoria(filtro: FiltroAuditoria) {
  const donde: string[] = ['1 = 1'];
  const params: unknown[] = [];

  if (filtro.desde) {
    donde.push('DATE(a.creado_at) >= ?');
    params.push(filtro.desde);
  }
  if (filtro.hasta) {
    donde.push('DATE(a.creado_at) <= ?');
    params.push(filtro.hasta);
  }
  if (filtro.accion === 'sensibles') {
    donde.push(`a.accion IN (${ACCIONES_SENSIBLES.map(() => '?').join(',')})`);
    params.push(...ACCIONES_SENSIBLES);
  } else if (filtro.accion) {
    donde.push('a.accion = ?');
    params.push(filtro.accion);
  }
  if (filtro.actor_id) {
    donde.push('a.actor_id = ?');
    params.push(filtro.actor_id);
  }
  if (filtro.entidad) {
    donde.push('a.entidad = ?');
    params.push(filtro.entidad);
  }
  if (filtro.entidad_id) {
    donde.push('a.entidad_id = ?');
    params.push(filtro.entidad_id);
  }

  const limite = Math.min(Math.max(filtro.limite ?? 200, 1), 500);
  return consultar(
    pool,
    `SELECT a.id, a.actor_id, a.actor_nombre, a.actor_rol, a.accion, a.entidad,
            a.entidad_id, a.motivo, a.datos, a.creado_at
     FROM auditoria a
     WHERE ${donde.join(' AND ')}
     ORDER BY a.creado_at DESC LIMIT ${limite}`,
    params
  );
}

/** Resumen del panel: quién anuló cuántas veces y por cuánta plata. */
export async function resumenSensible(desde: string, hasta: string) {
  return consultar(
    pool,
    `SELECT a.accion, a.actor_nombre, COUNT(*) AS veces
     FROM auditoria a
     WHERE DATE(a.creado_at) BETWEEN ? AND ?
       AND a.accion IN (${ACCIONES_SENSIBLES.map(() => '?').join(',')})
     GROUP BY a.accion, a.actor_nombre
     ORDER BY veces DESC`,
    [desde, hasta, ...ACCIONES_SENSIBLES]
  );
}

export async function accionesDisponibles() {
  return consultar<{ accion: string; veces: number }>(
    pool,
    'SELECT accion, COUNT(*) AS veces FROM auditoria GROUP BY accion ORDER BY accion'
  );
}
