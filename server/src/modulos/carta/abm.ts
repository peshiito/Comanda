import { consultarUna, ejecutar, pool } from '../../db/pool.js';
import { noEncontrado } from '../../utils/errores.js';
import { auditar } from '../../servicios/auditoria.js';
import type { UsuarioToken } from '../../types/express.js';
import type { z } from 'zod';
import type { categoriaSchema, productoSchema, varianteSchema } from './esquemas.js';

type Categoria = z.infer<typeof categoriaSchema>;
type Producto = z.infer<typeof productoSchema>;
type Variante = z.infer<typeof varianteSchema>;

export async function crearCategoria(datos: Categoria, actor: UsuarioToken) {
  const res = await ejecutar(
    pool,
    'INSERT INTO categorias (nombre, orden, activa) VALUES (?, ?, ?)',
    [datos.nombre, datos.orden, datos.activa ? 1 : 0]
  );
  await auditar({ actor, accion: 'categoria_creada', entidad: 'categoria', entidad_id: res.insertId });
  return { id: res.insertId };
}

export async function editarCategoria(id: number, datos: Categoria, actor: UsuarioToken) {
  const res = await ejecutar(
    pool,
    'UPDATE categorias SET nombre = ?, orden = ?, activa = ? WHERE id = ?',
    [datos.nombre, datos.orden, datos.activa ? 1 : 0, id]
  );
  if (!res.affectedRows) throw noEncontrado('Categoría no encontrada');
  await auditar({ actor, accion: 'categoria_editada', entidad: 'categoria', entidad_id: id });
  return { id };
}

const CAMPOS_PRODUCTO = `categoria_id = ?, nombre = ?, descripcion = ?, codigo_corto = ?,
  precio = ?, costo = ?, iva_alicuota = ?, visible_qr = ?, va_a_cocina = ?, apto_celiaco = ?,
  apto_vegetariano = ?, apto_vegano = ?, horario_desde = ?, horario_hasta = ?,
  orden = ?, activo = ?`;

function valoresProducto(d: Producto): unknown[] {
  return [
    d.categoria_id, d.nombre, d.descripcion ?? null, d.codigo_corto || null,
    d.precio.toFixed(2), d.costo.toFixed(2), d.iva_alicuota.toFixed(2),
    d.visible_qr ? 1 : 0, d.va_a_cocina ? 1 : 0,
    d.apto_celiaco ? 1 : 0, d.apto_vegetariano ? 1 : 0,
    d.apto_vegano ? 1 : 0, d.horario_desde || null, d.horario_hasta || null,
    d.orden, d.activo ? 1 : 0,
  ];
}

export async function crearProducto(datos: Producto, actor: UsuarioToken) {
  const res = await ejecutar(pool, `INSERT INTO productos SET ${CAMPOS_PRODUCTO}`, valoresProducto(datos));
  await auditar({ actor, accion: 'producto_creado', entidad: 'producto', entidad_id: res.insertId, datos: { nombre: datos.nombre, precio: datos.precio } });
  return { id: res.insertId };
}

/** Todo cambio de precio queda en precio_historial con autor y fecha. */
export async function editarProducto(id: number, datos: Producto, actor: UsuarioToken) {
  const previo = await consultarUna<{ precio: string }>(
    pool,
    'SELECT precio FROM productos WHERE id = ?',
    [id]
  );
  if (!previo) throw noEncontrado('Producto no encontrado');

  await ejecutar(pool, `UPDATE productos SET ${CAMPOS_PRODUCTO} WHERE id = ?`, [
    ...valoresProducto(datos),
    id,
  ]);

  if (Number(previo.precio) !== datos.precio) {
    await ejecutar(
      pool,
      `INSERT INTO precio_historial (producto_id, precio_anterior, precio_nuevo, usuario_id)
       VALUES (?, ?, ?, ?)`,
      [id, previo.precio, datos.precio.toFixed(2), actor.id]
    );
    await auditar({
      actor, accion: 'precio_cambiado', entidad: 'producto', entidad_id: id,
      datos: { de: previo.precio, a: datos.precio.toFixed(2) },
    });
  }
  await auditar({ actor, accion: 'producto_editado', entidad: 'producto', entidad_id: id });
  return { id };
}

export async function crearVariante(productoId: number, datos: Variante, actor: UsuarioToken) {
  const res = await ejecutar(
    pool,
    'INSERT INTO producto_variantes (producto_id, nombre, precio, orden, activa) VALUES (?, ?, ?, ?, ?)',
    [productoId, datos.nombre, datos.precio.toFixed(2), datos.orden, datos.activa ? 1 : 0]
  );
  await auditar({ actor, accion: 'variante_creada', entidad: 'producto', entidad_id: productoId });
  return { id: res.insertId };
}

export async function editarVariante(id: number, datos: Variante, actor: UsuarioToken) {
  const res = await ejecutar(
    pool,
    'UPDATE producto_variantes SET nombre = ?, precio = ?, orden = ?, activa = ? WHERE id = ?',
    [datos.nombre, datos.precio.toFixed(2), datos.orden, datos.activa ? 1 : 0, id]
  );
  if (!res.affectedRows) throw noEncontrado('Variante no encontrada');
  await auditar({ actor, accion: 'variante_editada', entidad: 'variante', entidad_id: id });
  return { id };
}
