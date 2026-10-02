import { z } from 'zod';

export const abrirBorradorSchema = z.object({
  mesa_id: z.coerce.number().int().positive().nullish(),
  cuenta_id: z.coerce.number().int().positive().nullish(),
});

export const itemBorradorSchema = z.object({
  producto_id: z.coerce.number().int().positive(),
  variante_id: z.coerce.number().int().positive().nullish(),
  cantidad: z.coerce.number().int().min(1).max(99).default(1),
  nota: z.string().max(255).nullish(),
  opcion_ids: z.array(z.coerce.number().int().positive()).max(20).default([]),
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

export const notaBorradorSchema = z.object({
  nota: z.string().max(255).nullish(),
  /** Informativo para caja: prepara el posnet o el cambio antes de que lleguen. */
  pago_previsto: z.enum(['efectivo', 'tarjeta', 'transferencia', 'qr', 'mixto']).nullish(),
});

export const convertirSchema = z.object({
  cuenta_id: z.coerce.number().int().positive().nullish(),
  enviar: z.coerce.boolean().default(true),
  urgente: z.coerce.boolean().default(false),
});
