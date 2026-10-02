import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { noAutenticado, sinPermiso } from '../utils/errores.js';
import { estadoDeSesion } from '../servicios/sesiones.js';
import type { Rol, UsuarioToken } from '../types/express.js';

/**
 * Un solo algoritmo, fijado de los dos lados. Sin esto, `jwt.verify` acepta
 * cualquiera de los que la librería soporte, y la familia de ataques "alg
 * confusion" vive justo ahí. Acá no hay claves asimétricas, así que la lista
 * es una sola entrada y conviene que sea explícita.
 */
const ALGORITMO = 'HS256' as const;

export function firmarToken(usuario: UsuarioToken): string {
  return jwt.sign(usuario, env.JWT_SECRET, {
    algorithm: ALGORITMO,
    expiresIn: env.JWT_EXPIRA,
  } as jwt.SignOptions);
}

export function leerToken(token: string): UsuarioToken {
  const payload = jwt.verify(token, env.JWT_SECRET, {
    algorithms: [ALGORITMO],
  }) as jwt.JwtPayload & UsuarioToken;
  return { id: payload.id, nombre: payload.nombre, rol: payload.rol };
}

export function autenticar(req: Request, _res: Response, next: NextFunction): void {
  const cabecera = req.headers.authorization;
  if (!cabecera?.startsWith('Bearer ')) return next(noAutenticado());

  let usuario: UsuarioToken;
  try {
    usuario = leerToken(cabecera.slice(7));
  } catch {
    return next(noAutenticado('Sesión vencida o inválida'));
  }

  /**
   * La firma válida no alcanza: el token sigue sirviendo 12 horas aunque al
   * empleado lo hayan dado de baja o le hayan bajado el rango. Se chequea
   * contra la base (con caché corta) para que sacar a alguien le corte la
   * sesión abierta, no sólo el próximo login — y el rol que vale es el de la
   * base, no el que quedó firmado en el token.
   */
  estadoDeSesion(usuario.id)
    .then((estado) => {
      if (!estado) return next(noAutenticado('Tu usuario ya no está activo'));
      req.usuario = { ...usuario, rol: estado.rol };
      next();
    })
    .catch(next);
}

/** Deja pasar solo a los roles indicados. */
export function exigirRol(...roles: Rol[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.usuario) return next(noAutenticado());
    if (!roles.includes(req.usuario.rol)) {
      return next(sinPermiso(`Esta acción es para: ${roles.join(', ')}`));
    }
    next();
  };
}

/** Caja y encargado comparten el juego completo de funciones operativas. */
export const exigirCaja = exigirRol('caja', 'encargado');
export const exigirEncargado = exigirRol('encargado');
/** Mozo, caja y encargado: todo lo que es del salón. */
export const exigirSalon = exigirRol('mozo', 'caja', 'encargado');
