export type Rol = 'encargado' | 'caja' | 'mozo' | 'cocina';

export interface UsuarioToken {
  id: number;
  nombre: string;
  rol: Rol;
}

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioToken;
    }
  }
}
