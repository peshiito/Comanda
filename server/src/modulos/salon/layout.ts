import { ejecutar, pool } from '../../db/pool.js';
import { noEncontrado } from '../../utils/errores.js';
import { auditar } from '../../servicios/auditoria.js';
import { emitir } from '../../sockets/index.js';
import type { UsuarioToken } from '../../types/express.js';
import type { z } from 'zod';
import type { mesaSchema, posicionSchema } from './esquemas.js';

type Mesa = z.infer<typeof mesaSchema>;
type Posicion = z.infer<typeof posicionSchema>;

export async function crearMesa(datos: Mesa, actor: UsuarioToken) {
  const res = await ejecutar(
    pool,
    `INSERT INTO mesas (nombre, capacidad, pos_x, pos_y, ancho, alto, forma, activa)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.nombre, datos.capacidad, datos.pos_x, datos.pos_y,
      datos.ancho, datos.alto, datos.forma, datos.activa ? 1 : 0,
    ]
  );
  await auditar({ actor, accion: 'mesa_creada', entidad: 'mesa', entidad_id: res.insertId });
  emitir(['salon', 'caja'], 'salon:cambio', { motivo: 'layout' });
  return { id: res.insertId };
}

/**
 * `mesas.nombre` es UNIQUE, así que una mesa retirada sigue reteniendo su
 * número y no se lo podés poner a otra. Al sacarla del plano le marcamos el
 * nombre para liberarlo: si no, armar el salón se vuelve imposible apenas
 * borrás una mesa y querés renumerar.
 *
 * Queda legible en los tickets viejos ("Mesa 12 (ret)" dice más que un número
 * suelto) y el id, que es lo que referencian las cuentas, no se toca.
 */
function nombreRetirado(nombre: string): string {
  const marca = ' (ret)';
  if (nombre.endsWith(marca)) return nombre;
  return nombre.slice(0, 20 - marca.length) + marca;
}

export async function editarMesa(id: number, datos: Mesa, actor: UsuarioToken) {
  const nombre = datos.activa ? datos.nombre : nombreRetirado(datos.nombre);
  const res = await ejecutar(
    pool,
    `UPDATE mesas SET nombre = ?, capacidad = ?, pos_x = ?, pos_y = ?,
       ancho = ?, alto = ?, forma = ?, activa = ? WHERE id = ?`,
    [
      nombre, datos.capacidad, datos.pos_x, datos.pos_y,
      datos.ancho, datos.alto, datos.forma, datos.activa ? 1 : 0, id,
    ]
  );
  if (!res.affectedRows) throw noEncontrado('Mesa no encontrada');
  await auditar({ actor, accion: 'mesa_editada', entidad: 'mesa', entidad_id: id });
  emitir(['salon', 'caja'], 'salon:cambio', { motivo: 'layout' });
  return { id };
}

/** Mover la mesa en el mapa: se usa mucho al armar el salón, sin auditar cada arrastre. */
/**
 * Mover y estirar son la misma operación: arrastrar la esquina de una mesa
 * cambia posición y tamaño a la vez, y mandarlo en dos llamadas haría que el
 * plano parpadee en un estado intermedio.
 */
export async function moverMesa(id: number, pos: Posicion) {
  const res = await ejecutar(
    pool,
    `UPDATE mesas SET pos_x = ?, pos_y = ?,
       ancho = COALESCE(?, ancho), alto = COALESCE(?, alto)
     WHERE id = ?`,
    [pos.pos_x, pos.pos_y, pos.ancho ?? null, pos.alto ?? null, id]
  );
  if (!res.affectedRows) throw noEncontrado('Mesa no encontrada');
  emitir(['salon', 'caja'], 'salon:cambio', { motivo: 'layout' });
  return { id, ...pos };
}
