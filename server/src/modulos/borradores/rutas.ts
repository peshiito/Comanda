import { Router } from 'express';
import { asyncHandler } from '../../middlewares/errores.js';
import { idParam } from '../../utils/params.js';
import { autenticar, exigirCaja, exigirSalon } from '../../middlewares/auth.js';
import * as srv from './servicio.js';
import { convertirBorrador } from './convertir.js';
import {
  abrirBorradorSchema, convertirSchema, itemBorradorSchema, notaBorradorSchema,
} from './esquemas.js';

const router = Router();
router.use(autenticar);

const id = idParam;

/** Mi libreta para esta mesa (la crea si no existe). */
router.post(
  '/mio',
  exigirSalon,
  asyncHandler(async (req, res) => {
    const { mesa_id, cuenta_id } = abrirBorradorSchema.parse(req.body);
    res.json(await srv.miBorrador(req.usuario!, mesa_id ?? null, cuenta_id ?? null));
  })
);

router.post(
  '/:id/items',
  exigirSalon,
  asyncHandler(async (req, res) =>
    res.status(201).json(await srv.agregarItem(id(req.params.id), itemBorradorSchema.parse(req.body), req.usuario!))
  )
);

router.delete(
  '/:id/items/:itemId',
  exigirSalon,
  asyncHandler(async (req, res) =>
    res.json(await srv.quitarItem(id(req.params.id), id(req.params.itemId), req.usuario!))
  )
);

router.patch(
  '/:id',
  exigirSalon,
  asyncHandler(async (req, res) =>
    res.json(await srv.editarNota(id(req.params.id), notaBorradorSchema.parse(req.body), req.usuario!))
  )
);

router.post(
  '/:id/pasar',
  exigirSalon,
  asyncHandler(async (req, res) => res.json(await srv.pasarACaja(id(req.params.id), req.usuario!)))
);

/** Bandeja de caja: las mesas esperando que se carguen. */
router.get('/pendientes', exigirCaja, asyncHandler(async (_req, res) => res.json(await srv.pendientes())));

router.post(
  '/:id/convertir',
  exigirCaja,
  asyncHandler(async (req, res) =>
    res.json(await convertirBorrador(id(req.params.id), convertirSchema.parse(req.body), req.usuario!))
  )
);

export default router;
