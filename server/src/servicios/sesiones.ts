/**
 * Vigencia de la sesión contra el estado real del usuario.
 *
 * El token JWT dura 12 horas y no se puede revocar: firmado está firmado. Por
 * eso, hasta ahora, desactivar a un empleado sólo le impedía volver a entrar
 * — su sesión abierta seguía cobrando, aplicando descuentos y mandando a
 * cocina hasta que el token venciera. En un sistema que se vende por el
 * control, "lo saqué a las 21 y siguió cobrando hasta las 9" es justo lo que
 * no puede pasar.
 *
 * Lo mismo vale para el rol, que viaja dentro del token: al que le bajabas el
 * rango seguía teniendo los permisos viejos hasta que el token venciera —
 * degradar al encargado que estabas vigilando no le quitaba nada por doce
 * horas. El rol se edita en la misma pantalla que `activo`, así que se lee en
 * el mismo lugar: la base.
 *
 * Se resuelve mirando `usuarios` en cada pedido, con una caché corta para no
 * agregarle una consulta a cada request del salón. El corte tarda a lo sumo
 * lo que dure la caché, y es inmediato cuando el encargado lo cambia desde la
 * pantalla, porque esa acción invalida la entrada a mano.
 */
import { consultarUna, pool } from '../db/pool.js';
import type { Rol } from '../types/express.js';

/** Suficientemente corto para que el corte se sienta inmediato en el salón. */
const VIGENCIA_MS = 30_000;

/** `null` significa "no puede operar": inactivo o borrado de la base. */
export type EstadoSesion = { rol: Rol } | null;

const cache = new Map<number, { estado: EstadoSesion; hasta: number }>();

export async function estadoDeSesion(id: number): Promise<EstadoSesion> {
  const guardado = cache.get(id);
  if (guardado && guardado.hasta > Date.now()) return guardado.estado;

  const fila = await consultarUna<{ activo: number; rol: Rol }>(
    pool,
    'SELECT activo, rol FROM usuarios WHERE id = ?',
    [id]
  );
  // Un usuario borrado de la base tampoco debe seguir operando.
  const estado: EstadoSesion = fila?.activo ? { rol: fila.rol } : null;
  cache.set(id, { estado, hasta: Date.now() + VIGENCIA_MS });
  return estado;
}

/** Atajo para quien sólo necesita saber si sigue habilitado. */
export async function usuarioSigueActivo(id: number): Promise<boolean> {
  return (await estadoDeSesion(id)) !== null;
}

/** Corta el margen de la caché: al desactivar, cambiar rol o cambiar credenciales. */
export function olvidarUsuario(id: number): void {
  cache.delete(id);
}
