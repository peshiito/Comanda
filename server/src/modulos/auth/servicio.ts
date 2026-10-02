import bcrypt from 'bcryptjs';
import { consultar, consultarUna, pool } from '../../db/pool.js';
import { firmarToken } from '../../middlewares/auth.js';
import { noAutenticado } from '../../utils/errores.js';
import { auditar } from '../../servicios/auditoria.js';
import type { Rol, UsuarioToken } from '../../types/express.js';
import type { Login, LoginPin } from './esquemas.js';

interface FilaUsuario {
  id: number;
  nombre: string;
  rol: Rol;
  password_hash: string | null;
  pin_hash: string | null;
}

export interface Sesion {
  token: string;
  usuario: UsuarioToken;
}

function sesion(u: FilaUsuario): Sesion {
  const usuario: UsuarioToken = { id: u.id, nombre: u.nombre, rol: u.rol };
  return { token: firmarToken(usuario), usuario };
}

export async function loginPassword(datos: Login): Promise<Sesion> {
  const u = await consultarUna<FilaUsuario>(
    pool,
    `SELECT id, nombre, rol, password_hash, pin_hash FROM usuarios
     WHERE email = ? AND activo = 1`,
    [datos.email.toLowerCase()]
  );

  if (!u?.password_hash || !(await bcrypt.compare(datos.password, u.password_hash))) {
    await auditar({ accion: 'login_fallido', entidad: 'usuario', motivo: datos.email });
    throw noAutenticado('Email o contraseña incorrectos');
  }

  await auditar({ actor: { id: u.id, nombre: u.nombre, rol: u.rol }, accion: 'login' });
  return sesion(u);
}

export async function loginPin(datos: LoginPin): Promise<Sesion> {
  const u = await consultarUna<FilaUsuario>(
    pool,
    `SELECT id, nombre, rol, password_hash, pin_hash FROM usuarios
     WHERE id = ? AND activo = 1`,
    [datos.usuario_id]
  );

  if (!u?.pin_hash || !(await bcrypt.compare(datos.pin, u.pin_hash))) {
    await auditar({
      accion: 'login_pin_fallido',
      entidad: 'usuario',
      entidad_id: datos.usuario_id,
    });
    throw noAutenticado('PIN incorrecto');
  }

  await auditar({ actor: { id: u.id, nombre: u.nombre, rol: u.rol }, accion: 'login_pin' });
  return sesion(u);
}

/** Lista para la pantalla de PIN: el mozo toca su nombre y tipea el PIN. */
export async function usuariosConPin(): Promise<{ id: number; nombre: string; rol: Rol }[]> {
  return consultar(
    pool,
    `SELECT id, nombre, rol FROM usuarios
     WHERE activo = 1 AND pin_hash IS NOT NULL
     ORDER BY FIELD(rol, 'mozo','cocina','caja','encargado'), nombre`
  );
}
