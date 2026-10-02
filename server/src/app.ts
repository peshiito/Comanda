import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { limitadorGeneral } from './middlewares/limites.js';
import { manejarErrores, noEncontrado } from './middlewares/errores.js';
import rutasAuth from './modulos/auth/rutas.js';
import rutasCarta from './modulos/carta/rutas.js';
import rutasSalon from './modulos/salon/rutas.js';
import rutasBorradores from './modulos/borradores/rutas.js';
import rutasCuentas from './modulos/cuentas/rutas.js';
import rutasComandas from './modulos/comandas/rutas.js';
import rutasCaja from './modulos/caja/rutas.js';
import rutasReportes from './modulos/reportes/rutas.js';
import rutasAdmin from './modulos/admin/rutas.js';

/** Relativa al proceso del servidor, que corre desde `server/`. */
export const CARPETA_FOTOS = path.resolve(process.cwd(), 'uploads/carta');

export function crearApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: env.CORS_ORIGEN.split(',').map((o) => o.trim()),
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(limitadorGeneral);

  app.get('/api/salud', (_req, res) => {
    res.json({ ok: true, ambiente: env.NODE_ENV, hora: new Date().toISOString() });
  });

  /**
   * Fotos de la carta. Van en disco y no en la base: así el backup de la base
   * sigue pesando kilobytes, y el mini PC del local las sirve igual sin
   * internet. `productos.foto` guarda sólo el nombre del archivo.
   */
  app.use(
    '/fotos',
    express.static(CARPETA_FOTOS, {
      maxAge: '7d',
      index: false,
      // Si no está, que caiga en el 404 de la API y no en un listado.
      fallthrough: true,
    })
  );

  app.use('/api/auth', rutasAuth);
  app.use('/api/carta', rutasCarta);
  app.use('/api/salon', rutasSalon);
  app.use('/api/borradores', rutasBorradores);
  app.use('/api/cuentas', rutasCuentas);
  app.use('/api/comandas', rutasComandas);
  app.use('/api/caja', rutasCaja);
  app.use('/api/reportes', rutasReportes);
  app.use('/api/admin', rutasAdmin);

  app.use(noEncontrado);
  app.use(manejarErrores);

  return app;
}
