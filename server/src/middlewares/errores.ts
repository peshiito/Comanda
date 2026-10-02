import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { ErrorApp } from '../utils/errores.js';
import { esProduccion } from '../config/env.js';

/** Envuelve handlers async para que los rechazos lleguen al manejador de errores. */
export const asyncHandler =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export function noEncontrado(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Ruta no encontrada' });
}

export function manejarErrores(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'Datos inválidos',
      codigo: 'validacion',
      detalle: error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    });
    return;
  }

  if (error instanceof ErrorApp) {
    res.status(error.estado).json({
      error: error.message,
      codigo: error.codigo,
      detalle: error.detalle,
    });
    return;
  }

  // express.json() tira SyntaxError con `body` cuando el cuerpo no es JSON:
  // eso es culpa del cliente, no del servidor.
  if (error instanceof SyntaxError && 'body' in (error as object)) {
    res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido', codigo: 'json_invalido' });
    return;
  }

  const codigoMysql = (error as { code?: string })?.code;
  if (codigoMysql === 'ER_DUP_ENTRY') {
    // El caso que más aparece es el nombre de una mesa: conviene decirlo.
    const detalle = String((error as { sqlMessage?: string })?.sqlMessage ?? '');
    const esMesa = detalle.includes('mesas');
    res.status(409).json({
      error: esMesa
        ? 'Ya hay una mesa con ese nombre. Puede ser una que sacaste del plano.'
        : 'Ese registro ya existe',
      codigo: 'duplicado',
    });
    return;
  }

  console.error('[error]', error);
  res.status(500).json({
    error: 'Error interno del servidor',
    detalle: esProduccion ? undefined : String((error as Error)?.message ?? error),
  });
}
