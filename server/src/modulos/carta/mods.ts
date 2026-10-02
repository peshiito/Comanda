import { ejecutar, pool, transaccion } from '../../db/pool.js';
import { noEncontrado } from '../../utils/errores.js';
import { auditar } from '../../servicios/auditoria.js';
import type { UsuarioToken } from '../../types/express.js';
import type { z } from 'zod';
import type { grupoSchema, opcionSchema } from './esquemas.js';

type Grupo = z.infer<typeof grupoSchema>;
type Opcion = z.infer<typeof opcionSchema>;

export async function crearGrupo(datos: Grupo, actor: UsuarioToken) {
  const res = await ejecutar(
    pool,
    `INSERT INTO modificador_grupos (nombre, obligatorio, min_sel, max_sel, activo)
     VALUES (?, ?, ?, ?, ?)`,
    [datos.nombre, datos.obligatorio ? 1 : 0, datos.min_sel, datos.max_sel, datos.activo ? 1 : 0]
  );
  await auditar({ actor, accion: 'grupo_creado', entidad: 'modificador_grupo', entidad_id: res.insertId });
  return { id: res.insertId };
}

export async function editarGrupo(id: number, datos: Grupo, actor: UsuarioToken) {
  const res = await ejecutar(
    pool,
    `UPDATE modificador_grupos SET nombre = ?, obligatorio = ?, min_sel = ?, max_sel = ?, activo = ?
     WHERE id = ?`,
    [datos.nombre, datos.obligatorio ? 1 : 0, datos.min_sel, datos.max_sel, datos.activo ? 1 : 0, id]
  );
  if (!res.affectedRows) throw noEncontrado('Grupo no encontrado');
  await auditar({ actor, accion: 'grupo_editado', entidad: 'modificador_grupo', entidad_id: id });
  return { id };
}

export async function crearOpcion(grupoId: number, datos: Opcion, actor: UsuarioToken) {
  const res = await ejecutar(
    pool,
    `INSERT INTO modificador_opciones (grupo_id, nombre, delta_precio, orden, activa)
     VALUES (?, ?, ?, ?, ?)`,
    [grupoId, datos.nombre, datos.delta_precio.toFixed(2), datos.orden, datos.activa ? 1 : 0]
  );
  await auditar({ actor, accion: 'opcion_creada', entidad: 'modificador_grupo', entidad_id: grupoId });
  return { id: res.insertId };
}

export async function editarOpcion(id: number, datos: Opcion, actor: UsuarioToken) {
  const res = await ejecutar(
    pool,
    'UPDATE modificador_opciones SET nombre = ?, delta_precio = ?, orden = ?, activa = ? WHERE id = ?',
    [datos.nombre, datos.delta_precio.toFixed(2), datos.orden, datos.activa ? 1 : 0, id]
  );
  if (!res.affectedRows) throw noEncontrado('Opción no encontrada');
  await auditar({ actor, accion: 'opcion_editada', entidad: 'modificador_opcion', entidad_id: id });
  return { id };
}

/** Reemplaza los grupos enganchados a un producto (se enganchan por referencia). */
export async function vincularGrupos(productoId: number, grupoIds: number[], actor: UsuarioToken) {
  await transaccion(async (conn) => {
    await ejecutar(conn, 'DELETE FROM producto_grupos WHERE producto_id = ?', [productoId]);
    for (const [i, grupoId] of grupoIds.entries()) {
      await ejecutar(
        conn,
        'INSERT INTO producto_grupos (producto_id, grupo_id, orden) VALUES (?, ?, ?)',
        [productoId, grupoId, i]
      );
    }
  });
  await auditar({
    actor, accion: 'grupos_vinculados', entidad: 'producto', entidad_id: productoId,
    datos: { grupo_ids: grupoIds },
  });
  return { producto_id: productoId, grupo_ids: grupoIds };
}
