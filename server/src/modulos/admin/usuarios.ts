import bcrypt from 'bcryptjs';
import { olvidarUsuario } from '../../servicios/sesiones.js';
import { z } from 'zod';
import { consultar, consultarUna, ejecutar, pool } from '../../db/pool.js';
import { malPedido, noEncontrado } from '../../utils/errores.js';
import { auditar } from '../../servicios/auditoria.js';
import type { UsuarioToken } from '../../types/express.js';

export const usuarioSchema = z.object({
  nombre: z.string().min(2).max(80),
  email: z.string().email().nullish(),
  rol: z.enum(['encargado', 'caja', 'mozo', 'cocina']),
  password: z.string().min(6).max(72).nullish(),
  pin: z.string().regex(/^\d{4,6}$/).nullish(),
  activo: z.coerce.boolean().default(true),
});

export const credencialesSchema = z.object({
  password: z.string().min(6).max(72).nullish(),
  pin: z.string().regex(/^\d{4,6}$/).nullish(),
});

type Usuario = z.infer<typeof usuarioSchema>;

export async function listarUsuarios() {
  return consultar(
    pool,
    `SELECT id, nombre, email, rol, activo, creado_at,
            password_hash IS NOT NULL AS tiene_password, pin_hash IS NOT NULL AS tiene_pin
     FROM usuarios ORDER BY activo DESC, FIELD(rol,'encargado','caja','mozo','cocina'), nombre`
  );
}

export async function crearUsuario(datos: Usuario, actor: UsuarioToken) {
  if (!datos.password && !datos.pin) {
    throw malPedido('El usuario necesita al menos una contraseña o un PIN');
  }
  if ((datos.rol === 'encargado' || datos.rol === 'caja') && !datos.email) {
    throw malPedido('Encargado y caja entran con email y contraseña');
  }

  const res = await ejecutar(
    pool,
    `INSERT INTO usuarios (nombre, email, password_hash, pin_hash, rol, activo)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      datos.nombre,
      datos.email?.toLowerCase() || null,
      datos.password ? await bcrypt.hash(datos.password, 10) : null,
      datos.pin ? await bcrypt.hash(datos.pin, 10) : null,
      datos.rol,
      datos.activo ? 1 : 0,
    ]
  );
  await auditar({
    actor, accion: 'usuario_creado', entidad: 'usuario', entidad_id: res.insertId,
    datos: { nombre: datos.nombre, rol: datos.rol },
  });
  return { id: res.insertId };
}

export async function editarUsuario(id: number, datos: Usuario, actor: UsuarioToken) {
  const res = await ejecutar(
    pool,
    'UPDATE usuarios SET nombre = ?, email = ?, rol = ?, activo = ? WHERE id = ?',
    [datos.nombre, datos.email?.toLowerCase() || null, datos.rol, datos.activo ? 1 : 0, id]
  );
  if (!res.affectedRows) throw noEncontrado('Usuario no encontrado');
  await auditar({
    actor, accion: 'usuario_editado', entidad: 'usuario', entidad_id: id,
    datos: { rol: datos.rol, activo: datos.activo },
  });
  // Que el corte no espere a que venza la caché de sesiones.
  olvidarUsuario(id);
  return { id };
}

/** Cambio de credenciales: nunca se registra la contraseña ni el PIN en auditoría. */
export async function cambiarCredenciales(
  id: number,
  datos: z.infer<typeof credencialesSchema>,
  actor: UsuarioToken
) {
  const u = await consultarUna<{ id: number }>(pool, 'SELECT id FROM usuarios WHERE id = ?', [id]);
  if (!u) throw noEncontrado('Usuario no encontrado');
  if (!datos.password && !datos.pin) throw malPedido('No mandaste contraseña ni PIN');

  if (datos.password) {
    await ejecutar(pool, 'UPDATE usuarios SET password_hash = ? WHERE id = ?', [
      await bcrypt.hash(datos.password, 10), id,
    ]);
  }
  if (datos.pin) {
    await ejecutar(pool, 'UPDATE usuarios SET pin_hash = ? WHERE id = ?', [
      await bcrypt.hash(datos.pin, 10), id,
    ]);
  }
  await auditar({
    actor, accion: 'credenciales_cambiadas', entidad: 'usuario', entidad_id: id,
    datos: { password: Boolean(datos.password), pin: Boolean(datos.pin) },
  });
  // Que el corte no espere a que venza la caché de sesiones.
  olvidarUsuario(id);
  return { id };
}

/** Lista corta para asignar mesas. */
export async function mozosActivos() {
  return consultar(
    pool,
    `SELECT id, nombre, rol FROM usuarios
     WHERE activo = 1 AND rol IN ('mozo','caja','encargado') ORDER BY nombre`
  );
}
