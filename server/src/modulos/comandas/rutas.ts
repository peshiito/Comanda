import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middlewares/errores.js';
import { idParam } from '../../utils/params.js';
import { autenticar, exigirCaja, exigirRol } from '../../middlewares/auth.js';
import { comandasDelDia, comandasListas, comandasPendientes } from './consultas.js';
import { deshacer, marcarRetirado, marcarUrgente, terminar } from './servicio.js';

const router = Router();
router.use(autenticar);

const id = idParam;
const urgenteSchema = z.object({ urgente: z.coerce.boolean() });

/** La pantalla de cocina. */
router.get('/pendientes', asyncHandler(async (_req, res) => res.json(await comandasPendientes())));

/** Avisos de plato listo: el mozo ve los suyos. */
router.get(
  '/listas',
  asyncHandler(async (req, res) => {
    const soloMias = req.usuario!.rol === 'mozo';
    res.json(await comandasListas(soloMias ? req.usuario!.id : undefined));
  })
);

router.get('/dia', exigirCaja, asyncHandler(async (_req, res) => res.json(await comandasDelDia())));

/** Único botón de la cocina. */
router.post(
  '/:id/terminada',
  exigirRol('cocina', 'caja', 'encargado'),
  asyncHandler(async (req, res) => res.json(await terminar(id(req.params.id), req.usuario!)))
);

router.post(
  '/:id/deshacer',
  exigirRol('cocina', 'caja', 'encargado'),
  asyncHandler(async (req, res) => res.json(await deshacer(id(req.params.id), req.usuario!)))
);

/** La prioridad la pone caja al armar la comanda, o el encargado después. */
router.post(
  '/:id/urgente',
  exigirCaja,
  asyncHandler(async (req, res) => {
    const { urgente } = urgenteSchema.parse(req.body);
    res.json(await marcarUrgente(id(req.params.id), urgente, req.usuario!));
  })
);

/** El mozo apaga el aviso cuando lleva los platos. */
router.post(
  '/:id/retirado',
  exigirRol('mozo', 'caja', 'encargado'),
  asyncHandler(async (req, res) => res.json(await marcarRetirado(id(req.params.id), req.usuario!)))
);

export default router;
