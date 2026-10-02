import { z } from 'zod';

export const itemPedidoSchema = z.object({
  producto_id: z.coerce.number().int().positive(),
  variante_id: z.coerce.number().int().positive().nullish(),
  cantidad: z.coerce.number().int().min(1).max(99).default(1),
  nota: z.string().max(255).nullish(),
  opcion_ids: z.array(z.coerce.number().int().positive()).max(20).default([]),
  /**
   * Cuántas de cada opción, para los grupos `por_cantidad`. Tiene que sumar
   * la cantidad del ítem. En los grupos normales no se manda.
   */
  opcion_cant: z
    .array(
      z.object({
        opcion_id: z.coerce.number().int().positive(),
        cantidad: z.coerce.number().int().min(1).max(99),
      })
    )
    .max(20)
    .default([]),
});

export const abrirCuentaSchema = z.object({
  tipo: z.enum(['salon', 'take_away']).default('salon'),
  mesa_id: z.coerce.number().int().positive().nullish(),
  referencia: z.string().max(60).nullish(),
  mozo_id: z.coerce.number().int().positive().nullish(),
  comensales: z.coerce.number().int().min(0).max(60).default(0),
});

export const agregarItemsSchema = z.object({
  items: z.array(itemPedidoSchema).min(1).max(60),
  version: z.coerce.number().int().nonnegative().optional(),
  /** Manda la comanda a cocina en el mismo paso. */
  enviar: z.coerce.boolean().default(false),
  urgente: z.coerce.boolean().default(false),
  nota_comanda: z.string().max(255).nullish(),
});

export const enviarSchema = z.object({
  urgente: z.coerce.boolean().default(false),
  nota: z.string().max(255).nullish(),
});

export const anularSchema = z.object({
  motivo: z.string().min(3).max(255),
  pin: z.string().regex(/^\d{4,6}$/).optional(),
});

export const devolverSchema = z.object({
  motivo: z.enum(['error_cocina', 'error_pedido', 'devuelto_cliente', 'se_cayo', 'otro']),
  detalle: z.string().max(255).nullish(),
  /** Con reposición: vuelve a cocina como urgente y no se cobra dos veces. */
  reponer: z.coerce.boolean().default(false),
  pin: z.string().regex(/^\d{4,6}$/).optional(),
});

export const descuentoSchema = z.object({
  monto: z.coerce.number().min(0).max(99_999_999),
  motivo: z.string().min(3).max(255),
  pin: z.string().regex(/^\d{4,6}$/).optional(),
});

export const comensalesSchema = z.object({
  comensales: z.coerce.number().int().min(0).max(60),
});

export const moverSchema = z.object({
  mesa_id: z.coerce.number().int().positive().nullable(),
});

export const fusionarSchema = z.object({
  destino_id: z.coerce.number().int().positive(),
});

export const moverItemSchema = z.object({
  cuenta_destino_id: z.coerce.number().int().positive(),
});

export const perdidaSchema = z.object({
  motivo: z.string().min(5).max(255),
  pin: z.string().regex(/^\d{4,6}$/).optional(),
});

export const asignarMozoSchema = z.object({
  mozo_id: z.coerce.number().int().positive().nullable(),
});
