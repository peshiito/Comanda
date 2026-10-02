import { z } from 'zod';

const precio = z.coerce.number().min(0).max(99_999_999);

export const categoriaSchema = z.object({
  nombre: z.string().min(1).max(60),
  orden: z.coerce.number().int().default(0),
  activa: z.coerce.boolean().default(true),
});

export const productoSchema = z.object({
  categoria_id: z.coerce.number().int().positive(),
  nombre: z.string().min(1).max(120),
  descripcion: z.string().max(400).nullish(),
  codigo_corto: z.string().max(8).nullish(),
  precio,
  costo: precio.default(0),
  iva_alicuota: z.coerce.number().min(0).max(50).default(21),
  visible_qr: z.coerce.boolean().default(true),
  /** Falso = sale de la barra y no genera comanda de cocina. */
  va_a_cocina: z.coerce.boolean().default(true),
  apto_celiaco: z.coerce.boolean().default(false),
  apto_vegetariano: z.coerce.boolean().default(false),
  apto_vegano: z.coerce.boolean().default(false),
  horario_desde: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullish(),
  horario_hasta: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullish(),
  orden: z.coerce.number().int().default(0),
  activo: z.coerce.boolean().default(true),
});

export const varianteSchema = z.object({
  nombre: z.string().min(1).max(60),
  precio,
  orden: z.coerce.number().int().default(0),
  activa: z.coerce.boolean().default(true),
});

export const grupoSchema = z.object({
  nombre: z.string().min(1).max(80),
  obligatorio: z.coerce.boolean().default(false),
  min_sel: z.coerce.number().int().min(0).max(20).default(0),
  max_sel: z.coerce.number().int().min(1).max(20).default(1),
  activo: z.coerce.boolean().default(true),
});

export const opcionSchema = z.object({
  nombre: z.string().min(1).max(80),
  delta_precio: z.coerce.number().min(-99_999).max(99_999).default(0),
  orden: z.coerce.number().int().default(0),
  activa: z.coerce.boolean().default(true),
});

export const agotadoSchema = z.object({
  agotado: z.coerce.boolean(),
  /** 'hoy' se limpia al abrir turno; 'baja' queda hasta reactivar a mano. */
  alcance: z.enum(['hoy', 'baja']).default('hoy'),
});

export const stockSchema = z.object({
  stock_restante: z.coerce.number().int().min(0).nullable(),
});

export const vincularSchema = z.object({
  grupo_ids: z.array(z.coerce.number().int().positive()).max(12),
});
