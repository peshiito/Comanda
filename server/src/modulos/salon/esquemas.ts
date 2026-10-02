import { z } from 'zod';

/** Topes del lienzo del plano, en las mismas unidades que pos_x/pos_y. */
const LIENZO = { ancho: 1000, alto: 620 };

export const mesaSchema = z.object({
  nombre: z.string().min(1).max(20),
  capacidad: z.coerce.number().int().min(1).max(40).default(4),
  pos_x: z.coerce.number().int().min(0).max(LIENZO.ancho).default(0),
  pos_y: z.coerce.number().int().min(0).max(LIENZO.alto).default(0),
  // Mínimos para que una mesa siga siendo tocable con el dedo en el plano
  ancho: z.coerce.number().int().min(60).max(LIENZO.ancho).default(140),
  alto: z.coerce.number().int().min(60).max(LIENZO.alto).default(96),
  forma: z.enum(['cuadrada', 'rectangular', 'redonda']).default('rectangular'),
  activa: z.coerce.boolean().default(true),
});

/** Mover y estirar van juntos: arrastrar una esquina hace las dos cosas. */
export const posicionSchema = z.object({
  pos_x: z.coerce.number().int().min(0).max(LIENZO.ancho),
  pos_y: z.coerce.number().int().min(0).max(LIENZO.alto),
  ancho: z.coerce.number().int().min(60).max(LIENZO.ancho).optional(),
  alto: z.coerce.number().int().min(60).max(LIENZO.alto).optional(),
});

export const zonaSchema = z.object({
  nombre: z.string().min(1).max(30),
  pos_x: z.coerce.number().int().min(0).max(LIENZO.ancho).default(0),
  pos_y: z.coerce.number().int().min(0).max(LIENZO.alto).default(0),
  ancho: z.coerce.number().int().min(30).max(LIENZO.ancho).default(160),
  alto: z.coerce.number().int().min(20).max(LIENZO.alto).default(80),
  tipo: z.enum(['area', 'puerta']).default('area'),
  activa: z.coerce.boolean().default(true),
});

export const unirSchema = z.object({
  mesa_ids: z.array(z.coerce.number().int().positive()).min(1).max(8),
});

export const reservaSchema = z.object({
  mesa_id: z.coerce.number().int().positive(),
  nombre: z.string().min(1).max(80),
  telefono: z.string().max(30).nullish(),
  personas: z.coerce.number().int().min(1).max(40).default(2),
  fecha_hora: z.string().min(10),
  nota: z.string().max(255).nullish(),
});

export const estadoReservaSchema = z.object({
  estado: z.enum(['pendiente', 'consumida', 'cancelada']),
});
