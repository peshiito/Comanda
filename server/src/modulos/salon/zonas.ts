/**
 * Zonas del salón: barra, recepción, cocina, entrada, salida.
 *
 * No tienen estado operativo —no se ocupan, no se cobran, no tienen cuenta—
 * así que viven aparte de `mesas` en vez de ser un tipo raro de mesa. Sólo se
 * dibujan, para que el plano se parezca a la sala.
 */
import { consultar, ejecutar, pool } from '../../db/pool.js';
import { noEncontrado } from '../../utils/errores.js';
import { auditar } from '../../servicios/auditoria.js';
import { emitir } from '../../sockets/index.js';
import type { UsuarioToken } from '../../types/express.js';
import type { z } from 'zod';
import type { zonaSchema } from './esquemas.js';

type Zona = z.infer<typeof zonaSchema>;

export async function zonasActivas() {
  return consultar(
    pool,
    `SELECT id, nombre, pos_x, pos_y, ancho, alto, tipo
     FROM salon_zonas WHERE activa = 1 ORDER BY id`
  );
}

export async function crearZona(datos: Zona, actor: UsuarioToken) {
  const res = await ejecutar(
    pool,
    `INSERT INTO salon_zonas (nombre, pos_x, pos_y, ancho, alto, tipo, activa)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [datos.nombre, datos.pos_x, datos.pos_y, datos.ancho, datos.alto, datos.tipo, datos.activa ? 1 : 0]
  );
  await auditar({ actor, accion: 'zona_creada', entidad: 'zona', entidad_id: res.insertId });
  emitir(['salon', 'caja'], 'salon:cambio', { motivo: 'layout' });
  return { id: res.insertId };
}

export async function editarZona(id: number, datos: Zona, actor: UsuarioToken) {
  const res = await ejecutar(
    pool,
    `UPDATE salon_zonas SET nombre = ?, pos_x = ?, pos_y = ?, ancho = ?, alto = ?,
       tipo = ?, activa = ? WHERE id = ?`,
    [
      datos.nombre, datos.pos_x, datos.pos_y, datos.ancho, datos.alto,
      datos.tipo, datos.activa ? 1 : 0, id,
    ]
  );
  if (!res.affectedRows) throw noEncontrado('Zona no encontrada');
  await auditar({ actor, accion: 'zona_editada', entidad: 'zona', entidad_id: id });
  emitir(['salon', 'caja'], 'salon:cambio', { motivo: 'layout' });
  return { id };
}

/** Mover y estirar, sin auditar cada arrastre. */
export async function moverZona(
  id: number,
  pos: { pos_x: number; pos_y: number; ancho?: number; alto?: number }
) {
  const res = await ejecutar(
    pool,
    `UPDATE salon_zonas SET pos_x = ?, pos_y = ?,
       ancho = COALESCE(?, ancho), alto = COALESCE(?, alto)
     WHERE id = ?`,
    [pos.pos_x, pos.pos_y, pos.ancho ?? null, pos.alto ?? null, id]
  );
  if (!res.affectedRows) throw noEncontrado('Zona no encontrada');
  emitir(['salon', 'caja'], 'salon:cambio', { motivo: 'layout' });
  return { id, ...pos };
}
