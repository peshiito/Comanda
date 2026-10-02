import { ejecutar, pool, type Ejecutor } from '../db/pool.js';
import type { UsuarioToken } from '../types/express.js';

export interface EntradaAuditoria {
  actor?: UsuarioToken | null;
  accion: string;
  entidad?: string;
  entidad_id?: number | string | null;
  motivo?: string | null;
  datos?: unknown;
}

/**
 * Escribe en la bitácora. Es append-only: nunca se actualiza ni se borra.
 * No lanza: una falla de auditoría no puede tumbar una venta, pero se loguea.
 */
export async function auditar(entrada: EntradaAuditoria, ejecutor: Ejecutor = pool): Promise<void> {
  try {
    await ejecutar(
      ejecutor,
      `INSERT INTO auditoria
         (actor_id, actor_nombre, actor_rol, accion, entidad, entidad_id, motivo, datos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entrada.actor?.id ?? null,
        entrada.actor?.nombre ?? null,
        entrada.actor?.rol ?? null,
        entrada.accion,
        entrada.entidad ?? null,
        entrada.entidad_id ?? null,
        entrada.motivo ?? null,
        entrada.datos === undefined ? null : JSON.stringify(entrada.datos),
      ]
    );
  } catch (error) {
    console.error('[auditoria] no se pudo registrar', entrada.accion, error);
  }
}
