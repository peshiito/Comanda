import rateLimit from 'express-rate-limit';
import { esProduccion } from '../config/env.js';

/** Limitador general: generoso, el salón dispara muchas llamadas por minuto. */
export const limitadorGeneral = rateLimit({
  windowMs: 60_000,
  limit: esProduccion ? 600 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, esperá unos segundos' },
});

/** Login por contraseña o PIN: acotado para que un PIN de 4 dígitos no se fuerce. */
export const limitadorLogin = rateLimit({
  windowMs: 10 * 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos. Esperá unos minutos.' },
});

/** Acciones autorizadas con PIN (anular, descontar, pérdida). */
export const limitadorPin = rateLimit({
  windowMs: 10 * 60_000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos con PIN. Esperá unos minutos.' },
});
