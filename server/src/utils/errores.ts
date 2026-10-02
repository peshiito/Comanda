export class ErrorApp extends Error {
  constructor(
    public estado: number,
    message: string,
    public codigo?: string,
    public detalle?: unknown
  ) {
    super(message);
    this.name = 'ErrorApp';
  }
}

export const malPedido = (msg: string, codigo?: string, detalle?: unknown) =>
  new ErrorApp(400, msg, codigo, detalle);

export const noAutenticado = (msg = 'No autenticado') => new ErrorApp(401, msg, 'no_autenticado');

export const sinPermiso = (msg = 'No tenés permiso para esta acción') =>
  new ErrorApp(403, msg, 'sin_permiso');

export const noEncontrado = (msg = 'No encontrado') => new ErrorApp(404, msg, 'no_encontrado');

export const conflicto = (msg: string, codigo?: string) => new ErrorApp(409, msg, codigo);

/** La cuenta fue editada por otro usuario mientras la teníamos abierta. */
export const versionVieja = () =>
  new ErrorApp(
    409,
    'Alguien más modificó esta cuenta. Recargá para ver los cambios.',
    'version_vieja'
  );
