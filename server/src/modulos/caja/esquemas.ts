import { z } from 'zod';

const monto = z.coerce.number().min(0).max(99_999_999);

export const abrirTurnoSchema = z.object({
  fondo_inicial: monto.default(0),
});

export const cerrarTurnoSchema = z.object({
  total_declarado: monto,
  nota: z.string().max(255).nullish(),
});

export const CATEGORIAS_MOVIMIENTO = [
  'mercaderia', 'sueldo', 'adelanto', 'servicio', 'alquiler', 'impuesto',
  'mantenimiento', 'retiro', 'aporte', 'otro',
] as const;

export const movimientoSchema = z.object({
  tipo: z.enum(['ingreso', 'egreso', 'retiro']),
  /** Sólo lo que se mueve en efectivo toca el cajón. */
  medio: z.enum(['efectivo', 'debito', 'credito', 'transferencia', 'qr']).default('efectivo'),
  categoria: z.enum(CATEGORIAS_MOVIMIENTO).default('otro'),
  monto: monto.refine((v) => v > 0, 'El monto tiene que ser mayor a cero'),
  motivo: z.string().min(3).max(255),
});

export const pagoSchema = z.object({
  medio: z.enum(['efectivo', 'debito', 'credito', 'transferencia', 'qr']),
  monto: monto.refine((v) => v > 0, 'El monto tiene que ser mayor a cero'),
  /** Solo efectivo: con cuánto pagó, para calcular el vuelto. */
  recibido: monto.nullish(),
  referencia: z.string().max(80).nullish(),
});

export const comprobanteSchema = z.object({
  tipo: z.enum(['ticket', 'factura_a', 'factura_b', 'factura_c']),
  doc_tipo: z.enum(['CUIT', 'DNI', 'CF']).nullish(),
  doc_nro: z.string().max(20).nullish(),
  receptor: z.string().max(160).nullish(),
});

export const cobrarSchema = z.object({
  pagos: z.array(pagoSchema).min(1).max(10),
  propina: monto.default(0),
  /** Clave de idempotencia: dos toques al botón no cobran dos veces. */
  idempotency_key: z.string().min(8).max(60),
  comprobante: comprobanteSchema.nullish(),
});
