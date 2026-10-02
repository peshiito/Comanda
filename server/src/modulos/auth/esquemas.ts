import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Falta la contraseña'),
});

export const pinSchema = z.object({
  usuario_id: z.coerce.number().int().positive(),
  pin: z.string().regex(/^\d{4,6}$/, 'El PIN son 4 a 6 dígitos'),
});

export type Login = z.infer<typeof loginSchema>;
export type LoginPin = z.infer<typeof pinSchema>;
