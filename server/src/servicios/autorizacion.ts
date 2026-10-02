import bcrypt from 'bcryptjs';
import { consultar, pool } from '../db/pool.js';
import { sinPermiso } from '../utils/errores.js';
import { auditar } from './auditoria.js';
import type { Rol, UsuarioToken } from '../types/express.js';

interface FilaPin {
  id: number;
  nombre: string;
  rol: Rol;
  pin_hash: string | null;
}

/**
 * Verifica un PIN contra los usuarios activos de los roles indicados.
 * Devuelve quién autorizó, para que quede firmado en la auditoría.
 * Las rutas que lo usan tienen limitador propio: el PIN es de 4-6 dígitos.
 */
export async function autorizarConPin(
  pin: string,
  roles: Rol[] = ['encargado'],
  contexto?: { accion: string; solicitante?: UsuarioToken | null }
): Promise<UsuarioToken> {
  const marcadores = roles.map(() => '?').join(', ');
  const candidatos = await consultar<FilaPin>(
    pool,
    `SELECT id, nombre, rol, pin_hash FROM usuarios
     WHERE activo = 1 AND pin_hash IS NOT NULL AND rol IN (${marcadores})`,
    roles
  );

  for (const c of candidatos) {
    if (c.pin_hash && (await bcrypt.compare(pin, c.pin_hash))) {
      return { id: c.id, nombre: c.nombre, rol: c.rol };
    }
  }

  await auditar({
    actor: contexto?.solicitante ?? null,
    accion: 'pin_rechazado',
    entidad: 'autorizacion',
    motivo: contexto?.accion ?? null,
  });
  throw sinPermiso('PIN incorrecto');
}

/**
 * Autoriza una acción que el propio rol ya puede hacer, o exige PIN si no.
 * El encargado nunca necesita PIN para sus propias acciones.
 */
export async function autorizar(
  solicitante: UsuarioToken,
  opciones: { requierePin: boolean; pin?: string; accion: string; rolesPin?: Rol[] }
): Promise<UsuarioToken> {
  if (!opciones.requierePin || solicitante.rol === 'encargado') return solicitante;
  if (!opciones.pin) throw sinPermiso('Esta acción necesita el PIN del encargado');
  return autorizarConPin(opciones.pin, opciones.rolesPin ?? ['encargado'], {
    accion: opciones.accion,
    solicitante,
  });
}
